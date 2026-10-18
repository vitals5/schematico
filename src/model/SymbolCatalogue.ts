import type { SymbolDefinition } from './types';

export const ELEMENT_CATEGORIES: { id: SymbolDefinition['category']; label: string }[] = [
  { id: 'protection', label: 'Schutzgeräte' }, { id: 'relays', label: 'Schaltgeräte & Relais' },
  { id: 'terminals', label: 'Klemmen & Verbindungstechnik' }, { id: 'supply', label: 'Versorgung & Messtechnik' },
  { id: 'controls', label: 'Befehls- & Meldegeräte' }, { id: 'sensors', label: 'Sensorik' },
  { id: 'automation', label: 'Steuerung & Kommunikation' }, { id: 'motors', label: 'Antriebe & Leistungselektronik' },
  { id: 'installation', label: 'Gebäudetechnik & Installation' }, { id: 'structure', label: 'Schrankbau & Struktur' }
];
const normalized = (value: string) => value.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
  .normalize('NFKD').replace(/\p{M}/gu,'').replace(/[\/_,;|]/g,' ');
export function symbolMatchesQuery(symbol: SymbolDefinition, query: string): boolean {
  const text = normalized([symbol.name, symbol.description, symbol.defaultBmkPrefix, symbol.manufacturer, symbol.articleNumber,
    symbol.technicalCharacteristics, symbol.family, ...(symbol.keywords ?? []), ...(symbol.bmkPrefixes ?? []),
    ...Object.values(symbol.variantProperties ?? {})].filter(Boolean).join(' '));
  return normalized(query).trim().split(/\s+/).every(word => word.length===1 && /[a-z0-9]/.test(word)
    ? new RegExp(`(?<![a-z0-9+])${word}(?![a-z0-9+])`).test(text) : text.includes(word));
}
