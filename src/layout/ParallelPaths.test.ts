import assert from 'node:assert/strict';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { LayoutSnapshot } from './types';
import { rankedGroup } from './ranked';
import { structuredGroup } from './structured';
import { fixture, add } from './testing/fixture';
import { previewLayout, applyLayout } from './service';
import { topology } from './types';
import { ProjectHistory } from '../model/ProjectHistory';

const padding = { left: 8, right: 8, top: 8, bottom: 8 };
function branch(length: number, horizontal: boolean) {
    const ids = ['feed', 'stop', ...Array.from({ length }, (_, i) => 'serial' + i), 'holding', 'coil'];
    const children: ElkNode[] = ids.map((id, i) => ({ id, width: horizontal ? 24 : 24 + i % 2 * 12, height: horizontal ? 24 + i % 2 * 12 : 24,
        ports: [{ id: JSON.stringify([id, 'in']), x: horizontal ? 0 : 12, y: horizontal ? 12 : 0 },
            { id: JSON.stringify([id, 'out']), x: horizontal ? 24 : 12, y: horizontal ? 12 : 24 }] }));
    const pairs = [['feed', 'out', 'stop', 'in'], ['stop', 'out', 'serial0', 'in'],
        ...Array.from({ length: length - 1 }, (_, i) => ['serial' + i, 'out', 'serial' + (i + 1), 'in']),
        ['serial' + (length - 1), 'out', 'coil', 'in'], ['serial0', 'in', 'holding', 'in'], ['serial' + (length - 1), 'out', 'holding', 'out']];
    const s: LayoutSnapshot = { pageId: 'p', area: { x: 0, y: 0, width: 600, height: 600 }, grid: { spacing: 4, origin: { x: 0, y: 0 } }, frames: [], issues: [],
        nodes: children.map(c => ({ id: c.id, kind: 'component', fixed: false, origin: { x: 0, y: 0 }, rect: { x: 0, y: 0, width: c.width!, height: c.height! },
            shapes: [{ id: c.id, owner: c.id, kind: 'body', rect: { x: 0, y: 0, width: c.width!, height: c.height! } }],
            pins: [{ id: 'in', x: horizontal ? 0 : 12, y: horizontal ? 12 : 0, direction: horizontal ? 'left' : 'top' },
                { id: 'out', x: horizontal ? 24 : 12, y: horizontal ? 12 : 24, direction: horizontal ? 'right' : 'bottom' }] })),
        edges: pairs.map(([a, p, b, q], i) => ({ id: 'w' + i, from: { componentId: a, pinId: p }, to: { componentId: b, pinId: q }, potential: 'Signal', points: [] })) };
    return { children, s };
}
for (const length of [1, 2, 4]) for (const horizontal of [false, true]) {
    const { children, s } = branch(length, horizontal);
    const before = JSON.stringify({ children, s });
    const result = structuredGroup('control', children, s, 6, padding);
    assert(result, 'Unequal parallel path lengths must not create an artificial rank cycle');
    const nodes = new Map(result.children!.map(n => [n.id, n]));
    const level = (id: string) => horizontal ? nodes.get(id)!.x! : nodes.get(id)!.y!;
    const axis = (id: string) => horizontal ? nodes.get(id)!.y! + 12 : nodes.get(id)!.x! + 12;
    assert.equal(level('holding'), level('serial0'), 'Parallel branch entries share a common level');
    const serial = ['stop', ...Array.from({ length }, (_, i) => 'serial' + i), 'coil'];
    for (let i = 1; i < serial.length; i++) assert(level(serial[i - 1]) < level(serial[i]), 'Serial order remains a hard constraint');
    for (const id of serial.slice(1)) assert(Math.abs(axis(id) - axis('serial0')) < 1, 'Bypass return ties must not pull the serial chain into a zigzag');
    assert.equal(JSON.stringify({ children, s }), before);
    const reversed = { ...s, edges: [...s.edges].reverse().map(e => ({ ...e, from: e.to, to: e.from })) };
    assert.deepEqual(structuredGroup('control', [...children].reverse(), reversed, 6, padding), result, 'Input order and stored wire direction do not determine the branch hierarchy');
}

// Real directed cycles still fall back; layout must not reinterpret them as a DAG.
const cycle = branch(2, false);
cycle.s.edges.push({ id: 'feedback', from: { componentId: 'serial1', pinId: 'out' }, to: { componentId: 'serial0', pinId: 'in' }, potential: '', points: [] });
assert.equal(rankedGroup('cyclic', cycle.children, cycle.s, 6, padding), undefined);

// Lateral same-side ties do not imply equal vertical device levels.
const lateral = branch(2, false);
for (const id of ['serial0', 'serial1']) {
    lateral.children.find(c => c.id === id)!.ports!.push({ id: JSON.stringify([id, 'side']), x: 0, y: 12 });
    lateral.s.nodes.find(n => n.id === id)!.pins.push({ id: 'side', direction: 'left', x: 0, y: 12 });
}
lateral.s.edges.push({ id: 'side-tie', from: { componentId: 'serial0', pinId: 'side' }, to: { componentId: 'serial1', pinId: 'side' }, potential: '', points: [] });
assert(rankedGroup('lateral', lateral.children, lateral.s, 6, padding));

// Editor model with real library pins, cross-references and unequal text envelopes.
const project = fixture();
for (const [id, symbol, bmk, text] of [
    ['feed', 'fuse_1p', '-F1', 'Steuerspannung'], ['stop', 'contact_nc', '-S0', 'Stop'],
    ['start', 'pushbutton_no', '-S1', 'Startanforderung'], ['series', 'contact_no', '-S2', 'Zusatzbedingung'],
    ['holding', 'contact_no', '-K1', 'Haltekontakt mit längerer Beschriftung'], ['coil', 'contactor_coil', '-K1', 'Steuerrelais'],
]) { const c = add(project, id, symbol); c.bmk = bmk; c.functionText = text; }
const pairs = [['feed', '2', 'stop', '21'], ['stop', '22', 'start', '13'], ['start', '14', 'series', '13'], ['series', '14', 'coil', 'A1'], ['start', '13', 'holding', '13'], ['series', '14', 'holding', '14']];
project.pages[0].wires = pairs.map(([a, p, b, q], i) => ({ id: 'w' + i, from: { componentId: a, pinId: p }, to: { componentId: b, pinId: q }, potential: 'Signal', waypoints: [], isAutoconnect: false }));
const original = JSON.stringify(project), net = topology(project), history = new ProjectHistory();
history.reset(project);
const preview = await previewLayout(project, 'p', { multiPage: false });
assert.equal(JSON.stringify(project), original);
const candidate = preview.candidates.find(c => c.profile === 'structured');
assert(candidate, 'Structured parallel paths pass final routing and stored-model validation');
assert.equal(candidate.report.metrics.crossings, 0);
assert(candidate.report.metrics.bends <= 8, 'Serial devices remain on a readable lane');
applyLayout(project, candidate); history.record(project);
assert.equal(topology(project), net);
assert(project.pages[0].components.find(c => c.id === 'holding')!.crossRef, 'Actual cross-reference is measured and retained');
assert.deepEqual(history.undo(), JSON.parse(original));
console.log('✓ Unequal parallel branches, serial hierarchy, stable axes, input-order independence, real library labels/references, topology and undo');
