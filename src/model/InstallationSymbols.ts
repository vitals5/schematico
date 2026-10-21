// src/model/InstallationSymbols.ts
// Standard architectural electrical installation symbols according to DIN EN 60617-11 / DIN 18015 / RAL-RG 678

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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <!-- Halbkreis mit Basis an Wand nach DIN EN 60617-11 / RAL-RG 678 -->
      <line x1="6" y1="0" x2="26" y2="0" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 0 A 10 10 0 0 0 26 0" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Schutzkontakt-Steckdose 1-fach, Unterputz (DIN EN 60617-11)'
  },
  {
    id: 'inst_socket_multi',
    name: 'Mehrfachsteckdose (2-fach)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Mehrfachsteckdose',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <line x1="6" y1="0" x2="26" y2="0" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 0 A 10 10 0 0 0 26 0" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <text x="24" y="9" font-size="8.5" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-weight="bold" fill="currentColor">2</text>
    `,
    description: 'Mehrfachsteckdose nach DIN EN 60617-11'
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <line x1="6" y1="0" x2="26" y2="0" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 0 A 10 10 0 0 0 26 0" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="13" y1="0" x2="13" y2="9.5" stroke="currentColor" stroke-width="2"/>
      <line x1="19" y1="0" x2="19" y2="9.5" stroke="currentColor" stroke-width="2"/>
      <text x="28" y="10" font-size="7.5" font-family="sans-serif" font-weight="bold" fill="currentColor">2</text>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <line x1="6" y1="0" x2="26" y2="0" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 0 A 10 10 0 0 0 26 0" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="11" y1="0" x2="11" y2="8.5" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="21" y1="0" x2="21" y2="8.5" stroke="currentColor" stroke-width="2"/>
      <text x="28" y="10" font-size="7.5" font-family="sans-serif" font-weight="bold" fill="currentColor">3</text>
    `,
    description: 'Schutzkontakt-Steckdose 3-fach, Unterputz (DIN EN 60617-11)'
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <line x1="6" y1="0" x2="26" y2="0" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 0 A 10 10 0 0 0 26 0" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="0" x2="10" y2="8" stroke="currentColor" stroke-width="1.8"/>
      <line x1="14" y1="0" x2="14" y2="9.8" stroke="currentColor" stroke-width="1.8"/>
      <line x1="18" y1="0" x2="18" y2="9.8" stroke="currentColor" stroke-width="1.8"/>
      <line x1="22" y1="0" x2="22" y2="8" stroke="currentColor" stroke-width="1.8"/>
      <text x="28" y="10" font-size="7.5" font-family="sans-serif" font-weight="bold" fill="currentColor">4</text>
    `,
    description: 'Schutzkontakt-Steckdose 4-fach, Unterputz (DIN EN 60617-11)'
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <line x1="6" y1="0" x2="26" y2="0" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 0 A 10 10 0 0 0 26 0 Z" fill="currentColor" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="0" x2="16" y2="10" stroke="#181b22" stroke-width="2"/>
    `,
    description: 'Feuchtraum-Steckdose IP44 mit Klappdeckel (DIN EN 60617-11)'
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <line x1="6" y1="0" x2="26" y2="0" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 0 A 10 10 0 0 0 26 0" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="0" x2="2" y2="6" stroke="currentColor" stroke-width="2"/>
      <circle cx="2" cy="6" r="1.5" fill="currentColor"/>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <line x1="6" y1="0" x2="26" y2="0" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 0 A 10 10 0 0 0 26 0" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <rect x="23" y="2" width="7" height="4" fill="none" stroke="currentColor" stroke-width="1.2" rx="1"/>
    `,
    description: 'Schutzkontakt-Steckdose mit integriertem USB-A/C Ladeport'
  },
  {
    id: 'inst_socket_single_alt',
    name: 'Einfachsteckdose (Wandanschluss)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Steckdose',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <!-- Wandanschluss-Stift oben, Basis und Bogen nach unten -->
      <line x1="16" y1="0" x2="16" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="12" x2="26" y2="12" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 12 A 10 10 0 0 0 26 12" fill="none" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Einfachsteckdose mit Wandanschluss-Stift oben (DIN 18015 / DIN EN 60617-11)'
  },
  {
    id: 'inst_socket_multi_2',
    name: 'Mehrfachsteckdose 2-fach',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Mehrfachsteckdose 2-fach',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="12" x2="26" y2="12" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 12 A 10 10 0 0 0 26 12" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="19" y1="16" x2="24" y2="23" stroke="currentColor" stroke-width="1.8"/>
      <text x="24.5" y="19.5" font-size="8.5" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-weight="bold" fill="currentColor">2</text>
    `,
    description: 'Mehrfachsteckdose 2-fach mit Schrägstrich und Kennzahl 2 (DIN 18015)'
  },
  {
    id: 'inst_socket_multi_3',
    name: 'Mehrfachsteckdose 3-fach',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Mehrfachsteckdose 3-fach',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="12" x2="26" y2="12" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 12 A 10 10 0 0 0 26 12" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="19" y1="16" x2="24" y2="23" stroke="currentColor" stroke-width="1.8"/>
      <text x="24.5" y="19.5" font-size="8.5" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-weight="bold" fill="currentColor">3</text>
    `,
    description: 'Mehrfachsteckdose 3-fach mit Schrägstrich und Kennzahl 3 (DIN 18015)'
  },
  {
    id: 'inst_socket_multi_4',
    name: 'Mehrfachsteckdose 4-fach',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Mehrfachsteckdose 4-fach',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="12" x2="26" y2="12" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 12 A 10 10 0 0 0 26 12" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="19" y1="16" x2="24" y2="23" stroke="currentColor" stroke-width="1.8"/>
      <text x="24.5" y="19.5" font-size="8.5" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-weight="bold" fill="currentColor">4</text>
    `,
    description: 'Mehrfachsteckdose 4-fach mit Schrägstrich und Kennzahl 4 (DIN 18015)'
  },
  {
    id: 'inst_socket_multi_5',
    name: 'Mehrfachsteckdose 5-fach',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Mehrfachsteckdose 5-fach',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="12" x2="26" y2="12" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 12 A 10 10 0 0 0 26 12" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="19" y1="16" x2="24" y2="23" stroke="currentColor" stroke-width="1.8"/>
      <text x="24.5" y="19.5" font-size="8.5" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-weight="bold" fill="currentColor">5</text>
    `,
    description: 'Mehrfachsteckdose 5-fach mit Schrägstrich und Kennzahl 5 (DIN 18015)'
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <circle cx="16" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="3" x2="24" y2="3" stroke="currentColor" stroke-width="2"/>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <circle cx="16" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="3" x2="24" y2="3" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="3" x2="8" y2="3" stroke="currentColor" stroke-width="2"/>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <circle cx="16" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="3" x2="24" y2="3" stroke="currentColor" stroke-width="2"/>
      <line x1="18" y1="6" x2="26" y2="6" stroke="currentColor" stroke-width="2"/>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <circle cx="16" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="3" x2="24" y2="3" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="3" x2="8" y2="3" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="17" x2="24" y2="17" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Kreuzschalter für 3 oder mehr Schaltstellen (DIN EN 60617-11)'
  },
  {
    id: 'inst_switch_off_alt',
    name: 'Schalter (1-polig, Hebel)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Schalter',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <!-- Kreis mit 45°-Hebel und Haken nach DIN EN 60617-11 -->
      <circle cx="16" cy="18" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="20.2" y1="13.8" x2="28" y2="6" stroke="currentColor" stroke-width="2"/>
      <line x1="28" y1="6" x2="31" y2="9" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Schalter (1-polig Ausschalter) mit schrägem Betätigungshebel und Haken (DIN EN 60617-11)'
  },
  {
    id: 'inst_switch_changeover_alt',
    name: 'Wechselschalter (2 Hebel)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Wechselschalter',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <circle cx="16" cy="16" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="19.9" y1="12.1" x2="27" y2="5" stroke="currentColor" stroke-width="2"/>
      <line x1="27" y1="5" x2="30" y2="8" stroke="currentColor" stroke-width="2"/>
      <line x1="12.1" y1="19.9" x2="5" y2="27" stroke="currentColor" stroke-width="2"/>
      <line x1="5" y1="27" x2="2" y2="24" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Wechselschalter mit zwei gegenüberliegenden Hebeln und Haken (DIN EN 60617-11)'
  },
  {
    id: 'inst_switch_cross_alt',
    name: 'Kreuzschalter (4 Hebel)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Kreuzschalter',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <circle cx="16" cy="16" r="5" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="19.5" y1="12.5" x2="26" y2="6" stroke="currentColor" stroke-width="2"/>
      <line x1="26" y1="6" x2="29" y2="9" stroke="currentColor" stroke-width="2"/>
      <line x1="12.5" y1="12.5" x2="6" y2="6" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="6" x2="3" y2="9" stroke="currentColor" stroke-width="2"/>
      <line x1="12.5" y1="19.5" x2="6" y2="26" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="26" x2="3" y2="23" stroke="currentColor" stroke-width="2"/>
      <line x1="19.5" y1="19.5" x2="26" y2="26" stroke="currentColor" stroke-width="2"/>
      <line x1="26" y1="26" x2="29" y2="23" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Kreuzschalter mit vier kreuzförmigen Hebeln und Haken (DIN EN 60617-11)'
  },
  {
    id: 'inst_switch_series_alt',
    name: 'Serienschalter (Doppelhebel)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Serienschalter',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <circle cx="16" cy="20" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="12.1" y1="16.1" x2="6" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="10" x2="3" y2="13" stroke="currentColor" stroke-width="2"/>
      <line x1="19.9" y1="16.1" x2="26" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="26" y1="10" x2="29" y2="13" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Serienschalter mit zwei oberen Hebeln und Haken (DIN EN 60617-11)'
  },
  {
    id: 'inst_pushbutton',
    name: 'Lichttaster',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Lichttaster',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <circle cx="16" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="10" r="2.5" fill="currentColor"/>
    `,
    description: 'Taster mit Schließerkontakt für Stromstoßschaltung'
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <circle cx="16" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="11" y1="15" x2="21" y2="5" stroke="currentColor" stroke-width="1.8"/>
      <polygon points="22,3 17,5 20,8" fill="currentColor"/>
    `,
    description: 'Elektronischer Drehdimmer oder Tastdimmer für Beleuchtung'
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <circle cx="16" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
      <polygon points="16,5 13,8 19,8" fill="currentColor"/>
      <polygon points="16,15 13,12 19,12" fill="currentColor"/>
    `,
    description: 'Jalousietaster / Rollladenschalter mit Richtungspfeilen Auf/Ab'
  },
  {
    id: 'inst_lamp_ceiling',
    name: 'Deckenleuchte (Lichtauslass X)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-E',
    defaultFunctionText: 'Deckenleuchte',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 16 },
    pins: [],
    svgContent: `
      <line x1="6" y1="6" x2="26" y2="26" stroke="currentColor" stroke-width="2.5"/>
      <line x1="26" y1="6" x2="6" y2="26" stroke="currentColor" stroke-width="2.5"/>
    `,
    description: 'Allgemeiner Decken-Lichtauslass nach DIN EN 60617-11'
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <line x1="6" y1="0" x2="26" y2="0" stroke="currentColor" stroke-width="2.5"/>
      <line x1="16" y1="0" x2="16" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="11" y1="12" x2="21" y2="22" stroke="currentColor" stroke-width="2"/>
      <line x1="21" y1="12" x2="11" y2="22" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Wandmontierte Leuchte / Wandauslass nach DIN EN 60617-11'
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
    insertionPoint: { x: 16, y: 16 },
    pins: [],
    svgContent: `
      <circle cx="16" cy="16" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="10" x2="22" y2="22" stroke="currentColor" stroke-width="1.8"/>
      <line x1="22" y1="10" x2="10" y2="22" stroke="currentColor" stroke-width="1.8"/>
    `,
    description: 'Deckeneinbaustrahler / Spot / Downlight'
  },
  {
    id: 'inst_subdistribution',
    name: 'Unterverteiler (UV / Verteilerkasten)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '=HV+',
    defaultFunctionText: 'Unterverteilung',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="4" y="0" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="4" y1="0" x2="28" y2="24" stroke="currentColor" stroke-width="1.8"/>
      <polygon points="4,0 28,0 28,24" fill="currentColor"/>
    `,
    description: 'Elektrische Unterverteilung / Stromkreisverteiler nach DIN EN 60617-11'
  },
  {
    id: 'inst_smoke_detector',
    name: 'Rauchwarnmelder',
    category: 'installation',
    standard: 'DIN EN 14604',
    defaultBmkPrefix: '-B',
    defaultFunctionText: 'Rauchmelder',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 16 },
    pins: [],
    svgContent: `
      <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="16" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
    `,
    description: 'Optischer Rauchwarnmelder nach DIN EN 14604 / DIN 14676'
  },
  {
    id: 'inst_thermostat',
    name: 'Raumthermostat (Heizung / RTR)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-B',
    defaultFunctionText: 'Raumthermostat',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="6" y="0" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <text x="16" y="14" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">T</text>
    `,
    description: 'Elektronischer Raumtemperaturregler nach DIN EN 60617-11'
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <circle cx="16" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M 11 14 A 6 6 0 0 1 21 14" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M 8 16 A 10 10 0 0 1 24 16" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="16" cy="7" r="2.5" fill="currentColor"/>
    `,
    description: 'Infrarot-Bewegungs- oder Präsenzmelder (PIR) nach DIN EN 60617-11'
  },
  {
    id: 'inst_telecom_outlet',
    name: 'Telekommunikation (Anschluss)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Telekommunikation',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <line x1="6" y1="0" x2="26" y2="0" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <path d="M 9 18 L 9 8 L 23 8 L 23 18" fill="none" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Telekommunikations-Anschluss nach DIN EN 60617-11'
  },
  {
    id: 'inst_antenna_outlet',
    name: 'Antennenanschluss / Antenne',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Antenne',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <line x1="6" y1="0" x2="26" y2="0" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <path d="M 9 18 L 9 8 L 23 8 L 23 18" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="3" x2="22" y2="3" stroke="currentColor" stroke-width="2"/>
      <line x1="11" y1="3" x2="11" y2="6.5" stroke="currentColor" stroke-width="1.5"/>
      <line x1="16" y1="3" x2="16" y2="6.5" stroke="currentColor" stroke-width="1.5"/>
      <line x1="21" y1="3" x2="21" y2="6.5" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Antennenanschluss nach DIN EN 60617-11'
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <polygon points="16,0 6,18 26,18" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="8" x2="16" y2="18" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Telekommunikations- & Datendose (RJ45 Cat.6/Cat.7)'
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <polygon points="16,0 6,18 26,18" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="13" y1="8" x2="13" y2="18" stroke="currentColor" stroke-width="1.5"/>
      <line x1="19" y1="8" x2="19" y2="18" stroke="currentColor" stroke-width="1.5"/>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <polygon points="16,0 8,16 24,16" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="1.5"/>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="6" y="0" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="16" y="14" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">T</text>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="6" y="0" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" rx="3"/>
      <path d="M 11 5 A 3 3 0 0 1 21 5 L 21 7 L 18 7 L 18 10 L 21 10 L 21 13 A 2 2 0 0 1 19 15 L 13 15 A 2 2 0 0 1 11 13 Z" fill="none" stroke="currentColor" stroke-width="1.4"/>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <path d="M 8 12 A 8 8 0 0 1 24 12 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="12" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="18" r="2" fill="currentColor"/>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <line x1="6" y1="0" x2="26" y2="0" stroke="currentColor" stroke-width="3"/>
      <line x1="9" y1="5" x2="23" y2="5" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="10" x2="20" y2="10" stroke="currentColor" stroke-width="1.5"/>
      <line x1="15" y1="14" x2="17" y2="14" stroke="currentColor" stroke-width="1.2"/>
    `,
    description: 'Hauptpotenzialausgleichsschiene (PAS / HES nach DIN 18014)'
  },
  // Große Haushaltsgeräte & Küchentechnik nach RAL-RG 678
  {
    id: 'inst_appliance_had',
    name: 'Herdanschlussdose (HAD / Elektroherd 400V)',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Herdanschluss HAD',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <circle cx="16" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <text x="16" y="14" font-size="7.5" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">HAD</text>
    `,
    description: 'Herdanschlussdose HAD für Elektroherd / Kochfeld (3~ 400V, DIN 18015)'
  },
  {
    id: 'inst_appliance_cooktop',
    name: 'Elektroherd (Kochfeld)',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-E',
    defaultFunctionText: 'Elektroherd',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="1"/>
      <circle cx="16" cy="6" r="1.8" fill="currentColor"/>
      <circle cx="10" cy="11" r="1.8" fill="currentColor"/>
      <circle cx="22" cy="11" r="1.8" fill="currentColor"/>
      <circle cx="16" cy="16" r="1.8" fill="currentColor"/>
    `,
    description: 'Elektroherd / autarkes Kochfeld (RAL-RG 678)'
  },
  {
    id: 'inst_appliance_oven',
    name: 'Backofen',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-E',
    defaultFunctionText: 'Backofen',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="1"/>
      <line x1="5" y1="7" x2="27" y2="7" stroke="currentColor" stroke-width="1.8"/>
      <circle cx="16" cy="14" r="2.2" fill="currentColor"/>
    `,
    description: 'Autarker Einbaubackofen nach RAL-RG 678'
  },
  {
    id: 'inst_appliance_dishwasher',
    name: 'Spülmaschine (Geschirrspüler)',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Spülmaschine',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="1"/>
      <circle cx="16" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <circle cx="16" cy="11" r="2" fill="currentColor"/>
      <line x1="5" y1="0" x2="9" y2="4" stroke="currentColor" stroke-width="1.5"/>
      <line x1="27" y1="0" x2="23" y2="4" stroke="currentColor" stroke-width="1.5"/>
      <line x1="5" y1="22" x2="9" y2="18" stroke="currentColor" stroke-width="1.5"/>
      <line x1="27" y1="22" x2="23" y2="18" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Geschirrspüler / Spülmaschine nach RAL-RG 678'
  },
  {
    id: 'inst_appliance_fridge',
    name: 'Kühlschrank (*)',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Kühlschrank',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="1"/>
      <text x="16" y="15" font-size="13" font-family="sans-serif" text-anchor="middle" fill="currentColor">★</text>
    `,
    description: 'Kühlschrank nach RAL-RG 678'
  },
  {
    id: 'inst_appliance_fridge_freezer',
    name: 'Kühl- Gefrierkombination (*** *)',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Kühl-Gefrierkombi',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="1"/>
      <line x1="5" y1="10" x2="27" y2="10" stroke="currentColor" stroke-width="1.5"/>
      <text x="16" y="8" font-size="7.5" font-family="sans-serif" text-anchor="middle" fill="currentColor">★★★</text>
      <text x="16" y="18.5" font-size="9" font-family="sans-serif" text-anchor="middle" fill="currentColor">★</text>
    `,
    description: 'Kühl- und Gefrierkombination mit Mehr-Sterne-Fach'
  },
  {
    id: 'inst_appliance_freezer',
    name: 'Gefriergerät / Gefrierschrank (***)',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Gefrierschrank',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="1"/>
      <text x="16" y="14" font-size="8.5" font-family="sans-serif" text-anchor="middle" fill="currentColor">★★★</text>
    `,
    description: 'Gefriergerät / Tiefkühltruhe mit 3-Sterne-Kennzeichnung'
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <polygon points="16,0 9,8 5,18 27,18 23,8" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="16" y="16" font-size="8" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">DA</text>
    `,
    description: 'Dunstabzugshaube / Ablufthaube (RAL-RG 678)'
  },
  {
    id: 'inst_appliance_microwave',
    name: 'Mikrowelle',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Mikrowelle',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="1"/>
      <path d="M 8 7 Q 10 5, 12 7 T 16 7 T 20 7 T 24 7" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M 8 11 Q 10 9, 12 11 T 16 11 T 20 11 T 24 11" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M 8 15 Q 10 13, 12 15 T 16 15 T 20 15 T 24 15" fill="none" stroke="currentColor" stroke-width="1.5"/>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <circle cx="16" cy="11" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M 10 9 Q 13 7 16 9 T 22 9" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <text x="16" y="18" font-size="8" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">WW</text>
    `,
    description: 'Warmwasserbereiter, Boiler oder Durchlauferhitzer (WW / DLE)'
  },
  {
    id: 'inst_appliance_washing_machine',
    name: 'Waschmaschine',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Waschmaschine',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="1"/>
      <circle cx="16" cy="11" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <circle cx="16" cy="11" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="16" cy="11" r="1.2" fill="currentColor"/>
    `,
    description: 'Waschmaschine mit separatem Stromkreis (DIN 18015 / RAL-RG 678)'
  },
  {
    id: 'inst_appliance_dryer',
    name: 'Trockner (Wäschetrockner)',
    category: 'installation',
    standard: 'DIN EN 60617-11 / RAL-RG 678',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Trockner',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="1"/>
      <line x1="16" y1="0" x2="16" y2="22" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="10.5" cy="6" r="1.8" fill="currentColor"/>
      <circle cx="10.5" cy="16" r="1.8" fill="currentColor"/>
      <circle cx="21.5" cy="11" r="1.8" fill="currentColor"/>
    `,
    description: 'Wäschetrockner nach RAL-RG 678'
  },
  {
    id: 'inst_appliance_general',
    name: 'Elektrogerät allgemein (E)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Elektrogerät',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="1"/>
      <text x="16" y="16" font-size="12" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">E</text>
    `,
    description: 'Elektrogerät allgemein nach DIN EN 60617-11'
  },
  {
    id: 'inst_motion_detector_box',
    name: 'Bewegungsmelder (BM Wandgerät)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-B',
    defaultFunctionText: 'Bewegungsmelder BM',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="1"/>
      <text x="16" y="15" font-size="9" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">BM</text>
    `,
    description: 'Bewegungsmelder / Wächter (Kompaktgerät BM)'
  },
  {
    id: 'inst_shutter_drive',
    name: 'Jalousieantrieb / Rollladenmotor (M)',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-M',
    defaultFunctionText: 'Jalousiemotor',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="1"/>
      <circle cx="16" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <text x="16" y="14.5" font-size="9.5" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">M</text>
    `,
    description: 'Motorischer Antrieb für Jalousie / Rollladen'
  },
  // KNX Smart Home Komponenten
  {
    id: 'knx_pushbutton_2f',
    name: 'KNX Tastsensor 2-fach',
    category: 'installation',
    standard: 'KNX / DIN EN 60617-11',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'KNX Tastsensor 2f',
    width: 32,
    height: 32,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <line x1="16" y1="0" x2="16" y2="22" stroke="currentColor" stroke-width="1.2"/>
      <circle cx="9" cy="4" r="1.5" fill="#48bb78"/>
      <circle cx="23" cy="4" r="1.5" fill="#48bb78"/>
      <text x="16" y="18" font-size="6" font-family="monospace" font-weight="bold" text-anchor="middle" fill="#63b3ed">KNX</text>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <line x1="16" y1="0" x2="16" y2="22" stroke="currentColor" stroke-width="1.2"/>
      <line x1="5" y1="11" x2="27" y2="11" stroke="currentColor" stroke-width="1.2"/>
      <circle cx="9" cy="3.5" r="1.2" fill="#48bb78"/>
      <circle cx="23" cy="3.5" r="1.2" fill="#48bb78"/>
      <circle cx="9" cy="18.5" r="1.2" fill="#48bb78"/>
      <circle cx="23" cy="18.5" r="1.2" fill="#48bb78"/>
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
    insertionPoint: { x: 16, y: 16 },
    pins: [],
    svgContent: `
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="16" r="6" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <line x1="16" y1="5" x2="16" y2="27" stroke="currentColor" stroke-width="1" stroke-dasharray="2,2"/>
      <line x1="5" y1="16" x2="27" y2="16" stroke="currentColor" stroke-width="1" stroke-dasharray="2,2"/>
      <circle cx="16" cy="16" r="2.5" fill="#48bb78"/>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <rect x="8" y="3" width="16" height="9" fill="rgba(99, 179, 237, 0.2)" stroke="currentColor" stroke-width="1" rx="1"/>
      <text x="16" y="9.5" font-size="6" font-family="monospace" font-weight="bold" text-anchor="middle" fill="#63b3ed">21.5°</text>
      <circle cx="10" cy="17" r="2" fill="none" stroke="currentColor" stroke-width="1"/>
      <circle cx="22" cy="17" r="2" fill="none" stroke="currentColor" stroke-width="1"/>
      <text x="10" y="18.5" font-size="5" text-anchor="middle" fill="currentColor">-</text>
      <text x="22" y="18.5" font-size="5" text-anchor="middle" fill="currentColor">+</text>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="4" y="0" width="24" height="20" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <rect x="7" y="3" width="18" height="14" fill="rgba(66, 153, 225, 0.2)" stroke="currentColor" stroke-width="1"/>
      <circle cx="16" cy="10" r="3" fill="none" stroke="#63b3ed" stroke-width="1.2"/>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <circle cx="16" cy="10" r="9" fill="none" stroke="#48bb78" stroke-width="2"/>
      <polygon points="16,3 11,10 16,17 21,10" fill="none" stroke="#48bb78" stroke-width="1.5"/>
      <text x="16" y="12" font-size="5.5" font-family="monospace" font-weight="bold" text-anchor="middle" fill="#48bb78">KNX</text>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="6" y="0" width="20" height="14" fill="none" stroke="currentColor" stroke-width="1.8" rx="2"/>
      <line x1="10" y1="7" x2="14" y2="7" stroke="currentColor" stroke-width="1.5"/>
      <line x1="14" y1="7" x2="20" y2="3" stroke="currentColor" stroke-width="1.5"/>
      <line x1="20" y1="7" x2="22" y2="7" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="14" cy="7" r="1.2" fill="currentColor"/>
      <circle cx="20" cy="7" r="1.2" fill="currentColor"/>
    `,
    description: 'Magnetischer Reed-Fensterkontakt für KNX Heizungsabsenkung & Alarmierung'
  },
  // Vertikale Mehrfachkombinationen
  {
    id: 'inst_combo_switch_socket',
    name: 'Kombination Schalter + Steckdose',
    category: 'installation',
    standard: 'DIN EN 60617-11',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Schalter-Steckdose',
    width: 32,
    height: 48,
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="42" fill="none" stroke="currentColor" stroke-width="1.2" rx="2" stroke-dasharray="2,2"/>
      <!-- Oben: Schalter -->
      <circle cx="16" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <line x1="16" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="1.8"/>
      <!-- Unten: Steckdose -->
      <line x1="9" y1="26" x2="23" y2="26" stroke="currentColor" stroke-width="1.8"/>
      <path d="M 9 26 A 7 7 0 0 0 23 26" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <line x1="16" y1="26" x2="16" y2="33" stroke="currentColor" stroke-width="1.8"/>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="42" fill="none" stroke="currentColor" stroke-width="1.2" rx="2" stroke-dasharray="2,2"/>
      <!-- Oben: Schalter -->
      <circle cx="16" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <line x1="16" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="1.8"/>
      <!-- Unten: Thermostat -->
      <rect x="10" y="24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" rx="1.5"/>
      <text x="16" y="33.5" font-size="8.5" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">T</text>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="5" y="0" width="22" height="42" fill="none" stroke="currentColor" stroke-width="1.2" rx="2" stroke-dasharray="2,2"/>
      <!-- Oben: Steckdose -->
      <line x1="9" y1="4" x2="23" y2="4" stroke="currentColor" stroke-width="1.8"/>
      <path d="M 9 4 A 7 7 0 0 0 23 4" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <line x1="16" y1="4" x2="16" y2="11" stroke="currentColor" stroke-width="1.8"/>
      <!-- Unten: RJ45 Datendose -->
      <polygon points="16,22 9,34 23,34" fill="none" stroke="currentColor" stroke-width="1.8"/>
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
    insertionPoint: { x: 16, y: 0 },
    pins: [],
    svgContent: `
      <rect x="4" y="0" width="24" height="60" fill="none" stroke="currentColor" stroke-width="1.2" rx="2" stroke-dasharray="2,2"/>
      <!-- 1: Schalter -->
      <circle cx="16" cy="8" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="16" y1="3.5" x2="21" y2="3.5" stroke="currentColor" stroke-width="1.5"/>
      <!-- 2: Thermostat -->
      <rect x="11" y="17" width="10" height="9" fill="none" stroke="currentColor" stroke-width="1.5" rx="1"/>
      <text x="16" y="24" font-size="7" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">T</text>
      <!-- 3: Steckdose -->
      <line x1="11" y1="32" x2="21" y2="32" stroke="currentColor" stroke-width="1.5"/>
      <path d="M 11 32 A 5 5 0 0 0 21 32" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- 4: Netzwerk -->
      <polygon points="16,44 11,52 21,52" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Vertikale 4-fach Mehrfachrahmenkombination: Schalter, RTR, Steckdose, RJ45'
  }
];
