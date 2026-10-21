import assert from 'node:assert/strict';
import { findNearestWall, calculateArcControlPoint, arcWireSvgPath, floorPlanToSvg } from './FloorPlanRenderer';
import { FloorPlanData, WallSegment } from './types';

console.log('Testing FloorPlanRenderer...');

// 1. Test Nearest Wall Calculation & Snapping
const walls: WallSegment[] = [
  { id: 'w1', start: { x: 100, y: 100 }, end: { x: 500, y: 100 }, thickness: 16, isExterior: true },
  { id: 'w2', start: { x: 500, y: 100 }, end: { x: 500, y: 400 }, thickness: 12, isExterior: false }
];

// Point near horizontal wall w1 at y = 115 (below wall)
const snapHorizontal = findNearestWall({ x: 250, y: 115 }, walls, 30);
assert(snapHorizontal, 'Should find nearest wall');
assert.equal(snapHorizontal.wall.id, 'w1');
assert.equal(snapHorizontal.snappedPoint.x, 250);
assert.equal(snapHorizontal.snappedPoint.y, 108); // Outer surface: 100 + halfThickness (8)
assert.equal(snapHorizontal.wallCenterPoint?.y, 100);
assert.equal(snapHorizontal.rotation, 0); // Faces DOWN into room
assert(snapHorizontal.distance <= 15.1);

// Point near vertical wall w2 at x = 490 (left of wall)
const snapVertical = findNearestWall({ x: 490, y: 250 }, walls, 30);
assert(snapVertical, 'Should find nearest wall');
assert.equal(snapVertical.wall.id, 'w2');
assert.equal(snapVertical.snappedPoint.x, 494); // Outer surface: 500 - halfThickness (6)
assert.equal(snapVertical.snappedPoint.y, 250);
assert.equal(snapVertical.wallCenterPoint?.x, 500);
assert.equal(snapVertical.rotation, 90); // Faces LEFT into room

// Point too far from any wall
const snapTooFar = findNearestWall({ x: 300, y: 300 }, walls, 20);
assert.equal(snapTooFar, null, 'Should return null when distance exceeds maxDistance');

// 2. Test Arc Wire Control Point & Path
const p1 = { x: 100, y: 100 };
const p2 = { x: 200, y: 100 };
const ctrl = calculateArcControlPoint(p1, p2, 0.25);
assert.equal(ctrl.x, 150, 'Midpoint X');
assert.notEqual(ctrl.y, 100, 'Control point Y must be deflected perpendicularly');

const svgPath = arcWireSvgPath(p1, p2, 0.25);
assert(svgPath.startsWith('M 100 100 Q 150 '), 'SVG path format must be M ... Q ...');

// 3. Test floorPlanToSvg rendering
const testPlan: FloorPlanData = {
  scale: { scaleRatio: 100, pixelPerMeter: 50 },
  walls,
  openings: [
    { id: 'op1', kind: 'door', center: { x: 200, y: 100 }, width: 80, orientation: 'horizontal' },
    { id: 'op2', kind: 'window', center: { x: 400, y: 100 }, width: 100, orientation: 'horizontal' },
    { id: 'op3', kind: 'door', center: { x: 500, y: 250 }, width: 80, orientation: 'vertical', wallId: 'w2' }
  ],
  rooms: [
    { id: 'r1', name: 'Wohnzimmer', areaM2: 24.5, polygon: [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 400 }, { x: 100, y: 400 }] }
  ],
  backgroundImage: {
    dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    opacity: 0.35,
    visible: true,
    bounds: { x: 93, y: 25, width: 655, height: 530 }
  }
};

const svg = floorPlanToSvg(testPlan);
assert(svg.includes('class="floorplan-door"'), 'Must contain door');
assert(svg.includes('class="floorplan-window"'), 'Must contain window');
assert(!svg.includes('class="floorplan-room-label"'), 'Rooms are removed in favor of text elements');
assert(!svg.includes('24.5 m²'), 'Must not render room area in m²');
assert(svg.includes('<image href="data:image/png;base64,'), 'Must render background image');
assert(svg.includes('width="655" height="530"'), 'Must use exact fitted image dimensions');

// Test wall and opening interactive selection
const selectedSvg = floorPlanToSvg(testPlan, {
  selectedWallId: 'w1',
  selectedOpeningId: 'op1',
  interactive: true
});
assert(selectedSvg.includes('data-wall-handle="start"'), 'Must render start handle for selected wall');
assert(selectedSvg.includes('data-wall-handle="end"'), 'Must render end handle for selected wall');
assert(selectedSvg.includes('class="floorplan-wall selected"'), 'Must mark selected wall');
assert(selectedSvg.includes('class="floorplan-door selected"'), 'Must mark selected door');
assert(selectedSvg.includes('class="floorplan-opening-handle"'), 'Must render opening handle');

// 4. Test door swing right, simple opening, garage door, and showRoomLabels toggle
const advancedPlan: FloorPlanData = {
  scale: { scaleRatio: 100, pixelPerMeter: 50 },
  walls,
  openings: [
    { id: 'door_right', kind: 'door', center: { x: 200, y: 100 }, width: 80, orientation: 'horizontal', swingDirection: 'right_in' },
    { id: 'open1', kind: 'opening', center: { x: 300, y: 100 }, width: 80, orientation: 'horizontal' },
    { id: 'garage1', kind: 'garage_door', center: { x: 400, y: 100 }, width: 120, orientation: 'horizontal' }
  ],
  rooms: [
    { id: 'r1', name: 'Wohnzimmer', areaM2: 24.5, polygon: [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 400 }, { x: 100, y: 400 }] }
  ]
};

const advSvg = floorPlanToSvg(advancedPlan, { interactive: false });
assert(advSvg.includes('class="floorplan-opening"'), 'Must render passage opening');
assert(advSvg.includes('class="floorplan-garage"'), 'Must render garage door');
assert(advSvg.includes('stroke-dasharray="3,3"'), 'Must render overhead tracks for garage door');
assert(!advSvg.includes('floorplan-wall-hit'), 'Non-interactive mode must not include wall hit lines');

// 5. Test multi-tier snapping
const tier0Snap = findNearestWall({ x: 250, y: 110 }, walls, 40, 50, 16);
assert(tier0Snap, 'Must snap to wall');
const tier1Snap = findNearestWall({ x: 250, y: 130 }, walls, 50, 50, 16);
assert(tier1Snap, 'Must snap to wall tier');
assert(tier1Snap.snappedPoint.y > tier0Snap.snappedPoint.y, 'Tier 1 must be further away from wall than Tier 0');

console.log('✓ FloorPlanRenderer tests passed successfully!');
