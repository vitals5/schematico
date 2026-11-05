import type { SymbolDefinition } from './types';

export type ElectricalKnowledge = 'explicit' | 'legacy' | 'unknown';
const standardDefinitions = new Map<string, SymbolDefinition>();

/** Register application-owned masters, never project/import definitions. */
export function registerStandardElectricalDefinition(symbol: SymbolDefinition): void {
  standardDefinitions.set(symbol.id, symbol);
}

function legacyMaster(symbol: SymbolDefinition): SymbolDefinition | undefined {
  const master = !symbol.source && standardDefinitions.get(symbol.id);
  return master && master.pins.length === symbol.pins.length
    && master.pins.every(p => symbol.pins.some(other => other.id === p.id)) ? master : undefined;
}

export function electricalPinRole(symbol: SymbolDefinition, pinId: string) {
  const role = symbol.pins.find(p => p.id === pinId)?.electricalRole;
  if (role || symbol.electrical || symbol.unresolved) return role ?? 'unknown';
  return legacyMaster(symbol)?.pins.find(p => p.id === pinId)?.electricalRole ?? 'unknown';
}

/** Narrow compatibility rules for pre-metadata standard symbols and documented
 * routing-library primitives. Unknown imported equipment is never joined merely
 * because of its category, appearance, pin labels or repeated device tag. */
export function electricalDefinition(symbol: SymbolDefinition): {
  knowledge: ElectricalKnowledge;
  definition?: NonNullable<SymbolDefinition['electrical']>;
} {
  if (symbol.unresolved) return { knowledge: 'unknown' };
  if (symbol.electrical) return { knowledge: 'explicit', definition: symbol.electrical };
  const master = legacyMaster(symbol);
  if (master?.electrical) return { knowledge: 'legacy', definition: master.electrical };
  if (!symbol.source && standardDefinitions.has(symbol.id)) return { knowledge: 'unknown' };
  const source = symbol.source;
  const nativeRouting = source?.library === 'SPECIAL'
    && [8, 64, 66, 67, 70, 72, 75, 78].includes(source.number);
  const genericRouting = !source && (
    /^(t_piece_(up|down|left|right|directed_(top|right|bottom|left)_(top|right|bottom|left)|bus_(top|right|bottom|left))|corner_(top_right|top_left|bottom_right|bottom_left|(compact|bus)_(left|right)_(top|bottom)(_(left|right|top|bottom))?)|potential_arrow(_(up|down|left|right)|_open_(up|down|left|right))?|cross_junction(_bus_(top|right|bottom|left))?)$/.test(symbol.id)
    || ['terminal_single', 'terminal_pe'].includes(symbol.id));
  if (nativeRouting || genericRouting)
    return { knowledge: 'legacy', definition: { permanentConnections: [symbol.pins.map(p => p.id)] } };
  if (!source && symbol.id === 'cross_bridge')
    return { knowledge: 'legacy', definition: { permanentConnections: [['1', '2'], ['3', '4']] } };
  return { knowledge: 'unknown' };
}

/** Validate untrusted library JSON once with the same rules for layout and reports. */
export function electricalPinGroups(symbol: SymbolDefinition) {
  const { knowledge, definition } = electricalDefinition(symbol);
  const permanent: string[][] = [], conditional: string[][] = [];
  const invalid: { kind: 'permanent' | 'conditional'; pins: string[] }[] = [];
  if (definition) for (const kind of ['permanent', 'conditional'] as const) {
    const groups = kind === 'permanent' ? definition.permanentConnections : definition.conditionalConnections ?? [];
    if (!Array.isArray(groups)) { invalid.push({ kind, pins: [] }); continue; }
    for (const pins of groups) {
      if (!Array.isArray(pins) || !pins.length || !pins.every(id => typeof id === 'string' && symbol.pins.some(p => p.id === id))) {
        invalid.push({ kind, pins: Array.isArray(pins) ? pins.filter(id => typeof id === 'string') : [] });
        continue;
      }
      (kind === 'permanent' ? permanent : conditional).push(pins);
    }
  }
  return { knowledge, permanent, conditional, invalid };
}
