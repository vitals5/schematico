import type { PlacedComponent, SymbolDefinition } from './types';

export interface TerminalLevel {
  id: string;
  designation: string;
  pinIds: string[];
  potential: 'undefined' | 'L' | 'N' | 'PE';
  disconnectable?: boolean;
}
export interface TerminalDefinition {
  kind: 'feed_through' | 'multi_level' | 'installation' | 'pe' | 'disconnect' | 'fused';
  mainLevel: string;
  levels: TerminalLevel[];
}

/** Reject ambiguous function maps. Metadata never creates conductive links. */
export function terminalLevels(symbol?: SymbolDefinition): TerminalLevel[] {
  const d = symbol?.terminalDefinition;
  if (!d || !Array.isArray(d.levels) || !d.levels.length || d.levels.length > 16) return [];
  const ids = new Set<string>(), pins = new Set<string>();
  for (const level of d.levels) {
    if (!level || !/^[a-zA-Z0-9_.-]{1,64}$/.test(level.id) || ids.has(level.id) || typeof level.designation !== 'string' ||
      !['undefined','L','N','PE'].includes(level.potential) || !Array.isArray(level.pinIds) || !level.pinIds.length) return [];
    ids.add(level.id);
    for (const id of level.pinIds) {
      if (pins.has(id) || !symbol!.pins.some(p => p.id === id)) return [];
      pins.add(id);
    }
  }
  return pins.size === symbol!.pins.length && ids.has(d.mainLevel) ? d.levels : [];
}

export function terminalLevelValues(component: PlacedComponent, symbol?: SymbolDefinition) {
  return terminalLevels(symbol).map(level => ({ ...level,
    designation: typeof component.terminal?.levels?.[level.id]?.designation === 'string'
      ? component.terminal.levels[level.id].designation.trim() || level.designation : level.designation,
    functionText: typeof component.terminal?.levels?.[level.id]?.functionText === 'string'
      ? component.terminal.levels[level.id].functionText! : component.functionText,
  }));
}

export function validTerminalLevelSettings(component: PlacedComponent, symbol?: SymbolDefinition): boolean {
  const levels = terminalLevelValues(component, symbol), overrides = component.terminal?.levels;
  if(symbol?.terminalDefinition&&!levels.length)return false;
  if (overrides && (typeof overrides !== 'object' || Array.isArray(overrides) ||
    Object.entries(overrides).some(([id, value]) => !levels.some(l => l.id === id) || !value ||
      typeof value.designation !== 'string' || (value.functionText !== undefined && typeof value.functionText !== 'string')))) return false;
  return new Set(levels.map(l => l.designation)).size === levels.length;
}

export function terminalPinSide(component: PlacedComponent, symbol: SymbolDefinition | undefined, id: string) {
  const explicit = component.terminal?.pinSides[id];
  if (explicit) return explicit;
  const level = terminalLevels(symbol).find(l=>l.pinIds.includes(id));
  if (level) {
    return level.pinIds[0] === id ? 'internal' : 'external';
  }
  return id === '1' ? 'internal' : 'external';
}
