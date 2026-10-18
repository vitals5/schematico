import { Page, PinDefinition, Project, Wire } from './types';
import { getSymbolForComponent } from './symbols';
import { snapCoordinate } from './DrawingGrid';

type Point = { x: number; y: number };
type Direction = PinDefinition['direction'];
const epsilon = 1e-8;
const vectors: Record<Direction, Point> = {
  top: { x: 0, y: -1 }, right: { x: 1, y: 0 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }
};
const same = (a: Point, b: Point) => Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;
const aligned = (a: Point, b: Point) => Math.abs(a.x - b.x) < epsilon || Math.abs(a.y - b.y) < epsilon;
const outward = (pin: Point, next: Point, direction?: Direction) => !direction ||
  (aligned(pin, next) && (next.x - pin.x) * vectors[direction].x + (next.y - pin.y) * vectors[direction].y > epsilon);

/** Shared centerline for painting, dragging, hit testing and PDF export. */
export function wirePolyline(from: Point, to: Point, waypoints: readonly Point[] = [],
  fromDirection?: Direction, toDirection?: Direction, busbar = false, grid?: Page['grid']): Point[] {
  if (waypoints.length) return orthogonalWirePoints(from, to, waypoints, fromDirection, toDirection, grid);
  const midY = grid ? snapCoordinate((from.y + to.y) / 2, grid.spacing, grid.origin.y) : (from.y + to.y) / 2;
  const preferred = aligned(from, to) ? [from, to] : busbar ? [from, { x: to.x, y: from.y }, to]
    : [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
  return connectPins(from, to, fromDirection, toDirection, grid, preferred);
}

export function wirePinDirection(page: Page, project: Project, endpoint: Wire['from']): Direction | undefined {
  const component = page.components.find(c => c.id === endpoint.componentId);
  if (!component) return;
  const symbol = getSymbolForComponent(component, project);
  const pin = symbol?.pins.find(p => p.id === endpoint.pinId);
  if (!pin) return;
  const directions: Direction[] = ['top', 'right', 'bottom', 'left'];
  const index = directions.indexOf(pin.direction) + Math.round((component.rotation || 0) / 90);
  return directions[((index % 4) + 4) % 4];
}

/** Remove redundant internal points without changing either endpoint. */
function compact(points: readonly Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    if (result.length && same(result.at(-1)!, point)) continue;
    while (result.length > 1) {
      const a = result.at(-2)!, b = result.at(-1)!;
      const dx = b.x - a.x, dy = b.y - a.y, nextX = point.x - b.x, nextY = point.y - b.y;
      if (Math.abs(dx * nextY - dy * nextX) > epsilon || dx * nextX + dy * nextY <= 0) break;
      result.pop();
    }
    result.push({ ...point });
  }
  return result;
}

function onSegment(point: Point, a: Point, b: Point): boolean {
  return aligned(a, b) && point.x >= Math.min(a.x, b.x) - epsilon && point.x <= Math.max(a.x, b.x) + epsilon
    && point.y >= Math.min(a.y, b.y) - epsilon && point.y <= Math.max(a.y, b.y) + epsilon
    && (Math.abs(a.x - b.x) < epsilon ? Math.abs(point.x - a.x) < epsilon : Math.abs(point.y - a.y) < epsilon);
}

function validRoute(points: Point[], fromDirection?: Direction, toDirection?: Direction, before?: Point, after?: Point): boolean {
  if (points.length < 2) return false;
  if (before && (points[0].x - before.x) * (points[1].x - points[0].x)
    + (points[0].y - before.y) * (points[1].y - points[0].y) < -epsilon) return false;
  const last = points.at(-1)!, previous = points.at(-2)!;
  if (after && (last.x - previous.x) * (after.x - last.x)
    + (last.y - previous.y) * (after.y - last.y) < -epsilon) return false;
  if (!outward(points[0], points[1], fromDirection) || !outward(points.at(-1)!, points.at(-2)!, toDirection)) return false;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (!aligned(a, b)) return false;
    // A turn back along the just-drawn segment doubles the conductor and, for
    // an aligned anchor behind the pin, would run straight through the device.
    if (i > 1) {
      const before = points[i - 2];
      if ((a.x - before.x) * (b.x - a.x) + (a.y - before.y) * (b.y - a.y) < -epsilon) return false;
    }
    if (i > 1 && onSegment(points[0], a, b)) return false;
    if (i < points.length - 1 && onSegment(points.at(-1)!, a, b)) return false;
  }
  return true;
}

/** A small set of Manhattan corridors suffices for endpoint direction constraints.
 * This does not infer obstacles or change stored routing anchors.
 */
function connectPins(from: Point, to: Point, fromDirection?: Direction, toDirection?: Direction,
  grid?: Page['grid'], preferred?: Point[], before?: Point, after?: Point): Point[] {
  if (same(from, to)) return [{ ...from }, { ...to }];
  const vertical = fromDirection !== 'left' && fromDirection !== 'right';
  const initial = compact(preferred ?? (aligned(from, to) ? [from, to]
    : [from, vertical ? { x: from.x, y: to.y } : { x: to.x, y: from.y }, to]));
  if (validRoute(initial, fromDirection, toDirection, before, after)) return initial;

  const spacing = grid && Number.isFinite(grid.spacing) && grid.spacing > 0 ? grid.spacing : 8;
  const origin = grid?.origin ?? { x: 0, y: 0 };
  const below = (value: number, axis: number) => axis + (Math.ceil((value - axis) / spacing) - 1) * spacing;
  const above = (value: number, axis: number) => axis + (Math.floor((value - axis) / spacing) + 1) * spacing;
  const stub = (point: Point, other: Point, direction?: Direction): Point => {
    if (!direction) return point;
    const vector = vectors[direction];
    let result = direction === 'top' ? { x: point.x, y: below(point.y, origin.y) }
      : direction === 'bottom' ? { x: point.x, y: above(point.y, origin.y) }
      : direction === 'left' ? { x: below(point.x, origin.x), y: point.y }
      : { x: above(point.x, origin.x), y: point.y };
    const distance = (other.x - point.x) * vector.x + (other.y - point.y) * vector.y;
    if (aligned(point, other) && distance > 0
      && Math.abs(result.x - point.x) + Math.abs(result.y - point.y) >= distance) {
      // Closely spaced, off-grid pins may have no grid line between them.
      // Keep the stub on its outward side without passing the other pin.
      result = { x: point.x + vector.x * distance / 2, y: point.y + vector.y * distance / 2 };
    }
    return result;
  };
  const a = stub(from, to, fromDirection), b = stub(to, from, toDirection);
  const candidates: Point[][] = [
    [from, { x: from.x, y: to.y }, to], [from, { x: to.x, y: from.y }, to]
  ];
  const xs = [snapCoordinate((from.x + to.x) / 2, spacing, origin.x),
    below(Math.min(from.x, to.x, a.x, b.x), origin.x), above(Math.max(from.x, to.x, a.x, b.x), origin.x)];
  const ys = [snapCoordinate((from.y + to.y) / 2, spacing, origin.y),
    below(Math.min(from.y, to.y, a.y, b.y), origin.y), above(Math.max(from.y, to.y, a.y, b.y), origin.y)];
  for (const [start, end, head, tail] of [[from, to, [], []], [a, b, [from], [to]]] as const) {
    candidates.push([...head, start, end, ...tail],
      [...head, start, { x: start.x, y: end.y }, end, ...tail],
      [...head, start, { x: end.x, y: start.y }, end, ...tail]);
    for (const x of xs) candidates.push([...head, start, { x, y: start.y }, { x, y: end.y }, end, ...tail]);
    for (const y of ys) candidates.push([...head, start, { x: start.x, y }, { x: end.x, y }, end, ...tail]);
  }
  const routes = candidates.map(compact).filter(points => validRoute(points, fromDirection, toDirection, before, after));
  const length = (points: Point[]) => points.slice(1).reduce((sum, p, i) => sum + Math.abs(p.x - points[i].x) + Math.abs(p.y - points[i].y), 0);
  routes.sort((a, b) => length(a) - length(b) || a.length - b.length);
  // Outside corridors always yield a route for finite distinct endpoints and
  // the four orthogonal directions; retain connectivity for invalid input too.
  return routes[0] ?? initial;
}

/** Preserve explicit routing anchors while reconnecting moved pins orthogonally.
 * The result is transient; moving a component never rewrites its imported route.
 */
export function orthogonalWirePoints(from: Point, to: Point, waypoints: readonly Point[], fromDirection?: Direction, toDirection?: Direction, grid?: Page['grid']): Point[] {
  const anchors = [from, ...waypoints, to].filter((point, i, all) => i === 0 || !same(point, all[i - 1]));
  if (anchors.length < 2) return [{ ...from }, { ...to }];
  const points: Point[] = [{ ...from }];
  for (let i = 1; i < anchors.length; i++) points.push(...connectPins(anchors[i - 1], anchors[i],
    i === 1 ? fromDirection : undefined, i === anchors.length - 1 ? toDirection : undefined, grid, undefined,
    points.at(-2), anchors[i + 1] && aligned(anchors[i], anchors[i + 1]) ? anchors[i + 1] : undefined).slice(1));
  return points;
}
