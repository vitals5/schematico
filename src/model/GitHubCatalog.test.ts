import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
Object.assign(globalThis, { indexedDB });
import {
  refreshSharedCatalog,
  sharedCatalogState,
  submitSharedArticle,
  SHARED_CATALOG_URL,
} from './GitHubCatalog';
import {
  parseSharedCatalog,
  appendPublicArticle,
  validatePublicArticle,
} from '../shared/catalog-publication.mjs';
import { ArticleCatalog, catalogRevision } from './ArticleCatalog';
const record = {
  articleNumber: '0007',
  manufacturer: 'Maker',
  variant: 'A',
  description: 'Example',
  origin: 'user',
  verification: 'user_checked',
  functions: [
    { id: 'coil', type: 'relay_coil', pins: ['A1', 'A2'], required: true },
  ],
};
const envelope = {
  schema: 'schematico-articles',
  version: 1,
  articles: [record],
  submission: {
    url: 'https://catalog.example.test/submit',
    siteKey: 'public-site-key',
  },
};
const local = new ArticleCatalog();
await local.merge([record as any], false, catalogRevision([]));
const before = await local.list();
const ready = await refreshSharedCatalog((async (url, options) => {
  assert.equal(url, SHARED_CATALOG_URL);
  assert.equal(options?.credentials, 'omit');
  return new Response(JSON.stringify(envelope), { status: 200 });
}) as typeof fetch);
assert.equal(ready.status, 'ready');
assert.equal(ready.articles[0].verification, 'unverified');
assert.deepEqual(
  await local.list(),
  before,
  'Refreshing the shared cache does not overwrite local checked data',
);
const offline = await refreshSharedCatalog((async () => {
  throw new Error('offline');
}) as typeof fetch);
assert.equal(offline.status, 'offline');
assert.equal(offline.articles[0].articleNumber, '0007');
const malformed = await refreshSharedCatalog(
  (async () => new Response('{invalid')) as typeof fetch,
);
assert.equal(malformed.status, 'offline');
assert.equal(sharedCatalogState().articles.length, 1);
const submitted = await submitSharedArticle(
  record as any,
  'test-challenge',
  (async (_url, options) => {
    const payload = JSON.parse(String(options?.body));
    assert.equal(payload.article.verification, 'unverified');
    assert(!('token' in payload));
    return new Response(
      JSON.stringify({ status: 'submitted', submissionId: 'a'.repeat(64) }),
      { status: 202 },
    );
  }) as typeof fetch,
);
assert.equal(submitted.submissionId.length, 64);
await assert.rejects(
  () => submitSharedArticle(record as any, ''),
  /githubCatalogChallenge/,
);
await assert.rejects(
  () =>
    submitSharedArticle(
      record as any,
      'test',
      (async () => new Response('', { status: 429 })) as typeof fetch,
    ),
  /githubCatalogRateLimited/,
);
assert.throws(
  () => parseSharedCatalog({ ...envelope, articles: [record, record] }),
  /articlesCatalogDuplicate/,
);
assert.throws(() =>
  parseSharedCatalog({
    ...envelope,
    submission: { url: 'javascript:bad', siteKey: 'x' },
  }),
);
const published = appendPublicArticle(
  { ...envelope, articles: [] },
  { ...record, path: '.github/workflows/attack.yml' },
);
assert.equal(published.article.verification, 'unverified');
assert(!('path' in published.article));
assert.deepEqual(published.catalog.submission, envelope.submission);
assert.equal(appendPublicArticle(published.catalog, record).changed, false);
assert.throws(
  () =>
    appendPublicArticle(published.catalog, {
      ...record,
      description: 'Overwrite',
    }),
  /githubCatalogConflict/,
);
assert.throws(() => validatePublicArticle({ ...record, manufacturer: '' }));
console.log(
  '✓ GitHub catalogue: bounded validated public data, independent offline cache, local-data isolation, unverified public records, immutable keys, explicit publication and safe error states',
);
