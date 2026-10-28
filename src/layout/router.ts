import type { LayoutSnapshot, LayoutEdge, Point, Shape } from './types';
import { bottom, right, contains, union } from './rect';
import {
  segmentHits,
  endpointExemption,
  netIds,
  parallelOverlap,
  crossing,
} from './validate';
const vectors = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
const same = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
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
        if (
          c + 1 < this.data.length &&
          this.data[c + 1].cost < this.data[c].cost
        )
          c++;
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
export function pinStub(
  s: LayoutSnapshot,
  pin: NonNullable<LayoutSnapshot['nodes'][number]['pins'][number]>,
  owner: string,
): Point {
  const v = vectors[pin.direction],
    parts = s.nodes
      .find((n) => n.id === owner)!
      .shapes.filter(
        (g) =>
          g.kind === 'body' || (g.kind === 'pin_label' && g.pinId === pin.id),
      )
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
}
type ReservedStub = { edgeId: string; p: Point; q: Point };
export function routeAll(s: LayoutSnapshot, reverse = false, bundles = false, clearance = 0): void {
  const shapes = s.nodes
      .flatMap((n) => n.shapes)
      .filter((g) => g.kind !== 'frame'),
    done: LayoutEdge[] = [],
    nets = netIds(s);
  const reserved: ReservedStub[] = s.edges.flatMap((e) =>
    [e.from, e.to].flatMap((endpoint) => {
      const pin = s.nodes
        .find((n) => n.id === endpoint.componentId)
        ?.pins.find((p) => p.id === endpoint.pinId);
      return pin
        ? [{ edgeId: e.id, p: pin, q: pinStub(s, pin, endpoint.componentId) }]
        : [];
    }),
  );
  const bundleKey = (e: LayoutEdge) => JSON.stringify([e.from.componentId,e.to.componentId].sort());
  const pinOrder = (e: LayoutEdge) => {
    const first=[e.from,e.to].sort((a,b)=>a.componentId.localeCompare(b.componentId))[0];
    const pin=s.nodes.find(n=>n.id===first.componentId)?.pins.find(p=>p.id===first.pinId);
    return pin ? (pin.direction==='top'||pin.direction==='bottom'?pin.x:pin.y) : 0;
  };
  const ordered=[...s.edges].sort((a,b)=> bundles
    ? bundleKey(a).localeCompare(bundleKey(b)) || pinOrder(a)-pinOrder(b) || a.id.localeCompare(b.id)
    : a.id.localeCompare(b.id) * (reverse ? -1 : 1));
  for (const e of ordered) {
    const routed = route(s, e, shapes, done, nets, reserved, bundles, clearance);
    if (!routed) {
      s.issues.push({
        type: 'route_failed',
        severity: 'error',
        objectIds: [e.id],
        message:
          'Kein hindernisfreier Leitungsweg mit gültigen Anschlussrichtungen gefunden.',
      });
      continue;
    }
    e.points = routed;
    done.push(e);
  }
}
/** Reroute selected edges against the exact, unchanged geometry of every other edge.
 * Failed routes retain their original path and remain obstacles for subsequent edges. */
export function routeSelected(s: LayoutSnapshot, ids: ReadonlySet<string>, clearance: number): string[] {
  const shapes=s.nodes.flatMap(n=>n.shapes).filter(g=>g.kind!=='frame');
  const nets=netIds(s), done=[...s.edges];
  const reserved: ReservedStub[]=s.edges.flatMap(e=>[e.from,e.to].flatMap(endpoint=>{
    const pin=s.nodes.find(n=>n.id===endpoint.componentId)?.pins.find(p=>p.id===endpoint.pinId);
    return pin?[{edgeId:e.id,p:pin,q:pinStub(s,pin,endpoint.componentId)}]:[];
  }));
  const failed:string[]=[];
  for(const e of s.edges.filter(e=>ids.has(e.id)).sort((a,b)=>a.id.localeCompare(b.id))){
    done.splice(done.indexOf(e),1);
    const points=route(s,e,shapes,done,nets,reserved,true,clearance);
    if(points)e.points=points;else failed.push(e.id);
    done.push(e);
  }
  return failed;
}

function route(
  s: LayoutSnapshot,
  e: LayoutEdge,
  shapes: Shape[],
  done: LayoutEdge[],
  nets: Map<string, string>,
  reserved: ReservedStub[],
  bundles = false,
  clearance = 0,
): Point[] | undefined {
  const from = s.nodes
      .find((n) => n.id === e.from.componentId)
      ?.pins.find((p) => p.id === e.from.pinId),
    to = s.nodes
      .find((n) => n.id === e.to.componentId)
      ?.pins.find((p) => p.id === e.to.pinId);
  if (!from || !to) return;
  if (same(from, to))
    return [
      { x: from.x, y: from.y },
      { x: to.x, y: to.y },
    ];
  const a = pinStub(s, from, e.from.componentId),
    b = pinStub(s, to, e.to.componentId);
  const rowShapes = new Map<number, Shape[]>(),
    columnShapes = new Map<number, Shape[]>(),
    clearCache = new Map<string, boolean>();
  const tooClose = (p: Point,q: Point,a: Point,b: Point) => {
    if(parallelOverlap(p,q,a,b))return true;
    if(clearance<=0)return false;
    if(Math.abs(p.y-q.y)<1e-6&&Math.abs(a.y-b.y)<1e-6)
      return Math.abs(p.y-a.y)<clearance-1e-6&&Math.min(Math.max(p.x,q.x),Math.max(a.x,b.x))-Math.max(Math.min(p.x,q.x),Math.min(a.x,b.x))>1e-6;
    if(Math.abs(p.x-q.x)<1e-6&&Math.abs(a.x-b.x)<1e-6)
      return Math.abs(p.x-a.x)<clearance-1e-6&&Math.min(Math.max(p.y,q.y),Math.max(a.y,b.y))-Math.max(Math.min(p.y,q.y),Math.min(a.y,b.y))>1e-6;
    return false;
  };
  // Each routed edge sees immutable obstacles. Index parallel blockers and crossings
  // by corridor instead of repeatedly scanning/allocating every wire segment in A*.
  type Segment = {p:Point;q:Point};
  const existing:Segment[]=done.flatMap(w=>w.points.slice(1).map((q,i)=>({p:w.points[i],q})));
  const foreign:Segment[]=[
    ...reserved.filter(r=>r.edgeId!==e.id&&nets.get(r.edgeId)!==nets.get(e.id)).map(r=>({p:r.p,q:r.q})),
    ...done.filter(w=>nets.get(w.id)!==nets.get(e.id)).flatMap(w=>w.points.slice(1).map((q,i)=>({p:w.points[i],q}))),
  ];
  const horizontal=(s:Segment)=>Math.abs(s.p.y-s.q.y)<1e-6;
  const horizontalForeign=foreign.filter(horizontal),verticalForeign=foreign.filter(s=>!horizontal(s));
  const horizontalExisting=existing.filter(horizontal),verticalExisting=existing.filter(s=>!horizontal(s));
  const rowBlockers=new Map<number,Segment[]>(),columnBlockers=new Map<number,Segment[]>();
  const rowCrossings=new Map<number,Segment[]>(),columnCrossings=new Map<number,Segment[]>();
  const crossingCount=(p:Point,q:Point)=>{
    const list=Math.abs(p.y-q.y)<1e-6?rowCrossings.get(p.y)??verticalExisting:columnCrossings.get(p.x)??horizontalExisting;
    let count=0;for(const s of list)if(crossing(p,q,s.p,s.q))count++;return count;
  };
  const clear = (p: Point, q: Point, index = -1): boolean => {
    const cacheKey = p.x + ',' + p.y + '|' + q.x + ',' + q.y;
    if (index < 0 && clearCache.has(cacheKey)) return clearCache.get(cacheKey)!;
    const obstacles =
      index >= 0
        ? shapes
        : Math.abs(p.y - q.y) < 1e-6
          ? (rowShapes.get(p.y) ?? shapes)
          : (columnShapes.get(p.x) ?? shapes);
    const result =
      contains(s.area, {
        x: Math.min(p.x, q.x),
        y: Math.min(p.y, q.y),
        width: Math.abs(p.x - q.x),
        height: Math.abs(p.y - q.y),
      }) &&
      !obstacles.some(
        (g) =>
          !(index >= 0 && endpointExemption(g, e, index, 1)) &&
          segmentHits(p, q, g.rect),
      ) &&
      !(index>=0?foreign:(Math.abs(p.y-q.y)<1e-6?rowBlockers.get(p.y)??horizontalForeign:columnBlockers.get(p.x)??verticalForeign))
        .some(s=>index>=0?parallelOverlap(p,q,s.p,s.q):tooClose(p,q,s.p,s.q));
    if (index < 0) {
      clearCache.set(cacheKey, result);
      clearCache.set(q.x + ',' + q.y + '|' + p.x + ',' + p.y, result);
    }
    return result;
  };
  if (!clear(from, a, 0) || !clear(b, to, 1)) return;
  const xs = new Set<number>([a.x, b.x, s.area.x, right(s.area)]),
    ys = new Set<number>([a.y, b.y, s.area.y, bottom(s.area)]);
  // Visibility lanes are rounded OUTWARD from obstacles. Physical pin/stub positions remain exact.
  const step = clearance>0 ? s.grid.spacing : Math.max(0.5, s.grid.spacing / 4),
    down = (v: number, origin=0) => origin+Math.floor((v-origin) / step) * step,
    up = (v: number, origin=0) => origin+Math.ceil((v-origin) / step) * step;
  for (const g of shapes) {
    xs.add(down(g.rect.x - 1, clearance?s.grid.origin.x:0));
    xs.add(up(right(g.rect) + 1, clearance?s.grid.origin.x:0));
    ys.add(down(g.rect.y - 1, clearance?s.grid.origin.y:0));
    ys.add(up(bottom(g.rect) + 1, clearance?s.grid.origin.y:0));
  }
  for (const wire of done)
    for (const p of wire.points) {
      xs.add(down(p.x - Math.max(1,clearance),clearance?s.grid.origin.x:0));
      xs.add(up(p.x + Math.max(1,clearance),clearance?s.grid.origin.x:0));
      ys.add(down(p.y - Math.max(1,clearance),clearance?s.grid.origin.y:0));
      ys.add(up(p.y + Math.max(1,clearance),clearance?s.grid.origin.y:0));
    }
  const xx = [...xs]
      .filter((x) => x >= s.area.x && x <= right(s.area))
      .sort((a, b) => a - b),
    yy = [...ys]
      .filter((y) => y >= s.area.y && y <= bottom(s.area))
      .sort((a, b) => a - b);
  for (const y of yy)
    rowShapes.set(
      y,
      shapes.filter((g) => g.rect.y < y && bottom(g.rect) > y),
    );
  for (const x of xx)
    columnShapes.set(
      x,
      shapes.filter((g) => g.rect.x < x && right(g.rect) > x),
    );
  const distance=Math.max(clearance,1e-6);
  for(const y of yy){
    rowBlockers.set(y,horizontalForeign.filter(s=>Math.abs(s.p.y-y)<distance));
    rowCrossings.set(y,verticalExisting.filter(s=>y>Math.min(s.p.y,s.q.y)&&y<Math.max(s.p.y,s.q.y)));
  }
  for(const x of xx){
    columnBlockers.set(x,verticalForeign.filter(s=>Math.abs(s.p.x-x)<distance));
    columnCrossings.set(x,horizontalExisting.filter(s=>x>Math.min(s.p.x,s.q.x)&&x<Math.max(s.p.x,s.q.x)));
  }
  // Most schematic nets need at most one free corridor. Test these exact paths before graph search.
  const fastPaths: Point[][] = [
    [a, b],
    [a, { x: a.x, y: b.y }, b],
    [a, { x: b.x, y: a.y }, b],
  ];
  // Reuse the shape of a previously routed conductor when both physical port
  // offsets match. The normal obstacle/net checks still apply to every segment.
  if (bundles) for (const previous of done) {
    const forward=previous.from.componentId===e.from.componentId&&previous.to.componentId===e.to.componentId;
    const backward=previous.to.componentId===e.from.componentId&&previous.from.componentId===e.to.componentId;
    if(!forward&&!backward)continue;
    const points=forward?previous.points:[...previous.points].reverse();
    const first=points[0],last=points.at(-1)!;
    const dx=from.x-first.x,dy=from.y-first.y;
    if(Math.abs(to.x-last.x-dx)>1e-6||Math.abs(to.y-last.y-dy)>1e-6)continue;
    if(points.length>=4)fastPaths.unshift([a,...points.slice(1,-1).map(p=>({x:p.x+dx,y:p.y+dy})),b]);
  }
  const nearest = (values: number[], a: number, b: number) =>
    [...values]
      .sort(
        (x, y) =>
          Math.abs(x - a) +
            Math.abs(x - b) -
            Math.abs(y - a) -
            Math.abs(y - b) || x - y,
      )
      .slice(0, 12);
  for (const y of nearest(yy, a.y, b.y))
    fastPaths.push([a, { x: a.x, y }, { x: b.x, y }, b]);
  for (const x of nearest(xx, a.x, b.x))
    fastPaths.push([a, { x, y: a.y }, { x, y: b.y }, b]);
  const options = fastPaths
    .map(compactPath)
    .filter((points) => {
      if (points.length < 2) return true;
      const first = points[1],
        last = points.at(-2)!;
      if (
        (first.x - a.x) * vectors[from.direction].x +
          (first.y - a.y) * vectors[from.direction].y <
        -1e-6
      )
        return false;
      if (
        (b.x - last.x) * vectors[to.direction].x +
          (b.y - last.y) * vectors[to.direction].y >
        1e-6
      )
        return false;
      return points
        .slice(1)
        .every(
          (q, i) =>
            (Math.abs(points[i].x - q.x) < 1e-6 ||
              Math.abs(points[i].y - q.y) < 1e-6) &&
            clear(points[i], q),
        );
    })
    .map((points) => ({
      points,
      cost: points
        .slice(1)
        .reduce(
          (n, q, i) =>
            n +
            Math.abs(q.x - points[i].x) +
            Math.abs(q.y - points[i].y) +
            8 +
            crossingCount(points[i],q)*20,
          0,
        ),
    }));
  options.sort((a, b) => a.cost - b.cost);
  if (options[0])
    return compactPath([
      { x: from.x, y: from.y },
      ...options[0].points,
      { x: to.x, y: to.y },
    ]);
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
  const initialD =
    from.direction === 'left' || from.direction === 'right' ? 0 : 1;
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
        (q.x - p.x) * vectors[from.direction].x +
          (q.y - p.y) * vectors[from.direction].y <
          -1e-6
      )
        continue;
      if (
        x === bx &&
        y === by &&
        (q.x - p.x) * vectors[to.direction].x +
          (q.y - p.y) * vectors[to.direction].y >
          1e-6
      )
        continue;
      if (!clear(p, q)) continue;
      const crosses = crossingCount(p,q),
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
      heap.push(g + Math.abs(q.x - b.x) + Math.abs(q.y - b.y), {
        x,
        y,
        d,
        g,
        key: k,
      });
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
  return compactPath(points);
}
function compactPath(points: Point[]): Point[] {
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
