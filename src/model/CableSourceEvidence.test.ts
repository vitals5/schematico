import assert from 'node:assert/strict';
import { fixture, add } from '../layout/testing/fixture';
import { captureNativeCableEvidence } from '../packages/NativeCables';
import { EodRecord } from '../packages/EodReader';
import { CableRepairPlan } from './CableRepairs';
import { cableWires } from './WiringManagement';
const p = fixture(),
  a = add(p, 'a', 'terminal_single'),
  b = add(p, 'b', 'terminal_single', 150, 130);
p.logicalConnections = [
  {
    id: 'native_logical_7',
    from: { componentId: a.id, pinId: '2' },
    to: { componentId: b.id, pinId: '1' },
    potential: 'Signal',
  },
];
p.pages[0].cables = [
  {
    id: 'c',
    bmk: '-W',
    start: { x: 20, y: 200 },
    end: { x: 120, y: 200 },
    crossSection: '1.5',
    cableType: '',
    cores: [
      {
        id: 'core',
        t: 0.8,
        source: { format: 'NATIVE_CAD', objectType: 59, objectId: 42 },
      },
    ],
  },
];
const bytes = new Uint8Array(8),
  v = new DataView(bytes.buffer);
v.setUint16(0, 0xeb33, true);
v.setUint16(2, 59, true);
v.setUint32(4, 42, true);
captureNativeCableEvidence([new EodRecord(7, 6, 1, bytes)], p);
assert.equal(p.pages[0].cables[0].cores[0].connectionHints?.length, 1);
const plan = new CableRepairPlan(p),
  source = plan.rows.find((r) => r.kind === 'bind')!;
assert.equal(source.evidence.method, 'native_connection');
assert(
  !plan.rows.some((r) => r.kind === 'reserve'),
  'A source-connected core is not proposed as unused',
);
assert.deepEqual(source.evidence.endpoints, [
  { from: p.logicalConnections[0].from, to: p.logicalConnections[0].to },
]);
const applied = plan.apply(p, [source.id]);
assert.deepEqual(applied.pages[0].cables![0].cores[0].wireIds, [
  'native_logical_7',
]);
assert.deepEqual(applied.logicalConnections, p.logicalConnections);
assert.deepEqual(applied.pages[0].wires, p.pages[0].wires);
const bad = structuredClone(p);
bad.pages[0].cables![0].cores[0].connectionHints![0].to.pinId = 'missing';
assert(!new CableRepairPlan(bad).rows.some((r) => r.kind === 'bind'));
const c = add(p, 'c', 'terminal_single', 230, 40),
  d = add(p, 'd', 'terminal_single', 280, 40);
p.logicalConnections.push({
  id: 'native_logical_8',
  from: { componentId: c.id, pinId: '2' },
  to: { componentId: d.id, pinId: '1' },
  potential: 'Signal',
});
p.pages[0].cables[0].cores[0].connectionHints!.push({
  wireId: 'native_logical_8',
  from: { ...p.logicalConnections[1].from },
  to: { ...p.logicalConnections[1].to },
  source: {
    format: 'NATIVE_CAD',
    connectionId: 8,
    coreObjectType: 59,
    coreObjectId: 42,
  },
});
assert(
  !new CableRepairPlan(p).rows.some((r) => r.kind === 'bind'),
  'A source reference never combines disconnected nets',
);
assert.equal(
  cableWires(p, 'unknown-page', 'native_logical_7').length,
  1,
  'Explicit logical source connections have project-wide identities',
);
console.log(
  '✓ Source cable-core references retain endpoint evidence; proposals use exact real connections, reject stale endpoints and disconnected nets, and preserve geometry',
);
