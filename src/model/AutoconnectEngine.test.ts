// src/model/AutoconnectEngine.test.ts
// Automated verification test suite for Autoconnecting and Connection Symbols

import { SYMBOL_DEFINITIONS, getSymbolById } from './symbols';
import { AutoconnectEngine } from './AutoconnectEngine';
import { PlacedComponent, Page } from './types';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('\n--- 1. Testing Connection Symbols Library ---');
const expectedSymbols = [
  't_piece_down', 't_piece_up', 't_piece_right', 't_piece_left',
  'corner_top_right', 'corner_top_left', 'corner_bottom_right', 'corner_bottom_left',
  'cross_junction', 'cross_bridge',
  'potential_arrow_right', 'potential_arrow_left',
  'potential_arrow_down', 'potential_arrow_up'
];

for (const symId of expectedSymbols) {
  const sym = getSymbolById(symId);
  assert(!!sym, `Symbol "${symId}" exists in library`);
  assert(sym?.category === 'connections', `Symbol "${symId}" has category "connections"`);
  assert(sym?.pins.length! > 0, `Symbol "${symId}" has pins defined (${sym?.pins.length})`);
  assert(sym?.svgContent.length! > 10, `Symbol "${symId}" has valid SVG drawing content`);
}

console.log('\n--- 2. Testing Pin Rotation & Effective Direction ---');
// Test T-piece rotated at 0, 90, 180, 270
const tPieceSym = getSymbolById('t_piece_down')!;
// t_piece_down default pins:
// 1: x:0, y:10, dir: 'left'
// 2: x:20, y:10, dir: 'right'
// 3: x:10, y:20, dir: 'bottom'
const compT: PlacedComponent = {
  id: 't1',
  symbolId: 't_piece_down',
  bmk: 'T1',
  functionText: '',
  x: 100,
  y: 100,
  rotation: 0,
  pins: {}
};

// 0 degrees
let pin3_0 = AutoconnectEngine.getRotatedPinInfo(compT, tPieceSym.pins[2], tPieceSym);
assert(pin3_0.worldX === 110 && pin3_0.worldY === 120, 'Pin 3 at 0° is (110, 120)');
assert(pin3_0.direction === 'bottom', 'Pin 3 at 0° direction is "bottom"');

// 90 degrees
compT.rotation = 90;
let pin3_90 = AutoconnectEngine.getRotatedPinInfo(compT, tPieceSym.pins[2], tPieceSym);
assert(pin3_90.direction === 'left', 'Pin 3 at 90° direction is "left" (bottom rotated 90° -> left)');
assert(pin3_90.worldX === 100 && pin3_90.worldY === 110, 'Pin 3 at 90° is (100, 110)');

// 180 degrees
compT.rotation = 180;
let pin3_180 = AutoconnectEngine.getRotatedPinInfo(compT, tPieceSym.pins[2], tPieceSym);
assert(pin3_180.direction === 'top', 'Pin 3 at 180° direction is "top"');
assert(pin3_180.worldX === 110 && pin3_180.worldY === 100, 'Pin 3 at 180° is (110, 100)');

// 270 degrees
compT.rotation = 270;
let pin3_270 = AutoconnectEngine.getRotatedPinInfo(compT, tPieceSym.pins[2], tPieceSym);
assert(pin3_270.direction === 'right', 'Pin 3 at 270° direction is "right"');
assert(pin3_270.worldX === 120 && pin3_270.worldY === 110, 'Pin 3 at 270° is (120, 110)');

console.log('\n--- 3. Testing Vertical & Horizontal Autoconnecting ---');
// Component A (Terminal single: top pin at (6,0) dir top, bottom pin at (6,24) dir bottom)
// Terminal width: 12, height: 24
const termA: PlacedComponent = {
  id: 'termA',
  symbolId: 'terminal_single',
  bmk: '-X1:1',
  functionText: '',
  x: 200,
  y: 100,
  rotation: 0,
  pins: {}
};
// Terminal A bottom pin is at x = 200 + 6 = 206, y = 100 + 24 = 124, dir = 'bottom'

// Component B aligned directly below Component A
const termB: PlacedComponent = {
  id: 'termB',
  symbolId: 'terminal_single',
  bmk: '-X1:2',
  functionText: '',
  x: 200,
  y: 180,
  rotation: 0,
  pins: {}
};
// Terminal B top pin is at x = 200 + 6 = 206, y = 180 + 0 = 180, dir = 'top'

let pairs = AutoconnectEngine.findAutoconnectPairs([termA, termB]);
assert(pairs.length === 1, `Found 1 vertical autoconnect pair (got ${pairs.length})`);
assert(pairs[0].orientation === 'vertical', 'Pair orientation is vertical');
assert(pairs[0].pin1.componentId === 'termA' && pairs[0].pin2.componentId === 'termB', 'Connected termA to termB');
assert(pairs[0].distance === 180 - 140, `Distance is ${180 - 140}px`);

// Test Horizontal Autoconnecting between T-pieces or corners
const tLeft: PlacedComponent = {
  id: 'tLeft',
  symbolId: 't_piece_down',
  bmk: 'T1',
  functionText: '',
  x: 300,
  y: 200,
  rotation: 0,
  pins: {}
};
// tLeft right pin is at x: 300 + 20 = 320, y: 200 + 10 = 210, dir: 'right'

const tRight: PlacedComponent = {
  id: 'tRight',
  symbolId: 't_piece_down',
  bmk: 'T2',
  functionText: '',
  x: 400,
  y: 200,
  rotation: 0,
  pins: {}
};
// tRight left pin is at x: 400 + 0 = 400, y: 200 + 10 = 210, dir: 'left'

let hPairs = AutoconnectEngine.findAutoconnectPairs([tLeft, tRight]);
assert(hPairs.length === 1, `Found 1 horizontal autoconnect pair (got ${hPairs.length})`);
assert(hPairs[0].orientation === 'horizontal', 'Pair orientation is horizontal');
assert(hPairs[0].distance === 400 - 320, `Horizontal distance is ${400 - 320}px`);

console.log('\n--- 4. Testing Autoconnect Page Update & Obsolete Wire Clearing ---');
const page: Page = {
  id: 'p1',
  pageNumber: '1',
  pageType: 'schematic',
  title: 'Test',
  higherLevel: '=A1',
  location: '+S1',
  components: [termA, termB],
  wires: [],
  plotFrame: {
    type: 'DIN_A3_LANDSCAPE',
    width: 1000,
    height: 700,
    columns: 10,
    rows: ['A', 'B', 'C', 'D', 'E', 'F'],
    titleBlock: {} as any
  }
};

AutoconnectEngine.updatePageAutoconnections(page);
assert(page.wires.length === 1, `Page now has 1 autoconnect wire (got ${page.wires.length})`);
assert(page.wires[0].isAutoconnect === true, 'Wire is flagged as isAutoconnect: true');

// Move termB out of alignment
termB.x = 250;
AutoconnectEngine.updatePageAutoconnections(page);
assert(page.wires.length === 0, 'Obsolete autoconnect wire automatically cleared when components are no longer aligned');

// Move termB back into alignment
termB.x = 200;
AutoconnectEngine.updatePageAutoconnections(page);
assert(page.wires.length === 1, 'Autoconnect wire automatically restored when aligned again');

console.log('\n--- 5. Testing Live Autoconnect Preview ---');
// Test ghost preview while dragging or placing termB
const previews = AutoconnectEngine.getAutoconnectPreview([termA], termB);
assert(previews.length === 1, `Live preview generates 1 target connection segment (got ${previews.length})`);
assert(previews[0].x1 === 212 && previews[0].y1 === 180, 'Preview start point matches moving pin');
assert(previews[0].targetX === 212 && previews[0].targetY === 140, 'Preview target matches existing component pin');

console.log('\n--- 6. Testing Rotation of All Elements ---');
// Rotating any element (e.g. corner symbol, motor, contactor, etc.)
const corner: PlacedComponent = {
  id: 'c1',
  symbolId: 'corner_top_right',
  bmk: 'W1',
  functionText: '',
  x: 500,
  y: 300,
  rotation: 0,
  pins: {}
};
const cornerSym = getSymbolById('corner_top_right')!;

for (const angle of [0, 90, 180, 270] as const) {
  corner.rotation = angle;
  const p1 = AutoconnectEngine.getRotatedPinInfo(corner, cornerSym.pins[0], cornerSym);
  const p2 = AutoconnectEngine.getRotatedPinInfo(corner, cornerSym.pins[1], cornerSym);
  assert(typeof p1.worldX === 'number' && !isNaN(p1.worldX), `Corner at ${angle}° pin 1 X is valid number`);
  assert(typeof p2.worldY === 'number' && !isNaN(p2.worldY), `Corner at ${angle}° pin 2 Y is valid number`);
}

console.log('\n--- 7. Testing 3-Phase Autoconnecting to Motor ---');
const k1Power: PlacedComponent = {
  id: 'k1',
  symbolId: 'contactor_power_3p',
  bmk: '-K1',
  functionText: 'Schütz',
  x: 220,
  y: 280,
  rotation: 0,
  pins: {}
};
const motor: PlacedComponent = {
  id: 'm1',
  symbolId: 'motor_3phase',
  bmk: '-M1',
  functionText: 'Motor',
  x: 220,
  y: 400,
  rotation: 0,
  pins: {}
};

const threePhasePairs = AutoconnectEngine.findAutoconnectPairs([k1Power, motor]);
assert(threePhasePairs.length === 3, `Found 3 autoconnect pairs for 3-phase motor (got ${threePhasePairs.length})`);
assert(threePhasePairs[0].pin1.worldX === 232 && threePhasePairs[0].pin2.worldX === 232, 'Phase L1 pins aligned at X=232');
assert(threePhasePairs[1].pin1.worldX === 256 && threePhasePairs[1].pin2.worldX === 256, 'Phase L2 pins aligned at X=256');
assert(threePhasePairs[2].pin1.worldX === 280 && threePhasePairs[2].pin2.worldX === 280, 'Phase L3 pins aligned at X=280');

console.log('\n--- 8. Testing Wire Disconnection & Suppression ---');
const testPage: Page = {
  id: 'p_test',
  pageNumber: '1',
  pageType: 'schematic',
  title: 'Test',
  higherLevel: '=A1',
  location: '+S1',
  components: [k1Power, motor],
  wires: [],
  plotFrame: {} as any
};
AutoconnectEngine.updatePageAutoconnections(testPage);
assert(testPage.wires.length === 3, `Initially generated 3 autowires (got ${testPage.wires.length})`);

// User disconnects wire 1
const wireToDisconnect = testPage.wires[0];
AutoconnectEngine.suppressAutoconnection(testPage, wireToDisconnect);
testPage.wires = testPage.wires.filter(w => w.id !== wireToDisconnect.id);
// Run updatePageAutoconnections again: wireToDisconnect should NOT be restored because it is suppressed
AutoconnectEngine.updatePageAutoconnections(testPage);
assert(testPage.wires.length === 2, `Suppressed wire stays disconnected (got ${testPage.wires.length})`);

// When component moves, suppression is cleared and reconnection works
AutoconnectEngine.clearSuppressedForComponent(testPage, k1Power.id);
AutoconnectEngine.updatePageAutoconnections(testPage);
assert(testPage.wires.length === 3, `Reconnecting restored after clearSuppressedForComponent (got ${testPage.wires.length})`);

console.log('\n--- 9. Testing Halbraster (Half-Grid) Autoconnecting & Tolerance Clustering ---');
// Component on half-raster (X = 236, which is an odd multiple of 4: 236 / 4 = 59, not a multiple of 8: 236 / 8 = 29.5)
const halfTermTop: PlacedComponent = {
  id: 'halfTop',
  symbolId: 'terminal_single',
  bmk: '-X2:1',
  functionText: '',
  x: 236 - 12, // pin at x + 12 = 236
  y: 100,
  rotation: 0,
  pins: {}
};
const halfTermBottom: PlacedComponent = {
  id: 'halfBottom',
  symbolId: 'terminal_single',
  bmk: '-X2:2',
  functionText: '',
  x: 236 - 12, // pin at x + 12 = 236
  y: 160,
  rotation: 0,
  pins: {}
};

const halfPairs = AutoconnectEngine.findAutoconnectPairs([halfTermTop, halfTermBottom]);
assert(halfPairs.length === 1, `Halbraster components connect automatically (got ${halfPairs.length})`);
assert(halfPairs[0].pin1.worldX === 236 && halfPairs[0].pin2.worldX === 236, 'Both pins aligned at half-raster X=236');

// Tolerance test: Pin 1 at X=236, Pin 2 at X=235 (1px subpixel delta)
halfTermBottom.x = 235 - 12;
const tolPairs = AutoconnectEngine.findAutoconnectPairs([halfTermTop, halfTermBottom]);
assert(tolPairs.length === 1, `Pins within <= 2px tolerance cluster and connect (got ${tolPairs.length})`);

// Non-matching test: Pin 1 at X=236, Pin 2 at X=232 (4px difference: distinct columns)
halfTermBottom.x = 232 - 12;
const diffPairs = AutoconnectEngine.findAutoconnectPairs([halfTermTop, halfTermBottom]);
assert(diffPairs.length === 0, `Pins on different raster columns (4px apart) do NOT false-connect (got ${diffPairs.length})`);

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 100% COMPATIBLE AUTOCONNECTING & HALBRASTER SUPPORT!');
