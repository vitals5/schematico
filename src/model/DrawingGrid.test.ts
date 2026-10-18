import assert from 'node:assert/strict';
import { CadCanvas } from '../editor/CadCanvas';
import { gridForPage, gridStep, snapCoordinate, snapSymbolPosition } from './DrawingGrid';
import { componentInsertionPoint, positionAtInsertionPoint, rotatedLocalPoint } from './SymbolGeometry';
import { SYMBOL_DEFINITIONS, getSymbolById, getSymbolForComponent, setProjectSymbolLibrary } from './symbols';
import { Page, PlacedComponent, Project, SymbolDefinition } from './types';
import { AutoconnectEngine } from './AutoconnectEngine';
import { MacroManager } from './MacroManager';
import { wirePolyline } from './WireRouting';

const scale = 1000 / 420;
const close = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const grid = { spacing: 4 * scale, origin: { x: 0, y: 297 * scale } };
const page = { id: 'page', components: [], wires: [], grid, plotFrame: { width: 1000, height: 297 * scale } } as unknown as Page;
const project = { pages: [page], symbolLibrary: [], drawingUnitsPerMm: scale, activePageId: 'page' } as unknown as Project;
setProjectSymbolLibrary(project);
close(gridStep(grid.spacing, 'half'), 2 * scale);
close(gridStep(grid.spacing, 'fine'), scale);
close(gridStep(grid.spacing, 'full', true), 2 * scale);
assert.equal(snapCoordinate(12.345, 0), 12.345, 'Grid off means no integer-pixel rounding');
close(snapCoordinate(49.1 * scale, grid.spacing, grid.origin.y), 49 * scale);

// Imported contour bounds may start at a fraction of a millimetre. The logical
// source insertion stays on-grid, including all four orientations.
const source: SymbolDefinition = { id: 'source', name: 'Source', category: 'controls', standard: 'DIN EN 60617',
  defaultBmkPrefix: '', defaultFunctionText: '', description: '', width: 11.5 * scale, height: 8.75 * scale,
  unitsPerMm: scale, insertionPoint: { x: .75 * scale, y: 4 * scale }, svgContent: '',
  pins: [{ id: '0', name: '1', x: .75 * scale, y: 0, direction: 'top' }],
  source: { library: 'test', number: 1, variant: 0 } };
project.symbolLibrary!.push(source);
for (const rotation of [0, 90, 180, 270] as const) {
  const pos = positionAtInsertionPoint({ x: 56 * scale, y: 49 * scale }, source, rotation);
  const c: PlacedComponent = { id: 'c', symbolId: source.id, ...pos, rotation, bmk: '', functionText: '', pins: {} };
  const dragged = snapSymbolPosition({ x: pos.x + .2 * scale, y: pos.y - .1 * scale }, source, rotation, grid, grid.spacing);
  close(dragged.x, pos.x); close(dragged.y, pos.y);
  const pin = AutoconnectEngine.getRotatedPinInfo(c, source.pins[0], source);
  const exact = rotatedLocalPoint(source.pins[0], source, rotation);
  close(pin.worldX, c.x + exact.x); close(pin.worldY, c.y + exact.y);
}

// Every built-in port is on the documented 1-mm fine lattice. Corrected
// multipoles share a 12-mm pitch, and lookup scales SVG and physical ports alike.
for (const symbol of SYMBOL_DEFINITIONS) {
  assert(symbol.insertionPoint && symbol.unitsPerMm === 2);
  for (const pin of symbol.pins) {
    close(pin.x / 2, Math.round(pin.x / 2)); close(pin.y / 2, Math.round(pin.y / 2));
  }
}
const breaker = getSymbolById('circuit_breaker_3p', project)!;
close((breaker.pins[2].x - breaker.pins[0].x) / scale, 12);
assert.match(breaker.svgContent, /transform="scale\(/);
const canvas: any = Object.assign(Object.create(CadCanvas.prototype), { project, activePage: page,
  gridSize: 8, gridSnap: true, gridResolution: 'full', ghostRotation: 0, activeSymbolToPlace: source.id,
  callbacks: { onSelectComponent: () => undefined }, autoconnectEnabled: false, notifyModified: () => undefined, render: () => undefined });
const placed = canvas.placeSymbolAt(56.2 * scale, 49.1 * scale) as PlacedComponent;
close(componentInsertionPoint(placed, source).x, 56 * scale);
close(componentInsertionPoint(placed, source).y, 49 * scale);
const before = componentInsertionPoint(placed, source);
for (let i = 0; i < 4; i++) {
  canvas.rotateSelected();
  close(componentInsertionPoint(placed, source).x, before.x);
  close(componentInsertionPoint(placed, source).y, before.y);
}
canvas.gridResolution = 'off';
close(canvas.snap(12.12345), 12.12345);
canvas.gridResolution = 'full';
const elbow = wirePolyline({ x: 0, y: 45 * scale }, { x: 16 * scale, y: 54 * scale }, [], undefined, undefined, false, grid);
close((elbow[1].y - grid.origin.y) / grid.spacing, Math.round((elbow[1].y - grid.origin.y) / grid.spacing));

// Adjacent native-grid columns must not be auto-connected by a 2px pixel
// tolerance. Exact physical alignment still connects after scaling the palette.
const coil = getSymbolById('contactor_coil', project)!;
const first: PlacedComponent = { id: 'a', symbolId: coil.id, x: 0, y: 0, rotation: 0, bmk: '-K1', functionText: '', pins: {} };
const second = { ...first, id: 'b', x: scale / 4, y: coil.height + 4 * scale };
const autoPage: Page = { ...page, components: [first, second], wires: [] };
AutoconnectEngine.updatePageAutoconnections(autoPage);
assert.equal(autoPage.wires.length, 0);
second.x = 0;
AutoconnectEngine.updatePageAutoconnections(autoPage);
assert.equal(autoPage.wires.length, 1);
close(autoPage.wires[0].lineWidth!, .25 * scale);

// Macro geometry and saved waypoints travel with their original units. A
// contour-box offset must not shift the entire imported macro off the lattice.
const secondPlaced = { ...placed, id: 'd', x: placed.x + 8 * scale };
const wire = { id: 'w', from: { componentId: placed.id, pinId: '0' }, to: { componentId: secondPlaced.id, pinId: '0' },
  potential: 'Signal', waypoints: [{ x: 56 * scale, y: 41 * scale }], lineWidth: .25 * scale };
const macro = MacroManager.createMacroFromComponents('grid', '', '', [placed, secondPlaced], [wire]);
const targetProject = { ...project, drawingUnitsPerMm: 2, symbolLibrary: [], pages: [] };
const instance = MacroManager.instantiateWindowMacro(macro, 100, 200, [], targetProject);
const factor = 2 / scale;
const restoredSymbol = getSymbolForComponent(instance.components[0], targetProject)!;
close(restoredSymbol.pins[0].x / 2, source.pins[0].x / scale);
close(instance.wires[0].waypoints![0].x, 100 + (wire.waypoints[0].x - placed.x) * factor);
close(instance.wires[0].waypoints![0].y, 200 + (wire.waypoints[0].y - placed.y) * factor);
assert.deepEqual(gridForPage(JSON.parse(JSON.stringify(page))), grid);
console.log('✓ Physical grid origin, source insertion, standard palette pitch, rotation, strict autoconnect and macro units');
