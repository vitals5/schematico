import assert from 'node:assert/strict';
import { fixture, add } from './testing/fixture';
import { snapshotPage } from './geometry';
import { coherentBlocks, partitionBins } from './coherentBlocks';
import { previewLayout, applyLayout } from './service';
import { ProjectHistory } from '../model/ProjectHistory';

const p = fixture();
for (const id of ['feed', 'a0', 'a1', 'b0', 'b1', 'end']) add(p, id, 'contact_no');
for (const [a, b] of [['feed','a0'], ['feed','b0'], ['a0','a1'], ['b0','b1'], ['a1','end'], ['b1','end']]) p.pages[0].wires.push({
    id: a + '-' + b, from: { componentId: a, pinId: '14' }, to: { componentId: b, pinId: '13' }, potential: '', waypoints: [], isAutoconnect: false,
});
const s = snapshotPage(p.pages[0], p), atomic = s.nodes.map(n => [n.id]), before = JSON.stringify({ atomic, s });
const blocks = coherentBlocks(atomic, s);
assert(blocks.some(b => b.join(',') === 'a0,a1'));
assert(blocks.some(b => b.join(',') === 'b0,b1'));
assert(blocks.some(b => b.join(',') === 'feed') && blocks.some(b => b.join(',') === 'end'), 'Shared supply and return must not fuse all branches');
assert.equal(JSON.stringify({ atomic, s }), before);
const reversed = { ...s, edges: [...s.edges].reverse().map(e => ({ ...e, from: e.to, to: e.from })) };
assert.deepEqual(coherentBlocks(atomic, reversed), blocks);
const horizontal = structuredClone(s);
for (const n of horizontal.nodes) for (const pin of n.pins) pin.direction = ({ top: 'left', bottom: 'right', left: 'top', right: 'bottom' } as const)[pin.direction];
assert.deepEqual(coherentBlocks(atomic, horizontal), blocks);
assert(coherentBlocks(atomic, { ...s, edges: [] }).every(b => b.length === 1), 'Names and proximity alone do not form a circuit chain');

const grouped = coherentBlocks([['feed', 'b1'], ...atomic.filter(b => !['feed','b1'].includes(b[0]))], s);
assert(grouped.some(b => b.includes('feed') && b.includes('b1')), 'Explicit groups remain atomic');
const fixed = structuredClone(s); fixed.nodes.find(n => n.id === 'a0')!.fixed = true;
assert(!coherentBlocks(atomic, fixed).some(b => b.includes('a0') && b.includes('a1')));
const multipole = structuredClone(s); multipole.nodes.find(n => n.id === 'a0')!.pins.push({ id: 'extra', x: 0, y: 0, direction: 'left' });
assert(!coherentBlocks(atomic, multipole).some(b => b.includes('a0') && b.includes('a1')));
const bins = partitionBins(blocks, 2, s);
assert.deepEqual(new Set(bins.flat()), new Set(atomic.flat()));
assert(bins.some(b => b.includes('a0') && b.includes('a1')));

// Two independent wide three-device paths cannot fit on one sheet. A coherent
// split needs two sheets and no artificial handover arrows between serial devices.
const large = fixture();
large.symbolLibrary = [{ id: 'wide', name: 'Wide device', description: '', category: 'supply', standard: '', defaultBmkPrefix: 'T', defaultFunctionText: '',
    width: 600, height: 140, svgContent: '<rect width="600" height="140" fill="none" stroke="currentColor" stroke-width="1"/>',
    pins: [{ id: 'in', name: '1', x: 300, y: 0, direction: 'top' }, { id: 'out', name: '2', x: 300, y: 140, direction: 'bottom' }] }];
for (const branch of ['a', 'b']) for (let i = 0; i < 3; i++) {
    add(large, branch + i, 'wide').functionText = '';
    if (i) large.pages[0].wires.push({ id: branch + 'wire' + i, from: { componentId: branch + (i - 1), pinId: 'out' }, to: { componentId: branch + i, pinId: 'in' }, potential: '', waypoints: [], isAutoconnect: false });
}
large.pages[0].texts = [{id:'note',text:'Hinweis',x:40,y:40,fontSize:6}];
large.pages[0].images = [{id:'logo',dataUrl:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=',x:40,y:60,width:8,height:8}];
const graph = (project: typeof large) => JSON.stringify({
    components: project.pages.flatMap(p => p.components).map(c => [c.id, c.symbolId, c.bmk, Object.keys(c.pins).sort()]).sort(),
    wires: project.pages.flatMap(p => p.wires).map(w => [w.id, w.from, w.to, w.potential]).sort(),
});
const original = JSON.stringify(large), net = graph(large), history = new ProjectHistory(); history.reset(large);
const single = await previewLayout(large, 'p', { multiPage: false });
assert.equal(single.status, 'layout_invalid');
const preview = await previewLayout(large, 'p');
const candidate = preview.candidates.find(c => c.multiPage);
assert(candidate?.multiPage, 'Oversized independent paths need a validated multi-sheet candidate');
assert.equal(candidate.multiPage.pages.length, 2);
assert.equal(candidate.multiPage.links.length, 0, 'Complete paths need no serial cut references');
for (const branch of ['a', 'b']) assert(candidate.multiPage.pages.some(p => [0,1,2].every(i => p.components.some(c => c.id === branch + i))));
assert.equal(candidate.multiPage.pages.flatMap(p=>p.texts??[]).length,1);
assert.equal(candidate.multiPage.pages.flatMap(p=>p.images??[]).length,1);
assert.equal(candidate.multiPage.pages[0].texts![0].text,'Hinweis');
assert.equal(candidate.multiPage.pages[0].images![0].dataUrl,large.pages[0].images![0].dataUrl);
const altered = JSON.parse(JSON.stringify(candidate));
altered.multiPage.pages[1].texts=[...altered.multiPage.pages[0].texts];
assert.throws(()=>applyLayout(large,altered),/Zusatzinhalte/);
assert.equal(JSON.stringify(large), original);
applyLayout(large, candidate); history.record(large);
assert.equal(graph(large), net);
assert.deepEqual(history.undo(), JSON.parse(original));
console.log('✓ Coherent serial page blocks, separate fanout paths, atomic groups, guards, checked two-sheet layout without serial cuts, immutable topology and undo');
