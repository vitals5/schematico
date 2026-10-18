import { openNativeFixture } from './testing/NativeFixture';
import assert from 'node:assert/strict';
import { EdbProjectParser } from './EdbProjectParser';
import { EodRecord, readEodTable } from './EodReader';
import { AutoconnectEngine } from '../model/AutoconnectEngine';
import { CrossReferenceEngine } from '../model/CrossReferenceEngine';
import { getSymbolById, getSymbolForComponent, setProjectSymbolLibrary } from '../model/symbols';
import { PdfExporter } from '../export/PdfExporter';
import { connectionCutouts, supersededConnectionGraphics } from '../model/ConnectionGraphics';
import { CadCanvas } from '../editor/CadCanvas';
import { NATIVE_SCALE } from './NativeSymbolLibrary';
import { componentInsertionPoint } from '../model/SymbolGeometry';
import { gridForPage, snapSymbolPosition } from '../model/DrawingGrid';
import { Page, PlacedComponent, Project } from '../model/types';

const fixture=await openNativeFixture();
if(fixture){
const {zip,root}=fixture;

const { project, messages } = await EdbProjectParser.parseEdbProject(zip);
const page = project.pages.find(p => p.title === 'Einspeisung')!;
assert(project.symbolLibrary?.length);
assert.equal(page.importedDrawing, undefined, 'No special page drawing / theme path');
assert(page.wires.length > 0);
assert.equal(page.plotFrame.titleBlock.date, '15.09.2026');
assert.equal(project.drawingUnitsPerMm, NATIVE_SCALE);
assert.deepEqual(page.grid, { spacing: 4 * NATIVE_SCALE, origin: { x: 0, y: 297 * NATIVE_SCALE } });
assert(!messages.some(d => /Bibliotheksanschluss.*fehlt|Anschluss nicht auflösbar|Bibliothekssymbol nicht auflösbar/.test(d)), 'Every source reference must resolve');
const component = (id: number, type = 17) => page.components.find(c => c.id === `native_13_${type}_${id}`)!;
const symbol = (c: PlacedComponent) => getSymbolForComponent(c, project)!;
const pin = (c: PlacedComponent, id: number) => {
  const s = symbol(c), p = s.pins.find(p => p.id === String(id))!;
  assert(p, `Missing physical pin ${id} on ${c.id}`);
  return AutoconnectEngine.getRotatedPinInfo(c, p, s);
};
const source = (p: { worldX: number; worldY: number }) => ({ x: p.worldX * 420 / 1000, y: 297 - p.worldY * 420 / 1000 });
const close = (actual: number, expected: number) => assert(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

for (const [id, x] of [[0x9a33, 56], [0x9a34, 92]]) {
  const c = component(id);
  assert.equal(c.bmk, '-Q12'); assert.equal(symbol(c).pins.length, 8);
  const p = source(pin(c, 0)); close(p.x, x); close(p.y, 252);
}
assert.equal(component(0x9a33).symbolId, component(0x9a34).symbolId);
assert.strictEqual(symbol(component(0x9a33)), symbol(component(0x9a34)), 'Placements share one master definition');
assert.deepEqual(symbol(component(0x9a33)).source, { library: 'IEC_symbol', number: 1526, variant: 0 });
assert.equal(symbol(component(0x9a33)).importedGraphics!.length, 28, 'Actual QLTR4_2 source contours');
const insertion = componentInsertionPoint(component(0x9a33), symbol(component(0x9a33)));
close(insertion.x / NATIVE_SCALE, 56); close(297 - insertion.y / NATIVE_SCALE, 248);
const snappedQ12 = snapSymbolPosition(component(0x9a33), symbol(component(0x9a33)), 0, gridForPage(page), page.grid!.spacing);
close(snappedQ12.x, component(0x9a33).x); close(snappedQ12.y, component(0x9a33).y);
// Two upward-facing inputs must connect above the devices through the original
// corners, even though both endpoints have the same Y coordinate.
const at = (x: number, y: number) => page.components.filter(c => {
  const p = componentInsertionPoint(c, symbol(c));
  return Math.abs(p.x / NATIVE_SCALE - x) < 1e-6 && Math.abs(297 - p.y / NATIVE_SCALE - y) < 1e-6;
});
for (const [x, y] of [[92, 280], [56, 280]]) assert(at(x, y).some(c => c.source?.routingUsed), 'Original upper corners remain in the physical wire graph');
for (const id of [39475, 39476]) {
  const c = component(id), attached = page.wires.filter(w => [w.from, w.to].some(e => e.componentId === c.id && e.pinId === '0'));
  assert.equal(attached.length, 1);
  const other = attached[0].from.componentId === c.id ? attached[0].to : attached[0].from;
  const corner = page.components.find(c => c.id === other.componentId)!;
  close(297 - componentInsertionPoint(corner, symbol(corner)).y / NATIVE_SCALE, 280);
}
assert(page.wires.every(w => Math.abs(w.lineWidth! / NATIVE_SCALE - 0.25) < 1e-8));
const t66 = component(153626, 42), t66Symbol = symbol(t66);
assert(t66Symbol.connectionGraphic);
assert.equal(t66.source!.routingUsed, true);
assert(page.components.some(c => c.source?.objectType === 42 && c.source.routingUsed === false), 'Unused automatic routing records stay in the model as nonprinting helpers');
assert(t66Symbol.importedGraphics!.every(g => g.kind === 'line' && Math.abs(g.width! / NATIVE_SCALE - 0.25) < 1e-8));
assert(t66Symbol.pins.every(p => !p.labelPosition), 'Do not print physical indices on a routing node');
const bus = symbol(component(152377, 130));
assert.deepEqual([...new Set(bus.importedGraphics!.map(g => g.kind === 'line' ? Math.round(g.width! / NATIVE_SCALE * 100) / 100 : -1))].sort(), [0.25, 1]);
const replaced = supersededConnectionGraphics(page, project);
assert(replaced.has(component(38842).id), 'Explicit directed T replaces the co-located functional distributor ink');
assert(!replaced.has(component(38837).id), 'A distributor without an explicit routing glyph retains its real dot');
assert(connectionCutouts(page, project).length > 0);
const nodeSvg: any = Object.assign(Object.create(CadCanvas.prototype), { activePage: page, project, mode: 'select' });
assert.doesNotMatch(nodeSvg.renderWires(), /junction-dot/);
assert.doesNotMatch(nodeSvg.renderComponents(), /pin-handle/);
assert(!page.components.some(c => c.bmk === '-F02'), 'Deleted F02 must not reappear');
for (const [id, label, x] of [[0xab, 'L1', 156], [0xac, 'L2', 164], [0xad, 'L3', 172], [0x8991, 'PEN', 188]] as const) {
  const c = component(id), p = source(pin(c, 0));
  assert.equal(c.deviceTag, label); close(p.x, x); close(p.y, 74);
}
for (const [terminal, fusePin] of [[0xab, 0], [0xac, 2], [0xad, 4]]) {
  assert(project.logicalConnections!.some(w => w.from.componentId === component(terminal).id && w.to.componentId === component(0x8988).id && w.to.pinId === String(fusePin)), 'Phase-specific native netlist is retained independently of drawn runs');
}
assert.equal(component(0x89e4).functionText, 'Tarifsteuergerät');
assert(page.components.some(c => c.functionText === 'Heizung'), 'Free texts are regular editable elements');
assert.equal(component(0x2d4, 70).crossRef, '/1-2.7');
assert.equal(component(0x2da, 70).crossRef, '/1-2.8');
CrossReferenceEngine.updateProjectCrossReferences(project);
assert.equal(component(0xab).crossRef ?? '', '', 'A terminal is not a cross-reference to every matching strip pin');
assert.equal(component(0x2d4, 70).crossRef, '/1-2.7', 'Explicit interruption-point references survive editor updates');

const allComponents = new Map(project.pages.flatMap(p => p.components).map(c => [c.id, c]));
const definitionIds = new Set(project.symbolLibrary!.map(s => s.id));
assert.equal(definitionIds.size, project.symbolLibrary!.length);
let wires = 0;
function validateConnections(p: Page): void {
  for (const w of p.wires) {
    for (const ep of [w.from, w.to]) {
      const c = p.components.find(c => c.id === ep.componentId)!;
      assert(c); assert(c.pins[ep.pinId]); assert(symbol(c).pins.some(p => p.id === ep.pinId));
    }
    const ca = p.components.find(c => c.id === w.from.componentId)!, cb = p.components.find(c => c.id === w.to.componentId)!;
    const sa = symbol(ca), sb = symbol(cb);
    const a = AutoconnectEngine.getRotatedPinInfo(ca, sa.pins.find(pin => pin.id === w.from.pinId)!, sa);
    const b = AutoconnectEngine.getRotatedPinInfo(cb, sb.pins.find(pin => pin.id === w.to.pinId)!, sb);
    const faces = (a: ReturnType<typeof AutoconnectEngine.getRotatedPinInfo>, b: ReturnType<typeof AutoconnectEngine.getRotatedPinInfo>) => a.direction === 'top' ? Math.abs(a.worldX - b.worldX) < 1e-6 && b.worldY < a.worldY
      : a.direction === 'bottom' ? Math.abs(a.worldX - b.worldX) < 1e-6 && b.worldY > a.worldY
      : a.direction === 'left' ? Math.abs(a.worldY - b.worldY) < 1e-6 && b.worldX < a.worldX
      : Math.abs(a.worldY - b.worldY) < 1e-6 && b.worldX > a.worldX;
    assert(faces(a, b) && faces(b, a), `Physical conductor enters the outward side of both ports: ${w.id}`);
    for (const point of w.waypoints ?? []) assert(Number.isFinite(point.x) && Number.isFinite(point.y));
  }
}
for (const p of project.pages) {
  assert(p.grid, 'Every native page retains its physical grid and origin');
  assert.equal(p.importedDrawing, undefined);
  assert.equal(new Set(p.components.map(c => c.id)).size, p.components.length);
  for (const c of p.components) {
    assert(!c.importedSymbol, 'No geometry copied into placements');
    assert(definitionIds.has(c.symbolId), `Missing shared symbol ${c.symbolId}`);
    assert.strictEqual(getSymbolById(c.symbolId, project), symbol(c));
  }
  validateConnections(p);
  for (const c of p.components.filter(c => symbol(c).source)) {
    const definition = symbol(c);
    assert(definition.insertionPoint && definition.unitsPerMm === NATIVE_SCALE);
    for (const physicalPin of definition.pins) {
      const info = AutoconnectEngine.getRotatedPinInfo(c, physicalPin, definition);
      // Real contact edges at .75 mm remain exact quarter-mm coordinates;
      // coarse raster snapping must not round them away from their contour.
      for (const value of [info.worldX / NATIVE_SCALE, (297 - info.worldY / NATIVE_SCALE)])
        close(value * 4, Math.round(value * 4));
    }
  }
  const before = JSON.stringify(p.wires);
  AutoconnectEngine.updatePageAutoconnections(p);
  assert.equal(JSON.stringify(p.wires), before, `Opening ${p.title} must not invent connections`);
  wires += p.wires.length;
}
assert(wires > 1753, 'Physical runs include branches absent from the cached netlist');
assert.equal(project.logicalConnections!.length, 1915, 'Every native electrical connection is retained separately');
assert.equal(new Set(project.logicalConnections!.map(w => w.id)).size, 1915);
for (const w of project.logicalConnections!) {
  for (const ep of [w.from, w.to]) {
    const c = allComponents.get(ep.componentId)!;
    assert(c?.pins[ep.pinId]); assert(symbol(c).pins.some(p => p.id === ep.pinId));
  }
}
for (const title of ['PV-Anlage', 'FI-Schalter Haus', 'Raumthermostate 1', 'Stromstoßrelais 1', 'Küche', 'Server']) {
  const other = project.pages.find(p => p.title === title)!;
  assert(other?.components.some(c => symbol(c).source), `${title} uses the embedded-library importer`);
  assert(other.wires.length > 0);
}

// PDF page 17: every upper-facing socket contact has one conductor to a
// corner above it, never a star netlist edge through the next socket body.
const living = project.pages.find(p => p.title === 'Wohnzimmer 1')!;
for (const c of living.components.filter(c => symbol(c).source?.library === 'IEC_symbol' && symbol(c).source?.number === 1169)) {
  for (const physicalPin of symbol(c).pins) {
    assert.equal(physicalPin.direction, 'top');
    const attached = living.wires.filter(w => [w.from, w.to].some(e => e.componentId === c.id && e.pinId === physicalPin.id));
    assert.equal(attached.length, 1, `Exactly one upward socket contact: ${c.id}:${physicalPin.id}`);
  }
  assert(symbol(c).importedGraphics!.some(g => g.kind === 'arc'));
}
for (const id of [37009, 37011, 37012, 37015, 37017, 37018]) {
  const c = living.components.find(c => c.source?.objectId === id && c.source.objectType === 17)!;
  assert.equal(c.pins['0'].wireIds!.length, 1, `Motor terminal ${id} retains its physical supply, including absent netlist N/PE`);
  assert.equal(c.bmkPosition?.visible, false);
  assert(symbol(c).pins[0].labelPosition, 'Native DCP designation layout');
}
for (const id of [37008, 37014]) {
  const c = living.components.find(c => c.source?.objectId === id && c.source.objectType === 17)!;
  assert(Object.values(c.pins).every(p => !p.wireIds?.length), 'Separate motor illustration does not acquire external wires');
  assert.equal(c.bmkPosition?.visible, false);
}
for (const id of [37010, 37016]) {
  const c = living.components.find(c => c.source?.objectId === id && c.source.objectType === 17)!;
  const frame = symbol(c).importedGraphics!.find(g => g.kind === 'rect')!;
  assert.equal(frame.kind, 'rect'); assert(!frame.dash?.length, 'Native device frames are solid');
}

const restored = JSON.parse(JSON.stringify(project)) as Project;
setProjectSymbolLibrary(restored);
const editedPage = restored.pages.find(p => p.id === page.id)!;
const c = editedPage.components.find(c => c.id === component(0x9a33).id)!;
const s = getSymbolForComponent(c, restored)!;
const previousPin = AutoconnectEngine.getRotatedPinInfo(c, s.pins[0], s);
c.bmk = '-Q99'; c.functionText = 'Bearbeitet'; c.technicalCharacteristics = '80 A';
c.pins['0'].customLabel = 'L1 neu'; c.x += 16; c.y += 8;
const moved = AutoconnectEngine.getRotatedPinInfo(c, s.pins[0], s);
close(moved.worldX, previousPin.worldX + 16); close(moved.worldY, previousPin.worldY + 8);
c.rotation = 90;
const rotated = AutoconnectEngine.getRotatedPinInfo(c, s.pins[0], s);
assert.equal(rotated.direction, 'right');
assert(Number.isFinite(rotated.worldX) && Number.isFinite(rotated.worldY));
const roundtrip = JSON.parse(JSON.stringify(restored)) as Project;
const reloaded = roundtrip.pages.find(p => p.id === page.id)!.components.find(x => x.id === c.id)!;
assert.equal(reloaded.bmk, '-Q99'); assert.equal(reloaded.functionText, 'Bearbeitet');
assert.equal(reloaded.pins['0'].customLabel, 'L1 neu'); assert.equal(reloaded.rotation, 90);
assert.equal(getSymbolForComponent(reloaded, roundtrip)!.pins.length, 8);
const pdf = await PdfExporter.exportToPdf(roundtrip, {
  paperFormat: 'a3', colorMode: 'color', pageRange: 'current', currentPageId: page.id,
  interactiveCrossReferences: true, includeBookmarks: false, includeTerminalDiagram: false,
  includePartsList: false, plotFrame: true
});
const pdfData = await pdf.arrayBuffer();
assert.equal(new TextDecoder().decode(pdfData.slice(0, 4)), '%PDF');
assert(pdfData.byteLength > 5000);
assert.equal(new EodRecord(1, 17, 1, new Uint8Array([0x5a, 0xed, 0])).position, undefined);
assert.throws(() => readEodTable(new Uint8Array(2), new Uint8Array(), 'Function'), /Nicht unterstütztes/);
assert(page.importDiagnostics!.some(d => /Datenpräfix/.test(d)), 'Partial coverage remains explicit');
console.log('✓ General embedded-library import: all active pages, facing physical runs + 1915 native netlist entries, editable shared symbols, JSON and PDF');

// The embedded norm sheet is a shared editable project resource, not a screenshot.
assert.equal(project.plotFrameTemplate?.name, 'FN1_001');
assert.equal(project.plotFrameTemplate?.width, 420);
assert.equal(project.plotFrameTemplate?.height, 297);
assert.equal(project.plotFrameTemplate?.graphics.length, 30);
assert.equal(project.plotFrameTemplate?.texts.length, 53);
assert(project.plotFrameTemplate?.graphics.some(g => g.kind === 'line' && g.y1 === 281 && g.y2 === 281 && g.x1 === 0 && g.x2 === 420));
assert(project.plotFrameTemplate?.texts.some(t => t.property === 11011 && t.x === 231 && t.y === 285));
assert(project.plotFrameTemplate?.texts.some(t => t.property === 1001 && t.index === 20134));
console.log('✓ Embedded FN1_001 norm sheet, full-width footer and native field bindings');

const cables=project.pages.flatMap(p=>p.cables ?? []);
assert.equal(cables.length,81);
assert.equal(cables.reduce((n,c)=>n+c.cores.length,0),418);
const heating=project.pages.find(p=>p.title==='Unterverteiler Heizungsanlage')!;
const heatingCable=heating.cables!.find(c=>c.bmk==='-W2')!;
assert.equal(heatingCable.cableType,'NYM-J');assert.equal(heatingCable.coreCount,5);assert.equal(heatingCable.crossSection,'2,5');
assert.equal(heatingCable.cores.length,5);assert(heatingCable.cores.every(c=>c.wireIds?.length));
assert(!project.pages.some(p=>p.components.some(c=>symbol(c).annotationKind==='cable')));
assert.equal(living.cables!.length,3);assert.equal(living.wires.length,193);
assert(page.components.some(c=>c.source?.objectType===59 && c.source?.objectId===176),'An unassigned connection-definition point must not be dropped');
assert(cables.every(c=>project.symbolLibrary!.some(s=>s.id===c.symbolId)), 'Cable placements retain their embedded library resource');
console.log('✓ 81 native cable definitions, 418 associated core points, cable metadata and untouched physical/electrical graphs');

assert(heatingCable.cores.some(c=>c.color==='BU'));
assert(cables.every(c=>c.cores.every(core=>!/[\x00-\x1f]/.test(core.designation ?? ''))), 'Label-property references cannot masquerade as string values');

assert(cables.every(c=>c.cores.every(core=>project.symbolLibrary!.some(s=>s.id===core.symbolId))), 'Cable core annotations retain their source library master');

}
