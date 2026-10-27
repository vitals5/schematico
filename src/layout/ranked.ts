import type { ElkNode } from 'elkjs/lib/elk-api';
import type { LayoutSnapshot } from './types';
/** Bounded alternative for functional groups: serial bottom/top paths become ranks,
 * same-side branches share a rank. All electrical edges are still routed afterwards. */
export function rankedGroup(
  id: string,
  children: ElkNode[],
  snapshot: LayoutSnapshot,
  gap: number,
  padding: { left: number; top: number; right: number; bottom: number },
  aligned = true,
): ElkNode | undefined {
  const owners = new Map(
      children.flatMap((c) => (c.ports ?? []).map((p) => [p.id, c.id] as const)),
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
    return ap && bp
      ? [
          {
            a,
            b,
            ad: ap.direction,
            bd: bp.direction,
            aid: JSON.stringify([e.from.componentId, e.from.pinId]),
            bid: JSON.stringify([e.to.componentId, e.to.pinId]),
          },
        ]
      : [];
  });
  for (const e of edges)
    if (e.ad === e.bd) {
      const a = root(e.a),
        b = root(e.b);
      if (a !== b) parent.set(a, b);
    }
  const arcs = new Map<string, Set<string>>(),
    degree = new Map([...new Set(children.map((c) => root(c.id)))].map((id) => [id, 0]));
  for (const e of edges) {
    let a: string, b: string;
    if (e.ad === 'bottom' && e.bd === 'top') {
      a = root(e.a);
      b = root(e.b);
    } else if (e.ad === 'top' && e.bd === 'bottom') {
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
  if (!aligned) {
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
  const ordered = [...rows].sort((a, b) => a[0] - b[0]);
  for (const [, row] of ordered) row.sort((a, b) => a.id.localeCompare(b.id));
  // Crossing reduction: use graph neighbours, never device IDs as electrical lane order.
  for (let pass = 0; pass < 4; pass++) {
    for (const [, row] of pass % 2 ? [...ordered].reverse() : ordered) {
      const positions = new Map(
        ordered.flatMap(([, r]) => r.map((c, i) => [c.id, i] as const)),
      );
      const barycentre = (c: ElkNode) => {
        const neighbours = edges
          .flatMap((e) => (e.a === c.id ? [e.b] : e.b === c.id ? [e.a] : []))
          .filter((n) => !row.some((x) => x.id === n));
        return neighbours.length
          ? neighbours.reduce((sum, n) => sum + positions.get(n)!, 0) / neighbours.length
          : positions.get(c.id)!;
      };
      row.sort((a, b) => barycentre(a) - barycentre(b) || a.id.localeCompare(b.id));
    }
  }
  let y = padding.top,
    width = 0;
  const placed: ElkNode[] = [],
    byId = new Map<string, ElkNode>();
  for (const [, row] of ordered) {
    let x = padding.left,
      height = 0;
    for (const c of row) {
      const targets = edges
        .flatMap((e) => {
          const other = e.a === c.id ? e.b : e.b === c.id ? e.a : undefined;
          const previous = other ? byId.get(other) : undefined;
          if (!previous || previous.y === y) return [];
          const ownPort = c.ports?.find((p) => p.id === (e.a === c.id ? e.aid : e.bid));
          const otherPort = previous.ports?.find(
            (p) => p.id === (e.a === c.id ? e.bid : e.aid),
          );
          return [
            (previous.x ?? 0) +
              (otherPort?.x ?? (previous.width ?? 0) / 2) -
              (ownPort?.x ?? (c.width ?? 0) / 2),
          ];
        })
        .sort((a, b) => a - b);
      const desired = targets.length ? targets[Math.floor(targets.length / 2)] : x;
      const node = { ...c, x: Math.max(x, desired), y };
      placed.push(node);
      byId.set(c.id, node);
      x = node.x + (c.width ?? 1) + gap;
      height = Math.max(height, c.height ?? 1);
    }
    width = Math.max(width, x - gap + padding.right);
    y += height + gap;
  }
  return { id, width, height: y - gap + padding.bottom, children: placed };
}
