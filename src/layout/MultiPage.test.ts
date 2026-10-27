import assert from 'node:assert/strict';
import { fixture, add } from './testing/fixture';
import { previewLayout, applyLayout } from './service';
import { snapshotPage } from './geometry';
import { clone } from './types';
import { referenceTargets } from '../model/CrossReferenceNavigation';
import { ProjectHistory } from '../model/ProjectHistory';
const project = fixture();
project.symbolLibrary = [
  {
    id: 'large',
    name: 'Large module',
    description: 'Multi-page layout fixture',
    category: 'supply',
    standard: '',
    defaultBmkPrefix: 'T',
    defaultFunctionText: '',
    width: 400,
    height: 280,
    svgContent: '<rect width="400" height="280"/>',
    pins: [
      { id: 'in', name: '1', x: 200, y: 0, direction: 'top' },
      { id: 'out', name: '2', x: 200, y: 280, direction: 'bottom' },
    ],
  },
];
const page = project.pages[0];
for (let i = 0; i < 3; i++) {
  page.components.push({
    id: `c${i}`,
    symbolId: 'large',
    bmk: `-T${i}`,
    functionText: 'Module',
    x: 0,
    y: 0,
    rotation: 0,
    pins: { in: { wireIds: [] }, out: { wireIds: [] } },
  });
  (page.groups ??= []).push({
    id: `g${i}`,
    members: [{ kind: 'component', id: `c${i}` }],
  });
  if (i)
    page.wires.push({
      id: `w${i}`,
      from: { componentId: `c${i - 1}`, pinId: 'out' },
      to: { componentId: `c${i}`, pinId: 'in' },
      potential: 'L1',
    });
}
const before = JSON.stringify(project);
const single = await previewLayout(project, 'p', { multiPage: false });
assert.equal(single.status, 'layout_invalid');
const preview = await previewLayout(project, 'p');
assert.equal(preview.status, 'preview_ready');
const candidate = preview.candidates[0];
assert(candidate.multiPage);
assert.equal(candidate.multiPage.pages.length, 3);
assert.equal(candidate.multiPage.links.length, 2);
assert.equal(JSON.stringify(project), before);
const tampered = clone(candidate);
tampered.multiPage!.pages[0].wires[0].potential = 'wrong';
assert.throws(() => applyLayout(project, tampered));
assert.equal(JSON.stringify(project), before);
const history = new ProjectHistory();
history.reset(project);
applyLayout(project, candidate);
history.record(project);
assert.equal(project.pages.length, 3);
assert.equal(project.pages.flatMap((p) => p.components).length, 7);
assert.equal(project.logicalConnections?.length, 2);
for (const link of candidate.multiPage.links) {
  const arrow = project.pages
    .flatMap((p) => p.components)
    .find((c) => c.id === link.fromArrowId)!;
  assert(
    referenceTargets(project, arrow).some(
      (t) => t.componentId === link.toArrowId,
    ),
  );
}
assert.deepEqual(history.undo(), JSON.parse(before));
assert.equal(history.redo()?.pages.length, 3);
const locked = JSON.parse(before);
const fail = await previewLayout(locked, 'p', { lockedIds: ['c0'] });
assert.equal(fail.status, 'layout_invalid');
assert(!fail.candidates.some((c) => c.multiPage));
console.log(
  '✓ Automatic checked three-sheet fallback, paired references, unchanged source, tamper rejection and one-step undo/redo',
);

const junctions = fixture();
add(junctions, 'corner', 'corner_top_right');
add(junctions, 'junction', 'cross_junction');
add(junctions, 'bridge', 'cross_bridge');
const geometry = snapshotPage(junctions.pages[0], junctions);
assert(geometry.nodes.find((n) => n.id === 'corner')!.joinedPins?.[0].length);
assert(geometry.nodes.find((n) => n.id === 'junction')!.joinedPins?.[0].length);
assert.equal(
  geometry.nodes.find((n) => n.id === 'bridge')!.joinedPins,
  undefined,
  'A crossing bridge must not join its circuits',
);

// Loading a coordinate-free draft materializes its library frames as device boxes.
// Overlapping zero coordinates must not infer containment across unrelated groups.
const framed = fixture();
framed.symbolLibrary = [{ ...clone(project.symbolLibrary![0]), id: 'frame', deviceBox: true, width: 120, height: 40, pins: [] }];
for (let i=0;i<2;i++) {
  const box = add(framed, `frame${i}`, 'frame', 0, 0);
  box.deviceBox = { width: 120, height: 40, lineStyle: 'solid', lineWidth: 1.2 };
  add(framed, `coil${i}`, 'contactor_coil', 0, 0);
  (framed.pages[0].groups ??= []).push({ id: `framed-group-${i}`, members: [{kind:'component',id:box.id},{kind:'component',id:`coil${i}`}] });
}
const framedBefore = JSON.stringify(framed);
const framedPreview = await previewLayout(framed,'p');
assert.equal(framedPreview.status,'preview_ready');
assert.equal(JSON.stringify(framed),framedBefore);
assert.equal(framedPreview.candidates[0].page.layoutConstraints?.fixedFrameIds?.length,2);
applyLayout(framed,framedPreview.candidates[0]);
assert(framed.pages[0].components.filter(c=>c.deviceBox).every(c=>c.deviceBox!.width===120&&c.deviceBox!.height===40));
