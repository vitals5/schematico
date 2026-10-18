import { isNativeExchangeXml, migrateLegacyData, readAppSetting } from './LegacyCompatibility';
import { normalizeSelection, type ElementSelection } from './ElementSelection';
import { remapElementGroups } from './ElementGroups';
import { deviceBoxDefinition } from './DeviceBoxElement';
import { boxDrawing } from './DeviceBox';
// src/model/MacroManager.ts
// CAE/CAD-kompatibler Makro-Manager & Bibliothek für Fenstermakros (.ema) und Seitenmakros (.ems)

import JSZip from 'jszip';
import { Project, Page, PlacedComponent, Wire, SymbolDefinition, PageImage, CableDefinition, PageBox, ElementGroup } from './types';
import { getSymbolForComponent, getComponentSymbolLibrary, getDrawingUnitsPerMm, mergeProjectSymbolLibrary, getSymbolDefinitions } from './symbols';
import { macroForPlacement } from './MacroPlacement';
import { computeFunctionTextPosition } from './LabelLayout';
import { drawingToSvg, escapeSvg } from './ImportedDrawing';
import { componentInsertionPoint, scalePlacedComponent } from './SymbolGeometry';
import { parseNativeXmlMacro } from './NativeXmlMacro';

export interface WindowMacro {
  id: string;
  name: string;
  type: 'ema';
  category: string;
  description: string;
  components: PlacedComponent[];
  symbolLibrary?: SymbolDefinition[];
  unitsPerMm?: number;
  wires?: Wire[];
  width: number;
  height: number;
  handlePoint?: { x: number; y: number };
  boxes?: PageBox[];
  images?: PageImage[];
  cables?: CableDefinition[];
  groups?: ElementGroup[];
  isBuiltIn?: boolean;
  externalPath?: string;
  author?: string;
  version?: string;
  created?: string;
}

export interface PageMacro {
  id: string;
  name: string;
  type: 'ems';
  category: string;
  description: string;
  page: Page;
  symbolLibrary?: SymbolDefinition[];
  unitsPerMm?: number;
  isBuiltIn?: boolean;
  externalPath?: string;
  author?: string;
  version?: string;
  created?: string;
}

export type MacroItem = WindowMacro | PageMacro;

const STORAGE_KEY = 'schematico_user_macros';

// --- OUT-OF-THE-BOX STANDARD MACROS (.EMA & .EMS) ---
export const BUILTIN_MACROS: MacroItem[] = [
  // 1. Motorabzweig 400V AC
  {
    id: 'macro_ema_motorabzweig_400v',
    name: 'Motorabzweig 400V AC (Standard)',
    type: 'ema',
    category: 'Motoren & Antriebe',
    description: 'Einspeisung L1-L3, Motorschutzschalter, Leistungsschütz, Reihenklemmen und Drehstrommotor (fluchtend im 24px-Raster)',
    width: 120,
    height: 380,
    isBuiltIn: true,
    components: [
      {
        id: 'comp_q1',
        symbolId: 'motor_overload_switch',
        bmk: '-Q1',
        functionText: 'Motorschutzschalter',
        technicalCharacteristics: '2.8 - 4.0A',
        articleNumber: '3RV2011-1EA10',
        manufacturer: 'Siemens',
        x: 0,
        y: 0,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_k1',
        symbolId: 'contactor_power_3p',
        bmk: '-K1',
        functionText: 'Hauptschütz Antrieb',
        technicalCharacteristics: '4.0kW 400V AC',
        articleNumber: '3RT2016-1BB41',
        manufacturer: 'Siemens',
        x: 0,
        y: 100,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_x1_1',
        symbolId: 'terminal_pe',
        bmk: '-X1:1',
        functionText: 'Klemme L1',
        x: 0,
        y: 190,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_x1_2',
        symbolId: 'terminal_pe',
        bmk: '-X1:2',
        functionText: 'Klemme L2',
        x: 24,
        y: 190,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_x1_3',
        symbolId: 'terminal_pe',
        bmk: '-X1:3',
        functionText: 'Klemme L3',
        x: 48,
        y: 190,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_m1',
        symbolId: 'motor_3p',
        bmk: '-M1',
        functionText: 'Hauptantrieb Förderband',
        technicalCharacteristics: '1.5kW 400V 3.2A',
        x: 0,
        y: 270,
        rotation: 0,
        pins: {}
      }
    ]
  },

  // 2. Wendeschützschaltung 400V AC
  {
    id: 'macro_ema_wendeschuetz_400v',
    name: 'Wendeschützschaltung 400V AC',
    type: 'ema',
    category: 'Motoren & Antriebe',
    description: 'Motorschutzschalter mit zwei gegenseitig verriegelten Schützen für Rechts-/Linkslauf',
    width: 220,
    height: 380,
    isBuiltIn: true,
    components: [
      {
        id: 'comp_wq1',
        symbolId: 'motor_overload_switch',
        bmk: '-Q1',
        functionText: 'Motorschutzschalter',
        technicalCharacteristics: '2.8 - 4.0A',
        articleNumber: '3RV2011-1EA10',
        manufacturer: 'Siemens',
        x: 0,
        y: 0,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_wk1',
        symbolId: 'contactor_power_3p',
        bmk: '-K1',
        functionText: 'Schütz Rechtslauf',
        technicalCharacteristics: '4.0kW 400V AC',
        articleNumber: '3RT2016-1BB41',
        manufacturer: 'Siemens',
        x: 0,
        y: 100,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_wk2',
        symbolId: 'contactor_power_3p',
        bmk: '-K2',
        functionText: 'Schütz Linkslauf (Phasen L1/L3 getauscht)',
        technicalCharacteristics: '4.0kW 400V AC',
        articleNumber: '3RT2016-1BB41',
        manufacturer: 'Siemens',
        x: 88,
        y: 100,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_wm1',
        symbolId: 'motor_3p',
        bmk: '-M1',
        functionText: 'Reversierantrieb',
        technicalCharacteristics: '1.5kW 400V 3.2A',
        x: 0,
        y: 270,
        rotation: 0,
        pins: {}
      }
    ]
  },

  // 3. 24V DC Steuerstrom-Versorgung
  {
    id: 'macro_ema_power_supply_24v',
    name: 'Steuerstromversorgung 24V DC',
    type: 'ema',
    category: 'Steuerung & Versorgung',
    description: '230V AC Absicherung, Schaltnetzteil 230V/24V 5A und sekundäre 24V DC Absicherung',
    width: 180,
    height: 280,
    isBuiltIn: true,
    components: [
      {
        id: 'comp_ps_f1',
        symbolId: 'fuse_1p',
        bmk: '-F1',
        functionText: 'Primärsicherung Netzteil',
        technicalCharacteristics: 'B6A 230V AC',
        articleNumber: 'MBN106',
        manufacturer: 'Hager',
        x: 0,
        y: 0,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_ps_t1',
        symbolId: 'transformer_supply',
        bmk: '-T1',
        functionText: 'Schaltnetzteil 24V DC / 5A',
        technicalCharacteristics: 'In: 230V AC | Out: 24V DC 120W',
        articleNumber: '6EP1333-1LB00',
        manufacturer: 'Siemens',
        x: 0,
        y: 80,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_ps_f2',
        symbolId: 'fuse_1p',
        bmk: '-F2',
        functionText: 'Sekundärabsicherung Steuerstrom',
        technicalCharacteristics: '4A elektronisch',
        articleNumber: 'EPD24-4A',
        manufacturer: 'Siemens',
        x: 0,
        y: 190,
        rotation: 0,
        pins: {}
      }
    ]
  },

  // 4. NOT-HALT Sicherheitskreis 2-kanalig
  {
    id: 'macro_ema_estop_circuit',
    name: 'NOT-HALT Sicherheitskreis (2-kanalig)',
    type: 'ema',
    category: 'Sicherheitstechnik',
    description: 'Zweikanaliger Not-Halt Pilztaster mit 2 Öffnerkontakten und Quittiertaster',
    width: 140,
    height: 260,
    isBuiltIn: true,
    components: [
      {
        id: 'comp_es_s1',
        symbolId: 'estop_pushbutton',
        bmk: '-S1',
        functionText: 'NOT-HALT Bedienpult',
        technicalCharacteristics: '2NC Zwangsöffnung',
        articleNumber: '3SU1801-0NA00-2AA2',
        manufacturer: 'Siemens',
        x: 0,
        y: 0,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_es_s2',
        symbolId: 'pushbutton_no',
        bmk: '-S2',
        functionText: 'Quittierung / Reset',
        technicalCharacteristics: '1NO 24V DC',
        articleNumber: '3SU1000-0AB20-0AA0',
        manufacturer: 'Siemens',
        x: 0,
        y: 80,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_es_k1',
        symbolId: 'contactor_coil',
        bmk: '-K1',
        functionText: 'Sicherheits-Hauptschütz',
        technicalCharacteristics: 'Spule: 24V DC',
        x: 0,
        y: 160,
        rotation: 0,
        pins: {}
      }
    ]
  },

  // 5. Lichtsteuerung mit Stromstoßschalter
  {
    id: 'macro_ema_impulse_relay_light',
    name: 'Lichtsteuerung Stromstoßschalter',
    type: 'ema',
    category: 'Gebäude & Installation',
    description: 'Stromstoßrelais (Schrittschalter) mit Tastereingang für Flur- oder Hallenbeleuchtung',
    width: 120,
    height: 240,
    isBuiltIn: true,
    components: [
      {
        id: 'comp_ir_k1',
        symbolId: 'impulse_relay_1no',
        bmk: '-K1',
        functionText: 'Stromstoßrelais Beleuchtung',
        technicalCharacteristics: '16A 250V AC | Spule: 230V AC',
        articleNumber: '20.21.8.230.4000',
        manufacturer: 'Finder',
        x: 0,
        y: 0,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_ir_s1',
        symbolId: 'pushbutton_no',
        bmk: '-S1',
        functionText: 'Taster Licht Tür 1',
        x: 0,
        y: 90,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_ir_s2',
        symbolId: 'pushbutton_no',
        bmk: '-S2',
        functionText: 'Taster Licht Tür 2',
        x: 0,
        y: 170,
        rotation: 0,
        pins: {}
      }
    ]
  },

  // 6. Seitenmakro: Vollständige Hauptstrom-Einspeisung (.ems)
  {
    id: 'macro_ems_full_feed_page',
    name: 'Hauptstrom-Einspeisung & Drehstromabzweig',
    type: 'ems',
    category: 'Komplette Seiten',
    description: 'Vollständige DIN A3 Stromlaufplan-Seite mit 3-phasiger Einspeisung, Motorschutz, Hauptschütz und Klemmenleiste',
    isBuiltIn: true,
    page: {
      id: 'template_page_feed',
      pageNumber: '1',
      pageType: 'schematic',
      title: 'Hauptstrom-Einspeisung 400V AC',
      higherLevel: '=A1',
      location: '+S1',
      components: [
        {
          id: 'p_feed_l1',
          symbolId: 'potential_arrow_down',
          bmk: '/1.1',
          functionText: 'L1',
          x: 220,
          y: 70,
          rotation: 0,
          pins: {}
        },
        {
          id: 'p_feed_l2',
          symbolId: 'potential_arrow_down',
          bmk: '/1.2',
          functionText: 'L2',
          x: 244,
          y: 70,
          rotation: 0,
          pins: {}
        },
        {
          id: 'p_feed_l3',
          symbolId: 'potential_arrow_down',
          bmk: '/1.3',
          functionText: 'L3',
          x: 268,
          y: 70,
          rotation: 0,
          pins: {}
        },
        {
          id: 'p_feed_q1',
          symbolId: 'motor_overload_switch',
          bmk: '-Q1',
          functionText: 'Hauptmotorschutz',
          technicalCharacteristics: '2.8 - 4.0A',
          x: 220,
          y: 140,
          rotation: 0,
          pins: {}
        },
        {
          id: 'p_feed_k1',
          symbolId: 'contactor_power_3p',
          bmk: '-K1',
          functionText: 'Hauptschütz',
          technicalCharacteristics: '4.0kW 400V AC',
          x: 220,
          y: 250,
          rotation: 0,
          pins: {}
        },
        {
          id: 'p_feed_x1_1',
          symbolId: 'terminal_pe',
          bmk: '-X1:1',
          functionText: 'L1',
          x: 220,
          y: 360,
          rotation: 0,
          pins: {}
        },
        {
          id: 'p_feed_x1_2',
          symbolId: 'terminal_pe',
          bmk: '-X1:2',
          functionText: 'L2',
          x: 244,
          y: 360,
          rotation: 0,
          pins: {}
        },
        {
          id: 'p_feed_x1_3',
          symbolId: 'terminal_pe',
          bmk: '-X1:3',
          functionText: 'L3',
          x: 268,
          y: 360,
          rotation: 0,
          pins: {}
        },
        {
          id: 'p_feed_m1',
          symbolId: 'motor_3p',
          bmk: '-M1',
          functionText: 'Förderbandantrieb',
          technicalCharacteristics: '1.5kW 400V',
          x: 220,
          y: 440,
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
          projectTitle: 'Hauptstrom-Einspeisung',
          commission: 'MAKRO-EMS-001',
          company: 'Elektro Engineering',
          author: 'Planer',
          date: new Date().toISOString().split('T')[0],
          revision: '1.0',
          sheetNumber: '1',
          totalSheets: '1'
        }
      }
    }
  }
];

export class MacroManager {
  public static forPlacement(macro: MacroItem): WindowMacro { return macroForPlacement(macro); }

  private static externalMacros: MacroItem[] = [];
  public static setExternalMacros(macros: MacroItem[]): void { this.externalMacros = macros; }

  /**
   * Retrieves all available macros (built-in + user imported).
   */
  public static getAllMacros(): MacroItem[] {
    const userMacros = this.getUserMacros();
    return [...BUILTIN_MACROS, ...userMacros, ...this.externalMacros];
  }

  /**
   * Retrieves user-defined / imported macros from localStorage.
   */
  public static getUserMacros(): MacroItem[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const stored = readAppSetting('user_macros');
      if (!stored) return [];
      return migrateLegacyData(JSON.parse(stored)) as MacroItem[];
    } catch (e) {
      return [];
    }
  }

  /**
   * Saves user macros to localStorage.
   */
  public static saveUserMacros(macros: MacroItem[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(macros));
    } catch (e) {
      console.error('Failed to save user macros to localStorage:', e);
    }
  }

  /**
   * Adds a new macro to the user's library.
   */
  public static addMacro(macro: MacroItem): void {
    const macros = this.getUserMacros();
    // Replace if id exists, otherwise prepend
    const idx = macros.findIndex(m => m.id === macro.id);
    if (idx >= 0) {
      macros[idx] = macro;
    } else {
      macros.unshift(macro);
    }
    this.saveUserMacros(macros);
  }

  /**
   * Deletes a user-defined macro by ID.
   */
  public static deleteMacro(macroId: string): boolean {
    const macros = this.getUserMacros();
    const filtered = macros.filter(m => m.id !== macroId);
    if (filtered.length !== macros.length) {
      this.saveUserMacros(filtered);
      return true;
    }
    return false;
  }

  /**
   * Parses an uploaded macro file (.ema, .ems, .edz, .xml, .json).
   * Robust multi-format parser supporting XML, JSON, ZIP and binary fallback.
   */
  public static async parseMacroFile(file: File, options: { allowHeuristic?: boolean } = {}): Promise<MacroItem> {
    const filename = file.name;
    const lowerName = filename.toLowerCase();
    const isPageMacro = lowerName.endsWith('.ems');

    // 1. Try parsing as ZIP archive (many .edz and modern packed .ema/.ems are ZIPs)
    let zip: JSZip | undefined;
    try { zip = await JSZip.loadAsync(file); } catch { /* Continue with text formats. */ }
    if (zip) return this.parseZipMacro(zip, filename, isPageMacro, options.allowHeuristic !== false);

    // 2. Read as text
    const text = await file.text();

    // 2a. Check if valid JSON
    try {
      const parsed = JSON.parse(text);
      if (parsed.type === 'ema' || parsed.type === 'ems' || parsed.components || parsed.page) {
        return this.normalizeParsedJsonMacro(parsed, filename, isPageMacro);
      }
    } catch {
      // Not JSON, continue to XML
    }

    // 2b. Check if XML
    if (text.includes('<') && text.includes('>')) {
      // A recognized native document must never degrade into a guessed device.
      if (isNativeExchangeXml(text)) return parseNativeXmlMacro(text, filename, getSymbolDefinitions());
      try {
        return this.parseXmlMacro(text, filename, isPageMacro, options.allowHeuristic !== false);
      } catch (xmlErr) {
        if (options.allowHeuristic === false) throw xmlErr;
        console.warn('XML macro parsing error, falling back to heuristic:', xmlErr);
      }
    }

    // 3. Fallback: Binary / heuristic string scanner for binary CAD macro streams
    if (options.allowHeuristic === false) throw new Error('Dieses Makroformat wird noch nicht unterstützt.');
    return this.parseBinaryHeuristicMacro(file, filename, isPageMacro);
  }

  /**
   * Parses macro content inside a ZIP container (.edz or zipped .ema/.ems).
   */
  private static async parseZipMacro(zip: JSZip, filename: string, isPageMacro: boolean, allowHeuristic = true): Promise<MacroItem> {
    // Look for XML or JSON entries
    let xmlContent = '';
    let jsonContent = '';

    const entries = Object.keys(zip.files);
    for (const path of entries) {
      const entry = zip.files[path];
      if (entry.dir) continue;
      const lower = path.toLowerCase();
      if (lower.endsWith('.xml') || lower.endsWith('.ema') || lower.endsWith('.ems')) {
        const content = await entry.async('text');
        if (content.includes('<') && content.includes('>')) {
          xmlContent = content;
          break;
        }
      } else if (lower.endsWith('.json')) {
        jsonContent = await entry.async('text');
        break;
      }
    }

    if (jsonContent) {
      try {
        const parsed = JSON.parse(jsonContent);
        return this.normalizeParsedJsonMacro(parsed, filename, isPageMacro);
      } catch {}
    }

    if (xmlContent) {
      if (isNativeExchangeXml(xmlContent)) return parseNativeXmlMacro(xmlContent, filename, getSymbolDefinitions());
      return this.parseXmlMacro(xmlContent, filename, isPageMacro, allowHeuristic);
    }

    if (!allowHeuristic) throw new Error('Dieses Makropaket enthält keine unterstützten Makrodaten.');
    // Fallback: create generic macro from entry names
    return this.createGenericMacro(filename, `ZIP-Makropaket mit ${entries.length} Einträgen`, isPageMacro);
  }

  /**
   * Parses XML-formatted CAD macro content.
   */
  private static parseXmlMacro(xmlContent: string, filename: string, isPageMacro: boolean, allowHeuristic = true): MacroItem {
    let macroName = filename.replace(/\.(ema|ems|xml|edz)$/i, '');
    let description = `Importiertes Makro aus ${filename}`;
    const components: PlacedComponent[] = [];
    let minX = Infinity;
    let minY = Infinity;

    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');

      if (doc.querySelector('parsererror')) throw new Error('Die Makrodatei enthält ungültiges XML.');
      const nameAttr = doc.querySelector('Macro, WindowMacro, PageMacro, ProjectXml, Project')?.getAttribute('name');
      if (nameAttr) macroName = nameAttr;

      const desc = doc.querySelector('Description, Remark')?.textContent;
      if (desc) description = desc;

      const componentNodes = Array.from(doc.querySelectorAll('Component, PlacedComponent, Object[type="Symbol"], SymbolInstance'));
      for (let i = 0; i < componentNodes.length; i++) {
        const node = componentNodes[i];
        const symbolId = node.getAttribute('symbolId')
          || node.getAttribute('symbol')
          || node.getAttribute('name')
          || 'contact_no';
        
        const bmk = node.getAttribute('bmk')
          || node.getAttribute('deviceTag')
          || `-K${i + 1}`;

        const rawX = parseFloat(node.getAttribute('x') || `${i * 30}`);
        const rawY = parseFloat(node.getAttribute('y') || '0');
        const rotation = (parseInt(node.getAttribute('rotation') || '0', 10) as any) || 0;

        if (rawX < minX) minX = rawX;
        if (rawY < minY) minY = rawY;

        components.push({
          id: 'comp_' + Math.random().toString(36).substring(2, 9),
          symbolId,
          bmk,
          functionText: node.getAttribute('functionText') || '',
          technicalCharacteristics: node.getAttribute('technical') || '',
          articleNumber: node.getAttribute('article') || '',
          manufacturer: node.getAttribute('manufacturer') || '',
          x: rawX,
          y: rawY,
          rotation,
          pins: {}
        });
      }
    } else {
      // Universal Regex XML Parser (e.g. for Node.js / test environments)
      const nameMatch = xmlContent.match(/<Macro[^>]+name="([^"]+)"/i) || xmlContent.match(/<Name>([^<]+)<\/Name>/i);
      if (nameMatch) macroName = nameMatch[1];

      const descMatch = xmlContent.match(/<Description>([^<]+)<\/Description>/i);
      if (descMatch) description = descMatch[1];

      const compTagRegex = /<Component\b([^>]*)\/?>/gi;
      let match;
      let i = 0;
      while ((match = compTagRegex.exec(xmlContent)) !== null) {
        const attrs = match[1];
        const getAttr = (name: string) => {
          const m = attrs.match(new RegExp(`${name}="([^"]*)"`, 'i'));
          return m ? m[1] : '';
        };

        const symbolId = getAttr('symbolId') || getAttr('symbol') || getAttr('name') || 'contact_no';
        const bmk = getAttr('bmk') || getAttr('deviceTag') || `-K${i + 1}`;
        const rawX = parseFloat(getAttr('x') || `${i * 30}`);
        const rawY = parseFloat(getAttr('y') || '0');
        const rotation = (parseInt(getAttr('rotation') || '0', 10) as any) || 0;

        if (rawX < minX) minX = rawX;
        if (rawY < minY) minY = rawY;

        components.push({
          id: 'comp_' + Math.random().toString(36).substring(2, 9),
          symbolId,
          bmk,
          functionText: getAttr('functionText') || '',
          technicalCharacteristics: getAttr('technical') || '',
          articleNumber: getAttr('article') || '',
          manufacturer: getAttr('manufacturer') || '',
          x: rawX,
          y: rawY,
          rotation,
          pins: {}
        });
        i++;
      }
    }

    // Normalize coordinates so the macro starts at relative (0, 0)
    if (components.length > 0 && minX !== Infinity && minY !== Infinity) {
      for (const c of components) {
        c.x -= minX;
        c.y -= minY;
      }
    }

    if (!allowHeuristic && components.length === 0) throw new Error('Die Makrodatei enthält keine unterstützten Elemente.');
    if (components.length === 0) {
      // If no explicit component tags were found, create a placeholder device block
      components.push({
        id: 'comp_' + Math.random().toString(36).substring(2, 9),
        symbolId: 'contactor_coil',
        bmk: '-K1',
        functionText: macroName,
        x: 0,
        y: 0,
        rotation: 0,
        pins: {}
      });
    }

    let maxX = 0;
    let maxY = 0;
    for (const c of components) {
      const sym = getSymbolForComponent(c);
      const w = sym ? sym.width : 40;
      const h = sym ? sym.height : 48;
      if (c.x + w > maxX) maxX = c.x + w;
      if (c.y + h > maxY) maxY = c.y + h;
    }

    if (isPageMacro) {
      const pageMacro: PageMacro = {
        id: 'user_ems_' + Math.random().toString(36).substring(2, 9),
        name: macroName,
        type: 'ems',
        category: 'Importierte Seitenmakros',
        description,
        isBuiltIn: false,
        created: new Date().toISOString().split('T')[0],
        page: {
          id: 'page_ems_' + Math.random().toString(36).substring(2, 9),
          pageNumber: '1',
          pageType: 'schematic',
          title: macroName,
          higherLevel: '=A1',
          location: '+S1',
          components,
          wires: [],
          plotFrame: {
            type: 'DIN_A3_LANDSCAPE',
            width: 1000,
            height: 700,
            columns: 10,
            rows: ['A', 'B', 'C', 'D', 'E', 'F'],
            titleBlock: {
              projectTitle: macroName,
              commission: 'IMPORT',
              company: 'Makro-Import',
              author: 'Planer',
              date: new Date().toISOString().split('T')[0],
              revision: '1.0',
              sheetNumber: '1',
              totalSheets: '1'
            }
          }
        }
      };
      return pageMacro;
    }

    const windowMacro: WindowMacro = {
      id: 'user_ema_' + Math.random().toString(36).substring(2, 9),
      name: macroName,
      type: 'ema',
      category: 'Eigene Fenstermakros',
      description,
      isBuiltIn: false,
      created: new Date().toISOString().split('T')[0],
      width: Math.max(80, maxX),
      height: Math.max(60, maxY),
      components
    };

    return windowMacro;
  }

  /**
   * Heuristic scanner for binary CAD macro streams (.ema & .ems).
   * Extracts text, BMK strings and component signatures.
   */
  private static async parseBinaryHeuristicMacro(file: File, filename: string, isPageMacro: boolean): Promise<MacroItem> {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Extract ASCII / UTF-8 strings longer than 3 chars
    const extractedStrings: string[] = [];
    let currentStr = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if ((b >= 32 && b <= 126) || b === 10 || b === 13) {
        currentStr += String.fromCharCode(b);
      } else {
        if (currentStr.length >= 3) {
          extractedStrings.push(currentStr.trim());
        }
        currentStr = '';
      }
    }

    const name = filename.replace(/\.(ema|ems|edz)$/i, '');
    const bmkRegex = /^[=-]?[A-Z]{1,3}\d+$/;
    const detectedBmks = extractedStrings.filter(s => bmkRegex.test(s));

    // Construct components matching detected BMKs or default
    const components: PlacedComponent[] = [];
    const uniqueBmks = Array.from(new Set(detectedBmks)).slice(0, 10);

    if (uniqueBmks.length > 0) {
      uniqueBmks.forEach((bmk, idx) => {
        let symId = 'contact_no';
        if (bmk.startsWith('-Q')) symId = 'motor_overload_switch';
        else if (bmk.startsWith('-K')) symId = 'contactor_coil';
        else if (bmk.startsWith('-M')) symId = 'motor_3p';
        else if (bmk.startsWith('-F')) symId = 'fuse_1p';
        else if (bmk.startsWith('-S')) symId = 'pushbutton_no';
        else if (bmk.startsWith('-X')) symId = 'terminal_pe';

        components.push({
          id: 'comp_' + Math.random().toString(36).substring(2, 9),
          symbolId: symId,
          bmk,
          functionText: `Bauteil ${bmk}`,
          x: idx * 40,
          y: 0,
          rotation: 0,
          pins: {}
        });
      });
    } else {
      components.push({
        id: 'comp_' + Math.random().toString(36).substring(2, 9),
        symbolId: 'contactor_coil',
        bmk: '-K1',
        functionText: name,
        x: 0,
        y: 0,
        rotation: 0,
        pins: {}
      });
    }

    if (isPageMacro) {
      return {
        id: 'user_ems_' + Math.random().toString(36).substring(2, 9),
        name,
        type: 'ems',
        category: 'Importierte Seitenmakros',
        description: `Aus Datei ${filename} extrahierte Seite (${components.length} Bauteile)`,
        isBuiltIn: false,
        created: new Date().toISOString().split('T')[0],
        page: {
          id: 'page_ems_' + Math.random().toString(36).substring(2, 9),
          pageNumber: '1',
          pageType: 'schematic',
          title: name,
          higherLevel: '=A1',
          location: '+S1',
          components,
          wires: [],
          plotFrame: {
            type: 'DIN_A3_LANDSCAPE',
            width: 1000,
            height: 700,
            columns: 10,
            rows: ['A', 'B', 'C', 'D', 'E', 'F'],
            titleBlock: {
              projectTitle: name,
              commission: 'BIN-IMPORT',
              company: 'Makro-Import',
              author: 'Planer',
              date: new Date().toISOString().split('T')[0],
              revision: '1.0',
              sheetNumber: '1',
              totalSheets: '1'
            }
          }
        }
      };
    }

    return {
      id: 'user_ema_' + Math.random().toString(36).substring(2, 9),
      name,
      type: 'ema',
      category: 'Importierte Fenstermakros',
      description: `Aus Datei ${filename} rekonstruierte Teilschaltung (${components.length} Bauteile)`,
      isBuiltIn: false,
      created: new Date().toISOString().split('T')[0],
      width: Math.max(80, components.length * 40),
      height: 100,
      components
    };
  }

  private static normalizeParsedJsonMacro(parsed: any, filename: string, isPageMacro: boolean): MacroItem {
    migrateLegacyData(parsed);
    const name = parsed.name || filename.replace(/\.(ema|ems|json)$/i, '');
    const id = (typeof parsed.id === 'string' && !parsed.id.startsWith('external:') && !BUILTIN_MACROS.some(m => m.id === parsed.id) ? parsed.id : undefined) || (isPageMacro ? 'user_ems_' : 'user_ema_') + Math.random().toString(36).substring(2, 9);
    
    if (parsed.type === 'ems' || parsed.page || isPageMacro) {
      return {
        id,
        name,
        type: 'ems',
        category: parsed.category || 'Importierte Seitenmakros',
        description: parsed.description || `Seitenmakro aus ${filename}`,
        symbolLibrary: parsed.symbolLibrary,
        unitsPerMm: parsed.unitsPerMm,
        page: parsed.page || {
          id: 'page_' + Math.random().toString(36).substring(2, 9),
          pageNumber: '1',
          pageType: 'schematic',
          title: name,
          components: parsed.components || [],
          wires: parsed.wires || [],
          plotFrame: { type: 'DIN_A3_LANDSCAPE', width: 1000, height: 700, columns: 10, rows: ['A', 'B', 'C', 'D', 'E', 'F'], titleBlock: { projectTitle: name } }
        },
        isBuiltIn: false,
        author: parsed.author, version: parsed.version,
        created: parsed.created || new Date().toISOString().split('T')[0]
      };
    }

    return {
      id,
      name,
      type: 'ema',
      category: parsed.category || 'Importierte Fenstermakros',
      description: parsed.description || `Fenstermakro aus ${filename}`,
      symbolLibrary: parsed.symbolLibrary,
      unitsPerMm: parsed.unitsPerMm,
      components: parsed.components || [],
      wires: parsed.wires || [],
      handlePoint: parsed.handlePoint,
      images: parsed.images, cables: parsed.cables, boxes: parsed.boxes, groups: parsed.groups,
      width: parsed.width || 120,
      height: parsed.height || 160,
      isBuiltIn: false,
      author: parsed.author, version: parsed.version,
        created: parsed.created || new Date().toISOString().split('T')[0]
    };
  }

  private static createGenericMacro(name: string, description: string, isPageMacro: boolean): MacroItem {
    const cleanName = name.replace(/\.(ema|ems|edz)$/i, '');
    if (isPageMacro) {
      return {
        id: 'user_ems_' + Math.random().toString(36).substring(2, 9),
        name: cleanName,
        type: 'ems',
        category: 'Importierte Makros',
        description,
        isBuiltIn: false,
        page: {
          id: 'page_' + Math.random().toString(36).substring(2, 9),
          pageNumber: '1',
          pageType: 'schematic',
          title: cleanName,
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
              projectTitle: cleanName,
              commission: 'KOM-2026',
              company: 'Elektro Engineering',
              author: 'Planer',
              date: new Date().toISOString().split('T')[0],
              revision: '1.0',
              sheetNumber: '1',
              totalSheets: '1'
            }
          }
        }
      };
    }

    return {
      id: 'user_ema_' + Math.random().toString(36).substring(2, 9),
      name: cleanName,
      type: 'ema',
      category: 'Importierte Makros',
      description,
      width: 100,
      height: 100,
      isBuiltIn: false,
      components: [
        {
          id: 'comp_' + Math.random().toString(36).substring(2, 9),
          symbolId: 'contactor_coil',
          bmk: '-K1',
          functionText: cleanName,
          x: 0,
          y: 0,
          rotation: 0,
          pins: {}
        }
      ]
    };
  }

  /**
   * Creates a Window Macro (.ema) from a selection of components.
   */
  public static createMacroFromComponents(
    name: string,
    category: string,
    description: string,
    components: PlacedComponent[],
    wires?: Wire[],
    groups?: ElementGroup[]
  ): WindowMacro {
    if (components.length === 0) {
      throw new Error('Keine Bauteile für das Makro ausgewählt.');
    }

    // Find bounding box
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const c of components) {
      const sym = getSymbolForComponent(c);
      const w = sym ? sym.width : 40;
      const h = sym ? sym.height : 48;
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x + w > maxX) maxX = c.x + w;
      if (c.y + h > maxY) maxY = c.y + h;
    }

    // Clone components with relative positions
    const clonedComponents: PlacedComponent[] = components.map(c => ({
      ...JSON.parse(JSON.stringify(c)),
      x: c.x - minX,
      y: c.y - minY
    }));

    // Clone internal wires that connect between selected components
    const compIds = new Set(components.map(c => c.id));
    const internalWires: Wire[] = [];
    if (wires) {
      for (const w of wires) {
        if (compIds.has(w.from.componentId) && compIds.has(w.to.componentId)) {
          internalWires.push({ ...JSON.parse(JSON.stringify(w)),
            ...(w.waypoints ? { waypoints: w.waypoints.map(p => ({ x: p.x - minX, y: p.y - minY })) } : {}) });
        }
      }
    }

    return {
      id: 'user_ema_' + Math.random().toString(36).substring(2, 9),
      name,
      type: 'ema',
      category: category || 'Eigene Fenstermakros',
      description,
      isBuiltIn: false,
      created: new Date().toISOString().split('T')[0],
      width: Math.max(40, maxX - minX),
      height: Math.max(40, maxY - minY),
      components: clonedComponents,
      unitsPerMm: getDrawingUnitsPerMm(),
      handlePoint: (() => { const sym = getSymbolForComponent(components[0]);
        const p = sym ? componentInsertionPoint(components[0], sym) : components[0];
        return { x: p.x - minX, y: p.y - minY }; })(),
      symbolLibrary: getComponentSymbolLibrary(components),
      wires: internalWires,
      groups: remapElementGroups(groups,{component:new Map(clonedComponents.map(c=>[c.id,c.id])),wire:new Map(internalWires.map(w=>[w.id,w.id]))})
    };
  }

  /** Export a complete mixed selection, including saved nested ownership. */
  public static createMacroFromSelection(name:string,category:string,description:string,page:Page,selection:ElementSelection):WindowMacro {
    const selected=normalizeSelection(page,selection),ids=new Set(selected.componentIds);
    const content:Page={...structuredClone(page),
      components:page.components.filter(c=>ids.has(c.id)),
      wires:page.wires.filter(w=>ids.has(w.from.componentId)&&ids.has(w.to.componentId)),
      images:page.images?.filter(c=>selected.imageIds?.includes(c.id)),
      boxes:page.boxes?.filter(c=>selected.boxIds?.includes(c.id)),
      cables:page.cables?.filter(c=>selected.cableIds.includes(c.id)),
      texts:page.texts?.filter(c=>selected.textIds?.includes(c.id))};
    const identity=(items:{id:string}[]|undefined)=>new Map((items??[]).map(i=>[i.id,i.id]));
    content.groups=remapElementGroups(page.groups,{component:identity(content.components),wire:identity(content.wires),image:identity(content.images),box:identity(content.boxes),cable:identity(content.cables),text:identity(content.texts)});
    return {...macroForPlacement(this.createMacroFromPage(content,name,category)),description};
  }

  /**
   * Creates a Page Macro (.ems) from an existing Page.
   */
  public static createMacroFromPage(page: Page, name?: string, category?: string): PageMacro {
    const pageClone: Page = JSON.parse(JSON.stringify(page));
    pageClone.id = 'macro_page_' + Math.random().toString(36).substring(2, 9);
    
    return {
      id: 'user_ems_' + Math.random().toString(36).substring(2, 9),
      name: name || page.title || `Seitenmakro Seite ${page.pageNumber}`,
      type: 'ems',
      category: category || 'Eigene Seitenmakros',
      description: `Seitenmakro erstellt aus Blatt ${page.pageNumber}`,
      isBuiltIn: false,
      created: new Date().toISOString().split('T')[0],
      page: pageClone,
      unitsPerMm: getDrawingUnitsPerMm(),
      symbolLibrary: getComponentSymbolLibrary(page.components)
    };
  }

  /**
   * Instantiates a Window Macro (.ema) at target coordinates.
   * Performs BMK auto-incrementing and ID remapping so inserted components don't conflict.
   */
  public static instantiateWindowMacro(
    macro: WindowMacro,
    targetX: number,
    targetY: number,
    existingComponents: PlacedComponent[],
    project?: Project
  ): { components: PlacedComponent[]; wires: Wire[]; images: PageImage[]; cables: CableDefinition[]; boxes: PageBox[]; groups: ElementGroup[] } {
    const factor = this.getMacroScale(macro, project);
    // 1. Calculate next available numbers for each BMK prefix
    const bmkMap = new Map<string, string>(); // old BMK -> new BMK
    const idMap = new Map<string, string>();   // old comp ID -> new comp ID

    // Group macro components by BMK prefix
    for (const comp of [...macro.components,...macro.boxes ?? []]) {
      if (!comp.bmk) continue;
      const match = comp.bmk.match(/^(=[^+]+)?(\+[^-]+)?(-[A-Za-z]+)(\d+)?(.*)$/);
      const prefix = match ? match[3] : comp.bmk.replace(/\d+.*$/, '');

      if (!bmkMap.has(comp.bmk)) {
        // Find highest existing index for this prefix in existing components and mapped components
        let maxIndex = 0;
        const allBmks = [...existingComponents.map(c => c.bmk), ...(project?.pages.flatMap(p=>[...p.components.map(c=>c.bmk),...(p.boxes??[]).map(c=>c.bmk)]) ?? []), ...Array.from(bmkMap.values())];
        for (const b of allBmks) {
          if (!b) continue;
          const bMatch = b.match(/^(=[^+]+)?(\+[^-]+)?(-[A-Za-z]+)(\d+)/);
          if (bMatch && bMatch[3] === prefix) {
            const num = parseInt(bMatch[4], 10);
            if (!isNaN(num) && num > maxIndex) maxIndex = num;
          }
        }
        const nextNum = maxIndex + 1;
        bmkMap.set(comp.bmk, `${prefix}${nextNum}`);
      }
    }

    // 2. Clone and place components
    const newComponents: PlacedComponent[] = macro.components.map(c => {
      const newId = 'comp_' + Math.random().toString(36).substring(2, 9);
      idMap.set(c.id, newId);

      const assignedBmk = bmkMap.get(c.bmk) || c.bmk;

      return {
        ...scalePlacedComponent(c, factor),
        id: newId,
        bmk: assignedBmk,
        x: targetX + c.x * factor,
        y: targetY + c.y * factor
      };
    });

    // 3. Clone and remap wires
    const newWires: Wire[] = [];
    const wireIds = new Map<string, string>();
    if (macro.wires) {
      for (const w of macro.wires) {
        const fromId = idMap.get(w.from.componentId);
        const toId = idMap.get(w.to.componentId);
        if (fromId && toId) {
          const id = 'w_' + Math.random().toString(36).substring(2, 9);
          wireIds.set(w.id, id);
          newWires.push({
            ...JSON.parse(JSON.stringify(w)),
            id,
            from: { ...w.from, componentId: fromId },
            to: { ...w.to, componentId: toId },
            ...(w.waypoints ? { waypoints: w.waypoints.map(p => ({ x: targetX + p.x * factor, y: targetY + p.y * factor })) } : {}),
            ...(w.lineWidth !== undefined ? { lineWidth: w.lineWidth * factor } : {})
          });
        }
      }
    }

    if (project) mergeProjectSymbolLibrary(project, macro.symbolLibrary ?? [], newComponents);
    for (const c of newComponents) for (const pin of Object.values(c.pins))
      if (pin.wireIds) pin.wireIds = pin.wireIds.map(id => wireIds.get(id)).filter((id): id is string => !!id);
    const images = (macro.images ?? []).map(image => ({ ...structuredClone(image), id: 'image_' + crypto.randomUUID(),
      x: targetX + image.x * factor, y: targetY + image.y * factor, width: image.width * factor, height: image.height * factor }));
    const existingBmks = new Set([...(project?.pages.flatMap(p => p.cables ?? []) ?? []).map(c => c.bmk)]);
    const cables = (macro.cables ?? []).map(original => {
      const cable = structuredClone(original); cable.id = 'cable_' + crypto.randomUUID();
      let n = 1; while (existingBmks.has('-W' + n)) n++;
      cable.bmk = '-W' + n; existingBmks.add(cable.bmk);
      cable.start = { x: targetX + cable.start.x * factor, y: targetY + cable.start.y * factor };
      cable.end = { x: targetX + cable.end.x * factor, y: targetY + cable.end.y * factor };
      for (const key of ['fontSize', 'bmkFontSize', 'coreFontSize'] as const) if (cable[key] !== undefined) cable[key]! *= factor;
      if (cable.labelOffset) cable.labelOffset = { x: cable.labelOffset.x * factor, y: cable.labelOffset.y * factor };
      cable.cores = cable.cores.map(core => ({ ...core, id: 'core_' + crypto.randomUUID(), wireIds: core.wireIds?.map(id => wireIds.get(id)).filter((id): id is string => !!id) }));
      return cable;
    });
    const boxes=(macro.boxes??[]).map(original=>({...structuredClone(original),id:'box_'+crypto.randomUUID(),
      x:targetX+original.x*factor,y:targetY+original.y*factor,width:original.width*factor,height:original.height*factor,
      ...(original.bmk?{bmk:bmkMap.get(original.bmk)??original.bmk}:{}),
      ...(original.fontSize!==undefined?{fontSize:original.fontSize*factor}:{}),
      ...(original.lineWidth!==undefined?{lineWidth:original.lineWidth*factor}:{})}));
    const groups=remapElementGroups(macro.groups,{component:idMap,wire:wireIds,
      image:new Map((macro.images??[]).map((item,i)=>[item.id,images[i].id])),
      cable:new Map((macro.cables??[]).map((item,i)=>[item.id,cables[i].id])),
      box:new Map((macro.boxes??[]).map((item,i)=>[item.id,boxes[i].id]))});
    return { components: newComponents, wires: newWires, images, cables, boxes, groups };
  }

  public static getMacroScale(macro: WindowMacro | PageMacro, project?: Project): number {
    const source = macro.unitsPerMm ?? macro.symbolLibrary?.find(s => s.unitsPerMm)?.unitsPerMm
      ?? (macro.symbolLibrary?.some(s => s.source) ? getDrawingUnitsPerMm(project) : 2);
    return getDrawingUnitsPerMm(project) / source;
  }

  /**
   * Instantiates a Page Macro (.ems) by appending a cloned page to the project.
   */
  public static instantiatePageMacro(macro: PageMacro, project: Project): Page {
    const pageClone: Page = JSON.parse(JSON.stringify(macro.page));
    const factor = this.getMacroScale(macro, project);
    if (factor !== 1) {
      pageClone.components = pageClone.components.map(c => scalePlacedComponent(c, factor));
      pageClone.plotFrame.width *= factor; pageClone.plotFrame.height *= factor;
      if (pageClone.grid) {
        pageClone.grid.spacing *= factor;
        pageClone.grid.origin.x *= factor; pageClone.grid.origin.y *= factor;
      }
      for (const wire of pageClone.wires) {
        wire.waypoints = wire.waypoints?.map(p => ({ x: p.x * factor, y: p.y * factor }));
        if (wire.lineWidth !== undefined) wire.lineWidth *= factor;
      }
      for (const text of pageClone.texts ?? []) {
        text.x *= factor; text.y *= factor;
        if (text.fontSize !== undefined) text.fontSize *= factor;
      }
      for (const item of [...(pageClone.images ?? []), ...(pageClone.boxes ?? [])]) {
        item.x *= factor; item.y *= factor; item.width *= factor; item.height *= factor;
      }
      for(const box of pageClone.boxes ?? []){
        if(box.fontSize!==undefined)box.fontSize*=factor;if(box.lineWidth!==undefined)box.lineWidth*=factor;
      }
    }
    mergeProjectSymbolLibrary(project, macro.symbolLibrary ?? [], pageClone.components);
    const newPageId = 'page_' + Math.random().toString(36).substring(2, 9);
    pageClone.id = newPageId;

    // Determine next page number
    let maxPageNum = 0;
    for (const p of project.pages) {
      const num = parseInt(p.pageNumber, 10);
      if (!isNaN(num) && num > maxPageNum) maxPageNum = num;
    }
    const nextNum = (maxPageNum + 1).toString();
    pageClone.pageNumber = nextNum;
    pageClone.title = `${macro.name} (Seite ${nextNum})`;

    if (pageClone.plotFrame?.titleBlock) {
      pageClone.plotFrame.titleBlock.sheetNumber = nextNum;
      pageClone.plotFrame.titleBlock.totalSheets = (project.pages.length + 1).toString();
      pageClone.plotFrame.titleBlock.date = new Date().toISOString().split('T')[0];
    }

    // Remap component IDs to avoid collisions
    const idMap = new Map<string, string>();
    for (const c of pageClone.components) {
      const oldId = c.id;
      const newId = 'comp_' + Math.random().toString(36).substring(2, 9);
      idMap.set(oldId, newId);
      c.id = newId;
    }
    const wireIds=new Map<string,string>();
    for (const w of pageClone.wires) {
      const oldId=w.id;
      w.id = 'w_' + Math.random().toString(36).substring(2, 9);
      wireIds.set(oldId,w.id);
      if (idMap.has(w.from.componentId)) w.from.componentId = idMap.get(w.from.componentId)!;
      if (idMap.has(w.to.componentId)) w.to.componentId = idMap.get(w.to.componentId)!;
    }

    for(const c of pageClone.components)for(const pin of Object.values(c.pins))if(pin.wireIds)pin.wireIds=pin.wireIds.flatMap(id=>wireIds.has(id)?[wireIds.get(id)!]:[]);
    const imageIds=new Map<string,string>(),boxIds=new Map<string,string>(),textIds=new Map<string,string>(),cableIds=new Map<string,string>();
    for(const [items,ids,prefix]of [[pageClone.images,imageIds,'image'],[pageClone.boxes,boxIds,'box'],[pageClone.texts,textIds,'text'],[pageClone.cables,cableIds,'cable']]as const){
      for(const item of items??[]){const oldId=item.id;item.id=prefix+'_'+crypto.randomUUID();ids.set(oldId,item.id);}
    }
    for(const cable of pageClone.cables??[])for(const core of cable.cores)if(core.wireIds)core.wireIds=core.wireIds.flatMap(id=>wireIds.has(id)?[wireIds.get(id)!]:[]);
    pageClone.groups=remapElementGroups(pageClone.groups,{component:idMap,wire:wireIds,image:imageIds,box:boxIds,text:textIds,cable:cableIds});
    return pageClone;
  }

  /**
   * Exports portable macro data with the .ema or .ems extension.
   */
  public static exportMacro(macro: MacroItem): { blob: Blob; filename: string } {
    const cleanName = macro.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const ext = macro.type === 'ema' ? 'ema' : 'ems';
    const filename = `${cleanName}.${ext}`;

    // Preserve wires, label layouts, units and embedded master data for the
    // user's folder library. The readable legacy XML subset remains importable.
    const { externalPath: _source, ...data } = macro;
    return { blob: new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename };
  }

  /**
   * Generates a mini SVG preview markup of a macro.
   */
  public static generateMacroSvgThumbnail(macro: MacroItem, width: number = 80, height: number = 60): string {
    const isWindow = macro.type === 'ema';
    let preview: WindowMacro;
    try { preview = isWindow ? macro as WindowMacro : macroForPlacement(macro); }
    catch { return `<svg width="${width}" height="${height}"><text x="8" y="20" fill="#a0aec0" font-size="10">Kein Inhalt</text></svg>`; }
    const components = preview.components, mWidth = preview.width, mHeight = preview.height;

    const scale = Math.min(
      (width - 16) / Math.max(mWidth, 40),
      (height - 16) / Math.max(mHeight, 40),
      0.8
    );

    let symbolsPreview = (preview.boxes??[]).map(box=>`<g transform="translate(8,8) scale(${scale})">${drawingToSvg(boxDrawing(box))}</g>`).join('');
    for (const c of components.slice(0, 8)) {
      const base = preview.symbolLibrary?.find(symbol => symbol.id === c.symbolId) ?? getSymbolForComponent(c);
      const sym=base && deviceBoxDefinition(c,base);
      if (sym) {
        const fn = computeFunctionTextPosition(c, sym);
        symbolsPreview += `
          <g transform="translate(${c.x * scale + 8}, ${c.y * scale + 8}) scale(${scale})">
            <g transform="rotate(${c.rotation || 0},${sym.width/2},${sym.height/2})">${sym.importedGraphics ? drawingToSvg(sym.importedGraphics) : sym.svgContent}${fn.visible && c.functionText ? `<text x="${fn.x}" y="${fn.y}" font-size="${fn.fontSize}" fill="currentColor" stroke="none" text-anchor="${fn.anchor}" ${fn.transform}>${escapeSvg(c.functionText)}</text>` : ''}</g>
          </g>
        `;
      }
    }

    for (const image of preview.images ?? []) symbolsPreview += `<image href="${escapeSvg(image.dataUrl)}" x="${image.x*scale+8}" y="${image.y*scale+8}" width="${image.width*scale}" height="${image.height*scale}"/>`;
    const strokeColor = isWindow ? '#63b3ed' : '#b794f4';
    const borderColor = isWindow ? '#3182ce' : '#805ad5';

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background: rgba(0,0,0,0.25); border-radius: 4px;">
        <rect width="100%" height="100%" fill="none" stroke="${borderColor}" stroke-dasharray="2,2" stroke-width="1"/>
        <g stroke="${strokeColor}" fill="none">
          ${symbolsPreview}
        </g>
      </svg>
    `;
  }

  private static escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }
}
