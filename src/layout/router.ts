import type { LayoutSnapshot, LayoutEdge, Point, Shape } from './types';
import { bottom, right, contains, union } from './rect';
import { segmentHits, endpointExemption, netIds, parallelOverlap, crossing } from './validate';
const vectors = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
const same = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
class Heap<T> {
  private data: { cost: number; value: T }[] = [];
  push(cost: number, value: T) {
    let i = this.data.length;
    this.data.push({ cost, value });
    while (i) {
      const p = (i - 1) >> 1;
      if (this.data[p].cost <= cost) break;
      this.data[i] = this.data[p];
      i = p;
    }
    this.data[i] = { cost, value };
  }
  pop(): T | undefined {
    if (!this.data.length) return;
    const top = this.data[0],
      last = this.data.pop()!;
    if (this.data.length) {
      let i = 0;
      while (i * 2 + 1 < this.data.length) {
        let c = i * 2 + 1;
        if (c + 1 < this.data.length && this.data[c + 1].cost < this.data[c].cost) c++;
        if (this.data[c].cost >= last.cost) break;
        this.data[i] = this.data[c];
        i = c;
      }
      this.data[i] = last;
    }
    return top.value;
  }
  get length() {
    return this.data.length;
  }
}
export function routeAll(s: LayoutSnapshot): void {
  const shapes = s.nodes.flatMap((n) => n.shapes).filter((g) => g.kind !== 'frame'),
    done: LayoutEdge[] = [],
    nets = netIds(s);
  for (const e of [...s.edges].sort((a, b) => a.id.localeCompare(b.id))) {
    const routed = route(s, e, shapes, done, nets);
    if (!routed) {
      s.issues.push({
        type: 'route_failed',
        severity: 'error',
        objectIds: [e.id],
        message: 'Kein hindernisfreier Leitungsweg mit gültigen Anschlussrichtungen gefunden.',
      });
      continue;
    }
    e.points = routed;
    done.push(e);
  }
}
function route(
  s: LayoutSnapshot,
  e: LayoutEdge,
  shapes: Shape[],
  done: LayoutEdge[],
  nets: Map<string, string>,
): Point[] | undefined {
  const from = s.nodes
      .find((n) => n.id === e.from.componentId)
      ?.pins.find((p) => p.id === e.from.pinId),
    to = s.nodes.find((n) => n.id === e.to.componentId)?.pins.find((p) => p.id === e.to.pinId);
  if (!from || !to) return;
  if (same(from, to))
    return [
      { x: from.x, y: from.y },
      { x: to.x, y: to.y },
    ];
  const stub = (pin: typeof from, owner: string) => {
    const v = vectors[pin.direction],
      parts = s.nodes
        .find((n) => n.id === owner)!
        .shapes.filter((g) => g.kind === 'body' || (g.kind === 'pin_label' && g.pinId === pin.id))
        .map((g) => g.rect),
      body = parts.length ? union(parts) : undefined;
    let len = Math.max(2, s.grid.spacing / 2);
    if (body) {
      if (v.x > 0) len = Math.max(len, right(body) - pin.x + 2);
      if (v.x < 0) len = Math.max(len, pin.x - body.x + 2);
      if (v.y > 0) len = Math.max(len, bottom(body) - pin.y + 2);
      if (v.y < 0) len = Math.max(len, pin.y - body.y + 2);
    }
    return { x: pin.x + v.x * len, y: pin.y + v.y * len };
  };
  const a = stub(from, e.from.componentId),
    b = stub(to, e.to.componentId);
  const clear = (p: Point, q: Point, index = -1) =>
    contains(s.area, {
      x: Math.min(p.x, q.x),
      y: Math.min(p.y, q.y),
      width: Math.abs(p.x - q.x),
      height: Math.abs(p.y - q.y),
    }) &&
    !shapes.some(
      (g) => !(index >= 0 && endpointExemption(g, e, index, 1)) && segmentHits(p, q, g.rect),
    ) &&
    !done.some(
      (w) =>
        nets.get(e.id) !== nets.get(w.id) &&
        w.points.slice(1).some((d, i) => parallelOverlap(p, q, w.points[i], d)),
    );
  if (!clear(from, a, 0) || !clear(b, to, 1)) return;
  const xs = new Set<number>([a.x, b.x, s.area.x, right(s.area)]),
    ys = new Set<number>([a.y, b.y, s.area.y, bottom(s.area)]);
  const step = Math.max(2, s.grid.spacing);
  for (let x = s.area.x; x < right(s.area); x += step) xs.add(x);
  for (let y = s.area.y; y < bottom(s.area); y += step) ys.add(y);
  for (const g of shapes) {
    xs.add(g.rect.x - 1);
    xs.add(right(g.rect) + 1);
    ys.add(g.rect.y - 1);
    ys.add(bottom(g.rect) + 1);
  }
  const xx = [...xs].filter((x) => x >= s.area.x && x <= right(s.area)).sort((a, b) => a - b),
    yy = [...ys].filter((y) => y >= s.area.y && y <= bottom(s.area)).sort((a, b) => a - b);
  type State = { x: number; y: number; d: number; g: number; key: string };
  const key = (x: number, y: number, d: number) => `${x},${y},${d}`,
    heap = new Heap<State>(),
    best = new Map<string, number>(),
    prev = new Map<string, string>();
  const ax = xx.indexOf(a.x),
    ay = yy.indexOf(a.y),
    bx = xx.indexOf(b.x),
    by = yy.indexOf(b.y);
  if ([ax, ay, bx, by].some((v) => v < 0)) return;
  const initialD = from.direction === 'left' || from.direction === 'right' ? 0 : 1;
  const start = key(ax, ay, initialD);
  heap.push(0, { x: ax, y: ay, d: initialD, g: 0, key: start });
  best.set(start, 0);
  let expansions = 0,
    last: string | undefined;
  while (heap.length && expansions++ < 100000) {
    const curr = heap.pop()!;
    if (curr.g !== best.get(curr.key)) continue;
    if (curr.x === bx && curr.y === by) {
      last = curr.key;
      break;
    }
    for (const [dx, dy, d] of [
      [-1, 0, 0],
      [1, 0, 0],
      [0, -1, 1],
      [0, 1, 1],
    ]) {
      const x = curr.x + dx,
        y = curr.y + dy;
      if (x < 0 || x >= xx.length || y < 0 || y >= yy.length) continue;
      const p = { x: xx[curr.x], y: yy[curr.y] },
        q = { x: xx[x], y: yy[y] };
      if (
        curr.key === start &&
        (q.x - p.x) * vectors[from.direction].x + (q.y - p.y) * vectors[from.direction].y < -1e-6
      )
        continue;
      if (
        x === bx &&
        y === by &&
        (q.x - p.x) * vectors[to.direction].x + (q.y - p.y) * vectors[to.direction].y > 1e-6
      )
        continue;
      if (!clear(p, q)) continue;
      const crosses = done.reduce(
          (n, w) => n + w.points.slice(1).filter((b, i) => crossing(p, q, w.points[i], b)).length,
          0,
        ),
        g =
          curr.g +
          Math.abs(q.x - p.x) +
          Math.abs(q.y - p.y) +
          (curr.d === d ? 0 : 8) +
          crosses * 20,
        k = key(x, y, d);
      if (g >= (best.get(k) ?? Infinity)) continue;
      best.set(k, g);
      prev.set(k, curr.key);
      heap.push(g + Math.abs(q.x - b.x) + Math.abs(q.y - b.y), { x, y, d, g, key: k });
    }
  }
  if (!last) return;
  const points: Point[] = [];
  for (let k: string | undefined = last; k; k = prev.get(k)) {
    const [x, y] = k.split(',').map(Number);
    points.push({ x: xx[x], y: yy[y] });
  }
  points.reverse();
  points.unshift({ x: from.x, y: from.y });
  points.push({ x: to.x, y: to.y });
  const compact: Point[] = [];
  for (const p of points) {
    if (compact.length && same(compact.at(-1)!, p)) continue;
    while (compact.length > 1) {
      const a = compact.at(-2)!,
        b = compact.at(-1)!;
      if (
        ((Math.abs(a.x - b.x) < 1e-6 && Math.abs(b.x - p.x) < 1e-6) ||
          (Math.abs(a.y - b.y) < 1e-6 && Math.abs(b.y - p.y) < 1e-6)) &&
        (b.x - a.x) * (p.x - b.x) + (b.y - a.y) * (p.y - b.y) >= 0
      )
        compact.pop();
      else break;
    }
    compact.push(p);
  }
  return compact;
}
