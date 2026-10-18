// src/model/PartCatalogue.ts
// Schematico Manufacturer Parts Catalogue & Component Database

export interface ManufacturerPart {
  id: string;
  manufacturer: string;
  articleNumber: string;
  name: string;
  category: 'protection' | 'relays' | 'controls' | 'motors' | 'terminals' | 'supply';
  symbolId: string;
  technicalData: string;
  widthModules?: string; // Teilungseinheiten (TE)
  datasheetUrl?: string;
  description: string;
  defaultBmkPrefix: string;
}

export const MANUFACTURER_PARTS: ManufacturerPart[] = [
  // --- HAGER ---
  {
    id: 'hager_cds440d',
    manufacturer: 'Hager',
    articleNumber: 'CDS440D',
    name: 'FI-Schutzschalter 4P 40A 30mA Typ A',
    category: 'protection',
    symbolId: 'rcd_4p',
    technicalData: '4-polig | In=40A | IΔn=30mA | 400V AC | Typ A',
    widthModules: '4 TE',
    description: 'Fehlerstromschutzschalter nach DIN EN 61008-1 zum Schutz bei Berührung',
    defaultBmkPrefix: '-F'
  },
  {
    id: 'hager_cda225d',
    manufacturer: 'Hager',
    articleNumber: 'CDA225D',
    name: 'FI-Schutzschalter 2P 25A 30mA Typ A',
    category: 'protection',
    symbolId: 'rcd_2p',
    technicalData: '2-polig | In=25A | IΔn=30mA | 230V AC | Typ A',
    widthModules: '2 TE',
    description: 'Fehlerstromschutzschalter 1P+N für Einphasenstromkreise',
    defaultBmkPrefix: '-F'
  },
  {
    id: 'hager_epn510',
    manufacturer: 'Hager',
    articleNumber: 'EPN510',
    name: 'Stromstoßschalter 1S 16A 230V',
    category: 'relays',
    symbolId: 'impulse_relay_1no',
    technicalData: '1 Schließer | 16A 250V AC | Spule: 230V AC',
    widthModules: '1 TE',
    description: 'Elektromechanisches Stromstoßrelais für Lichtsteuerung mit Tastern',
    defaultBmkPrefix: '-K'
  },
  {
    id: 'hager_mbn116',
    manufacturer: 'Hager',
    articleNumber: 'MBN116',
    name: 'Leitungsschutzschalter B16 1-polig',
    category: 'protection',
    symbolId: 'fuse_1p',
    technicalData: '1-polig | Charakteristik B | In=16A | 6kA',
    widthModules: '1 TE',
    description: 'Leitungsschutzschalter nach DIN VDE 0641 Teil 11',
    defaultBmkPrefix: '-F'
  },

  // --- FINDER ---
  {
    id: 'finder_2021',
    manufacturer: 'Finder',
    articleNumber: '20.21.8.230.4000',
    name: 'Stromstoßrelais Serie 20 16A 1S 230V',
    category: 'relays',
    symbolId: 'impulse_relay_1no',
    technicalData: '1 Schließer (1NO) | 16A 250V AC | Spule: 230V AC 50Hz',
    widthModules: '1 TE (17.5mm)',
    description: 'Schritt- / Stromstoßschalter für DIN-Hutschienenmontage',
    defaultBmkPrefix: '-K'
  },
  {
    id: 'finder_2022',
    manufacturer: 'Finder',
    articleNumber: '20.22.8.230.4000',
    name: 'Stromstoßrelais Serie 20 16A 2S 230V',
    category: 'relays',
    symbolId: 'impulse_relay_2no',
    technicalData: '2 Schließer (2NO) | 16A 250V AC | 4 Schaltfolgen',
    widthModules: '1 TE (17.5mm)',
    description: 'Stromstoß-Schrittschalter mit Serienschaltung für 2 Leuchtengruppen',
    defaultBmkPrefix: '-K'
  },
  {
    id: 'finder_8001',
    manufacturer: 'Finder',
    articleNumber: '80.01.0.240.0000',
    name: 'Multifunktions-Zeitrelais Serie 80',
    category: 'relays',
    symbolId: 'timer_relay_multifunction',
    technicalData: '1 Wechsler 16A | 12...240V AC/DC | Zeit: 0.1s...24h',
    widthModules: '1 TE',
    description: 'Elektronisches Zeitrelais mit 6 Zeitfunktionen (AI, DI, SW, BE, CE, DE)',
    defaultBmkPrefix: '-K'
  },

  // --- SIEMENS ---
  {
    id: 'siemens_5sv3344',
    manufacturer: 'Siemens',
    articleNumber: '5SV3344-6',
    name: 'FI-Schutzschalter SENTRON 4P 40A 30mA',
    category: 'protection',
    symbolId: 'rcd_4p',
    technicalData: '4-polig | In=40A | IΔn=30mA | Un=400V | Typ A kurzzeitverzögert',
    widthModules: '4 TE',
    description: 'Siemens SENTRON FI-Schutzschalter für Industrie und Gewerbe',
    defaultBmkPrefix: '-F'
  },
  {
    id: 'siemens_5sv1316',
    manufacturer: 'Siemens',
    articleNumber: '5SV1316-6KK16',
    name: 'FI/LS-Kombischalter 1P+N B16 30mA (1 TE)',
    category: 'protection',
    symbolId: 'rcbo_1p_n',
    technicalData: '1P+N | B16A | IΔn=30mA | 6kA | 230V AC',
    widthModules: '1 TE (Kompakt)',
    description: 'Kompakter RCBO spart 50% Platz im Verteilerschrank',
    defaultBmkPrefix: '-F'
  },
  {
    id: 'siemens_3rt2016',
    manufacturer: 'Siemens',
    articleNumber: '3RT2016-1BB41',
    name: 'Leistungsschütz SIRIUS 3kW/400V 24VDC',
    category: 'relays',
    symbolId: 'contactor_coil',
    technicalData: '3kW / 400V 9A | Spule: 24V DC | 1 Schließer Hilfskontakt',
    widthModules: 'Baugröße S00',
    description: 'SIRIUS 3-poliges Motorschütz für Steuerungen',
    defaultBmkPrefix: '-K'
  },
  {
    id: 'siemens_3rv2011',
    manufacturer: 'Siemens',
    articleNumber: '3RV2011-1EA10',
    name: 'Motorschutzschalter SIRIUS 2.8 - 4.0A',
    category: 'protection',
    symbolId: 'motor_protective_switch',
    technicalData: 'Einstellbereich 2.8 - 4.0A | 400V | Icu=100kA',
    widthModules: 'Baugröße S00',
    description: 'Leistungsschalter für Motorschutz mit Überlast- und Kurzschlussauslöser',
    defaultBmkPrefix: '-Q'
  },

  // --- ABB ---
  {
    id: 'abb_fh202',
    manufacturer: 'ABB',
    articleNumber: 'FH202-25/0.03',
    name: 'FI-Schutzschalter 2P 25A 30mA Typ A',
    category: 'protection',
    symbolId: 'rcd_2p',
    technicalData: '2-polig | In=25A | IΔn=30mA | 230V AC',
    widthModules: '2 TE',
    description: 'ABB System pro M compact Fehlerstromschutzschalter',
    defaultBmkPrefix: '-F'
  },
  {
    id: 'abb_e290',
    manufacturer: 'ABB',
    articleNumber: 'E290-16-10/230',
    name: 'Stromstoßschalter 16A 1S 230VAC',
    category: 'relays',
    symbolId: 'impulse_relay_1no',
    technicalData: '1 Schließer | 16A 250V AC | Spule: 230V AC',
    widthModules: '1 TE',
    description: 'Elektromagnetisches Stromstoßrelais für Reiheneinbau',
    defaultBmkPrefix: '-K'
  },

  // --- EATON ---
  {
    id: 'eaton_etr4',
    manufacturer: 'Eaton',
    articleNumber: 'ETR4-69-A',
    name: 'Multifunktions-Zeitrelais ETR4',
    category: 'relays',
    symbolId: 'timer_relay_multifunction',
    technicalData: '1 Wechsler | 24 - 240V AC/DC | 0.05s - 100h',
    widthModules: '22.5mm',
    description: 'Elektronisches Zeitrelais mit Steuerkontakteingang B1',
    defaultBmkPrefix: '-K'
  },

  // --- DEHN ---
  {
    id: 'dehn_952400',
    manufacturer: 'Dehn',
    articleNumber: '952400',
    name: 'DEHNguard M TNS 275 Überspannungsschutz',
    category: 'protection',
    symbolId: 'surge_arrester_spd',
    technicalData: 'Typ 2 SPD | 4-polig TN-S | In=20kA | Imax=40kA',
    widthModules: '4 TE',
    description: 'Mehrpoliger Überspannungsableiter mit thermodynamischer Abtrennvorrichtung',
    defaultBmkPrefix: '-F'
  }
];

export class PartCatalogue {
  public static getAllParts(): ManufacturerPart[] {
    return MANUFACTURER_PARTS;
  }

  public static getPartsByManufacturer(manufacturer: string): ManufacturerPart[] {
    return MANUFACTURER_PARTS.filter(p => p.manufacturer.toLowerCase() === manufacturer.toLowerCase());
  }

  public static getPartsByCategory(category: string): ManufacturerPart[] {
    return MANUFACTURER_PARTS.filter(p => p.category === category);
  }

  public static findPartByArticle(articleNumber: string): ManufacturerPart | undefined {
    return MANUFACTURER_PARTS.find(p => p.articleNumber.toLowerCase() === articleNumber.toLowerCase());
  }
}
