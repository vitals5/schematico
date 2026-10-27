import { rankedGroup } from './ranked';
import { SheetPacker } from './packing';
import type { ELK as ElkEngine } from 'elkjs/lib/elk-api';
import type { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk-api';
import type {
  LayoutSnapshot,
  LayoutSolution,
  Rect,
  Point,
  LayoutNode,
} from './types';
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
    factory ??
    (await import('elkjs/lib/elk.bundled.js').then(
      (m) => () => new m.default(),
    ));
  const results: LayoutSolution[] = [];
  for (const profile of ['readability', 'compact', 'minimal_change', 'lanes'] as const) {
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
      const direct = s.frames.filter(
        (p) => p.id !== f.id && p.members.includes(f.id),
      );
      const containers = direct.filter((p) => p.kind !== 'group');
      const candidates = containers.length
        ? containers
        : direct.length
          ? direct
          : s.frames.filter(
              (p) =>
                p.id !== f.id &&
                (p.members.includes(f.id) ||
                  (f.kind !== 'group' &&
                    p.kind !== 'group' &&
                    contains(p.rect, f.rect) &&
                    p.rect.width * p.rect.height >
                      f.rect.width * f.rect.height + 1)),
            );
      candidates.sort(
        (a, b) =>
          a.rect.width * a.rect.height - b.rect.width * b.rect.height ||
          a.id.localeCompare(b.id),
      );
      if (candidates[0]) {
        parent.set(f.id, candidates[0].id);
        if (!candidates[0].members.includes(f.id))
          candidates[0].members.push(f.id);
      }
    }
    const reserves = new Map(
      s.frames.map((f) => [
        f.id,
        {
          left: Math.max(
            0,
            ...(f.shapes ?? [])
              .filter((g) => g.kind === 'label')
              .map((g) => f.rect.x - g.rect.x),
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
    const direction = profile === 'compact' ? 'RIGHT' : 'DOWN';
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
    const ids = [...nodeMap.keys(), ...frameMap.keys()]
      .filter((id) => !parent.has(id))
      .sort();
    const rootOf = (id: string): string =>
      parent.has(id) ? rootOf(parent.get(id)!) : id;
    const fixedRoots = new Set(
      s.nodes.filter((n) => n.fixed).map((n) => rootOf(n.id)),
    );
    for (const f of s.frames.filter((f) => f.fixed))
      fixedRoots.add(rootOf(f.id));
    const layoutChildren = async (
      id: string,
      children: ElkNode[],
      padding: { left: number; top: number; right: number; bottom: number },
    ): Promise<ElkNode> => {
      let widthBudget = s.area.width - s.grid.spacing - gap / 2;
      let heightBudget = s.area.height - s.grid.spacing - gap / 2;
      for (
        let ancestor = parent.get(id);
        ancestor;
        ancestor = parent.get(ancestor)
      ) {
        widthBudget -= (reserves.get(ancestor)?.left ?? 0) + 16;
        heightBudget -= (reserves.get(ancestor)?.top ?? 8) + 8;
      }
      const portOwner = new Map(
        children.flatMap((c) =>
          (c.ports ?? []).map((p) => [p.id, c.id] as const),
        ),
      );
      const edges: ElkExtendedEdge[] = s.edges
        .filter((e) => {
          const a = portOwner.get(
              JSON.stringify([e.from.componentId, e.from.pinId]),
            ),
            b = portOwner.get(JSON.stringify([e.to.componentId, e.to.pinId]));
          const fromPin = s.nodes
              .find((n) => n.id === e.from.componentId)
              ?.pins.find((p) => p.id === e.from.pinId),
            toPin = s.nodes
              .find((n) => n.id === e.to.componentId)
              ?.pins.find((p) => p.id === e.to.pinId);
          return a && b && a !== b && fromPin?.direction !== toPin?.direction;
        })
        .map((e) => ({
          id: e.id,
          sources: [JSON.stringify([e.from.componentId, e.from.pinId])],
          targets: [JSON.stringify([e.to.componentId, e.to.pinId])],
        }));
      if (edges.length && (profile === 'lanes' || id !== 'layout-root' && profile === 'compact')) {
        const compact = rankedGroup(id, children, s, gap, padding, profile === 'lanes');
        if (
          compact &&
          (compact.width ?? 0) <= widthBudget &&
          (compact.height ?? 0) <= heightBudget
        )
          return compact;
      }
      if (id !== 'layout-root' && (!edges.length || profile === 'compact')) {
        // Independent items (e.g. interruption arrows) form a compact grid, not a tall signal chain.
        const choices = [];
        for (let cols = 1; cols <= children.length; cols++) {
          const placed: ElkNode[] = [];
          let y = padding.top,
            width = 0;
          for (let i = 0; i < children.length; i += cols) {
            let x = padding.left,
              rowHeight = 0;
            for (const child of children.slice(i, i + cols)) {
              placed.push({ ...child, x, y });
              x += (child.width ?? 1) + gap;
              rowHeight = Math.max(rowHeight, child.height ?? 1);
            }
            width = Math.max(width, x - gap + padding.right);
            y += rowHeight + gap;
          }
          const height = y - gap + padding.bottom,
            overflow =
              Math.max(0, width - widthBudget) +
              Math.max(0, height - heightBudget);
          choices.push({
            id,
            width,
            height,
            children: placed,
            score:
              overflow * 1e6 +
              width * height +
              Math.abs(width - height * 1.5) * 20,
          });
        }
        choices.sort((a, b) => a.score - b.score || a.width - b.width);
        return choices[0] ?? { id, width: 1, height: 1, children: [] };
      }
      const local: ElkNode = {
        id,
        children: children.map(({ children: _, ...c }) => ({
          ...c,
          ports: c.ports?.map((p) => {
            const side = p.layoutOptions?.['elk.port.side'];
            return {
              ...p,
              x:
                side === 'WEST'
                  ? 0
                  : side === 'EAST'
                    ? c.width
                    : Math.max(0, Math.min(c.width ?? 0, p.x ?? 0)),
              y:
                side === 'NORTH'
                  ? 0
                  : side === 'SOUTH'
                    ? c.height
                    : Math.max(0, Math.min(c.height ?? 0, p.y ?? 0)),
            };
          }),
        })),
        edges,
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': direction,
          'elk.edgeRouting': profile === 'compact' ? 'POLYLINE' : 'ORTHOGONAL',
          'elk.layered.spacing.edgeNodeBetweenLayers': '2',
          'elk.layered.spacing.edgeEdgeBetweenLayers': '2',
          'elk.randomSeed': '1',
          'elk.spacing.nodeNode': String(gap),
          'elk.layered.spacing.nodeNodeBetweenLayers': String(gap + 6),
          'elk.padding': `[top=${padding.top},left=${padding.left},bottom=${padding.bottom},right=${padding.right}]`,
        },
      };
      const laid = await elk.layout(local);
      return {
        ...laid,
        children: (laid.children ?? []).map((child) => ({
          ...children.find((c) => c.id === child.id)!,
          x: child.x,
          y: child.y,
          width: child.width,
          height: child.height,
        })),
      };
    };
    const build = async (
      id: string,
      seen = new Set<string>(),
    ): Promise<ElkNode> => {
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

      const children: ElkNode[] = [];
      for (const child of [...nodeMap.keys(), ...frameMap.keys()]
        .filter((child) => parent.get(child) === id)
        .sort())
        children.push(await build(child, new Set(seen)));
      const result = await layoutChildren(id, children, {
        top: reserves.get(id)?.top ?? 8,
        left: (reserves.get(id)?.left ?? 0) + 8,
        bottom: 8,
        right: 8,
      });
      // Expose actual descendant ports as a rigid interface for the parent pass.
      result.ports = (result.children ?? []).flatMap((child) =>
        (child.ports ?? []).map((pin) => ({
          ...pin,
          x: (child.x ?? 0) + (pin.x ?? 0),
          y: (child.y ?? 0) + (pin.y ?? 0),
        })),
      );
      result.layoutOptions = { 'elk.portConstraints': 'FIXED_POS' };
      return result;
    };
    let laid: ElkNode;
    try {
      const children: ElkNode[] = [];
      for (const id of ids.filter((id) => !fixedRoots.has(id)))
        children.push(await build(id));
      laid = await layoutChildren('layout-root', children, {
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
      });
    } finally {
      if (factory) elk.terminateWorker();
    }
    const original = new Map(s.nodes.map((n) => [n.id, clone(n)])),
      occupied: Rect[] = s.nodes
        .filter((n) => fixedRoots.has(rootOf(n.id)))
        .map((n) => n.rect);
    for (const f of s.frames)
      if (fixedRoots.has(rootOf(f.id)) && f.kind !== 'group')
        occupied.push(f.rect);
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
        for (const n of nodes)
          moveNode(n, { x: n.rect.x + dx, y: n.rect.y + dy });
        const inside = (id: string): boolean =>
          parent.get(id) === node.id ||
          (!!parent.get(id) && inside(parent.get(id)!));
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
        const snap = (v: number, o: number) =>
          o + Math.round((v - o) / step) * step;
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
        width: Math.max(
          1,
          (node.width ?? 0) - (reserves.get(node.id)?.left ?? 0),
        ),
        height: node.height ?? 1,
      };
      for (const child of node.children ?? [])
        place(child, x + (child.x ?? 0), y + (child.y ?? 0));
    };
    const packer = new SheetPacker(s.area, occupied, gap / 2);
    const blocks = [...(laid.children ?? [])];
    if (s.frames.length && profile === 'compact')
      blocks.sort(
        (a, b) =>
          (profile === 'compact'
            ? (b.width ?? 0) * (b.height ?? 0) -
              (a.width ?? 0) * (a.height ?? 0)
            : (b.height ?? 0) - (a.height ?? 0)) || a.id.localeCompare(b.id),
      );
    for (const block of blocks) {
      const w = (block.width ?? 1) + s.grid.spacing,
        h = (block.height ?? 1) + s.grid.spacing;
      const descendants = (id: string): LayoutNode[] =>
        s.nodes.filter((n) => rootOf(n.id) === id);
      const originals = descendants(block.id).map(
          (n) => original.get(n.id)!.rect,
        ),
        old = originals.length
          ? union(originals)
          : { x: s.area.x, y: s.area.y, width: w, height: h };
      const preferred =
        profile === 'minimal_change'
          ? old
          : { x: s.area.x + (block.x ?? 0), y: s.area.y + (block.y ?? 0) };
      const p = packer.place(w, h, preferred, profile !== 'compact');
      if (!p) {
        s.issues.push({
          type: 'sheet_capacity',
          bounds: [{ x: 0, y: 0, width: w, height: h }],
          severity: 'error',
          objectIds: [block.id],
          message: `Diese Layoutvariante konnte die Gruppe (${Math.round(w)} × ${Math.round(h)} mm) nicht im Zeichenbereich (${Math.round(s.area.width)} × ${Math.round(s.area.height)} mm) unterbringen.`,
        });
        continue;
      }
      place(block, p.x + s.grid.spacing / 2, p.y + s.grid.spacing / 2);
      occupied.push({ ...p, width: w, height: h });
    }
    if (s.issues.some((i) => i.type === 'sheet_capacity')) {
      results.push({
        profile,
        snapshot: s,
        report: failedReport(s, 'placement'),
      });
      continue;
    }
    const placement = validateLayout({ ...s, edges: [] });
    if (!placement.valid) {
      placement.phase = 'placement';
      results.push({ profile, snapshot: s, report: placement });
      continue;
    }
    routeAll(s);
    if (s.issues.some((i) => i.type === 'route_failed')) {
      results.push({
        profile,
        snapshot: s,
        report: failedReport(s, 'routing'),
      });
      continue;
    }
    const report = validateLayout(s);
    report.phase = 'validation';
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

function failedReport(
  s: LayoutSnapshot,
  phase: 'placement' | 'routing',
): import('./types').LayoutReport {
  return {
    valid: false,
    phase,
    issues: [...s.issues],
    metrics: {
      bodyOverlaps: 0,
      textOverlaps: 0,
      wireObstacles: 0,
      overflows: 0,
      crossings: 0,
      bends: 0,
      length: 0,
      displacement: 0,
    },
  };
}
