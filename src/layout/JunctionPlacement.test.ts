import assert from 'node:assert/strict';
import { fixture, add } from './testing/fixture';
import { snapshotPage } from './geometry';
import { junctionPlacement } from './junctionPlacement';
import { structuredGroup } from './structured';
import { alignSerialLanes } from './serialLanes';
import { previewLayout, applyLayout } from './service';
import { topology } from './types';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { Project } from '../model/types';

function control(symbol = 't_piece_right', horizontal = false, labels = false): Project {
    const p = fixture();
    for (const [id, symbolId, bmk, text] of [
        ['feed', 'fuse_1p', '-F1', 'Steuerspannung'], ['stop', 'contact_nc', '-S0', 'Stop'],
        ['start', 'pushbutton_no', '-S1', 'Startanforderung'], ['series', 'contact_no', '-S2', 'Zusatzbedingung'],
        ['holding', 'contact_no', '-K1', 'Haltekontakt'], ['coil', 'contactor_coil', '-K1', 'Steuerrelais'],
        ['tee', symbol, labels ? 'T1' : '', labels ? 'Messabzweig' : ''],
    ]) {
        const c = add(p, id, symbolId); c.bmk = bmk; c.functionText = text;
        if (id === 'tee' && !labels) c.showLabels = false;
        if (horizontal) {
            c.rotation = 270;
            c.bmkPosition = { offsetX: 80 }; c.functionTextPosition = { offsetX: 80 }; c.crossRefPosition = { offsetX: 80 };
        }
    }
    const pairs = [['feed', '2', 'stop', '21'], ['stop', '22', 'tee', '1'], ['tee', '2', 'start', '13'], ['start', '14', 'series', '13'], ['series', '14', 'coil', 'A1'], ['tee', '3', 'holding', '13'], ['series', '14', 'holding', '14']];
    p.pages[0].wires = pairs.map(([a, pin, b, q], i) => ({ id: 'w' + i, from: { componentId: a, pinId: pin }, to: { componentId: b, pinId: q }, potential: 'Signal', waypoints: [], isAutoconnect: false }));
    return p;
}
const padding = { left: 8, right: 8, top: 8, bottom: 8 };
const project = control(), snapshot = snapshotPage(project.pages[0], project);
const children: ElkNode[] = snapshot.nodes.map(n => ({ id: n.id, width: n.rect.width, height: n.rect.height,
    ports: n.pins.map(p => ({ id: JSON.stringify([n.id, p.id]), x: p.x - n.rect.x, y: p.y - n.rect.y })) }));
const original = JSON.stringify({ snapshot, children });
let planned = false;
const layout = junctionPlacement(children, snapshot, 6, padding, (core, planning) => {
    planned = true;
    assert(!core.some(c => c.id === 'tee'), 'Junction is excluded from ordinary device levels');
    assert(planning.junctionSpaces?.length, 'Real measured space is reserved for the retained junction');
    assert(!planning.edges.some(e => e.from.componentId === 'tee' || e.to.componentId === 'tee'), 'Virtual connections are planning-only');
    return structuredGroup('core', core, planning, 6, padding);
});
assert(planned && layout);
assert.equal(layout.children!.filter(c => c.id === 'tee').length, 1);
assert.equal(JSON.stringify({ snapshot, children }), original);
const reversed = junctionPlacement(children, { ...snapshot, edges: [...snapshot.edges].reverse().map(e => ({ ...e, from: e.to, to: e.from })) }, 6, padding,
    (core, planning) => structuredGroup('core', core, planning, 6, padding))!;
for (const n of reversed.children!) {
    const other = layout.children!.find(c => c.id === n.id)!;
    assert(Math.abs(n.x! - other.x!) < 1e-6 && Math.abs(n.y! - other.y!) < 1e-6, 'Wire storage order must not change junction placement');
}

const fixed = structuredClone(snapshot); fixed.nodes.find(n => n.id === 'tee')!.fixed = true;
assert.equal(junctionPlacement(children, fixed, 6, padding, () => { throw new Error('Fixed junction must not move'); }), undefined);
const separate = structuredClone(snapshot); separate.nodes.find(n => n.id === 'tee')!.joinedPins = undefined;
assert.equal(junctionPlacement(children, separate, 6, padding, () => { throw new Error('No bridge may be inferred'); }), undefined);
assert.equal(junctionPlacement(children, snapshot, 6, padding, () => undefined), undefined, 'No partial result on failed core planning');
assert.equal(junctionPlacement(children, snapshot, 6, padding, core => ({ id: 'tight', width: 100, height: 100, children: core.map(c => ({ ...c, x: 8, y: 8 })) })), undefined, 'Missing free corridor must retain the regular candidate');
const chain = structuredClone(snapshot);
chain.nodes.push({ ...structuredClone(chain.nodes.find(n => n.id === 'tee')!), id: 'second-tee' });
chain.edges.push({ id: 'between-helpers', from: { componentId: 'tee', pinId: '2' }, to: { componentId: 'second-tee', pinId: '1' }, potential: 'Signal', points: [] });
const chainChildren = [...children, { ...children.find(c => c.id === 'tee')!, id: 'second-tee' }];
assert.equal(junctionPlacement(chainChildren, chain, 6, padding, () => { throw new Error('Connected helper chain retains regular candidate'); }), undefined);

// A plain crossing, terminal or interruption arrow is never silently made a T-piece.
const roles = fixture();
add(roles, 'cross', 'cross_bridge'); add(roles, 'terminal', 'terminal_single'); add(roles, 'arrow', 'potential_arrow_up');
const roleSnapshot = snapshotPage(roles.pages[0], roles);
assert.equal(roleSnapshot.nodes.find(n => n.id === 'cross')!.joinedPins, undefined);
assert(!roleSnapshot.nodes.find(n => n.id === 'terminal')!.routingJunction);
assert(!roleSnapshot.nodes.find(n => n.id === 'arrow')!.routingJunction);

for (const [symbol, horizontal, labels] of [['t_piece_right', false, false], ['t_piece_left', false, false], ['t_piece_down', false, false], ['t_piece_right', true, false], ['t_piece_right', false, true]] as const) {
    const p = control(symbol, horizontal, labels), before = JSON.stringify(p), net = topology(p);
    const preview = await previewLayout(p, 'p', { multiPage: false });
    const candidate = preview.candidates.find(c => c.profile === 'structured');
    assert(candidate, `Junction ${symbol}, horizontal=${horizontal}, labels=${labels} must route and validate`);
    assert.equal(candidate.report.metrics.crossings, 0);
    const tee = candidate.page.components.find(c => c.id === 'tee')!, stop = candidate.page.components.find(c => c.id === 'stop')!, start = candidate.page.components.find(c => c.id === 'start')!, holding = candidate.page.components.find(c => c.id === 'holding')!;
    assert(horizontal ? stop.x < tee.x && tee.x < start.x : stop.y < tee.y && tee.y < start.y, 'Junction stays in the reserved corridor between its actual neighbours');
    if (!horizontal && symbol !== 't_piece_down') assert(symbol === 't_piece_left' ? holding.x < start.x : holding.x > start.x, 'Lateral branch follows the existing symbol orientation');
    assert.equal(tee.rotation, horizontal ? 270 : 0);
    assert.equal(tee.functionText, labels ? 'Messabzweig' : '');
    assert.equal(candidate.page.wires.length, 7);
    assert(candidate.page.wires.every(w => p.pages[0].wires.some(old => old.id === w.id)), 'No virtual wire enters the project');
    assert.equal(JSON.stringify(p), before);
    applyLayout(p, candidate);
    assert.equal(topology(p), net);
}

// Incompatible directional hints cannot leave a partly moved layout behind.
const rows: ElkNode[][] = [[{ id: 'a', x: 0, y: 0, width: 10, ports: [{ id: 'a', x: 5 }] }, { id: 'b', x: 30, y: 0, width: 10, ports: [{ id: 'b', x: 5 }] }],
    [{ id: 'c', x: 0, y: 30, width: 10, ports: [{ id: 'c', x: 5 }] }, { id: 'd', x: 30, y: 30, width: 10, ports: [{ id: 'd', x: 5 }] }]];
const saved = JSON.stringify(rows);
assert.equal(alignSerialLanes(rows, [{ a: 'a', b: 'c', ac: 'a', bc: 'c' }, { a: 'b', b: 'd', ac: 'b', bc: 'd' }], 6, 0, [['a', 'b'], ['b', 'a']]), false);
assert.equal(JSON.stringify(rows), saved);
console.log('✓ Conductive junction corridors, original branch orientation, both axes, measured labels, fixed/unsupported fallback and exact stored topology');
