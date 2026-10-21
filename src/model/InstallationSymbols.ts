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
  },
  {
    id: 'inst_socket_quad',
    name: 'Schuko-Steckdose (4-fach)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Vierfachsteckdose',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N/PE', x: 16, y: 0, direction: 'top', description: 'Zuleitung 4-fach Steckdose' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 22 A 10 10 0 0 1 26 22 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="10" x2="10" y2="22" stroke="currentColor" stroke-width="1.8"/>
      <line x1="14" y1="10" x2="14" y2="22" stroke="currentColor" stroke-width="1.8"/>
      <line x1="18" y1="10" x2="18" y2="22" stroke="currentColor" stroke-width="1.8"/>
      <line x1="22" y1="10" x2="22" y2="22" stroke="currentColor" stroke-width="1.8"/>
    `,
    description: 'Schutzkontakt-Steckdose 4-fach, Unterputz (DIN EN 60617-11)'
  },
  {
    id: 'inst_socket_switched',
    name: 'Steckdose schaltbar',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Schaltbare Steckdose',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N/PE', x: 16, y: 0, direction: 'top', description: 'Zuleitung schaltbare Steckdose' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 22 A 10 10 0 0 1 26 22 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="10" x2="16" y2="22" stroke="currentColor" stroke-width="2"/>
      <!-- Schalterfahne oben links -->
      <line x1="16" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="2"/>
      <circle cx="10" cy="6" r="1.5" fill="currentColor"/>
    `,
    description: 'Schaltbare Schutzkontakt-Steckdose (DIN EN 60617-11)'
  },
  {
    id: 'inst_socket_usb',
    name: 'Schuko-Steckdose mit USB-Ladeport',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Steckdose mit USB',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N/PE', x: 16, y: 0, direction: 'top', description: 'Zuleitung Steckdose USB' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 22 A 10 10 0 0 1 26 22 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="10" x2="16" y2="22" stroke="currentColor" stroke-width="2"/>
      <rect x="23" y="11" width="7" height="4" fill="none" stroke="currentColor" stroke-width="1.2" rx="1"/>
    `,
    description: 'Schutzkontakt-Steckdose mit integriertem USB-A/C Ladeport'
  },
  {
    id: 'inst_dimmer',
    name: 'Drehdimmer / Tastdimmer',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Dimmer',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L', x: 16, y: 0, direction: 'top', description: 'Dimmeranschluss' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="18" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="24" x2="22" y2="12" stroke="currentColor" stroke-width="1.8"/>
      <polygon points="23,10 18,12 21,15" fill="currentColor"/>
    `,
    description: 'Elektronischer Drehdimmer oder Tastdimmer für Beleuchtung'
  },
  {
    id: 'inst_combo_switch_socket',
    name: 'Kombination Schalter + Steckdose',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Schalter-Steckdose',
    width: 32,
    height: 48,
    pins: [
      { id: '1', name: 'L', x: 16, y: 0, direction: 'top', description: 'Zuleitung Lichtschalter' },
      { id: '2', name: 'N/PE', x: 16, y: 48, direction: 'bottom', description: 'Zuleitung Steckdose' }
    ],
    svgContent: `
      <!-- Rahmenblock vertikal -->
      <rect x="5" y="4" width="22" height="40" fill="none" stroke="currentColor" stroke-width="1.2" rx="2" stroke-dasharray="2,2"/>
      <!-- Oben: Schalter -->
      <circle cx="16" cy="15" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <line x1="16" y1="0" x2="16" y2="9" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="9" x2="22" y2="9" stroke="currentColor" stroke-width="1.8"/>
      <!-- Unten: Steckdose -->
      <path d="M 9 36 A 7 7 0 0 1 23 36 Z" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <line x1="16" y1="36" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Vertikale 2-fach Kombination: Schalter oben, Steckdose unten'
  },
  {
    id: 'inst_combo_switch_thermostat',
    name: 'Kombination Schalter + Thermostat (RTR)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Schalter-Thermostat',
    width: 32,
    height: 48,
    pins: [
      { id: '1', name: 'L', x: 16, y: 0, direction: 'top', description: 'Zuleitung Schalter' },
      { id: '2', name: 'BUS/L', x: 16, y: 48, direction: 'bottom', description: 'Anschluss Thermostat' }
    ],
    svgContent: `
      <rect x="5" y="4" width="22" height="40" fill="none" stroke="currentColor" stroke-width="1.2" rx="2" stroke-dasharray="2,2"/>
      <!-- Oben: Schalter -->
      <circle cx="16" cy="15" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <line x1="16" y1="0" x2="16" y2="9" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="9" x2="22" y2="9" stroke="currentColor" stroke-width="1.8"/>
      <!-- Unten: Thermostat -->
      <rect x="10" y="27" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" rx="1.5"/>
      <text x="16" y="36.5" font-size="8.5" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">T</text>
      <line x1="16" y1="39" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Vertikale 2-fach Kombination: Lichtschalter + Raumthermostat'
  },
  {
    id: 'inst_combo_socket_data',
    name: 'Kombination Steckdose + RJ45 Netzwerk',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Steckdose-Netzwerk',
    width: 32,
    height: 48,
    pins: [
      { id: '1', name: 'L/N/PE', x: 16, y: 0, direction: 'top', description: 'Zuleitung Steckdose' },
      { id: '2', name: 'Cat', x: 16, y: 48, direction: 'bottom', description: 'Zuleitung Datenkabel' }
    ],
    svgContent: `
      <rect x="5" y="4" width="22" height="40" fill="none" stroke="currentColor" stroke-width="1.2" rx="2" stroke-dasharray="2,2"/>
      <!-- Oben: Steckdose -->
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <path d="M 9 18 A 7 7 0 0 1 23 18 Z" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <line x1="16" y1="8" x2="16" y2="18" stroke="currentColor" stroke-width="1.8"/>
      <!-- Unten: RJ45 Datendose -->
      <polygon points="16,26 9,38 23,38" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <line x1="16" y1="32" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Vertikale 2-fach Kombination: Schuko-Steckdose + RJ45 Netzwerkdose'
  },
  {
    id: 'inst_combo_quad_wall',
    name: 'Wandkombination (Schalter/RTR/Steckdose/Netzwerk)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Kombination 4-fach',
    width: 32,
    height: 64,
    pins: [
      { id: '1', name: 'L', x: 16, y: 0, direction: 'top', description: 'Zuleitung Schalter/RTR' },
      { id: '2', name: 'Cat/N', x: 16, y: 64, direction: 'bottom', description: 'Zuleitung Steckdose/Netzwerk' }
    ],
    svgContent: `
      <rect x="4" y="4" width="24" height="56" fill="none" stroke="currentColor" stroke-width="1.2" rx="2" stroke-dasharray="2,2"/>
      <!-- 1: Schalter -->
      <circle cx="16" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="16" y1="0" x2="16" y2="7.5" stroke="currentColor" stroke-width="2"/>
      <!-- 2: Thermostat -->
      <rect x="11" y="21" width="10" height="9" fill="none" stroke="currentColor" stroke-width="1.5" rx="1"/>
      <text x="16" y="28" font-size="7" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">T</text>
      <!-- 3: Steckdose -->
      <path d="M 11 41 A 5 5 0 0 1 21 41 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- 4: Netzwerk -->
      <polygon points="16,47 11,55 21,55" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="16" y1="55" x2="16" y2="64" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Vertikale 4-fach Mehrfachrahmenkombination: Schalter, RTR, Steckdose, RJ45'
  },
  {
    id: 'inst_appliance_had',
    name: 'Herdanschlussdose (HAD / Elektroherd 400V)',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Herdanschluss HAD',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: '3L/N/PE', x: 16, y: 0, direction: 'top', description: 'Kraftstrom 400V 3x16A' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <rect x="6" y="8" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="18" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <text x="16" y="21.5" font-size="7.5" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">HAD</text>
    `,
    description: 'Herdanschlussdose HAD für Elektroherd / Kochfeld (3~ 400V, DIN 18015)'
  },
  {
    id: 'inst_appliance_cooktop',
    name: 'Kochfeld autark (Induktion/Ceran)',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-E',
    defaultFunctionText: 'Kochfeld',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: '2L/N/PE', x: 16, y: 0, direction: 'top', description: 'Zuleitung autarkes Kochfeld' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="7" stroke="currentColor" stroke-width="2"/>
      <rect x="5" y="7" width="22" height="20" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <circle cx="11" cy="13" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="21" cy="13" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="11" cy="21" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="21" cy="21" r="3.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Autarkes Glaskeramik- oder Induktionskochfeld nach RAL-RG 678'
  },
  {
    id: 'inst_appliance_oven',
    name: 'Backofen autark (230V separat)',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-E',
    defaultFunctionText: 'Backofen',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N/PE', x: 16, y: 0, direction: 'top', description: 'Separater Stromkreis Backofen 16A' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <rect x="6" y="8" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <rect x="9" y="11" width="14" height="10" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <line x1="9" y1="16" x2="23" y2="16" stroke="currentColor" stroke-width="1"/>
      <circle cx="10" cy="24" r="1.2" fill="currentColor"/>
      <circle cx="14" cy="24" r="1.2" fill="currentColor"/>
    `,
    description: 'Autarker Einbaubackofen (separater Stromkreis 230V 16A)'
  },
  {
    id: 'inst_appliance_dishwasher',
    name: 'Geschirrspüler (GS)',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Geschirrspüler GS',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N/PE', x: 16, y: 0, direction: 'top', description: 'Separater Stromkreis Geschirrspüler' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <rect x="6" y="8" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <text x="16" y="21" font-size="10" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">GS</text>
      <line x1="10" y1="24" x2="22" y2="24" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2,2"/>
    `,
    description: 'Geschirrspüler mit eigenem Stromkreis nach RAL-RG 678'
  },
  {
    id: 'inst_appliance_fridge',
    name: 'Kühlschrank / Kühl-Gefrierkombi (*** *)',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Kühlschrank',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N/PE', x: 16, y: 0, direction: 'top', description: 'Zuleitung Kühlschrank' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <rect x="6" y="8" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <line x1="6" y1="15" x2="26" y2="15" stroke="currentColor" stroke-width="1.5"/>
      <text x="16" y="14" font-size="7" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">***</text>
      <text x="16" y="24" font-size="8.5" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">KS</text>
    `,
    description: 'Kühlschrank oder Gefrierkombination (Sternefach) nach RAL-RG 678'
  },
  {
    id: 'inst_appliance_hood',
    name: 'Dunstabzugshaube (DA)',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Dunstabzug DA',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N/PE', x: 16, y: 0, direction: 'top', description: 'Zuleitung Dunstabzugshaube' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <polygon points="16,8 9,16 6,24 26,24 23,16" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="16" y="22" font-size="8" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">DA</text>
    `,
    description: 'Dunstabzugshaube / Ablufthaube (RAL-RG 678)'
  },
  {
    id: 'inst_appliance_microwave',
    name: 'Mikrowellengerät (MW)',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Mikrowelle MW',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N/PE', x: 16, y: 0, direction: 'top', description: 'Zuleitung Mikrowelle' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <rect x="6" y="8" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <text x="16" y="21" font-size="9" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">MW</text>
    `,
    description: 'Mikrowellengerät nach RAL-RG 678'
  },
  {
    id: 'inst_appliance_water_heater',
    name: 'Warmwasserbereiter / Durchlauferhitzer (WW)',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-E',
    defaultFunctionText: 'Warmwasser WW',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: '3L/N/PE', x: 16, y: 0, direction: 'top', description: 'Kraftstrom 400V Durchlauferhitzer' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="18" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M 10 15 Q 13 13 16 15 T 22 15" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <text x="16" y="24" font-size="8" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">WW</text>
    `,
    description: 'Warmwasserbereiter, Boiler oder Durchlauferhitzer (WW / DLE)'
  },
  {
    id: 'inst_appliance_washing_machine',
    name: 'Waschmaschine (WM)',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Waschmaschine WM',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N/PE', x: 16, y: 0, direction: 'top', description: 'Separater Stromkreis Waschmaschine' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <rect x="6" y="8" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <circle cx="16" cy="18" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <text x="16" y="21" font-size="8" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">WM</text>
    `,
    description: 'Waschmaschine mit separatem Stromkreis (DIN 18015 / RAL-RG 678)'
  },
  {
    id: 'inst_appliance_dryer',
    name: 'Wäschetrockner (WT)',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Wäschetrockner WT',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'L/N/PE', x: 16, y: 0, direction: 'top', description: 'Separater Stromkreis Wäschetrockner' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <rect x="6" y="8" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <circle cx="16" cy="18" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <text x="16" y="21" font-size="8" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">WT</text>
    `,
    description: 'Wäschetrockner mit separatem Stromkreis (RAL-RG 678)'
  },
  {
    id: 'inst_data_socket_double',
    name: 'RJ45-Datendose (2-fach)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Doppel-Netzwerkdose',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: '2xCat', x: 16, y: 0, direction: 'top', description: 'Datenkabel 2x Cat.7/8' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <polygon points="16,8 6,24 26,24" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="13" y1="16" x2="13" y2="24" stroke="currentColor" stroke-width="1.5"/>
      <line x1="19" y1="16" x2="19" y2="24" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Doppelte RJ45 Ethernet-Datendose (2x Cat.6a/Cat.7)'
  },
  {
    id: 'inst_antenna_tv',
    name: 'Antennendose (Radio / TV / SAT)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Antennendose TV',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'KOAX', x: 16, y: 0, direction: 'top', description: 'Koaxialkabel Breitband/SAT' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <polygon points="16,10 8,24 24,24" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="10" x2="16" y2="24" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="17" x2="20" y2="17" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Breitbandkabel- & Satelliten-Antennendose (Radio/TV/SAT)'
  },
  {
    id: 'inst_phone',
    name: 'Telefonanschlussdose (TAE)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Telefondose TAE',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'J-Y(St)Y', x: 16, y: 0, direction: 'top', description: 'Telefonkabel' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <rect x="6" y="8" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="16" y="22" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">T</text>
    `,
    description: 'Telekommunikations-Anschlussdose (TAE / IAE) nach DIN EN 60617-11'
  },
  {
    id: 'inst_intercom',
    name: 'Gegensprechanlage / Videosprechstelle',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-U',
    defaultFunctionText: 'Sprechanlage',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'BUS', x: 16, y: 0, direction: 'top', description: 'Sprechanlagen-Bus' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <rect x="6" y="8" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" rx="3"/>
      <!-- Telefonhörer / Display -->
      <path d="M 11 13 A 3 3 0 0 1 21 13 L 21 15 L 18 15 L 18 18 L 21 18 L 21 21 A 2 2 0 0 1 19 23 L 13 23 A 2 2 0 0 1 11 21 Z" fill="none" stroke="currentColor" stroke-width="1.4"/>
    `,
    description: 'Wohnungs-Sprechanlage oder Videosprechstelle (DIN EN 60617-11)'
  },
  {
    id: 'inst_chime',
    name: 'Türgong / Klingel',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-H',
    defaultFunctionText: 'Gong',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: '8-12V', x: 16, y: 0, direction: 'top', description: 'Klingeltrafo' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <path d="M 8 22 A 8 8 0 0 1 24 22 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="22" x2="16" y2="25" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="26" r="2" fill="currentColor"/>
    `,
    description: 'Akustischer Signalgeber / Türklingel / Gong (DIN EN 60617-11)'
  },
  {
    id: 'inst_equipotential',
    name: 'Potenzialausgleichsschiene (PAS)',
    category: 'installation',
    standard: 'DIN EN 60617-11 / DIN 18014',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'PAS',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'PE', x: 16, y: 0, direction: 'top', description: 'Haupterdungsschiene' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="12" x2="26" y2="12" stroke="currentColor" stroke-width="3"/>
      <line x1="9" y1="17" x2="23" y2="17" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="22" x2="20" y2="22" stroke="currentColor" stroke-width="1.5"/>
      <line x1="15" y1="26" x2="17" y2="26" stroke="currentColor" stroke-width="1.2"/>
    `,
    description: 'Hauptpotenzialausgleichsschiene (PAS / HES nach DIN 18014)'
  },
  {
    id: 'knx_pushbutton_2f',
    name: 'KNX Tastsensor 2-fach',
    category: 'installation',
    standard: 'KNX / DIN EN 60617-11',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'KNX Tastsensor 2f',
    width: 32,
    height: 32,
    pins: [
      { id: 'BUS', name: 'KNX', x: 16, y: 0, direction: 'top', description: 'KNX TP Busanschluss (+/-)' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="6" stroke="currentColor" stroke-width="2"/>
      <rect x="5" y="6" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <!-- Wippenteilung vertikal -->
      <line x1="16" y1="6" x2="16" y2="28" stroke="currentColor" stroke-width="1.2"/>
      <!-- Status-LEDs -->
      <circle cx="9" cy="10" r="1.5" fill="#48bb78"/>
      <circle cx="23" cy="10" r="1.5" fill="#48bb78"/>
      <text x="16" y="24" font-size="6" font-family="monospace" font-weight="bold" text-anchor="middle" fill="#63b3ed">KNX</text>
    `,
    description: 'KNX 2-fach Tastsensor mit 2 Wippen und RGB-Statusanzeige'
  },
  {
    id: 'knx_pushbutton_4f',
    name: 'KNX Tastsensor 4-fach',
    category: 'installation',
    standard: 'KNX / DIN EN 60617-11',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'KNX Tastsensor 4f',
    width: 32,
    height: 32,
    pins: [
      { id: 'BUS', name: 'KNX', x: 16, y: 0, direction: 'top', description: 'KNX TP Busanschluss (+/-)' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="6" stroke="currentColor" stroke-width="2"/>
      <rect x="5" y="6" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <!-- 4 Quadranten -->
      <line x1="16" y1="6" x2="16" y2="28" stroke="currentColor" stroke-width="1.2"/>
      <line x1="5" y1="17" x2="27" y2="17" stroke="currentColor" stroke-width="1.2"/>
      <circle cx="9" cy="9.5" r="1.2" fill="#48bb78"/>
      <circle cx="23" cy="9.5" r="1.2" fill="#48bb78"/>
      <circle cx="9" cy="24.5" r="1.2" fill="#48bb78"/>
      <circle cx="23" cy="24.5" r="1.2" fill="#48bb78"/>
    `,
    description: 'KNX 4-fach Tastsensor mit 4 Tastenfeldern und Status-LEDs'
  },
  {
    id: 'knx_presence_detector',
    name: 'KNX Präsenzmelder (Deckenmontage)',
    category: 'installation',
    standard: 'KNX / DIN EN 60617-11',
    defaultBmkPrefix: '-B',
    defaultFunctionText: 'KNX Präsenzmelder',
    width: 32,
    height: 32,
    pins: [
      { id: 'BUS', name: 'KNX', x: 16, y: 0, direction: 'top', description: 'KNX TP Busanschluss' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="6" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="17" r="11" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="17" r="6" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <line x1="16" y1="6" x2="16" y2="28" stroke="currentColor" stroke-width="1" stroke-dasharray="2,2"/>
      <line x1="5" y1="17" x2="27" y2="17" stroke="currentColor" stroke-width="1" stroke-dasharray="2,2"/>
      <circle cx="16" cy="17" r="2.5" fill="#48bb78"/>
    `,
    description: 'KNX Decken-Präsenzmelder mit 360° Erfassungsbereich und Lichtsensor'
  },
  {
    id: 'knx_rtr',
    name: 'KNX Raumtemperaturregler (RTR mit Display)',
    category: 'installation',
    standard: 'KNX / DIN EN 60617-11',
    defaultBmkPrefix: '-B',
    defaultFunctionText: 'KNX RTR',
    width: 32,
    height: 32,
    pins: [
      { id: 'BUS', name: 'KNX', x: 16, y: 0, direction: 'top', description: 'KNX TP Busleitung' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="6" stroke="currentColor" stroke-width="2"/>
      <rect x="5" y="6" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <!-- Displaybereich -->
      <rect x="8" y="9" width="16" height="9" fill="rgba(99, 179, 237, 0.2)" stroke="currentColor" stroke-width="1" rx="1"/>
      <text x="16" y="15.5" font-size="6" font-family="monospace" font-weight="bold" text-anchor="middle" fill="#63b3ed">21.5°</text>
      <!-- Tasten +/- -->
      <circle cx="10" cy="23" r="2" fill="none" stroke="currentColor" stroke-width="1"/>
      <circle cx="22" cy="23" r="2" fill="none" stroke="currentColor" stroke-width="1"/>
      <text x="10" y="24.5" font-size="5" text-anchor="middle" fill="currentColor">-</text>
      <text x="22" y="24.5" font-size="5" text-anchor="middle" fill="currentColor">+</text>
    `,
    description: 'KNX Raumtemperaturregler mit LCD-Anzeige und integriertem Busankoppler'
  },
  {
    id: 'knx_touch_panel',
    name: 'KNX Smart Touch Panel (Wanddisplay)',
    category: 'installation',
    standard: 'KNX / DIN EN 60617-11',
    defaultBmkPrefix: '-U',
    defaultFunctionText: 'KNX Touchpanel',
    width: 32,
    height: 32,
    pins: [
      { id: 'BUS', name: 'KNX/24V', x: 16, y: 0, direction: 'top', description: 'KNX Bus & 24V Hilfsspannung' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="6" stroke="currentColor" stroke-width="2"/>
      <rect x="4" y="6" width="24" height="20" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <rect x="7" y="9" width="18" height="14" fill="rgba(66, 153, 225, 0.2)" stroke="currentColor" stroke-width="1"/>
      <circle cx="16" cy="16" r="3" fill="none" stroke="#63b3ed" stroke-width="1.2"/>
    `,
    description: 'KNX Touchpanel (5" / 7" Raumcontroller zur zentralen Gebäudesteuerung)'
  },
  {
    id: 'knx_bus_outlet',
    name: 'KNX Busauslass (Wandauslass grün)',
    category: 'installation',
    standard: 'KNX / DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'KNX Busauslass',
    width: 32,
    height: 32,
    pins: [
      { id: 'BUS', name: 'KNX', x: 16, y: 0, direction: 'top', description: 'KNX TP Busleitung' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="18" r="9" fill="none" stroke="#48bb78" stroke-width="2"/>
      <polygon points="16,11 11,18 16,25 21,18" fill="none" stroke="#48bb78" stroke-width="1.5"/>
      <text x="16" y="20" font-size="5.5" font-family="monospace" font-weight="bold" text-anchor="middle" fill="#48bb78">KNX</text>
    `,
    description: 'KNX Busauslass / Unterputzdose für grüne Busleitung (J-Y(St)Y 2x2x0.8)'
  },
  {
    id: 'knx_reed_contact',
    name: 'KNX Fensterkontakt (Magnet/Binäreingang)',
    category: 'installation',
    standard: 'KNX / DIN EN 60617-11',
    defaultBmkPrefix: '-B',
    defaultFunctionText: 'Fensterkontakt',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'IN', x: 16, y: 0, direction: 'top', description: 'Binäreingang / Sensorleitung' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="9" stroke="currentColor" stroke-width="2"/>
      <rect x="6" y="9" width="20" height="14" fill="none" stroke="currentColor" stroke-width="1.8" rx="2"/>
      <line x1="10" y1="16" x2="14" y2="16" stroke="currentColor" stroke-width="1.5"/>
      <line x1="14" y1="16" x2="20" y2="12" stroke="currentColor" stroke-width="1.5"/>
      <line x1="20" y1="16" x2="22" y2="16" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="14" cy="16" r="1.2" fill="currentColor"/>
      <circle cx="20" cy="16" r="1.2" fill="currentColor"/>
    `,
    description: 'Magnetischer Reed-Fensterkontakt für KNX Heizungsabsenkung & Alarmierung'
  }
];
