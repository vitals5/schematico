import { openNativeFixture } from './testing/NativeFixture';
import assert from 'node:assert/strict';
import type { PinDefinition } from '../model/types';
import { EodRecord, readEodTable } from './EodReader';
import { readNativeLayers } from './NativeLayers';
import { nativePinLabelOverrides } from './NativePinLabelOverrides';

const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const f64 = (n: number) => { const b = Buffer.alloc(8); b.writeDoubleLE(n); return b; };
const field = (tag: number, payload: Uint8Array) => Buffer.concat([u16(tag), payload]);
const instance = (data: Uint8Array) => new EodRecord(44, 17, 1, Buffer.concat([field(0xeb19, Buffer.from('USB\0')), data]));
const pin: PinDefinition = { id: 'port', name: 'USB', x: 31, y: 42, direction: 'bottom' };
const layers = new Map([[420, { fontSize: 1.8, angle: 0 }]]);
const close = (a: number, b: number, tolerance = 1e-8) => assert(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function placement(options: { property?: number; parentType?: number; parentId?: number; format?: number;
  angle?: number; font?: number; point?: Buffer; orientation?: number; extra?: Buffer } = {}) {
  return Buffer.concat([field(0xea65, u16(53)), field(0xea64, u16(2)),
    field(0xea67, Buffer.concat([u16(options.parentType ?? 17), u32(options.parentId ?? 44)])),
    field(0xebfb, u16(420)), field(0xec55, options.point ?? Buffer.concat([f64(0), f64(4)])),
    field(0xec59, u16(54)), field(0xee22, f64(options.angle ?? 0)), field(0xee26, Buffer.from([options.format ?? 8])),
    ...(options.font === undefined ? [] : [field(0xee21, f64(options.font))]), options.extra ?? Buffer.alloc(0),
    u16(0xffff), field(0xed63, u16(options.property ?? 20036)), field(0xee17, u16(15)),
    ...(options.orientation === undefined ? [] : [field(0xee19, Buffer.from([options.orientation]))]), u16(0xffff)]);
}
assert.equal(nativePinLabelOverrides(new EodRecord(44,17,1,placement()),[pin],layers).size,0,'An absent designation must not print a library placeholder');
const untouched = JSON.stringify(pin), layout = nativePinLabelOverrides(instance(placement()), [pin], layers).get('port')!;
assert(layout);
close(layout.x, 0); close(layout.y, -10.20268395592381); close(layout.fontSize, 5.322857142857144);
assert.equal(layout.alignment, 'middle'); assert.equal(layout.rotation, 0);
assert.equal(JSON.stringify(pin), untouched, 'Insertion-relative metadata does not mutate or use the physical pin position');
assert.equal(nativePinLabelOverrides(instance(placement({ property: 20039 })), [pin], layers).size, 0, 'Description is not the editable designation');
for (const options of [{ parentId: 45 }, { parentType: 45 }, { format: 2 }, { angle: Math.PI / 2 },
  { orientation: 1 }, { font: NaN }, { angle: NaN }, { extra: field(0xec57, u16(20)) },
  { extra: field(0xed64, u16(1)) }, { point: Buffer.concat([f64(NaN), f64(4)]) }])
  assert.equal(nativePinLabelOverrides(instance(placement(options)), [pin], layers).size, 0, 'Unsupported or malformed format must not fabricate metadata');
assert.equal(nativePinLabelOverrides(instance(placement()), [pin], new Map()).size, 0);
assert.equal(nativePinLabelOverrides(instance(placement()), [pin, { ...pin, id: 'other' }], layers).size, 0);
assert.equal(nativePinLabelOverrides(instance(placement().subarray(0, -1)), [pin], layers).size, 0);
assert.equal(nativePinLabelOverrides(instance(Buffer.concat([placement(), placement()])), [pin], layers).size, 0, 'Ambiguous alternatives do not use a guessed selection');
const afterBroken = Buffer.concat([placement().subarray(0, 31), placement()]);
assert.equal(nativePinLabelOverrides(instance(afterBroken), [pin], layers).size, 1, 'The next complete placement is decoded independently of a truncated predecessor');
const fakePropertyDouble = Buffer.from('63ed474e0000e03f', 'hex');
const fake = nativePinLabelOverrides(instance(placement({ point: Buffer.concat([fakePropertyDouble, f64(4)]) })), [pin], layers).get(pin.id)!;
assert(fake, 'A tag-like float mantissa does not replace the real property field');
close(fake.x, fakePropertyDouble.readDoubleLE() * 1000 / 420);

// Source/PDF regression: all eight USB captions in Server use their individual
// native 20036 override, not the 20039 description beside the port.
const fixture=await openNativeFixture();
if(fixture){
const {zip,root}=fixture;


const functions = readEodTable(await zip.file(root + 'Function.eod')!.async('uint8array'),
  await zip.file(root + 'Function.eox')!.async('uint8array'), 'Function');
const sourceLayers = await readNativeLayers(zip, root);
const ids = [40456, 40457, 40458, 40459, 40460, 40461, 40487, 40488];
for (const [i, id] of ids.entries()) {
  const source = functions.find(r => r.id === id)!;
  assert(source && !source.partial);
  assert.deepEqual(source.pins, ['USB']);
  assert.deepEqual(source.position, { x: 216 + i * 20, y: 140 });
  const labels = nativePinLabelOverrides(source, [{ ...pin, id: '0' }], sourceLayers);
  assert.equal(labels.size, 1);
  const p = labels.get('0')!;
  const xMm = source.position!.x + p.x * 420 / 1000;
  const yMm = 297 - source.position!.y + p.y * 420 / 1000;
  close(xMm, 216 + i * 20);
  close(yMm, 152.71468794080945, .001); // Independent PDF45 baseline.
  close(p.fontSize * 420 / 1000 * 72 / 25.4, 6.337130069732666, .00001);
}
console.log('Native pin-label overrides: eight source USB positions and bounded format decoding passed');

}
