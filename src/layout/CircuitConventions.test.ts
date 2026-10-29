import assert from 'node:assert/strict';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { Direction, LayoutSnapshot } from './types';
import { structuredGroup, designPenalty } from './structured';
import { fixture, add } from './testing/fixture';
import { previewLayout, applyLayout } from './service';
import { topology } from './types';

// Independently constructed circuits exercising drawing conventions, no vendor artwork.
function circuit(horizontal = false) {
    const ids = ['zSource', 'mSwitch', 'aLoad'];
    const children: ElkNode[] = ids.map((id, i) => ({ id, width: 30 + i * 4, height: 24 + i * 8,
        ports: [{ id: JSON.stringify([id, 'in']), x: horizontal ? 0 : 14, y: horizontal ? 12 : 0 },
            { id: JSON.stringify([id, 'out']), x: horizontal ? 30 + i * 4 : 14, y: horizontal ? 12 : 24 + i * 8 }] }));
    const snapshot: LayoutSnapshot = { pageId: 'p', area: { x: 0, y: 0, width: 500, height: 500 }, grid: { spacing: 2, origin: { x: 0, y: 0 } }, frames: [], issues: [],
        nodes: children.map(c => ({ id: c.id, kind: 'component', fixed: false, origin: { x: 0, y: 0 }, rect: { x: 0, y: 0, width: c.width!, height: c.height! },
            shapes: [{ id: c.id, owner: c.id, kind: 'body', rect: { x: 4, y: 4, width: c.width! - 8, height: c.height! - 8 } }],
            pins: c.ports!.map((p, i) => ({ id: i ? 'out' : 'in', x: p.x!, y: p.y!, direction: (horizontal ? (i ? 'right' : 'left') : (i ? 'bottom' : 'top')) as Direction })) })),
        edges: ids.slice(1).map((id, i) => ({ id: 'w' + i, from: { componentId: ids[i], pinId: 'out' }, to: { componentId: id, pinId: 'in' }, potential: '', points: [] })) };
    return { children, snapshot };
}
const padding = { left: 9, right: 13, top: 7, bottom: 11 };
for (const horizontal of [false, true]) {
    const { children, snapshot } = circuit(horizontal);
    const original = JSON.stringify({ children, snapshot });
    const result = structuredGroup('circuit', children, snapshot, 8, padding)!;
    const byId = new Map(result.children!.map(n => [n.id, n]));
    const sequence = ['zSource', 'mSwitch', 'aLoad'].map(id => byId.get(id)!);
    for (let i = 1; i < sequence.length; i++) {
        const a = sequence[i - 1], b = sequence[i];
        assert(horizontal ? b.x! >= a.x! + a.width! + 8 : b.y! >= a.y! + a.height! + 8, 'Serial rank follows facing ports rather than lexical IDs');
        assert.equal(horizontal ? a.y! + 12 : a.x! + 14, horizontal ? b.y! + 12 : b.x! + 14, 'Consecutive ports share a straight axis');
    }
    for (const n of result.children!) {
        assert(n.x! >= padding.left && n.y! >= padding.top);
        assert(n.x! + n.width! <= result.width! - padding.right + 1e-6);
        assert(n.y! + n.height! <= result.height! - padding.bottom + 1e-6);
        assert.equal(n.width, children.find(c => c.id === n.id)!.width, 'Original symbol geometry is not rotated');
    }
    assert.equal(JSON.stringify({ children, snapshot }), original, 'Temporary coordinate transforms never mutate input');
    const reversed = { ...snapshot, edges: snapshot.edges.map(e => ({ ...e, from: e.to, to: e.from })) };
    assert.deepEqual(structuredGroup('circuit', children, reversed, 8, padding), result, 'Wire storage direction does not imply current direction');
    assert.deepEqual(structuredGroup('circuit', children, snapshot, 8, padding), result);
}

// A multipole lateral link is one device relationship, not three votes against
// the two serial vertical levels. Edge annotations do not vote at all.
const mixed = circuit();
for (let i = 0; i < 3; i++) {
    for (const [index, direction] of [[0, 'right'], [2, 'left']] as const) {
        const c = mixed.children[index], pinId = 'side' + i;
        c.ports!.push({ id: JSON.stringify([c.id, pinId]), x: direction === 'right' ? c.width : 0, y: 8 + i * 6 });
        mixed.snapshot.nodes[index].pins.push({ id: pinId, direction, x: 0, y: 8 + i * 6 });
    }
    mixed.snapshot.edges.push({ id: 'lateral' + i, from: { componentId: 'zSource', pinId: 'side' + i }, to: { componentId: 'aLoad', pinId: 'side' + i }, potential: '', points: [] });
}
for (let i = 0; i < 4; i++) {
    const id = 'handover' + i;
    mixed.children.push({ id, width: 12, height: 10, ports: [{ id: JSON.stringify([id, 'p']), x: 12, y: 5 }] });
    mixed.snapshot.nodes.push({ ...structuredClone(mixed.snapshot.nodes[0]), id, handover: true, pins: [{ id: 'p', direction: 'right', x: 12, y: 5 }] });
    mixed.snapshot.edges.push({ id, from: { componentId: id, pinId: 'p' }, to: { componentId: 'aLoad', pinId: 'side0' }, potential: '', points: [] });
}
const mixedLayout = structuredGroup('mixed', mixed.children, mixed.snapshot, 8, padding)!;
assert(mixedLayout.children!.find(n => n.id === 'zSource')!.y! < mixedLayout.children!.find(n => n.id === 'aLoad')!.y!, 'Conductor multiplicity and handovers cannot override dominant device paths');

// Start and holding contacts form a parallel level between stop and coil.
const parallel = circuit();
const stop = parallel.children[0], start = parallel.children[1], coil = parallel.children[2];
const holding = { ...start, id: 'holding', ports: start.ports!.map(p => ({ ...p, id: JSON.stringify(['holding', JSON.parse(p.id)[1]]) })) };
parallel.children.push(holding);
parallel.snapshot.nodes.push({ ...parallel.snapshot.nodes[1], id: 'holding' });
parallel.snapshot.edges.push(...['in', 'out'].map(pinId => ({ id: 'hold-' + pinId, from: { componentId: start.id, pinId }, to: { componentId: holding.id, pinId }, potential: '', points: [] })));
const held = structuredGroup('holding', parallel.children, parallel.snapshot, 8, padding)!;
const heldNodes = new Map(held.children!.map(n => [n.id, n]));
assert.equal(heldNodes.get(start.id)!.y, heldNodes.get(holding.id)!.y, 'Parallel contacts occupy the same level');
assert(heldNodes.get(stop.id)!.y! < heldNodes.get(start.id)!.y! && heldNodes.get(start.id)!.y! < heldNodes.get(coil.id)!.y!);

// A geometrically backwards connection must cost more even with perfect axis alignment.
for (const horizontal of [false, true]) {
    const { snapshot } = circuit(horizontal);
    const placed = structuredClone(snapshot);
    placed.nodes.forEach((n, i) => n.pins.forEach(p => { if (horizontal) p.x += i * 100; else p.y += i * 100; }));
    const normal = designPenalty(placed);
    placed.nodes.forEach((n, i) => n.pins.forEach(p => { if (horizontal) p.x -= i * 200; else p.y -= i * 200; }));
    assert(designPenalty(placed) > normal, 'Reading order participates in candidate ranking');
}

// Actual rotated library devices: stored model, labels and topology survive apply.
const project = fixture();
for (const id of ['zSource', 'mSwitch', 'aLoad']) {
    const c = add(project, id); c.rotation = 270;
    // Explicit label placement above the horizontal ports leaves their exit corridors free.
    c.bmkPosition = { offsetX: 40 }; c.functionTextPosition = { offsetX: 40 };
}
project.pages[0].wires = ['mSwitch', 'aLoad'].map((id, i) => ({ id: 'w' + i, from: { componentId: ['zSource', 'mSwitch'][i], pinId: '2' }, to: { componentId: id, pinId: '1' }, potential: 'L1', waypoints: [], isAutoconnect: false }));
const original = JSON.stringify(project), net = topology(project);
const preview = await previewLayout(project, 'p', { multiPage: false });
assert.equal(JSON.stringify(project), original);
const candidate = preview.candidates.find(c => c.profile === 'structured');
assert(candidate, 'Horizontal library circuit passes final routing and stored-model validation');
applyLayout(project, candidate);
assert.equal(topology(project), net);
assert(project.pages[0].components.every(c => c.rotation === 270 && c.functionText === 'Steuerung'));

const motor = fixture();
add(motor, 'protection', 'motor_protective_switch');
add(motor, 'contactor', 'contactor_power_3p');
add(motor, 'motor', 'motor_3phase');
motor.pages[0].wires = [0, 1, 2].flatMap(i => [
    { id: 'supply' + i, from: { componentId: 'protection', pinId: String(2 + 2 * i) }, to: { componentId: 'contactor', pinId: String(1 + 2 * i) }, potential: 'L' + (i + 1), waypoints: [], isAutoconnect: false },
    { id: 'load' + i, from: { componentId: 'contactor', pinId: String(2 + 2 * i) }, to: { componentId: 'motor', pinId: ['U1', 'V1', 'W1'][i] }, potential: 'L' + (i + 1), waypoints: [], isAutoconnect: false },
]);
const motorOriginal = JSON.stringify(motor), motorNet = topology(motor);
const motorPreview = await previewLayout(motor, 'p', { multiPage: false });
const motorCandidate = motorPreview.candidates.find(c => c.profile === 'structured');
assert(motorCandidate, 'Three-pole motor path routes and validates with actual library symbols');
assert.equal(JSON.stringify(motor), motorOriginal);
applyLayout(motor, motorCandidate);
assert.equal(topology(motor), motorNet, 'Layout preserves all six phase connections without swapping poles');
console.log('✓ Horizontal/vertical circuit order, parallel holding branch, immutable geometry and routed library round-trip');
