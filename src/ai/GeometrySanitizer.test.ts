import assert from 'node:assert/strict';
import { snapWallOrientation, snapCorners, sanitizeFloorPlanGeometry, RawAiFloorPlanResponse } from './GeometrySanitizer';

console.log('Testing GeometrySanitizer...');

// 1. Test wall angle snapping
const horizontalSlightlyTilted = snapWallOrientation({ x: 0, y: 0 }, { x: 100, y: 3 }, 5);
assert.equal(horizontalSlightlyTilted.end.y, 0, 'Almost horizontal wall should snap to y = 0');

const verticalSlightlyTilted = snapWallOrientation({ x: 0, y: 0 }, { x: 2, y: 100 }, 5);
assert.equal(verticalSlightlyTilted.end.x, 0, 'Almost vertical wall should snap to x = 0');

const diag45SlightlyTilted = snapWallOrientation({ x: 0, y: 0 }, { x: 98, y: 102 }, 5);
assert.equal(diag45SlightlyTilted.end.x, diag45SlightlyTilted.end.y, 'Almost 45-deg wall should snap to x = y');

// 2. Test corner snapping
const rawWalls = [
  { id: 'w1', start: { x: 0, y: 0 }, end: { x: 102, y: 1 }, thickness: 16 },
  { id: 'w2', start: { x: 100, y: 3 }, end: { x: 100, y: 200 }, thickness: 16 }
];
const snapped = snapCorners(rawWalls, 8);
assert.equal(snapped[0].end.x, snapped[1].start.x, 'Corner endpoints must snap to same X');
assert.equal(snapped[0].end.y, snapped[1].start.y, 'Corner endpoints must snap to same Y');

// 3. Test full floorplan sanitization from raw AI output
const sampleAiOutput: RawAiFloorPlanResponse = {
  scaleEstimate: { detectedScaleText: '1:100', detectedDimensionMeters: 5.5 },
  walls: [
    { x1: 100, y1: 100, x2: 900, y2: 102, isExterior: true },
    { x1: 900, y1: 100, x2: 901, y2: 700, isExterior: true },
    { x1: 900, y1: 700, x2: 100, y2: 698, isExterior: true },
    { x1: 100, y1: 700, x2: 101, y2: 100, isExterior: true },
    { x1: 500, y1: 100, x2: 501, y2: 700, isExterior: false } // Inner wall
  ],
  openings: [
    { kind: 'door', x: 500, y: 300, width: 90, swingDirection: 'left_in' },
    { kind: 'window', x: 300, y: 100, width: 120 }
  ],
  rooms: [
    { name: 'Wohnzimmer', centerX: 300, centerY: 400, approxAreaM2: 28.5 },
    { name: 'Küche', centerX: 700, centerY: 400, approxAreaM2: 16.2 }
  ]
};

const sanitized = sanitizeFloorPlanGeometry(sampleAiOutput, { canvasWidth: 800, canvasHeight: 560 });
assert.equal(sanitized.walls.length, 5, 'Should have 5 walls');
assert.equal(sanitized.openings.length, 2, 'Should have 2 openings');
assert.equal(sanitized.rooms.length, 2, 'Should have 2 rooms');
assert.equal(sanitized.rooms[0].name, 'Wohnzimmer');
assert.equal(sanitized.rooms[1].name, 'Küche');
assert.equal(sanitized.openings[0].kind, 'door');
assert.equal(sanitized.openings[1].kind, 'window');
assert(sanitized.walls[0].thickness >= 8, 'Wall thickness must be at least 8');

console.log('✓ GeometrySanitizer tests passed successfully!');
