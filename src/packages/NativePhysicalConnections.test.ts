import assert from 'node:assert/strict';
import { NativePort, physicalConnections } from './NativePhysicalConnections';
import { PinDefinition } from '../model/types';
const port = (key: string, x: number, y: number, direction: PinDefinition['direction'], junction?: string): NativePort =>
  ({ key, endpoint: { componentId: key.split(':')[0], pinId: key.split(':')[1] ?? '0' }, point: { x, y }, direction, junction });
const pairs = (ports: NativePort[]) => physicalConnections(ports, [], 1, .25).map(w => [w.from.componentId, w.to.componentId].sort().join('-')).sort();
// Same-facing sockets cannot be joined through their contacts. Each ends at
// its own downward-facing corner. Opposite directions still connect directly.
assert.deepEqual(pairs([port('socketA', 0, 0, 'top'), port('socketB', 0, 20, 'top'),
  port('cornerA', 0, 8, 'bottom'), port('cornerB', 0, 28, 'bottom')]), ['cornerA-socketA', 'cornerB-socketB']);
assert.deepEqual(pairs([port('a', 0, 0, 'top'), port('blocker', 0, 4, 'top'), port('b', 0, 8, 'bottom')]), ['b-blocker']);
// A perpendicular crossing never supplies a horizontal junction or blocks it.
assert.deepEqual(pairs([port('left', 0, 0, 'right'), port('cross', 4, 0, 'top'), port('right', 8, 0, 'left')]), ['left-right']);
assert.deepEqual(pairs([port('a', 0, 0, 'left'), port('b', -8, 0, 'right')]), ['a-b']);
assert.deepEqual(pairs([port('a', 0, 0, 'bottom'), port('b', 0, -8, 'top')]), ['a-b']);
assert.deepEqual(pairs([port('a', 0, 0, 'right'), port('b', 8, 0, 'right')]), []);
assert.deepEqual(pairs([port('a:0', 0, 0, 'right'), port('a:1', 8, 0, 'left')]), [], 'Do not create wires inside a symbol');
// Two internally joined source T ports propagate PE through a real branch;
// an ordinary device's independent pins must remain separate.
const ports = [port('socket', 0, 0, 'top'), port('tee:0', 0, 8, 'bottom', 'tee'),
  port('tee:1', 0, 8, 'left', 'tee'), port('source', -8, 8, 'right')];
ports[0].potential = 'PE';
const runs = physicalConnections(ports, [{ id: 'native', from: ports[0].endpoint, to: ports[3].endpoint,
  potential: 'Signal', color: 'GNYE', crossSection: '1.5' }], 1, .25);
assert.equal(runs.length, 2);
assert(runs.every(w => w.potential === 'PE' && w.color === 'GNYE' && w.crossSection === '1.5'));
assert.deepEqual(pairs([port('cacheA', 0, 0, 'top', 'cacheA'), port('cacheB', 0, 8, 'bottom', 'cacheB')]), [], 'A detached routing cache is not a drawing');
const cached = [port('device', 0, 0, 'top'), port('dead:0', 0, 4, 'bottom', 'dead'),
  port('dead:1', 0, 4, 'right', 'dead'), port('corner:0', 0, 8, 'bottom', 'corner'),
  port('corner:1', 0, 8, 'right', 'corner'), port('source', 8, 8, 'left')];
for (const p of cached) if (p.junction) p.routing = true;
assert.deepEqual(pairs(cached), ['corner-device', 'corner-source'], 'An obsolete nearer corner must not block the live corner');
const blocked = [port('upper:0', 0, 8, 'bottom', 'upper'), port('upper:1', 0, 8, 'right', 'upper'),
  port('left', 8, 8, 'left'), port('deviceBack', 0, 4, 'bottom'), port('deviceFront', 0, 0, 'top')];
for (const p of blocked) if (p.junction) p.routing = true;
assert.deepEqual(pairs(blocked), ['deviceBack-deviceFront'], 'An actual device blocks cache support behind its back');
const hidden = [port('input', 0, 0, 'top'), port('stale:0', 0, 4, 'bottom', 'stale'),
  port('stale:1', 0, 4, 'right', 'stale'), port('live:0', 0, 8, 'bottom', 'live'),
  port('live:1', 0, 8, 'right', 'live'), port('upperEnd', 8, 8, 'left'),
  port('block:0', 4, 4, 'right', 'block'), port('block:1', 4, 4, 'bottom', 'block'),
  port('bottomEnd', 4, 0, 'top'), port('rightEnd', 8, 4, 'left')];
for (const p of hidden) if (p.junction) p.routing = true;
assert.deepEqual(pairs(hidden), ['block-bottomEnd', 'block-rightEnd', 'input-live', 'live-upperEnd'],
  'Prune the stale nearer corner before the obstructed live corner');
// Preserve exact .75 mm edges; numerical matching is not coordinate snapping.
const precise = physicalConnections([port('a', 4, .75, 'top'), port('b', 4, 8, 'bottom')], [], 1, .25);
assert.equal(precise.length, 1);
console.log('✓ Facing native ports, blocked rays, independent crossings, routing properties and detached cache');
