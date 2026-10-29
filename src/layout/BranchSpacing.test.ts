import assert from 'node:assert/strict';
import { fixture, add } from './testing/fixture';
import { snapshotPage } from './geometry';
import { previewLayout, applyLayout } from './service';
import { topology } from './types';
import { ProjectHistory } from '../model/ProjectHistory';

function parallel(horizontal = false, reverse = false) {
    const p = fixture();
    const feed = add(p, 'feed', 'fuse_1p'), end = add(p, 'end', 'terminal_single');
    feed.functionText = 'Versorgung'; end.functionText = 'Rückleiter';
    const wire = (a: string, ap: string, b: string, bp: string) => p.pages[0].wires.push({ id: 'w' + p.pages[0].wires.length,
        from: { componentId: a, pinId: ap }, to: { componentId: b, pinId: bp }, potential: '', waypoints: [], isAutoconnect: false });
    for (let i = 0; i < 3; i++) {
        const c = add(p, 'contact' + i, 'contact_no'), coil = add(p, 'coil' + i, 'contactor_coil');
        c.bmk = coil.bmk = '-K' + (i + 1);
        c.functionText = i === 1 ? 'Zusatzbedingung mit längerer Beschriftung' : 'Freigabe';
        coil.functionText = 'Steuerrelais';
        wire('feed', '2', c.id, '13'); wire(c.id, '14', coil.id, 'A1'); wire(coil.id, 'A2', 'end', '1');
    }
    if (horizontal) for (const c of p.pages[0].components) {
        c.rotation = 270; c.bmkPosition = { offsetX: 80 }; c.functionTextPosition = { offsetX: 80 }; c.crossRefPosition = { offsetX: 80 };
    }
    if (reverse) { p.pages[0].components.reverse(); p.pages[0].wires.reverse(); for (const w of p.pages[0].wires) [w.from, w.to] = [w.to, w.from]; }
    return p;
}
for (const horizontal of [false, true]) {
    let positions: Map<string, { x: number; y: number }> | undefined;
    for (const reverse of [false, true]) {
        const project = parallel(horizontal, reverse), original = JSON.stringify(project), net = topology(project);
        const history = new ProjectHistory(); history.reset(project);
        const preview = await previewLayout(project, 'p', { multiPage: false });
        const candidate = preview.candidates.find(c => c.profile === 'structured');
        assert(candidate, `Parallel branch layout must validate: horizontal=${horizontal}, reverse=${reverse}`);
        const geometry = snapshotPage(candidate.page, project);
        const axis = (id: string, port: string) => { const pin = geometry.nodes.find(n => n.id === id)!.pins.find(p => p.id === port)!; return horizontal ? pin.y : pin.x; };
        const axes = [0, 1, 2].map(i => axis('contact' + i, '13'));
        assert(Math.abs(axes[1] - axes[0] - (axes[2] - axes[1])) < 1e-6, 'Equivalent branches have equal physical pitch despite unequal text envelopes');
        for (const [id, port] of [['feed', '2'], ['end', '1']]) assert(Math.abs(axis(id, port) - (axes[0] + axes[2]) / 2) < 1e-6, 'Dedicated common devices follow the centre of their branch bank');
        for (let i = 0; i < 3; i++) assert(Math.abs(axis('contact' + i, '14') - axis('coil' + i, 'A1')) < 1e-6);
        assert.equal(candidate.report.metrics.crossings, 0);
        assert.equal(JSON.stringify(project), original);
        if (positions) for (const c of candidate.page.components) {
            const old = positions.get(c.id)!; assert(Math.abs(old.x - c.x) < 1e-6 && Math.abs(old.y - c.y) < 1e-6);
        }
        positions = new Map(candidate.page.components.map(c => [c.id, { x: c.x, y: c.y }]));
        applyLayout(project, candidate); history.record(project);
        assert.equal(topology(project), net);
        assert.deepEqual(history.undo(), JSON.parse(original));
    }
}
console.log('✓ Equivalent parallel branches: regular physical pitch, unequal labels, both axes, reversed input, routing, immutable topology and undo');

const { spaceParallelBranches } = await import('./branchSpacing');
function localCase() {
    const project = parallel(), snapshot = snapshotPage(project.pages[0], project);
    const rows = ['contact', 'coil'].map(prefix => [0, 1, 2].map(i => {
        const n = snapshot.nodes.find(n => n.id === prefix + i)!;
        const ports = n.pins.map(p => ({ id: JSON.stringify([n.id, p.id]), x: p.x - n.rect.x, y: p.y - n.rect.y }));
        return { id: n.id, x: [80, 180, 320][i] - ports[0].x, y: prefix === 'contact' ? 0 : 80, width: n.rect.width, height: n.rect.height, ports };
    }));
    const connections = [0, 1, 2].map(i => ({ ac: 'contact' + i, bc: 'coil' + i,
        a: JSON.stringify(['contact' + i, '14']), b: JSON.stringify(['coil' + i, 'A1']) }));
    return { rows, snapshot, connections };
}
const regular = localCase(), savedSource = JSON.stringify(regular.snapshot);
assert(spaceParallelBranches(regular.rows, regular.connections, regular.snapshot, 6, 8));
assert.equal(JSON.stringify(regular.snapshot), savedSource);
for (const kind of ['fixed', 'multipole', 'separate', 'short', 'blocked'] as const) {
    const c = localCase();
    if (kind === 'fixed') c.snapshot.nodes.find(n => n.id === 'contact1')!.fixed = true;
    if (kind === 'multipole') c.snapshot.nodes.find(n => n.id === 'contact1')!.pins.push({ id: 'extra', x: 0, y: 0, direction: 'top' });
    if (kind === 'separate') c.snapshot.edges = c.snapshot.edges.filter(e => e.from.componentId !== 'coil1');
    if (kind === 'short') c.connections.pop();
    if (kind === 'blocked') c.rows[0].push({ id: 'obstacle', x: 150, y: 0, width: 150, height: 20, ports: [] });
    const saved = JSON.stringify(c.rows);
    assert.equal(spaceParallelBranches(c.rows, c.connections, c.snapshot, 6, 8), false, kind + ' must retain the current arrangement');
    assert.equal(JSON.stringify(c.rows), saved, 'Rejected symmetry must not partly move a branch');
}
console.log('✓ Symmetry guards: fixed, multipole, disconnected exit, short paths, obstructing neighbours and no partial mutations');

for (const external of [false, true]) {
    const c = localCase();
    const n = c.snapshot.nodes.find(n => n.id === 'feed')!;
    const dock = { id: n.id, x: 30, y: -80, width: n.rect.width, height: n.rect.height,
        ports: n.pins.map(p => ({ id: JSON.stringify([n.id, p.id]), x: p.x - n.rect.x, y: p.y - n.rect.y })) };
    c.rows.unshift([dock]);
    if (external) c.snapshot.edges.push({ id: 'external', from: { componentId: 'feed', pinId: '1' }, to: { componentId: 'end', pinId: '2' }, potential: '', points: [] });
    else n.fixed = true;
    assert(spaceParallelBranches(c.rows, c.connections, c.snapshot, 6, 8));
    assert.equal(dock.x, 30, 'Fixed or externally wired common devices must not be centred automatically');
}
console.log('✓ Common device centring excludes fixed devices and additional external wiring');
