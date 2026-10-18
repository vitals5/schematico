import { Page, PlacedComponent, Project, SymbolDefinition, Wire } from './types';
import { getSymbolForComponent } from './symbols';
import { arcPoints } from './ImportedDrawing';
import { wirePinDirection, wirePolyline } from './WireRouting';
import { gridForPage } from './DrawingGrid';

type Point = { x: number; y: number };
export type WireCutout = { minX: number; minY: number; maxX: number; maxY: number };

export function isConnectionGraphic(component: PlacedComponent, symbol: SymbolDefinition): boolean {
  return Boolean(symbol.connectionGraphic || symbol.source && [0x2a, 0x82].includes(component.source?.objectType ?? -1));
}

function pinPosition(component: PlacedComponent, symbol: SymbolDefinition, pinId: string): Point | undefined {
  const pin = symbol.pins.find(p => p.id === pinId);
  if (!pin) return;
  const a = component.rotation * Math.PI / 180, dx = pin.x - symbol.width / 2, dy = pin.y - symbol.height / 2;
  return { x: component.x + symbol.width / 2 + dx * Math.cos(a) - dy * Math.sin(a),
    y: component.y + symbol.height / 2 + dx * Math.sin(a) + dy * Math.cos(a) };
}

/** Routing records are not electrical endpoints. Resolve their stroke color
 * from a wire through the anchor, without adding that wire to the net graph.
 */
export function connectionGraphicWires(page: Page, project: Project): Map<string, Wire> {
  const endpoint = (ep: Wire['from']) => {
    const component = page.components.find(c => c.id === ep.componentId);
    const symbol = component && getSymbolForComponent(component, project);
    return component && symbol ? pinPosition(component, symbol, ep.pinId) : undefined;
  };
  const wires = page.wires.map(wire => {
    const from = endpoint(wire.from), to = endpoint(wire.to);
    return { wire, points: from && to ? wirePolyline(from, to, wire.waypoints,
      wirePinDirection(page, project, wire.from), wirePinDirection(page, project, wire.to),
      page.components.find(c => c.id === wire.from.componentId)?.symbolId === 'potential_rail_source', gridForPage(page)) : [] };
  });
  const result = new Map<string, Wire>();
  for (const component of page.components) {
    const symbol = getSymbolForComponent(component, project);
    if (!symbol || !isConnectionGraphic(component, symbol) || !symbol.pins.length) continue;
    const anchor = pinPosition(component, symbol, symbol.pins[0].id)!;
    const direct = page.wires.find(w => w.from.componentId === component.id || w.to.componentId === component.id);
    const through = direct ?? wires.find(({ points }) => points.slice(1).some((b, i) => {
      const a = points[i], dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
      if (length < 1e-12) return false;
      const t = ((anchor.x - a.x) * dx + (anchor.y - a.y) * dy) / length;
      return t >= -1e-8 && t <= 1 + 1e-8 && Math.hypot(anchor.x - a.x - t * dx, anchor.y - a.y - t * dy) < 1e-6;
    }))?.wire;
    if (through) result.set(component.id, through);
  }
  return result;
}

/** A native CAD functional distributor remains editable, but its ink is replaced when
 * the project also supplies an explicit routing variant at the same anchor.
 * Do not merge the two objects or infer a new electrical connection.
 */
export function supersededConnectionGraphics(page: Page, project: Project): Set<string> {
  const entries = page.components.flatMap(component => {
    const symbol = getSymbolForComponent(component, project);
    if (!symbol || !isConnectionGraphic(component, symbol) || !symbol.pins.length) return [];
    const pin = symbol.pins[0], a = component.rotation * Math.PI / 180;
    const dx = pin.x - symbol.width / 2, dy = pin.y - symbol.height / 2;
    const directions = ['top', 'right', 'bottom', 'left'];
    return [{ component, x: component.x + symbol.width / 2 + dx * Math.cos(a) - dy * Math.sin(a),
      y: component.y + symbol.height / 2 + dx * Math.sin(a) + dy * Math.cos(a),
      directions: symbol.pins.map(p => directions[(directions.indexOf(p.direction) + component.rotation / 90) % 4]).sort().join(',') }];
  });
  return new Set(entries.filter(e => e.component.source?.objectType === 17 && entries.some(r =>
    r.component.source?.objectType === 0x2a && r.component.source.routingUsed !== false && r.directions === e.directions
    && Math.hypot(r.x - e.x, r.y - e.y) < 1e-6)).map(e => e.component.id));
}

/** The small original library glyph supplies the complete ink within this area.
 * Do not draw a straight branch over native CAD's directional diagonal / bus strokes.
 */
export function connectionCutouts(page: Page, project: Project): WireCutout[] {
  const superseded = supersededConnectionGraphics(page, project);
  return page.components.flatMap(component => {
    if (superseded.has(component.id) || component.source?.routingUsed === false) return [];
    const symbol = getSymbolForComponent(component, project);
    if (!symbol || !isConnectionGraphic(component, symbol) || !symbol.importedGraphics?.length) return [];
    const angle = component.rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    const cx = component.x + symbol.width / 2, cy = component.y + symbol.height / 2;
    // Definitions have a minimum editor size of one unit for selection. Ink
    // bounds must use the real geometry, including zero-width straight nodes.
    const points = symbol.importedGraphics.flatMap(g => g.kind === 'line'
      ? [{ x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 }]
      : g.kind === 'polygon' ? g.points : g.kind === 'arc' ? arcPoints(g)
      : g.kind === 'circle' ? [{ x: g.x - g.radius, y: g.y - g.radius }, { x: g.x + g.radius, y: g.y + g.radius }]
      : g.kind === 'rect' ? [g, { x: g.x + g.width, y: g.y + g.height }] : []);
    if (!points.length) return [];
    const corners = points.map(({ x, y }) => ({
      x: cx + (x - symbol.width / 2) * cos - (y - symbol.height / 2) * sin,
      y: cy + (x - symbol.width / 2) * sin + (y - symbol.height / 2) * cos
    }));
    return [{ minX: Math.min(...corners.map(p => p.x)), minY: Math.min(...corners.map(p => p.y)),
      maxX: Math.max(...corners.map(p => p.x)), maxY: Math.max(...corners.map(p => p.y)) }];
  });
}

/** Subtract closed glyph rectangles from wire centerlines; never infer connectivity.
 * Uses segment/rectangle clipping, so dragging a segment does not rely on axis tests.
 */
export function visibleWireSegments(points: readonly Point[], cutouts: readonly WireCutout[]): [Point, Point][] {
  const result: [Point, Point][] = [], epsilon = 1e-8;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) + Math.abs(dy) < epsilon) continue;
    const removed: [number, number][] = [];
    for (const box of cutouts) {
      let start = 0, end = 1, intersects = true;
      for (const [origin, delta, min, max] of [[a.x, dx, box.minX, box.maxX], [a.y, dy, box.minY, box.maxY]]) {
        if (Math.abs(delta) < epsilon) {
          if (origin < min - epsilon || origin > max + epsilon) { intersects = false; break; }
        } else {
          const p = (min - origin) / delta, q = (max - origin) / delta;
          start = Math.max(start, Math.min(p, q)); end = Math.min(end, Math.max(p, q));
          if (start > end + epsilon) { intersects = false; break; }
        }
      }
      if (intersects && end - start > epsilon) removed.push([start, end]);
    }
    removed.sort((p, q) => p[0] - q[0]);
    const at = (t: number): Point => ({ x: a.x + t * dx, y: a.y + t * dy });
    let cursor = 0;
    for (const [start, end] of removed) {
      if (start > cursor + epsilon) result.push([at(cursor), at(start)]);
      cursor = Math.max(cursor, end);
    }
    if (cursor < 1 - epsilon) result.push([at(cursor), at(1)]);
  }
  return result;
}
