import assert from 'node:assert/strict';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { LayoutSnapshot } from './types';
import { rankedGroup } from './ranked';
import { structuredGroup } from './structured';
import { fixture, add } from './testing/fixture';
import { previewLayout, applyLayout } from './service';
import { topology } from './types';

const padding = { left: 8, right: 8, top: 8, bottom: 8 };
function control(horizontal: boolean) {
    const children: ElkNode[] = ['feed', 'stop', 'start', 'series', 'holding', 'coil'].map(id => ({ id, width: 24, height: 24,
        ports: [{ id: JSON.stringify([id, 'in']), x: horizontal ? 0 : 12, y: horizontal ? 12 : 0 }, { id: JSON.stringify([id, 'out']), x: horizontal ? 24 : 12, y: horizontal ? 12 : 24 }] }));
    const pairs = [['feed', 'out', 'stop', 'in'], ['stop', 'out', 'start', 'in'], ['start', 'out', 'series', 'in'], ['series', 'out', 'coil', 'in'], ['start', 'in', 'holding', 'in'], ['series', 'out', 'holding', 'out']];
    const snapshot: LayoutSnapshot = { pageId: 'p', area: { x: 0, y: 0, width: 500, height: 500 }, grid: { spacing: 4, origin: { x: 0, y: 0 } }, frames: [], issues: [],
        nodes: children.map(c => ({ id: c.id, kind: 'component', fixed: false, rect: { x: 0, y: 0, width: 24, height: 24 }, origin: { x: 0, y: 0 }, shapes: [],
            pins: [{ id: 'in', x: horizontal ? 0 : 12, y: horizontal ? 12 : 0, direction: horizontal ? 'left' : 'top' }, { id: 'out', x: horizontal ? 24 : 12, y: horizontal ? 12 : 24, direction: horizontal ? 'right' : 'bottom' }] })),
        edges: pairs.map(([a, p, b, q], i) => ({ id: 'w' + i, from: { componentId: a, pinId: p }, to: { componentId: b, pinId: q }, potential: 'Signal', points: [] })) };
    return { children, snapshot };
}
for (const horizontal of [false, true]) for (const variant of ['direct', 'star', 'return-star', 'bridge', 'separate-pins']) {
    const { children, snapshot } = control(horizontal);
    if (variant === 'star') snapshot.edges[4].from = { componentId: 'stop', pinId: 'out' };
    if (variant === 'return-star') snapshot.edges[5].from = { componentId: 'coil', pinId: 'in' };
    if (variant === 'bridge' || variant === 'separate-pins') {
        snapshot.nodes.push({ id: 'bridge', kind: 'component', fixed: true, origin: { x: 0, y: 0 }, rect: { x: 0, y: 0, width: 4, height: 4 }, shapes: [],
            pins: [{ id: 'p', x: 0, y: 2, direction: 'left' }, { id: 'q', x: 4, y: 2, direction: 'right' }],
            joinedPins: variant === 'bridge' ? [['p', 'q']] : undefined });
        snapshot.edges[4].to = { componentId: 'bridge', pinId: 'p' };
        snapshot.edges.push({ id: 'bridge-wire', from: { componentId: 'bridge', pinId: 'q' }, to: { componentId: 'holding', pinId: 'in' }, potential: 'Signal', points: [] });
    }
    const original = JSON.stringify({ children, snapshot });
    const result = structuredGroup('control', children, snapshot, 6, padding)!;
    assert(result);
    const level = (id: string) => {
        const n = result.children!.find(n => n.id === id)!;
        return horizontal ? n.x! : n.y!;
    };
    if (variant !== 'separate-pins') assert.equal(level('start'), level('holding'), 'Electrically joined branch entries retain a common device level');
    else assert.notEqual(level('start'), level('holding'), 'Different pins of an ordinary device must not be implicitly shorted');
    assert(level('start') < level('series') && level('series') < level('coil'), 'Serial hierarchy remains intact');
    assert.equal(JSON.stringify({ children, snapshot }), original);
    const reversed = structuredGroup('control', children, { ...snapshot, edges: [...snapshot.edges].reverse().map(e => ({ ...e, from: e.to, to: e.from })) }, 6, padding)!;
    const reference = reversed.children!.find(n => n.id === 'start')!, other = reversed.children!.find(n => n.id === 'holding')!;
    if (variant !== 'separate-pins') assert.equal(horizontal ? reference.x : reference.y, horizontal ? other.x : other.y);
}

// Same text on disconnected nets does not imply common input levels.
const isolated = control(false);
isolated.snapshot.edges[4].from = { componentId: 'feed', pinId: 'out' };
const separate = rankedGroup('separate', isolated.children, isolated.snapshot, 6, padding)!;
assert.notEqual(separate.children!.find(n => n.id === 'holding')!.y, separate.children!.find(n => n.id === 'start')!.y);

// Final stored-model validation for the directly connected and star representations.
for (const star of [false, true]) {
    const project = fixture();
    for (const [id, symbol, bmk, text] of [
        ['feed', 'fuse_1p', '-F1', 'Steuerspannung'], ['stop', 'contact_nc', '-S0', 'Stop'],
        ['start', 'pushbutton_no', '-S1', 'Startanforderung'], ['series', 'contact_no', '-S2', 'Zusatzbedingung'],
        ['holding', 'contact_no', '-K1', 'Haltekontakt mit längerer Beschriftung'], ['coil', 'contactor_coil', '-K1', 'Steuerrelais'],
    ]) { const c = add(project, id, symbol); c.bmk = bmk; c.functionText = text; }
    const pairs = [['feed', '2', 'stop', '21'], ['stop', '22', 'start', '13'], ['start', '14', 'series', '13'], ['series', '14', 'coil', 'A1'], [star ? 'stop' : 'start', star ? '22' : '13', 'holding', '13'], ['series', '14', 'holding', '14']];
    project.pages[0].wires = pairs.map(([a, p, b, q], i) => ({ id: 'w' + i, from: { componentId: a, pinId: p }, to: { componentId: b, pinId: q }, potential: 'Signal', waypoints: [], isAutoconnect: false }));
    const original = JSON.stringify(project), net = topology(project);
    const preview = await previewLayout(project, 'p', { multiPage: false });
    const candidate = preview.candidates.find(c => c.profile === 'structured');
    assert(candidate, 'Each original wire tree must independently route and validate');
    assert.equal(candidate.report.metrics.crossings, 0);
    const start = candidate.page.components.find(c => c.id === 'start')!, holding = candidate.page.components.find(c => c.id === 'holding')!;
    assert.equal(start.y, holding.y);
    assert.equal(JSON.stringify(project), original);
    applyLayout(project, candidate);
    assert.equal(topology(project), net, 'Layout never substitutes a different wire tree or changes any endpoint');
}
console.log('✓ Actual-net branch levels for direct/star/bridged wiring, separated terminals, both axes, immutable inputs and routed endpoint preservation');
