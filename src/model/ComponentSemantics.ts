import type { PlacedComponent, Project, SymbolDefinition } from './types';
import { isConnectionSymbol } from './ConnectionSymbols';

export interface DataInterpretation {
  version: 1;
  nativeRoles: boolean;
  assignedArticlesOnly: boolean;
  consolidateConnections: boolean;
}
export const interpretationEnabled = (p: Project, option: keyof Omit<DataInterpretation, 'version'>) =>
  p.dataInterpretation?.version === 1 && p.dataInterpretation[option] === true;

export type ComponentRole = 'graphic' | 'device_connection' | 'connector' | 'terminal' |
  'connection' | 'structure' | 'annotation' | 'device' | 'unknown';

/** Classification affects inventories, never symbol geometry or electrical pins. */
export function componentRole(c: PlacedComponent, s?: SymbolDefinition): ComponentRole {
  if(c.terminal)return 'terminal';
  if (!s) return 'unknown';
  if (s.annotationKind) return 'annotation';
  if (s.deviceBox || s.category === 'structure') return 'structure';
  if (isConnectionSymbol(s)) return 'connection';
  if (c.source?.format === 'NATIVE_CAD' && c.symbolId.startsWith('native:graphic:') &&
      !s.pins.length && !Object.keys(c.pins ?? {}).length && !c.bmk.trim() &&
      [31, 32, 89].includes(c.source.objectType)) return 'graphic';
  const source = s.source;
  if (source?.library === 'SPECIAL') {
    const name = s.name.match(/\/\s*([^\s[]+)/)?.[1] ?? '';
    if (/^(?:D\d+)?DCP/.test(name) || [17, 22, 38, 408, 427, 537].includes(source.number))
      return 'device_connection';
  }
  if (source?.library === 'IEC_symbol' && s.category === 'terminals' &&
      /\/\s*(?:XU|XSD|XBD)/.test(s.name)) return 'connector';
  if (s.category === 'terminals') return 'terminal';
  return 'device';
}

export function isInventoryComponent(p: Project, c: PlacedComponent, s?: SymbolDefinition) {
  if (!interpretationEnabled(p, 'nativeRoles')) return true;
  // Explicit article evidence remains accessible even on an unusual symbol.
  if (c.articleNumber?.trim() || c.articleReferences?.length || c.articleAssignment?.items?.length)
    return true;
  const role=componentRole(c,s);
  if(isTerminalComponent(p,c,s))return true;
  if(role==='structure'&&c.bmk.trim())return true;
  return !['graphic', 'device_connection', 'connection', 'annotation', 'structure'].includes(role);
}

export function isTerminalComponent(p: Project, c: PlacedComponent, s?: SymbolDefinition) {
  return interpretationEnabled(p, 'nativeRoles')
    ? !!c.terminal || componentRole(c, s) === 'terminal' || !!p.terminalStrips?.some(strip=>strip.positions.some(pos=>
      pos.kind==='terminal'&&pos.members.some(a=>a.componentId===c.id&&p.pages.some(page=>page.id===a.pageId&&page.components.includes(c)))))
    : s?.category === 'terminals';
}
