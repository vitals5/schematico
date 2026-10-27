import assert from 'node:assert/strict';
import { fixture } from '../layout/testing/fixture';
import { cleanupConnections } from './WireCleanup';
import { snapshotPage } from '../layout/geometry';
import { parallelOverlap } from '../layout/validate';
import { moveWireSegment, wirePolyline } from './WireRouting';
import { clone } from '../layout/types';
const project = fixture();
const page = project.pages[0];
page.grid = { spacing: 8, origin: { x: 0, y: 0 } } as any;
project.symbolLibrary = ['bottom', 'top'].map(direction => ({ id: 'test-' + direction, name: 'port', category: 'connection', standard: '', defaultBmkPrefix: '', defaultFunctionText: '', description: '', width: 2, height: 2, svgContent: '', pins: [{ id: '1', name: '', x: 1, y: direction === 'bottom' ? 2 : 0, direction }] } as any));
for (const [id, x, y, d] of [['s1', 100, 100, 'bottom'], ['s2', 140, 100, 'bottom'], ['t1', 400, 400, 'top'], ['t2', 440, 400, 'top']] as const)
  page.components.push({ id, symbolId: 'test-' + d, bmk: '', functionText: '', x, y, rotation: 0, pins: { '1': { wireIds: [] } } });
page.wires = [1, 2].map(i => ({ id: 'w' + i, from: { componentId: 's' + i, pinId: '1' }, to: { componentId: 't' + i, pinId: '1' }, potential: 'L' + i, wireNumber: String(i), crossSection: '2.5mm²', color: 'BK', waypoints: [{ x: (i === 1 ? 101 : 141), y: 240 }, { x: i === 1 ? 401 : 441, y: 240 }], isAutoconnect: false }));
const original = clone(project), endpoints = page.wires.map(({ waypoints, ...rest }) => rest);
const before = snapshotPage(page, project);
assert(parallelOverlap(before.edges[0].points[1], before.edges[0].points[2], before.edges[1].points[1], before.edges[1].points[2]));
const single = cleanupConnections(page, project, ['w1']);
assert(single.changed.includes('w1'));
assert.deepEqual(single.failed, []);
assert.deepEqual(page.wires[1], original.pages[0].wires[1], 'Single cleanup preserves the neighbouring route byte-for-byte');
assert.deepEqual(page.wires.map(({ waypoints, routingMode, ...rest }) => rest), endpoints);
const routed = snapshotPage(page, project);
for (const a of routed.edges[0].points.slice(1).map((p, i) => [routed.edges[0].points[i], p]))
  for (const b of routed.edges[1].points.slice(1).map((p, i) => [routed.edges[1].points[i], p]))
    assert(!parallelOverlap(a[0], a[1], b[0], b[1]));
assert.deepEqual(page.components, original.pages[0].components, 'No component movement');
const full = clone(original);
const all = cleanupConnections(full.pages[0], full);
assert.equal(all.failed.length, 0);
assert(all.changed.length > 0);
const automatic = clone(original);
automatic.pages[0].wires[0].isAutoconnect = true;
const unchanged = JSON.stringify(automatic.pages[0].wires[0]);
cleanupConnections(automatic.pages[0], automatic);
assert.equal(JSON.stringify(automatic.pages[0].wires[0]), unchanged);
// Missing pins and impossible corridors retain all original waypoints.
const broken = clone(original);
broken.pages[0].wires[0].to.pinId = 'missing';
const old = clone(broken.pages[0].wires[0]);
assert.deepEqual(cleanupConnections(broken.pages[0], broken, ['w1']).failed, ['w1']);
assert.deepEqual(broken.pages[0].wires[0], old);
const manual = moveWireSegment([{ x: 0, y: 0 }, { x: 0, y: 20 }, { x: 40, y: 20 }, { x: 40, y: 50 }], 1, 30);
assert.deepEqual(manual, [{ x: 0, y: 0 }, { x: 0, y: 30 }, { x: 40, y: 30 }, { x: 40, y: 50 }]);
const straight = moveWireSegment([{ x: 0, y: 0 }, { x: 40, y: 0 }], 0, 20);
assert.deepEqual(straight, [{ x: 0, y: 0 }, { x: 0, y: 20 }, { x: 40, y: 20 }, { x: 40, y: 0 }]);
assert.deepEqual(wirePolyline(manual[0], manual.at(-1)!, manual.slice(1, -1), 'bottom', 'top'), manual);
console.log('✓ Single/page cleanup, distinct nets, immutable neighbours/autoconnect, safe failure and editable orthogonal bends');
// Near-coincident parallel runs are separated, not just exact duplicates.
for (const [i, edge] of routed.edges.entries())
  for (const [j, other] of routed.edges.entries())
    if (i < j)
      for (const [k, p] of edge.points.slice(1).entries())
        for (const [m, q] of other.points.slice(1).entries()) {
          const a = edge.points[k], b = other.points[m];
          if (Math.abs(a.y - p.y) < 1e-6 && Math.abs(b.y - q.y) < 1e-6 && Math.min(Math.max(a.x, p.x), Math.max(b.x, q.x)) > Math.max(Math.min(a.x, p.x), Math.min(b.x, q.x)) + 1e-6)
            assert(Math.abs(a.y - b.y) >= 4 - 1e-6);
          if (Math.abs(a.x - p.x) < 1e-6 && Math.abs(b.x - q.x) < 1e-6 && Math.min(Math.max(a.y, p.y), Math.max(b.y, q.y)) > Math.max(Math.min(a.y, p.y), Math.min(b.y, q.y)) + 1e-6)
            assert(Math.abs(a.x - b.x) >= 4 - 1e-6);
        }
// New manual connections use the same router before the single history notification.
const { CadCanvas } = await import('../editor/CadCanvas');
const drawing = clone(original);
const drawingPage = drawing.pages[0];
drawingPage.components.push({ ...clone(drawingPage.components[0]), id: 's3', x: 180 }, { ...clone(drawingPage.components[2]), id: 't3', x: 480 });
let notifications = 0;
const canvas: any = Object.assign(Object.create(CadCanvas.prototype), { project: drawing, activePage: drawingPage, mode: 'wire', wireStart: { componentId: 's3', pinId: '1' }, notifyModified: () => notifications++, render: () => { } });
canvas.handlePinClick({ componentId: 't3', pinId: '1' });
assert.equal(drawingPage.wires.length, 3);
assert.equal(notifications, 1);
assert.equal(drawingPage.wires[2].routingMode, 'auto');
assert(drawingPage.wires[2].waypoints!.length > 0);
// Explicitly adjusted bends are preserved by the automatic component-move hook.
drawingPage.wires[0].routingMode = 'manual';
const edited = clone(drawingPage.wires[0]);
drawingPage.components[0].x += 16;
canvas.rerouteMovedComponents(['s1']);
assert.deepEqual(drawingPage.wires[0], edited);
console.log('✓ Raster lane clearance, new-wire routing and manual override preservation');

// The live preview must not edit a real connection, even if its ID resembles the preview ID.
drawingPage.wires[0].id='__wire_preview__';
canvas.wireStart={componentId:'s3',pinId:'1'};canvas.hoveredPin={componentId:'t2',pinId:'1'};canvas.gridSize=8;canvas.currentMousePos={x:0,y:0};
const previewOriginal=JSON.stringify(drawing);
assert.match(canvas.renderInteractiveWire(),/<path/);
assert.equal(JSON.stringify(drawing),previewOriginal,'Hovering over a target must not change the project');
console.log('✓ Live routing preview is isolated from stored connections');
