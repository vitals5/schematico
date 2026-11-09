import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
Object.assign(globalThis, { indexedDB });
import {
  refreshSharedCatalog,
  sharedCatalogState,
  sharedCatalogSymbols,
  getSharedCatalogSymbol,
  submitSharedArticle,
  SHARED_CATALOG_URL,
} from './GitHubCatalog';
import {
  parseSharedCatalog,
  appendPublicArticle,
  removeSharedArticle,
  updateSharedArticleSymbol,
  validatePublicArticle,
  parseSharedSymbols,
  validatePublicSymbol,
  appendPublicSymbol,
  removeSharedSymbol,
} from '../shared/catalog-publication.mjs';
import { getSymbolById } from './symbols';
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
// Symbol update on existing article with allowSymbolUpdate: true
const withSymbol = appendPublicArticle(
  published.catalog,
  { ...record, symbolId: 'new_sym_id' },
  { allowSymbolUpdate: true },
);
assert.equal(withSymbol.changed, true);
assert.equal(withSymbol.article.symbolId, 'new_sym_id');

// updateSharedArticleSymbol
const directlyUpdated = updateSharedArticleSymbol(withSymbol.catalog, record, 'another_sym');
assert.equal(directlyUpdated.changed, true);
assert.equal(directlyUpdated.article.symbolId, 'another_sym');

// removeSharedArticle
const afterRemoval = removeSharedArticle(directlyUpdated.catalog, record);
assert.equal(afterRemoval.changed, true);
assert.equal(afterRemoval.removed.articleNumber, record.articleNumber);
assert.equal(afterRemoval.catalog.articles.some(a => a.articleNumber === record.articleNumber), false);
assert.throws(() => removeSharedArticle(afterRemoval.catalog, record), /articlesCatalogNotFound/);
assert.throws(() => validatePublicArticle({ ...record, manufacturer: '' }));

// Vector Symbols tests (symbols.json)
const testSymbolDef = {
  id: 'cad-symbol:test_vector_123',
  name: 'Test Vector Symbol',
  category: 'relays',
  standard: 'CAD',
  defaultBmkPrefix: '-K',
  defaultFunctionText: '',
  width: 120,
  height: 90,
  pins: [
    { id: 'p1', name: '1', x: 0, y: 10, direction: 'left', electricalRole: 'unknown' },
    { id: 'p2', name: '2', x: 120, y: 10, direction: 'right', electricalRole: 'unknown' },
  ],
  svgContent: '<svg><line x1="0" y1="10" x2="120" y2="10"/></svg>',
  importedGraphics: [
    { kind: 'line', x1: 0, y1: 10, x2: 120, y2: 10, color: 'currentColor', width: 0.3 },
  ],
  description: 'Test vector symbol',
};

const validatedSym = validatePublicSymbol(testSymbolDef);
assert.equal(validatedSym.id, 'cad-symbol:test_vector_123');
assert.equal(validatedSym.pins.length, 2);

const symbolsEnvelope = {
  schema: 'schematico-symbols',
  version: 1,
  symbols: [validatedSym],
};
const parsedSymbols = parseSharedSymbols(symbolsEnvelope);
assert.equal(parsedSymbols.symbols.length, 1);
assert.throws(() => parseSharedSymbols({ schema: 'wrong', version: 1, symbols: [] }), /githubSymbolsInvalid/);
assert.throws(() => parseSharedSymbols({ ...symbolsEnvelope, symbols: [validatedSym, validatedSym] }), /symbolsCatalogDuplicate/);

const appendedSym = appendPublicSymbol(symbolsEnvelope, {
  ...testSymbolDef,
  id: 'cad-symbol:second_sym',
  name: 'Second Sym',
});
assert.equal(appendedSym.changed, true);
assert.equal(appendedSym.symbolsData.symbols.length, 2);

const removedSymResult = removeSharedSymbol(appendedSym.symbolsData, 'cad-symbol:test_vector_123');
assert.equal(removedSymResult.changed, true);
assert.equal(removedSymResult.removed.id, 'cad-symbol:test_vector_123');
assert.throws(() => removeSharedSymbol(removedSymResult.symbolsData, 'cad-symbol:test_vector_123'), /symbolsCatalogNotFound/);

// Verify that shared symbols loaded from catalog/symbols.json are retrievable
const initialSharedSymbols = sharedCatalogSymbols();
assert(initialSharedSymbols.length >= 1, 'Initial catalog symbols are loaded');
const eltakoSym = getSharedCatalogSymbol('cad-symbol:ef0fe1ae6459c38f85e583bce13872b697caeec9c23cd16d43654ece2ff4349d');
assert(eltakoSym, 'ELTAKO symbol is found in shared catalog');
assert.equal(eltakoSym.pins.length, 20);

// Verify that getSymbolById finds it
const resolved = getSymbolById('cad-symbol:ef0fe1ae6459c38f85e583bce13872b697caeec9c23cd16d43654ece2ff4349d');
assert(resolved, 'getSymbolById resolves vector symbol from shared catalog');
assert.equal(resolved.name, eltakoSym.name);

// Verify submitSharedArticle with symbol
await submitSharedArticle(
  record as any,
  'test-challenge',
  (async (_url, options) => {
    const payload = JSON.parse(String(options?.body));
    assert(payload.symbol, 'Payload includes symbol when provided');
    assert.equal(payload.symbol.id, testSymbolDef.id);
    return new Response(
      JSON.stringify({ status: 'submitted', submissionId: 'b'.repeat(64) }),
      { status: 202 },
    );
  }) as typeof fetch,
  testSymbolDef,
);

console.log(
  '✓ GitHub catalogue: bounded validated public data, independent offline cache, local-data isolation, unverified public records, immutable keys, explicit publication and safe error states',
);
