import assert from 'node:assert/strict';
import { STANDARD_IEC_SYMBOLS } from './StandardIecSymbols';
import { SYMBOL_DEFINITIONS, getSymbolById } from './symbols';
import { ELEMENT_CATEGORIES, symbolMatchesQuery } from './SymbolCatalogue';
import { getLocalizedSymbol } from '../i18n';
import { snapSymbolPosition } from './DrawingGrid';
import { rotatedLocalPoint, scaleSymbolDefinition } from './SymbolGeometry';

console.log(`Testing ${STANDARD_IEC_SYMBOLS.length} Standard IEC 60617 Symbols...`);

const validCategories = new Set(ELEMENT_CATEGORIES.map(c => c.id));

// 1. Symbol and Pin Validation
for (const sym of STANDARD_IEC_SYMBOLS) {
  // Category validity
  assert(validCategories.has(sym.category), `${sym.id}: category ${sym.category} must be in ELEMENT_CATEGORIES`);

  // Dimensions must be multiples of 8 (standard grid)
  assert.equal(sym.width % 8, 0, `${sym.id}: width (${sym.width}) must be divisible by 8`);
  assert.equal(sym.height % 8, 0, `${sym.id}: height (${sym.height}) must be divisible by 8`);

  // At least 1 pin
  assert(sym.pins.length > 0, `${sym.id}: must have at least one pin`);

  // Unique pin IDs
  const pinIds = new Set<string>();
  for (const pin of sym.pins) {
    assert(!pinIds.has(pin.id), `${sym.id}: duplicate pin ID ${pin.id}`);
    pinIds.add(pin.id);

    // CRITICAL: Connection points strictly on the 8-unit standard grid!
    assert.equal(pin.x % 8, 0, `${sym.id} pin ${pin.id}: X coordinate (${pin.x}) must be on 8-unit grid`);
    assert.equal(pin.y % 8, 0, `${sym.id} pin ${pin.id}: Y coordinate (${pin.y}) must be on 8-unit grid`);

    // Port directions must be strictly outward-facing
    if (pin.direction === 'top') {
      assert.equal(pin.y, 0, `${sym.id} top pin ${pin.id} must be at y = 0`);
    } else if (pin.direction === 'bottom') {
      assert.equal(pin.y, sym.height, `${sym.id} bottom pin ${pin.id} must be at y = ${sym.height}`);
    } else if (pin.direction === 'left') {
      assert.equal(pin.x, 0, `${sym.id} left pin ${pin.id} must be at x = 0`);
    } else if (pin.direction === 'right') {
      assert.equal(pin.x, sym.width, `${sym.id} right pin ${pin.id} must be at x = ${sym.width}`);
    }
  }

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
  // German name and English name should be in their respective languages
  assert.notEqual(en.name, '', `${sym.id}: English name should not be empty`);

  // Grid alignment after rotations (0°, 90°, 180°, 270°)
  for (const unitsPerMm of [2, 4]) {
    for (const rotation of [0, 90, 180, 270] as const) {
      const scaled = scaleSymbolDefinition(sym, unitsPerMm);
      const step = 4 * unitsPerMm; // 8 for 2 units/mm
      const origin = { x: 0, y: 0 };
      const pos = snapSymbolPosition({ x: 160, y: 240 }, scaled, rotation, { spacing: step, origin }, step);
      for (const pin of scaled.pins) {
        const p = rotatedLocalPoint(pin, scaled, rotation);
        const worldX = pos.x + p.x;
        const worldY = pos.y + p.y;
        const diffX = Math.abs((worldX - origin.x) / step - Math.round((worldX - origin.x) / step));
        const diffY = Math.abs((worldY - origin.y) / step - Math.round((worldY - origin.y) / step));
        assert(diffX < 1e-9, `${sym.id} pin ${pin.id}: X grid mismatch at ${rotation}°: ${worldX}`);
        assert(diffY < 1e-9, `${sym.id} pin ${pin.id}: Y grid mismatch at ${rotation}°: ${worldY}`);
      }
    }
  }
}

// 2. Global Uniqueness
const allIds = SYMBOL_DEFINITIONS.map(s => s.id);
assert.equal(new Set(allIds).size, allIds.length, 'Every symbol ID in SYMBOL_DEFINITIONS must be unique');

console.log(`✓ All ${STANDARD_IEC_SYMBOLS.length} IEC 60617 symbols verified: standard 8-grid connections, rotations, outward ports, and DE/EN localization!`);
