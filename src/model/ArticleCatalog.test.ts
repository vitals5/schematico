import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {
  ArticleCatalog,
  catalogKey,
  catalogRevision,
  catalogToCsv,
  catalogToJson,
  parseCatalogFile,
  planCatalogMerge,
  projectArticles,
  validateCatalogArticle,
} from './ArticleCatalog';
import { fixture, add } from '../layout/testing/fixture';
import { setArticleAssignment } from './ArticleAssignments';
const a = validateCatalogArticle({
  articleNumber: '001;"23',
  manufacturer: 'Prüfgeräte',
  variant: 'V1',
  description: 'Zeile 1\nZeile "2"; mit ; Zeichen',
  origin: 'user',
  verification: 'user_checked',
  functions: [{ id: 'coil', type: 'coil', pins: ['A1', 'A2'] }],
});
const csv = catalogToCsv([a]),
  json = catalogToJson([a]);
for (const format of ['csv', 'json'] as const) {
  const rows = parseCatalogFile(format === 'csv' ? csv : json, format);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].articleNumber, a.articleNumber);
  assert.equal(rows[0].description, a.description);
  assert.deepEqual(rows[0].functions, a.functions);
  assert.equal(
    rows[0].verification,
    'unverified',
    'Imported assertions need review',
  );
}
assert.equal(
  parseCatalogFile(
    'articleNumber,manufacturer,variant,description\r\n001,ACME,,Basic',
    'csv',
  )[0].articleNumber,
  '001',
);
for (const invalid of [
  'articleNumber;manufacturer;variant;description\n"unterminated',
  'articleNumber;manufacturer;variant;description\n1;ACME;V;"closed"bad',
  'articleNumber;manufacturer;variant;description\n1;ACME',
])
  assert.throws(() => parseCatalogFile(invalid, 'csv'));
assert.throws(
  () =>
    parseCatalogFile('{"schema":"wrong","version":1,"articles":[]}', 'json'),
  /articlesCatalogInvalid/,
);
assert.throws(
  () =>
    validateCatalogArticle({
      ...a,
      functions: [
        { id: 'same', type: 'x', pins: ['1'] },
        { id: 'same', type: 'y', pins: ['2'] },
      ],
    }),
  /articlesCatalogInvalid/,
);
assert.throws(
  () =>
    validateCatalogArticle({
      ...a,
      functions: [{ id: 'a', type: 'x', pins: ['1', '1'] }],
    }),
  /articlesCatalogInvalid/,
);
const b = validateCatalogArticle({ ...a, variant: 'V2' });
assert.notEqual(catalogKey(a), catalogKey(b));
assert.equal(planCatalogMerge([a], [b]).added.length, 1);
assert.equal(
  planCatalogMerge([a], [{ ...a, description: 'Changed' }]).conflicts.length,
  1,
);
assert.throws(() => planCatalogMerge([], [a, a]), /articlesCatalogDuplicate/);
const catalog = new ArticleCatalog(),
  initial = await catalog.list();
assert.equal(initial.length, 0);
await catalog.merge([a], false, catalogRevision(initial));
assert.equal(
  (await new ArticleCatalog().list()).length,
  1,
  'New service instance reads persistent IndexedDB',
);
const state = await catalog.list(),
  changed = { ...a, description: 'Changed' };
await assert.rejects(
  () => catalog.merge([b, changed], false, catalogRevision(state)),
  /articlesCatalogConflict/,
);
assert.equal(
  (await catalog.list()).length,
  1,
  'A conflict aborts additions in the same transaction',
);
await catalog.merge([b], false, catalogRevision(state));
await assert.rejects(
  () => catalog.merge([changed], true, catalogRevision(state)),
  /articlesCatalogStale/,
);
assert.equal(
  (await catalog.list()).find((r) => r.id === a.id)!.description,
  a.description,
);
await catalog.merge([changed], true, catalogRevision(await catalog.list()));
assert.equal(
  (await catalog.list()).find((r) => r.id === a.id)!.description,
  'Changed',
);
const p = fixture(),
  c = add(p, 'c');
setArticleAssignment(c, [
  {
    articleNumber: a.articleNumber,
    manufacturer: a.manufacturer,
    variant: a.variant,
    role: 'main',
    quantity: 1,
    snapshot: a,
  },
]);
assert.equal(projectArticles(p)[0].articleNumber, a.articleNumber);
await catalog.remove(a.id, catalogRevision(await catalog.list()), true);
assert.equal(
  c.articleAssignment!.items[0].snapshot!.description,
  a.description,
  'Deleting or editing local records never changes project snapshots',
);
const deletedList = await catalog.deletedIds();
assert(deletedList.includes(a.id), 'Permanent deletion records id in deleted_ids');
await catalog.resetDeleted();
assert.equal((await catalog.deletedIds()).length, 0, 'resetDeleted restores deleted ids');
await assert.rejects(
  () => catalog.remove(b.id, catalogRevision(state)),
  /articlesCatalogStale/,
);
console.log(
  '✓ IndexedDB persistence, optimistic atomic imports/deletes, exact variants, CSV quoting/Unicode/leading zeros, JSON validation and portable article snapshots',
);
