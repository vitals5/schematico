import { migrateLegacyData } from './LegacyCompatibility';
import { DEVICE_BOX_SYMBOL, componentFromBox, deviceBoxDefinition, geometryFromSymbol, isDeviceBoxDefinition } from './DeviceBoxElement';
// src/model/symbols.ts
// Standard electrical symbols library according to DIN EN 60617 & IEC 60617

import { PlacedComponent, Project, SymbolDefinition } from './types';
import { EXTENDED_SYMBOL_DEFINITIONS } from './ExtendedSymbols';
import { STANDARD_IEC_SYMBOLS } from './StandardIecSymbols';
import { INSTALLATION_SYMBOLS } from './InstallationSymbols';
import { scaleSymbolDefinition } from './SymbolGeometry';

export const SYMBOL_DEFINITIONS: SymbolDefinition[] = [
  // --- 1. SCHÜTZE & RELAIS ---
  {
    id: 'contactor_coil',
    name: 'Schützspule',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-K',
    defaultFunctionText: 'Hauptschütz',
    width: 32,
    height: 48,
    isMaster: true,
    pins: [
      { id: 'A1', name: 'A1', x: 16, y: 0, direction: 'top', description: 'Spule Anschluss 1' },
      { id: 'A2', name: 'A2', x: 16, y: 48, direction: 'bottom', description: 'Spule Anschluss 2' }
    ],
    svgContent: `
      <rect x="6" y="14" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="0" x2="16" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="34" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <text x="16" y="27" font-size="9" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="currentColor">K</text>
    `,
    description: 'Relais- oder Schützspule mit Kontaktspiegel'
  },
  {
    id: 'contact_no',
    name: 'Schließer (Hilfskontakt)',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-K',
    defaultFunctionText: 'Hilfskontakt',
    width: 24,
    height: 48,
    isContact: true,
    contactType: 'NO',
    pins: [
      { id: '13', name: '13', x: 12, y: 0, direction: 'top' },
      { id: '14', name: '14', x: 12, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="16" x2="22" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="32" x2="12" y2="48" stroke="currentColor" stroke-width="2"/>
      <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="32" r="1.5" fill="currentColor"/>
    `,
    description: 'Einfacher Hilfskontakt Schließer (13-14)'
  },
  {
    id: 'contact_nc',
    name: 'Öffner (Hilfskontakt)',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-K',
    defaultFunctionText: 'Verriegelungskontakt',
    width: 24,
    height: 48,
    isContact: true,
    contactType: 'NC',
    pins: [
      { id: '21', name: '21', x: 12, y: 0, direction: 'top' },
      { id: '22', name: '22', x: 12, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="16" x2="2" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="32" x2="12" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="2" y1="30" x2="12" y2="30" stroke="currentColor" stroke-width="2"/>
      <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="32" r="1.5" fill="currentColor"/>
    `,
    description: 'Einfacher Hilfskontakt Öffner (21-22)'
  },
  {
    id: 'contactor_power_3p',
    name: 'Leistungsschaltglieder (3-polig)',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-Q',
    defaultFunctionText: 'Hauptschütz',
    width: 72,
    height: 48,
    isContact: true,
    contactType: 'PowerNO',
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 48, direction: 'bottom' },
      { id: '3', name: '3', x: 36, y: 0, direction: 'top' },
      { id: '4', name: '4', x: 36, y: 48, direction: 'bottom' },
      { id: '5', name: '5', x: 60, y: 0, direction: 'top' },
      { id: '6', name: '6', x: 60, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <!-- Pol 1 -->
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="16" x2="22" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="32" x2="12" y2="48" stroke="currentColor" stroke-width="2"/>
      <path d="M 22 28 A 3 3 0 0 1 20 33" fill="none" stroke="currentColor" stroke-width="2"/>
      
      <!-- Pol 2 -->
      <line x1="36" y1="0" x2="36" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="16" x2="46" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="32" x2="36" y2="48" stroke="currentColor" stroke-width="2"/>
      <path d="M 46 28 A 3 3 0 0 1 44 33" fill="none" stroke="currentColor" stroke-width="2"/>

      <!-- Pol 3 -->
      <line x1="60" y1="0" x2="60" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="16" x2="70" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="32" x2="60" y2="48" stroke="currentColor" stroke-width="2"/>
      <path d="M 70 28 A 3 3 0 0 1 68 33" fill="none" stroke="currentColor" stroke-width="2"/>

      <!-- Mechanische Kopplung -->
      <line x1="18" y1="23" x2="66" y2="23" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2"/>
    `,
    description: '3-polige Hauptschaltglieder für Motorabzweig'
  },

  // --- 2. SCHUTZEINRICHTUNGEN ---
  {
    id: 'motor_protective_switch',
    name: 'Motorschutzschalter (3-polig)',
    category: 'protection',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-Q',
    defaultFunctionText: 'Motorschutzschalter',
    width: 72,
    height: 56,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 56, direction: 'bottom' },
      { id: '3', name: '3', x: 36, y: 0, direction: 'top' },
      { id: '4', name: '4', x: 36, y: 56, direction: 'bottom' },
      { id: '5', name: '5', x: 60, y: 0, direction: 'top' },
      { id: '6', name: '6', x: 60, y: 56, direction: 'bottom' }
    ],
    svgContent: `
      <!-- Pol 1 -->
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="16" x2="22" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="36" x2="12" y2="56" stroke="currentColor" stroke-width="2"/>
      <rect x="8" y="40" width="8" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <polygon points="17,25 21,21 21,29" fill="currentColor"/>

      <!-- Pol 2 -->
      <line x1="36" y1="0" x2="36" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="16" x2="46" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="36" x2="36" y2="56" stroke="currentColor" stroke-width="2"/>
      <rect x="32" y="40" width="8" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <polygon points="41,25 45,21 45,29" fill="currentColor"/>

      <!-- Pol 3 -->
      <line x1="60" y1="0" x2="60" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="16" x2="70" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="36" x2="60" y2="56" stroke="currentColor" stroke-width="2"/>
      <rect x="56" y="40" width="8" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <polygon points="65,25 69,21 69,29" fill="currentColor"/>

      <!-- Mechanische Wirklinie -->
      <line x1="18" y1="25" x2="66" y2="25" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2"/>
    `,
    description: 'Motorschutzschalter mit thermischer und magnetischer Auslösung'
  },
  {
    id: 'fuse_1p',
    name: 'Sicherung (1-polig)',
    category: 'protection',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-F',
    defaultFunctionText: 'Steuersicherung',
    width: 24,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
      <rect x="6" y="12" width="12" height="24" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="12" x2="12" y2="36" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="36" x2="12" y2="48" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Schmelzsicherung 1-polig'
  },

  // --- 3. BEFEHLS- & MELDEGERÄTE ---
  {
    id: 'pushbutton_no',
    name: 'Taster (Schließer)',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Taster EIN',
    width: 24,
    height: 48,
    pins: [
      { id: '13', name: '13', x: 12, y: 0, direction: 'top' },
      { id: '14', name: '14', x: 12, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="16" x2="22" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="32" x2="12" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="18" y1="21" x2="18" y2="14" stroke="currentColor" stroke-width="1.5"/>
      <line x1="14" y1="14" x2="22" y2="14" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Drucktaster Schließer mit Tastbetätigung'
  },
  {
    id: 'pushbutton_emergency_stop',
    name: 'Not-Halt-Taster (Öffner)',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'NOT-HALT',
    width: 32,
    height: 48,
    pins: [
      { id: '11', name: '11', x: 16, y: 0, direction: 'top' },
      { id: '12', name: '12', x: 16, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="16" x2="6" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="30" x2="16" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="32" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <!-- Pilzkopf -->
      <line x1="11" y1="21" x2="11" y2="12" stroke="currentColor" stroke-width="1.5"/>
      <path d="M 5 12 Q 11 6 17 12" fill="none" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Not-Halt Taster mit Rastung und Pilzkopf'
  },
  {
    id: 'pilot_lamp',
    name: 'Meldeleuchte',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-P',
    defaultFunctionText: 'Betriebsanzeige',
    width: 32,
    height: 48,
    pins: [
      { id: 'X1', name: 'X1', x: 16, y: 0, direction: 'top' },
      { id: 'X2', name: 'X2', x: 16, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="12" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="24" r="12" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="8" y1="16" x2="24" y2="32" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="16" x2="8" y2="32" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="36" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Optischer Signalgeber / Meldeleuchte'
  },

  // --- 4. MOTOREN & AKTOREN ---
  {
    id: 'motor_3phase',
    name: 'Drehstrommotor (3~)',
    category: 'motors',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-M',
    defaultFunctionText: 'Antriebsmotor',
    width: 72,
    height: 72,
    pins: [
      { id: 'U1', name: 'U1', x: 12, y: 0, direction: 'top' },
      { id: 'V1', name: 'V1', x: 36, y: 0, direction: 'top' },
      { id: 'W1', name: 'W1', x: 60, y: 0, direction: 'top' },
      { id: 'PE', name: 'PE', x: 68, y: 38, direction: 'right' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="28" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="0" x2="36" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="0" x2="60" y2="28" stroke="currentColor" stroke-width="2"/>
      <circle cx="36" cy="38" r="26" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="36" y="34" font-size="14" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="currentColor">M</text>
      <text x="36" y="50" font-size="11" text-anchor="middle" font-family="sans-serif" fill="currentColor">3 ~</text>
      <line x1="62" y1="38" x2="68" y2="38" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Drehstrom-Asynchronmotor mit PE-Anschluss'
  },

  // --- 5. KLEMMEN & VERBINDER ---
  {
    id: 'terminal_single',
    name: 'Reihenklemme',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Reihenklemme',
    width: 24,
    height: 40,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 40, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <circle cx="12" cy="20" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="24" x2="12" y2="40" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Durchgangsklemme für Klemmenleiste'
  },
  {
    id: 'terminal_pe',
    name: 'Schutzleiter-Klemme (PE)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'PE-Klemme',
    width: 24,
    height: 40,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 40, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <circle cx="12" cy="20" r="4" fill="currentColor"/>
      <line x1="12" y1="24" x2="12" y2="40" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Schutzleiterklemme mit Massekontakt'
  },
  {
    id: 'ground_pe',
    name: 'Erde / Schutzleiter (PE)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: 'PE',
    defaultFunctionText: 'Masse/Erde',
    width: 24,
    height: 28,
    pins: [
      { id: 'PE', name: 'PE', x: 12, y: 0, direction: 'top' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="18" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
      <line x1="9" y1="24" x2="15" y2="24" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Schutzerde / Masseanschluss'
  },

  // --- 6. SPANNUNGSVERSORGUNG & TRAFO ---
  {
    id: 'power_supply_dc',
    name: 'Schaltnetzteil 24V DC',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-G',
    defaultFunctionText: 'Steuerspannung 24VDC',
    width: 56,
    height: 64,
    pins: [
      { id: 'L', name: 'L', x: 14, y: 0, direction: 'top' },
      { id: 'N', name: 'N', x: 28, y: 0, direction: 'top' },
      { id: 'PE', name: 'PE', x: 42, y: 0, direction: 'top' },
      { id: '+', name: '+', x: 18, y: 64, direction: 'bottom' },
      { id: '-', name: '-', x: 38, y: 64, direction: 'bottom' }
    ],
    svgContent: `
      <rect x="6" y="10" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="54" x2="50" y2="10" stroke="currentColor" stroke-width="1.5"/>
      <text x="16" y="26" font-size="9" text-anchor="middle" fill="currentColor">~</text>
      <text x="40" y="44" font-size="9" text-anchor="middle" fill="currentColor">=</text>
      <!-- Eingänge oben -->
      <line x1="14" y1="0" x2="14" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="28" y1="0" x2="28" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="42" y1="0" x2="42" y2="10" stroke="currentColor" stroke-width="2"/>
      <!-- Ausgänge unten -->
      <line x1="18" y1="54" x2="18" y2="64" stroke="currentColor" stroke-width="2"/>
      <line x1="38" y1="54" x2="38" y2="64" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'AC/DC Schaltnetzteil 230V AC zu 24V DC'
  },
  {
    id: 'potential_arrow',
    name: 'Abbruchstelle (Potenzialpfeil)',
    category: 'connections',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '',
    defaultFunctionText: 'L1',
    width: 24,
    height: 24,
    pins: [
      { id: 'IN', name: 'IN', x: 12, y: 0, direction: 'top' },
      { id: 'OUT', name: 'OUT', x: 12, y: 22, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
      <polygon points="12,22 6,12 18,12" fill="currentColor"/>
    `,
    description: 'Abbruchstelle für Seitenquerverweis (Potenzialweiterführung)'
  },

  // --- 7. HERSTELLER-KOMPONENTEN & SCHALTGERÄTE ---
  {
    id: 'rcd_4p',
    name: 'FI-Schutzschalter (4-polig)',
    category: 'protection',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-F',
    defaultFunctionText: 'FI-Schutzschalter 40A/30mA',
    manufacturer: 'Hager',
    articleNumber: 'CDS440D',
    technicalCharacteristics: '4-polig 40A / 30mA Typ A',
    width: 84,
    height: 60,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 60, direction: 'bottom' },
      { id: '3', name: '3', x: 32, y: 0, direction: 'top' },
      { id: '4', name: '4', x: 32, y: 60, direction: 'bottom' },
      { id: '5', name: '5', x: 52, y: 0, direction: 'top' },
      { id: '6', name: '6', x: 52, y: 60, direction: 'bottom' },
      { id: 'N_in', name: 'N', x: 72, y: 0, direction: 'top' },
      { id: 'N_out', name: 'N', x: 72, y: 60, direction: 'bottom' }
    ],
    svgContent: `
      <!-- Pol 1 (L1) -->
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="16" x2="20" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="36" x2="12" y2="60" stroke="currentColor" stroke-width="2"/>

      <!-- Pol 2 (L2) -->
      <line x1="32" y1="0" x2="32" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="16" x2="40" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="36" x2="32" y2="60" stroke="currentColor" stroke-width="2"/>

      <!-- Pol 3 (L3) -->
      <line x1="52" y1="0" x2="52" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="52" y1="16" x2="60" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="52" y1="36" x2="52" y2="60" stroke="currentColor" stroke-width="2"/>

      <!-- Pol 4 (N) -->
      <line x1="72" y1="0" x2="72" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="72" y1="16" x2="80" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="72" y1="36" x2="72" y2="60" stroke="currentColor" stroke-width="2"/>

      <!-- Summenstromwandler (Ringkern-Oval) -->
      <ellipse cx="42" cy="48" rx="36" ry="7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2,2"/>
      
      <!-- Auslöserelais & Wirklinie -->
      <rect x="36" y="22" width="12" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="42" y1="32" x2="42" y2="41" stroke="currentColor" stroke-width="1.5"/>
      <line x1="16" y1="26" x2="76" y2="26" stroke="currentColor" stroke-width="1" stroke-dasharray="2,2"/>
      
      <!-- Prüftaste T -->
      <text x="76" y="48" font-size="8" font-weight="bold" fill="currentColor">T</text>
    `,
    description: 'Hager CDS440D Fehlerstromschutzschalter 4-polig 40A / 30mA Typ A'
  },
  {
    id: 'rcd_2p',
    name: 'FI-Schutzschalter (2-polig)',
    category: 'protection',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-F',
    defaultFunctionText: 'FI-Schutzschalter 25A/30mA',
    manufacturer: 'ABB',
    articleNumber: 'FH202-25/0.03',
    technicalCharacteristics: '2-polig 25A / 30mA Typ A',
    width: 48,
    height: 60,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 60, direction: 'bottom' },
      { id: 'N_in', name: 'N', x: 36, y: 0, direction: 'top' },
      { id: 'N_out', name: 'N', x: 36, y: 60, direction: 'bottom' }
    ],
    svgContent: `
      <!-- Pol 1 (L) -->
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="16" x2="20" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="36" x2="12" y2="60" stroke="currentColor" stroke-width="2"/>

      <!-- Pol 2 (N) -->
      <line x1="36" y1="0" x2="36" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="16" x2="44" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="36" x2="36" y2="60" stroke="currentColor" stroke-width="2"/>

      <!-- Wandler & Auslöser -->
      <ellipse cx="24" cy="48" rx="20" ry="6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2,2"/>
      <rect x="18" y="22" width="12" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="24" y1="32" x2="24" y2="42" stroke="currentColor" stroke-width="1.5"/>
      <line x1="16" y1="26" x2="40" y2="26" stroke="currentColor" stroke-width="1" stroke-dasharray="2,2"/>
      <text x="40" y="48" font-size="8" font-weight="bold" fill="currentColor">T</text>
    `,
    description: 'ABB FH202 2-poliger Fehlerstromschutzschalter 25A / 30mA'
  },
  {
    id: 'rcbo_1p_n',
    name: 'FI/LS-Kombischalter (1P+N)',
    category: 'protection',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-F',
    defaultFunctionText: 'FI/LS B16/30mA',
    manufacturer: 'Siemens',
    articleNumber: '5SV1316-6KK16',
    technicalCharacteristics: '1P+N B16A / 30mA 6kA (1 TE)',
    width: 48,
    height: 60,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 60, direction: 'bottom' },
      { id: 'N_in', name: 'N', x: 36, y: 0, direction: 'top' },
      { id: 'N_out', name: 'N', x: 36, y: 60, direction: 'bottom' }
    ],
    svgContent: `
      <!-- Pol 1 mit thermischer & magnetischer Auslösung -->
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="16" x2="20" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="36" x2="12" y2="60" stroke="currentColor" stroke-width="2"/>
      <rect x="8" y="42" width="8" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <polygon points="16,25 20,21 20,29" fill="currentColor"/>

      <!-- Pol 2 (N) -->
      <line x1="36" y1="0" x2="36" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="16" x2="44" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="36" x2="36" y2="60" stroke="currentColor" stroke-width="2"/>

      <!-- Differenzstromwandler -->
      <ellipse cx="24" cy="50" rx="18" ry="5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2,2"/>
      <text x="40" y="48" font-size="7" font-weight="bold" fill="currentColor">T</text>
    `,
    description: 'Siemens 5SV1 FI/LS-Schalter B16A / 30mA in 1 Teilungseinheit'
  },
  {
    id: 'impulse_relay_1no',
    name: 'Stromstoßrelais (1 Schließer)',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-K',
    defaultFunctionText: 'Stromstoßschalter Licht',
    manufacturer: 'Finder',
    articleNumber: '20.21.8.230.4000',
    technicalCharacteristics: '230V AC 16A 1 Schließer',
    width: 48,
    height: 52,
    pins: [
      { id: 'A1', name: 'A1', x: 12, y: 0, direction: 'top' },
      { id: 'A2', name: 'A2', x: 12, y: 52, direction: 'bottom' },
      { id: '1', name: '1', x: 36, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 36, y: 52, direction: 'bottom' }
    ],
    svgContent: `
      <!-- Spulenkörper mit Stromstoß-Schrittsymbol -->
      <rect x="4" y="14" width="16" height="24" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="0" x2="12" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="38" x2="12" y2="52" stroke="currentColor" stroke-width="2"/>
      <!-- Treppen-/Schrittsymbol im Relais -->
      <path d="M 6 30 L 10 30 L 10 24 L 14 24 L 14 18 L 18 18" fill="none" stroke="currentColor" stroke-width="1.5"/>

      <!-- Schaltglied (1-2) -->
      <line x1="36" y1="0" x2="36" y2="18" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="18" x2="44" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="34" x2="36" y2="52" stroke="currentColor" stroke-width="2"/>
      
      <!-- Mechanische Kopplung -->
      <line x1="20" y1="26" x2="40" y2="26" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2"/>
    `,
    description: 'Finder Serie 20 / Hager EPN510 Stromstoßschalter 230V AC 16A'
  },
  {
    id: 'impulse_relay_2no',
    name: 'Stromstoßrelais (2 Schließer)',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-K',
    defaultFunctionText: 'Stromstoßschalter 2-Kanal',
    manufacturer: 'Finder',
    articleNumber: '20.22.8.230.4000',
    technicalCharacteristics: '230V AC 16A 2 Schließer (Serienschaltung)',
    width: 64,
    height: 52,
    pins: [
      { id: 'A1', name: 'A1', x: 12, y: 0, direction: 'top' },
      { id: 'A2', name: 'A2', x: 12, y: 52, direction: 'bottom' },
      { id: '1', name: '1', x: 32, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 32, y: 52, direction: 'bottom' },
      { id: '3', name: '3', x: 52, y: 0, direction: 'top' },
      { id: '4', name: '4', x: 52, y: 52, direction: 'bottom' }
    ],
    svgContent: `
      <!-- Spulenkörper -->
      <rect x="4" y="14" width="16" height="24" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="0" x2="12" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="38" x2="12" y2="52" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 30 L 10 30 L 10 24 L 14 24 L 14 18 L 18 18" fill="none" stroke="currentColor" stroke-width="1.5"/>

      <!-- Kontakt 1 (1-2) -->
      <line x1="32" y1="0" x2="32" y2="18" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="18" x2="40" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="34" x2="32" y2="52" stroke="currentColor" stroke-width="2"/>

      <!-- Kontakt 2 (3-4) -->
      <line x1="52" y1="0" x2="52" y2="18" stroke="currentColor" stroke-width="2"/>
      <line x1="52" y1="18" x2="60" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="52" y1="34" x2="52" y2="52" stroke="currentColor" stroke-width="2"/>

      <!-- Mechanische Koppelachse -->
      <line x1="20" y1="26" x2="56" y2="26" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2"/>
    `,
    description: 'Finder Serie 20 / Eltako S12-200 Stromstoßschalter mit 2 Schließern'
  },
  {
    id: 'timer_relay_multifunction',
    name: 'Multifunktions-Zeitrelais',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-K',
    defaultFunctionText: 'Zeitrelais Ansprechverzögert',
    manufacturer: 'Eaton',
    articleNumber: 'ETR4-69-A',
    technicalCharacteristics: '24-240V AC/DC 1 Wechsler',
    width: 48,
    height: 56,
    pins: [
      { id: 'A1', name: 'A1', x: 12, y: 0, direction: 'top' },
      { id: 'A2', name: 'A2', x: 12, y: 56, direction: 'bottom' },
      { id: 'B1', name: 'B1', x: 24, y: 0, direction: 'top' },
      { id: '15', name: '15', x: 38, y: 0, direction: 'top' },
      { id: '16', name: '16', x: 32, y: 56, direction: 'bottom' },
      { id: '18', name: '18', x: 44, y: 56, direction: 'bottom' }
    ],
    svgContent: `
      <!-- Zeitrelais-Spule mit gekreuztem Feld -->
      <rect x="4" y="14" width="16" height="24" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="4" y1="14" x2="12" y2="38" stroke="currentColor" stroke-width="1.5"/>
      <line x1="12" y1="0" x2="12" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="38" x2="12" y2="56" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="0" x2="24" y2="20" stroke="currentColor" stroke-width="1.5"/>

      <!-- Wechslerkontakt (15, 16, 18) mit Verzögerungssymbol -->
      <line x1="38" y1="0" x2="38" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="38" y1="16" x2="32" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="36" x2="32" y2="56" stroke="currentColor" stroke-width="2"/>
      <line x1="44" y1="36" x2="44" y2="56" stroke="currentColor" stroke-width="2"/>
      <!-- Fallschirm / Verzögerungskappe -->
      <path d="M 33 22 A 4 4 0 0 1 39 22" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Eaton ETR4-69-A / Finder 80.01 Multifunktionszeitrelais (Ansprech- & Rückfallverzögert)'
  },
  {
    id: 'surge_arrester_spd',
    name: 'Überspannungsableiter Typ 2',
    category: 'protection',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-F',
    defaultFunctionText: 'Überspannungsschutz Typ 2',
    manufacturer: 'Dehn',
    articleNumber: 'DEHNguard DG M TNS 275',
    technicalCharacteristics: 'Typ 2 TNS-Netz 4-polig 20kA',
    width: 64,
    height: 52,
    pins: [
      { id: 'L1', name: 'L1', x: 10, y: 0, direction: 'top' },
      { id: 'L2', name: 'L2', x: 24, y: 0, direction: 'top' },
      { id: 'L3', name: 'L3', x: 38, y: 0, direction: 'top' },
      { id: 'N', name: 'N', x: 52, y: 0, direction: 'top' },
      { id: 'PE', name: 'PE', x: 32, y: 52, direction: 'bottom' }
    ],
    svgContent: `
      <!-- 4 Varistoren nebeneinander -->
      <rect x="6" y="16" width="8" height="18" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="4" y1="32" x2="16" y2="18" stroke="currentColor" stroke-width="1.5"/>
      <line x1="10" y1="0" x2="10" y2="16" stroke="currentColor" stroke-width="1.5"/>

      <rect x="20" y="16" width="8" height="18" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="18" y1="32" x2="30" y2="18" stroke="currentColor" stroke-width="1.5"/>
      <line x1="24" y1="0" x2="24" y2="16" stroke="currentColor" stroke-width="1.5"/>

      <rect x="34" y="16" width="8" height="18" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="32" y1="32" x2="44" y2="18" stroke="currentColor" stroke-width="1.5"/>
      <line x1="38" y1="0" x2="38" y2="16" stroke="currentColor" stroke-width="1.5"/>

      <rect x="48" y="16" width="8" height="18" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="46" y1="32" x2="58" y2="18" stroke="currentColor" stroke-width="1.5"/>
      <line x1="52" y1="0" x2="52" y2="16" stroke="currentColor" stroke-width="1.5"/>

      <!-- Sammelschiene unten auf PE -->
      <line x1="10" y1="34" x2="10" y2="42" stroke="currentColor" stroke-width="1.5"/>
      <line x1="24" y1="34" x2="24" y2="42" stroke="currentColor" stroke-width="1.5"/>
      <line x1="38" y1="34" x2="38" y2="42" stroke="currentColor" stroke-width="1.5"/>
      <line x1="52" y1="34" x2="52" y2="42" stroke="currentColor" stroke-width="1.5"/>
      <line x1="10" y1="42" x2="52" y2="42" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="42" x2="32" y2="52" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Dehn DEHNguard M TNS 275 Überspannungsableiter Typ 2'
  },

  // --- 8. VERBINDUNGSSYMBOLE & T-STÜCKE (DIN EN 60617 STANDARD) ---
  {
    id: 't_piece_down',
    name: 'T-Stück (Abzweig unten)',
    category: 'connections',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: 'T',
    defaultFunctionText: 'T-Stück unten',
    width: 20,
    height: 20,
    pins: [
      { id: '1', name: '1', x: 0, y: 10, direction: 'left', description: 'Durchgang links' },
      { id: '2', name: '2', x: 20, y: 10, direction: 'right', description: 'Durchgang rechts' },
      { id: '3', name: '3', x: 10, y: 20, direction: 'bottom', description: 'Abzweig unten' }
    ],
    svgContent: `
      <line x1="0" y1="10" x2="20" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="10" x2="10" y2="20" stroke="currentColor" stroke-width="2"/>
      <circle cx="10" cy="10" r="3" fill="currentColor"/>
    `,
    description: 'T-Verbindung Durchgang waagerecht mit Abzweig nach unten'
  },
  {
    id: 't_piece_up',
    name: 'T-Stück (Abzweig oben)',
    category: 'connections',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: 'T',
    defaultFunctionText: 'T-Stück oben',
    width: 20,
    height: 20,
    pins: [
      { id: '1', name: '1', x: 0, y: 10, direction: 'left', description: 'Durchgang links' },
      { id: '2', name: '2', x: 20, y: 10, direction: 'right', description: 'Durchgang rechts' },
      { id: '3', name: '3', x: 10, y: 0, direction: 'top', description: 'Abzweig oben' }
    ],
    svgContent: `
      <line x1="0" y1="10" x2="20" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="2"/>
      <circle cx="10" cy="10" r="3" fill="currentColor"/>
    `,
    description: 'T-Verbindung Durchgang waagerecht mit Abzweig nach oben'
  },
  {
    id: 't_piece_right',
    name: 'T-Stück (Abzweig rechts)',
    category: 'connections',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: 'T',
    defaultFunctionText: 'T-Stück rechts',
    width: 20,
    height: 20,
    pins: [
      { id: '1', name: '1', x: 10, y: 0, direction: 'top', description: 'Durchgang oben' },
      { id: '2', name: '2', x: 10, y: 20, direction: 'bottom', description: 'Durchgang unten' },
      { id: '3', name: '3', x: 20, y: 10, direction: 'right', description: 'Abzweig rechts' }
    ],
    svgContent: `
      <line x1="10" y1="0" x2="10" y2="20" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="10" x2="20" y2="10" stroke="currentColor" stroke-width="2"/>
      <circle cx="10" cy="10" r="3" fill="currentColor"/>
    `,
    description: 'T-Verbindung Durchgang senkrecht mit Abzweig nach rechts'
  },
  {
    id: 't_piece_left',
    name: 'T-Stück (Abzweig links)',
    category: 'connections',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: 'T',
    defaultFunctionText: 'T-Stück links',
    width: 20,
    height: 20,
    pins: [
      { id: '1', name: '1', x: 10, y: 0, direction: 'top', description: 'Durchgang oben' },
      { id: '2', name: '2', x: 10, y: 20, direction: 'bottom', description: 'Durchgang unten' },
      { id: '3', name: '3', x: 0, y: 10, direction: 'left', description: 'Abzweig links' }
    ],
    svgContent: `
      <line x1="10" y1="0" x2="10" y2="20" stroke="currentColor" stroke-width="2"/>
      <line x1="0" y1="10" x2="10" y2="10" stroke="currentColor" stroke-width="2"/>
      <circle cx="10" cy="10" r="3" fill="currentColor"/>
    `,
    description: 'T-Verbindung Durchgang senkrecht mit Abzweig nach links'
  },
  {
    id: 'corner_top_right',
    name: 'Winkel / Ecke (links-unten)',
    category: 'connections',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: 'W',
    defaultFunctionText: 'Winkel links-unten',
    width: 20,
    height: 20,
    pins: [
      { id: '1', name: '1', x: 0, y: 10, direction: 'left' },
      { id: '2', name: '2', x: 10, y: 20, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="0" y1="10" x2="10" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="10" x2="10" y2="20" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Eckenverbinder von links nach unten'
  },
  {
    id: 'corner_top_left',
    name: 'Winkel / Ecke (rechts-unten)',
    category: 'connections',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: 'W',
    defaultFunctionText: 'Winkel rechts-unten',
    width: 20,
    height: 20,
    pins: [
      { id: '1', name: '1', x: 20, y: 10, direction: 'right' },
      { id: '2', name: '2', x: 10, y: 20, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="20" y1="10" x2="10" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="10" x2="10" y2="20" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Eckenverbinder von rechts nach unten'
  },
  {
    id: 'corner_bottom_right',
    name: 'Winkel / Ecke (links-oben)',
    category: 'connections',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: 'W',
    defaultFunctionText: 'Winkel links-oben',
    width: 20,
    height: 20,
    pins: [
      { id: '1', name: '1', x: 0, y: 10, direction: 'left' },
      { id: '2', name: '2', x: 10, y: 0, direction: 'top' }
    ],
    svgContent: `
      <line x1="0" y1="10" x2="10" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Eckenverbinder von links nach oben'
  },
  {
    id: 'corner_bottom_left',
    name: 'Winkel / Ecke (rechts-oben)',
    category: 'connections',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: 'W',
    defaultFunctionText: 'Winkel rechts-oben',
    width: 20,
    height: 20,
    pins: [
      { id: '1', name: '1', x: 20, y: 10, direction: 'right' },
      { id: '2', name: '2', x: 10, y: 0, direction: 'top' }
    ],
    svgContent: `
      <line x1="20" y1="10" x2="10" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Eckenverbinder von rechts nach oben'
  },
  {
    id: 'cross_junction',
    name: 'Kreuzung mit Verbindungspunkt',
    category: 'connections',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: 'X',
    defaultFunctionText: 'Kreuzungsverbindung',
    width: 20,
    height: 20,
    pins: [
      { id: '1', name: '1', x: 10, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 10, y: 20, direction: 'bottom' },
      { id: '3', name: '3', x: 0, y: 10, direction: 'left' },
      { id: '4', name: '4', x: 20, y: 10, direction: 'right' }
    ],
    svgContent: `
      <line x1="10" y1="0" x2="10" y2="20" stroke="currentColor" stroke-width="2"/>
      <line x1="0" y1="10" x2="20" y2="10" stroke="currentColor" stroke-width="2"/>
      <circle cx="10" cy="10" r="3.5" fill="currentColor"/>
    `,
    description: 'Elektrische 4-fach Kreuzung mit Knotenpunkt'
  },
  {
    id: 'cross_bridge',
    name: 'Kreuzung ohne Verbindung (Brücke)',
    category: 'connections',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: 'X',
    defaultFunctionText: 'Überbrückung',
    width: 20,
    height: 20,
    pins: [
      { id: '1', name: '1', x: 10, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 10, y: 20, direction: 'bottom' },
      { id: '3', name: '3', x: 0, y: 10, direction: 'left' },
      { id: '4', name: '4', x: 20, y: 10, direction: 'right' }
    ],
    svgContent: `
      <line x1="10" y1="0" x2="10" y2="20" stroke="currentColor" stroke-width="2"/>
      <line x1="0" y1="10" x2="6" y2="10" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 10 A 4 4 0 0 1 14 10" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="14" y1="10" x2="20" y2="10" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Kreuzende Leitungen ohne elektrische Verbindung (Sprungbogen)'
  },
  {
    id: 'potential_arrow_right',
    name: 'Abbruchstelle / Potentialpfeil rechts',
    category: 'connections',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '',
    defaultFunctionText: 'L1',
    width: 30,
    height: 20,
    pins: [
      { id: '1', name: '1', x: 0, y: 10, direction: 'left' },
      { id: '2', name: '2', x: 28, y: 10, direction: 'right' }
    ],
    svgContent: `
      <line x1="0" y1="10" x2="16" y2="10" stroke="currentColor" stroke-width="2"/>
      <polygon points="16,4 28,10 16,16" fill="currentColor"/>
    `,
    description: 'Potentialweiterleitung / Abbruchstelle nach rechts'
  },
  {
    id: 'potential_arrow_left',
    name: 'Abbruchstelle / Potentialpfeil links',
    category: 'connections',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '',
    defaultFunctionText: 'L1',
    width: 30,
    height: 20,
    pins: [
      { id: '1', name: '1', x: 30, y: 10, direction: 'right' },
      { id: '2', name: '2', x: 2, y: 10, direction: 'left' }
    ],
    svgContent: `
      <line x1="30" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="2"/>
      <polygon points="14,4 2,10 14,16" fill="currentColor"/>
    `,
    description: 'Potentialweiterleitung / Abbruchstelle nach links'
  },
  {
    id: 'potential_arrow_down',
    name: 'Abbruchstelle / Potentialpfeil unten',
    category: 'connections',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '',
    defaultFunctionText: '+24V',
    width: 24,
    height: 30,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 28, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <polygon points="6,16 12,28 18,16" fill="currentColor"/>
    `,
    description: 'Potentialweiterleitung / Abbruchstelle nach unten'
  },
  {
    id: 'potential_arrow_up',
    name: 'Abbruchstelle / Potentialpfeil oben',
    category: 'connections',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '',
    defaultFunctionText: '0V',
    width: 24,
    height: 30,
    pins: [
      { id: '1', name: '1', x: 12, y: 30, direction: 'bottom' },
      { id: '2', name: '2', x: 12, y: 2, direction: 'top' }
    ],
    svgContent: `
      <line x1="12" y1="30" x2="12" y2="14" stroke="currentColor" stroke-width="2"/>
      <polygon points="6,14 12,2 18,14" fill="currentColor"/>
    `,
    description: 'Potentialweiterleitung / Abbruchstelle nach oben'
  },
  {
    id: 'circuit_breaker_3p',
    name: 'Leitungsschutzschalter (3-polig)',
    category: 'protection',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-F',
    defaultFunctionText: 'LS-Schalter 3P',
    width: 72,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 48, direction: 'bottom' },
      { id: '3', name: '3', x: 36, y: 0, direction: 'top' },
      { id: '4', name: '4', x: 36, y: 48, direction: 'bottom' },
      { id: '5', name: '5', x: 60, y: 0, direction: 'top' },
      { id: '6', name: '6', x: 60, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="34" x2="12" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="14" x2="22" y2="32" stroke="currentColor" stroke-width="2"/>
      <rect x="7" y="18" width="5" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M 17 28 Q 14 30 19 32" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="36" y1="0" x2="36" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="34" x2="36" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="14" x2="46" y2="32" stroke="currentColor" stroke-width="2"/>
      <rect x="31" y="18" width="5" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M 41 28 Q 38 30 43 32" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="60" y1="0" x2="60" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="34" x2="60" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="14" x2="70" y2="32" stroke="currentColor" stroke-width="2"/>
      <rect x="55" y="18" width="5" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M 65 28 Q 62 30 67 32" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="17" y1="23" x2="65" y2="23" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2"/>
    `,
    description: '3-poliger Leitungsschutzschalter mit thermisch-magnetischer Auslösung'
  },
  {
    id: 'circuit_breaker_1p',
    name: 'Leitungsschutzschalter (1-polig)',
    category: 'protection',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-F',
    defaultFunctionText: 'LS-Schalter 1P',
    width: 24,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="14" x2="22" y2="32" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="34" x2="12" y2="48" stroke="currentColor" stroke-width="2"/>
      <rect x="7" y="18" width="5" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M 17 28 Q 14 30 19 32" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: '1-poliger Leitungsschutzschalter mit thermisch-magnetischer Auslösung'
  },
  {
    id: 'fuse_switch_3p',
    name: 'Sicherungs-Lasttrennschalter (3-polig, NH)',
    category: 'protection',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-F',
    defaultFunctionText: 'NH-Trenner 3P',
    width: 72,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 48, direction: 'bottom' },
      { id: '3', name: '3', x: 36, y: 0, direction: 'top' },
      { id: '4', name: '4', x: 36, y: 48, direction: 'bottom' },
      { id: '5', name: '5', x: 60, y: 0, direction: 'top' },
      { id: '6', name: '6', x: 60, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="34" x2="12" y2="48" stroke="currentColor" stroke-width="2"/>
      <rect x="7" y="14" width="10" height="20" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="10" x2="12" y2="38" stroke="currentColor" stroke-width="1.5"/>
      <line x1="36" y1="0" x2="36" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="34" x2="36" y2="48" stroke="currentColor" stroke-width="2"/>
      <rect x="31" y="14" width="10" height="20" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="10" x2="36" y2="38" stroke="currentColor" stroke-width="1.5"/>
      <line x1="60" y1="0" x2="60" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="34" x2="60" y2="48" stroke="currentColor" stroke-width="2"/>
      <rect x="55" y="14" width="10" height="20" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="10" x2="60" y2="38" stroke="currentColor" stroke-width="1.5"/>
      <line x1="17" y1="23" x2="65" y2="23" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2"/>
    `,
    description: '3-poliger NH-Sicherungs-Lasttrennschalter'
  },
  {
    id: 'changeover_switch_4p',
    name: 'Netz-Notstrom-Umschalter (4-polig)',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-Q',
    defaultFunctionText: 'Umschalter I-0-II',
    width: 96,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 48, direction: 'bottom' },
      { id: '3', name: '3', x: 36, y: 0, direction: 'top' },
      { id: '4', name: '4', x: 36, y: 48, direction: 'bottom' },
      { id: '5', name: '5', x: 60, y: 0, direction: 'top' },
      { id: '6', name: '6', x: 60, y: 48, direction: 'bottom' },
      { id: '7', name: '7', x: 84, y: 0, direction: 'top' },
      { id: '8', name: '8', x: 84, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="34" x2="12" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="14" x2="22" y2="32" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="0" x2="36" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="34" x2="36" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="14" x2="46" y2="32" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="0" x2="60" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="34" x2="60" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="14" x2="70" y2="32" stroke="currentColor" stroke-width="2"/>
      <line x1="84" y1="0" x2="84" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="84" y1="34" x2="84" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="84" y1="14" x2="94" y2="32" stroke="currentColor" stroke-width="2"/>
      <line x1="17" y1="23" x2="89" y2="23" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2"/>
    `,
    description: '4-poliger Umschalter Netz/Notstrom mit Nullstellung'
  },
  {
    id: 'main_switch_4p',
    name: 'Hauptschalter / Lasttrennschalter (4-polig)',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-Q',
    defaultFunctionText: 'Hauptschalter 4P',
    width: 96,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 48, direction: 'bottom' },
      { id: '3', name: '3', x: 36, y: 0, direction: 'top' },
      { id: '4', name: '4', x: 36, y: 48, direction: 'bottom' },
      { id: '5', name: '5', x: 60, y: 0, direction: 'top' },
      { id: '6', name: '6', x: 60, y: 48, direction: 'bottom' },
      { id: '7', name: '7', x: 84, y: 0, direction: 'top' },
      { id: '8', name: '8', x: 84, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <g stroke="currentColor" stroke-width="2">
        <line x1="12" y1="0" x2="12" y2="14"/><line x1="12" y1="14" x2="22" y2="32"/><line x1="12" y1="34" x2="12" y2="48"/><line x1="20" y1="32" x2="24" y2="32"/>
        <line x1="36" y1="0" x2="36" y2="14"/><line x1="36" y1="14" x2="46" y2="32"/><line x1="36" y1="34" x2="36" y2="48"/><line x1="44" y1="32" x2="48" y2="32"/>
        <line x1="60" y1="0" x2="60" y2="14"/><line x1="60" y1="14" x2="70" y2="32"/><line x1="60" y1="34" x2="60" y2="48"/><line x1="68" y1="32" x2="72" y2="32"/>
        <line x1="84" y1="0" x2="84" y2="14"/><line x1="84" y1="14" x2="94" y2="32"/><line x1="84" y1="34" x2="84" y2="48"/><line x1="92" y1="32" x2="96" y2="32"/>
      </g>
      <line x1="17" y1="23" x2="89" y2="23" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2"/>
    `,
    description: '4-poliger Lasttrennschalter'
  },
  {
    id: 'energy_meter_3p',
    name: 'Drehstromzähler (elektronisch)',
    category: 'sensors',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-Z',
    defaultFunctionText: 'Energiezähler',
    width: 96,
    height: 48,
    pins: [
      { id: 'L1', name: 'L1', x: 12, y: 0, direction: 'top' },
      { id: 'L2', name: 'L2', x: 36, y: 0, direction: 'top' },
      { id: 'L3', name: 'L3', x: 60, y: 0, direction: 'top' },
      { id: 'N', name: 'N', x: 84, y: 0, direction: 'top' },
      { id: '1', name: '1', x: 12, y: 48, direction: 'bottom' },
      { id: '2', name: '2', x: 36, y: 48, direction: 'bottom' },
      { id: '3', name: '3', x: 60, y: 48, direction: 'bottom' },
      { id: '4', name: 'N', x: 84, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <rect x="4" y="10" width="88" height="28" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="48" y="27" font-size="10" font-family="sans-serif" font-weight="bold" fill="currentColor" text-anchor="middle">kWh</text>
      <line x1="12" y1="0" x2="12" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="38" x2="12" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="0" x2="36" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="38" x2="36" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="0" x2="60" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="38" x2="60" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="84" y1="0" x2="84" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="84" y1="38" x2="84" y2="48" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Drehstrom-Wirkleistungszähler für Hutschienenmontage'
  },
  {
    id: 'motor_1phase',
    name: 'Wechselstrommotor (1~)',
    category: 'motors',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-M',
    defaultFunctionText: 'Antriebsmotor 1~',
    width: 48,
    height: 48,
    pins: [
      { id: 'L', name: 'L', x: 12, y: 0, direction: 'top' },
      { id: 'N', name: 'N', x: 24, y: 0, direction: 'top' },
      { id: 'PE', name: 'PE', x: 36, y: 0, direction: 'top' }
    ],
    svgContent: `
      <circle cx="24" cy="28" r="18" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="24" y="26" font-size="11" font-weight="bold" font-family="sans-serif" text-anchor="middle" fill="currentColor">M</text>
      <text x="24" y="38" font-size="9" font-family="sans-serif" text-anchor="middle" fill="currentColor">1~</text>
      <line x1="12" y1="0" x2="12" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="0" x2="24" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="0" x2="36" y2="10" stroke="currentColor" stroke-width="2"/>
    `,
    description: '1-phasiger Wechselstrommotor (Rolladen, Pumpe, Absaugung)'
  },
  {
    id: 'socket_schuko',
    name: 'Schutzkontakt-Steckdose (Schuko)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Steckdose',
    width: 36,
    height: 36,
    pins: [
      { id: '1', name: '1', x: 10, y: 0, direction: 'top' },
      { id: 'PE', name: 'PE', x: 18, y: 0, direction: 'top' },
      { id: 'N', name: 'N', x: 26, y: 0, direction: 'top' }
    ],
    svgContent: `
      <line x1="10" y1="0" x2="10" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="18" y1="0" x2="18" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="26" y1="0" x2="26" y2="16" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 16 A 12 12 0 0 0 30 16 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="18" y1="16" x2="18" y2="28" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Schuko Steckdose 230V mit Schutzleiter'
  },
  {
    id: 'socket_switch',
    name: 'Schaltersteckdose',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-XB',
    defaultFunctionText: 'Schaltersteckdose',
    width: 48,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '3', name: '3', x: 24, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 36, y: 0, direction: 'top' }
    ],
    svgContent: `
      <rect x="4" y="12" width="40" height="26" fill="none" stroke="currentColor" stroke-width="2" rx="3"/>
      <line x1="12" y1="0" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="0" x2="24" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="0" x2="36" y2="12" stroke="currentColor" stroke-width="2"/>
      <circle cx="24" cy="25" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="20" y1="21" x2="28" y2="29" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Kombinierte Schalter-Steckdoseneinheit'
  },
  {
    id: 'light_bulb',
    name: 'Leuchte / Lampe',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-E',
    defaultFunctionText: 'Leuchte',
    width: 32,
    height: 32,
    pins: [
      { id: 'x1', name: 'x1', x: 16, y: 0, direction: 'top' },
      { id: 'x2', name: 'x2', x: 16, y: 32, direction: 'bottom' },
      { id: 'PE', name: 'PE', x: 32, y: 16, direction: 'right' }
    ],
    svgContent: `
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="7.5" y1="7.5" x2="24.5" y2="24.5" stroke="currentColor" stroke-width="2"/>
      <line x1="24.5" y1="7.5" x2="7.5" y2="24.5" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="0" x2="16" y2="4" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="28" x2="16" y2="32" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Allgemeine Leuchte mit Schutzkontakt'
  },
  {
    id: 'rj45_port',
    name: 'RJ45 Netzwerkanschluss',
    category: 'connections',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-ETH',
    defaultFunctionText: 'Netzwerkdose',
    width: 32,
    height: 32,
    pins: [
      { id: 'ETH', name: 'ETH', x: 16, y: 0, direction: 'top' }
    ],
    svgContent: `
      <rect x="4" y="8" width="24" height="20" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <rect x="9" y="14" width="14" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
      <text x="16" y="21" font-size="6" font-family="sans-serif" font-weight="bold" fill="currentColor" text-anchor="middle">ETH</text>
    `,
    description: 'Ethernet-Netzwerkanschluss (RJ45)'
  },
  {
    id: 'valve_actuator',
    name: 'Thermoelektrischer Stellantrieb',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-Y',
    defaultFunctionText: 'Stellantrieb',
    width: 32,
    height: 32,
    pins: [
      { id: 'X1', name: 'X1', x: 16, y: 0, direction: 'top' },
      { id: 'X2', name: 'X2', x: 16, y: 32, direction: 'bottom' }
    ],
    svgContent: `
      <polygon points="6,6 26,26 6,26 26,6" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="16" x2="16" y2="32" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Thermoelektrischer Heizkreisventil-Stellantrieb'
  },
  {
    id: 'thermostat_box',
    name: 'Raumthermostat',
    category: 'sensors',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Raumthermostat',
    width: 60,
    height: 48,
    pins: [
      { id: 'L', name: 'L(+)', x: 10, y: 0, direction: 'top' },
      { id: 'N', name: 'N(-)', x: 22, y: 0, direction: 'top' },
      { id: 'PE', name: 'PE', x: 34, y: 0, direction: 'top' },
      { id: '1', name: '1', x: 44, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 54, y: 0, direction: 'top' }
    ],
    svgContent: `
      <line x1="10" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="22" y1="0" x2="22" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="34" y1="0" x2="34" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="44" y1="0" x2="44" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="54" y1="0" x2="54" y2="10" stroke="currentColor" stroke-width="2"/>
      <rect x="4" y="10" width="52" height="28" fill="none" stroke="currentColor" stroke-width="2" rx="2"/>
      <path d="M 24 16 L 36 16 L 30 28 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <text x="30" y="34" font-size="7" font-family="sans-serif" fill="currentColor" text-anchor="middle">°C</text>
    `,
    description: 'Elektronischer Raumtemperaturregler'
  },
  {
    id: 'inverter_solar',
    name: 'PV-Hybridwechselrichter & Speicher',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-TB',
    defaultFunctionText: 'Hybridwechselrichter',
    width: 120,
    height: 70,
    pins: [
      { id: 'L1', name: 'L1', x: 20, y: 70, direction: 'bottom' },
      { id: 'L2', name: 'L2', x: 40, y: 70, direction: 'bottom' },
      { id: 'L3', name: 'L3', x: 60, y: 70, direction: 'bottom' },
      { id: 'N', name: 'N', x: 80, y: 70, direction: 'bottom' },
      { id: 'PE', name: 'PE', x: 100, y: 70, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="20" y1="70" x2="20" y2="60" stroke="currentColor" stroke-width="2"/>
      <line x1="40" y1="70" x2="40" y2="60" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="70" x2="60" y2="60" stroke="currentColor" stroke-width="2"/>
      <line x1="80" y1="70" x2="80" y2="60" stroke="currentColor" stroke-width="2"/>
      <line x1="100" y1="70" x2="100" y2="60" stroke="currentColor" stroke-width="2"/>
      <rect x="4" y="10" width="112" height="50" fill="none" stroke="currentColor" stroke-width="2" rx="4"/>
      <line x1="4" y1="10" x2="116" y2="60" stroke="currentColor" stroke-width="1.5"/>
      <text x="30" y="45" font-size="10" font-family="sans-serif" font-weight="bold" fill="currentColor">DC</text>
      <text x="80" y="28" font-size="10" font-family="sans-serif" font-weight="bold" fill="currentColor">AC ~</text>
    `,
    description: 'Photovoltaik Hybridwechselrichter mit integriertem Speicher'
  },
  {
    id: 'electronic_relay_4ch',
    name: 'Elektronisches 4-Kanal Stromstoßrelais',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-K',
    defaultFunctionText: 'ESR12Z-4DX-UC',
    width: 140,
    height: 70,
    pins: [
      { id: 'A1', name: 'A1', x: 20, y: 0, direction: 'top' },
      { id: 'A3', name: 'A3', x: 44, y: 0, direction: 'top' },
      { id: 'A5', name: 'A5', x: 70, y: 0, direction: 'top' },
      { id: 'A7', name: 'A7', x: 96, y: 0, direction: 'top' },
      { id: 'B1', name: 'B1(+)', x: 116, y: 0, direction: 'top' },
      { id: 'N', name: 'N(-)', x: 130, y: 0, direction: 'top' },
      { id: 'F1', name: 'F1', x: 44, y: 70, direction: 'bottom' },
      { id: 'E1', name: 'E1', x: 70, y: 70, direction: 'bottom' },
      { id: 'H1', name: 'H1', x: 96, y: 70, direction: 'bottom' },
      { id: 'G1', name: 'G1', x: 116, y: 70, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="20" y1="0" x2="20" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="44" y1="0" x2="44" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="70" y1="0" x2="70" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="96" y1="0" x2="96" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="116" y1="0" x2="116" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="130" y1="0" x2="130" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="44" y1="70" x2="44" y2="60" stroke="currentColor" stroke-width="2"/>
      <line x1="70" y1="70" x2="70" y2="60" stroke="currentColor" stroke-width="2"/>
      <line x1="96" y1="70" x2="96" y2="60" stroke="currentColor" stroke-width="2"/>
      <line x1="116" y1="70" x2="116" y2="60" stroke="currentColor" stroke-width="2"/>
      <rect x="4" y="10" width="132" height="50" fill="none" stroke="currentColor" stroke-width="2" rx="3"/>
      <text x="70" y="32" font-size="9" font-family="sans-serif" font-weight="bold" fill="currentColor" text-anchor="middle">ESR12Z-4DX-UC</text>
      <text x="70" y="44" font-size="7" font-family="sans-serif" fill="currentColor" text-anchor="middle">4-Kanal Multifunktion</text>
    `,
    description: 'Elektronischer 4-Kanal Stromstoß-Schaltrelais-Aktor'
  },
  {
    id: 'potential_rail_source',
    name: 'Potentialeinspeisepunkt',
    category: 'connections',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '',
    defaultFunctionText: 'Potential',
    width: 24,
    height: 16,
    pins: [
      { id: '1', name: '1', x: 24, y: 8, direction: 'right' }
    ],
    svgContent: `
      <circle cx="8" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="11.5" y1="8" x2="24" y2="8" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Potentialeinspeisung / Schienenanschluss an Sammelschiene'
  },
  {
    id: 'switch_single',
    name: 'Schalter / Taster (1-polig)',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Schalter',
    width: 24,
    height: 40,
    pins: [
      { id: '13', name: '13', x: 12, y: 0, direction: 'top' },
      { id: '14', name: '14', x: 12, y: 40, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="14" x2="20" y2="28" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="28" x2="12" y2="40" stroke="currentColor" stroke-width="2"/>
      <circle cx="12" cy="14" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="28" r="1.5" fill="currentColor"/>
    `,
    description: 'Einpoliger Schalter / Taster Schließerkontakt 13-14'
  }
];

SYMBOL_DEFINITIONS.push(...STANDARD_IEC_SYMBOLS, ...INSTALLATION_SYMBOLS, ...EXTENDED_SYMBOL_DEFINITIONS, DEVICE_BOX_SYMBOL);

for (const symbol of SYMBOL_DEFINITIONS) {
  symbol.unitsPerMm = 2;
  symbol.insertionPoint = /^(t_piece_|corner_|cross_)/.test(symbol.id)
    ? { x: symbol.width / 2, y: symbol.height / 2 }
    : { x: symbol.pins[0]?.x ?? 0, y: symbol.pins[0]?.y ?? 0 };
}

let activeProject: Project | undefined;
const scaledBuiltins = new WeakMap<SymbolDefinition, Map<number, SymbolDefinition>>();

export function getDrawingUnitsPerMm(project: Project | undefined = activeProject): number {
  return project?.drawingUnitsPerMm ?? 2;
}

function inProjectUnits(symbol: SymbolDefinition, project?: Project): SymbolDefinition {
  const target = project?.drawingUnitsPerMm;
  if (!target || symbol.source && symbol.unitsPerMm === undefined) return symbol;
  if (SYMBOL_DEFINITIONS.includes(symbol)) {
    let cached = scaledBuiltins.get(symbol);
    if (!cached) scaledBuiltins.set(symbol, cached = new Map());
    if (!cached.has(target)) cached.set(target, scaleSymbolDefinition(symbol, target));
    return cached.get(target)!;
  }
  return symbol.unitsPerMm ? scaleSymbolDefinition(symbol, target) : symbol;
}

/** The active project's master data is scoped to that project, never added to built-ins. */
export function getSymbolDefinitions(project: Project | undefined = activeProject): SymbolDefinition[] {
  const symbols = new Map(SYMBOL_DEFINITIONS.map(symbol => [symbol.id, symbol]));
  for (const symbol of project?.symbolLibrary ?? []) symbols.set(symbol.id, symbol);
  return [...symbols.values()].map(s => inProjectUnits(s, project));
}

export function getSymbolById(id: string, project: Project | undefined = activeProject): SymbolDefinition | undefined {
  const symbol = project?.symbolLibrary?.find(symbol => symbol.id === id)
    ?? SYMBOL_DEFINITIONS.find(symbol => symbol.id === id);
  return symbol && inProjectUnits(symbol, project);
}

/** Merge portable master data without changing definitions already used by a project. */
export function mergeProjectSymbolLibrary(
  project: Project,
  definitions: SymbolDefinition[],
  components: PlacedComponent[] = []
): void {
  const library = project.symbolLibrary ??= [];
  const remappedIds = new Map<string, string>();
  const reservedIds = new Set(definitions.map(symbol => symbol.id));
  for (const definition of definitions) {
    let id = definition.id;
    let suffix = 1;
    let existing = library.find(symbol => symbol.id === id)
      ?? SYMBOL_DEFINITIONS.find(symbol => symbol.id === id);
    const sameDefinition = (symbol: SymbolDefinition) =>
      JSON.stringify({ ...symbol, id: definition.id }) === JSON.stringify(definition);
    while (existing && !sameDefinition(existing)) {
      do { id = `${definition.id}:import-${suffix++}`; } while (reservedIds.has(id));
      existing = library.find(symbol => symbol.id === id)
        ?? SYMBOL_DEFINITIONS.find(symbol => symbol.id === id);
    }
    if (!existing) library.push(JSON.parse(JSON.stringify({ ...definition, id })));
    remappedIds.set(definition.id, id);
  }
  for (const component of components) {
    component.symbolId = remappedIds.get(component.symbolId) ?? component.symbolId;
  }
}

/** Activate on project load/switch, migrating older inline placement geometry once. */
export function setProjectSymbolLibrary(project: Project): void {
  migrateLegacyData(project);
  project.symbolLibrary ??= [];
  for(const definition of project.symbolLibrary)if(isDeviceBoxDefinition(definition)){definition.deviceBox=true;definition.category='structure';if(!definition.name.includes('Gerätekasten'))definition.name='Gerätekasten · '+definition.name;}
  for (const page of project.pages) {
    const frames=page.boxes?.filter(box=>box.kind==='device')??[];
    for(const box of frames)if(!page.components.some(c=>c.id===box.id))page.components.push(componentFromBox(box,project.drawingUnitsPerMm??2));
    if(frames.length){page.boxes=page.boxes!.filter(box=>box.kind!=='device');for(const group of page.groups??[])for(const member of group.members)if(member.kind==='box'&&frames.some(box=>box.id===member.id))member.kind='component';}
    for (const component of page.components) {
      const master=component.importedSymbol??getSymbolById(component.symbolId,project);
      if(!component.deviceBox&&isDeviceBoxDefinition(master))component.deviceBox=geometryFromSymbol(master!);
      if (!component.importedSymbol) continue;
      const definition = component.importedSymbol;
      component.symbolId = definition.id;
      mergeProjectSymbolLibrary(project, [definition], [component]);
      delete component.importedSymbol;
    }
  }
  activeProject = project;
}

/** Include project master data when exporting a reusable macro. */
export function getComponentSymbolLibrary(components: PlacedComponent[]): SymbolDefinition[] {
  const ids = new Set(components.map(component => component.symbolId));
  return JSON.parse(JSON.stringify([...ids].flatMap(id => {
    const s = getSymbolById(id);
    return s && (activeProject?.symbolLibrary?.some(d => d.id === id) || s.unitsPerMm !== 2) ? [s] : [];
  })));
}

export function getSymbolForComponent(comp: PlacedComponent, project: Project | undefined = activeProject): SymbolDefinition | undefined {
  // Read compatibility for callers holding a legacy placement before project migration.
  const base=comp.importedSymbol ?? getSymbolById(comp.symbolId, project);
  return base && deviceBoxDefinition(comp,base);
}

export { STANDARD_IEC_SYMBOLS } from './StandardIecSymbols';
export { INSTALLATION_SYMBOLS } from './InstallationSymbols';
