import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { MacroManager } from './MacroManager';
import { ExternalMacroLibrary } from './ExternalMacroLibrary';
import { componentInsertionPoint } from './SymbolGeometry';
import { getSymbolForComponent, setProjectSymbolLibrary } from './symbols';
import { AutoconnectEngine } from './AutoconnectEngine';
import { parseNativeXmlMacro } from './NativeXmlMacro';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Project } from './types';

// Original drawing records; unrelated project/customer metadata was removed.
const xml = readFileSync(new URL('./fixtures/2_P_Circuit_Breaker.ems', import.meta.url), 'utf8');
const load = (text = xml, name = '2_P_Circuit_Breaker.ems', strict = true) =>
  MacroManager.parseMacroFile(new File([text], name), { allowHeuristic: !strict });
const macro = await load();
assert.equal(macro.type, 'ema', 'The XML window type overrides the .ems filename');
if (macro.type !== 'ema') throw new Error();
assert.equal(macro.name, '2_P_Circuit_Breaker');
assert.equal(macro.unitsPerMm, 2);
assert.equal(macro.width, 66); assert.equal(macro.height, 192);
assert.deepEqual(macro.handlePoint, { x: 0, y: 88 });
assert.equal(macro.components.length, 7, 'Grouped graphic members stay individually editable');
assert.equal(macro.groups!.length,1);assert.equal(macro.groups![0].members.length,7);
const drawing=(m:typeof macro)=>m.components.flatMap(c=>m.symbolLibrary!.find(s=>s.id===c.symbolId)!.importedGraphics!.map(g=>g.kind==='line'?{...g,x1:g.x1+c.x,y1:g.y1+c.y,x2:g.x2+c.x,y2:g.y2+c.y}:g.kind==='rect'?{...g,x:g.x+c.x,y:g.y+c.y}:g));
const symbol = macro.symbolLibrary![0];
assert.equal(macro.components[0].symbolId, symbol.id);
assert.deepEqual(symbol.pins, [], 'A graphical macro has no invented electrical connections');
assert.equal(macro.components[0].bmk, '');
assert.equal(macro.components[0].functionText, '');
assert.deepEqual(symbol.insertionPoint, macro.handlePoint);
assert.deepEqual(drawing(macro), [
  { kind: 'rect', x: 0, y: 0, width: 66, height: 192, color: 'currentColor', lineWidth: .5 },
  { kind: 'rect', x: 0, y: 32, width: 66, height: 8, color: 'currentColor', lineWidth: .5 },
  { kind: 'rect', x: 0, y: 152, width: 66, height: 8, color: 'currentColor', lineWidth: .5 },
  { kind: 'line', x1: 0, y1: 64, x2: 66, y2: 64, color: 'currentColor', width: .5 },
  { kind: 'line', x1: 0, y1: 120, x2: 66, y2: 120, color: 'currentColor', width: .5 },
  { kind: 'rect', x: 20, y: 84, width: 24, height: 12, color: 'currentColor', lineWidth: .5 },
  { kind: 'line', x1: 24, y1: 96, x2: 40, y2: 84, color: 'currentColor', width: .5 }
], 'All four rectangles and three lines preserve source geometry, with Y reflected');

for (const extension of ['ema', 'EMS', 'xml']) {
  const imported = await load(xml, `unrelated-name.${extension}`);
  assert.deepEqual(imported.symbolLibrary![0].importedGraphics, symbol.importedGraphics);
}
const zip = new JSZip(); zip.file('drawing.ems', xml);
const packed = await MacroManager.parseMacroFile(new File([new Uint8Array(await zip.generateAsync({ type: 'uint8array' }))], 'drawing.edz'), { allowHeuristic: false });
assert.deepEqual(packed.symbolLibrary![0].importedGraphics, symbol.importedGraphics);
const library = new ExternalMacroLibrary(undefined, { get: async () => undefined, put: async () => {} });
const folderFile = new File([xml], 'drawing.ems');
Object.defineProperty(folderFile, 'webkitRelativePath', { value: 'Drawings/drawing.ems' });
await library.selectFiles([folderFile]);
assert.equal(library.state.macroCount, 1); assert.deepEqual(library.state.issues, []);
await library.disconnect();

const project = { id: 'target', drawingUnitsPerMm: 3, pages: [] } as unknown as Project;
const before = JSON.stringify(macro);
const result = MacroManager.instantiateWindowMacro(MacroManager.forPlacement(macro), 100, 200, [], project);
const placed = result.components[0], master = getSymbolForComponent(placed, project)!;
assert.equal(master.width, 99); assert.equal(master.height, 288);
assert.deepEqual(componentInsertionPoint(placed, master), { x: 100, y: 332 });
assert.equal(result.wires.length, 0); assert.equal(placed.bmk, '');
assert.equal(JSON.stringify(macro), before);
const exported = MacroManager.exportMacro(macro);
const restored = await MacroManager.parseMacroFile(new File([exported.blob], exported.filename), { allowHeuristic: false });
assert.deepEqual(restored.symbolLibrary, macro.symbolLibrary);
assert.deepEqual(MacroManager.forPlacement(restored).handlePoint, macro.handlePoint);

// Recognized native XML must never fall back to a guessed contactor coil.
for (const strict of [true, false]) {
  for (const [payload, error] of [
    [xml.replace('68/48', 'bad/48'), /Ungültige Koordinate/],
    [xml.replace('<O31 ', '<O99 '), /nicht unterstützten Objekttyp/],
    [xml.replace('</MacroVariant>', ''), /ungültiges XML/],
    [xml.replace('Type="WindowMacro"', 'Type="Unknown"'), /Makrotyp/],
    [xml.replace(/<O26[\s\S]*<\/O26>/, ''), /keine unterstützten Grafikobjekte/]
  ] as const) await assert.rejects(() => load(payload, 'broken.ems', strict), error);
}
const nested = xml.replace('<O26 ', '<O26 A1="26/1"><O26 ').replace('</O26>', '</O26></O26>');
const nestedMacro=await load(nested);if(nestedMacro.type!=='ema')throw new Error();
assert.deepEqual(drawing(nestedMacro),drawing(macro));assert.equal(nestedMacro.groups!.length,1,'A one-child wrapper is dissolved without losing the inner graphic group');
console.log('Native XML macro: supplied drawing, grouping, shared library, scaling, insertion, folder/ZIP/export and strict errors passed');

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const changeoverXml = fixture('changeover.ems'), coilXml = fixture('contactor_simple.ema');
// Import must use the macro's own physical scale even with another project open.
setProjectSymbolLibrary({ drawingUnitsPerMm: 3, symbolLibrary: [], pages: [] } as unknown as Project);
const device = await load(changeoverXml, 'changeover.ems'), coil = await load(coilXml, 'contactor_simple.ema');
if (device.type !== 'ema' || coil.type !== 'ema') throw new Error();
assert.equal(device.name, 'PRZEŁĄCZNICA', 'Unicode name comes from the document');
assert.equal(device.components.length, 6); assert.equal(device.wires!.length, 0);
assert.equal(device.symbolLibrary!.length, 4);
assert.deepEqual([device.width, device.height], [52, 92], 'Other representation types are not overlaid');
assert.deepEqual(device.handlePoint, { x: 2, y: 2 });
const deviceContext = { drawingUnitsPerMm: 2, symbolLibrary: device.symbolLibrary } as Project;
const body = device.components.find(c => c.bmk === '-A21')!;
assert(body); assert.equal(body.articleNumber, 'OPT.PSCCS1');
const bodySymbol = getSymbolForComponent(body, deviceContext)!;
assert.deepEqual([bodySymbol.width, bodySymbol.height, body.x, body.y], [48, 88, 2, 2]);
const contacts = device.components.filter(c => Object.keys(c.pins).length);
assert.deepEqual(contacts.map(c => c.pins['0'].customLabel), ['A1', 'A2', 'B1', 'B2']);
const ports = AutoconnectEngine.getAllPins(contacts, deviceContext);
assert.deepEqual(ports.map(p => [p.worldX, p.worldY, p.direction]), [
  [6, 26, 'left'], [6, 66, 'left'], [46, 26, 'right'], [46, 66, 'right']
], 'All four physical ports retain source geometry and their one-sided directions');
assert(contacts.every(c => getSymbolForComponent(c, deviceContext)!.pins[0].labelPosition));
assert(contacts.every(c => Math.abs(getSymbolForComponent(c, deviceContext)!.pins[0].labelPosition!.fontSize - 4.4712) < 1e-9));
const doc = new DOMParser().parseFromString(changeoverXml, 'application/xml');
const lastVariant = doc.getElementsByTagName('MacroVariant').item(2)!;
doc.documentElement.insertBefore(lastVariant, doc.documentElement.firstChild);
const reordered = await load(new XMLSerializer().serializeToString(doc), 'reordered.ems');
assert.deepEqual(reordered.type === 'ema' && [reordered.width, reordered.height], [52, 92], 'Prefer schematic A independent of file order');

assert.equal(coil.components.length, 2, 'Macro definition frame is metadata, not an extra device');
assert.deepEqual([coil.width, coil.height], [16, 40]);
assert.deepEqual(coil.handlePoint, { x: 8, y: -304 }, 'An insertion point outside the geometry remains exact');
const relay = coil.components.find(c => c.bmk === '-K1')!;
assert(relay); assert.deepEqual(Object.values(relay.pins).map(p => p.customLabel), ['', ''], 'Explicit blank designations stay blank');
assert.equal(coil.wires!.length, 1, 'The facing coil and T junction are electrically connected');
const wire = coil.wires![0];
assert.equal(wire.from.componentId, relay.id); assert.equal(wire.from.pinId, '1');
assert(relay.pins['1'].wireIds!.includes(wire.id));
const destination = { drawingUnitsPerMm: 3, pages: [], symbolLibrary: [] } as unknown as Project;
const instantiated = MacroManager.instantiateWindowMacro(coil, 120, 200, [], destination);
assert.equal(instantiated.wires.length, 1);
assert.notEqual(instantiated.wires[0].from.componentId, wire.from.componentId);
const placedRelay = instantiated.components.find(c => c.bmk === '-K1')!;
assert.deepEqual(placedRelay.pins['1'].wireIds, [instantiated.wires[0].id]);
const saved = MacroManager.exportMacro(device);
assert.deepEqual((await MacroManager.parseMacroFile(new File([saved.blob], saved.filename))).symbolLibrary, device.symbolLibrary);

// Existing project master data resolves custom native library identities too.
const custom = structuredClone(coil.symbolLibrary!.find(s => s.source?.library === 'IEC_symbol')!);
custom.id = 'custom:coil'; custom.source = { library: 'MyLibrary', number: 900, variant: 0 };
const customXml = coilXml.replace('Name="IEC_symbol"', 'Name="MyLibrary"').replace('A1262="20"', 'A1262="900"');
const customMacro = parseNativeXmlMacro(customXml, 'custom.ema', [custom]);
assert(customMacro.components.some(c => c.symbolId === custom.id));
for (const strict of [true, false]) {
  await assert.rejects(() => load(coilXml.replace('A1262="20"', 'A1262="9999"'), 'missing.ema', strict), /Bibliothekssymbol nicht verfügbar/);
  await assert.rejects(() => load(coilXml.replace('Name="IEC_symbol"', 'Name="Missing"'), 'missing.ema', strict), /Bibliothekssymbol nicht verfügbar/);
}
await library.selectFiles([Object.defineProperty(new File([changeoverXml], 'changeover.ems'), 'webkitRelativePath', { value: 'Macros/changeover.ems' }),
  Object.defineProperty(new File([coilXml], 'contactor.ema'), 'webkitRelativePath', { value: 'Macros/contactor.ema' })]);
assert.equal(library.state.macroCount, 2); assert.deepEqual(library.state.issues, []); await library.disconnect();
console.log('Electrical XML macros: default representation, sized body, four directional ports, real coil/T master data, blank designations, internal wire, contextual scale and missing-library errors passed');
