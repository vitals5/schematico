import assert from 'node:assert/strict';
import { fixture, add } from '../layout/testing/fixture';
import {
  setArticleAssignment,
  effectiveArticles,
  validateAssignments,
} from './ArticleAssignments';
import { ArticleEditPlan } from './ArticleEdit';
import {
  DeviceRegistry,
  componentAddress,
  linkPhysicalDevice,
} from './DeviceRegistry';
import { articleCompatibility } from './ArticleCompatibility';
import { jsPDF } from 'jspdf';
import { layoutPartsListPdf } from '../export/PartsListPdf';
import { PartsListGenerator, partQuantityLabel } from '../reports/PartsList';
import { inspectElectricalProject } from './ElectricalInspection';
import { ProjectHistory } from './ProjectHistory';
import type { AssignedArticle, CatalogArticle } from './ArticleTypes';
import { getSymbolForComponent } from './symbols';
const p = fixture(),
  c = add(p, 'a', 'contactor_coil'),
  d = add(p, 'b', 'contactor_coil', 100, 100);
c.bmk = d.bmk = '-K1';
const ca = componentAddress(p.pages[0], c),
  da = componentAddress(p.pages[0], d);
const sym = getSymbolForComponent(c, p)!;
const catalog: CatalogArticle = {
  id: 'local',
  articleNumber: 'TEST',
  manufacturer: 'ACME',
  variant: 'V1',
  description: 'Main\nTest',
  origin: 'user',
  verification: 'user_checked',
  functions: [
    { id: 'coil', type: 'coil', pins: sym.pins.map((pin) => pin.name) },
  ],
};
const main: AssignedArticle = {
    articleNumber: 'TEST',
    manufacturer: 'ACME',
    variant: 'V1',
    quantity: 1,
    role: 'main',
    snapshot: catalog,
  },
  extra: AssignedArticle = {
    articleNumber: 'BASE',
    manufacturer: 'ACME',
    variant: '',
    quantity: 0,
    role: 'accessory',
  };
c.articleReferences = [
  {
    sourceId: 1,
    ownerId: 1,
    ownerType: 17,
    articleNumber: 'SOURCE',
    variant: '',
    quantity: 3,
  },
];
c.articleNumber = 'SOURCE';
c.articleImport = {
  source: 'native_project',
  status: 'record_read',
  observedArticleNumber: 'SOURCE',
};
const before = structuredClone(p),
  edit = new ArticleEditPlan(p, {
    kind: 'assign',
    targets: [ca, da],
    items: [main, extra],
  });
assert.deepEqual(p, before);
const assigned = edit.apply(p);
assert.equal(
  assigned.pages[0].components[0].articleReferences![0].articleNumber,
  'SOURCE',
);
assert.equal(
  assigned.pages[0].components[0].articleImport?.observedArticleNumber,
  'SOURCE',
);
assert.equal(
  PartsListGenerator.generatePartsList(assigned).find(
    (a) => a.articleNumber === 'TEST',
  )!.quantity,
  2,
);
assert.equal(
  PartsListGenerator.generatePartsList(assigned).find(
    (a) => a.articleNumber === 'BASE',
  )!.quantity,
  0,
);
const history = new ProjectHistory();
history.reset(p);
history.record(assigned);
assert.deepEqual(history.undo(), p);
assert.deepEqual(history.redo(), assigned);
const a = assigned.pages[0].components[0],
  b = assigned.pages[0].components[1];
a.articleFunctionId = b.articleFunctionId = 'coil';
a.articleFunctionType = b.articleFunctionType = 'coil';
assert.equal(articleCompatibility(assigned, ca).status, 'compatible');
const linkedPreview = new ArticleEditPlan(assigned, {
    kind: 'link',
    targets: [ca, da],
    main: ca,
  }),
  linked = linkedPreview.apply(assigned),
  registry = new DeviceRegistry(linked);
assert.equal(registry.valid.size, 1);
assert.equal(registry.issues.length, 0);
assert.equal(
  PartsListGenerator.generatePartsList(linked).find(
    (a) => a.articleNumber === 'TEST',
  )!.quantity,
  1,
);
assert.equal(
  PartsListGenerator.generatePartsList(linked).find(
    (a) => a.articleNumber === 'TEST',
  )!.quantityBasis,
  'verified_device',
);
assert(
  !inspectElectricalProject(linked).messages.some(
    (m) => m.ruleId === 'duplicate_master',
  ),
);
const unlinked = new ArticleEditPlan(linked, {
  kind: 'unlink',
  deviceIds: [linked.physicalDevices![0].id],
}).apply(linked);
assert.equal(
  PartsListGenerator.generatePartsList(unlinked).find(
    (a) => a.articleNumber === 'TEST',
  )!.quantity,
  2,
);
assert.throws(
  () =>
    new ArticleEditPlan(linked, {
      kind: 'assign',
      targets: [da],
      items: [{ ...main, articleNumber: 'OTHER' }],
    }),
  /articlesDeviceConflict/,
);
assert.throws(
  () => linkPhysicalDevice(linked, [ca, da], ca),
  /articlesDeviceOverlap/,
);
const otherScope = structuredClone(assigned);
otherScope.pages[0].components[1].mountingLocation = '+OTHER';
assert.throws(
  () => linkPhysicalDevice(otherScope, [ca, da], ca),
  /articlesDeviceInvalid/,
);
assert.equal(
  PartsListGenerator.generatePartsList(otherScope).find(
    (a) => a.articleNumber === 'TEST',
  )!.quantity,
  2,
  'Same BMK and part in different locations never deduplicate',
);
const wrong = structuredClone(linked);
wrong.pages[0].components[1].bmk = '-K2';
assert(
  new DeviceRegistry(wrong).issues.some(
    (i) => i.code === 'different_designation',
  ),
);
assert(
  inspectElectricalProject(wrong).messages.some(
    (m) => m.ruleId === 'invalid_physical_device',
  ),
);
assert.equal(
  PartsListGenerator.generatePartsList(wrong).find(
    (a) => a.articleNumber === 'TEST',
  )!.quantity,
  2,
);
assert(
  PartsListGenerator.generatePartsList(wrong).find(
    (a) => a.articleNumber === 'TEST',
  )!.deviceCountUncertain,
);
assert.equal(
  partQuantityLabel(
    PartsListGenerator.generatePartsList(wrong).find(
      (a) => a.articleNumber === 'TEST',
    )!,
  ),
  '~2x',
);
const noAux = structuredClone(assigned);
setArticleAssignment(noAux.pages[0].components[1], []);
linkPhysicalDevice(noAux, [ca, da], ca);
assert(
  !inspectElectricalProject(noAux).messages.some(
    (m) => m.componentId === d.id && m.ruleId === 'missing_article',
  ),
);
const noData = structuredClone(assigned);
noData.pages[0].components[0].articleAssignment!.items[0].snapshot!.functions =
  undefined;
assert.equal(articleCompatibility(noData, ca).status, 'unknown');
assert(
  inspectElectricalProject(noData).messages.some(
    (m) => m.componentId === c.id && m.ruleId === 'article_spec_unknown',
  ),
);
const incompatible = structuredClone(assigned);
incompatible.pages[0].components[0].articleAssignment!.items[0].snapshot!.functions![0].pins =
  ['WRONG'];
assert.equal(articleCompatibility(incompatible, ca).status, 'incompatible');
assert(
  inspectElectricalProject(incompatible).messages.some(
    (m) => m.componentId === c.id && m.ruleId === 'article_incompatible',
  ),
);
const unknownType = structuredClone(assigned);
delete unknownType.pages[0].components[0].articleFunctionType;
assert.equal(articleCompatibility(unknownType, ca).status, 'unknown');
const unknownVerified = structuredClone(assigned);
unknownVerified.pages[0].components[0].articleAssignment!.items[0].snapshot!.verification =
  'unverified';
assert.equal(articleCompatibility(unknownVerified, ca).status, 'unknown');
const multiple = structuredClone(assigned);
multiple.pages[0].components[0].articleAssignment!.items[0].snapshot!.functions!.push(
  { id: 'extra-coil', type: 'coil', pins: sym.pins.map((pin) => pin.name) },
);
delete multiple.pages[0].components[0].articleFunctionId;
assert.equal(articleCompatibility(multiple, ca).status, 'unknown');
const empty = new ArticleEditPlan(assigned, {
  kind: 'assign',
  targets: [ca],
  items: [],
}).apply(assigned);
assert.equal(effectiveArticles(empty.pages[0].components[0], empty).length, 0);
assert.equal(empty.pages[0].components[0].articleNumber, '');
assert.equal(
  empty.pages[0].components[0].articleReferences![0].articleNumber,
  'SOURCE',
);
const legacyOverride = structuredClone(assigned);
legacyOverride.pages[0].components[0].articleNumber = '';
assert.equal(
  effectiveArticles(legacyOverride.pages[0].components[0]).length,
  0,
  'Clearing scalar cannot reactivate accessories',
);
const tamper = new ArticleEditPlan(p, {
  kind: 'assign',
  targets: [ca],
  items: [main],
});
tamper.changes[0].after[0].articleNumber = 'TAMPER';
assert.equal(tamper.apply(p).pages[0].components[0].articleNumber, 'TEST');
const stale = structuredClone(p);
stale.pages[0].components[0].x++;
assert.throws(() => edit.apply(stale), /articlesProjectStale/);
assert.throws(
  () =>
    new ArticleEditPlan(p, {
      kind: 'assign',
      targets: [ca, ca],
      items: [main],
    }),
  /articlesSelectionInvalid/,
);
assert.throws(
  () => validateAssignments([{ ...main, quantity: -1 }]),
  /articlesInvalid/,
);
assert.throws(
  () => validateAssignments([{ ...main, quantity: NaN }]),
  /articlesInvalid/,
);
assert.throws(() => validateAssignments([main, main]), /articlesInvalid/);
const reloaded = JSON.parse(JSON.stringify(linked));
assert.deepEqual(
  PartsListGenerator.generatePartsList(reloaded),
  PartsListGenerator.generatePartsList(linked),
  'Project snapshots alone reproduce BOM without catalog access',
);
const geometry = (x: typeof p) =>
  JSON.stringify(
    x.pages.map((page) => ({
      wires: page.wires,
      components: page.components.map((c) => ({
        id: c.id,
        symbolId: c.symbolId,
        x: c.x,
        y: c.y,
        rotation: c.rotation,
        pins: c.pins,
        functionText: c.functionText,
      })),
    })),
  );
assert.equal(geometry(assigned), geometry(p));
console.log(
  '✓ Manual main/accessory assignment, source preservation, device ownership, scope/conflict guards, compatibility, portable snapshots, stale edits and BOM undo/redo',
);

const pdfRows = layoutPartsListPdf(
  new jsPDF(),
  PartsListGenerator.generatePartsList(linked),
  297,
).flat();
assert(
  pdfRows.some(
    (r) => r.cells[0].join('') === '1x' && r.cells[1].join('').includes('TEST'),
  ),
);
assert(
  pdfRows.some(
    (r) => r.cells[0].join('') === '0x' && r.cells[1].join('').includes('BASE'),
  ),
);
const across = structuredClone(assigned),
  second = structuredClone(across.pages[0]);
second.id = 'second';
second.pageNumber = '2';
second.components = [across.pages[0].components.pop()!];
across.pages.push(second);
const otherAddress = { pageId: 'second', componentId: d.id };
linkPhysicalDevice(across, [ca, otherAddress], ca);
assert.equal(
  PartsListGenerator.generatePartsList(across).find(
    (a) => a.articleNumber === 'TEST',
  )!.quantity,
  1,
);
