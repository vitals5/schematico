import { strict as assert } from 'node:assert';
import {
  detectMissingArticleFields,
  missingFieldNames,
  completeArticleHeuristics,
  completeArticleWithAi,
} from './ArticleCompletion';
import type { CatalogArticle } from './ArticleTypes';

console.log('--- Testing Article Completion Service ---');

// Test 1: detect missing fields
const rawMCB: CatalogArticle = {
  id: 'test_mcb',
  articleNumber: '5SL6316-7',
  manufacturer: 'Siemens AG',
  variant: '',
  description: '5SL6316-7', // raw duplicate of part number
  origin: 'user',
  verification: 'unverified',
};

const missing = detectMissingArticleFields(rawMCB);
assert.equal(missing.description, true, 'Short duplicate description should be detected as missing');
assert.equal(missing.symbolId, true, 'symbolId should be missing');
assert.equal(missing.dimensions, true, 'dimensions should be missing');
assert.equal(missing.electrical, true, 'electrical should be missing');
console.log('✓ Test 1: Missing fields detection verified');

// Test 2: Siemens MCB heuristic completion
const completedMCB = completeArticleHeuristics(rawMCB);
assert.equal(completedMCB.symbolId, 'circuit_breaker_3p', '3P MCB should resolve to circuit_breaker_3p');
assert.equal(completedMCB.dimensions?.widthMm, 54, '3P MCB should be 54mm (3 TE)');
assert.equal(completedMCB.dimensions?.heightMm, 90, 'Height should be 90mm');
assert.equal(completedMCB.electrical?.kind, 'protection', 'Kind should be protection');
assert.equal(completedMCB.electrical?.poles, 3, 'Poles should be 3');
assert.equal(completedMCB.electrical?.currentA, 16, 'Current should be 16A');
assert.equal(completedMCB.electrical?.characteristic, 'C', 'Characteristic should be C');
assert.equal(completedMCB.electrical?.breakingCapacityA, 6000, 'Breaking capacity should be 6000A (6kA)');
assert(completedMCB.description.includes('Leitungsschutzschalter'), 'Description should be generated');
console.log('✓ Test 2: Siemens MCB heuristic completion verified:', completedMCB.description);

// Test 3: ABB RCD heuristic completion
const rawRCD: CatalogArticle = {
  id: 'test_rcd',
  articleNumber: 'FH202-25/0.03',
  manufacturer: 'ABB',
  variant: '',
  description: '',
  origin: 'user',
  verification: 'unverified',
};
const completedRCD = completeArticleHeuristics(rawRCD);
assert.equal(completedRCD.symbolId, 'rcd_2p', '2P RCD should resolve to rcd_2p');
assert.equal(completedRCD.dimensions?.widthMm, 36, '2P RCD should be 36mm (2 TE)');
assert.equal(completedRCD.electrical?.kind, 'protection', 'Kind should be protection');
assert.equal(completedRCD.electrical?.poles, 2, 'Poles should be 2');
assert.equal(completedRCD.electrical?.currentA, 25, 'Current should be 25A');
assert(completedRCD.description.includes('FI-Schutzschalter'), 'Description should mention FI-Schutzschalter');
console.log('✓ Test 3: ABB RCD heuristic completion verified:', completedRCD.description);

// Test 4: Siemens compact RCBO heuristic completion
const rawRCBO: CatalogArticle = {
  id: 'test_rcbo',
  articleNumber: '5SV1316-6KK16',
  manufacturer: 'Siemens',
  variant: '',
  description: '',
  origin: 'user',
  verification: 'unverified',
};
const completedRCBO = completeArticleHeuristics(rawRCBO);
assert.equal(completedRCBO.symbolId, 'rcbo_1p_n', 'RCBO should resolve to rcbo_1p_n');
assert.equal(completedRCBO.dimensions?.widthMm, 18, 'Compact 5SV1 RCBO should be 18mm (1 TE)');
assert.equal(completedRCBO.electrical?.kind, 'protection', 'Kind should be protection');
console.log('✓ Test 4: Siemens compact RCBO heuristic completion verified:', completedRCBO.description);

// Test 5: Mean Well Power Supply
const rawPowerSupply: CatalogArticle = {
  id: 'test_ps',
  articleNumber: 'HDR-30-24',
  manufacturer: 'Mean Well',
  variant: '',
  description: '',
  origin: 'user',
  verification: 'unverified',
};
const completedPS = completeArticleHeuristics(rawPowerSupply);
assert.equal(completedPS.symbolId, 'power_supply_dc', 'Power supply should resolve to power_supply_dc');
assert.equal(completedPS.electrical?.kind, 'load', 'Kind should be load');
assert(completedPS.description.includes('Schaltnetzteil'), 'Description should mention Schaltnetzteil');
console.log('✓ Test 5: Mean Well Power Supply heuristic completion verified:', completedPS.description);

// Test 6: Fallback when offline / without API key
async function testFallback() {
  const res = await completeArticleWithAi(rawMCB, { apiKey: '' });
  assert.equal(res.usedAi, false, 'Without API key, should use heuristics');
  assert.equal(res.article.symbolId, 'circuit_breaker_3p', 'Heuristics should complete the symbol');
  console.log('✓ Test 6: Offline completion fallback verified');
}

testFallback().then(() => {
  console.log('All Article Completion tests passed successfully! 🎉');
});
