import { migrateLegacyData, normalizeLegacyProjectXml } from '../model/LegacyCompatibility';
// src/packages/PackageHandler.ts
// Parser and generator for CAD project archive files:
// - .zw1: Project Backup Archive (ZIP or 7z containing native project data)
// - .edz: Component / Macro Archive (ZIP with XML, macros, and images)
// - .xml: XML Project & Schema Exchange Format

import JSZip from 'jszip';
import { Project, Page, PlacedComponent, Wire, PageBox, CableDefinition } from '../model/types';
import { SYMBOL_DEFINITIONS } from '../model/symbols';
import { AutoconnectEngine } from '../model/AutoconnectEngine';
import { CrossReferenceEngine } from '../model/CrossReferenceEngine';
import { EdbProjectParser } from './EdbProjectParser';
import { readProjectArchive } from './ProjectArchive';

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
    const { zip, sizes, compression } = await readProjectArchive(file);
    const entries: PackageEntry[] = [];
    let elkContent = '';
    let projectName = file.name.replace(/\.(zw1|zip)$/i, '');
    const messages: string[] = compression === '7z' ? ['7z-Projektsicherung direkt entpackt.'] : [];

    // Analyze archive entries
    zip.forEach((relativePath, zipEntry) => {
      let type: PackageEntry['type'] = 'other';
      if (relativePath.toLowerCase().endsWith('.elk')) {
        type = 'elk';
      } else if (relativePath.toLowerCase().includes('.edb/') || relativePath.toLowerCase().endsWith('.eod')) {
        type = 'edb';
      } else if (relativePath.toLowerCase().endsWith('.ema') || relativePath.toLowerCase().endsWith('.ems')) {
        type = 'macro';
      } else if (relativePath.toLowerCase().endsWith('.xml')) {
        type = 'xml';
      }

      entries.push({
        path: relativePath,
        size: sizes.get(relativePath) ?? 0,
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

    throw new Error('Das Archiv enthält keine unterstützten Projektdaten (Page.eod oder project_data.json).');
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
    const nowFormatted = now.split('-').reverse().join('.');
    const effectiveProjectName = projectName && projectName !== 'Anlagensteuerung' ? projectName : 'Förderanlagen-Steuerung FA-400';

    // Umfassendes, professionelles Industrie-Beispielprojekt (4 Seiten):
    // Seite 0: Voll ausgefüllte Titelseite (F26-Normblatt)
    // Seite 1: 400V AC Netzeinspeisung, Hauptantrieb & 24V DC Stromversorgungs-Baugruppe mit Gerätekästen
    // Seite 2: 24V DC Steuerung, Not-Halt-Sicherheitskreis, Schützverriegelung & Meldeanzeigen
    // Seite 3: SPS-Kompaktsteuerung (SIMATIC S7-1200) im Gerätekasten, Sensorik & Aktorik

    // --- SEITE 0: DECKBLATT / TITELSEITE ---
    const pageCover: Page = {
      id: 'p_cover',
      pageNumber: '0',
      pageType: 'cover',
      title: 'Deckblatt & Projektübersicht',
      higherLevel: '=A1',
      location: '+S1',
      components: [],
      wires: [],
      coverPage: {
        values: {
          '10000:0': effectiveProjectName,
          '10011:0': 'Hauptantrieb & Förderbandsteuerung mit 24V Sicherheitskreis & SPS',
          '10013:0': 'PRJ-2026-4412',
          '10014:0': 'KOM-77402',
          '10015:0': 'Schematico Automation Engineering GmbH',
          '10235:0': 'Industriestraße 12-14',
          '10237:0': '30159',
          '10238:0': 'Hannover',
          '10240:0': '+49 (0) 511 8923-0',
          '10030:0': 'Schematico Systems',
          '10031:0': 'Schaltschrank SS-01',
          '10032:0': 'Halle 3 / Förderlinie B',
          '10025:0': 'Dipl.-Ing. M. Mustermann',
          '10033:0': 'Schutzart IP54 / TN-S Netz 400V 50Hz / 24V DC SELV',
          '10021:0': nowFormatted,
          '10023:0': nowFormatted,
          '10022:0': 'MM',
          '10100:0': 'Industrieautomation Nord GmbH',
          '10901:1': '/Projekte/2026/FA-400/FA400_Rev1.zw1'
        }
      },
      plotFrame: {
        type: 'DIN_A3_LANDSCAPE',
        width: 1000,
        height: 700,
        columns: 10,
        rows: ['A', 'B', 'C', 'D', 'E', 'F'],
        titleBlock: {
          projectTitle: effectiveProjectName,
          commission: 'KOM-77402',
          company: 'Schematico Automation Engineering GmbH',
          author: 'M. Mustermann',
          date: now,
          revision: '1.0',
          sheetNumber: '0',
          totalSheets: '4'
        }
      }
    };

    // --- SEITE 1: 400V AC NETZEINSPEISUNG & HAUPTANTRIEB ---
    const pagePower: Page = {
      id: 'p_power',
      pageNumber: '1',
      pageType: 'schematic',
      title: 'Einspeisung 400V AC & Hauptantrieb',
      higherLevel: '=A1',
      location: '+S1',
      boxes: [
        {
          id: 'box_psu',
          kind: 'device',
          bmk: '-G1',
          label: 'Stromversorgungs-Baugruppe 24V DC',
          description: 'SITOP smart PSU100S 24V / 5A\nEingang: 230V AC | Ausgang: 24V DC / 5A SELV\nAbsicherung: Primär 2A / Sekundär 4A elektronisch',
          lineStyle: 'dashed',
          lineWidth: 1.2,
          color: '#3182ce',
          fontSize: 9.5,
          x: 460,
          y: 110,
          width: 330,
          height: 385
        },
        {
          id: 'box_motor',
          kind: 'device',
          bmk: '+M1',
          label: 'Antriebseinheit Förderband 1',
          description: 'Vor-Ort Montage (Außenbereich Halle 3)\nSchutzart IP65 / IE3 Drehstrom-Asynchronmotor',
          lineStyle: 'dashed',
          lineWidth: 1.2,
          color: '#48bb78',
          fontSize: 9,
          x: 190,
          y: 510,
          width: 150,
          height: 120
        }
      ],
      components: [
        // --- 400V Einspeisung Spalte 2 ---
        { id: 'comp_pf_l1', symbolId: 'potential_arrow_down', bmk: 'L1', functionText: 'L1', x: 220, y: 70, rotation: 0, pins: {} },
        { id: 'comp_pf_l2', symbolId: 'potential_arrow_down', bmk: 'L2', functionText: 'L2', x: 244, y: 70, rotation: 0, pins: {} },
        { id: 'comp_pf_l3', symbolId: 'potential_arrow_down', bmk: 'L3', functionText: 'L3', x: 268, y: 70, rotation: 0, pins: {} },
        { id: 'comp_pf_pe', symbolId: 'potential_arrow_down', bmk: 'PE', functionText: 'PE', x: 292, y: 70, rotation: 0, pins: {} },

        // Hauptschalter -Q0
        {
          id: 'comp_q0', symbolId: 'circuit_breaker_3p', bmk: '-Q0', higherLevelFunction: '=A1', mountingLocation: '+S1',
          functionText: 'Hauptschalter Netzeinspeisung', technicalCharacteristics: '400V 25A 3P', articleNumber: '3VA1125-3ED36', manufacturer: 'Siemens',
          x: 220, y: 130, rotation: 0, pins: {}
        },

        // Motorschutzschalter -Q1
        {
          id: 'comp_q1', symbolId: 'motor_protective_switch', bmk: '-Q1', higherLevelFunction: '=A1', mountingLocation: '+S1',
          functionText: 'Motorschutzschalter Hauptantrieb', technicalCharacteristics: '2.5 - 4.0A / 400V', articleNumber: '3RV2011-1EA10', manufacturer: 'Siemens',
          x: 220, y: 230, rotation: 0, pins: {}
        },

        // Leistungsschütz -K1
        {
          id: 'comp_k1_power', symbolId: 'contactor_power_3p', bmk: '-K1', higherLevelFunction: '=A1', mountingLocation: '+S1',
          functionText: 'Hauptschütz Antrieb M1', technicalCharacteristics: '4kW / 400V 9A', articleNumber: '3RT2016-1BB41', manufacturer: 'Siemens',
          x: 220, y: 330, rotation: 0, pins: {}
        },

        // Klemmenleiste -X1
        { id: 'comp_x1_1', symbolId: 'terminal_single', bmk: '-X1', functionText: '1', bmkPosition: { preset: 'left', offsetX: -6 }, x: 220, y: 430, rotation: 0, pins: {} },
        { id: 'comp_x1_2', symbolId: 'terminal_single', bmk: '-X1', functionText: '2', bmkPosition: { visible: false }, x: 244, y: 430, rotation: 0, pins: {} },
        { id: 'comp_x1_3', symbolId: 'terminal_single', bmk: '-X1', functionText: '3', bmkPosition: { visible: false }, x: 268, y: 430, rotation: 0, pins: {} },
        { id: 'comp_x1_pe', symbolId: 'terminal_pe', bmk: '-X1', functionText: 'PE', bmkPosition: { visible: false }, x: 292, y: 430, rotation: 0, pins: {} },

        // Drehstrommotor -M1
        {
          id: 'comp_m1', symbolId: 'motor_3phase', bmk: '-M1', higherLevelFunction: '=A1', mountingLocation: '+M1',
          functionText: 'Antriebsmotor Förderband 1', technicalCharacteristics: '1.5kW 400V 50Hz 3.2A', articleNumber: '1LE1001-0DB22', manufacturer: 'Siemens',
          x: 220, y: 530, rotation: 0, pins: {}
        },

        // --- 24V DC Stromversorgungs-Zweig (Spalte 5/6) ---
        // Potentialeinspeisung L1, N, PE für Netzteil
        { id: 'comp_p1_in_l1', symbolId: 'potential_arrow_down', bmk: 'L1', functionText: 'L1', x: 488, y: 70, rotation: 0, pins: {} },
        { id: 'comp_p1_in_n', symbolId: 'potential_arrow_down', bmk: 'N', functionText: 'N', x: 502, y: 70, rotation: 0, pins: {} },
        { id: 'comp_p1_in_pe', symbolId: 'potential_arrow_down', bmk: 'PE', functionText: 'PE', x: 516, y: 70, rotation: 0, pins: {} },

        // Primärsicherung -F0
        {
          id: 'comp_f0', symbolId: 'fuse_1p', bmk: '-F0', higherLevelFunction: '=A1', mountingLocation: '+S1',
          functionText: 'Primärabsicherung 230V', technicalCharacteristics: '2A gL/gG', articleNumber: '5SE2302', manufacturer: 'Siemens',
          x: 488, y: 140, rotation: 0, pins: {}
        },

        // Schaltnetzteil 24V DC -G1
        {
          id: 'comp_g1', symbolId: 'power_supply_dc', bmk: '-G1', higherLevelFunction: '=A1', mountingLocation: '+S1',
          functionText: 'Schaltnetzteil 24V DC / 5A', technicalCharacteristics: 'Primär 230V AC | Sekundär 24V DC 120W', articleNumber: '6EP1333-1LB00', manufacturer: 'Siemens',
          x: 486, y: 230, rotation: 0, pins: {}
        },

        // Sekundärabsicherung -F2
        {
          id: 'comp_f2', symbolId: 'fuse_1p', bmk: '-F2', higherLevelFunction: '=A1', mountingLocation: '+S1',
          functionText: 'Elektronische Sicherung 24V', technicalCharacteristics: '4A SELV', articleNumber: 'EPD24-4A', manufacturer: 'Siemens',
          x: 492, y: 330, rotation: 0, pins: {}
        },

        // Verbindungselemente: Ecken und Kreuzungs-Brücke zu den Abbruchstellen
        { id: 'comp_p1_c_24v', symbolId: 'corner_bottom_left', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 494, y: 410, rotation: 0, pins: {} },
        { id: 'comp_p1_bridge', symbolId: 'cross_bridge', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 570, y: 410, rotation: 0, pins: {} },
        { id: 'comp_p1_out_24v', symbolId: 'potential_arrow_right', bmk: '+24V', functionText: '+24V', x: 750, y: 410, rotation: 0, pins: {} },

        { id: 'comp_p1_c_0v', symbolId: 'corner_bottom_left', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 514, y: 460, rotation: 0, pins: {} },
        { id: 'comp_p1_out_0v', symbolId: 'potential_arrow_right', bmk: '0V', functionText: '0V', x: 750, y: 460, rotation: 0, pins: {} }
      ],
      cables: [
        {
          id: 'cable_w1',
          start: { x: 216, y: 490 },
          end: { x: 310, y: 490 },
          bmk: '-W1',
          cableType: 'ÖLFLEX CLASSIC 110',
          crossSection: '4G1.5',
          description: 'Motoranschlussleitung flexibel',
          cores: [
            { id: 'w1_c1', t: 0.15, designation: '1', color: 'BK' },
            { id: 'w1_c2', t: 0.38, designation: '2', color: 'BK' },
            { id: 'w1_c3', t: 0.61, designation: '3', color: 'BK' },
            { id: 'w1_c4', t: 0.85, designation: 'GNYE', color: 'GNYE' }
          ]
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
          projectTitle: effectiveProjectName,
          commission: 'KOM-77402',
          company: 'Schematico Automation Engineering GmbH',
          author: 'M. Mustermann',
          date: now,
          revision: '1.0',
          sheetNumber: '1',
          totalSheets: '4'
        }
      }
    };
    AutoconnectEngine.updatePageAutoconnections(pagePower);

    // --- SEITE 2: 24V DC STEUERUNG & SCHÜTZVERRIEGELUNG ---
    const pageControl: Page = {
      id: 'p_control',
      pageNumber: '2',
      pageType: 'schematic',
      title: 'Steuerung 24V DC & Schützverriegelung',
      higherLevel: '=A1',
      location: '+S1',
      boxes: [
        {
          id: 'box_desk',
          kind: 'device',
          bmk: '+T1',
          label: 'Bedienpult Hauptantrieb',
          description: 'Vor-Ort Bedienstation Förderband 1\nNOT-HALT Pilztaster, Taster Ein/Aus & Meldeleuchten Betrieb/Störung',
          lineStyle: 'dashed',
          lineWidth: 1.2,
          color: '#ed8936',
          fontSize: 9.5,
          x: 180,
          y: 175,
          width: 440,
          height: 400
        }
      ],
      components: [
        // --- Abbruchstellen von Blatt 1 links (+24V, 0V) ---
        { id: 'comp_p2_in_24v', symbolId: 'potential_arrow_left', bmk: '+24V', functionText: '+24V', x: 80, y: 70, rotation: 0, pins: {} },
        { id: 'comp_p2_in_0v', symbolId: 'potential_arrow_left', bmk: '0V', functionText: '0V', x: 80, y: 610, rotation: 0, pins: {} },

        // --- Abbruchstellen zu Blatt 3 rechts (+24V_SPS, 0V_SPS) ---
        { id: 'comp_p2_out_24v', symbolId: 'potential_arrow_right', bmk: '+24V_SPS', functionText: '+24V_SPS', x: 750, y: 70, rotation: 0, pins: {} },
        { id: 'comp_p2_out_0v', symbolId: 'potential_arrow_right', bmk: '0V_SPS', functionText: '0V_SPS', x: 750, y: 610, rotation: 0, pins: {} },

        // --- Potenzial-Verteilschienen (+24V oben, 0V unten) ---
        // +24V T-Stücke oben
        { id: 'comp_t_top_1', symbolId: 't_piece_down', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 210, y: 70, rotation: 0, pins: {} },
        { id: 'comp_t_top_2', symbolId: 't_piece_down', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 450, y: 70, rotation: 0, pins: {} },
        { id: 'comp_t_top_3', symbolId: 't_piece_down', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 580, y: 70, rotation: 0, pins: {} },

        // 0V T-Stücke unten
        { id: 'comp_t_bot_1', symbolId: 't_piece_up', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 210, y: 610, rotation: 0, pins: {} },
        { id: 'comp_t_bot_2', symbolId: 't_piece_up', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 450, y: 610, rotation: 0, pins: {} },
        { id: 'comp_t_bot_3', symbolId: 't_piece_up', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 580, y: 610, rotation: 0, pins: {} },

        // --- STROMPFAD 1 (Spulenkreis -K1, x=220) ---
        // Steuersicherung -F1
        {
          id: 'comp_f1', symbolId: 'fuse_1p', bmk: '-F1', higherLevelFunction: '=A1', mountingLocation: '+S1',
          functionText: 'Steuersicherung Steuerkreis', technicalCharacteristics: '2A gL/gG', articleNumber: '5SE2302', manufacturer: 'Siemens',
          x: 208, y: 120, rotation: 0, pins: {}
        },
        // NOT-HALT Taster -S1
        {
          id: 'comp_s1', symbolId: 'pushbutton_emergency_stop', bmk: '-S1', higherLevelFunction: '=A1', mountingLocation: '+T1',
          functionText: 'NOT-HALT Bedienpult', articleNumber: '3SU1801-0AA00-0AB1', manufacturer: 'Siemens',
          x: 204, y: 200, rotation: 0, pins: {}
        },
        // Taster AUS -S2 (Öffner)
        {
          id: 'comp_s2', symbolId: 'contact_nc', bmk: '-S2', higherLevelFunction: '=A1', mountingLocation: '+T1',
          functionText: 'Taster AUS', articleNumber: '3SU1000-0CB20-0AA0', manufacturer: 'Siemens',
          x: 208, y: 270, rotation: 0, pins: {}
        },

        // Abzweig für Selbsthaltung -K1:13-14 parallel zu Taster EIN -S3
        { id: 'comp_t_branch_top', symbolId: 't_piece_right', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 210, y: 335, rotation: 0, pins: {} },
        { id: 'comp_c_branch_top', symbolId: 'corner_top_right', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 320, y: 335, rotation: 0, pins: {} },

        // Taster EIN -S3 (Schließer)
        {
          id: 'comp_s3', symbolId: 'pushbutton_no', bmk: '-S3', higherLevelFunction: '=A1', mountingLocation: '+T1',
          functionText: 'Taster EIN', articleNumber: '3SU1000-0AB20-0AA0', manufacturer: 'Siemens',
          x: 208, y: 370, rotation: 0, pins: {}
        },
        // Hilfskontakt -K1:13-14 (Schließer für Selbsthaltung)
        {
          id: 'comp_k1_hold', symbolId: 'contact_no', bmk: '-K1', higherLevelFunction: '=A1', mountingLocation: '+S1',
          functionText: 'Selbsthaltung Hauptschütz', technicalCharacteristics: '1NO 10A / 24V DC',
          x: 318, y: 370, rotation: 0, pins: {}
        },

        // Zusammenführung Selbsthaltung
        { id: 'comp_c_branch_bot', symbolId: 'corner_bottom_right', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 320, y: 435, rotation: 0, pins: {} },
        { id: 'comp_t_branch_bot', symbolId: 't_piece_right', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 210, y: 435, rotation: 0, pins: {} },

        // Schützspule -K1 (Master)
        {
          id: 'comp_k1_coil', symbolId: 'contactor_coil', bmk: '-K1', higherLevelFunction: '=A1', mountingLocation: '+S1',
          functionText: 'Hauptschütz Antrieb', technicalCharacteristics: '24V DC / 4kW', articleNumber: '3RT2016-1BB41', manufacturer: 'Siemens',
          x: 204, y: 480, rotation: 0, pins: {}
        },

        // --- STROMPFAD 3 (Meldekreis Betrieb -P1, x=460) ---
        // Meldekontakt -K1:23-24 (Hilfskontakt Schließer)
        {
          id: 'comp_k1_aux', symbolId: 'contact_no', bmk: '-K1', higherLevelFunction: '=A1', mountingLocation: '+S1',
          functionText: 'Betriebsmeldung Antrieb', technicalCharacteristics: '1NO',
          pins: { '13': { customLabel: '23' }, '14': { customLabel: '24' } },
          x: 448, y: 370, rotation: 0
        },
        // Meldeleuchte -P1
        {
          id: 'comp_p1', symbolId: 'pilot_lamp', bmk: '-P1', higherLevelFunction: '=A1', mountingLocation: '+T1',
          functionText: 'Betriebsanzeige Grün', technicalCharacteristics: '24V DC LED grün', articleNumber: '3SU1102-6AA40-1AA0', manufacturer: 'Siemens',
          x: 444, y: 480, rotation: 0, pins: {}
        },

        // --- STROMPFAD 4 (Störmeldekreis -P2, x=590) ---
        // Hilfskontakt Motorschutzschalter -Q1:97-98 (Schließer)
        {
          id: 'comp_q1_aux', symbolId: 'contact_no', bmk: '-Q1', higherLevelFunction: '=A1', mountingLocation: '+S1',
          functionText: 'Störmeldekontakt Motorschutz', technicalCharacteristics: '1NO 97-98',
          pins: { '13': { customLabel: '97' }, '14': { customLabel: '98' } },
          x: 578, y: 370, rotation: 0
        },
        // Störmeldeleuchte -P2
        {
          id: 'comp_p2', symbolId: 'pilot_lamp', bmk: '-P2', higherLevelFunction: '=A1', mountingLocation: '+T1',
          functionText: 'Störanzeige Rot', technicalCharacteristics: '24V DC LED rot', articleNumber: '3SU1102-6AA20-1AA0', manufacturer: 'Siemens',
          x: 574, y: 480, rotation: 0, pins: {}
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
          projectTitle: effectiveProjectName,
          commission: 'KOM-77402',
          company: 'Schematico Automation Engineering GmbH',
          author: 'M. Mustermann',
          date: now,
          revision: '1.0',
          sheetNumber: '2',
          totalSheets: '4'
        }
      }
    };
    AutoconnectEngine.updatePageAutoconnections(pageControl);

    // --- SEITE 3: SPS-KOMPAKTSTEUERUNG & SENSORIK ---
    const pagePlc: Page = {
      id: 'p_plc',
      pageNumber: '3',
      pageType: 'schematic',
      title: 'SPS-Kompaktsteuerung & Sensorik',
      higherLevel: '=A1',
      location: '+S1',
      boxes: [
        {
          id: 'box_plc',
          kind: 'device',
          bmk: '-KF1',
          label: 'SPS-Kompaktsteuerung',
          description: 'Siemens SIMATIC S7-1200 CPU 1214C DC/DC/DC\n14 DI 24V DC / 10 DO 24V DC / 2 AI 0-10V / PROFINET onboard\nArtikel-Nr.: 6ES7214-1AG40-0XB0',
          lineStyle: 'dashed',
          lineWidth: 1.5,
          color: '#3182ce',
          fontSize: 9.5,
          x: 180,
          y: 110,
          width: 530,
          height: 380
        },
        {
          id: 'box_field',
          kind: 'device',
          bmk: '+F1',
          label: 'Sensorik & Aktorik Förderband 1',
          description: 'Vor-Ort Installation Schutzart IP67 (Übergabestation)\nInduktiver Näherungsschalter & optischer/akustischer Warnmelder',
          lineStyle: 'dashed',
          lineWidth: 1.2,
          color: '#805ad5',
          fontSize: 9,
          x: 180,
          y: 505,
          width: 530,
          height: 90
        }
      ],
      components: [
        // --- Abbruchstellen von Blatt 2 links (+24V_SPS, 0V_SPS) ---
        { id: 'comp_p3_in_24v', symbolId: 'potential_arrow_left', bmk: '+24V_SPS', functionText: '+24V_SPS', x: 80, y: 70, rotation: 0, pins: {} },
        { id: 'comp_p3_in_0v', symbolId: 'potential_arrow_left', bmk: '0V_SPS', functionText: '0V_SPS', x: 80, y: 610, rotation: 0, pins: {} },

        // --- Potenzial-Verteilschienen (+24V oben, 0V unten) ---
        // Kreuzung mit Verbindungspunkt oben bei x=220
        { id: 'comp_cross_top', symbolId: 'cross_junction', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 210, y: 70, rotation: 0, pins: {} },
        { id: 'comp_t_plc_top', symbolId: 't_piece_down', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 450, y: 70, rotation: 0, pins: {} },
        { id: 'comp_c_plc_top', symbolId: 'corner_top_right', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 630, y: 70, rotation: 0, pins: {} },

        // 0V Schiene unten
        { id: 'comp_t_plc_bot_1', symbolId: 't_piece_up', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 210, y: 610, rotation: 0, pins: {} },
        { id: 'comp_t_plc_bot_2', symbolId: 't_piece_up', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 450, y: 610, rotation: 0, pins: {} },
        { id: 'comp_c_plc_bot', symbolId: 'corner_bottom_right', bmk: '', functionText: '', bmkPosition: { visible: false }, x: 630, y: 610, rotation: 0, pins: {} },

        // --- SPALTE 2: Sensor-Einspeisung & SPS-Digitaleingang (x=220) ---
        // Reihenklemme -X2:1 (Sensorversorgung +24V)
        { id: 'comp_x2_1', symbolId: 'terminal_single', bmk: '-X2', functionText: '1 (+24V)', technicalCharacteristics: '24V DC', x: 208, y: 130, rotation: 0, pins: {} },
        // Induktiver Näherungsschalter -B1
        {
          id: 'comp_b1', symbolId: 'contact_no', bmk: '-B1', higherLevelFunction: '=A1', mountingLocation: '+F1',
          functionText: 'Induktiver Sensor Bandende', technicalCharacteristics: '24V DC PNP NO Sn=8mm', articleNumber: '3RG4013-0AG00', manufacturer: 'Siemens',
          x: 208, y: 220, rotation: 0, pins: {}
        },
        // Reihenklemme -X2:2 (Sensorsignal Eingang)
        { id: 'comp_x2_2', symbolId: 'terminal_single', bmk: '-X2', functionText: '2 (DI 0.0)', technicalCharacteristics: 'Signal', x: 208, y: 320, rotation: 0, pins: {} },
        // SPS Digitaleingang DI 0.0
        {
          id: 'comp_kf1_di0', symbolId: 'contact_no', bmk: '-KF1', higherLevelFunction: '=A1', mountingLocation: '+S1',
          functionText: 'SPS Eingang DI 0.0\n(Sensor Stauüberwachung)', technicalCharacteristics: '24V DC 2.5mA',
          x: 208, y: 410, rotation: 0, pins: {}
        },

        // --- SPALTE 4: SPS-Digitalausgang & Meldeaktor (x=460) ---
        // SPS Digitalausgang DO 0.0
        {
          id: 'comp_kf1_do0', symbolId: 'contact_no', bmk: '-KF1', higherLevelFunction: '=A1', mountingLocation: '+S1',
          functionText: 'SPS Ausgang DO 0.0\n(Ansteuerung Warnsignal)', technicalCharacteristics: 'Relais 24V DC / 2A',
          x: 448, y: 220, rotation: 0, pins: {}
        },
        // Reihenklemme -X2:3 (Aktorsignal)
        { id: 'comp_x2_3', symbolId: 'terminal_single', bmk: '-X2', functionText: '3 (DO 0.0)', technicalCharacteristics: 'Aktorleitung', x: 448, y: 320, rotation: 0, pins: {} },
        // Warnmelder / Signalgeber -P3
        {
          id: 'comp_p3', symbolId: 'pilot_lamp', bmk: '-P3', higherLevelFunction: '=A1', mountingLocation: '+F1',
          functionText: 'Optische / Akustische Warnung Stau', technicalCharacteristics: '24V DC LED Blitzleuchte', articleNumber: '8WD4420-5AB', manufacturer: 'Siemens',
          x: 444, y: 410, rotation: 0, pins: {}
        },

        // --- SPALTE 6: PROFINET & Schaltschranküberwachung (x=640) ---
        // PROFINET Ethernet Schnittstelle -ETH1
        {
          id: 'comp_eth1', symbolId: 'rj45_port', bmk: '-ETH1', higherLevelFunction: '=A1', mountingLocation: '+S1',
          functionText: 'PROFINET Schnittstelle CPU 1214C\nIP: 192.168.0.10 / Subnet: 255.255.255.0', articleNumber: '6GK5005-0BA00', manufacturer: 'Siemens',
          x: 624, y: 140, rotation: 0, pins: {}
        },
        // Schaltschrank-Thermostat -B2
        {
          id: 'comp_b2', symbolId: 'thermostat_box', bmk: '-B2', higherLevelFunction: '=A1', mountingLocation: '+S1',
          functionText: 'Schaltschrank-Thermostat', technicalCharacteristics: '0 - 60°C NC/NO', articleNumber: '7T.81.0.000.2303', manufacturer: 'Finder',
          x: 610, y: 250, rotation: 0, pins: {}
        },
        // PE Klemme -X2:PE
        { id: 'comp_x2_pe', symbolId: 'terminal_pe', bmk: '-X2', functionText: 'PE', x: 628, y: 410, rotation: 0, pins: {} }
      ],
      wires: [],
      plotFrame: {
        type: 'DIN_A3_LANDSCAPE',
        width: 1000,
        height: 700,
        columns: 10,
        rows: ['A', 'B', 'C', 'D', 'E', 'F'],
        titleBlock: {
          projectTitle: effectiveProjectName,
          commission: 'KOM-77402',
          company: 'Schematico Automation Engineering GmbH',
          author: 'M. Mustermann',
          date: now,
          revision: '1.0',
          sheetNumber: '3',
          totalSheets: '4'
        }
      }
    };
    AutoconnectEngine.updatePageAutoconnections(pagePlc);

    const project: Project = {
      id: 'proj_' + Math.random().toString(36).substring(2, 9),
      name: effectiveProjectName,
      description: 'Hauptantrieb & Förderbandsteuerung mit 24V Sicherheitskreis & SPS',
      standard: 'DIN EN 81346-2 / IEC 60617',
      version: '2024.0',
      created: now,
      modified: now,
      author: 'Dipl.-Ing. M. Mustermann',
      company: 'Schematico Automation Engineering GmbH',
      symbolLibrary: [...SYMBOL_DEFINITIONS],
      pages: [pageCover, pagePower, pageControl, pagePlc],
      activePageId: 'p_cover'
    };

    CrossReferenceEngine.updateProjectCrossReferences(project);
    return project;
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
