import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { PdfExporter } from '../export/PdfExporter';
import { fixture, add } from '../layout/testing/fixture';
import { CableRepairPlan } from './CableRepairs';
import { ArticleFunctionPlan } from './ArticleFunctions';
import { PotentialPlan, PotentialIndex } from './PotentialDefinitions';
import { manufacturerArticles } from './ManufacturerImport';
import { setArticleAssignment } from './ArticleAssignments';
import { ArticleEditPlan } from './ArticleEdit';
import { CrossReferenceEngine } from './CrossReferenceEngine';
import { referenceTargets } from './CrossReferenceNavigation';
import { ProjectHistory } from './ProjectHistory';
import { ProjectIndex } from './ProjectIndex';
import { getSymbolForComponent } from './symbols';
import { PartsListGenerator } from '../reports/PartsList';
import { inspectElectricalProject } from './ElectricalInspection';
const p = fixture(),
  a = add(p, 'a', 'terminal_single', 30, 10),
  b = add(p, 'b', 'terminal_single', 30, 110);
a.bmk = '-X1:1';
b.bmk = '-X1:2';
p.pages[0].wires = [
  {
    id: 'w',
    from: { componentId: a.id, pinId: '2' },
    to: { componentId: b.id, pinId: '1' },
    potential: 'Signal',
    waypoints: [],
  },
];
const sx =
  getSymbolForComponent(a, p)!.pins.find((pin) => pin.id === '2')!.x + a.x;
p.pages[0].cables = [
  {
    id: 'cable',
    bmk: '-W1',
    cableType: 'Test',
    coreCount: 2,
    crossSection: '1.5',
    start: { x: sx - 20, y: 90 },
    end: { x: sx + 20, y: 90 },
    cores: [{ id: 'core', t: 0.5, designation: '1' }],
  },
];
const repair = new CableRepairPlan(p),
  binding = repair.rows.find((r) => r.kind === 'bind')!;
assert(binding);
assert.equal(binding.evidence.method, 'drawing_intersection');
assert.deepEqual(binding.wireIds, ['w']);
assert.deepEqual(p.pages[0].cables![0].cores[0].wireIds, undefined);
const fixed = repair.apply(p, [binding.id]);
assert.deepEqual(fixed.pages[0].cables![0].cores[0].wireIds, ['w']);
assert.equal(
  fixed.pages[0].cables![0].cores[0].repairHistory![0].confirmed,
  true,
);
assert.deepEqual(fixed.pages[0].wires, p.pages[0].wires);
const reserved = repair.rows.find((r) => r.kind === 'reserve')!,
  addReserves = repair.rows.find((r) => r.kind === 'add_reserves')!,
  count = repair.rows.find((r) => r.kind === 'count')!;
assert.throws(() => repair.apply(p, [reserved.id]), /repairConfirmation/);
assert.throws(() => repair.apply(p, [count.id]), /repairConfirmation/);
assert.throws(
  () =>
    repair.apply(p, [count.id, addReserves.id], { reserve: true, count: true }),
  /repairExclusive/,
);
assert.throws(
  () => repair.apply(p, [binding.id, reserved.id], { reserve: true }),
  /repairExclusive/,
);
const reserveResult = repair.apply(p, [reserved.id, addReserves.id], {
  reserve: true,
});
assert.equal(reserveResult.pages[0].cables![0].cores.length, 2);
assert(reserveResult.pages[0].cables![0].cores.every((c) => c.reserve));
(binding as any).wireIds = ['not-authoritative'];
assert.deepEqual(
  repair.apply(p, [binding.id]).pages[0].cables![0].cores[0].wireIds,
  ['w'],
);
const ambiguous = structuredClone(p);
ambiguous.pages[0].cables![0].cores.push({ id: 'other', t: 0.5 });
assert(!new CableRepairPlan(ambiguous).rows.some((r) => r.kind === 'bind'));
const history = new ProjectHistory();
history.reset(p);
history.record(fixed);
assert.deepEqual(history.undo(), p);
assert.deepEqual(history.redo(), JSON.parse(JSON.stringify(fixed)));
const definition = {
  id: 'L',
  name: 'L1',
  plant: '',
  location: '',
  color: 'BK',
  crossSection: '2.5',
  anchors: [{ pageId: 'p', componentId: a.id, pinId: '2' }],
};
const saved = new PotentialPlan(p, { kind: 'save', definition }).apply(p);
assert.deepEqual(saved.pages, p.pages, 'Saving policy never edits conductors');
assert(
  new PotentialIndex(saved).findings.some(
    (i) => i.code === 'potential_policy_mismatch',
  ),
);
const fill = new PotentialPlan(saved, {
  kind: 'propagate',
  id: 'L',
  mode: 'fill',
}).apply(saved);
assert.equal(fill.pages[0].wires[0].potential, 'Signal');
assert.equal(fill.pages[0].wires[0].color, 'BK');
assert.equal(fill.pages[0].wires[0].crossSection, '2.5');
const replace = new PotentialPlan(saved, {
  kind: 'propagate',
  id: 'L',
  mode: 'replace',
});
assert.throws(() => replace.apply(saved), /repairConfirmation/);
replace.changes.length = 0;
assert.throws(
  () => replace.apply(saved),
  /repairConfirmation/,
  'Presentation DTO cannot bypass confirmation',
);
const propagated = replace.apply(saved, true);
assert.equal(propagated.pages[0].wires[0].potential, 'L1');
assert.equal(new PotentialIndex(propagated).findings.length, 0);
assert.deepEqual(
  propagated.pages[0].wires[0].waypoints,
  p.pages[0].wires[0].waypoints,
);
assert.throws(
  () =>
    new PotentialPlan(saved, {
      kind: 'save',
      definition: { ...definition, id: 'other', name: 'L2' },
    }),
  /potentialConflict/,
);
assert.throws(
  () =>
    new PotentialPlan(p, {
      kind: 'save',
      definition: {
        ...definition,
        anchors: [{ pageId: 'p', componentId: 'absent', pinId: '2' }],
      },
    }),
  /potentialConflict/,
);
const constrained = structuredClone(p);
constrained.pages[0].components[0].pins['2'].potentialConstraint = 'PE';
assert.throws(
  () => new PotentialPlan(constrained, { kind: 'save', definition }),
  /potentialConflict/,
);
assert(
  inspectElectricalProject(saved).messages.some(
    (m) => m.ruleId === 'potential_policy_mismatch',
  ),
);
const stale = structuredClone(p);
stale.pages[0].title = 'edited';
assert.throws(() => repair.apply(stale, [binding.id]), /articlesProjectStale/);
const articles = fixture(),
  coil = add(articles, 'coil', 'contactor_coil');
const address = { pageId: 'p', componentId: coil.id };
setArticleAssignment(coil, [
  {
    articleNumber: 'A',
    manufacturer: 'ACME',
    variant: '',
    quantity: 1,
    role: 'main',
    snapshot: {
      id: 'a',
      articleNumber: 'A',
      manufacturer: 'ACME',
      variant: '',
      description: 'Coil',
      origin: 'user',
      verification: 'unverified',
      functions: [{ id: 'coil-slot', type: 'relay_coil', pins: ['A1', 'A2'] }],
    },
  },
]);
const functions = new ArticleFunctionPlan(articles, [address]);
assert.equal(functions.rows[0].candidates.length, 1);
assert(functions.rows[0].candidates[0].unverified);
const mapped = functions.apply(articles, [
  { address, functionId: 'coil-slot' },
]);
assert.equal(mapped.pages[0].components[0].articleFunctionId, 'coil-slot');
assert.equal(
  mapped.pages[0].components[0].articleAssignment!.items[0].snapshot!
    .verification,
  'unverified',
);
assert.throws(
  () => functions.apply(articles, [{ address, functionId: 'not-found' }]),
  /functionNoCandidate/,
);
const unknown = structuredClone(articles);
unknown.symbolLibrary = [
  {
    ...structuredClone(getSymbolForComponent(coil, articles)!),
    functionDefinition: undefined,
    source: { library: 'CUSTOM', number: 1, variant: 0 },
  },
];
const unknownSuggestions = new ArticleFunctionPlan(unknown, [address]);
assert(unknownSuggestions.rows[0].candidates[0].needsTypeConfirmation);
assert.throws(
  () =>
    unknownSuggestions.apply(unknown, [{ address, functionId: 'coil-slot' }]),
  /repairConfirmation/,
);
assert.equal(
  unknownSuggestions.apply(
    unknown,
    [{ address, functionId: 'coil-slot' }],
    true,
  ).pages[0].components[0].articleFunctionEvidence?.method,
  'user_confirmed',
);
const xml = `<BMECAT><T_NEW_CATALOG><ARTICLE><SUPPLIER_AID>0001</SUPPLIER_AID><ARTICLE_DETAILS><MANUFACTURER_AID>M-001</MANUFACTURER_AID><MANUFACTURER_NAME>ACME</MANUFACTURER_NAME><DESCRIPTION_SHORT>Sample &amp; safe</DESCRIPTION_SHORT><MANUFACTURER_TYPE_DESCR>Type X</MANUFACTURER_TYPE_DESCR></ARTICLE_DETAILS><ARTICLE_FEATURES><FEATURE><FNAME>EF001</FNAME><FVALUE>2</FVALUE></FEATURE></ARTICLE_FEATURES></ARTICLE></T_NEW_CATALOG></BMECAT>`;
const imported = manufacturerArticles(xml);
assert.equal(imported.articles[0].articleNumber, 'M-001');
assert.equal(imported.articles[0].variant, '');
assert.equal(imported.articles[0].verification, 'unverified');
assert.equal(imported.articles[0].functions, undefined);
assert.equal(imported.withoutFunctions.length, 1);
assert(imported.articles[0].description.includes('EF001: 2'));
assert.throws(
  () =>
    manufacturerArticles(
      '<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + xml,
    ),
  /manufacturerInvalid/,
);
assert.throws(() => manufacturerArticles('<BMECAT><ARTICLE></BMECAT>'));
const devices = fixture(),
  main = add(devices, 'main', 'device_box'),
  contact = add(devices, 'contact', 'contact_no', 120, 80),
  stray = add(devices, 'stray', 'contactor_coil', 300, 70);
main.bmk = contact.bmk = stray.bmk = '-K1';
main.crossRef = 'original source';
const linked = new ArticleEditPlan(devices, {
  kind: 'link',
  targets: [
    { pageId: 'p', componentId: main.id },
    { pageId: 'p', componentId: contact.id },
  ],
  main: { pageId: 'p', componentId: main.id },
}).apply(devices);
const lm = linked.pages[0].components[0],
  lc = linked.pages[0].components[1];
assert.equal(
  new ProjectIndex(linked).mainReferencesFor(lc)[0].component.id,
  main.id,
);
assert.equal(CrossReferenceEngine.getContactMirror(lm, linked).length, 1);
assert.equal(referenceTargets(linked, lc)[0].componentId, main.id);
assert.equal(referenceTargets(linked, lm)[0].componentId, contact.id);
assert(
  !new ProjectIndex(linked)
    .referencesFor(lc)
    .some((e) => e.component.id === stray.id),
);
CrossReferenceEngine.updateProjectCrossReferences(linked);
CrossReferenceEngine.updateProjectCrossReferences(linked);
assert.equal(lm.deviceReference?.originalCrossRef, 'original source');
const unlinked = new ArticleEditPlan(linked, {
  kind: 'unlink',
  deviceIds: [linked.physicalDevices![0].id],
}).apply(linked);
assert.equal(unlinked.pages[0].components[0].crossRef, 'original source');
assert(!unlinked.pages[0].components[0].deviceReference);
const invalid = structuredClone(linked);
invalid.pages[0].components[1].bmk = '-OTHER';
CrossReferenceEngine.updateProjectCrossReferences(invalid);
assert.equal(invalid.pages[0].components[1].crossRef, '');
assert.equal(
  referenceTargets(invalid, invalid.pages[0].components[1]).length,
  0,
);
const noOriginal = fixture(),
  n1 = add(noOriginal, 'n1', 'contactor_coil'),
  n2 = add(noOriginal, 'n2', 'contact_no');
n1.bmk = n2.bmk = '-K';
const nl = new ArticleEditPlan(noOriginal, {
  kind: 'link',
  targets: [
    { pageId: 'p', componentId: n1.id },
    { pageId: 'p', componentId: n2.id },
  ],
  main: { pageId: 'p', componentId: n1.id },
}).apply(noOriginal);
CrossReferenceEngine.updateProjectCrossReferences(nl);
const nu = new ArticleEditPlan(nl, {
  kind: 'unlink',
  deviceIds: [nl.physicalDevices![0].id],
}).apply(nl);
assert.equal(nu.pages[0].components[0].crossRef, undefined);
assert.deepEqual(
  PartsListGenerator.generatePartsList(mapped),
  PartsListGenerator.generatePartsList(articles),
);
// Stable addresses distinguish contacts even when printed sheet/column labels coincide.
const multi = fixture(),
  mm = add(multi, 'mm', 'device_box'),
  mc1 = add(multi, 'mc1', 'device_box', 120, 80),
  mc2 = add(multi, 'mc2', 'contact_no', 120, 80);
mm.bmk = mc1.bmk = mc2.bmk = '-K7';
mc1.articleFunctionType = 'contact_nc';
const second = structuredClone(multi.pages[0]),
  third = structuredClone(multi.pages[0]);
second.id = 'second';
third.id = 'third';
second.pageNumber = third.pageNumber = '2';
second.components = [mc1];
third.components = [mc2];
multi.pages[0].components = [mm];
multi.pages.push(second, third);
const multiLinked = new ArticleEditPlan(multi, {
  kind: 'link',
  targets: [
    { pageId: 'p', componentId: mm.id },
    { pageId: 'second', componentId: mc1.id },
    { pageId: 'third', componentId: mc2.id },
  ],
  main: { pageId: 'p', componentId: mm.id },
}).apply(multi);
assert.deepEqual(
  referenceTargets(multiLinked, multiLinked.pages[0].components[0]).map((t) => [
    t.pageId,
    t.componentId,
  ]),
  [
    ['second', 'mc1'],
    ['third', 'mc2'],
  ],
);
assert.deepEqual(
  CrossReferenceEngine.getContactMirror(
    multiLinked.pages[0].components[0],
    multiLinked,
  ).map((t) => [t.type, t.targetPageId]),
  [
    ['NC', 'second'],
    ['NO', 'third'],
  ],
);
const mirrorUnknown = structuredClone(multiLinked);
mirrorUnknown.pages[1].components[0].articleFunctionType = 'constructor';
assert.equal(
  CrossReferenceEngine.getContactMirror(
    mirrorUnknown.pages[0].components[0],
    mirrorUnknown,
  ).length,
  1,
);
function pdfTargets(project: typeof multiLinked) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' }),
    links: number[] = [];
  doc.link = ((
    _x: number,
    _y: number,
    _w: number,
    _h: number,
    options: { pageNumber: number },
  ) => {
    links.push(options.pageNumber);
    return doc;
  }) as typeof doc.link;
  (PdfExporter as any).renderComponents(
    doc,
    project.pages[0],
    project,
    420,
    297,
    { colorMode: 'color', interactiveCrossReferences: true },
    new Map([
      ['1', 1],
      ['2', 3],
    ]),
    new Map([
      ['p', 1],
      ['second', 2],
      ['third', 3],
    ]),
  );
  return links;
}
assert.deepEqual(pdfTargets(multiLinked), [2, 3]);
const brokenReference = structuredClone(multiLinked);
brokenReference.pages[0].components[0].crossRef = '/999.0';
assert.deepEqual(
  pdfTargets(brokenReference),
  [],
  'Do not link an unresolved registered reference to an unrelated same-BMK page',
);
const invalidMulti = structuredClone(multiLinked);
invalidMulti.pages[1].components[0].bmk = '-OTHER';
assert.deepEqual(
  pdfTargets(invalidMulti),
  [],
  'An invalid device record blocks PDF heuristic fallbacks',
);
console.log(
  '✓ Evidence-based cable repair, confirmations/undo/stale guards, manufacturer import without invented functions, exact slot proposals, authoritative device references and controlled potential propagation',
);
