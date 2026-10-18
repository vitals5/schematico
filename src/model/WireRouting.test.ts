import assert from 'node:assert/strict';
import { orthogonalWirePoints, wirePinDirection, wirePolyline } from './WireRouting';
import { Page, PinDefinition, PlacedComponent, Project, SymbolDefinition } from './types';

type Point = { x: number; y: number };
type Direction = PinDefinition['direction'];
const directions: Direction[] = ['top', 'right', 'bottom', 'left'];
const vectors: Record<Direction, Point> = { top: { x: 0, y: -1 }, right: { x: 1, y: 0 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 } };
const grid = { spacing: 10, origin: { x: 2, y: 1 } };
const eq = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1e-7 && Math.abs(a.y - b.y) < 1e-7;
function verify(points: Point[], from: Point, to: Point, fromDirection: Direction, toDirection?: Direction) {
  assert.deepEqual(points[0], from); assert.deepEqual(points.at(-1), to);
  const first = points.find(p => !eq(p, from))!;
  const last = points.slice().reverse().find(p => !eq(p, to))!;
  assert(first && last);
  const v = vectors[fromDirection];
  assert((first.x - from.x) * v.x + (first.y - from.y) * v.y > 0, `Wrong departure ${fromDirection} to ${toDirection}: ${JSON.stringify(points)}`);
  if (toDirection) {
    const v = vectors[toDirection];
    assert((last.x - to.x) * v.x + (last.y - to.y) * v.y > 0, `Wrong arrival ${toDirection}: ${JSON.stringify(points)}`);
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    assert(Math.abs(a.x - b.x) < 1e-7 || Math.abs(a.y - b.y) < 1e-7, 'Every segment must remain orthogonal');
    if (i > 1) {
      const p = points[i - 2];
      assert((a.x - p.x) * (b.x - a.x) + (a.y - p.y) * (b.y - a.y) >= -1e-7, 'No immediate retracing');
      assert(!(Math.abs(a.x - b.x) < 1e-7 && Math.abs(from.x - a.x) < 1e-7 && from.y >= Math.min(a.y, b.y) - 1e-7 && from.y <= Math.max(a.y, b.y) + 1e-7)
        && !(Math.abs(a.y - b.y) < 1e-7 && Math.abs(from.y - a.y) < 1e-7 && from.x >= Math.min(a.x, b.x) - 1e-7 && from.x <= Math.max(a.x, b.x) + 1e-7),
      'A later segment must not return through the source pin');
    }
  }
}

for (const direction of directions) {
  const v = vectors[direction], from = { x: 3, y: 5 };
  const behind = { x: from.x - v.x * 40, y: from.y - v.y * 40 };
  const ahead = { x: from.x + v.x * 40, y: from.y + v.y * 40 };
  const opposite = directions[(directions.indexOf(direction) + 2) % 4];
  for (const route of [wirePolyline, (a: Point, b: Point, w: Point[], d?: Direction, e?: Direction) => orthogonalWirePoints(a, b, w, d, e)]) {
    const detour = route(from, behind, [], direction, direction);
    verify(detour, from, behind, direction, direction);
    assert(detour.length >= 4, 'Aligned pins facing away need a detour');
    verify(route(from, ahead, [], direction, direction), from, ahead, direction, direction);
    assert.deepEqual(route(from, ahead, [], direction, opposite), [from, ahead], 'Facing aligned pins retain their straight conductor');
  }
  const anchored = orthogonalWirePoints(from, behind, [behind], direction, opposite, grid);
  verify(anchored, from, behind, direction, opposite);
  const first = anchored[1];
  const axis = v.x ? 'x' : 'y';
  assert(Math.abs((first[axis] - grid.origin[axis]) / grid.spacing - Math.round((first[axis] - grid.origin[axis]) / grid.spacing)) < 1e-7,
    'Outward stubs use the page grid and its origin');
}

// All endpoint direction pairs, including perpendicular and same-facing pins,
// must work in every quadrant and when either coordinate is aligned.
for (const fromDirection of directions) for (const toDirection of directions) {
  for (const to of [{ x: 0, y: -40 }, { x: 40, y: 0 }, { x: 0, y: 40 }, { x: -40, y: 0 },
    { x: 30, y: 40 }, { x: -30, y: 40 }, { x: 30, y: -40 }, { x: -30, y: -40 }, { x: 3, y: 0 }]) {
    const from = { x: 0, y: 0 };
    verify(wirePolyline(from, to, [], fromDirection, toDirection, false, grid), from, to, fromDirection, toDirection);
    verify(orthogonalWirePoints(from, to, [], fromDirection, toDirection, grid), from, to, fromDirection, toDirection);
  }
}

const anchors = [{ x: 0, y: 20 }, { x: 30, y: 20 }];
const before = JSON.stringify(anchors);
assert.deepEqual(orthogonalWirePoints({ x: 0, y: 0 }, { x: 30, y: 40 }, anchors, 'bottom', 'top'),
  [{ x: 0, y: 0 }, ...anchors, { x: 30, y: 40 }]);
const from = { x: 10, y: 5 }, to = { x: 40, y: 50 };
const moved = wirePolyline(from, to, anchors, 'right', 'bottom', false, grid);
verify(moved, from, to, 'right', 'bottom');
let index = 0;
for (const anchor of anchors) { const found = moved.findIndex((p, i) => i >= index && eq(p, anchor)); assert(found >= index); index = found + 1; }
assert.equal(JSON.stringify(anchors), before, 'Neither coordinates nor order of explicit anchors are changed');
assert.deepEqual(orthogonalWirePoints({ x: 0, y: 0 }, { x: 30, y: 40 }, [{ x: 0, y: 0 }, ...anchors, { x: 30, y: 40 }], 'bottom', 'top'),
  [{ x: 0, y: 0 }, ...anchors, { x: 30, y: 40 }], 'Coincident leading/trailing anchors do not suppress pin directions');
assert.deepEqual(wirePolyline({ x: 5, y: 6 }, { x: 5, y: 6 }, [], 'right', 'left'), [{ x: 5, y: 6 }, { x: 5, y: 6 }]);

const symbol: SymbolDefinition = { id: 'rotation-test', name: 'Rotation', category: 'controls', standard: 'DIN EN 60617',
  defaultBmkPrefix: '', defaultFunctionText: '', width: 10, height: 10, svgContent: '', description: '',
  pins: directions.map((direction, i) => ({ id: String(i), name: String(i), x: 0, y: 0, direction })) };
const component: PlacedComponent = { id: 'c', symbolId: symbol.id, x: 0, y: 0, rotation: 0, bmk: '', functionText: '', pins: {} };
const page = { components: [component] } as Page;
const project = { symbolLibrary: [symbol] } as Project;
for (const rotation of [0, 90, 180, 270] as const) {
  component.rotation = rotation;
  for (let i = 0; i < directions.length; i++) assert.equal(wirePinDirection(page, project, { componentId: component.id, pinId: String(i) }),
    directions[(i + rotation / 90) % 4]);
}
assert.equal(wirePinDirection(page, project, { componentId: component.id, pinId: 'missing' }), undefined);
assert.equal(wirePinDirection(page, project, { componentId: 'missing', pinId: '0' }), undefined);
console.log('Wire routing: outward endpoints, aligned detours, explicit anchors and rotations passed');
