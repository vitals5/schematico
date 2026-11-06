import assert from 'node:assert/strict';
import { fixture, add } from '../layout/testing/fixture';
import { getSymbolById } from './symbols';
import { ArticleSyncPlan, isArticleSyncSelectable } from './ArticleSync';
import { nativeSourceIdentity } from './SourceIdentity';
import { ProjectHistory } from './ProjectHistory';
import { handleGetImportedArticles } from '../ai/mcp-tools/importedArticles';
import type { CanvasStateManager } from '../ai/mcp-tools/handlers';
const digest = 'a'.repeat(64),
  other = 'b'.repeat(64);
function source() {
  const p = fixture(),
    c = add(p, 'source-placement');
  c.bmk = '-Q1';
  p.nativeSourceIdentity = { algorithm: 'sha256-native-tables-v1', digest };
  const symbol = structuredClone(getSymbolById(c.symbolId, p)!);
  symbol.source = { library: 'IEC', number: 3, variant: 0 };
  p.symbolLibrary = [symbol];
  c.source = {
    format: 'NATIVE_CAD',
    objectType: 17,
    objectId: 50,
    datasetId: digest,
    datasetVerification: 'parser',
  };
  c.articleNumber = 'MAIN';
  c.manufacturer = 'Factory';
  c.articleImport = {
    source: 'native_project',
    status: 'record_read',
    observedArticleNumber: 'MAIN',
    referenceIds: [11, 12],
  };
  c.articleReferences = [
    {
      sourceDatasetId: digest,
      sourceId: 11,
      ownerType: 17,
      ownerId: 50,
      articleNumber: 'MAIN',
      variant: '1',
      position: 1,
      quantity: 2,
      manufacturer: 'Factory',
      masterDataId: 'master',
    },
    {
      sourceDatasetId: digest,
      sourceId: 12,
      ownerType: 17,
      ownerId: 50,
      articleNumber: 'ACCESSORY',
      variant: '',
      position: 2,
      quantity: 0,
    },
  ];
  p.sourceArticleReferences = structuredClone(c.articleReferences);
  p.importedArticleLibrary = [
    {
      id: 'master',
      sourceDatasetId: digest,
      sourceId: 8,
      articleNumber: 'MAIN',
      variant: '1',
      manufacturer: 'Factory',
      partial: false,
    },
  ];
  return p;
}
function pair(legacy = false) {
  const s = source(),
    p = structuredClone(s),
    c = p.pages[0].components[0];
  p.name = 'Edited project';
  delete p.importedArticleLibrary;
  delete p.sourceArticleReferences;
  c.id = 'edited-placement';
  delete c.articleNumber;
  delete c.manufacturer;
  delete c.articleReferences;
  c.articleImport = { source: 'native_project', status: 'not_read' };
  c.x = 500;
  c.y = 360;
  c.functionText = 'Edited label';
  p.pages[0].title = 'Edited page';
  if (legacy) {
    delete p.nativeSourceIdentity;
    delete c.source!.datasetId;
    delete c.source!.datasetVerification;
  }
  return { s, p, c };
}
const { s, p } = pair(),
  before = structuredClone(p),
  plan = await ArticleSyncPlan.create(p, s);
assert.equal(plan.rows[0].status, 'fill');
assert(!plan.rows[0].needsSourceConfirmation);
const result = await plan.apply(p, [plan.rows[0].id]);
assert.deepEqual(p, before, 'Preview and apply do not mutate target');
assert.equal(result.pages[0].components[0].articleNumber, 'MAIN');
assert.equal(result.pages[0].components[0].articleReferences![1].quantity, 0);
const drawing = (p: typeof result) => {
  const copy = structuredClone(p);
  for (const page of copy.pages)
    for (const c of page.components) {
      delete c.articleNumber;
      delete c.manufacturer;
      delete c.articleReferences;
      delete c.articleImport;
      delete c.source?.datasetId;
      delete c.source?.datasetVerification;
    }
  delete copy.importedArticleLibrary;
  delete copy.sourceArticleReferences;
  delete copy.articleImportDiagnostics;
  copy.modified = '';
  return copy;
};
assert.deepEqual(
  drawing(result),
  drawing(before),
  'Drawing, label, pin, wire, page and symbol-library data remain byte-for-byte equivalent',
);
const history = new ProjectHistory();
history.reset(p);
history.record(result);
assert.deepEqual(history.undo(), p);
assert.deepEqual(history.redo(), result);
assert(!history.canRedo);
assert.equal(
  (await ArticleSyncPlan.create(result, s)).rows[0].status,
  'unchanged',
);
const legacy = pair(true),
  oldPlan = await ArticleSyncPlan.create(legacy.p, legacy.s);
await assert.rejects(
  () => oldPlan.apply(legacy.p, [oldPlan.rows[0].id]),
  /articleSyncConfirmRequired/,
);
const confirmed = await oldPlan.apply(legacy.p, [oldPlan.rows[0].id], true);
assert.equal(
  confirmed.pages[0].components[0].source?.datasetVerification,
  'user_confirmed',
);
assert.equal(confirmed.nativeSourceIdentity, undefined);
for (const [change, status] of [
  [(c: any) => (c.source.datasetId = other), 'different_source'],
  [(c: any) => delete c.source, 'missing_identity'],
  [(c: any) => (c.source.objectId = 900), 'missing_source'],
  [(c: any) => (c.articleNumber = 'MANUAL'), 'conflict'],
  [
    (c: any) => {
      c.articleNumber = '';
      c.articleImport = {
        source: 'native_project',
        status: 'record_read',
        observedArticleNumber: 'PREVIOUS',
      };
    },
    'conflict',
  ],
  [(c: any) => (c.manufacturer = 'Other factory'), 'conflict'],
  [
    (c: any) => {
      c.manufacturer = '';
      c.articleImport = { source: 'native_project', status: 'record_read' };
    },
    'conflict',
  ],
  [(c: any) => (c.articleReferences = [{ sourceId: 999 }]), 'conflict'],
  [(c: any) => (c.articleRequirement = 'none'), 'excluded'],
] as const) {
  const x = pair();
  change(x.c);
  const q = await ArticleSyncPlan.create(x.p, x.s);
  assert.equal(q.rows[0].status, status);
  await assert.rejects(
    () => q.apply(x.p, [q.rows[0].id], true),
    /articleSyncSelection/,
  );
}
for (const change of [
  (x: ReturnType<typeof pair>) => (x.c.bmk = '-Q2'),
  (x: ReturnType<typeof pair>) => (x.p.symbolLibrary![0].source!.variant = 1),
  (x: ReturnType<typeof pair>) => (x.p.pages[0].location = '+OTHER'),
]) {
  const x = pair(true);
  change(x);
  assert.equal(
    (await ArticleSyncPlan.create(x.p, x.s)).rows[0].status,
    'identity_conflict',
  );
}
const duplicate = pair();
duplicate.p.pages[0].components.push({
  ...structuredClone(duplicate.c),
  id: 'duplicate',
});
assert(
  (await ArticleSyncPlan.create(duplicate.p, duplicate.s)).rows.every(
    (r) => r.status === 'ambiguous',
  ),
);
const duplicateSource = pair();
duplicateSource.s.pages[0].components.push({
  ...structuredClone(duplicateSource.s.pages[0].components[0]),
  id: 'another',
});
assert.equal(
  (await ArticleSyncPlan.create(duplicateSource.p, duplicateSource.s)).rows[0]
    .status,
  'ambiguous',
);
const unread = pair();
unread.s.pages[0].components[0].articleImport!.status = 'not_read';
assert.equal(
  (await ArticleSyncPlan.create(unread.p, unread.s)).rows[0].status,
  'source_unread',
);
const editedSource = pair();
editedSource.s.pages[0].components[0].manufacturer = 'MANUAL';
assert.equal(
  (await ArticleSyncPlan.create(editedSource.p, editedSource.s)).rows[0].status,
  'source_unread',
);
const wrongOwner = pair();
wrongOwner.s.pages[0].components[0].articleReferences![0].ownerId = 999;
assert.equal(
  (await ArticleSyncPlan.create(wrongOwner.p, wrongOwner.s)).rows[0].status,
  'source_unread',
);
const invalid = pair();
delete invalid.s.nativeSourceIdentity;
await assert.rejects(
  () => ArticleSyncPlan.create(invalid.p, invalid.s),
  /articleSyncInvalidSource/,
);
const stale = pair(),
  stalePreview = await ArticleSyncPlan.create(stale.p, stale.s);
stale.c.x++;
await assert.rejects(
  () => stalePreview.apply(stale.p, [stalePreview.rows[0].id]),
  /articleSyncStale/,
);
await assert.rejects(
  () => plan.apply(p, [plan.rows[0].id, plan.rows[0].id]),
  /articleSyncSelection/,
);
// Public preview DTOs and original input are not authoritative write values.
const detached = pair(),
  detachedPlan = await ArticleSyncPlan.create(detached.p, detached.s);
detached.s.pages[0].components[0].articleNumber = 'TAMPER';
detachedPlan.rows[0].incoming.number = 'TAMPER';
assert.equal(
  (await detachedPlan.apply(detached.p, [detachedPlan.rows[0].id])).pages[0]
    .components[0].articleNumber,
  'MAIN',
);
const blank = pair(),
  sc = blank.s.pages[0].components[0];
delete sc.articleNumber;
delete sc.manufacturer;
sc.articleReferences = [];
sc.articleImport = {
  source: 'native_project',
  status: 'record_read',
  observedArticleNumber: '',
};
blank.s.sourceArticleReferences = [];
const blankPlan = await ArticleSyncPlan.create(blank.p, blank.s);
assert.equal(blankPlan.rows[0].status, 'evidence');
assert.equal(
  (await blankPlan.apply(blank.p, [blankPlan.rows[0].id])).pages[0]
    .components[0].articleImport?.observedArticleNumber,
  '',
);
const collision = pair();
collision.p.importedArticleLibrary = [
  {
    ...collision.s.importedArticleLibrary![0],
    articleNumber: 'OLD',
    sourceDatasetId: other,
  },
];
collision.p.sourceArticleReferences = [
  {
    ...collision.s.sourceArticleReferences![0],
    sourceDatasetId: other,
    articleNumber: 'OLD',
  },
];
const collisionPlan = await ArticleSyncPlan.create(collision.p, collision.s),
  merged = await collisionPlan.apply(collision.p, [collisionPlan.rows[0].id]);
assert.equal(merged.importedArticleLibrary!.length, 2);
assert.equal(merged.importedArticleLibrary![0].articleNumber, 'OLD');
assert.notEqual(
  merged.pages[0].components[0].articleReferences![0].masterDataId,
  'master',
);
assert.equal(merged.sourceArticleReferences!.length, 3);
const manager = { getProject: () => merged } as CanvasStateManager;
const refs = await handleGetImportedArticles({}, manager);
assert.equal(refs.counts.unplacedReferences, 1);
assert.equal(
  (refs.items[0] as any).placedComponentIds.length,
  0,
  'Raw source ID from another dataset must never acquire a placed owner',
);
const selected = await handleGetImportedArticles(
  { componentId: merged.pages[0].components[0].id },
  manager,
);
assert.equal(selected.items.length, 2);
const embedded = structuredClone(merged);
delete embedded.sourceArticleReferences;
assert.equal(
  (
    await handleGetImportedArticles(
      { componentId: embedded.pages[0].components[0].id },
      { getProject: () => embedded } as CanvasStateManager,
    )
  ).items.length,
  2,
);
const bytes = Uint8Array.of(1, 2, 3),
  identity = await nativeSourceIdentity(bytes, bytes);
assert.deepEqual(await nativeSourceIdentity(bytes, bytes), identity);
assert.notEqual(
  (await nativeSourceIdentity(Uint8Array.of(1, 2), Uint8Array.of(3, 1, 2, 3)))
    .digest,
  identity.digest,
  'Table boundaries are part of the digest',
);
assert.notEqual(
  (await nativeSourceIdentity(bytes, Uint8Array.of(1, 2, 4))).digest,
  identity.digest,
);
assert.notEqual(
  (await nativeSourceIdentity(bytes, bytes, Uint8Array.of(1))).digest,
  identity.digest,
  'Active source indexes contribute to identity',
);
const noRefs = pair();
assert.equal(
  (
    await handleGetImportedArticles({ componentId: noRefs.c.id }, {
      getProject: () => noRefs.p,
    } as CanvasStateManager)
  ).items.length,
  0,
);
assert(isArticleSyncSelectable(plan.rows[0]));
console.log(
  '✓ Article reconciliation: provenance, legacy confirmation, manual conflicts, stale inputs, isolated metadata merge, undo/redo and scoped evidence',
);
// Optional private archive: source import and reconciliation of an edited legacy
// copy must preserve every drawing field and embedded symbol resource.
const { openNativeFixture } = await import('../packages/testing/NativeFixture');
const archive = await openNativeFixture();
if (archive) {
  const { EdbProjectParser } = await import('../packages/EdbProjectParser');
  const { project: original } = await EdbProjectParser.parseEdbProject(
    archive.zip,
  );
  assert(original.nativeSourceIdentity?.digest.length === 64);
  const edited = structuredClone(original);
  delete edited.nativeSourceIdentity;
  delete edited.importedArticleLibrary;
  delete edited.sourceArticleReferences;
  delete edited.articleImportDiagnostics;
  for (const page of edited.pages)
    for (const c of page.components) {
      delete c.articleNumber;
      delete c.manufacturer;
      delete c.articleReferences;
      delete c.source?.datasetId;
      delete c.source?.datasetVerification;
      c.articleImport = { source: 'native_project', status: 'not_read' };
    }
  edited.pages[0].title += ' · Bearbeitet';
  edited.pages.flatMap((p) => p.components)[0].x += 8;
  const preview = await ArticleSyncPlan.create(edited, original),
    eligible = preview.rows.filter(isArticleSyncSelectable);
  assert(eligible.length > 100);
  const updated = await preview.apply(
    edited,
    eligible.map((r) => r.id),
    true,
  );
  const strip = (project: typeof original) => {
    const copy = drawing(project);
    for (const page of copy.pages)
      for (const c of page.components) delete c.articleImport;
    return copy;
  };
  assert.deepEqual(strip(updated), strip(edited));
  const assigned = updated.pages
    .flatMap((p) => p.components)
    .filter((c) => c.articleReferences?.length).length;
  assert(assigned > 100);
  assert.equal(
    (await ArticleSyncPlan.create(updated, original)).rows.filter(
      isArticleSyncSelectable,
    ).length,
    0,
  );
  console.log(
    JSON.stringify({
      nativeArticleSync: {
        pages: updated.pages.length,
        eligible: eligible.length,
        assigned,
        untouchedDrawing: true,
      },
    }),
  );
}
