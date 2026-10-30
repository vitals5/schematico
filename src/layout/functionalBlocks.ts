import { relatedCircuits } from './relatedCircuits';
import type { LayoutSnapshot } from './types';

/** Preferred page units from real connected circuits and explicit, unambiguous
 * power/control device relationships. No new electrical edge or saved group. */
export function functionalBlocks(atomic: string[][], snapshot: LayoutSnapshot): string[][] {
  const nodes = new Map(snapshot.nodes.filter(n => n.kind === 'component' && n.pins.length).map(n => [n.id, n]));
  const adjacent = new Map([...nodes.keys()].map(id => [id, new Set<string>()]));
  for (const e of snapshot.edges) if (nodes.has(e.from.componentId) && nodes.has(e.to.componentId)) {
    adjacent.get(e.from.componentId)!.add(e.to.componentId);
    adjacent.get(e.to.componentId)!.add(e.from.componentId);
  }
  const unseen = new Set([...nodes.keys()].sort()), circuits: { id: string }[][] = [];
  while (unseen.size) {
    const queue = [unseen.values().next().value!], ids: string[] = [];
    while (queue.length) {
      const id = queue.pop()!;
      if (!unseen.delete(id)) continue;
      ids.push(id); queue.push(...adjacent.get(id)!);
    }
    circuits.push(ids.sort().map(id => ({ id })));
  }
  const wired = new Set(snapshot.edges.flatMap(e => [e.from.componentId, e.to.componentId]));
  const active = circuits.filter(c => c.length > 1 || c.some(n => wired.has(n.id)));
  if (active.length < 2 || active.length > 12) return atomic.map(b => [...b]);
  const owner = new Map(atomic.flatMap((b, i) => b.map(id => [id, i] as const)));
  const parent = atomic.map((_, i) => i);
  const root = (i: number): number => parent[i] === i ? i : (parent[i] = root(parent[i]));
  for (const unit of relatedCircuits(active, snapshot)) {
    if (unit.length !== 2) continue;
    const ids = unit.flat().map(n => n.id);
    if (ids.some(id => nodes.get(id)!.fixed || !owner.has(id))) continue;
    const first = root(owner.get(ids[0])!);
    for (const id of ids.slice(1)) {
      const other = root(owner.get(id)!);
      if (root(first) !== other) parent[other] = root(first);
    }
  }
  const result = new Map<number, string[]>();
  atomic.forEach((block, i) => result.set(root(i), [...(result.get(root(i)) ?? []), ...block]));
  return [...result.values()].map(b => b.sort()).sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
}
