import assert from 'node:assert/strict';
import { fixture, add } from '../layout/testing/fixture';
import { ArticleSnapshotPlan, articleUsageGroups } from './ArticleMaintenance';
import { setArticleAssignment, effectiveArticles } from './ArticleAssignments';
import { validateCatalogArticle, catalogKey } from './CatalogRecord';
import { PartsListGenerator } from '../reports/PartsList';
import { ProjectHistory } from './ProjectHistory';
const p = fixture(),
  a = add(p, 'a', 'contactor_coil'),
  b = add(p, 'b', 'contactor_coil');
const item = {
  articleNumber: '001',
  manufacturer: 'Maker',
  variant: 'V1',
  quantity: 2,
  role: 'main' as const,
};
setArticleAssignment(a, [
  item,
  { ...item, articleNumber: 'extra', role: 'accessory', quantity: 3 },
]);
setArticleAssignment(b, [
  { ...item, quantity: 1 },
  { ...item, variant: 'V2', role: 'accessory' },
]);
const record = validateCatalogArticle({
  ...item,
  description: 'Manufacturer data',
  origin: 'user',
  verification: 'unverified',
  functions: [{ id: 'coil', type: 'relay_coil', pins: ['A1', 'A2'] }],
});
const groups = articleUsageGroups(p),
  group = groups.find((g) => g.key === catalogKey(item))!;
assert.equal(group.uses.length, 2);
assert.equal(group.missingFunctions, 2);
const before = JSON.stringify(p),
  plan = new ArticleSnapshotPlan(p, group.key, record),
  updated = plan.apply(p);
assert.equal(JSON.stringify(p), before);
assert.equal(plan.changes.length, 2);
assert.equal(
  effectiveArticles(updated.pages[0].components[0])[1].articleNumber,
  'extra',
);
assert.equal(
  effectiveArticles(updated.pages[0].components[1])[1].snapshot,
  undefined,
);
assert.equal(
  effectiveArticles(updated.pages[0].components[0])[0].snapshot?.verification,
  'unverified',
);
assert.deepEqual(
  PartsListGenerator.generatePartsList(updated).map((r) => [
    r.articleNumber,
    r.quantity,
  ]),
  PartsListGenerator.generatePartsList(p).map((r) => [
    r.articleNumber,
    r.quantity,
  ]),
);
assert.throws(
  () => new ArticleSnapshotPlan(p, group.key, { ...record, variant: 'other' }),
  /articleMaintenanceKey/,
);
const replacement = new ArticleSnapshotPlan(updated, group.key, {
  ...record,
  description: 'Changed',
});
assert.throws(() => replacement.apply(updated), /repairConfirmation/);
assert.equal(
  replacement.apply(updated, true).pages[0].components[0].articleAssignment
    ?.items[0].snapshot?.description,
  'Changed',
);
const stale = structuredClone(p);
stale.pages[0].title = 'edited';
assert.throws(() => plan.apply(stale), /articlesProjectStale/);
const history = new ProjectHistory();
history.reset(p);
history.record(updated);
assert.deepEqual(history.undo(), p);
assert.deepEqual(history.redo(), updated);
console.log(
  '✓ Exact article usage groups and snapshot-only bulk updates preserve quantities, accessories, verification, BOM and undo; mismatches, stale previews and unconfirmed replacement are blocked',
);
