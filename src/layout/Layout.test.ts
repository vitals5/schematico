import assert from 'node:assert/strict';
import { snapshotPage } from './geometry';
import { validateLayout } from './validate';
import { previewLayout, applyLayout } from './service';
import { clone, topology } from './types';
import type { Project, PlacedComponent } from '../model/types';
import { getSymbolById } from '../model/symbols';
import { ProjectHistory } from '../model/ProjectHistory';
import { fixture, add } from './testing/fixture';
export { fixture, add } from './testing/fixture';

const p = fixture();
add(p, 'F1');
add(p, 'F2');
p.pages[0].wires.push({
  id: 'wire',
  from: { componentId: 'F1', pinId: '2' },
  to: { componentId: 'F2', pinId: '1' },
  potential: 'L1',
  isAutoconnect: true,
});
const before = JSON.stringify(p),
  report = validateLayout(snapshotPage(p.pages[0], p));
assert(!report.valid);
assert(report.metrics.bodyOverlaps > 0);
const preview = await previewLayout(p, 'p');
console.log('preview', preview.status, preview.candidates.length, preview.issues.slice(0, 4));
assert.equal(JSON.stringify(p), before, 'preview must not mutate the project');
assert.equal(preview.status, 'preview_ready');
const candidate = preview.candidates[0];
assert(candidate.report.valid);
const net = topology(p),
  history = new ProjectHistory();
history.reset(p);
applyLayout(p, candidate);
history.record(p);
assert.equal(topology(p), net);
assert.equal(p.pages[0].wires[0].isAutoconnect, true, 'A verified straight facing path is retained as autoconnect');
assert(validateLayout(snapshotPage(p.pages[0], p)).valid);
assert.deepEqual(history.undo(), JSON.parse(before));
assert(history.redo());
const stale = clone(p);
stale.description = 'Changed';
assert.throws(() => applyLayout(stale, candidate), /verändert/);
const second = await previewLayout(JSON.parse(before), 'p');
assert.deepEqual(
  second.candidates.map((c) => c.page),
  preview.candidates.map((c) => c.page),
  'deterministic placement and routes',
);
const full = fixture();
for (let i = 0; i < 30; i++) add(full, 'M' + i, 'motor_3phase');
const original = JSON.stringify(full);
const overflow = await previewLayout(full, 'p', { multiPage: false });
assert.equal(overflow.status, 'layout_invalid');
assert(overflow.splitSuggestion);
assert.equal(JSON.stringify(full), original);
const locked = fixture();
add(locked, 'K1', 'contactor_coil', 250, 250);
const l = await previewLayout(locked, 'p', { lockedIds: ['K1'] });
assert.equal(l.status, 'preview_ready');
assert.equal(l.candidates[0].page.components[0].x, 250);
const rotated = fixture();
const c = add(rotated, 'R', 'circuit_breaker_1p', 200, 200);
c.rotation = 90;
c.functionText = 'Sehr langer Funktionstext';
c.crossRef = '/1.0 /2.0';
const g = snapshotPage(rotated.pages[0], rotated);
assert(g.nodes[0].shapes.some((s) => s.id.endsWith('crossRef')));
assert.equal(g.nodes[0].pins[0].direction, 'right');
console.log(
  '✓ Shared geometry, global validation, deterministic layout, electrical preservation, preview isolation, stale candidates, lock/overflow and single-step undo',
);

// Unit conversion preserves physical geometry, fonts, ports, and insertion-grid alignment.
const unit = fixture();
const unitComp = add(unit, 'Scale', 'contactor_coil', 100, 100);
unitComp.bmkPosition = { fontSize: 10 };
unitComp.functionTextPosition = { fontSize: 8 };
unitComp.pinLabelFontSize = 6.5;
unit.pages[0].grid = { spacing: 8, origin: { x: 0, y: 0 } };
const { computePinLabelPosition } = await import('../model/LabelLayout');
for (const pin of getSymbolById(unitComp.symbolId, unit)!.pins) {
  const label = computePinLabelPosition(unitComp, getSymbolById(unitComp.symbolId, unit)!, pin);
  unitComp.pins[pin.id].labelPosition = {
    x: label.x,
    y: label.y,
    fontSize: label.fontSize,
    alignment: label.anchor,
    rotation: 0,
  };
}
const scaled = clone(unit);
scaled.drawingUnitsPerMm = 3;
scaled.pages[0].plotFrame.width *= 1.5;
scaled.pages[0].plotFrame.height *= 1.5;
scaled.pages[0].grid!.spacing *= 1.5;
const { scalePlacedComponent } = await import('../model/SymbolGeometry');
scaled.pages[0].components = scaled.pages[0].components.map((c) => scalePlacedComponent(c, 1.5));
const physical = snapshotPage(unit.pages[0], unit),
  physicalScaled = snapshotPage(scaled.pages[0], scaled);
const rounded = (x: unknown) =>
  JSON.parse(JSON.stringify(x, (_k, v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)));
assert.deepEqual(rounded(physical.nodes), rounded(physicalScaled.nodes));
assert.deepEqual(rounded(physical.area), rounded(physicalScaled.area));
const branches = fixture();
for (let i = 0; i < 3; i++) {
  const a = add(branches, 'F' + i, 'circuit_breaker_1p', 150 + i * 120, 60),
    b = add(branches, 'K' + i, 'contactor_coil', 150 + i * 120, 180);
  a.functionText = b.functionText = 'Abgang';
  branches.pages[0].wires.push({
    id: 'w' + i,
    from: { componentId: a.id, pinId: '2' },
    to: { componentId: b.id, pinId: 'A1' },
    potential: 'L' + i,
  });
  (branches.pages[0].groups ??= []).push({
    id: 'group' + i,
    name: 'Abgang ' + i,
    members: [
      { kind: 'component', id: a.id },
      { kind: 'component', id: b.id },
    ],
  });
}
const branchPreview = await previewLayout(branches, 'p');
console.log('branches', branchPreview.status, branchPreview.issues.slice(0, 3));
assert.equal(branchPreview.status, 'preview_ready');
const { newDeviceBox } = await import('../model/DeviceBoxElement');
const boxed = fixture();
add(boxed, 'Q', 'contactor_coil', 240, 200);
const frame = newDeviceBox('box', '-A1', 220, 150, 100, 150, 2);
boxed.pages[0].components.push(frame);
const boxedPreview = await previewLayout(boxed, 'p');
console.log('box', boxedPreview.status, boxedPreview.issues.slice(0, 3));
assert.equal(boxedPreview.status, 'preview_ready');
const { buildDraft } = await import('./tools');
const draftSource = fixture(),
  draft = buildDraft(draftSource, 'p', {
    components: [
      { id: 'Q', symbolId: 'circuit_breaker_1p', functionText: 'Schutz' },
      { id: 'K', symbolId: 'contactor_coil', functionText: 'Schütz' },
    ],
    connections: [
      {
        id: 'w',
        from: { componentId: 'Q', pinId: '2' },
        to: { componentId: 'K', pinId: 'A1' },
        potential: 'L1',
      },
    ],
    groups: [{ id: 'drive', members: ['Q', 'K'] }],
  });
const draftPreview = await previewLayout(draftSource, 'p', {}, draft);
assert.equal(draftPreview.status, 'preview_ready');
assert.equal(draftSource.pages[0].components.length, 0);
applyLayout(draftSource, draftPreview.candidates[0], draft);
assert.equal(draftSource.pages[0].components.length, 2);
assert.throws(
  () =>
    buildDraft(fixture(), 'p', {
      components: [{ id: 'x', symbolId: 'nonexistent' }],
      connections: [],
    }),
  /Bibliothekssymbol/,
);
const intersect = fixture();
const one = add(intersect, 'a', 'contactor_coil', 100, 100),
  two = add(intersect, 'b', 'contactor_coil', 400, 100);
intersect.pages[0].texts = [
  { id: 'obstacle', text: 'Gesperrter Bereich', x: 250, y: 150, fontSize: 10 },
];
intersect.pages[0].wires = [
  {
    id: 'cross',
    from: { componentId: one.id, pinId: 'A2' },
    to: { componentId: two.id, pinId: 'A1' },
    potential: 'L1',
  },
];
const routed = await previewLayout(intersect, 'p');
assert.equal(routed.status, 'preview_ready');
assert.equal(routed.candidates[0].report.metrics.wireObstacles, 0);
assert.equal(routed.candidates[0].page.texts![0].x, 250);
console.log(
  '✓ Scaled projects, grouped branches, editable device boxes, semantic batch drafts and obstacle routing',
);

const nativeGroup = fixture();
add(nativeGroup, 'source1', 'contactor_coil', 180, 180);
add(nativeGroup, 'source2', 'contactor_coil', 340, 196);
nativeGroup.pages[0].groups = [
  {
    id: 'native-group',
    members: [
      { kind: 'component', id: 'source1' },
      { kind: 'component', id: 'source2' },
    ],
    source: { format: 'NATIVE_CAD', objectType: 3, objectId: 1 },
  },
];
const nativePreview = await previewLayout(nativeGroup, 'p');
assert.equal(nativePreview.status, 'preview_ready');
const nc = nativePreview.candidates[0].page.components;
assert.equal(nc[1].x - nc[0].x, 160);
assert.equal(nc[1].y - nc[0].y, 16);
console.log('✓ Native graphical groups keep their exact internal geometry');

const power = fixture();
const q = add(power, 'Q1', 'circuit_breaker_3p'),
  meter = add(power, 'Z1', 'energy_meter_3p'),
  motor = add(power, 'M1', 'motor_3phase');
for (const [i, [out, input, motorPin]] of [
  ['2', 'L1', 'U1'],
  ['4', 'L2', 'V1'],
  ['6', 'L3', 'W1'],
].entries()) {
  power.pages[0].wires.push(
    {
      id: 'feed' + i,
      from: { componentId: q.id, pinId: out },
      to: { componentId: meter.id, pinId: input },
      potential: 'L' + (i + 1),
    },
    {
      id: 'load' + i,
      from: { componentId: meter.id, pinId: String(i + 1) },
      to: { componentId: motor.id, pinId: motorPin },
      potential: 'L' + (i + 1),
    },
  );
}
const powerPreview = await previewLayout(power, 'p');
console.log('three-phase', powerPreview.status, powerPreview.issues.slice(0, 3));
assert.equal(powerPreview.status, 'preview_ready');
assert.equal(powerPreview.candidates[0].report.metrics.wireObstacles, 0);
const otherNet = clone(snapshotPage(p.pages[0], p));
otherNet.edges.push({
  ...clone(otherNet.edges[0]),
  id: 'other-net',
  from: { componentId: 'F1', pinId: '1' },
  to: { componentId: 'F2', pinId: '2' },
});
assert(validateLayout(otherNet).issues.some((i) => i.type === 'net_overlap'));
const badCandidate = clone(preview.candidates[0]),
  safeOriginal = JSON.parse(before);
badCandidate.page.wires[0].to.pinId = '2';
assert.throws(() => applyLayout(safeOriginal, badCandidate), /fehlgeschlagen/);
assert.equal(JSON.stringify(safeOriginal), before);
console.log(
  '✓ Three-phase motor feed keeps distinct conductors; net overlap and tampered candidates are rejected',
);

const touch = fixture();
add(touch, 'T1', 'circuit_breaker_1p', 200, 100);
add(touch, 'T2', 'circuit_breaker_1p', 200, 148);
touch.pages[0].wires = [
  {
    id: 'contact',
    from: { componentId: 'T1', pinId: '2' },
    to: { componentId: 'T2', pinId: '1' },
    potential: 'L1',
  },
];
assert(
  !validateLayout(snapshotPage(touch.pages[0], touch)).issues.some(
    (i) => i.type === 'pin_direction',
  ),
);

const { checkedCompletion } = await import('./chatStatus');
assert(
  !checkedCompletion('Alles fehlerfrei', [], {
    success: true,
    valid: false,
    issues: [{ type: 'body_overlap', objectIds: ['Q1'], message: 'Kollision' }],
  }).includes('Alles fehlerfrei'),
);
assert(
  checkedCompletion('Alles erstellt', [
    {
      name: 'create_schematic_draft',
      args: {},
      status: 'done',
      result: { requiresUserApply: true, status: 'preview_ready' },
    },
  ]).includes('Vorschau'),
);
assert(!checkedCompletion('Alles fehlerfrei', [], { success: false }).includes('Alles fehlerfrei'));
assert(overflow.splitSuggestion!.sheets!.length > 1);
assert(overflow.splitSuggestion!.sheets!.every((s) => s.estimate));
