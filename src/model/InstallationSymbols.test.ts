import assert from 'node:assert/strict';
import { INSTALLATION_SYMBOLS } from './InstallationSymbols';
import { SYMBOL_DEFINITIONS, getSymbolById } from './symbols';
import { ELEMENT_CATEGORIES } from './SymbolCatalogue';
import { getLocalizedSymbol } from '../i18n';

console.log(`Testing ${INSTALLATION_SYMBOLS.length} Architectural Installation Symbols (DIN EN 60617-11)...`);

const validCategories = new Set(ELEMENT_CATEGORIES.map(c => c.id));

for (const sym of INSTALLATION_SYMBOLS) {
  // Category validity
  assert(validCategories.has(sym.category), `${sym.id}: category ${sym.category} must be in ELEMENT_CATEGORIES`);

  // Dimensions must be multiples of 8 (standard grid)
  assert.equal(sym.width % 8, 0, `${sym.id}: width (${sym.width}) must be divisible by 8`);
  assert.equal(sym.height % 8, 0, `${sym.id}: height (${sym.height}) must be divisible by 8`);

  // CRITICAL REQUIREMENT: Installation symbols have NO electrical connection pins ("keine Verbindungspunkte")
  assert.equal(sym.pins.length, 0, `${sym.id}: architectural installation symbols must have no connection points (pins.length === 0)`);

  // Must have an explicit insertion point for wall placement
  assert(sym.insertionPoint, `${sym.id}: must have an insertionPoint defined`);
  assert(typeof sym.insertionPoint.x === 'number' && typeof sym.insertionPoint.y === 'number', `${sym.id}: valid insertionPoint coords`);

  // Lookup in SYMBOL_DEFINITIONS
  const lookup = getSymbolById(sym.id);
  assert(lookup, `${sym.id}: must be registered in SYMBOL_DEFINITIONS`);
  assert.equal(lookup.id, sym.id);

  // Localization checks in DE and EN
  const de = getLocalizedSymbol(sym, 'de');
  assert(de.name && de.name.length > 0, `${sym.id}: German name missing`);
  assert(de.description && de.description.length > 0, `${sym.id}: German description missing`);

  const en = getLocalizedSymbol(sym, 'en');
  assert(en.name && en.name.length > 0, `${sym.id}: English name missing`);
  assert(en.description && en.description.length > 0, `${sym.id}: English description missing`);
  assert.notEqual(en.name, '', `${sym.id}: English name should not be empty`);
}

// Global Uniqueness
const allIds = SYMBOL_DEFINITIONS.map(s => s.id);
assert.equal(new Set(allIds).size, allIds.length, 'Every symbol ID in SYMBOL_DEFINITIONS must be unique');

console.log(`✓ All ${INSTALLATION_SYMBOLS.length} DIN EN 60617-11 symbols verified: no connection points, wall insertion points, and DE/EN localization!`);
