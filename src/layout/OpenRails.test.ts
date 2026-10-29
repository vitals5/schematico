import assert from 'node:assert/strict';
import type { ElkNode } from 'elkjs/lib/elk-api';
import { fixture, add } from './testing/fixture';
import { snapshotPage } from './geometry';
import { junctionPlacement } from './junctionPlacement';
import { structuredGroup } from './structured';
import { alignSerialLanes } from './serialLanes';
import { previewLayout, applyLayout } from './service';
import { topology } from './types';
import { ProjectHistory } from '../model/ProjectHistory';

function openRail(count: number, head = false, left = false, horizontal = false, labels = false) {
    const p = fixture();
    add(p, head ? 'end' : 'feed', head ? 'contactor_coil' : 'fuse_1p');
    if (!head) add(p, 'return', 'contactor_coil');
    const connect = (a: string, pin: string, b: string, q: string) => p.pages[0].wires.push({ id: 'w' + p.pages[0].wires.length, from: { componentId: a, pinId: pin }, to: { componentId: b, pinId: q }, potential: 'Signal', waypoints: [], isAutoconnect: false });
    for (let i = 0; i < count; i++) {
        const t = add(p, 'tee' + i, left ? 't_piece_left' : 't_piece_right');
        t.bmk = labels ? '-T' + i : ''; t.functionText = labels ? 'Abzweig ' + i : ''; t.showLabels = labels;
        add(p, 'branch' + i, 'contact_no').functionText = 'Steuerzweig ' + i;
        if (i) connect('tee' + (i - 1), '2', 'tee' + i, '1');
        if (head) connect('branch' + i, '14', 'tee' + i, '3');
        else { connect('tee' + i, '3', 'branch' + i, '13'); connect('branch' + i, '14', 'return', 'A1'); }
    }
    if (head) connect('tee' + (count - 1), '2', 'end', 'A1');
    else connect('feed', '2', 'tee0', '1');
    if (horizontal) for (const c of p.pages[0].components) {
        c.rotation = 270; c.bmkPosition = { offsetX: 80 }; c.functionTextPosition = { offsetX: 80 };
    }
    return p;
}
const p = openRail(2), snapshot = snapshotPage(p.pages[0], p);
const children: ElkNode[] = snapshot.nodes.map(n => ({ id: n.id, width: n.rect.width, height: n.rect.height,
    ports: n.pins.map(pin => ({ id: JSON.stringify([n.id, pin.id]), x: pin.x - n.rect.x, y: pin.y - n.rect.y })) }));
const before = JSON.stringify({ snapshot, children });
const padding = { left: 8, right: 8, top: 8, bottom: 8 };
let planned = false;
const calculate = (s = snapshot) => junctionPlacement(children, s, 6, padding, (core, planning) => {
    planned = true;
    assert(!core.some(c => c.id.startsWith('tee')));
    assert(planning.junctionSpaces?.some(s => s.apartX?.length), 'Real side space is reserved for labels and branch conductors');
    assert(planning.edges.some(e => e.alignAxis === false), 'A side-arm reference must not force source and consumer onto one axis');
    return structuredGroup('core', core, planning, 6, padding);
});
const layout = calculate()!;
assert(planned && layout);
assert.deepEqual(new Set(layout.children!.map(c => c.id)), new Set(children.map(c => c.id)));
assert.equal(JSON.stringify({ snapshot, children }), before);
const reversed = calculate({ ...snapshot, edges: [...snapshot.edges].reverse().map(e => ({ ...e, from: e.to, to: e.from })) })!;
for (const n of layout.children!) {
    const other = reversed.children!.find(c => c.id === n.id)!;
    assert(Math.abs(n.x! - other.x!) < 1e-6 && Math.abs(n.y! - other.y!) < 1e-6);
}
const bothOpen = structuredClone(snapshot); bothOpen.edges = bothOpen.edges.filter(e => e.from.componentId !== 'feed' && e.to.componentId !== 'feed');
assert.equal(junctionPlacement(children, bothOpen, 6, padding, () => { throw new Error('No physical through reference may be invented'); }), undefined);

for (const [count, head, left, horizontal, labels] of [[1, false, false, false, false], [2, false, false, false, false], [3, false, false, false, false], [2, false, true, false, false], [2, false, false, true, false], [2, false, false, false, true], [2, true, false, false, false]] as const) {
    const project = openRail(count, head, left, horizontal, labels), original = JSON.stringify(project), net = topology(project);
    const history = new ProjectHistory(); history.reset(project);
    const preview = await previewLayout(project, 'p', { multiPage: false });
    const candidate = preview.candidates.find(c => c.profile === 'structured');
    assert(candidate, `Open rail count=${count}, head=${head}, left=${left}, horizontal=${horizontal}, labels=${labels} must route and validate`);
    assert.equal(candidate.report.metrics.crossings, 0);
    assert.equal(JSON.stringify(project), original);
    assert.equal(candidate.page.wires.length, project.pages[0].wires.length);
    assert.deepEqual(new Set(candidate.page.components.map(c => c.id)), new Set(project.pages[0].components.map(c => c.id)));
    assert(candidate.page.wires.every(w => !('alignAxis' in w)), 'Temporary planning flags do not enter the project');
    const free = { componentId: head ? 'tee0' : 'tee' + (count - 1), pinId: head ? '1' : '2' };
    assert(candidate.page.wires.every(w => [w.from, w.to].every(e => e.componentId !== free.componentId || e.pinId !== free.pinId)), 'The free physical end stays unconnected');
    const anchor = candidate.page.components.find(c => c.id === (head ? 'end' : 'feed'))!;
    const branches = candidate.page.components.filter(c => c.id.startsWith('branch'));
    if (!horizontal) assert(branches.every(c => left ? c.x < anchor.x : c.x > anchor.x), 'Open rail uses a true side corridor rather than crossing device labels');
    const tees = candidate.page.components.filter(c => c.id.startsWith('tee'));
    assert(tees.every(t => Math.abs((horizontal ? t.y : t.x) - (horizontal ? tees[0].y : tees[0].x)) < 1e-6));
    applyLayout(project, candidate); history.record(project);
    assert.equal(topology(project), net, 'Original devices, all wire endpoints and unused pin states are preserved');
    assert.deepEqual(history.undo(), JSON.parse(original));
}

const rows: ElkNode[][] = [[{ id: 'source', x: 0, y: 0, width: 30 }], [{ id: 'consumer', x: 0, y: 50, width: 80 }]];
assert(alignSerialLanes(rows, [], 6, 0, [], [['source', 'consumer']]));
assert(rows[1][0].x! >= rows[0][0].x! + 36, 'Across-level side space includes the source envelope and clearance');
const conflict = structuredClone(rows), saved = JSON.stringify(conflict);
assert.equal(alignSerialLanes(conflict, [], 6, 0, [], [['source', 'consumer'], ['consumer', 'source']]), false);
assert.equal(JSON.stringify(conflict), saved, 'Conflicting side corridors cannot partially move devices');
console.log('✓ Open rail ends, actual reference pins, retained unused pins/topology, side corridors across levels, both axes/sides, labels, source isolation and undo');
