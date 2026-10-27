import assert from 'node:assert/strict';
import { fixture, add } from './testing/fixture';
import { previewLayout, applyLayout } from './service';
import { CrossReferenceEngine } from '../model/CrossReferenceEngine';
import { topology, clone } from './types';
const project = fixture();
const generator = add(project, 'generic', 'generator_dc');
generator.bmk = '-G1';
const source = clone(project.pages[0]);
source.id = 'native-page'; source.pageNumber = '2'; source.components = [];
for (let i = 0; i < 36; i++) {
  source.components.push({ ...clone(generator), id: `native-part-${i}`, source: { format: 'NATIVE_CAD', objectType: 17, objectId: i }, crossRef: '/source.1' });
}
project.pages.push(source);
const original = JSON.stringify(project), net = topology(project);
const probe = clone(project);
CrossReferenceEngine.updateProjectCrossReferences(probe);
assert.equal(probe.pages[0].components[0].crossRef, undefined, 'Unresolved native parts must not become dozens of invented references');
assert(probe.pages[1].components.every(c => c.crossRef === '/source.1'), 'Explicit source references must survive mixed native/generic groups');
const preview = await previewLayout(project, 'p');
assert.equal(preview.status, 'preview_ready');
assert.equal(JSON.stringify(project), original, 'Preview must not mutate any source page');
applyLayout(project, preview.candidates[0]);
assert.equal(topology(project), net);
assert.deepEqual(project.pages[1], source, 'Unrelated native page and its reference text must remain intact');

// Real generic cross-references must be measured before packing, not introduced afterwards.
const generic = fixture();
const a = add(generic, 'a', 'generator_dc'); a.bmk = '-G2';
const other = clone(generic.pages[0]); other.id = 'other'; other.pageNumber = '3'; other.components[0].id = 'other-g';
generic.pages.push(other);
const genericOriginal = JSON.stringify(generic);
const ready = await previewLayout(generic, 'p');
assert.equal(ready.status, 'preview_ready');
assert.equal(ready.candidates[0].page.components[0].crossRef, '/3.0');
assert.equal(JSON.stringify(generic), genericOriginal);
const manyReferences = clone(generic);
manyReferences.pages[1].components = Array.from({ length: 100 }, (_, i) => ({ ...clone(a), id: `representation-${i}` }));
const noRoom = await previewLayout(manyReferences, 'p');
assert.equal(noRoom.status, 'layout_invalid');
assert(noRoom.issues.some(i => i.type === 'sheet_capacity'), 'Oversized generated references must be detected before placement, not introduced in final validation');
assert(!noRoom.issues.some(i => i.type === 'sheet_overflow' || i.type === 'wire_obstacle'));
console.log('✓ Mixed native/generic references preserve source data; generated labels exist before layout and survive apply');
