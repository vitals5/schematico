import assert from 'node:assert/strict';
import { rankedGroup } from './ranked';
const port = (id: string, x: number) => ({ id: JSON.stringify([id, 'p']), x, y: 0 });
const children = [
  { id: 'supplyA', width: 50, height: 10, ports: [port('supplyA', 25)] },
  { id: 'supplyB', width: 20, height: 10, ports: [port('supplyB', 10)] },
  { id: 'zConsumer', width: 20, height: 10, ports: [port('zConsumer', 10)] },
  { id: 'aConsumer', width: 20, height: 10, ports: [port('aConsumer', 10)] },
];
const snapshot: any = {
  nodes: children.map((c) => ({
    id: c.id,
    pins: [{ id: 'p', direction: c.id.startsWith('supply') ? 'bottom' : 'top' }],
  })),
  edges: [
    {
      from: { componentId: 'supplyA', pinId: 'p' },
      to: { componentId: 'zConsumer', pinId: 'p' },
    },
    {
      from: { componentId: 'supplyB', pinId: 'p' },
      to: { componentId: 'aConsumer', pinId: 'p' },
    },
  ],
};
const layout = rankedGroup('group', children, snapshot, 8, {
  left: 8,
  right: 8,
  top: 8,
  bottom: 8,
})!;
const nodes = new Map(layout.children!.map((c) => [c.id, c]));
const x = (id: string) => nodes.get(id)!.x! + nodes.get(id)!.ports![0].x!;
assert.equal(x('supplyA'), x('zConsumer'));
assert.equal(x('supplyB'), x('aConsumer'));
assert(
  (x('supplyA') - x('supplyB')) * (x('zConsumer') - x('aConsumer')) > 0,
  'Connected lanes keep the same order across ranks',
);
assert.deepEqual(
  layout,
  rankedGroup('group', children, snapshot, 8, { left: 8, right: 8, top: 8, bottom: 8 }),
);
console.log(
  '✓ Electrical lane order and pin-axis alignment with unequal symbol widths, deterministic placement',
);

const old = rankedGroup(
  'group',
  children,
  snapshot,
  8,
  { left: 8, right: 8, top: 8, bottom: 8 },
  false,
)!;
const oldX = (id: string) => old.children!.find((c) => c.id === id)!.x!;
assert(
  (oldX('supplyA') - oldX('supplyB')) * (oldX('zConsumer') - oldX('aConsumer')) < 0,
  'Baseline orders crossed the two circuit lanes',
);
