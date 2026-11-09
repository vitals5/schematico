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
  readSymbols,
  writeSymbols,
  applySymbol,
  deleteSymbol,
  listSymbols,
} from './manage-catalog.mjs';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manage-catalog-test-'));
const testCatalogPath = path.join(tempDir, 'articles.json');
const testSymbolsPath = path.join(tempDir, 'symbols.json');

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

// 5. Symbols management (symbols.json)
const testSymbol = {
  id: 'cad-symbol:test12345',
  name: 'Test Relais',
  category: 'relays',
  standard: 'CAD',
  defaultBmkPrefix: '-K',
  defaultFunctionText: '',
  width: 100,
  height: 80,
  pins: [
    { id: 'p1', name: 'A1', x: 10, y: 0, direction: 'top', electricalRole: 'unknown' },
    { id: 'p2', name: 'A2', x: 10, y: 80, direction: 'bottom', electricalRole: 'unknown' },
  ],
  svgContent: '<svg></svg>',
  importedGraphics: [
    { kind: 'line', x1: 0, y1: 0, x2: 100, y2: 0, color: 'currentColor', width: 0.5 },
  ],
  description: 'Test symbol vector data',
};

// writeSymbols & readSymbols
writeSymbols(
  { schema: 'schematico-symbols', version: 1, symbols: [testSymbol] },
  testSymbolsPath,
);
assert.equal(fs.existsSync(testSymbolsPath), true);
assert.equal(readSymbols(testSymbolsPath).symbols.length, 1);
assert.equal(readSymbols(testSymbolsPath).symbols[0].id, 'cad-symbol:test12345');

// listSymbols
assert.equal(listSymbols('', testSymbolsPath).length, 1);
assert.equal(listSymbols('Test Relais', testSymbolsPath).length, 1);
assert.equal(listSymbols('missing', testSymbolsPath).length, 0);

// applySymbol (add new / update existing)
const secondSymbol = {
  ...testSymbol,
  id: 'cad-symbol:second999',
  name: 'Second Symbol',
};
applySymbol(secondSymbol, testSymbolsPath);
assert.equal(listSymbols('', testSymbolsPath).length, 2);
assert.equal(readSymbols(testSymbolsPath).symbols.length, 2);

// deleteSymbol
const removedSym = deleteSymbol('cad-symbol:test12345', testSymbolsPath);
assert.equal(removedSym.id, 'cad-symbol:test12345');
assert.equal(listSymbols('', testSymbolsPath).length, 1);
assert.equal(readSymbols(testSymbolsPath).symbols.length, 1);
assert.throws(() => deleteSymbol('cad-symbol:test12345', testSymbolsPath), /symbolsCatalogNotFound/);

// Cleanup
fs.rmSync(tempDir, { recursive: true, force: true });
console.log('✓ manage-catalog script tests passed successfully!');
