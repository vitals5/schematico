import type { ELK as ElkEngine } from 'elkjs/lib/elk-api';
import type { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk-api';
import type { LayoutSnapshot, LayoutSolution, Rect, Point, LayoutNode } from './types';
import { clone } from './types';
import { union, translate, contains, overlaps, right, bottom } from './rect';
import { validateLayout } from './validate';
import { routeAll } from './router';
const sides = { top: 'NORTH', bottom: 'SOUTH', left: 'WEST', right: 'EAST' };
export async function solveLayouts(
  source: LayoutSnapshot,
  factory?: () => ElkEngine,
): Promise<LayoutSolution[]> {
  const create: () => ElkEngine =
    factory ?? (await import('elkjs/lib/elk.bundled.js').then((m) => () => new m.default()));
  const results: LayoutSolution[] = [];
  for (const profile of ['readability', 'compact', 'minimal_change'] as const) {
    const s = clone(source);
    if (s.issues.some((i) => i.severity === 'error')) {
      results.push({ profile, snapshot: s, report: validateLayout(s) });
      break;
    }
    const elk = create(),
      nodeMap = new Map(s.nodes.map((n) => [n.id, n])),
      frameMap = new Map(s.frames.map((f) => [f.id, f]));
    const parent = new Map<string, string>();
    for (const n of s.nodes) if (n.parent) parent.set(n.id, n.parent);
    for (const f of s.frames) {
      const candidates = s.frames.filter(
        (p) =>
          p.id !== f.id &&
          (p.members.includes(f.id) ||
            (p.kind !== 'group' &&
              contains(p.rect, f.rect) &&
              p.rect.width * p.rect.height > f.rect.width * f.rect.height + 1)),
      );
      candidates.sort(
        (a, b) =>
          a.rect.width * a.rect.height - b.rect.width * b.rect.height || a.id.localeCompare(b.id),
      );
      if (candidates[0]) {
        parent.set(f.id, candidates[0].id);
        if (!candidates[0].members.includes(f.id)) candidates[0].members.push(f.id);
      }
    }
    const reserves = new Map(
      s.frames.map((f) => [
        f.id,
        {
          left: Math.max(
            0,
            ...(f.shapes ?? []).filter((g) => g.kind === 'label').map((g) => f.rect.x - g.rect.x),
          ),
          top: Math.max(
            8,
            ...(f.shapes ?? [])
              .filter((g) => g.kind === 'label' && g.rect.y >= f.rect.y)
              .map((g) => bottom(g.rect) - f.rect.y + 4),
          ),
        },
      ]),
    );
    const gap = profile === 'compact' ? 6 : profile === 'readability' ? 12 : 8;
    const descendants = (id: string): typeof s.nodes => {
      const belongs = (child: string, seen = new Set<string>()): boolean => {
        if (child === id) return true;
        if (seen.has(child)) return false;
        seen.add(child);
        const p = parent.get(child);
        return p ? belongs(p, seen) : false;
      };
      return s.nodes.filter((n) => belongs(n.id));
    };
    const build = (id: string, seen = new Set<string>()): ElkNode => {
      if (seen.has(id)) throw new Error('Zyklische Layoutgruppe.');
      seen.add(id);
      const rigid = frameMap.get(id);
      if (rigid?.rigid) {
        return {
          id,
          width: rigid.rect.width,
          height: rigid.rect.height,
          layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
          ports: descendants(id).flatMap((n) =>
            n.pins.map((p) => ({
              id: JSON.stringify([n.id, p.id]),
              x: p.x - rigid.rect.x,
              y: p.y - rigid.rect.y,
              width: 0,
              height: 0,
              layoutOptions: { 'elk.port.side': sides[p.direction] },
            })),
          ),
        };
      }
      const n = nodeMap.get(id);
      if (n)
        return {
          id,
          width: Math.max(0.5, n.rect.width),
          height: Math.max(0.5, n.rect.height),
          layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
          ports: n.pins.map((p) => ({
            id: JSON.stringify([id, p.id]),
            x: p.x - n.rect.x,
            y: p.y - n.rect.y,
            width: 0,
            height: 0,
            layoutOptions: { 'elk.port.side': sides[p.direction] },
          })),
        };
      return {
        id,
        children: [...nodeMap.keys(), ...frameMap.keys()]
          .filter((child) => parent.get(child) === id)
          .sort()
          .map((child) => build(child, new Set(seen))),
        layoutOptions: {
          'elk.padding': `[top=${reserves.get(id)?.top ?? 8},left=${(reserves.get(id)?.left ?? 0) + 8},bottom=8,right=8]`,
        },
      };
    };
    const ids = [...nodeMap.keys(), ...frameMap.keys()].filter((id) => !parent.has(id)).sort();
    const rootOf = (id: string): string => (parent.has(id) ? rootOf(parent.get(id)!) : id);
    const fixedRoots = new Set(s.nodes.filter((n) => n.fixed).map((n) => rootOf(n.id)));
    for (const f of s.frames.filter((f) => f.fixed)) fixedRoots.add(rootOf(f.id));
    const graph: ElkNode = {
      id: 'layout-root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
        'elk.randomSeed': '1',
        'elk.spacing.nodeNode': String(gap),
        'elk.layered.spacing.nodeNodeBetweenLayers': String(gap + 6),
        'elk.padding': '[top=0,left=0,bottom=0,right=0]',
      },
      children: ids.filter((id) => !fixedRoots.has(id)).map((id) => build(id)),
      edges: [],
    };
    graph.edges = s.edges
      .filter(
        (e) =>
          !fixedRoots.has(rootOf(e.from.componentId)) && !fixedRoots.has(rootOf(e.to.componentId)),
      )
      .map(
        (e) =>
          ({
            id: e.id,
            sources: [JSON.stringify([e.from.componentId, e.from.pinId])],
            targets: [JSON.stringify([e.to.componentId, e.to.pinId])],
          }) as ElkExtendedEdge,
      );
    let laid: ElkNode;
    try {
      laid = await elk.layout(graph);
    } finally {
      if (factory) elk.terminateWorker();
    }
    const original = new Map(s.nodes.map((n) => [n.id, clone(n)])),
      occupied: Rect[] = s.nodes.filter((n) => fixedRoots.has(rootOf(n.id))).map((n) => n.rect);
    for (const f of s.frames)
      if (fixedRoots.has(rootOf(f.id)) && f.kind !== 'group') occupied.push(f.rect);
    const moveNode = (n: LayoutNode, p: Point) => {
      const dx = p.x - n.rect.x,
        dy = p.y - n.rect.y;
      n.origin.x += dx;
      n.origin.y += dy;
      if (n.insertion) {
        n.insertion.x += dx;
        n.insertion.y += dy;
      }
      n.rect = translate(n.rect, dx, dy);
      for (const shape of n.shapes) shape.rect = translate(shape.rect, dx, dy);
      for (const pin of n.pins) {
        pin.x += dx;
        pin.y += dy;
      }
    };
    const place = (node: ElkNode, x: number, y: number) => {
      const rigid = frameMap.get(node.id);
      if (rigid?.rigid) {
        const nodes = descendants(node.id),
          anchor =
            nodes.find((n) => n.insertion)?.insertion ??
            nodes.flatMap((n) => n.pins)[0] ??
            nodes[0]?.origin ??
            rigid.rect,
          step = s.grid.spacing;
        let dx = x - rigid.rect.x,
          dy = y - rigid.rect.y;
        dx +=
          s.grid.origin.x +
          Math.round((anchor.x + dx - s.grid.origin.x) / step) * step -
          (anchor.x + dx);
        dy +=
          s.grid.origin.y +
          Math.round((anchor.y + dy - s.grid.origin.y) / step) * step -
          (anchor.y + dy);
        for (const n of nodes) moveNode(n, { x: n.rect.x + dx, y: n.rect.y + dy });
        const inside = (id: string): boolean =>
          parent.get(id) === node.id || (!!parent.get(id) && inside(parent.get(id)!));
        for (const f of s.frames)
          if (f.id === node.id || inside(f.id)) {
            f.rect = translate(f.rect, dx, dy);
            f.shapes = undefined;
          }
        return;
      }
      const n = nodeMap.get(node.id);
      if (n) {
        const originalNode = original.get(n.id)!,
          pin = n.pins[0];
        // Snap insertion/first port as one rigid transform; never round individual ports.
        const anchor = n.insertion ?? pin ?? n.origin,
          step = s.grid.spacing;
        const snap = (v: number, o: number) => o + Math.round((v - o) / step) * step;
        const target = {
          x:
            x +
            snap(anchor.x - originalNode.rect.x + x, s.grid.origin.x) -
            (anchor.x - originalNode.rect.x + x),
          y:
            y +
            snap(anchor.y - originalNode.rect.y + y, s.grid.origin.y) -
            (anchor.y - originalNode.rect.y + y),
        };
        moveNode(n, target);
        return;
      }
      const f = frameMap.get(node.id)!;
      f.shapes = undefined;
      f.rect = {
        x: x + (reserves.get(node.id)?.left ?? 0),
        y,
        width: Math.max(1, (node.width ?? 0) - (reserves.get(node.id)?.left ?? 0)),
        height: node.height ?? 1,
      };
      for (const child of node.children ?? []) place(child, x + (child.x ?? 0), y + (child.y ?? 0));
    };
    for (const block of laid.children ?? []) {
      const w = (block.width ?? 1) + s.grid.spacing,
        h = (block.height ?? 1) + s.grid.spacing;
      const descendants = (id: string): LayoutNode[] => s.nodes.filter((n) => rootOf(n.id) === id);
      const originals = descendants(block.id).map((n) => original.get(n.id)!.rect),
        old = originals.length
          ? union(originals)
          : { x: s.area.x, y: s.area.y, width: w, height: h };
      const preferred =
        profile === 'minimal_change'
          ? old
          : { x: s.area.x + (block.x ?? 0), y: s.area.y + (block.y ?? 0) };
      const candidates: Point[] = [];
      const step = Math.max(2, s.grid.spacing);
      for (let y = s.area.y; y + h <= bottom(s.area) + 1e-6; y += step)
        for (let x = s.area.x; x + w <= right(s.area) + 1e-6; x += step) candidates.push({ x, y });
      candidates.sort(
        (a, b) =>
          Math.abs(a.x - preferred.x) +
            Math.abs(a.y - preferred.y) -
            Math.abs(b.x - preferred.x) -
            Math.abs(b.y - preferred.y) ||
          a.y - b.y ||
          a.x - b.x,
      );
      const p = candidates.find(
        (p) => !occupied.some((o) => overlaps({ ...p, width: w, height: h }, o, gap / 2)),
      );
      if (!p) {
        s.issues.push({
          type: 'sheet_capacity',
          bounds: [{ x: 0, y: 0, width: w, height: h }],
          severity: 'error',
          objectIds: [block.id],
          message: 'Gruppe passt bei unveränderten Symbol- und Schriftgrößen nicht auf das Blatt.',
        });
        continue;
      }
      place(block, p.x + s.grid.spacing / 2, p.y + s.grid.spacing / 2);
      occupied.push({ ...p, width: w, height: h });
    }
    routeAll(s);
    const report = validateLayout(s);
    report.metrics.displacement = s.nodes.reduce(
      (sum, n) =>
        sum +
        Math.abs(n.origin.x - original.get(n.id)!.origin.x) +
        Math.abs(n.origin.y - original.get(n.id)!.origin.y),
      0,
    );
    results.push({ profile, snapshot: s, report });
  }
  return results.sort(
    (a, b) =>
      Number(b.report.valid) - Number(a.report.valid) ||
      score(a) - score(b) ||
      a.profile.localeCompare(b.profile),
  );
}
const score = (r: LayoutSolution) => {
  const m = r.report.metrics;
  return (
    m.crossings * 100 +
    m.bends * 8 +
    m.length +
    (r.profile === 'minimal_change' ? m.displacement * 2 : m.displacement * 0.1)
  );
};
