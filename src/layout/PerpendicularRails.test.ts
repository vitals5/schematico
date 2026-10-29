import assert from 'node:assert/strict';
import type { ElkNode } from 'elkjs/lib/elk-api';
import { fixture, add } from './testing/fixture';
import { snapshotPage } from './geometry';
import { perpendicularRail } from './perpendicularRail';
import { structuredGroup } from './structured';
import { previewLayout, applyLayout } from './service';
import { topology } from './types';
import { ProjectHistory } from '../model/ProjectHistory';

function bus(count = 3, vertical = false, negative = false, open = false, labels = false, depth = false) {
    const p = fixture();
    const orientation = vertical ? 0 : 270;
    const feed = add(p, 'feed', 'fuse_1p'); feed.rotation = orientation; feed.functionText = 'Einspeisung';
    if (!open) { const end = add(p, 'end', 'terminal_single'); end.rotation = orientation; end.functionText = 'Weiterführung'; }
    if (!vertical) for (const c of p.pages[0].components) { c.bmkPosition = { offsetX: 40 }; c.functionTextPosition = { offsetX: 40 }; }
    const connect = (a: string, pin: string, b: string, q: string) => p.pages[0].wires.push({ id: 'w' + p.pages[0].wires.length, from: { componentId: a, pinId: pin }, to: { componentId: b, pinId: q }, potential: 'L', waypoints: [], isAutoconnect: false });
    for (let i = 0; i < count; i++) {
        const t = add(p, 'tee' + i, vertical ? negative ? 't_piece_left' : 't_piece_right' : negative ? 't_piece_up' : 't_piece_down');
        t.bmk = labels ? '-T' + i : ''; t.functionText = labels ? i ? 'Abzweig mit längerer Beschriftung' : 'Abzweig' : ''; t.showLabels = labels;
        const c = add(p, 'load' + i, 'contact_no'); c.bmk = '-K' + (i + 1); c.functionText = i === 1 ? 'Längere Beschriftung des mittleren Abgangs' : 'Abgang ' + i;
        c.rotation = vertical ? negative ? 90 : 270 : negative ? 180 : 0;
        if (vertical) { c.bmkPosition = { offsetX: 80 }; c.functionTextPosition = { offsetX: 80 }; c.crossRefPosition = { offsetX: 80 }; }
        if (i) connect('tee' + (i - 1), '2', 'tee' + i, '1');
        connect('tee' + i, '3', 'load' + i, '13');
        if (depth) {
            const next = add(p, 'next' + i, 'contactor_coil'); next.bmk = c.bmk; next.rotation = c.rotation;
            if (vertical) { next.bmkPosition = { offsetX: 80 }; next.functionTextPosition = { offsetX: 80 }; next.crossRefPosition = { offsetX: 80 }; }
            connect('load' + i, '14', 'next' + i, 'A1');
        }
    }
    connect('feed', '2', 'tee0', '1');
    if (!open) connect('tee' + (count - 1), '2', 'end', '1');
    return p;
}
const p = bus(), source = snapshotPage(p.pages[0], p);
const children: ElkNode[] = source.nodes.map(n => ({ id: n.id, width: n.rect.width, height: n.rect.height,
    ports: n.pins.map(pin => ({ id: JSON.stringify([n.id, pin.id]), x: pin.x - n.rect.x, y: pin.y - n.rect.y })) }));
const original = JSON.stringify({ children, source }), padding = { left: 8, right: 8, top: 8, bottom: 8 };
let planned = false;
const calculate = (s = source) => perpendicularRail(children, s, 6, padding, (core, planning) => {
    planned = true;
    assert(!core.some(c => c.id.startsWith('tee') || c.id === 'feed' || c.id === 'end'));
    assert.equal(planning.planningAxis, 'vertical', 'Branch subcircuits follow their own flow axis');
    assert(planning.junctionSpaces!.every(s => s.reserve === false), 'Rail is placed outside the branch group');
    return structuredGroup('branches', core, planning, 6, padding);
});
const layout = calculate()!;
assert(planned && layout);
assert.equal(JSON.stringify({ children, source }), original);
assert.deepEqual(new Set(layout.children!.map(c => c.id)), new Set(children.map(c => c.id)));
const reversed = calculate({ ...source, edges: [...source.edges].reverse().map(e => ({ ...e, from: e.to, to: e.from })) })!;
for (const n of layout.children!) {
    const other = reversed.children!.find(c => c.id === n.id)!;
    assert(Math.abs(n.x! - other.x!) < 1e-6 && Math.abs(n.y! - other.y!) < 1e-6);
}
const fixed = structuredClone(source); fixed.nodes.find(n => n.id === 'tee1')!.fixed = true;
assert.equal(perpendicularRail(children, fixed, 6, padding, () => { throw new Error('Fixed station cannot move'); }), undefined);
const fixedDock = structuredClone(source); fixedDock.nodes.find(n => n.id === 'feed')!.fixed = true;
assert.equal(perpendicularRail(children, fixedDock, 6, padding, () => { throw new Error('Fixed through neighbour cannot move'); }), undefined);
const separate = structuredClone(source); separate.nodes.find(n => n.id === 'tee1')!.joinedPins = undefined;
assert.equal(perpendicularRail(children, separate, 6, padding, () => { throw new Error('A bridge must not be inferred'); }), undefined);
const bothOpen = structuredClone(source); bothOpen.edges = bothOpen.edges.filter(e => !['feed', 'end'].includes(e.from.componentId) && !['feed', 'end'].includes(e.to.componentId));
assert.equal(perpendicularRail(children, bothOpen, 6, padding, () => { throw new Error('Missing through reference must not be invented'); }), undefined);
const duplicate = structuredClone(source); duplicate.edges.push({ id: 'duplicate-leg', from: { componentId: 'tee0', pinId: '3' }, to: { componentId: 'load1', pinId: '13' }, potential: 'L', points: [] });
assert.equal(perpendicularRail(children, duplicate, 6, padding, () => { throw new Error('Ambiguous station assignment retains the regular candidate'); }), undefined);

for (const [count, vertical, negative, open, labels, depth] of [
    [1, false, false, false, false, false], [3, false, false, false, false, false],
    [3, false, true, false, false, false], [3, true, false, false, false, false],
    [3, true, true, false, false, false], [3, false, false, true, false, false],
    [3, false, false, false, true, false], [3, false, false, false, false, true],
] as const) {
    const project = bus(count, vertical, negative, open, labels, depth);
    if (depth) project.pages[0].wires.find(w => w.from.componentId === 'load0')!.id = 'rail-order-1';
    const saved = JSON.stringify(project), net = topology(project), history = new ProjectHistory(); history.reset(project);
    const preview = await previewLayout(project, 'p', { multiPage: false });
    const candidate = preview.candidates.find(c => c.profile === 'structured');
    assert(candidate, `Rail count=${count}, vertical=${vertical}, negative=${negative}, open=${open}, labels=${labels}, depth=${depth} must route and validate`);
    assert.equal(candidate.report.metrics.crossings, 0);
    assert.equal(candidate.report.metrics.bends, 0, 'Rail stations follow their corresponding physical branch entrance axes');
    assert.equal(JSON.stringify(project), saved);
    assert.deepEqual(new Set(candidate.page.components.map(c => c.id)), new Set(project.pages[0].components.map(c => c.id)));
    assert.deepEqual(new Set(candidate.page.wires.map(w => w.id)), new Set(project.pages[0].wires.map(w => w.id)));
    const geometry = snapshotPage(candidate.page, project);
    const rails = Array.from({ length: count }, (_, i) => geometry.nodes.find(n => n.id === 'tee' + i)!);
    for (let i = 0; i < count; i++) {
        const tap = rails[i].pins.find(p => p.id === '3')!, entrance = geometry.nodes.find(n => n.id === 'load' + i)!.pins.find(p => p.id === '13')!;
        assert(Math.abs((vertical ? tap.y : tap.x) - (vertical ? entrance.y : entrance.x)) < 1e-6);
        if (i) assert(vertical ? tap.y > rails[i - 1].pins.find(p => p.id === '3')!.y : tap.x > rails[i - 1].pins.find(p => p.id === '3')!.x);
    }
    if (open) assert(candidate.page.wires.every(w => [w.from, w.to].every(e => e.componentId !== 'tee' + (count - 1) || e.pinId !== '2')));
    applyLayout(project, candidate); history.record(project);
    assert.equal(topology(project), net);
    assert.deepEqual(history.undo(), JSON.parse(saved));
}
console.log('✓ Perpendicular rail branches, straight taps, both axes/sides, measured station labels, open ends, downstream chains, private edge IDs, immutable source and undo');
