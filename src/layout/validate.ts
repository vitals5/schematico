import type { LayoutSnapshot, LayoutReport, Point, Rect, Shape, LayoutEdge } from './types';
import { overlaps, contains, right, bottom } from './rect';
const eps = 1e-6;
export const axis = (a: Point, b: Point) => Math.abs(a.x - b.x) < eps || Math.abs(a.y - b.y) < eps;
export function segmentHits(a: Point, b: Point, r: Rect): boolean {
  if (Math.abs(a.x - b.x) < eps)
    return (
      a.x > r.x + eps &&
      a.x < right(r) - eps &&
      Math.max(a.y, b.y) > r.y + eps &&
      Math.min(a.y, b.y) < bottom(r) - eps
    );
  if (Math.abs(a.y - b.y) < eps)
    return (
      a.y > r.y + eps &&
      a.y < bottom(r) - eps &&
      Math.max(a.x, b.x) > r.x + eps &&
      Math.min(a.x, b.x) < right(r) - eps
    );
  return true;
}
export function endpointExemption(
  shape: Shape,
  edge: LayoutEdge,
  index: number,
  last: number,
): boolean {
  const endpoints = [...(index === 0 ? [edge.from] : []), ...(index === last ? [edge.to] : [])];
  return endpoints.some(
    (endpoint) =>
      shape.owner === endpoint.componentId &&
      (shape.kind === 'body' || (shape.kind === 'pin_label' && shape.pinId === endpoint.pinId)),
  );
}
export function netIds(snapshot: LayoutSnapshot): Map<string, string> {
  const parent = new Map<string, string>();
  const root = (s: string): string => {
    const p = parent.get(s);
    if (!p) {
      parent.set(s, s);
      return s;
    }
    if (p === s) return s;
    const r = root(p);
    parent.set(s, r);
    return r;
  };
  const key = (e: LayoutEdge['from']) => JSON.stringify([e.componentId, e.pinId]);
  for (const e of snapshot.edges) {
    const a = root(key(e.from)),
      b = root(key(e.to));
    parent.set(a, b);
  }
  return new Map(snapshot.edges.map((e) => [e.id, root(key(e.from))]));
}
export function parallelOverlap(a: Point, b: Point, c: Point, d: Point): boolean {
  return (
    (Math.abs(a.x - b.x) < eps &&
      Math.abs(c.x - d.x) < eps &&
      Math.abs(a.x - c.x) < eps &&
      Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) -
        Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) >
        eps) ||
    (Math.abs(a.y - b.y) < eps &&
      Math.abs(c.y - d.y) < eps &&
      Math.abs(a.y - c.y) < eps &&
      Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) -
        Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) >
        eps)
  );
}
export function crossing(a: Point, b: Point, c: Point, d: Point): boolean {
  if (Math.abs(a.x - b.x) < eps && Math.abs(c.y - d.y) < eps)
    return (
      a.x > Math.min(c.x, d.x) + eps &&
      a.x < Math.max(c.x, d.x) - eps &&
      c.y > Math.min(a.y, b.y) + eps &&
      c.y < Math.max(a.y, b.y) - eps
    );
  if (Math.abs(a.y - b.y) < eps && Math.abs(c.x - d.x) < eps) return crossing(c, d, a, b);
  return false;
}
export function validateLayout(s: LayoutSnapshot): LayoutReport {
  const issues = [...s.issues],
    metrics = {
      bodyOverlaps: 0,
      textOverlaps: 0,
      wireObstacles: 0,
      overflows: 0,
      crossings: 0,
      bends: 0,
      length: 0,
      displacement: 0,
    };
  const shapes = [...s.nodes.flatMap((n) => n.shapes), ...s.frames.flatMap((f) => f.shapes ?? [])];
  for (const n of s.nodes) {
    if (!Object.values(n.rect).every(Number.isFinite) || n.rect.width < 0 || n.rect.height < 0)
      issues.push({
        type: 'invalid_geometry',
        severity: 'error',
        objectIds: [n.id],
        message: 'Ungültige Geometrie.',
      });
    if (!contains(s.area, n.rect)) {
      metrics.overflows++;
      issues.push({
        type: 'sheet_overflow',
        severity: 'error',
        objectIds: [n.id],
        bounds: [n.rect, s.area],
        message: 'Objekt liegt außerhalb des nutzbaren Zeichenbereichs.',
      });
    }
  }
  for (let i = 0; i < shapes.length; i++)
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i],
        b = shapes[j];
      if (
        a.owner === b.owner ||
        a.kind === 'frame' ||
        b.kind === 'frame' ||
        !overlaps(a.rect, b.rect)
      )
        continue;
      const text =
        a.kind.includes('label') ||
        b.kind.includes('label') ||
        s.nodes.find((n) => n.id === a.owner)?.kind === 'text' ||
        s.nodes.find((n) => n.id === b.owner)?.kind === 'text';
      if (text) metrics.textOverlaps++;
      else metrics.bodyOverlaps++;
      issues.push({
        type: text ? 'text_overlap' : 'body_overlap',
        severity: 'error',
        objectIds: [a.owner, b.owner],
        bounds: [a.rect, b.rect],
        message: text
          ? 'Beschriftungen oder Objekte überlagern sich.'
          : 'Objektkörper überlagern sich.',
      });
    }
  const member = (frameId: string, id: string, seen = new Set<string>()): boolean => {
    if (seen.has(frameId)) return false;
    seen.add(frameId);
    return (
      s.frames
        .find((f) => f.id === frameId)
        ?.members.some((m) => m === id || member(m, id, seen)) ?? false
    );
  };
  for (const f of s.frames) {
    if (f.kind === 'group') continue;
    for (const shape of f.shapes ?? [])
      if (!contains(s.area, shape.rect))
        issues.push({
          type: 'frame_label_overflow',
          severity: 'error',
          objectIds: [f.id],
          bounds: [shape.rect],
          message: 'Kastenbeschriftung überschreitet den Zeichenbereich.',
        });
    if (!contains(s.area, f.rect))
      issues.push({
        type: 'frame_overflow',
        severity: 'error',
        objectIds: [f.id],
        bounds: [f.rect],
        message: 'Gerätekasten überschreitet den Zeichenbereich.',
      });
    for (const n of s.nodes) {
      if (member(f.id, n.id)) {
        if (!contains(f.rect, n.rect))
          issues.push({
            type: 'group_overflow',
            severity: 'error',
            objectIds: [f.id, n.id],
            bounds: [f.rect, n.rect],
            message: 'Gruppeninhalt liegt außerhalb seines Kastens.',
          });
      } else if (
        overlaps(f.rect, n.rect) &&
        !s.frames.some(
          (other) => other.id !== f.id && member(other.id, f.id) && member(other.id, n.id),
        )
      )
        issues.push({
          type: 'foreign_group_overlap',
          severity: 'error',
          objectIds: [f.id, n.id],
          message: 'Fremdes Objekt überlagert einen Gerätekasten.',
        });
    }
  }
  for (let i = 0; i < s.frames.length; i++)
    for (let j = i + 1; j < s.frames.length; j++) {
      const a = s.frames[i],
        b = s.frames[j];
      if (a.kind === 'group' || b.kind === 'group') continue;
      if (overlaps(a.rect, b.rect) && !member(a.id, b.id) && !member(b.id, a.id))
        issues.push({
          type: 'frame_overlap',
          severity: 'error',
          objectIds: [a.id, b.id],
          bounds: [a.rect, b.rect],
          message: 'Unabhängige Gerätekästen überlagern sich.',
        });
    }
  const nets = netIds(s),
    dirs = {
      top: { x: 0, y: -1 },
      right: { x: 1, y: 0 },
      bottom: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
    };
  for (const e of s.edges) {
    const contact =
      e.points.length === 2 &&
      Math.abs(e.points[0].x - e.points[1].x) < eps &&
      Math.abs(e.points[0].y - e.points[1].y) < eps;
    for (const [ep, a, b] of [
      [e.from, e.points[0], e.points[1]],
      [e.to, e.points.at(-1), e.points.at(-2)],
    ] as const) {
      const pin = s.nodes.find((n) => n.id === ep.componentId)?.pins.find((p) => p.id === ep.pinId);
      if (
        !pin ||
        !a ||
        !b ||
        Math.abs(pin.x - a.x) > eps ||
        Math.abs(pin.y - a.y) > eps ||
        (!contact &&
          (b.x - a.x) * dirs[pin.direction].x + (b.y - a.y) * dirs[pin.direction].y <= eps)
      )
        issues.push({
          type: 'pin_direction',
          severity: 'error',
          objectIds: [e.id, ep.componentId],
          message: 'Leitung verletzt Anschlussposition oder Anschlussrichtung.',
        });
    }
    for (let i = 1; i < e.points.length; i++) {
      const a = e.points[i - 1],
        b = e.points[i];
      if (!axis(a, b))
        issues.push({
          type: 'diagonal_wire',
          severity: 'error',
          objectIds: [e.id],
          message: 'Leitung ist nicht orthogonal.',
        });
      if (
        !contains(s.area, {
          x: Math.min(a.x, b.x),
          y: Math.min(a.y, b.y),
          width: Math.abs(a.x - b.x),
          height: Math.abs(a.y - b.y),
        })
      )
        issues.push({
          type: 'wire_overflow',
          severity: 'error',
          objectIds: [e.id],
          message: 'Leitung überschreitet den Zeichenbereich.',
        });
      metrics.length += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (i > 1) metrics.bends++;
      for (const shape of shapes)
        if (
          shape.kind !== 'frame' &&
          !endpointExemption(shape, e, i - 1, e.points.length - 2) &&
          segmentHits(a, b, shape.rect)
        ) {
          metrics.wireObstacles++;
          issues.push({
            type: 'wire_obstacle',
            severity: 'error',
            objectIds: [e.id, shape.owner],
            bounds: [shape.rect],
            message: 'Leitung verläuft durch ein Objekt oder eine Beschriftung.',
          });
        }
    }
  }
  for (let i = 0; i < s.edges.length; i++)
    for (let j = i + 1; j < s.edges.length; j++) {
      const a = s.edges[i],
        b = s.edges[j];
      for (let x = 1; x < a.points.length; x++)
        for (let y = 1; y < b.points.length; y++) {
          if (
            nets.get(a.id) !== nets.get(b.id) &&
            parallelOverlap(a.points[x - 1], a.points[x], b.points[y - 1], b.points[y])
          )
            issues.push({
              type: 'net_overlap',
              severity: 'error',
              objectIds: [a.id, b.id],
              message: 'Verschiedene Netze teilen sich einen Leitungsabschnitt.',
            });
          if (crossing(a.points[x - 1], a.points[x], b.points[y - 1], b.points[y]))
            metrics.crossings++;
        }
    }
  return { valid: !issues.some((i) => i.severity === 'error'), issues, metrics };
}
