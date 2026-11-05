import assert from 'node:assert/strict';
import type { PlacedComponent } from '../model/types';
import { fixture, add } from './testing/fixture';
import { previewLayout, applyLayout } from './service';
import { handleCreateDraft } from './tools';
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
assert.equal(candidate.report.metrics.bends, 0, 'Vertical sheet transitions follow the original device axes without side detours');
for (const link of candidate.multiPage.links) {
  const devices: PlacedComponent[] = candidate.multiPage.pages.flatMap(p => p.components);
  assert.equal(devices.find(c => c.id === link.fromArrowId)!.symbolId, 'potential_arrow_down');
  assert.equal(devices.find(c => c.id === link.toArrowId)!.symbolId, 'potential_arrow_up');
}
for (const change of ['symbol', 'rotation']) {
  const altered = clone(candidate);
  const arrow = altered.multiPage!.pages.flatMap(p => p.components).find(c => c.id === altered.multiPage!.links[0].fromArrowId)!;
  if (change === 'symbol') arrow.symbolId = 'potential_arrow_right'; else arrow.rotation = 180;
  assert.throws(() => applyLayout(project, altered), /Abbruchstelle verändert/);
  assert.equal(JSON.stringify(project), before);
}
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
// Existing duplicate sheet numbers must not abort the entire proposal. The
// proposed first sheet receives a free number too, not only the extra sheets.
const duplicateNumbers=JSON.parse(before),occupied=clone(duplicateNumbers.pages[0]);
occupied.id='occupied-number';occupied.components=[];occupied.wires=[];occupied.groups=[];duplicateNumbers.pages.push(occupied);
const numbered=await previewLayout(duplicateNumbers,'p');assert.equal(numbered.status,'preview_ready');
assert(numbered.candidates[0].multiPage);assert.notEqual(numbered.candidates[0].multiPage!.pages[0].pageNumber,occupied.pageNumber);
applyLayout(duplicateNumbers,numbered.candidates[0]);assert.equal(new Set(duplicateNumbers.pages.map((p:any)=>p.pageNumber)).size,duplicateNumbers.pages.length);
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

// Large distribution board with 2 RCDs, main switch, SPD, RCBO, 16 MCBs and feed terminals
const largeDistributionProject = fixture(); largeDistributionProject.pages[0].plotFrame.width = 1000; largeDistributionProject.pages[0].plotFrame.height = 700;
const distDraftArgs = {
  pageId: 'p',
  components: [
    { id: 'X1', symbolId: 'terminal_single', bmk: '-X1' },
    { id: 'X2', symbolId: 'terminal_single', bmk: '-X1' },
    { id: 'X3', symbolId: 'terminal_single', bmk: '-X1' },
    { id: 'X4', symbolId: 'terminal_single', bmk: '-X1' },
    { id: 'X5', symbolId: 'terminal_pe', bmk: '-X2' },
    { id: 'Q1', symbolId: 'main_switch_4p', bmk: '-Q1' },
    { id: 'F1', symbolId: 'catalog_spd_type_1_2_4p', bmk: '-F1' },
    { id: 'F2', symbolId: 'catalog_rcd_4p_a_30', bmk: '-F2' },
    ...Array.from({ length: 8 }, (_, i) => ({ id: `F_A_${i}`, symbolId: 'catalog_mcb_1p_n_b', bmk: `-F${i + 3}` })),
    { id: 'F11', symbolId: 'catalog_rcd_4p_a_30', bmk: '-F11' },
    ...Array.from({ length: 8 }, (_, i) => ({ id: `F_B_${i}`, symbolId: 'catalog_mcb_1p_b', bmk: `-F${i + 12}` })),
    { id: 'F20', symbolId: 'catalog_rcbo_1te_b', bmk: '-F20' },
  ],
  connections: [
    { id: 'w_in_1', from: { componentId: 'X1', pinId: '2' }, to: { componentId: 'Q1', pinId: '1' }, potential: 'L1' },
    { id: 'w_in_2', from: { componentId: 'X2', pinId: '2' }, to: { componentId: 'Q1', pinId: '3' }, potential: 'L2' },
    { id: 'w_in_3', from: { componentId: 'X3', pinId: '2' }, to: { componentId: 'Q1', pinId: '5' }, potential: 'L3' },
    { id: 'w_in_4', from: { componentId: 'X4', pinId: '2' }, to: { componentId: 'Q1', pinId: '7' }, potential: 'N' },
    { id: 'w_spd_1', from: { componentId: 'Q1', pinId: '2' }, to: { componentId: 'F1', pinId: 'L1' }, potential: 'L1' },
    { id: 'w_spd_2', from: { componentId: 'Q1', pinId: '4' }, to: { componentId: 'F1', pinId: 'L2' }, potential: 'L2' },
    { id: 'w_spd_3', from: { componentId: 'Q1', pinId: '6' }, to: { componentId: 'F1', pinId: 'L3' }, potential: 'L3' },
    { id: 'w_spd_4', from: { componentId: 'Q1', pinId: '8' }, to: { componentId: 'F1', pinId: 'N' }, potential: 'N' },
    { id: 'w_spd_pe', from: { componentId: 'X5', pinId: '2' }, to: { componentId: 'F1', pinId: 'PE' }, potential: 'PE' },
    { id: 'w_rcd1_1', from: { componentId: 'Q1', pinId: '2' }, to: { componentId: 'F2', pinId: '1' }, potential: 'L1' },
    { id: 'w_rcd1_2', from: { componentId: 'Q1', pinId: '4' }, to: { componentId: 'F2', pinId: '3' }, potential: 'L2' },
    { id: 'w_rcd1_3', from: { componentId: 'Q1', pinId: '6' }, to: { componentId: 'F2', pinId: '5' }, potential: 'L3' },
    { id: 'w_rcd1_4', from: { componentId: 'Q1', pinId: '8' }, to: { componentId: 'F2', pinId: 'N-in' }, potential: 'N' },
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `w_mcb1_${i}`,
      from: { componentId: 'F2', pinId: String((i % 3) * 2 + 2) },
      to: { componentId: `F_A_${i}`, pinId: '1' },
      potential: `L${(i % 3) + 1}`,
    })),
    { id: 'w_rcd2_1', from: { componentId: 'Q1', pinId: '2' }, to: { componentId: 'F11', pinId: '1' }, potential: 'L1' },
    { id: 'w_rcd2_2', from: { componentId: 'Q1', pinId: '4' }, to: { componentId: 'F11', pinId: '3' }, potential: 'L2' },
    { id: 'w_rcd2_3', from: { componentId: 'Q1', pinId: '6' }, to: { componentId: 'F11', pinId: '5' }, potential: 'L3' },
    { id: 'w_rcd2_4', from: { componentId: 'Q1', pinId: '8' }, to: { componentId: 'F11', pinId: 'N-in' }, potential: 'N' },
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `w_mcb2_${i}`,
      from: { componentId: 'F11', pinId: String((i % 3) * 2 + 2) },
      to: { componentId: `F_B_${i}`, pinId: '1' },
      potential: `L${(i % 3) + 1}`,
    })),
    { id: 'w_rcbo_1', from: { componentId: 'Q1', pinId: '2' }, to: { componentId: 'F20', pinId: '1' }, potential: 'L1' },
    { id: 'w_rcbo_n', from: { componentId: 'Q1', pinId: '8' }, to: { componentId: 'F20', pinId: 'N-in' }, potential: 'N' },
  ],
  groups: [
    { id: 'g_in', name: 'Einspeisung', members: ['X1', 'X2', 'X3', 'X4', 'Q1'] },
    { id: 'g_spd', name: 'Überspannungsschutz', members: ['X5', 'F1'] },
    { id: 'g_rcd1', name: 'FI-Gruppe 1', members: ['F2', ...Array.from({ length: 4 }, (_, i) => `F_A_${i}`)] },
    { id: 'g_rcd2', name: 'FI-Gruppe 2', members: ['F11', ...Array.from({ length: 4 }, (_, i) => `F_B_${i}`), 'F20'] },
  ],
};
const managerMock: any = {
  getProject: () => largeDistributionProject,
  getActivePage: () => largeDistributionProject.pages[0],
  showLayoutPreview: () => {},
};
const draftRes = await handleCreateDraft(distDraftArgs, managerMock);
assert.equal(draftRes.success, true);
assert.equal(draftRes.status, 'preview_ready');
assert.equal(draftRes.layoutPreparation?.status, 'applied');
assert(draftRes.candidates.length >= 1);
assert.equal(draftRes.candidates[0].routedConnections, 0);
assert(draftRes.candidates[0].autoconnectConnections > 0);
console.log('✓ Multi-page verified autoconnect sub-distribution with 26 devices, multiple RCDs and MCBs');

// Test fast-fail when calling create_schematic_draft on an already populated page (existing_content)
const populatedProject = fixture();
populatedProject.pages[0].plotFrame.width = 1000;
populatedProject.pages[0].plotFrame.height = 700;
add(populatedProject, 'existing_F1', 'contactor_coil', 100, 100);
const populatedManagerMock: any = {
  getProject: () => populatedProject,
  getActivePage: () => populatedProject.pages[0],
  showLayoutPreview: () => {},
};
const t0Pop = Date.now();
const popRes = await handleCreateDraft(distDraftArgs, populatedManagerMock);
const popElapsed = Date.now() - t0Pop;
assert.equal(popRes.success, false);
assert.equal(popRes.status, 'layout_invalid');
assert.equal(popRes.layoutPreparation?.code, 'existing_content');
assert(popElapsed < 5000, `Expected fast rejection on existing_content, took ${popElapsed}ms`);
console.log('✓ Fast-fail verified when calling create_schematic_draft on a populated page');

// Large terminal groups must be kept whole, allowing a checked multi-sheet result.
const splitTestProject = fixture();
const oversizedDraftArgs = {
  preferAutoconnect: true,
  components: [
    ...Array.from({ length: 12 }, (_, i) => ({ id: `MCB_A_${i}`, symbolId: 'circuit_breaker_1p', bmk: `-QA${i+1}`, functionText: `Oversized Branch Circuit ${i+1}` })),
    ...Array.from({ length: 12 }, (_, i) => ({ id: `MCB_B_${i}`, symbolId: 'circuit_breaker_1p', bmk: `-QB${i+1}`, functionText: `Oversized Branch Circuit ${i+1}` })),
    ...Array.from({ length: 16 }, (_, i) => ({ id: `X2_${i}`, symbolId: 'terminal_single', bmk: `-X2:${i+1}` })),
  ],
  connections: [
    ...Array.from({ length: 12 }, (_, i) => ({ id: `w_a_${i}`, from: { componentId: `MCB_A_${i}`, pinId: '2' }, to: { componentId: `X2_${i}`, pinId: '1' }, potential: 'L1' })),
  ],
  groups: [
    { id: 'g_mcb_a', name: 'MCB Group A', members: Array.from({ length: 12 }, (_, i) => `MCB_A_${i}`) },
    { id: 'g_mcb_b', name: 'MCB Group B', members: Array.from({ length: 12 }, (_, i) => `MCB_B_${i}`) },
    { id: 'g_terminals', name: 'Large Terminal Strip', members: Array.from({ length: 16 }, (_, i) => `X2_${i}`) },
  ],
};
let oversizedShown: any;
const oversizedManagerMock: any = {
  getProject: () => splitTestProject,
  getActivePage: () => splitTestProject.pages[0],
  showLayoutPreview: (preview:any,draft:any) => {oversizedShown={preview,draft};},
};
const overRes = await handleCreateDraft(oversizedDraftArgs, oversizedManagerMock);
assert.equal(overRes.status,'preview_ready');
const oversizedCandidate=oversizedShown.preview.candidates[0];
assert(oversizedCandidate.multiPage.pages.length>1);
assert(oversizedCandidate.multiPage.pages.every((page:any)=>!snapshotPage(page,oversizedShown.draft).issues.some((issue:any)=>issue.type==='missing_group_member')));
applyLayout(splitTestProject,oversizedCandidate,oversizedShown.draft);
const stripPages=splitTestProject.pages.filter(p=>p.components.some(c=>c.id.startsWith('ai-X2_')));
const terminals=stripPages.flatMap(p=>p.components.filter(c=>c.id.startsWith('ai-X2_')));
assert.equal(terminals.length,16);assert.equal(new Set(terminals.map(c=>c.id)).size,16);
const memberships=stripPages.flatMap(p=>(p.groups??[]).filter(g=>g.id==='ai-g_terminals'||g.layoutOriginId==='ai-g_terminals').flatMap(g=>g.members.filter(m=>m.id.startsWith('ai-X2_'))));
assert.equal(memberships.length,16);assert.equal(new Set(memberships.map(m=>m.id)).size,16);
console.log('✓ AI terminal planning groups retain all members across audited sheet-local fragments');


