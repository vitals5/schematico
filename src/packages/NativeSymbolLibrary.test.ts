import { openNativeFixture } from './testing/NativeFixture';
import assert from 'node:assert/strict';
import { EodRecord, readEodTable, readIndexedEodRecords } from './EodReader';
import { arcPoints } from '../model/ImportedDrawing';
import { NATIVE_SCALE, NativeSymbolLibrary, nativePrimitives, normalizeDefinition, sourcePinLabelPositions } from './NativeSymbolLibrary';
import { PinDefinition, SymbolDefinition } from '../model/types';

const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const f64 = (n: number) => { const b = Buffer.alloc(8); b.writeDoubleLE(n); return b; };
const tag = (n: number, payload: Uint8Array) => Buffer.concat([u16(n), payload]);
const pin: PinDefinition = { id: '0', name: '1', x: 0, y: -4 * NATIVE_SCALE, direction: 'top' };
const layers = new Map([[420, { lineWidth: 0.35, fontSize: 1.8 }]]);
const close = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function placement(options: { index?: number; orientation?: number; alignment?: number; point?: Buffer; angle?: number; font?: number } = {}) {
  return Buffer.concat([
    tag(0xea65, u16(0x35)), tag(0xea64, u16(1)), tag(0xea67, Buffer.concat([u16(0x2d), u32(2692)])),
    tag(0xebfb, u16(420)), tag(0xec55, options.point ?? Buffer.concat([f64(0.6), f64(0.6)])),
    tag(0xec57, u16(options.alignment ?? 20)),
    ...(options.angle === undefined ? [] : [tag(0xee22, f64(options.angle))]),
    ...(options.font === undefined ? [] : [tag(0xee21, f64(options.font))]),
    u16(0xffff), tag(0xed63, u16(20028)), tag(0xed64, u16(options.index ?? 1)),
    tag(0xee19, Buffer.from([options.orientation ?? 2])), tag(0xee1a, Buffer.from([16])), u16(0xffff)
  ]);
}

const [placed] = sourcePinLabelPositions(Buffer.concat([
  placement({ orientation: 1, point: Buffer.concat([f64(-10), f64(-10)]) }), placement()
]), [pin], layers);
assert(placed.labelPosition);
close(placed.labelPosition.fontSize, 1.8 * NATIVE_SCALE * 1.242);
close(placed.labelPosition.x, 0.6 * NATIVE_SCALE);
close(placed.labelPosition.y, -4.6 * NATIVE_SCALE - placed.labelPosition.fontSize * 0.12753948);
assert.equal(placed.labelPosition.rotation, 0);
assert.equal(sourcePinLabelPositions(placement({ index: 2 }), [pin], layers)[0].labelPosition, undefined);
assert.equal(sourcePinLabelPositions(placement({ orientation: 1 }), [pin], layers)[0].labelPosition, undefined);
assert.equal(sourcePinLabelPositions(placement({ alignment: 123 }), [pin], layers)[0].labelPosition, undefined);
assert.equal(sourcePinLabelPositions(placement().subarray(0, -1), [pin], layers)[0].labelPosition, undefined);
assert.equal(sourcePinLabelPositions(placement({ font: NaN }), [pin], layers)[0].labelPosition, undefined);
assert.equal(sourcePinLabelPositions(placement({ angle: NaN }), [pin], layers)[0].labelPosition, undefined);
assert.equal(sourcePinLabelPositions(placement({ angle: -16002 }), [pin], layers)[0].labelPosition?.rotation, 0);
assert.equal(sourcePinLabelPositions(placement(), [pin], new Map())[0].labelPosition, undefined);
// A truncated object must not take its missing suffix or coordinates from the next object.
assert(sourcePinLabelPositions(Buffer.concat([placement().subarray(0, 30), placement()]), [pin], layers)[0].labelPosition);
// Float mantissa bytes resembling ED63 / property 20011 are data, not a field.
const fakeTagFloat = Buffer.from('63ed2b4e0000e03f', 'hex');
const [floatPlacement] = sourcePinLabelPositions(placement({ point: Buffer.concat([fakeTagFloat, f64(0.6)]) }), [pin], layers);
assert(floatPlacement.labelPosition);
close(floatPlacement.labelPosition.x, fakeTagFloat.readDoubleLE() * NATIVE_SCALE);
const [rotated] = sourcePinLabelPositions(placement({ angle: Math.PI / 2 }), [pin], layers);
assert.equal(rotated.labelPosition?.rotation, 270);

const definition: SymbolDefinition = { id: 'test', name: 'test', category: 'controls', standard: 'DIN EN 60617',
  defaultBmkPrefix: '', defaultFunctionText: '', width: 0, height: 0, pins: [placed], svgContent: '', description: '' };
const normalized = normalizeDefinition(definition);
close(definition.pins[0].labelPosition!.y, placed.labelPosition.y + normalized.origin.y);
close(definition.pins[0].labelPosition!.x, placed.labelPosition.x + normalized.origin.x);

const line = new EodRecord(1, 0x1f, 1, Buffer.concat([tag(0xebfb, u16(420)),
  tag(0xec73, Buffer.concat([f64(0), f64(1)])), tag(0xec74, Buffer.concat([f64(0), f64(2)]))]));
const [graphic] = nativePrimitives(line, layers);
assert.equal(graphic.kind, 'line');
if (graphic.kind === 'line') close(graphic.width!, 0.35 * NATIVE_SCALE);

// Circle records also encode circular arcs. Parameters are relative to the
// radius vector, and both start and end matter (EC8A alone is not a sweep).
const circleRecord = (vector: [number, number], start?: number, end?: number) => new EodRecord(0, 0x20, 0,
  Buffer.concat([tag(0xec8b, Buffer.concat([f64(3), f64(4)])),
    tag(0xec8c, Buffer.concat(vector.map(f64))),
    ...(start === undefined ? [] : [tag(0xec89, f64(start))]),
    ...(end === undefined ? [] : [tag(0xec8a, f64(end))])]));
function arcOf(record: EodRecord) {
  const [g] = nativePrimitives(record);
  assert.equal(g?.kind, 'arc');
  if (g.kind !== 'arc') throw new Error('Expected source arc');
  return g;
}
const lowerHalf = arcOf(circleRecord([0, 2], Math.PI / 2, 3 * Math.PI / 2));
const lowerPoints = arcPoints(lowerHalf);
close(lowerPoints[0].x, NATIVE_SCALE); close(lowerPoints[0].y, -4 * NATIVE_SCALE);
close(lowerPoints.at(-1)!.x, 5 * NATIVE_SCALE); close(lowerPoints.at(-1)!.y, -4 * NATIVE_SCALE);
assert(lowerPoints.every(p => p.y >= lowerHalf.y - 1e-9), 'Rotated radius and nonzero start yield the lower half');
close(Math.max(...lowerPoints.map(p => p.y)), -2 * NATIVE_SCALE);
const wrapped = arcOf(circleRecord([2, 0], 0, -Math.PI / 2));
const wrappedPoints = arcPoints(wrapped);
close(wrappedPoints.at(-1)!.x, 3 * NATIVE_SCALE); close(wrappedPoints.at(-1)!.y, -2 * NATIVE_SCALE);
assert(wrappedPoints.some(p => p.x < wrapped.x) && wrappedPoints.some(p => p.y < wrapped.y), 'Negative end wraps CCW through three quadrants');
for (const [start, end] of [[undefined, undefined], [0, 0], [1.2, 1.2], [0, 2 * Math.PI]])
  assert.equal(nativePrimitives(circleRecord([0, 2], start, end))[0].kind, 'circle', 'Equal parameters retain full circles');
assert.deepEqual(nativePrimitives(circleRecord([0, 0], 0, Math.PI)), []);
assert.deepEqual(nativePrimitives(circleRecord([2, 0], NaN, Math.PI)), []);
assert.deepEqual(nativePrimitives(new EodRecord(0, 0x20, 0,
  Buffer.concat([circleRecord([2, 0]).data, u16(0xec8a), Buffer.alloc(4)]))), []);

// Real indexed variant records verify the layout across all used project pages.
const fixture=await openNativeFixture();
if(fixture){
const {zip,root}=fixture;


const records: EodRecord[] = [];
for (const table of ['Function', 'Instance', 'IPoint', 'Potential'] as const) records.push(...readEodTable(
  await zip.file(`${root}${table}.eod`)!.async('uint8array'), await zip.file(`${root}${table}.eox`)!.async('uint8array'), table));
const library = await NativeSymbolLibrary.create(zip, root);
await library.prepare(records);
const entries = new Map(records.filter(r => r.symbol !== undefined).map(r => {
  const entry = library.resolve(r)!; return [entry.definition.id, entry];
}));
assert([...entries.values()].flatMap(e => e.definition.pins).filter(p => p.labelPosition).length >= 107);
const f0 = library.resolve(records.find(r => r.id === 0x8988 && r.pageId === 13 && r.type === 17)!)!;
const f0pin = f0.definition.pins.find(p => p.id === '0')!.labelPosition!;
// PDF reference F0 pin 1 baseline: (443.906 pt, 669.302 pt).
close((156 + (f0pin.x - f0.origin.x) / NATIVE_SCALE) * 72 / 25.4, 443.9055118110236);
assert(Math.abs(((297 - 56) + (f0pin.y - f0.origin.y) / NATIVE_SCALE) * 72 / 25.4 - 669.302001953125) < 0.001);
const special = [...entries.values()].filter(e => e.definition.source!.library === 'SPECIAL'
  && [8, 75, 77, 78].includes(e.definition.source!.number));
assert(special.length);
assert(special.every(e => e.definition.pins.every(p => !p.labelPosition)), 'Connection graphics do not get synthetic physical pin labels');
// DCPs carry property 20036, relative to insertion rather than the physical
// contact. PDF17 centers L/N/PE below their single terminal, without a BMK.
const dcp = [...entries.values()].find(e => e.definition.source?.library === 'SPECIAL'
  && e.definition.source.number === 17 && e.definition.source.variant === 0)!;
const dcpLabel = dcp.definition.pins[0].labelPosition!;
assert(dcpLabel);
assert.equal(dcpLabel.alignment, 'middle');
assert.equal(dcpLabel.rotation, 0);
close((dcpLabel.x - dcp.origin.x) / NATIVE_SCALE, 0);
assert(Math.abs((dcpLabel.y - dcp.origin.y) / NATIVE_SCALE - 3.73814485) < .001);
// World-independent source coordinates corroborated against the PDF export:
// directional junctions have diagonal strokes, not synthesized circular dots.
for (const [number, variant, segments] of [
  [64, 0, [[-2, 0, 0, 0], [0, 0, 0, -2], [0, -2, 2, 0]]],
  [66, 0, [[0, -2, 0, 2], [0, -2, 2, 0]]],
  [66, 1, [[0, 2, 0, -2], [0, 2, 2, 0]]],
  [69, 0, [[0, 2, 0, -2], [0, 2, 2, 0], [-2, 0, 0, -2]]],
  [72, 0, [[0, 2, 0, 0], [-2, 0, 0, 0], [0, 2, 2, 0]]]
] as const) {
  const entry = [...entries.values()].find(e => e.definition.source!.library === 'SPECIAL'
    && e.definition.source!.number === number && e.definition.source!.variant === variant)!;
  assert(entry, `Missing source variant ${number}:${variant}`);
  const actual = entry.definition.importedGraphics!.map(g => {
    assert.equal(g.kind, 'line');
    if (g.kind !== 'line') throw new Error('Expected source line');
    close(g.width! / NATIVE_SCALE, 0.25);
    const round = (n: number) => Math.round(n * 1e6) / 1e6 || 0;
    return [round((g.x1 - entry.origin.x) / NATIVE_SCALE), round(-(g.y1 - entry.origin.y) / NATIVE_SCALE),
      round((g.x2 - entry.origin.x) / NATIVE_SCALE), round(-(g.y2 - entry.origin.y) / NATIVE_SCALE)];
  });
  assert.deepEqual(actual, segments);
}
// Real socket records from the embedded library corroborate the source PDF:
// Wohnzimmer 1 (page 17) has upper semicircles, diameter 3 mm and height 1.5 mm.
const libraryInstances = readIndexedEodRecords(
  await zip.file(`${root}IEC_symbol.sdb/Instance.eod`)!.async('uint8array'),
  await zip.file(`${root}IEC_symbol.sdb/Instance.eox`)!.async('uint8array'),
  { size: 134, typedIndex: false }, 'Instance');
for (const id of [56590, 56597, 56606]) {
  const source = libraryInstances.find(r => r.id === id)!;
  assert(source, `Missing indexed socket arc ${id}`);
  const arc = arcOf(source), points = arcPoints(arc);
  close(arc.radius / NATIVE_SCALE, 1.5);
  close(Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)), 3 * NATIVE_SCALE);
  close(Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)), 1.5 * NATIVE_SCALE);
  assert(points.every(p => p.y <= arc.y + 1e-8), 'Socket semicircles bow upward as in the native CAD PDF');
}
const rotatedSocket = arcOf(libraryInstances.find(r => r.id === 56616)!);
assert(arcPoints(rotatedSocket).every(p => p.x <= rotatedSocket.x + 1e-8), 'Rotated library variant bows left');
const nonzeroSourceStart = arcOf(libraryInstances.find(r => r.id === 101769)!);
close(Math.abs(nonzeroSourceStart.endAngle - nonzeroSourceStart.startAngle), 180);
assert(arcPoints(nonzeroSourceStart).every(p => p.y >= nonzeroSourceStart.y - 1e-8), 'Nonzero source start is not mistaken for a 270-degree sweep');
assert.equal(nativePrimitives(libraryInstances.find(r => r.id === 148198)!)[0].kind, 'circle', 'Terminal ring remains a full circle');
const socketDefinition = [...entries.values()].find(e => e.definition.source!.library === 'IEC_symbol'
  && e.definition.source!.number === 1169 && e.definition.source!.variant === 0)!;
assert(socketDefinition);
assert.equal(socketDefinition.definition.importedGraphics!.filter(g => g.kind === 'arc').length, 3);
assert.equal(socketDefinition.definition.importedGraphics!.filter(g => g.kind === 'circle').length, 0);
assert.deepEqual(socketDefinition.definition.pins.map(p => ({ id: p.id,
  x: Math.round((p.x - socketDefinition.origin.x) / NATIVE_SCALE),
  y: Math.round(-(p.y - socketDefinition.origin.y) / NATIVE_SCALE) })), [
  { id: '0', x: 0, y: 4 }, { id: '1', x: 16, y: 4 }, { id: '2', x: 8, y: 4 }
], 'Arc decoding preserves physical socket pins');
console.log('NATIVE source pin-label layouts and circular arcs: passed');

}
