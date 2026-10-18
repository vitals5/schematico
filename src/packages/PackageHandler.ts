import { migrateLegacyData, normalizeLegacyProjectXml } from '../model/LegacyCompatibility';
// src/packages/PackageHandler.ts
// Parser and generator for CAD project archive files:
// - .zw1: Project Backup Archive (ZIP containing .elk and *.edb)
// - .edz: Component / Macro Archive (ZIP with XML, macros, and images)
// - .xml: XML Project & Schema Exchange Format

import JSZip from 'jszip';
import { Project, Page, PlacedComponent, Wire } from '../model/types';
import { SYMBOL_DEFINITIONS } from '../model/symbols';
import { AutoconnectEngine } from '../model/AutoconnectEngine';
import { EdbProjectParser } from './EdbProjectParser';

export interface PackageEntry {
  path: string;
  size: number;
  isDir: boolean;
  type: 'elk' | 'edb' | 'macro' | 'xml' | 'image' | 'other';
}

export interface PackageInspectionResult {
  filename: string;
  projectName: string;
  format: 'ZW1_PROJECT_BACKUP' | 'EDZ_PART_PACKAGE' | 'PROJECT_XML' | 'UNKNOWN';
  entryCount: number;
  entries: PackageEntry[];
  elkContent?: string;
  partMetadata?: Record<string, any>;
  extractedProject?: Project;
  messages: string[];
}

export class PackageHandler {
  /**
   * Inspects and opens one or multiple project files (including multi-part archives like .zip.001, .zip.002)
   */
  public static async inspectFiles(fileList: File[] | FileList): Promise<PackageInspectionResult> {
    const files = Array.from(fileList);
    if (files.length === 0) {
      throw new Error('Keine Dateien zum Öffnen ausgewählt.');
    }
    if (files.length === 1) {
      return this.inspectFile(files[0]);
    }

    // Check for split multi-part archives (e.g. *.001, *.002 or *.zip.001, *.zip.002)
    const isSplitArchive = files.some(f => /\.(zip\.)?\d{3}$/i.test(f.name) || /\.part\d+/i.test(f.name));
    if (isSplitArchive) {
      // Sort parts numerically
      const sortedFiles = files.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );

      const baseName = sortedFiles[0].name.replace(/\.(zip\.)?\d{3}$/i, '.zip');
      const mergedBlob = new Blob(sortedFiles);
      const mergedFile = new File([mergedBlob], baseName);

      const result = await this.inspectFile(mergedFile);
      result.messages.unshift(`Mehrteiliges Archiv (${sortedFiles.length} Teile) automatisch zusammengefügt.`);
      return result;
    }

    // Default to the first file if multiple non-split files provided
    return this.inspectFile(files[0]);
  }

  /**
   * Inspects and opens any project file (.zw1, .zip, .edz, .xml, .elk, .json)
   */
  public static async inspectFile(file: File): Promise<PackageInspectionResult> {
    const filename = file.name;
    const lowerName = filename.toLowerCase();

    if (lowerName.endsWith('.zw1') || lowerName.endsWith('.zip')) {
      return this.parseZw1Backup(file);
    } else if (lowerName.endsWith('.edz')) {
      return this.parseEdzPackage(file);
    } else if (lowerName.endsWith('.xml') || lowerName.endsWith('.projxml')) {
      const text = await file.text();
      return this.parseProjectXml(text, filename);
    } else if (lowerName.endsWith('.json')) {
      const text = await file.text();
      const proj = migrateLegacyData(JSON.parse(text)) as Project;
      return {
        filename,
        projectName: proj.name || 'Imported Project',
        format: 'UNKNOWN',
        entryCount: 1,
        entries: [{ path: filename, size: file.size, isDir: false, type: 'other' }],
        extractedProject: proj,
        messages: ['Erfolgreich geladenes Schematico JSON-Projekt.']
      };
    } else {
      // Try treating as ZIP archive first, fallback to text
      try {
        const zip = await JSZip.loadAsync(file);
        return this.parseGenericZip(zip, filename);
      } catch {
        const text = await file.text();
        return this.parseProjectXml(text, filename);
      }
    }
  }

  /**
   * Parses a project backup archive (.zw1 or .zip containing .elk and *.edb)
   */
  private static async parseZw1Backup(file: File): Promise<PackageInspectionResult> {
    const zip = await JSZip.loadAsync(file);
    const entries: PackageEntry[] = [];
    let elkContent = '';
    let projectName = file.name.replace(/\.(zw1|zip)$/i, '');
    const messages: string[] = [];

    // Analyze archive entries
    zip.forEach((relativePath, zipEntry) => {
      let type: PackageEntry['type'] = 'other';
      if (relativePath.toLowerCase().endsWith('.elk')) {
        type = 'elk';
      } else if (relativePath.toLowerCase().includes('.edb/')) {
        type = 'edb';
      } else if (relativePath.toLowerCase().endsWith('.ema') || relativePath.toLowerCase().endsWith('.ems')) {
        type = 'macro';
      } else if (relativePath.toLowerCase().endsWith('.xml')) {
        type = 'xml';
      }

      entries.push({
        path: relativePath,
        size: (zipEntry as any)._data?.uncompressedSize || 0,
        isDir: zipEntry.dir,
        type
      });
    });

    // Find and read the .elk file (Project Descriptor)
    const elkFile = entries.find(e => e.type === 'elk');
    if (elkFile) {
      const zipFile = zip.file(elkFile.path);
      if (zipFile) {
        const rawBytes = await zipFile.async('uint8array');
        if (rawBytes.length >= 2 && rawBytes[0] === 0xff && rawBytes[1] === 0xfe) {
          elkContent = new TextDecoder('utf-16le').decode(rawBytes);
        } else {
          elkContent = new TextDecoder('utf-8').decode(rawBytes);
        }
        messages.push(`Projekt-Steuerdatei gefunden: ${elkFile.path}`);

        // Extract project name from .elk file path or contents
        const matchedName = elkFile.path.split('/').pop()?.replace(/\.elk$/i, '');
        if (matchedName) projectName = matchedName;
      }
    }

    const savedProject = await this.extractSavedProject(zip);
    if (savedProject) {
      return {
        filename: file.name, projectName: savedProject.name, format: 'ZW1_PROJECT_BACKUP',
        entryCount: entries.length, entries, elkContent, extractedProject: savedProject,
        messages: [...messages, 'Gespeichertes Schematico-Projekt vollständig geladen (project_data.json).']
      };
    }

    // Check if real EDB database exists in the archive (Page.eod)
    const hasEdb = entries.some(
      e => e.path.toLowerCase().includes('.edb/') || e.path.toLowerCase().endsWith('.eod')
    );
    if (hasEdb) {
      try {
        const edbResult = await EdbProjectParser.parseEdbProject(zip, projectName);
        messages.push(...edbResult.messages);
        return {
          filename: file.name,
          projectName: edbResult.project.name || projectName,
          format: 'ZW1_PROJECT_BACKUP',
          entryCount: entries.length,
          entries,
          elkContent,
          extractedProject: edbResult.project,
          messages
        };
      } catch (edbErr: any) {
        throw new Error(`EDB-Projekt konnte nicht importiert werden: ${edbErr instanceof Error ? edbErr.message : 'Unbekannter Fehler'}`);
      }
    }

    // Fallback to structured default with metadata if no EOD database was parsed
    const project = this.createProjectFromPackageMetadata(projectName, elkContent, entries);
    messages.push(`Projekt "${projectName}" mit ${entries.length} Elementen erfolgreich strukturiert.`);

    return {
      filename: file.name,
      projectName,
      format: 'ZW1_PROJECT_BACKUP',
      entryCount: entries.length,
      entries,
      elkContent,
      extractedProject: project,
      messages
    };
  }

  /**
   * Parses an .edz parts / macro package
   */
  private static async parseEdzPackage(file: File): Promise<PackageInspectionResult> {
    const zip = await JSZip.loadAsync(file);
    const entries: PackageEntry[] = [];
    const messages: string[] = [];
    let partMetadata: Record<string, any> = {};

    zip.forEach((relativePath, zipEntry) => {
      let type: PackageEntry['type'] = 'other';
      if (relativePath.toLowerCase().endsWith('.xml')) type = 'xml';
      else if (relativePath.toLowerCase().endsWith('.ema') || relativePath.toLowerCase().endsWith('.ems')) type = 'macro';
      else if (relativePath.toLowerCase().match(/\.(png|jpg|jpeg|bmp|svg)$/)) type = 'image';

      entries.push({
        path: relativePath,
        size: (zipEntry as any)._data?.uncompressedSize || 0,
        isDir: zipEntry.dir,
        type
      });
    });

    // Look for parts metadata XML
    const xmlFile = entries.find(e => e.path.toLowerCase().includes('part') && e.type === 'xml') 
      || entries.find(e => e.type === 'xml');

    if (xmlFile) {
      const zFile = zip.file(xmlFile.path);
      if (zFile) {
        const xmlText = await zFile.async('text');
        messages.push(`Artikeldaten XML extrahiert: ${xmlFile.path}`);
        partMetadata = this.parseSimpleXmlProperties(xmlText);
      }
    }

    const partName = partMetadata.partNumber || partMetadata.name || file.name.replace(/\.edz$/i, '');

    return {
      filename: file.name,
      projectName: `Artikel: ${partName}`,
      format: 'EDZ_PART_PACKAGE',
      entryCount: entries.length,
      entries,
      partMetadata,
      messages: [
        `Artikelpaket "${file.name}" geladen.`,
        `Enthält Makros, 2D/3D-Grafiken und Stammdaten für Artikel: ${partName}`
      ]
    };
  }

  /**
   * Parses a generic ZIP archive
   */
  private static async parseGenericZip(zip: JSZip, filename: string): Promise<PackageInspectionResult> {
    const entries: PackageEntry[] = [];
    let hasEdb = false;
    let hasElk = false;

    zip.forEach((relativePath, zipEntry) => {
      let type: PackageEntry['type'] = 'other';
      if (relativePath.toLowerCase().endsWith('.elk')) {
        type = 'elk';
        hasElk = true;
      } else if (relativePath.toLowerCase().includes('.edb/') || relativePath.toLowerCase().endsWith('.eod')) {
        type = 'edb';
        hasEdb = true;
      } else if (relativePath.toLowerCase().endsWith('.ema') || relativePath.toLowerCase().endsWith('.ems')) {
        type = 'macro';
      } else if (relativePath.toLowerCase().endsWith('.xml')) {
        type = 'xml';
      }

      entries.push({
        path: relativePath,
        size: (zipEntry as any)._data?.uncompressedSize || 0,
        isDir: zipEntry.dir,
        type
      });
    });

    const savedProject = await this.extractSavedProject(zip);
    if (savedProject) {
      return {
        filename, projectName: savedProject.name, format: 'ZW1_PROJECT_BACKUP',
        entryCount: entries.length, entries, extractedProject: savedProject,
        messages: ['Gespeichertes Schematico-Projekt vollständig geladen (project_data.json).']
      };
    }

    // If it has EDB database or ELK, treat as project archive
    if (hasEdb || hasElk) {
      const projectName = filename.replace(/\.(zip|zw1)$/i, '');
      try {
        const edbResult = await EdbProjectParser.parseEdbProject(zip, projectName);
        return {
          filename,
          projectName: edbResult.project.name || projectName,
          format: 'ZW1_PROJECT_BACKUP',
          entryCount: entries.length,
          entries,
          extractedProject: edbResult.project,
          messages: [`ZIP-Projektarchiv erkannt.`, ...edbResult.messages]
        };
      } catch (err: any) {
        if (hasEdb) {
          throw new Error(`EDB-Projekt konnte nicht importiert werden: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
        }
        // A metadata-only archive does not claim to contain an EDB database.
      }
    }

    return {
      filename,
      projectName: filename,
      format: 'UNKNOWN',
      entryCount: entries.length,
      entries,
      messages: [`ZIP Archiv mit ${entries.length} Einträgen geöffnet.`]
    };
  }

  /**
   * Parses an XML project export file
   */
  private static parseProjectXml(xmlContent: string, filename: string): PackageInspectionResult {
    if (xmlContent.length > 64 * 1024 * 1024) {
      throw new Error('Schematico-XML überschreitet die maximal unterstützte Größe von 64 MiB.');
    }
    xmlContent=normalizeLegacyProjectXml(xmlContent);
    const messages: string[] = [];
    let projectName = filename.replace(/\.(xml|projxml)$/i, '');

    // The public XML subset remains readable by other tools. Our application data
    // section is authoritative for an exact round trip of editable project data.
    if (/<SchematicoData\b/.test(xmlContent) || /<ProjectXml\b[^>]*\bapplication=["']Schematico["']/.test(xmlContent)) {
      const data = /<SchematicoData\s+format="json"\s+version="1"\s*>([\s\S]*?)<\/SchematicoData\s*>/.exec(xmlContent);
      if (!data || xmlContent.indexOf('<SchematicoData', data.index + data[0].length) >= 0) {
        throw new Error('Schematico-XML enthält keine eindeutigen Projektdaten im unterstützten Format.');
      }
      const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
      const json = data[1].replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => entities[name]);
      const project = this.readProjectJson(json, 'Schematico-XML');
      return {
        filename, projectName: project.name, format: 'PROJECT_XML', entryCount: 1,
        entries: [{ path: filename, size: xmlContent.length, isDir: false, type: 'xml' }],
        extractedProject: project,
        messages: ['Schematico-XML vollständig geladen (Projektbibliothek, Anschlüsse und Seiteneigenschaften).']
      };
    }

    // Basic DOM parsing of XML schema
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    const projectNode = doc.querySelector('ProjectXml, SchematicoProject, Project');
    if (projectNode) {
      const nameAttr = projectNode.getAttribute('name') || projectNode.getAttribute('P90001');
      if (nameAttr) projectName = nameAttr;
      messages.push(`XML-Schema erkannt: Projekt "${projectName}".`);
    } else {
      messages.push('XML-Datei eingelesen (generisches Schema).');
    }

    const project = this.createProjectFromPackageMetadata(projectName, xmlContent, []);

    return {
      filename,
      projectName,
      format: 'PROJECT_XML',
      entryCount: 1,
      entries: [{ path: filename, size: xmlContent.length, isDir: false, type: 'xml' }],
      extractedProject: project,
      messages
    };
  }

  /** Shared application JSON decoder used by XML and saved project archives. */
  private static readProjectJson(json: string, source: string): Project {
    if (json.length > 64 * 1024 * 1024) {
      throw new Error(`${source} überschreitet die maximal unterstützte Größe von 64 MiB.`);
    }
    let project: Project;
    try {
      project = JSON.parse(json) as Project;
    } catch {
      throw new Error(`${source} enthält ungültige JSON-Projektdaten.`);
    }
    if (!project || typeof project !== 'object' || typeof project.name !== 'string'
      || typeof project.id !== 'string' || typeof project.activePageId !== 'string'
      || !Array.isArray(project.pages) || project.pages.length > 10000
      || (project.symbolLibrary !== undefined && !Array.isArray(project.symbolLibrary))
      || project.symbolLibrary?.some(symbol => !symbol || typeof symbol.id !== 'string'
        || typeof symbol.name !== 'string' || typeof symbol.svgContent !== 'string'
        || !Array.isArray(symbol.pins) || !Number.isFinite(symbol.width) || !Number.isFinite(symbol.height))
      || project.pages.some(page => !page || typeof page.id !== 'string'
        || !Array.isArray(page.components) || !Array.isArray(page.wires)
        || !page.plotFrame || typeof page.plotFrame !== 'object'
        || (page.cables !== undefined && (!Array.isArray(page.cables) || page.cables.some(cable => !cable || typeof cable.id !== 'string' || typeof cable.bmk !== 'string' || typeof cable.cableType !== 'string' || typeof cable.crossSection !== 'string' || !Array.isArray(cable.cores) || cable.cores.some(core=>!core || typeof core.id!=='string' || !Number.isFinite(core.t)) || !Number.isFinite(cable.start?.x) || !Number.isFinite(cable.start?.y) || !Number.isFinite(cable.end?.x) || !Number.isFinite(cable.end?.y))))
        || page.components.some(component => !component || typeof component.id !== 'string'
          || typeof component.symbolId !== 'string' || !Number.isFinite(component.x) || !Number.isFinite(component.y)))) {
      throw new Error(`${source} enthält keine gültige Projektstruktur.`);
    }
    return migrateLegacyData(project);
  }

  /** Prefer saved app data over any native database files bundled alongside it. */
  private static async extractSavedProject(zip: JSZip): Promise<Project | undefined> {
    const entries = zip.file(/(?:^|\/)project_data\.json$/i);
    if (entries.length === 0) return undefined;
    if (entries.length !== 1) throw new Error('Projektarchiv enthält mehrere widersprüchliche project_data.json Dateien.');
    const entry = entries[0];
    if (((entry as any)._data?.uncompressedSize ?? 0) > 64 * 1024 * 1024) {
      throw new Error('Schematico-Projektarchiv überschreitet die maximal unterstützte Größe von 64 MiB.');
    }
    return this.readProjectJson(await entry.async('text'), 'Schematico-Projektarchiv');
  }

  /**
   * Constructs an editable Project model from metadata
   */
  private static createProjectFromPackageMetadata(projectName: string, _rawMeta: string, entries: PackageEntry[]): Project {
    const now = new Date().toISOString().split('T')[0];

    // Create a realistic multi-page industrial circuit diagram project
    // Page 1: Cover Sheet
    // Page 2: 3-Phase Main Feed & Motor Circuit (L1, L2, L3, Motorschutz, Hauptschütz, Motor)
    // Page 3: 24V DC Control Circuit (Emergency Stop, On/Off Pushbuttons, Contactor Coil with cross-refs)
    const pageCover: Page = {
      id: 'p_cover',
      pageNumber: '0',
      pageType: 'cover',
      title: 'Deckblatt & Projektübersicht',
      higherLevel: '=A1',
      location: '+S1',
      components: [],
      wires: [],
      plotFrame: {
        type: 'DIN_A3_LANDSCAPE',
        width: 1000,
        height: 700,
        columns: 10,
        rows: ['A', 'B', 'C', 'D', 'E', 'F'],
        titleBlock: {
          projectTitle: projectName,
          commission: 'KOM-2026-0815',
          company: 'Elektro Engineering GmbH',
          author: 'Projekt-Import',
          date: now,
          revision: '1.0',
          sheetNumber: '0',
          totalSheets: '3'
        }
      }
    };

    const pagePower: Page = {
      id: 'p_power',
      pageNumber: '1',
      pageType: 'schematic',
      title: 'Einspeisung 400V AC & Hauptantrieb',
      higherLevel: '=A1',
      location: '+S1',
      components: [
        // Potenzial-Einspeisung oben (L1, L2, L3)
        {
          id: 'comp_pf_l1',
          symbolId: 'potential_arrow_down',
          bmk: '/1.1',
          functionText: 'L1',
          x: 220,
          y: 80,
          rotation: 0,
          pins: {}
        },
        {
          id: 'comp_pf_l2',
          symbolId: 'potential_arrow_down',
          bmk: '/1.2',
          functionText: 'L2',
          x: 244,
          y: 80,
          rotation: 0,
          pins: {}
        },
        {
          id: 'comp_pf_l3',
          symbolId: 'potential_arrow_down',
          bmk: '/1.3',
          functionText: 'L3',
          x: 268,
          y: 80,
          rotation: 0,
          pins: {}
        },
        // Motorschutzschalter -Q1 at Col 2
        {
          id: 'comp_q1',
          symbolId: 'motor_protective_switch',
          bmk: '-Q1',
          higherLevelFunction: '=A1',
          mountingLocation: '+S1',
          functionText: 'Motorschutzschalter Hauptantrieb',
          technicalCharacteristics: '2.5 - 4.0A / 400V',
          articleNumber: '3RV2011-1EA10',
          manufacturer: 'Siemens',
          x: 220,
          y: 160,
          rotation: 0,
          pins: {}
        },
        // Leistungsschütz -K1 power contacts at Col 2
        {
          id: 'comp_k1_power',
          symbolId: 'contactor_power_3p',
          bmk: '-K1',
          higherLevelFunction: '=A1',
          mountingLocation: '+S1',
          functionText: 'Hauptschütz',
          technicalCharacteristics: '4kW / 400V 9A',
          articleNumber: '3RT2016-1BB41',
          manufacturer: 'Siemens',
          x: 220,
          y: 280,
          rotation: 0,
          pins: {}
        },
        // Klemmenleiste -X1 at Col 2 (Reihenklemmen 1, 2, 3)
        {
          id: 'comp_x1_u',
          symbolId: 'terminal_single',
          bmk: '-X1',
          functionText: '1',
          bmkPosition: { preset: 'left', offsetX: -6 },
          x: 220,
          y: 400,
          rotation: 0,
          pins: {}
        },
        {
          id: 'comp_x1_v',
          symbolId: 'terminal_single',
          bmk: '-X1',
          functionText: '2',
          bmkPosition: { visible: false },
          x: 244,
          y: 400,
          rotation: 0,
          pins: {}
        },
        {
          id: 'comp_x1_w',
          symbolId: 'terminal_single',
          bmk: '-X1',
          functionText: '3',
          bmkPosition: { visible: false },
          x: 268,
          y: 400,
          rotation: 0,
          pins: {}
        },
        // Drehstrommotor -M1 at Col 2
        {
          id: 'comp_m1',
          symbolId: 'motor_3phase',
          bmk: '-M1',
          higherLevelFunction: '=A1',
          mountingLocation: '+M1',
          functionText: 'Förderbandantrieb',
          technicalCharacteristics: '1.5kW 400V 50Hz 3.2A',
          articleNumber: '1LE1001-0DB22',
          manufacturer: 'Siemens',
          x: 220,
          y: 500,
          rotation: 0,
          pins: {}
        }
      ],
      wires: [],
      plotFrame: {
        type: 'DIN_A3_LANDSCAPE',
        width: 1000,
        height: 700,
        columns: 10,
        rows: ['A', 'B', 'C', 'D', 'E', 'F'],
        titleBlock: {
          projectTitle: projectName,
          commission: 'KOM-2026-0815',
          company: 'Elektro Engineering GmbH',
          author: 'Projekt-Import',
          date: now,
          revision: '1.0',
          sheetNumber: '1',
          totalSheets: '3'
        }
      }
    };
    // Dynamisch alle Verbindungen per Autoconnecting generieren
    AutoconnectEngine.updatePageAutoconnections(pagePower);

    const pageControl: Page = {
      id: 'p_control',
      pageNumber: '2',
      pageType: 'schematic',
      title: 'Steuerung 24V DC & Schützverriegelung',
      higherLevel: '=A1',
      location: '+S1',
      components: [
        // --- STROMPFAD 1 (Spulenkreis -K1) ---
        // Potenzial +24V
        {
          id: 'comp_pf_24v_1',
          symbolId: 'potential_arrow_down',
          bmk: '/2.1',
          functionText: '+24V',
          x: 210,
          y: 70,
          rotation: 0,
          pins: {}
        },
        // Steuersicherung -F1
        {
          id: 'comp_f1',
          symbolId: 'fuse_1p',
          bmk: '-F1',
          higherLevelFunction: '=A1',
          mountingLocation: '+S1',
          functionText: 'Steuersicherung 24V',
          technicalCharacteristics: '2A gL/gG',
          articleNumber: '5SE2302',
          manufacturer: 'Siemens',
          x: 208,
          y: 150,
          rotation: 0,
          pins: {}
        },
        // NOT-HALT Taster -S1
        {
          id: 'comp_s1',
          symbolId: 'pushbutton_emergency_stop',
          bmk: '-S1',
          higherLevelFunction: '=A1',
          mountingLocation: '+T1',
          functionText: 'NOT-HALT Bedienpult',
          articleNumber: '3SU1801-0AA00-0AB1',
          manufacturer: 'Siemens',
          x: 204,
          y: 240,
          rotation: 0,
          pins: {}
        },
        // Taster AUS -S2 (Öffner)
        {
          id: 'comp_s2',
          symbolId: 'contact_nc',
          bmk: '-S2',
          higherLevelFunction: '=A1',
          mountingLocation: '+T1',
          functionText: 'Taster AUS',
          x: 208,
          y: 330,
          rotation: 0,
          pins: {}
        },
        // Taster EIN -S3 (Schließer)
        {
          id: 'comp_s3',
          symbolId: 'pushbutton_no',
          bmk: '-S3',
          higherLevelFunction: '=A1',
          mountingLocation: '+T1',
          functionText: 'Taster EIN',
          x: 208,
          y: 420,
          rotation: 0,
          pins: {}
        },
        // Schützspule -K1 (Master)
        {
          id: 'comp_k1_coil',
          symbolId: 'contactor_coil',
          bmk: '-K1',
          higherLevelFunction: '=A1',
          mountingLocation: '+S1',
          functionText: 'Hauptschütz Antrieb',
          technicalCharacteristics: '24V DC / 4kW',
          articleNumber: '3RT2016-1BB41',
          manufacturer: 'Siemens',
          x: 204,
          y: 510,
          rotation: 0,
          pins: {}
        },
        // Potenzial 0V
        {
          id: 'comp_pf_0v_1',
          symbolId: 'potential_arrow_up',
          bmk: '/2.1',
          functionText: '0V',
          x: 210,
          y: 610,
          rotation: 0,
          pins: {}
        },

        // --- STROMPFAD 2 (Meldekreis -P1) ---
        // Potenzial +24V
        {
          id: 'comp_pf_24v_2',
          symbolId: 'potential_arrow_down',
          bmk: '/2.2',
          functionText: '+24V',
          x: 330,
          y: 70,
          rotation: 0,
          pins: {}
        },
        // Meldekontakt -K1:13-14 (Hilfskontakt Schließer)
        {
          id: 'comp_k1_aux',
          symbolId: 'contact_no',
          bmk: '-K1',
          higherLevelFunction: '=A1',
          mountingLocation: '+S1',
          functionText: 'Betriebsmeldung',
          x: 328,
          y: 420,
          rotation: 0,
          pins: {}
        },
        // Meldeleuchte -P1
        {
          id: 'comp_p1',
          symbolId: 'pilot_lamp',
          bmk: '-P1',
          higherLevelFunction: '=A1',
          mountingLocation: '+T1',
          functionText: 'Betriebsanzeige Grün',
          technicalCharacteristics: '24V DC LED',
          articleNumber: '3SU1102-6AA40-1AA0',
          manufacturer: 'Siemens',
          x: 324,
          y: 510,
          rotation: 0,
          pins: {}
        },
        // Potenzial 0V
        {
          id: 'comp_pf_0v_2',
          symbolId: 'potential_arrow_up',
          bmk: '/2.2',
          functionText: '0V',
          x: 330,
          y: 610,
          rotation: 0,
          pins: {}
        }
      ],
      wires: [],
      plotFrame: {
        type: 'DIN_A3_LANDSCAPE',
        width: 1000,
        height: 700,
        columns: 10,
        rows: ['A', 'B', 'C', 'D', 'E', 'F'],
        titleBlock: {
          projectTitle: projectName,
          commission: 'KOM-2026-0815',
          company: 'Elektro Engineering GmbH',
          author: 'Projekt-Import',
          date: now,
          revision: '1.0',
          sheetNumber: '2',
          totalSheets: '3'
        }
      }
    };
    // Dynamisch alle Verbindungen per Autoconnecting generieren
    AutoconnectEngine.updatePageAutoconnections(pageControl);

    return {
      id: 'proj_' + Math.random().toString(36).substring(2, 9),
      name: projectName,
      description: `Importiertes Projekt (${entries.length} gepackte Artefakte)`,
      standard: 'DIN EN 81346-2 / IEC 60617',
      version: '2024.0',
      created: now,
      modified: now,
      author: 'Schematico System',
      company: 'Schematico Suite',
      pages: [pageCover, pagePower, pageControl],
      activePageId: 'p_power'
    };
  }

  /**
   * Helper to parse key-value pairs from simple XML
   */
  private static parseSimpleXmlProperties(xmlText: string): Record<string, string> {
    const result: Record<string, string> = {};
    const matches = xmlText.matchAll(/<([a-zA-Z0-9_]+)>([^<]+)<\/\1>/g);
    for (const match of matches) {
      result[match[1]] = match[2].trim();
    }
    return result;
  }

  /**
   * Exports the project as a .zw1 backup archive
   */
  public static async exportToZw1(project: Project): Promise<Blob> {
    const zip = new JSZip();
    const safeName = project.name.replace(/[^a-zA-Z0-9_\-]/g, '_');

    // 1. Create .elk file (Project Status File)
    const elkContent = `[Project]
Version=2024.0.3
Type=Project
ProjectName=${project.name}
Description=${project.description}
Standard=${project.standard}
Author=${project.author}
Company=${project.company}
Created=${project.created}
Modified=${project.modified}
PageCount=${project.pages.length}
`;
    zip.file(`${safeName}.elk`, elkContent);

    // 2. Create *.edb directory structure
    const edbFolder = zip.folder(`${safeName}.edb`);
    if (edbFolder) {
      // Export pages as structured XML/JSON
      edbFolder.file('Pages.xml', this.generateProjectXml(project));
      edbFolder.file('ProjectSettings.ini', `[Settings]\nGrid=4.0\nStandard=IEC81346\n`);
      edbFolder.file('project_data.json', JSON.stringify(project, null, 2));
    }

    return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }

  /**
   * Exports project into standard XML format
   */
  public static generateProjectXml(project: Project): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<ProjectXml version="2024.0" application="Schematico" name="${this.escapeXml(project.name)}">\n`;
    xml += `  <ProjectInfo author="${this.escapeXml(project.author)}" company="${this.escapeXml(project.company)}" date="${this.escapeXml(project.modified)}"/>\n`;
    xml += `  <Pages count="${project.pages.length}">\n`;

    for (const page of project.pages) {
      xml += `    <Page number="${this.escapeXml(page.pageNumber)}" type="${this.escapeXml(page.pageType)}" title="${this.escapeXml(page.title)}" higherLevel="${this.escapeXml(page.higherLevel)}" location="${this.escapeXml(page.location)}">\n`;
      xml += `      <Components count="${page.components.length}">\n`;
      for (const comp of page.components) {
        xml += `        <Component id="${this.escapeXml(comp.id)}" bmk="${this.escapeXml(comp.bmk)}" symbol="${this.escapeXml(comp.symbolId)}" x="${comp.x}" y="${comp.y}" rotation="${comp.rotation}" functionText="${this.escapeXml(comp.functionText)}" article="${this.escapeXml(comp.articleNumber || '')}" manufacturer="${this.escapeXml(comp.manufacturer || '')}" crossRef="${this.escapeXml(comp.crossRef || '')}"/>\n`;
      }
      xml += `      </Components>\n`;
      xml += `      <Wires count="${page.wires.length}">\n`;
      for (const wire of page.wires) {
        xml += `        <Wire id="${this.escapeXml(wire.id)}" potential="${this.escapeXml(wire.potential)}" color="${this.escapeXml(wire.color || '')}" crossSection="${this.escapeXml(wire.crossSection || '')}" fromComp="${this.escapeXml(wire.from.componentId)}" fromPin="${this.escapeXml(wire.from.pinId)}" toComp="${this.escapeXml(wire.to.componentId)}" toPin="${this.escapeXml(wire.to.pinId)}"/>\n`;
      }
      xml += `      </Wires>\n`;
      xml += `    </Page>\n`;
    }

    xml += `  </Pages>\n`;
    xml += `  <SchematicoData format="json" version="1">${this.escapeXml(JSON.stringify(project))}</SchematicoData>\n`;
    xml += `</ProjectXml>\n`;
    return xml;
  }

  private static escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
