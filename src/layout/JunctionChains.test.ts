import assert from 'node:assert/strict';
import { fixture, add } from './testing/fixture';
import { snapshotPage } from './geometry';
import { junctionBlocks } from './junctionBlocks';
import { junctionPlacement } from './junctionPlacement';
import { structuredGroup } from './structured';
import { previewLayout, applyLayout } from './service';
import { topology } from './types';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { Project } from '../model/types';

function rail(count: number, left = false, horizontal = false, labels = false): Project {
    const p = fixture();
    for (const [id, symbol] of [['feed', 'fuse_1p'], ['main', 'contact_no'], ['coil', 'contactor_coil']]) add(p, id, symbol);
    for (let i = 0; i < count; i++) {
        const t = add(p, 'tee' + i, left ? 't_piece_left' : 't_piece_right'); t.showLabels = labels; t.bmk = labels ? '-T' + i : ''; t.functionText = labels ? 'Abzweig ' + i : '';
        add(p, 'branch' + i, 'contact_no').functionText = 'Abgang ' + i;
    }
    const wire = (a: string, pin: string, b: string, q: string) => p.pages[0].wires.push({ id: 'w' + p.pages[0].wires.length, from: { componentId: a, pinId: pin }, to: { componentId: b, pinId: q }, potential: 'Signal', waypoints: [], isAutoconnect: false });
    wire('feed', '2', 'tee0', '1');
    for (let i = 0; i < count; i++) {
        if (i < count - 1) wire('tee' + i, '2', 'tee' + (i + 1), '1');
        wire('tee' + i, '3', 'branch' + i, '13'); wire('branch' + i, '14', 'coil', 'A1');
    }
    wire('tee' + (count - 1), '2', 'main', '13'); wire('main', '14', 'coil', 'A1');
    if (horizontal) for (const c of p.pages[0].components) {
        c.rotation = 270; c.bmkPosition = { offsetX: 80 }; c.functionTextPosition = { offsetX: 80 };
    }
    return p;
}
const project = rail(2), snapshot = snapshotPage(project.pages[0], project);
const children: ElkNode[] = snapshot.nodes.map(n => ({ id: n.id, width: n.rect.width, height: n.rect.height,
    ports: n.pins.map(p => ({ id: JSON.stringify([n.id, p.id]), x: p.x - n.rect.x, y: p.y - n.rect.y })) }));
const helpers = children.filter(c => c.id.startsWith('tee'));
const original = JSON.stringify({ snapshot, children });
const blocks = junctionBlocks(helpers, snapshot, 6)!;
assert.equal(blocks.length, 1);
assert.deepEqual(blocks[0].parts.map(c => c.id), ['tee0', 'tee1']);
assert.equal(blocks[0].parts[0].x, blocks[0].parts[1].x, 'Through ports share one rail axis');
assert(blocks[0].parts[1].y! >= blocks[0].parts[0].y! + blocks[0].parts[0].height! + 6);
assert.deepEqual(blocks[0].through, [JSON.stringify(['tee0', '1']), JSON.stringify(['tee1', '2'])]);
const fineGrid = structuredClone(snapshot); fineGrid.grid.spacing = 0.42;
const fine = junctionBlocks(helpers, fineGrid, 6)![0];
for (const part of fine.parts) {
    const centre = part.y! + part.ports!.filter(p => ['1', '2'].includes(JSON.parse(p.id)[1])).reduce((sum, p) => sum + p.y!, 0) / 2;
    assert(Math.abs(centre / 0.42 - Math.round(centre / 0.42)) < 1e-6, 'Fine grid alignment is not replaced by an arbitrary coarser grid');
}
const padding = { left: 8, right: 8, top: 8, bottom: 8 };
let planned = false;
const compute = (s = snapshot) => junctionPlacement(children, s, 6, padding, (core, planning) => {
    planned = true;
    assert(!core.some(c => c.id.startsWith('tee')), 'Chain consumes routing space instead of extra ordinary device levels');
    return structuredGroup('core', core, planning, 6, padding);
});
const layout = compute()!;
assert(planned && layout);
assert.equal(layout.children!.length, children.length);
assert.deepEqual(new Set(layout.children!.map(c => c.id)), new Set(children.map(c => c.id)), 'All real nodes are expanded; no synthetic block remains');
assert.equal(JSON.stringify({ snapshot, children }), original);
const reversed = compute({ ...snapshot, edges: [...snapshot.edges].reverse().map(e => ({ ...e, from: e.to, to: e.from })) })!;
for (const c of layout.children!) {
    const other = reversed.children!.find(n => n.id === c.id)!;
    assert(Math.abs(c.x! - other.x!) < 1e-6 && Math.abs(c.y! - other.y!) < 1e-6);
}

const cyclic = structuredClone(snapshot);
cyclic.edges.push({ id: 'loop', from: { componentId: 'tee1', pinId: '2' }, to: { componentId: 'tee0', pinId: '1' }, potential: 'Signal', points: [] });
assert.equal(junctionBlocks(helpers, cyclic, 6), undefined, 'Closed helper loops are not broken into an invented linear rail');
const side = structuredClone(snapshot);
side.edges.find(e => e.from.componentId === 'tee0' && e.to.componentId === 'tee1')!.from.pinId = '3';
assert.equal(junctionBlocks(helpers, side, 6), undefined, 'A connection through a side arm is not a straight through chain');
const fixed = structuredClone(snapshot); fixed.nodes.find(n => n.id === 'tee1')!.fixed = true;
assert.equal(junctionPlacement(children, fixed, 6, padding, () => { throw new Error('Fixed chain must retain regular placement'); }), undefined);
const dangling = structuredClone(snapshot); dangling.edges = dangling.edges.filter(e => e.from.componentId !== 'feed');
assert.equal(junctionPlacement(children, dangling, 6, padding, () => { throw new Error('Open rail must not acquire a fictitious supply'); }), undefined);
const separate = structuredClone(snapshot); separate.nodes.find(n => n.id === 'tee1')!.joinedPins = undefined;
assert.equal(junctionBlocks(helpers, separate, 6), undefined);
assert.equal(junctionPlacement(children, separate, 6, padding, () => { throw new Error('Disconnected pins must not acquire a bridge'); }), undefined);

for (const [count, left, horizontal, labels] of [[2, false, false, false], [3, false, false, false], [2, true, false, false], [2, false, true, false], [2, false, false, true]] as const) {
    const p = rail(count, left, horizontal, labels), before = JSON.stringify(p), net = topology(p);
    const preview = await previewLayout(p, 'p', { multiPage: false });
    const candidate = preview.candidates.find(c => c.profile === 'structured');
    assert(candidate, `Rail count=${count}, left=${left}, horizontal=${horizontal}, labels=${labels} must route and validate`);
    assert.equal(candidate.report.metrics.crossings, 0);
    const tees = Array.from({ length: count }, (_, i) => candidate.page.components.find(c => c.id === 'tee' + i)!);
    for (let i = 1; i < tees.length; i++) {
        assert(Math.abs((horizontal ? tees[i].y : tees[i].x) - (horizontal ? tees[0].y : tees[0].x)) < 1e-6);
        assert(horizontal ? tees[i].x > tees[i - 1].x : tees[i].y > tees[i - 1].y);
    }
    const main = candidate.page.components.find(c => c.id === 'main')!, first = candidate.page.components.find(c => c.id === 'branch0')!, last = candidate.page.components.find(c => c.id === 'branch' + (count - 1))!;
    if (!horizontal) assert(left ? first.x < last.x && last.x < main.x : main.x < last.x && last.x < first.x, 'Outer upstream branches keep the appropriate column order');
    assert.equal(candidate.page.components.length, p.pages[0].components.length);
    assert.equal(candidate.page.wires.length, p.pages[0].wires.length);
    assert.equal(JSON.stringify(p), before);
    applyLayout(p, candidate);
    assert.equal(topology(p), net, 'Every original internal/external wire and symbol property survives application');
}
console.log('✓ Linear junction rails, measured envelopes/labels, both axes and sides, ordered branches, expansion, safe cycle/fixed/open fallback and unchanged topology');
