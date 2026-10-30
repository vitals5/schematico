import assert from 'node:assert/strict';
import { fixture, add } from './testing/fixture';
import { getSymbolById } from '../model/symbols';
import { snapshotPage } from './geometry';
import { functionalBlocks } from './functionalBlocks';
import { coherentBlocks, partitionBins } from './coherentBlocks';
import { previewLayout, applyLayout } from './service';
import { multiPageCandidate } from './multipage';
import { ProjectHistory } from '../model/ProjectHistory';

const project = fixture();
for (let i = 1; i <= 2; i++) {
  for (const [suffix, symbol, tag] of [
    ['p', 'contactor_power_3p', '-K' + i], ['m', 'motor_3phase', '-M' + i],
    ['s', 'pushbutton_no', '-S' + i], ['c', 'contactor_coil', '-K' + i],
  ]) { const c = add(project, (suffix === 's' || suffix === 'c' ? 'a' : 'z') + i + suffix, symbol); c.bmk = tag; c.functionText = ''; }
  project.pages[0].wires.push({ id: 'control' + i, from: { componentId: 'a' + i + 's', pinId: '14' }, to: { componentId: 'a' + i + 'c', pinId: 'A1' }, potential: '', waypoints: [], isAutoconnect: false });
  for (const [j, [a,b]] of [['2','U1'],['4','V1'],['6','W1']].entries()) project.pages[0].wires.push({ id: 'power' + i + j, from: { componentId: 'z' + i + 'p', pinId: a }, to: { componentId: 'z' + i + 'm', pinId: b }, potential: '', waypoints: [], isAutoconnect: false });
}
const snapshot = snapshotPage(project.pages[0], project), atomic = snapshot.nodes.map(n => [n.id]);
const before = JSON.stringify({ snapshot, atomic });
const coherent = coherentBlocks(atomic, snapshot), preferred = functionalBlocks(coherent, snapshot);
assert.equal(preferred.length, 2);
for (let i = 1; i <= 2; i++) assert(preferred.some(b => ['a'+i+'c','a'+i+'s','z'+i+'m','z'+i+'p'].every(id => b.includes(id))));
assert.equal(JSON.stringify({ snapshot, atomic }), before);
const reversed = { ...snapshot, nodes: [...snapshot.nodes].reverse(), edges: [...snapshot.edges].reverse().map(e => ({ ...e, from: e.to, to: e.from })) };
assert.deepEqual(functionalBlocks([...coherent].reverse(), reversed), preferred);
const missing = structuredClone(snapshot); delete missing.nodes.find(n => n.id === 'a1c')!.deviceRelation;
assert.equal(functionalBlocks(coherent, missing).length, 4, 'An unknown relationship must not be guessed');
const ambiguous = structuredClone(snapshot); ambiguous.nodes.find(n => n.id === 'a2c')!.deviceRelation = structuredClone(ambiguous.nodes.find(n => n.id === 'a1c')!.deviceRelation);
assert.deepEqual(functionalBlocks(coherent, ambiguous), coherent, 'Duplicate masters keep the finer partition');
const fixed = structuredClone(snapshot); fixed.nodes.find(n => n.id === 'z1m')!.fixed = true;
assert(!functionalBlocks(coherent, fixed).some(b => b.includes('a1c') && b.includes('z1m')));
const partial = coherent.map(b => b.filter(id => id !== 'z1m')).filter(b => b.length);
assert(!functionalBlocks(partial, snapshot).some(b => b.includes('a1c') && b.includes('z1p')), 'Partial circuits must not create a guessed unit');
const grouped = [['a1s','z2m'], ...atomic.filter(b => !['a1s','z2m'].includes(b[0]))];
assert(functionalBlocks(grouped, snapshot).some(b => b.includes('a1s') && b.includes('z2m')), 'Original explicit groups are indivisible');
assert.equal(partitionBins(preferred, 2, snapshot).length, 2);

// Measured symbols make two complete drive areas fit on two sheets, but not one.
const large = structuredClone(project);
large.symbolLibrary = [...new Set(large.pages[0].components.map(c => c.symbolId))].map(id => {
  const s = structuredClone(getSymbolById(id, large)!);
  const sx = 300 / s.width, sy = 180 / s.height;
  s.id = 'test-' + id; s.width = 300; s.height = 180;
  s.pins = s.pins.map(p => ({ ...p, x: p.x * sx, y: p.y * sy }));
  s.svgContent = '<rect width="300" height="180" fill="none" stroke="currentColor"/>';
  return s;
});
for (const c of large.pages[0].components) c.symbolId = 'test-' + c.symbolId;
const original = JSON.stringify(large), history = new ProjectHistory(); history.reset(large);
assert.equal((await previewLayout(large, 'p', {multiPage:false})).status, 'layout_invalid');
const preview = await previewLayout(large, 'p');
const candidate = preview.candidates.find(c => c.multiPage); assert(candidate?.multiPage, JSON.stringify(preview.issues));
assert.equal(candidate.multiPage.pages.length, 2);
assert.equal(candidate.multiPage.links.length, 0);
for (let i = 1; i <= 2; i++) assert(candidate.multiPage.pages.some(p => ['a'+i+'c','a'+i+'s','z'+i+'m','z'+i+'p'].every(id => p.components.some(c => c.id === id))), 'The actual checked result must keep each drive together');
assert.equal(JSON.stringify(large), original);
applyLayout(large, candidate); history.record(large);
assert.deepEqual(large.pages.flatMap(p => p.wires).map(w => [w.id,w.from,w.to]).sort(), project.pages[0].wires.map(w => [w.id,w.from,w.to]).sort());
assert.deepEqual(history.undo(), JSON.parse(original));
console.log('✓ Functional page units, real drive pairs, ambiguous/missing/fixed/partial guards, atomic groups, validated two-sheet layout, unchanged wires and undo');

// An oversized functional pair must release its preference and retain the finer search.
const oversized = JSON.parse(original) as typeof large;
for (const s of oversized.symbolLibrary!) { s.width *= 2; s.pins = s.pins.map(p => ({...p, x:p.x*2})); s.svgContent = '<rect width="600" height="180" fill="none" stroke="currentColor"/>'; }
const fallback = await multiPageCandidate(oversized, oversized, 'p', {});
assert(fallback?.multiPage?.pages.length, 'An oversized pair must not suppress the finer valid fallback');
assert(fallback.report.valid);
assert(fallback.multiPage.pages.some(p => p.components.some(c => c.id === 'a1c') !== p.components.some(c => c.id === 'z1p')), 'This fixture requires splitting the first functional pair');
console.log('✓ Oversized drive pairs retain the validated finer multi-page fallback');
