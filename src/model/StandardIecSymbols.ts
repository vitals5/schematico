// src/model/StandardIecSymbols.ts
// Standard electrical and electronic symbols library according to IEC 60617 / DIN EN 60617
// Every symbol connection point strictly adheres to the standard 8-unit CAD grid.

import type { SymbolDefinition } from './types';

export const STANDARD_IEC_SYMBOLS: SymbolDefinition[] = [
  // ==========================================
  // --- 1. PASSIVE BAUELEMENTE ---
  // ==========================================
  {
    id: 'resistor',
    name: 'Widerstand',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-R',
    defaultFunctionText: 'Widerstand',
    width: 32,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top', description: 'Anschluss 1' },
      { id: '2', name: '2', x: 16, y: 48, direction: 'bottom', description: 'Anschluss 2' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="14" stroke="currentColor" stroke-width="2"/>
      <rect x="10" y="14" width="12" height="20" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="34" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Ohmscher Festwiderstand nach IEC 60617'
  },
  {
    id: 'potentiometer',
    name: 'Potentiometer',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-R',
    defaultFunctionText: 'Potentiometer',
    width: 48,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top', description: 'Ende 1' },
      { id: '2', name: '2', x: 16, y: 48, direction: 'bottom', description: 'Ende 2' },
      { id: '3', name: '3', x: 48, y: 24, direction: 'right', description: 'Schleifer' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="14" stroke="currentColor" stroke-width="2"/>
      <rect x="10" y="14" width="12" height="20" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="34" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="48" y1="24" x2="24" y2="24" stroke="currentColor" stroke-width="2"/>
      <polygon points="22,24 28,21 28,27" fill="currentColor"/>
    `,
    description: 'Einstellbarer Widerstand / Potentiometer mit Schleifkontakt'
  },
  {
    id: 'varistor',
    name: 'Varistor (VDR)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-R',
    defaultFunctionText: 'Varistor VDR',
    width: 32,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top', description: 'Anschluss 1' },
      { id: '2', name: '2', x: 16, y: 48, direction: 'bottom', description: 'Anschluss 2' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="14" stroke="currentColor" stroke-width="2"/>
      <rect x="10" y="14" width="12" height="20" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="34" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="38" x2="26" y2="10" stroke="currentColor" stroke-width="1.5"/>
      <line x1="6" y1="38" x2="6" y2="34" stroke="currentColor" stroke-width="1.5"/>
      <text x="24" y="16" font-size="7" font-family="sans-serif" font-weight="bold" fill="currentColor">U</text>
    `,
    description: 'Spannungsabhängiger Widerstand (VDR) für Überspannungsschutz'
  },
  {
    id: 'heating_element',
    name: 'Heizelement / Heizwiderstand',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-E',
    defaultFunctionText: 'Heizelement',
    width: 32,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top', description: 'Anschluss 1' },
      { id: '2', name: '2', x: 16, y: 48, direction: 'bottom', description: 'Anschluss 2' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="14" stroke="currentColor" stroke-width="2"/>
      <rect x="10" y="14" width="12" height="20" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="34" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="20" x2="16" y2="14" stroke="currentColor" stroke-width="1.5"/>
      <line x1="10" y1="28" x2="22" y2="16" stroke="currentColor" stroke-width="1.5"/>
      <line x1="16" y1="34" x2="22" y2="28" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Elektrisches Heizelement nach IEC 60617'
  },
  {
    id: 'capacitor',
    name: 'Kondensator',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-C',
    defaultFunctionText: 'Kondensator',
    width: 32,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top', description: 'Platte 1' },
      { id: '2', name: '2', x: 16, y: 48, direction: 'bottom', description: 'Platte 2' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="21" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="21" x2="26" y2="21" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="27" x2="26" y2="27" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="27" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Kondensator Festkapazität allgemein nach IEC 60617'
  },
  {
    id: 'capacitor_polarized',
    name: 'Elektrolytkondensator (gepolt)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-C',
    defaultFunctionText: 'Elektrolytkondensator',
    width: 32,
    height: 48,
    pins: [
      { id: '+', name: '+', x: 16, y: 0, direction: 'top', description: 'Positiver Pol (+)' },
      { id: '-', name: '-', x: 16, y: 48, direction: 'bottom', description: 'Negativer Pol (-)' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="21" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="21" x2="26" y2="21" stroke="currentColor" stroke-width="2"/>
      <rect x="6" y="27" width="20" height="4" fill="currentColor"/>
      <line x1="16" y1="31" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <text x="8" y="17" font-size="9" font-family="sans-serif" font-weight="bold" fill="currentColor">+</text>
    `,
    description: 'Gepolter Kondensator / Elektrolytkondensator (Elko)'
  },
  {
    id: 'inductor_choke',
    name: 'Induktivität / Drosselspule',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-L',
    defaultFunctionText: 'Drosselspule',
    width: 32,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top', description: 'Anschluss 1' },
      { id: '2', name: '2', x: 16, y: 48, direction: 'bottom', description: 'Anschluss 2' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="12" stroke="currentColor" stroke-width="2"/>
      <path d="M 16 12 A 4 4 0 0 1 16 20 A 4 4 0 0 1 16 28 A 4 4 0 0 1 16 36" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="36" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Induktivität / Wicklung / Drosselspule nach IEC 60617'
  },

  // ==========================================
  // --- 2. HALBLEITER & AKTIVE ELEMENTE ---
  // ==========================================
  {
    id: 'diode',
    name: 'Halbleiterdiode',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-V',
    defaultFunctionText: 'Diode',
    width: 32,
    height: 48,
    pins: [
      { id: 'A', name: 'A', x: 16, y: 0, direction: 'top', description: 'Anode' },
      { id: 'K', name: 'K', x: 16, y: 48, direction: 'bottom', description: 'Kathode' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="18" stroke="currentColor" stroke-width="2"/>
      <polygon points="8,18 24,18 16,30" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="8" y1="30" x2="24" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="30" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Halbleiterdiode allgemein nach IEC 60617'
  },
  {
    id: 'zener_diode',
    name: 'Z-Diode (Zenerdiode)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-V',
    defaultFunctionText: 'Z-Diode',
    width: 32,
    height: 48,
    pins: [
      { id: 'A', name: 'A', x: 16, y: 0, direction: 'top', description: 'Anode' },
      { id: 'K', name: 'K', x: 16, y: 48, direction: 'bottom', description: 'Kathode' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="18" stroke="currentColor" stroke-width="2"/>
      <polygon points="8,18 24,18 16,30" fill="none" stroke="currentColor" stroke-width="2"/>
      <polyline points="8,26 8,30 24,30 24,34" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="30" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Zener-Diode / Spannungsbegrenzerdiode nach IEC 60617'
  },
  {
    id: 'diode_led',
    name: 'Leuchtdiode (LED)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-V',
    defaultFunctionText: 'LED Anzeige',
    width: 32,
    height: 48,
    pins: [
      { id: 'A', name: 'A', x: 16, y: 0, direction: 'top', description: 'Anode' },
      { id: 'K', name: 'K', x: 16, y: 48, direction: 'bottom', description: 'Kathode' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="18" stroke="currentColor" stroke-width="2"/>
      <polygon points="8,18 24,18 16,30" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="8" y1="30" x2="24" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="30" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="22" y1="20" x2="29" y2="14" stroke="currentColor" stroke-width="1.5"/>
      <polygon points="29,14 26,16 28,18" fill="currentColor"/>
      <line x1="24" y1="26" x2="31" y2="20" stroke="currentColor" stroke-width="1.5"/>
      <polygon points="31,20 28,22 30,24" fill="currentColor"/>
    `,
    description: 'Leuchtdiode (LED) optische Signalisierung'
  },
  {
    id: 'photodiode',
    name: 'Fotodiode',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-V',
    defaultFunctionText: 'Fotodiode',
    width: 32,
    height: 48,
    pins: [
      { id: 'A', name: 'A', x: 16, y: 0, direction: 'top', description: 'Anode' },
      { id: 'K', name: 'K', x: 16, y: 48, direction: 'bottom', description: 'Kathode' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="18" stroke="currentColor" stroke-width="2"/>
      <polygon points="8,18 24,18 16,30" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="8" y1="30" x2="24" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="30" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="29" y1="14" x2="22" y2="20" stroke="currentColor" stroke-width="1.5"/>
      <polygon points="22,20 25,18 23,16" fill="currentColor"/>
      <line x1="31" y1="20" x2="24" y2="26" stroke="currentColor" stroke-width="1.5"/>
      <polygon points="24,26 27,24 25,22" fill="currentColor"/>
    `,
    description: 'Lichtempfindliche Fotodiode nach IEC 60617'
  },
  {
    id: 'thyristor',
    name: 'Thyristor (SCR)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-V',
    defaultFunctionText: 'Thyristor',
    width: 48,
    height: 48,
    pins: [
      { id: 'A', name: 'A', x: 24, y: 0, direction: 'top', description: 'Anode' },
      { id: 'K', name: 'K', x: 24, y: 48, direction: 'bottom', description: 'Kathode' },
      { id: 'G', name: 'G', x: 0, y: 32, direction: 'left', description: 'Gate' }
    ],
    svgContent: `
      <line x1="24" y1="0" x2="24" y2="18" stroke="currentColor" stroke-width="2"/>
      <polygon points="16,18 32,18 24,30" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="30" x2="32" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="30" x2="24" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="0" y1="32" x2="16" y2="32" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="32" x2="20" y2="30" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Rückwärts sperrende Thyristortriode (SCR) mit P-Steuergate'
  },
  {
    id: 'triac',
    name: 'Triac',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-V',
    defaultFunctionText: 'Triac',
    width: 48,
    height: 48,
    pins: [
      { id: 'MT2', name: 'MT2', x: 24, y: 0, direction: 'top', description: 'Hauptanschluss 2' },
      { id: 'MT1', name: 'MT1', x: 24, y: 48, direction: 'bottom', description: 'Hauptanschluss 1' },
      { id: 'G', name: 'G', x: 0, y: 32, direction: 'left', description: 'Gate' }
    ],
    svgContent: `
      <line x1="24" y1="0" x2="24" y2="16" stroke="currentColor" stroke-width="2"/>
      <polygon points="16,16 32,16 24,26" fill="none" stroke="currentColor" stroke-width="2"/>
      <polygon points="16,32 32,32 24,22" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="24" x2="32" y2="24" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="32" x2="24" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="0" y1="32" x2="16" y2="32" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="32" x2="20" y2="24" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Zweirichtungs-Thyristortriode (Triac) für Wechselstrom-Phasenanschnitt'
  },
  {
    id: 'transistor_npn',
    name: 'Bipolartransistor (NPN)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-V',
    defaultFunctionText: 'Transistor NPN',
    width: 48,
    height: 48,
    pins: [
      { id: 'C', name: 'C', x: 32, y: 0, direction: 'top', description: 'Kollektor' },
      { id: 'E', name: 'E', x: 32, y: 48, direction: 'bottom', description: 'Emitter' },
      { id: 'B', name: 'B', x: 0, y: 24, direction: 'left', description: 'Basis' }
    ],
    svgContent: `
      <line x1="0" y1="24" x2="20" y2="24" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="14" x2="20" y2="34" stroke="currentColor" stroke-width="2.5"/>
      <line x1="20" y1="18" x2="32" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="12" x2="32" y2="0" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="30" x2="32" y2="36" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="36" x2="32" y2="48" stroke="currentColor" stroke-width="2"/>
      <polygon points="31,35 24,30 26,35" fill="currentColor"/>
      <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Bipolarer NPN-Transistor mit Kollektor oben und Emitter unten'
  },
  {
    id: 'transistor_pnp',
    name: 'Bipolartransistor (PNP)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-V',
    defaultFunctionText: 'Transistor PNP',
    width: 48,
    height: 48,
    pins: [
      { id: 'C', name: 'C', x: 32, y: 0, direction: 'top', description: 'Kollektor' },
      { id: 'E', name: 'E', x: 32, y: 48, direction: 'bottom', description: 'Emitter' },
      { id: 'B', name: 'B', x: 0, y: 24, direction: 'left', description: 'Basis' }
    ],
    svgContent: `
      <line x1="0" y1="24" x2="20" y2="24" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="14" x2="20" y2="34" stroke="currentColor" stroke-width="2.5"/>
      <line x1="20" y1="18" x2="32" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="12" x2="32" y2="0" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="30" x2="32" y2="36" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="36" x2="32" y2="48" stroke="currentColor" stroke-width="2"/>
      <polygon points="21,30 27,27 28,33" fill="currentColor"/>
      <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Bipolarer PNP-Transistor mit nach innen weisendem Pfeil'
  },
  {
    id: 'mosfet_n',
    name: 'MOSFET (N-Kanal)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-V',
    defaultFunctionText: 'MOSFET N',
    width: 48,
    height: 48,
    pins: [
      { id: 'D', name: 'D', x: 32, y: 0, direction: 'top', description: 'Drain' },
      { id: 'S', name: 'S', x: 32, y: 48, direction: 'bottom', description: 'Source' },
      { id: 'G', name: 'G', x: 0, y: 24, direction: 'left', description: 'Gate' }
    ],
    svgContent: `
      <line x1="0" y1="24" x2="16" y2="24" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="14" x2="16" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="22" y1="14" x2="22" y2="18" stroke="currentColor" stroke-width="2.5"/>
      <line x1="22" y1="22" x2="22" y2="26" stroke="currentColor" stroke-width="2.5"/>
      <line x1="22" y1="30" x2="22" y2="34" stroke="currentColor" stroke-width="2.5"/>
      <line x1="22" y1="16" x2="32" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="16" x2="32" y2="0" stroke="currentColor" stroke-width="2"/>
      <line x1="22" y1="24" x2="32" y2="24" stroke="currentColor" stroke-width="2"/>
      <line x1="22" y1="32" x2="32" y2="32" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="24" x2="32" y2="48" stroke="currentColor" stroke-width="2"/>
      <polygon points="22,24 28,21 28,27" fill="currentColor"/>
      <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'N-Kanal Anreicherungs-MOSFET (selbstsperrend)'
  },
  {
    id: 'igbt_n',
    name: 'IGBT (N-Kanal)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-V',
    defaultFunctionText: 'IGBT',
    width: 48,
    height: 48,
    pins: [
      { id: 'C', name: 'C', x: 32, y: 0, direction: 'top', description: 'Kollektor' },
      { id: 'E', name: 'E', x: 32, y: 48, direction: 'bottom', description: 'Emitter' },
      { id: 'G', name: 'G', x: 0, y: 24, direction: 'left', description: 'Gate' }
    ],
    svgContent: `
      <line x1="0" y1="24" x2="16" y2="24" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="14" x2="16" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="14" x2="20" y2="34" stroke="currentColor" stroke-width="2.5"/>
      <line x1="20" y1="18" x2="32" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="12" x2="32" y2="0" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="30" x2="32" y2="36" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="36" x2="32" y2="48" stroke="currentColor" stroke-width="2"/>
      <polygon points="31,35 24,30 26,35" fill="currentColor"/>
      <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Insulated Gate Bipolar Transistor (IGBT) N-Kanal'
  },

  // ==========================================
  // --- 3. TRANSFORMATOREN & WANDLER ---
  // ==========================================
  {
    id: 'transformer_1p',
    name: 'Transformator (1-phasig)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-T',
    defaultFunctionText: 'Transformator 230V/24V',
    width: 64,
    height: 64,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top', description: 'Primär L' },
      { id: '2', name: '2', x: 16, y: 64, direction: 'bottom', description: 'Primär N' },
      { id: '3', name: '3', x: 48, y: 0, direction: 'top', description: 'Sekundär +' },
      { id: '4', name: '4', x: 48, y: 64, direction: 'bottom', description: 'Sekundär -' }
    ],
    svgContent: `
      <!-- Primärkreis -->
      <line x1="16" y1="0" x2="16" y2="18" stroke="currentColor" stroke-width="2"/>
      <circle cx="26" cy="32" r="14" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="46" x2="16" y2="64" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="18" x2="26" y2="18" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="46" x2="26" y2="46" stroke="currentColor" stroke-width="2"/>
      
      <!-- Sekundärkreis -->
      <line x1="48" y1="0" x2="48" y2="18" stroke="currentColor" stroke-width="2"/>
      <circle cx="38" cy="32" r="14" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="48" y1="46" x2="48" y2="64" stroke="currentColor" stroke-width="2"/>
      <line x1="48" y1="18" x2="38" y2="18" stroke="currentColor" stroke-width="2"/>
      <line x1="48" y1="46" x2="38" y2="46" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Zweiwicklungs-Transformator 1-phasig nach IEC 60617'
  },
  {
    id: 'auto_transformer',
    name: 'Spartransformator (Autotrafo)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-T',
    defaultFunctionText: 'Spartransformator',
    width: 48,
    height: 64,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top', description: 'Eingang' },
      { id: '2', name: '2', x: 16, y: 64, direction: 'bottom', description: 'Gemeinsamer Fußpunkt' },
      { id: '3', name: '3', x: 48, y: 32, direction: 'right', description: 'Abgriff / Ausgang' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <circle cx="20" cy="32" r="16" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="48" x2="16" y2="64" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="32" x2="48" y2="32" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Spartransformator mit Anzapfung nach IEC 60617'
  },
  {
    id: 'current_transformer_1p',
    name: 'Stromwandler (1-polig)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-T',
    defaultFunctionText: 'Stromwandler',
    width: 48,
    height: 64,
    pins: [
      { id: 'P1', name: 'P1', x: 16, y: 0, direction: 'top', description: 'Primärleiter P1/K' },
      { id: 'P2', name: 'P2', x: 16, y: 64, direction: 'bottom', description: 'Primärleiter P2/L' },
      { id: 'S1', name: 'S1', x: 48, y: 24, direction: 'right', description: 'Sekundär S1/k' },
      { id: 'S2', name: 'S2', x: 48, y: 40, direction: 'right', description: 'Sekundär S2/l' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="64" stroke="currentColor" stroke-width="2.5"/>
      <circle cx="28" cy="32" r="12" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="40" y1="24" x2="48" y2="24" stroke="currentColor" stroke-width="2"/>
      <line x1="40" y1="40" x2="48" y2="40" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Einphasiger Durchsteck-Stromwandler (CT)'
  },
  {
    id: 'voltage_transformer_1p',
    name: 'Spannungswandler (1-polig)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-T',
    defaultFunctionText: 'Spannungswandler',
    width: 48,
    height: 64,
    pins: [
      { id: 'U', name: 'U', x: 16, y: 0, direction: 'top', description: 'Primär Hochspannung' },
      { id: 'V', name: 'V', x: 16, y: 64, direction: 'bottom', description: 'Primär Erde/N' },
      { id: 'u', name: 'u', x: 48, y: 16, direction: 'right', description: 'Sekundär Messung' },
      { id: 'v', name: 'v', x: 48, y: 48, direction: 'right', description: 'Sekundär Referenz' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="18" stroke="currentColor" stroke-width="2"/>
      <circle cx="22" cy="32" r="14" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="34" cy="32" r="14" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="46" x2="16" y2="64" stroke="currentColor" stroke-width="2"/>
      <line x1="48" y1="16" x2="34" y2="18" stroke="currentColor" stroke-width="2"/>
      <line x1="48" y1="48" x2="34" y2="46" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Induktiver Spannungswandler 1-polig nach IEC 60617'
  },
  {
    id: 'transformer_3phase',
    name: 'Drehstromtransformator (Yd)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-T',
    defaultFunctionText: 'Drehstromtrafo Yd',
    width: 80,
    height: 64,
    pins: [
      { id: '1U', name: '1U', x: 16, y: 0, direction: 'top' },
      { id: '1V', name: '1V', x: 40, y: 0, direction: 'top' },
      { id: '1W', name: '1W', x: 64, y: 0, direction: 'top' },
      { id: '2U', name: '2U', x: 16, y: 64, direction: 'bottom' },
      { id: '2V', name: '2V', x: 40, y: 64, direction: 'bottom' },
      { id: '2W', name: '2W', x: 64, y: 64, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="18" stroke="currentColor" stroke-width="2"/>
      <line x1="40" y1="0" x2="40" y2="18" stroke="currentColor" stroke-width="2"/>
      <line x1="64" y1="0" x2="64" y2="18" stroke="currentColor" stroke-width="2"/>
      <circle cx="40" cy="24" r="18" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="40" cy="40" r="18" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="46" x2="16" y2="64" stroke="currentColor" stroke-width="2"/>
      <line x1="40" y1="46" x2="40" y2="64" stroke="currentColor" stroke-width="2"/>
      <line x1="64" y1="46" x2="64" y2="64" stroke="currentColor" stroke-width="2"/>
      <text x="40" y="27" font-size="9" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">Y</text>
      <text x="40" y="44" font-size="9" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">Δ</text>
    `,
    description: 'Dreiphasen-Transformator Schaltgruppe Stern-Dreieck (Yd)'
  },
  {
    id: 'rectifier_bridge',
    name: 'Brückengleichrichter',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-V',
    defaultFunctionText: 'Gleichrichter',
    width: 64,
    height: 64,
    pins: [
      { id: 'AC1', name: '~', x: 16, y: 0, direction: 'top', description: 'AC Eingang 1' },
      { id: 'AC2', name: '~', x: 48, y: 0, direction: 'top', description: 'AC Eingang 2' },
      { id: '+', name: '+', x: 16, y: 64, direction: 'bottom', description: 'DC Plus (+)' },
      { id: '-', name: '-', x: 48, y: 64, direction: 'bottom', description: 'DC Minus (-)' }
    ],
    svgContent: `
      <rect x="12" y="14" width="40" height="36" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="50" x2="52" y2="14" stroke="currentColor" stroke-width="1.5"/>
      <line x1="16" y1="0" x2="16" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="48" y1="0" x2="48" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="50" x2="16" y2="64" stroke="currentColor" stroke-width="2"/>
      <line x1="48" y1="50" x2="48" y2="64" stroke="currentColor" stroke-width="2"/>
      <text x="24" y="28" font-size="11" font-weight="bold" text-anchor="middle" fill="currentColor">~</text>
      <text x="40" y="42" font-size="11" font-weight="bold" text-anchor="middle" fill="currentColor">=</text>
    `,
    description: 'Vollweg-Brückengleichrichter (Graetz-Schaltung)'
  },
  {
    id: 'dcdc_converter',
    name: 'Gleichspannungswandler (DC/DC)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-G',
    defaultFunctionText: 'DC/DC Wandler',
    width: 64,
    height: 64,
    pins: [
      { id: 'IN+', name: 'IN+', x: 16, y: 0, direction: 'top', description: 'DC Eingang +' },
      { id: 'IN-', name: 'IN-', x: 48, y: 0, direction: 'top', description: 'DC Eingang -' },
      { id: 'OUT+', name: 'OUT+', x: 16, y: 64, direction: 'bottom', description: 'DC Ausgang +' },
      { id: 'OUT-', name: 'OUT-', x: 48, y: 64, direction: 'bottom', description: 'DC Ausgang -' }
    ],
    svgContent: `
      <rect x="12" y="14" width="40" height="36" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="50" x2="52" y2="14" stroke="currentColor" stroke-width="1.5"/>
      <line x1="16" y1="0" x2="16" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="48" y1="0" x2="48" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="50" x2="16" y2="64" stroke="currentColor" stroke-width="2"/>
      <line x1="48" y1="50" x2="48" y2="64" stroke="currentColor" stroke-width="2"/>
      <text x="24" y="28" font-size="11" font-weight="bold" text-anchor="middle" fill="currentColor">=</text>
      <text x="40" y="42" font-size="11" font-weight="bold" text-anchor="middle" fill="currentColor">=</text>
    `,
    description: 'Gleichspannungswandler / Chopper (DC/DC Converter)'
  },
  {
    id: 'power_inverter',
    name: 'Wechselrichter (DC/AC)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-U',
    defaultFunctionText: 'Wechselrichter',
    width: 64,
    height: 64,
    pins: [
      { id: '+', name: '+', x: 16, y: 0, direction: 'top', description: 'DC Plus' },
      { id: '-', name: '-', x: 48, y: 0, direction: 'top', description: 'DC Minus' },
      { id: 'L', name: 'L', x: 16, y: 64, direction: 'bottom', description: 'AC Phase' },
      { id: 'N', name: 'N', x: 48, y: 64, direction: 'bottom', description: 'AC Neutralleiter' }
    ],
    svgContent: `
      <rect x="12" y="14" width="40" height="36" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="50" x2="52" y2="14" stroke="currentColor" stroke-width="1.5"/>
      <line x1="16" y1="0" x2="16" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="48" y1="0" x2="48" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="50" x2="16" y2="64" stroke="currentColor" stroke-width="2"/>
      <line x1="48" y1="50" x2="48" y2="64" stroke="currentColor" stroke-width="2"/>
      <text x="24" y="28" font-size="11" font-weight="bold" text-anchor="middle" fill="currentColor">=</text>
      <text x="40" y="42" font-size="11" font-weight="bold" text-anchor="middle" fill="currentColor">~</text>
    `,
    description: 'Wechselrichter (Inverter) DC zu AC'
  },
  {
    id: 'battery_cell',
    name: 'Batterie / Akkumulator',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-G',
    defaultFunctionText: 'Batterie 12V',
    width: 32,
    height: 48,
    pins: [
      { id: '+', name: '+', x: 16, y: 0, direction: 'top', description: 'Pluspol (+)' },
      { id: '-', name: '-', x: 16, y: 48, direction: 'bottom', description: 'Minuspol (-)' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="20" stroke="currentColor" stroke-width="2"/>
      <line x1="4" y1="20" x2="28" y2="20" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="28" x2="22" y2="28" stroke="currentColor" stroke-width="3.5"/>
      <line x1="16" y1="28" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <text x="6" y="16" font-size="9" font-family="sans-serif" font-weight="bold" fill="currentColor">+</text>
    `,
    description: 'Primärelement oder Akkumulatorzelle nach IEC 60617'
  },

  // ==========================================
  // --- 4. MESSGERÄTE & INSTRUMENTE ---
  // ==========================================
  {
    id: 'voltmeter',
    name: 'Spannungsmesser (Voltmeter)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-P',
    defaultFunctionText: 'Spannungsmesser',
    width: 48,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 24, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 24, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="24" y1="0" x2="24" y2="10" stroke="currentColor" stroke-width="2"/>
      <circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="38" x2="24" y2="48" stroke="currentColor" stroke-width="2"/>
      <text x="24" y="29" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">V</text>
    `,
    description: 'Anzeigendes Spannungsmessgerät (Voltmeter)'
  },
  {
    id: 'ammeter',
    name: 'Strommesser (Amperemeter)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-P',
    defaultFunctionText: 'Strommesser',
    width: 48,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 24, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 24, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="24" y1="0" x2="24" y2="10" stroke="currentColor" stroke-width="2"/>
      <circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="38" x2="24" y2="48" stroke="currentColor" stroke-width="2"/>
      <text x="24" y="29" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">A</text>
    `,
    description: 'Anzeigendes Strommessgerät (Amperemeter)'
  },
  {
    id: 'wattmeter',
    name: 'Leistungsmesser (Wattmeter)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-P',
    defaultFunctionText: 'Wattmeter',
    width: 48,
    height: 64,
    pins: [
      { id: 'I1', name: 'I1', x: 16, y: 0, direction: 'top', description: 'Strompfad Eingang' },
      { id: 'I2', name: 'I2', x: 16, y: 64, direction: 'bottom', description: 'Strompfad Ausgang' },
      { id: 'U1', name: 'U1', x: 32, y: 0, direction: 'top', description: 'Spannungspfad 1' },
      { id: 'U2', name: 'U2', x: 32, y: 64, direction: 'bottom', description: 'Spannungspfad 2' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="0" x2="32" y2="16" stroke="currentColor" stroke-width="2"/>
      <circle cx="24" cy="32" r="16" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="48" x2="16" y2="64" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="48" x2="32" y2="64" stroke="currentColor" stroke-width="2"/>
      <text x="24" y="37" font-size="12" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">W</text>
    `,
    description: 'Wirkleistungsmesser (Wattmeter) mit Strom- und Spannungspfad'
  },
  {
    id: 'frequency_meter',
    name: 'Frequenzmesser',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-P',
    defaultFunctionText: 'Frequenzmesser',
    width: 48,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 24, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 24, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="24" y1="0" x2="24" y2="10" stroke="currentColor" stroke-width="2"/>
      <circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="38" x2="24" y2="48" stroke="currentColor" stroke-width="2"/>
      <text x="24" y="28" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">Hz</text>
    `,
    description: 'Frequenzmessgerät nach IEC 60617'
  },
  {
    id: 'energy_meter_1p',
    name: 'Wechselstromzähler (1-phasig)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-P',
    defaultFunctionText: 'Energiezähler 1~',
    width: 48,
    height: 64,
    pins: [
      { id: 'L_in', name: 'L_in', x: 16, y: 0, direction: 'top', description: 'Phase Eingang' },
      { id: 'L_out', name: 'L_out', x: 16, y: 64, direction: 'bottom', description: 'Phase Ausgang' },
      { id: 'N', name: 'N', x: 32, y: 64, direction: 'bottom', description: 'Neutralleiter' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <rect x="8" y="16" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="48" x2="16" y2="64" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="48" x2="32" y2="64" stroke="currentColor" stroke-width="2"/>
      <text x="24" y="32" font-size="9" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">kWh</text>
      <text x="24" y="42" font-size="8" font-family="sans-serif" text-anchor="middle" fill="currentColor">1~</text>
    `,
    description: 'Einphasiger Wirkenergiezähler (Wattstundenzähler kWh)'
  },
  {
    id: 'thermocouple',
    name: 'Thermoelement',
    category: 'sensors',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-B',
    defaultFunctionText: 'Thermoelement Typ K',
    width: 32,
    height: 48,
    pins: [
      { id: '+', name: '+', x: 16, y: 0, direction: 'top', description: 'Positive Ader (+)' },
      { id: '-', name: '-', x: 16, y: 48, direction: 'bottom', description: 'Negative Ader (-)' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="16" x2="22" y2="24" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="32" x2="22" y2="24" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="32" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <circle cx="22" cy="24" r="2.5" fill="currentColor"/>
      <circle cx="16" cy="24" r="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2,2"/>
    `,
    description: 'Thermoelement Temperaturfühler nach IEC 60617'
  },

  // ==========================================
  // --- 5. AKUSTISCHE SIGNALGEBER ---
  // ==========================================
  {
    id: 'buzzer',
    name: 'Summer',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-H',
    defaultFunctionText: 'Warnsummer',
    width: 32,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 16, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="34" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 18 A 10 10 0 0 1 26 18 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="18" x2="26" y2="18" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="18" x2="16" y2="34" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Akustischer Signalgeber / Summer nach IEC 60617'
  },
  {
    id: 'siren',
    name: 'Sirene',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-H',
    defaultFunctionText: 'Alarmsirene',
    width: 32,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 16, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="14" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="24" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="9" y1="17" x2="23" y2="31" stroke="currentColor" stroke-width="1.5"/>
      <line x1="9" y1="31" x2="23" y2="17" stroke="currentColor" stroke-width="1.5"/>
      <polygon points="26,18 32,14 32,34 26,30" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="34" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Akustischer Signalgeber / Sirene nach IEC 60617'
  },
  {
    id: 'horn_acoustic',
    name: 'Signalhorn / Hupe',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-H',
    defaultFunctionText: 'Signalhupe',
    width: 32,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 16, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="32" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <polygon points="12,18 24,14 24,34 12,30" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="18" x2="12" y2="30" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Signalhorn / Klaxon nach IEC 60617'
  },
  {
    id: 'bell_acoustic',
    name: 'Klingel / Wecker',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-H',
    defaultFunctionText: 'Gong / Wecker',
    width: 32,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 16, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 30 A 10 10 0 0 1 26 30 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="30" x2="26" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="30" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="35" r="2" fill="currentColor"/>
    `,
    description: 'Elektrische Glocke / Klingel nach IEC 60617'
  },

  // ==========================================
  // --- 6. SCHALTKONTAKTE, SCHALTER & TRENNER ---
  // ==========================================
  {
    id: 'contact_changeover',
    name: 'Wechsler (Hilfskontakt)',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-K',
    defaultFunctionText: 'Wechsler',
    width: 32,
    height: 48,
    isContact: true,
    contactType: 'Changeover',
    pins: [
      { id: '11', name: '11', x: 16, y: 0, direction: 'top', description: 'Gemeinsamer Fußpunkt' },
      { id: '12', name: '12', x: 8, y: 48, direction: 'bottom', description: 'Öffnerkontakt (NC)' },
      { id: '14', name: '14', x: 24, y: 48, direction: 'bottom', description: 'Schließerkontakt (NO)' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
      <line x1="16" y1="16" x2="8" y2="32" stroke="currentColor" stroke-width="2"/>
      <line x1="8" y1="32" x2="8" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="4" y1="32" x2="8" y2="32" stroke="currentColor" stroke-width="2"/>
      <circle cx="8" cy="32" r="1.5" fill="currentColor"/>
      <line x1="24" y1="32" x2="24" y2="48" stroke="currentColor" stroke-width="2"/>
      <circle cx="24" cy="32" r="1.5" fill="currentColor"/>
    `,
    description: 'Umschaltkontakt / Wechsler (11-12/14) nach IEC 60617'
  },
  {
    id: 'contact_delayed_on_no',
    name: 'Schließer ansprechverzögert',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-K',
    defaultFunctionText: 'Verzögerter Schließer',
    width: 32,
    height: 48,
    isContact: true,
    contactType: 'NO',
    pins: [
      { id: '17', name: '17', x: 16, y: 0, direction: 'top' },
      { id: '18', name: '18', x: 16, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="16" x2="26" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="32" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
      <circle cx="16" cy="32" r="1.5" fill="currentColor"/>
      <path d="M 23 20 A 4 4 0 0 0 23 28" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Schaltglied mit Ansprechverzögerung (ON-Delay NO) nach IEC 60617'
  },
  {
    id: 'contact_delayed_off_nc',
    name: 'Öffner rückfallverzögert',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-K',
    defaultFunctionText: 'Rückfallverzögerter Öffner',
    width: 32,
    height: 48,
    isContact: true,
    contactType: 'NC',
    pins: [
      { id: '15', name: '15', x: 16, y: 0, direction: 'top' },
      { id: '16', name: '16', x: 16, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="16" x2="6" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="30" x2="16" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="32" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
      <circle cx="16" cy="32" r="1.5" fill="currentColor"/>
      <path d="M 9 20 A 4 4 0 0 1 9 28" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Schaltglied mit Rückfallverzögerung (OFF-Delay NC) nach IEC 60617'
  },
  {
    id: 'limit_switch_no',
    name: 'Positionsschalter (Schließer)',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Endschalter NO',
    width: 32,
    height: 48,
    pins: [
      { id: '13', name: '13', x: 16, y: 0, direction: 'top' },
      { id: '14', name: '14', x: 16, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="16" x2="26" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="32" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
      <circle cx="16" cy="32" r="1.5" fill="currentColor"/>
      <line x1="21" y1="23" x2="27" y2="17" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="29" cy="15" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Positionsschalter / mechanischer Endschalter Schließer nach IEC 60617'
  },
  {
    id: 'limit_switch_nc',
    name: 'Positionsschalter (Öffner)',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Endschalter NC',
    width: 32,
    height: 48,
    pins: [
      { id: '21', name: '21', x: 16, y: 0, direction: 'top' },
      { id: '22', name: '22', x: 16, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="16" x2="6" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="30" x2="16" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="32" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
      <circle cx="16" cy="32" r="1.5" fill="currentColor"/>
      <line x1="11" y1="23" x2="5" y2="17" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="3" cy="15" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Positionsschalter / Sicherheits-Endschalter Öffner mit Zwangsöffnung'
  },
  {
    id: 'bimetal_switch_nc',
    name: 'Thermoschalter / Bimetall Öffner',
    category: 'protection',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-F',
    defaultFunctionText: 'Thermoschalter',
    width: 32,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 16, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="16" x2="6" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="30" x2="16" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="32" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
      <circle cx="16" cy="32" r="1.5" fill="currentColor"/>
      <rect x="2" y="24" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Temperaturabhängiger Schalter / Bimetallkontakt Öffner nach IEC 60617'
  },
  {
    id: 'selector_switch_2pos',
    name: 'Wahlschalter (2 Stellungen 0-1)',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Wahlschalter 0-1',
    width: 32,
    height: 48,
    pins: [
      { id: '13', name: '13', x: 16, y: 0, direction: 'top' },
      { id: '14', name: '14', x: 16, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="16" x2="26" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="32" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
      <circle cx="16" cy="32" r="1.5" fill="currentColor"/>
      <line x1="21" y1="23" x2="21" y2="15" stroke="currentColor" stroke-width="1.5"/>
      <path d="M 17 15 L 21 11 L 25 15" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Wahlschalter / Drehschalter mit 2 Raststellungen (0 - 1)'
  },
  {
    id: 'selector_switch_3pos',
    name: 'Wahlschalter (3 Stellungen 1-0-2)',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Wahlschalter Hand-0-Auto',
    width: 48,
    height: 48,
    pins: [
      { id: '11', name: '11', x: 24, y: 0, direction: 'top', description: 'Gemeinsam' },
      { id: '12', name: '12', x: 16, y: 48, direction: 'bottom', description: 'Stellung 1 (Hand)' },
      { id: '14', name: '14', x: 32, y: 48, direction: 'bottom', description: 'Stellung 2 (Auto)' }
    ],
    svgContent: `
      <line x1="24" y1="0" x2="24" y2="16" stroke="currentColor" stroke-width="2"/>
      <circle cx="24" cy="16" r="1.5" fill="currentColor"/>
      <line x1="24" y1="16" x2="24" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="32" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="32" x2="32" y2="48" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="32" r="1.5" fill="currentColor"/>
      <circle cx="32" cy="32" r="1.5" fill="currentColor"/>
      <line x1="24" y1="23" x2="24" y2="13" stroke="currentColor" stroke-width="1.5"/>
      <path d="M 18 13 L 24 9 L 30 13" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Wahlschalter mit 3 Stellungen und Nullstellung (Hand - 0 - Auto)'
  },
  {
    id: 'disconnector_1p',
    name: 'Trennschalter (1-polig)',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-Q',
    defaultFunctionText: 'Trennschalter 1P',
    width: 32,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 16, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="16" x2="26" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="32" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="11" y1="32" x2="21" y2="32" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Trennschalter / Isolator 1-polig nach IEC 60617'
  },
  {
    id: 'disconnector_3p',
    name: 'Lasttrennschalter (3-polig)',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-Q',
    defaultFunctionText: 'Lasttrennschalter 3P',
    width: 64,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 16, y: 48, direction: 'bottom' },
      { id: '3', name: '3', x: 32, y: 0, direction: 'top' },
      { id: '4', name: '4', x: 32, y: 48, direction: 'bottom' },
      { id: '5', name: '5', x: 48, y: 0, direction: 'top' },
      { id: '6', name: '6', x: 48, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <!-- Pol 1 -->
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="16" x2="24" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="32" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="32" x2="20" y2="32" stroke="currentColor" stroke-width="2"/>
      
      <!-- Pol 2 -->
      <line x1="32" y1="0" x2="32" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="16" x2="40" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="32" x2="32" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="28" y1="32" x2="36" y2="32" stroke="currentColor" stroke-width="2"/>

      <!-- Pol 3 -->
      <line x1="48" y1="0" x2="48" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="48" y1="16" x2="56" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="48" y1="32" x2="48" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="44" y1="32" x2="52" y2="32" stroke="currentColor" stroke-width="2"/>

      <!-- Mechanische Wirklinie -->
      <line x1="20" y1="23" x2="52" y2="23" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2"/>
    `,
    description: '3-poliger Lasttrennschalter mit mechanischer Koppelung'
  },

  // ==========================================
  // --- 7. ERDUNG, MASSE & STECKVERBINDUNGEN ---
  // ==========================================
  {
    id: 'earth_ground',
    name: 'Erde (allgemein)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: 'PE',
    defaultFunctionText: 'Erde',
    width: 32,
    height: 32,
    pins: [
      { id: 'PE', name: 'PE', x: 16, y: 0, direction: 'top', description: 'Erdanschluss' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="4" y1="14" x2="28" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="8" y1="20" x2="24" y2="20" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="26" x2="20" y2="26" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Allgemeines Erdungssymbol nach IEC 60617'
  },
  {
    id: 'frame_ground',
    name: 'Gehäusemasse / Gestell',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '',
    defaultFunctionText: 'Masse',
    width: 32,
    height: 32,
    pins: [
      { id: 'M', name: 'M', x: 16, y: 0, direction: 'top', description: 'Masseanschluss' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="16" x2="26" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="9" y1="16" x2="5" y2="26" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="16" x2="12" y2="26" stroke="currentColor" stroke-width="2"/>
      <line x1="23" y1="16" x2="19" y2="26" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Gehäusemasse / Gestellverbindung nach IEC 60617'
  },
  {
    id: 'equipotential_bonding',
    name: 'Potentialausgleich',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '',
    defaultFunctionText: 'PA',
    width: 32,
    height: 32,
    pins: [
      { id: 'PA', name: 'PA', x: 16, y: 0, direction: 'top', description: 'Potentialausgleich' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="14" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="20" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="20" x2="22" y2="20" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Funktions- und Schutzpotentialausgleich nach IEC 60617'
  },
  {
    id: 'plug_male',
    name: 'Steckerkontakt (Stift)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Stecker',
    width: 32,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 16, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="20" stroke="currentColor" stroke-width="2"/>
      <polygon points="16,20 12,28 20,28" fill="currentColor"/>
      <line x1="16" y1="28" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Männlicher Steckerkontakt (Stift) nach IEC 60617'
  },
  {
    id: 'socket_female',
    name: 'Buchsenkontakt (Buchse)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Buchse',
    width: 32,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 16, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="20" stroke="currentColor" stroke-width="2"/>
      <path d="M 10 20 A 6 6 0 0 0 22 20" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="26" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Weiblicher Buchsenkontakt (Buchse) nach IEC 60617'
  },
  {
    id: 'plug_socket_pair',
    name: 'Steckverbindung (trennbar)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Steckverbindung',
    width: 32,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 16, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="18" stroke="currentColor" stroke-width="2"/>
      <polygon points="16,18 12,24 20,24" fill="currentColor"/>
      <path d="M 10 25 A 6 6 0 0 0 22 25" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="31" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Trennbare Steckverbindung (Stecker und Buchse) nach IEC 60617'
  },

  // ==========================================
  // --- 8. MOTOREN & GENERATOREN ---
  // ==========================================
  {
    id: 'motor_dc',
    name: 'Gleichstrommotor (DC)',
    category: 'motors',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-M',
    defaultFunctionText: 'Gleichstrommotor',
    width: 64,
    height: 64,
    pins: [
      { id: 'A1', name: 'A1', x: 32, y: 0, direction: 'top', description: 'Anker +' },
      { id: 'A2', name: 'A2', x: 32, y: 64, direction: 'bottom', description: 'Anker -' }
    ],
    svgContent: `
      <line x1="32" y1="0" x2="32" y2="12" stroke="currentColor" stroke-width="2"/>
      <rect x="28" y="10" width="8" height="4" fill="currentColor"/>
      <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" stroke-width="2"/>
      <rect x="28" y="50" width="8" height="4" fill="currentColor"/>
      <line x1="32" y1="52" x2="32" y2="64" stroke="currentColor" stroke-width="2"/>
      <text x="32" y="31" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">M</text>
      <text x="32" y="44" font-size="12" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">=</text>
    `,
    description: 'Gleichstrommotor (DC) mit Bürsten nach IEC 60617'
  },
  {
    id: 'generator_dc',
    name: 'Gleichstromgenerator (DC)',
    category: 'motors',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-G',
    defaultFunctionText: 'DC Generator',
    width: 64,
    height: 64,
    pins: [
      { id: '+', name: '+', x: 32, y: 0, direction: 'top', description: 'Pluspol' },
      { id: '-', name: '-', x: 32, y: 64, direction: 'bottom', description: 'Minuspol' }
    ],
    svgContent: `
      <line x1="32" y1="0" x2="32" y2="12" stroke="currentColor" stroke-width="2"/>
      <rect x="28" y="10" width="8" height="4" fill="currentColor"/>
      <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" stroke-width="2"/>
      <rect x="28" y="50" width="8" height="4" fill="currentColor"/>
      <line x1="32" y1="52" x2="32" y2="64" stroke="currentColor" stroke-width="2"/>
      <text x="32" y="31" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">G</text>
      <text x="32" y="44" font-size="12" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">=</text>
    `,
    description: 'Gleichstromgenerator mit Bürsten nach IEC 60617'
  },
  {
    id: 'generator_3phase',
    name: 'Drehstromgenerator (3~)',
    category: 'motors',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-G',
    defaultFunctionText: 'Drehstromgenerator',
    width: 80,
    height: 72,
    pins: [
      { id: 'U', name: 'U', x: 16, y: 0, direction: 'top' },
      { id: 'V', name: 'V', x: 40, y: 0, direction: 'top' },
      { id: 'W', name: 'W', x: 64, y: 0, direction: 'top' },
      { id: 'PE', name: 'PE', x: 80, y: 40, direction: 'right' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="28" stroke="currentColor" stroke-width="2"/>
      <line x1="40" y1="0" x2="40" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="64" y1="0" x2="64" y2="28" stroke="currentColor" stroke-width="2"/>
      <circle cx="40" cy="40" r="24" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="40" y="36" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">G</text>
      <text x="40" y="52" font-size="11" font-family="sans-serif" text-anchor="middle" fill="currentColor">3 ~</text>
      <line x1="64" y1="40" x2="80" y2="40" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Drehstrom-Synchrongenerator mit PE-Anschluss'
  },

  // ==========================================
  // --- 9. DATEN- & NETZWERKSCHNITTSTELLEN (USB, RJ45) ---
  // ==========================================
  {
    id: 'usb_socket_type_a',
    name: 'USB-Buchse (Typ A, 4-polig)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'USB-Schnittstelle',
    width: 48,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top', description: 'VBUS (+5V)' },
      { id: '2', name: '2', x: 24, y: 0, direction: 'top', description: 'D- (Data -)' },
      { id: '3', name: '3', x: 32, y: 0, direction: 'top', description: 'D+ (Data +)' },
      { id: '4', name: '4', x: 40, y: 0, direction: 'top', description: 'GND (Masse)' },
      { id: 'SH', name: 'SH', x: 24, y: 48, direction: 'bottom', description: 'Schirm (Shield)' }
    ],
    svgContent: `
      <rect x="8" y="12" width="32" height="24" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <line x1="8" y1="20" x2="40" y2="20" stroke="currentColor" stroke-width="1"/>
      <line x1="16" y1="0" x2="16" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="0" x2="24" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="0" x2="32" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="40" y1="0" x2="40" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="36" x2="24" y2="48" stroke="currentColor" stroke-width="2"/>
      <text x="24" y="31" font-size="8" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">USB</text>
    `,
    description: 'USB-Buchse Typ A 4-polig mit Schirmanschluss nach IEC 60617'
  },
  {
    id: 'usb_socket_type_c',
    name: 'USB-C Buchse (Typ C)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'USB-C Schnittstelle',
    width: 64,
    height: 48,
    pins: [
      { id: 'VBUS', name: 'VBUS', x: 16, y: 0, direction: 'top', description: 'VBUS Stromversorgung' },
      { id: 'CC1', name: 'CC1', x: 24, y: 0, direction: 'top', description: 'CC1 Konfiguration' },
      { id: 'DP', name: 'D+', x: 32, y: 0, direction: 'top', description: 'D+ Daten' },
      { id: 'DM', name: 'D-', x: 40, y: 0, direction: 'top', description: 'D- Daten' },
      { id: 'GND', name: 'GND', x: 48, y: 0, direction: 'top', description: 'GND Masse' },
      { id: 'SH', name: 'SH', x: 32, y: 48, direction: 'bottom', description: 'Schirm (Shield / PE)' }
    ],
    svgContent: `
      <rect x="8" y="14" width="48" height="20" fill="none" stroke="currentColor" stroke-width="2" rx="8"/>
      <line x1="16" y1="0" x2="16" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="0" x2="24" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="0" x2="32" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="40" y1="0" x2="40" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="48" y1="0" x2="48" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="34" x2="32" y2="48" stroke="currentColor" stroke-width="2"/>
      <text x="32" y="27" font-size="7" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">USB-C</text>
    `,
    description: 'USB-Buchse Typ C reversible Schnittstelle nach IEC 60617'
  },
  {
    id: 'usb_socket_double',
    name: 'USB-Doppelbuchse (2x Typ A)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'USB Doppelbuchse',
    width: 64,
    height: 48,
    pins: [
      { id: 'X1', name: 'X1', x: 16, y: 0, direction: 'top', description: 'USB Port 1' },
      { id: 'X2', name: 'X2', x: 48, y: 0, direction: 'top', description: 'USB Port 2' },
      { id: 'SH', name: 'SH', x: 32, y: 48, direction: 'bottom', description: 'Gemeinsamer Schirm (PE)' }
    ],
    svgContent: `
      <rect x="6" y="12" width="24" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <rect x="34" y="12" width="24" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <line x1="16" y1="0" x2="16" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="48" y1="0" x2="48" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="18" y1="34" x2="32" y2="40" stroke="currentColor" stroke-width="1.5"/>
      <line x1="46" y1="34" x2="32" y2="40" stroke="currentColor" stroke-width="1.5"/>
      <line x1="32" y1="40" x2="32" y2="48" stroke="currentColor" stroke-width="2"/>
      <text x="18" y="26" font-size="7" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">USB1</text>
      <text x="46" y="26" font-size="7" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">USB2</text>
    `,
    description: 'Doppelte USB-Buchse (2x USB-A) für Schaltschrankeinbau'
  },
  {
    id: 'usb_service_socket',
    name: 'USB-Serviceschnittstelle',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'USB Serviceport',
    width: 32,
    height: 48,
    pins: [
      { id: 'INT', name: 'INT', x: 16, y: 0, direction: 'top', description: 'Intern (IPC / Steuerung)' },
      { id: 'EXT', name: 'EXT', x: 16, y: 48, direction: 'bottom', description: 'Extern (Bedienfeld / Front)' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="14" stroke="currentColor" stroke-width="2"/>
      <rect x="6" y="14" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <line x1="4" y1="24" x2="28" y2="24" stroke="currentColor" stroke-width="1" stroke-dasharray="2,2"/>
      <line x1="16" y1="34" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <text x="16" y="22" font-size="6" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">USB</text>
      <text x="16" y="32" font-size="6" font-family="sans-serif" text-anchor="middle" fill="currentColor">FRONT</text>
    `,
    description: 'Schaltschrank-Wanddurchführung / USB-Frontschnittstelle'
  },
  {
    id: 'rj45_socket_8p',
    name: 'RJ45-Buchse (8-polig, Cat.6)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'RJ45 Cat.6',
    width: 80,
    height: 56,
    pins: [
      { id: '1', name: '1', x: 8, y: 0, direction: 'top', description: '1: TX+ (Weiß-Orange)' },
      { id: '2', name: '2', x: 16, y: 0, direction: 'top', description: '2: TX- (Orange)' },
      { id: '3', name: '3', x: 24, y: 0, direction: 'top', description: '3: RX+ (Weiß-Grün)' },
      { id: '4', name: '4', x: 32, y: 0, direction: 'top', description: '4: BI_D3+ (Blau)' },
      { id: '5', name: '5', x: 40, y: 0, direction: 'top', description: '5: BI_D3- (Weiß-Blau)' },
      { id: '6', name: '6', x: 48, y: 0, direction: 'top', description: '6: RX- (Grün)' },
      { id: '7', name: '7', x: 56, y: 0, direction: 'top', description: '7: BI_D4+ (Weiß-Braun)' },
      { id: '8', name: '8', x: 64, y: 0, direction: 'top', description: '8: BI_D4- (Braun)' },
      { id: 'SH', name: 'SH', x: 40, y: 56, direction: 'bottom', description: 'Schirm (Shield / PE)' }
    ],
    svgContent: `
      <!-- RJ45 Kontur mit Rastnase -->
      <path d="M 4 12 L 76 12 L 76 44 L 54 44 L 54 36 L 26 36 L 26 44 L 4 44 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="8" y1="0" x2="8" y2="12" stroke="currentColor" stroke-width="1.5"/>
      <line x1="16" y1="0" x2="16" y2="12" stroke="currentColor" stroke-width="1.5"/>
      <line x1="24" y1="0" x2="24" y2="12" stroke="currentColor" stroke-width="1.5"/>
      <line x1="32" y1="0" x2="32" y2="12" stroke="currentColor" stroke-width="1.5"/>
      <line x1="40" y1="0" x2="40" y2="12" stroke="currentColor" stroke-width="1.5"/>
      <line x1="48" y1="0" x2="48" y2="12" stroke="currentColor" stroke-width="1.5"/>
      <line x1="56" y1="0" x2="56" y2="12" stroke="currentColor" stroke-width="1.5"/>
      <line x1="64" y1="0" x2="64" y2="12" stroke="currentColor" stroke-width="1.5"/>
      <line x1="40" y1="44" x2="40" y2="56" stroke="currentColor" stroke-width="2"/>
      <text x="40" y="27" font-size="8" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">RJ45 8P</text>
    `,
    description: 'RJ45-Netzwerkbuchse 8-polig (Gigabit / Cat.6) mit Schirmanschluss'
  },
  {
    id: 'rj45_socket_4p',
    name: 'RJ45-Buchse (4-polig, Industrial Ethernet)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'PROFINET RJ45',
    width: 64,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 16, y: 0, direction: 'top', description: '1: TD+ (Gelb)' },
      { id: '2', name: '2', x: 24, y: 0, direction: 'top', description: '2: TD- (Orange)' },
      { id: '3', name: '3', x: 32, y: 0, direction: 'top', description: '3: RD+ (Weiß)' },
      { id: '6', name: '6', x: 40, y: 0, direction: 'top', description: '6: RD- (Blau)' },
      { id: 'SH', name: 'SH', x: 32, y: 48, direction: 'bottom', description: 'Schirm (Shield / PE)' }
    ],
    svgContent: `
      <path d="M 6 12 L 58 12 L 58 38 L 44 38 L 44 32 L 20 32 L 20 38 L 6 38 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="0" x2="16" y2="12" stroke="currentColor" stroke-width="1.5"/>
      <line x1="24" y1="0" x2="24" y2="12" stroke="currentColor" stroke-width="1.5"/>
      <line x1="32" y1="0" x2="32" y2="12" stroke="currentColor" stroke-width="1.5"/>
      <line x1="40" y1="0" x2="40" y2="12" stroke="currentColor" stroke-width="1.5"/>
      <line x1="32" y1="38" x2="32" y2="48" stroke="currentColor" stroke-width="2"/>
      <text x="32" y="25" font-size="7" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">PN / ETH</text>
    `,
    description: 'RJ45-Buchse 4-polig für Industrial Ethernet / PROFINET 100BASE-TX'
  },
  {
    id: 'rj45_feedthrough',
    name: 'RJ45-Schaltschrankkupplung',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'RJ45 Kupplung',
    width: 48,
    height: 48,
    pins: [
      { id: 'IN', name: 'IN', x: 24, y: 0, direction: 'top', description: 'Intern (Schaltschrank)' },
      { id: 'OUT', name: 'OUT', x: 24, y: 48, direction: 'bottom', description: 'Extern (Feld / Service)' },
      { id: 'SH', name: 'SH', x: 48, y: 24, direction: 'right', description: 'Schirmung' }
    ],
    svgContent: `
      <line x1="24" y1="0" x2="24" y2="12" stroke="currentColor" stroke-width="2"/>
      <rect x="10" y="12" width="28" height="24" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <line x1="6" y1="24" x2="42" y2="24" stroke="currentColor" stroke-width="1" stroke-dasharray="2,2"/>
      <line x1="24" y1="36" x2="24" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="38" y1="24" x2="48" y2="24" stroke="currentColor" stroke-width="2"/>
      <text x="24" y="20" font-size="6" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">RJ45</text>
      <text x="24" y="32" font-size="6" font-family="sans-serif" text-anchor="middle" fill="currentColor">FEED</text>
    `,
    description: 'RJ45-Schaltschrankdurchführung / Buchse-zu-Buchse Keystone Kupplung'
  },
  {
    id: 'usb_socket_compact',
    name: 'USB-Buchse (kompakt, 1 Anschluss)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'USB',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'USB', x: 16, y: 0, direction: 'top', description: 'USB-Schnittstelle (kompakt)' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <rect x="6" y="10" width="20" height="18" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <line x1="10" y1="16" x2="22" y2="16" stroke="currentColor" stroke-width="1.5"/>
      <text x="16" y="24" font-size="7" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">USB</text>
    `,
    description: 'Kompakte USB-Buchse mit Einzelleitungsanschluss nach IEC 60617'
  },
  {
    id: 'usb_socket_compact_h',
    name: 'USB-Buchse horizontal (kompakt, 1 Anschluss)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'USB',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'USB', x: 0, y: 16, direction: 'left', description: 'USB-Schnittstelle horizontal (kompakt)' }
    ],
    svgContent: `
      <line x1="0" y1="16" x2="10" y2="16" stroke="currentColor" stroke-width="2"/>
      <rect x="10" y="6" width="18" height="20" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <line x1="16" y1="10" x2="16" y2="22" stroke="currentColor" stroke-width="1.5"/>
      <text x="19" y="19" font-size="7" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">USB</text>
    `,
    description: 'Kompakte horizontale USB-Buchse mit Einzelleitungsanschluss nach IEC 60617'
  },
  {
    id: 'usb_c_socket_compact',
    name: 'USB-C Buchse (kompakt, 1 Anschluss)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'USB-C',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'USB-C', x: 16, y: 0, direction: 'top', description: 'USB-C Schnittstelle (kompakt)' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <rect x="5" y="10" width="22" height="18" fill="none" stroke="currentColor" stroke-width="2" rx="6"/>
      <text x="16" y="22" font-size="6.5" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">USB-C</text>
    `,
    description: 'Kompakte USB-C Buchse mit Einzelleitungsanschluss nach IEC 60617'
  },
  {
    id: 'usb_c_socket_compact_h',
    name: 'USB-C Buchse horizontal (kompakt, 1 Anschluss)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'USB-C',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'USB-C', x: 0, y: 16, direction: 'left', description: 'USB-C Schnittstelle horizontal (kompakt)' }
    ],
    svgContent: `
      <line x1="0" y1="16" x2="10" y2="16" stroke="currentColor" stroke-width="2"/>
      <rect x="10" y="5" width="18" height="22" fill="none" stroke="currentColor" stroke-width="2" rx="6"/>
      <text x="19" y="18" font-size="5.5" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">USB-C</text>
    `,
    description: 'Kompakte horizontale USB-C Buchse mit Einzelleitungsanschluss nach IEC 60617'
  },
  {
    id: 'rj45_socket_compact',
    name: 'RJ45-Buchse (kompakt, 1 Anschluss)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'ETH',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'ETH', x: 16, y: 0, direction: 'top', description: 'RJ45 Ethernet-Anschluss (kompakt)' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 8 L 26 8 L 26 26 L 20 26 L 20 22 L 12 22 L 12 26 L 6 26 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="16" y="18" font-size="6" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">RJ45</text>
    `,
    description: 'Kompakte RJ45-Netzwerkbuchse mit Einzelleitungsanschluss nach IEC 60617'
  },
  {
    id: 'rj45_socket_compact_h',
    name: 'RJ45-Buchse horizontal (kompakt, 1 Anschluss)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'ETH',
    width: 32,
    height: 32,
    pins: [
      { id: '1', name: 'ETH', x: 0, y: 16, direction: 'left', description: 'RJ45 Ethernet-Anschluss horizontal (kompakt)' }
    ],
    svgContent: `
      <line x1="0" y1="16" x2="8" y2="16" stroke="currentColor" stroke-width="2"/>
      <path d="M 8 6 L 26 6 L 26 12 L 22 12 L 22 20 L 26 20 L 26 26 L 8 26 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="16" y="18" font-size="6" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor">RJ45</text>
    `,
    description: 'Kompakte horizontale RJ45-Netzwerkbuchse mit Einzelleitungsanschluss nach IEC 60617'
  }
];
