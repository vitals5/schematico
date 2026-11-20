import type { IndexedConnection } from './ProjectIndex';

export const representationFields = ['potential', 'color', 'crossSection', 'wireNumber', 'lengthMm'] as const;
const value = (v: unknown) => v === undefined || v === null ? '' : String(v).trim();
export interface RepresentationPair {
  drawing: IndexedConnection;
  logical: IndexedConnection;
  conflicts: string[];
}
/** Only an unambiguous native drawing/logical pair with resolved endpoints is
 * eligible. Parallel drawings, duplicate IDs and unresolved references stay raw. */
export function connectionRepresentationPairs(connections: readonly IndexedConnection[]): RepresentationPair[] {
  const groups = new Map<string, IndexedConnection[]>();
  const ids = new Map<string, number>();
  for (const c of connections) ids.set(c.wire.id, (ids.get(c.wire.id) ?? 0) + 1);
  for (const c of connections) {
    if (!c.from || !c.to || c.from.owner.component.source?.format !== 'NATIVE_CAD' ||
        c.to.owner.component.source?.format !== 'NATIVE_CAD') continue;
    const ends = [c.from, c.to].map(p => JSON.stringify([p.owner.page.id, p.owner.component.id, p.id])).sort();
    const key = JSON.stringify(ends);
    const group = groups.get(key) ?? [];
    group.push(c); groups.set(key, group);
  }
  const result: RepresentationPair[] = [];
  for (const group of groups.values()) {
    if (group.length !== 2 || group.some(c => ids.get(c.wire.id) !== 1)) continue;
    const drawing = group.find(c => !c.logical && c.wire.id.startsWith('native_run_'));
    const logical = group.find(c => c.logical && c.wire.id.startsWith('native_logical_'));
    if (!drawing || !logical || drawing.wire.terminalBridge !== logical.wire.terminalBridge &&
        !!drawing.wire.terminalBridge !== !!logical.wire.terminalBridge) continue;
    result.push({ drawing, logical, conflicts: representationFields.filter(k =>
      value(drawing.wire[k]) && value(logical.wire[k]) && value(drawing.wire[k]) !== value(logical.wire[k])) });
  }
  return result;
}
