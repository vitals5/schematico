// src/model/InstallationSymbols.ts
// Standard architectural electrical installation symbols according to DIN EN 60617-11 / DIN 18015

import { SymbolDefinition } from './types';

export const INSTALLATION_SYMBOLS: SymbolDefinition[] = [
  {
    id: 'inst_socket_single',
    name: 'Schuko-Steckdose (1-fach)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Steckdose',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N/PE', x: 16, y: 0, direction: 'top', description: 'Zuleitung Steckdose' }
    ],
    svgContent: `
      <!-- Halbkreis mit Fuß nach DIN EN 60617-11 -->
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 22 A 10 10 0 0 1 26 22 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="10" x2="16" y2="22" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Schutzkontakt-Steckdose 1-fach, Unterputz (DIN EN 60617-11)'
  },
  {
    id: 'inst_socket_double',
    name: 'Schuko-Steckdose (2-fach)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Doppelsteckdose',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N/PE', x: 16, y: 0, direction: 'top', description: 'Zuleitung Doppelsteckdose' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 22 A 10 10 0 0 1 26 22 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="13" y1="10" x2="13" y2="22" stroke="currentColor" stroke-width="2"/>
      <line x1="19" y1="10" x2="19" y2="22" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Schutzkontakt-Steckdose 2-fach, Unterputz (DIN EN 60617-11)'
  },
  {
    id: 'inst_socket_triple',
    name: 'Schuko-Steckdose (3-fach)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Dreifachsteckdose',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N/PE', x: 16, y: 0, direction: 'top', description: 'Zuleitung Dreifachsteckdose' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 22 A 10 10 0 0 1 26 22 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="11" y1="10" x2="11" y2="22" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="10" x2="16" y2="22" stroke="currentColor" stroke-width="2"/>
      <line x1="21" y1="10" x2="21" y2="22" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Schutzkontakt-Steckdose 3-fach, Unterputz (DIN EN 60617-11)'
  },
  {
    id: 'inst_socket_ip44',
    name: 'Schuko-Steckdose (Feuchtraum IP44)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Steckdose IP44',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N/PE', x: 16, y: 0, direction: 'top', description: 'Zuleitung Steckdose IP44' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 22 A 10 10 0 0 1 26 22 Z" fill="currentColor" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="10" x2="16" y2="22" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Feuchtraum-Steckdose IP44 mit Klappdeckel (DIN EN 60617-11)'
  },
  {
    id: 'inst_switch_off',
    name: 'Ausschalter (1-polig)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Lichtschalter',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L', x: 16, y: 0, direction: 'top', description: 'Schalteranschluss' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="18" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="10" x2="24" y2="10" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Ausschalter / Einpoliger Lichtschalter nach DIN EN 60617-11'
  },
  {
    id: 'inst_switch_changeover',
    name: 'Wechselschalter',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Wechselschalter',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L', x: 16, y: 0, direction: 'top', description: 'Wechselschalteranschluss' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="18" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="10" x2="24" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="10" x2="8" y2="10" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Wechselschalter für 2 Schaltstellen (DIN EN 60617-11)'
  },
  {
    id: 'inst_switch_series',
    name: 'Serienschalter (Doppelschalter)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Serienschalter',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L', x: 16, y: 0, direction: 'top', description: 'Serienschalteranschluss' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="18" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="10" x2="24" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="18" y1="13" x2="26" y2="13" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Serienschalter für 2 unabhängige Leuchtengruppen (DIN EN 60617-11)'
  },
  {
    id: 'inst_switch_cross',
    name: 'Kreuzschalter',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Kreuzschalter',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L', x: 16, y: 0, direction: 'top', description: 'Kreuzschalteranschluss' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="18" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="14" x2="20" y2="22" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="22" x2="20" y2="14" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Kreuzschalter für 3 oder mehr Schaltstellen (DIN EN 60617-11)'
  },
  {
    id: 'inst_pushbutton',
    name: 'Lichttaster',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Taster',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'T', x: 16, y: 0, direction: 'top', description: 'Tasteranschluss' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="18" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="18" r="3.5" fill="currentColor"/>
    `,
    description: 'Lichttaster / Schließertaster für Stromstoßrelais (DIN EN 60617-11)'
  },
  {
    id: 'inst_lamp_ceiling',
    name: 'Deckenleuchte / Deckenbrennpunkt',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-E',
    defaultFunctionText: 'Deckenleuchte',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N/PE', x: 16, y: 0, direction: 'top', description: 'Leuchtenanschluss' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="18" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="9" y1="11" x2="23" y2="25" stroke="currentColor" stroke-width="2"/>
      <line x1="9" y1="25" x2="23" y2="11" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Allgemeine Deckenleuchte / Wandauslass nach DIN EN 60617-11'
  },
  {
    id: 'inst_lamp_wall',
    name: 'Wandleuchte',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-E',
    defaultFunctionText: 'Wandleuchte',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N/PE', x: 16, y: 0, direction: 'top', description: 'Wandleuchtenanschluss' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <!-- Wandlinie oben -->
      <line x1="6" y1="10" x2="26" y2="10" stroke="currentColor" stroke-width="2.5"/>
      <circle cx="16" cy="20" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="14" x2="22" y2="26" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="26" x2="22" y2="14" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Wandleuchte / Wandauslass nach DIN EN 60617-11'
  },
  {
    id: 'inst_downlight',
    name: 'Einbaustrahler / Downlight',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-E',
    defaultFunctionText: 'Downlight',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N/PE', x: 16, y: 0, direction: 'top', description: 'Strahleranschluss' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="18" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="18" r="4" fill="currentColor"/>
    `,
    description: 'Deckeneinbauleuchte / Einbaustrahler (DIN EN 60617-11)'
  },
  {
    id: 'inst_subdistribution',
    name: 'Unterverteiler (UV / Zählerschrank)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '+UV',
    defaultFunctionText: 'Unterverteiler',
    width: 48,
    height: 32,
    pins: [
      { id: 'IN', name: 'IN', x: 24, y: 0, direction: 'top', description: 'Haupteinspeisung' },
      { id: 'OUT', name: 'OUT', x: 24, y: 32, direction: 'bottom', description: 'Abgangsleitungen' }
    ],
    svgContent: `
      <rect x="4" y="6" width="40" height="20" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="4" y1="6" x2="24" y2="26" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="6" x2="4" y2="26" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="6" x2="44" y2="26" stroke="currentColor" stroke-width="2"/>
      <line x1="44" y1="6" x2="24" y2="26" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="0" x2="24" y2="6" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="26" x2="24" y2="32" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Stromkreisverteiler / Unterverteiler nach DIN EN 60617-11'
  },
  {
    id: 'inst_smoke_detector',
    name: 'Rauchwarnmelder',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-B',
    defaultFunctionText: 'Rauchmelder',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'BUS', x: 16, y: 0, direction: 'top', description: 'Funk / Bus / Alarmierung' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="18" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="16" y="22" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">R</text>
    `,
    description: 'Optischer Rauchwarnmelder nach DIN EN 14604 / DIN 14676'
  },
  {
    id: 'inst_thermostat',
    name: 'Raumthermostat (Heizung/Klima)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-B',
    defaultFunctionText: 'Thermostat',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N', x: 16, y: 0, direction: 'top', description: 'Versorgung / Stellantrieb' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <rect x="7" y="8" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <text x="16" y="21" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">T</text>
    `,
    description: 'Elektronischer Raumtemperaturregler nach DIN EN 60617-11'
  },
  {
    id: 'inst_data_socket',
    name: 'RJ45-Datendose (Netzwerk)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Netzwerkdose',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'Cat', x: 16, y: 0, direction: 'top', description: 'Datenkabel Cat.6/7' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <polygon points="16,8 6,24 26,24" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="16" x2="16" y2="24" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Telekommunikations- & Datendose (RJ45 Cat.6/Cat.7)'
  },
  {
    id: 'inst_shutter_switch',
    name: 'Jalousieschalter / Rollladentaster',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Jalousieschalter',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L', x: 16, y: 0, direction: 'top', description: 'Versorgung / Motor' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="18" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
      <polygon points="16,11 12,16 20,16" fill="currentColor"/>
      <polygon points="16,25 12,20 20,20" fill="currentColor"/>
    `,
    description: 'Jalousietaster / Rollladenschalter mit Richtungspfeilen Auf/Ab'
  },
  {
    id: 'inst_motion_detector',
    name: 'Bewegungsmelder (PIR)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-B',
    defaultFunctionText: 'Bewegungsmelder',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N', x: 16, y: 0, direction: 'top', description: 'Spannungsversorgung & Schaltausgang' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="18" r="9" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M 11 22 A 6 6 0 0 1 21 22" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M 8 24 A 10 10 0 0 1 24 24" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="16" cy="15" r="2.5" fill="currentColor"/>
    `,
    description: 'Infrarot-Bewegungs- oder Präsenzmelder (PIR) nach DIN EN 60617-11'
  }
];
