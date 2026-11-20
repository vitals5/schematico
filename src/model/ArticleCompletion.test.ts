import { strict as assert } from 'node:assert';
import {
  detectMissingArticleFields,
  missingFieldNames,
  completeArticleHeuristics,
  completeArticleWithAi,
} from './ArticleCompletion';
import type { CatalogArticle } from './ArticleTypes';
import { validateCatalogArticle } from './CatalogRecord';
import { validateCablePart, assessCablePart } from './CableArticles';

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
assert.equal(missing.functions, true, 'functions should be missing');
console.log('✓ Test 1: Missing fields detection verified');

// Test 2: Siemens MCB heuristic completion
const completedMCB = completeArticleHeuristics(rawMCB);
assert.equal(completedMCB.symbolId, 'circuit_breaker_3p', '3P MCB should resolve to circuit_breaker_3p');
assert.equal(completedMCB.dimensions?.widthMm, 54, '3P MCB should be 54mm (3 TE)');
assert.equal(completedMCB.dimensions?.heightMm, 90, 'Height should be 90mm');
assert.equal(completedMCB.electrical?.kind, 'protection', 'Kind should be protection');
assert.equal(completedMCB.electrical?.poles, 3, 'Poles should be 3');
assert.equal(completedMCB.electrical?.protectiveCurrentA, 16, 'Protective current should be 16A');
assert.equal(completedMCB.electrical?.characteristic, 'C', 'Characteristic should be C');
assert.equal(completedMCB.electrical?.breakingCapacityA, 6000, 'Breaking capacity should be 6000A (6kA)');
assert(completedMCB.description.includes('Leitungsschutzschalter'), 'Description should be generated');
assert(completedMCB.functions && completedMCB.functions.length > 0, 'Functions should be populated');
assert.equal(completedMCB.functions[0].pins.length, 6, '3P MCB should have 6 pins');
assert.doesNotThrow(() => validateCatalogArticle(completedMCB), 'Valid catalog article schema');
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
assert.equal(completedRCD.electrical?.protectiveCurrentA, 25, 'Protective current should be 25A');
assert.equal(completedRCD.electrical?.residualCurrentA, 0.03, 'Residual current should be 30mA (0.03A)');
assert(completedRCD.description.includes('FI-Schutzschalter'), 'Description should mention FI-Schutzschalter');
assert(completedRCD.functions && completedRCD.functions.length > 0, 'Functions should be populated');
assert.doesNotThrow(() => validateCatalogArticle(completedRCD), 'Valid catalog article schema');
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
assert.equal(completedRCBO.electrical?.protectiveCurrentA, 16, 'Protective current should be 16A');
assert.equal(completedRCBO.electrical?.residualCurrentA, 0.03, 'Residual current should be 30mA (0.03A)');
assert(completedRCBO.functions && completedRCBO.functions.length > 0, 'Functions should be populated');
assert.doesNotThrow(() => validateCatalogArticle(completedRCBO), 'Valid catalog article schema');
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
assert(completedPS.functions && completedPS.functions.length > 0, 'Functions should be populated');
assert.doesNotThrow(() => validateCatalogArticle(completedPS), 'Valid catalog article schema');
console.log('✓ Test 5: Mean Well Power Supply heuristic completion verified:', completedPS.description);

// Test 6: Fallback when offline / without API key
async function testFallback() {
  const res = await completeArticleWithAi(rawMCB, { apiKey: '' });
  assert.equal(res.usedAi, false, 'Without API key, should use heuristics');
  assert.equal(res.article.symbolId, 'circuit_breaker_3p', 'Heuristics should complete the symbol');
  assert.equal(res.article.electrical?.kind, 'protection', 'Artikelfunktion set');
  assert.doesNotThrow(() => validateCatalogArticle(res.article), 'Valid catalog article schema');
  console.log('✓ Test 6: Offline completion fallback verified');
}

// Test 7: Lapp 16000513 (NYM-J 5X4 NCC)
const lappNYM5x4: CatalogArticle = {
  id: '["Lapp","16000513",""]',
  articleNumber: '16000513',
  manufacturer: 'Lapp',
  variant: '',
  description:
    'Type: 16000513NYM-J 5X4 NCCKabel und Leitungen für feste Verlegung NYM-JorderNumber: 16000513voltage: 300/500VexternalDocuments: https://www.lappkabel.de/produktfinder.html?q=16000513',
  origin: 'user',
  verification: 'unverified',
};
const completedNYM5x4 = completeArticleHeuristics(lappNYM5x4);
assert.equal(completedNYM5x4.symbolId, undefined, 'Cables should not have a placement symbolId');
assert.equal(completedNYM5x4.dimensions, undefined, 'Cables should not have DIN-rail dimensions');
assert.equal(completedNYM5x4.electrical?.kind, 'cable', 'Kind should be cable');
assert.equal(completedNYM5x4.electrical?.cores, 5, 'Cores should be 5');
assert.equal(completedNYM5x4.electrical?.sectionMm2, 4, 'Cross section should be 4 mm²');
assert.equal(completedNYM5x4.electrical?.ratedVoltageV, 500, 'Rated voltage should be 500V');
assert.equal(completedNYM5x4.electrical?.ampacityA, 32, 'Ampacity for 4mm² should be 32A');
assert.equal(completedNYM5x4.electrical?.resistance20OhmKm, 4.61, 'Resistance 20°C for 4mm² copper should be 4.61 Ohm/km');
assert.equal(completedNYM5x4.electrical?.material, 'copper', 'Material should be copper');
assert(completedNYM5x4.functions && completedNYM5x4.functions.length > 0, 'Functions should be populated');
assert.deepEqual(completedNYM5x4.functions[0].pins, ['L1', 'L2', 'L3', 'N', 'PE'], '5G cable pins should be L1, L2, L3, N, PE');
assert.doesNotThrow(() => validateCatalogArticle(completedNYM5x4), 'Valid catalog article schema');
const missingNYM5x4 = detectMissingArticleFields(completedNYM5x4);
assert.equal(missingNYM5x4.symbolId, false, 'symbolId should not be flagged missing on cable');
assert.equal(missingNYM5x4.dimensions, false, 'dimensions should not be flagged missing on cable');
assert.equal(missingNYM5x4.electrical, false, 'electrical should be complete');
assert.equal(missingNYM5x4.functions, false, 'functions should be complete');
const assessedNYM5x4 = assessCablePart({
  articleNumber: completedNYM5x4.articleNumber,
  manufacturer: completedNYM5x4.manufacturer,
  variant: completedNYM5x4.variant,
  role: 'main',
  snapshot: completedNYM5x4,
});
assert.equal(assessedNYM5x4.status, 'ready', 'Cable assessment should be ready');
console.log('✓ Test 7: Lapp 16000513 (NYM-J 5X4) cable completion verified:', completedNYM5x4.description);

// Test 8: Lapp 0014164 (ÖLFLEX CLASSIC 100 H 5G4)
const lappOelflex: CatalogArticle = {
  id: '["Lapp","0014164",""]',
  articleNumber: '0014164',
  manufacturer: 'Lapp',
  variant: '',
  description:
    'Type: 0014164ÖLFLEX CLASSIC 100 H 5G4ÖLFLEX® CLASSIC 100 HexternalDocuments: https://www.lappkabel.de/webcode=1494596696width: 0 mmheight: 0 mmlength: 0 mm',
  origin: 'user',
  verification: 'unverified',
};
const completedOelflex = completeArticleHeuristics(lappOelflex);
assert.equal(completedOelflex.symbolId, undefined, 'Cables should not have symbolId');
assert.equal(completedOelflex.electrical?.kind, 'cable', 'Kind should be cable');
assert.equal(completedOelflex.electrical?.cores, 5, 'Cores should be 5');
assert.equal(completedOelflex.electrical?.sectionMm2, 4, 'Section should be 4 mm²');
assert.equal(completedOelflex.electrical?.material, 'copper', 'Material should be copper');
assert(completedOelflex.description.includes('ÖLFLEX'), 'Description should be clean and mention ÖLFLEX');
assert(!completedOelflex.description.includes('width: 0 mm'), 'Description should not contain noisy importer text');
assert.doesNotThrow(() => validateCatalogArticle(completedOelflex), 'Valid catalog article schema');
console.log('✓ Test 8: Lapp 0014164 (ÖLFLEX 5G4) cable completion verified:', completedOelflex.description);

// Test 9: Lapp 16000003 (NYM-J 3X1,5 NCC)
const lappNYM3x15: CatalogArticle = {
  id: '["Lapp","16000003",""]',
  articleNumber: '16000003',
  manufacturer: 'Lapp',
  variant: '',
  description:
    'Type: 16000003NYM-J 3X1,5   NCCKabel und Leitungen für feste Verlegung NYM-JorderNumber: 16000003voltage: 300/500VexternalDocuments: https://www.lappkabel.de/produktfinder.html?q=16000003',
  origin: 'user',
  verification: 'unverified',
};
const completedNYM3x15 = completeArticleHeuristics(lappNYM3x15);
assert.equal(completedNYM3x15.electrical?.kind, 'cable', 'Kind should be cable');
assert.equal(completedNYM3x15.electrical?.cores, 3, 'Cores should be 3');
assert.equal(completedNYM3x15.electrical?.sectionMm2, 1.5, 'Section should be 1.5 mm²');
assert.equal(completedNYM3x15.electrical?.ampacityA, 18, 'Ampacity for 1.5mm² should be 18A');
assert.equal(completedNYM3x15.electrical?.resistance20OhmKm, 12.1, 'Resistance 20°C for 1.5mm² copper should be 12.1 Ohm/km');
assert.deepEqual(completedNYM3x15.functions?.[0]?.pins, ['L', 'N', 'PE'], '3G cable pins should be L, N, PE');
assert.doesNotThrow(() => validateCatalogArticle(completedNYM3x15), 'Valid catalog article schema');
console.log('✓ Test 9: Lapp 16000003 (NYM-J 3x1.5) cable completion verified:', completedNYM3x15.description);

testFallback().then(() => {
  console.log('All Article Completion tests passed successfully! 🎉');
});
