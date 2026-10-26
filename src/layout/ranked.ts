import type { ElkNode } from "elkjs/lib/elk-api";
import type { LayoutSnapshot } from "./types";
/** Bounded alternative for functional groups: serial bottom/top paths become ranks,
 * same-side branches share a rank. All electrical edges are still routed afterwards. */
export function rankedGroup(
  id: string,
  children: ElkNode[],
  snapshot: LayoutSnapshot,
  gap: number,
  padding: { left: number; top: number; right: number; bottom: number },
): ElkNode | undefined {
  const owners = new Map(
      children.flatMap((c) =>
        (c.ports ?? []).map((p) => [p.id, c.id] as const),
      ),
    ),
    parent = new Map(children.map((c) => [c.id, c.id]));
  const root = (id: string): string => {
    const p = parent.get(id)!;
    return p === id ? id : root(p);
  };
  const edges = snapshot.edges.flatMap((e) => {
    const a = owners.get(JSON.stringify([e.from.componentId, e.from.pinId])),
      b = owners.get(JSON.stringify([e.to.componentId, e.to.pinId]));
    if (!a || !b || a === b) return [];
    const ap = snapshot.nodes
        .find((n) => n.id === e.from.componentId)
        ?.pins.find((p) => p.id === e.from.pinId),
      bp = snapshot.nodes
        .find((n) => n.id === e.to.componentId)
        ?.pins.find((p) => p.id === e.to.pinId);
    return ap && bp ? [{ a, b, ad: ap.direction, bd: bp.direction }] : [];
  });
  for (const e of edges)
    if (e.ad === e.bd) {
      const a = root(e.a),
        b = root(e.b);
      if (a !== b) parent.set(a, b);
    }
  const arcs = new Map<string, Set<string>>(),
    degree = new Map(
      [...new Set(children.map((c) => root(c.id)))].map((id) => [id, 0]),
    );
  for (const e of edges) {
    let a: string, b: string;
    if (e.ad === "bottom" && e.bd === "top") {
      a = root(e.a);
      b = root(e.b);
    } else if (e.ad === "top" && e.bd === "bottom") {
      a = root(e.b);
      b = root(e.a);
    } else continue;
    if (a === b) return;
    if (!arcs.get(a)?.has(b)) {
      if (!arcs.has(a)) arcs.set(a, new Set());
      arcs.get(a)!.add(b);
      degree.set(b, degree.get(b)! + 1);
    }
  }
  const ranks = new Map([...degree.keys()].map((id) => [id, 0])),
    queue = [...degree]
      .filter(([, d]) => !d)
      .map(([id]) => id)
      .sort();
  let visited = 0;
  while (queue.length) {
    const id = queue.shift()!;
    visited++;
    for (const to of arcs.get(id) ?? []) {
      ranks.set(to, Math.max(ranks.get(to)!, ranks.get(id)! + 1));
      degree.set(to, degree.get(to)! - 1);
      if (!degree.get(to)) {
        queue.push(to);
        queue.sort();
      }
    }
  }
  if (visited !== degree.size) return;
  const rows = new Map<number, ElkNode[]>();
  for (const c of children) {
    const rank = ranks.get(root(c.id))!;
    rows.set(rank, [...(rows.get(rank) ?? []), c]);
  }
  let y = padding.top,
    width = 0;
  const placed: ElkNode[] = [];
  for (const [, row] of [...rows].sort((a, b) => a[0] - b[0])) {
    let x = padding.left,
      height = 0;
    for (const c of row.sort((a, b) => a.id.localeCompare(b.id))) {
      placed.push({ ...c, x, y });
      x += (c.width ?? 1) + gap;
      height = Math.max(height, c.height ?? 1);
    }
    width = Math.max(width, x - gap + padding.right);
    y += height + gap;
  }
  return { id, width, height: y - gap + padding.bottom, children: placed };
}
