import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readCatalog,
  writeCatalog,
  deleteArticle,
  setArticleSymbol,
  applyArticle,
  listArticles,
} from './manage-catalog.mjs';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manage-catalog-test-'));
const testCatalogPath = path.join(tempDir, 'articles.json');

const initialCatalog = {
  schema: 'schematico-articles',
  version: 1,
  articles: [
    {
      id: '["ABB","E290-16-10/230",""]',
      articleNumber: 'E290-16-10/230',
      manufacturer: 'ABB',
      variant: '',
      description: 'Stromstoßschalter',
      origin: 'starter',
      verification: 'unverified',
      symbolId: 'impulse_relay_1no',
    },
    {
      id: '["ELTAKO","21400301",""]',
      articleNumber: '21400301',
      manufacturer: 'ELTAKO',
      variant: '',
      description: 'Stromstoß-Schaltrelais',
      origin: 'user',
      verification: 'unverified',
      symbolId: 'old_symbol',
    },
  ],
};

fs.writeFileSync(testCatalogPath, JSON.stringify(initialCatalog, null, 2));

// 1. listArticles
assert.equal(listArticles('', testCatalogPath).length, 2);
assert.equal(listArticles('eltako', testCatalogPath).length, 1);
assert.equal(listArticles('nonexistent', testCatalogPath).length, 0);

// 2. setArticleSymbol
const updated = setArticleSymbol(
  { manufacturer: 'ELTAKO', articleNumber: '21400301' },
  'new_symbol',
  testCatalogPath,
);
assert.equal(updated.symbolId, 'new_symbol');
assert.equal(
  readCatalog(testCatalogPath).articles.find((a) => a.articleNumber === '21400301')
    ?.symbolId,
  'new_symbol',
);

// 3. applyArticle (symbol update)
const reapplied = applyArticle(
  {
    manufacturer: 'ELTAKO',
    articleNumber: '21400301',
    variant: '',
    description: 'Stromstoß-Schaltrelais',
    origin: 'user',
    verification: 'unverified',
    symbolId: 'updated_via_apply',
  },
  testCatalogPath,
);
assert.equal(reapplied.symbolId, 'updated_via_apply');

// 4. deleteArticle
const removed = deleteArticle(
  { manufacturer: 'ELTAKO', articleNumber: '21400301' },
  testCatalogPath,
);
assert.equal(removed.articleNumber, '21400301');
assert.equal(listArticles('', testCatalogPath).length, 1);
assert.throws(
  () =>
    deleteArticle(
      { manufacturer: 'ELTAKO', articleNumber: '21400301' },
      testCatalogPath,
    ),
  /articlesCatalogNotFound/,
);

// Cleanup
fs.rmSync(tempDir, { recursive: true, force: true });
console.log('✓ manage-catalog script tests passed successfully!');
