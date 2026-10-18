import { openNativeFixture } from './testing/NativeFixture';
import assert from 'node:assert/strict';
import { EodRecord, readEodTable, readIndexedEodRecords } from './EodReader';
import { readNativeLayers } from './NativeLayers';
import { nativePropertyLayouts } from './NativePropertyLayout';

const concat = (...parts: Uint8Array[]) => new Uint8Array(parts.flatMap(p => [...p]));
const u16 = (v: number) => new Uint8Array([v & 255, (v >>> 8) & 255]);
const u32 = (v: number) => new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]);
const dbl = (v: number) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v, true); return b; };
function placement(id: number, field: number, previous?: number, arrangement = 1, x = -1.5): Uint8Array {
  return concat(u16(0xea65), u16(53), u16(0xea64), u16(id), u16(0xea67), u16(45), u32(7),
    u16(0xebfb), u16(field === 20010 ? 400 : 501),
    previous === undefined ? concat(u16(0xec55), dbl(x), dbl(-.5)) : concat(u16(0xec56), u16(45), u32(7), u32(previous)),
    u16(0xec57), u16(previous === undefined ? 4 : 6), u16(0xee26), new Uint8Array([3]), u16(0xffff),
    u16(0xed63), u16(field), u16(0xee17), u16(15), u16(0xee18), new Uint8Array([arrangement]), u16(0xffff));
}
const stringProperty = (field: number, value: string) => concat(u16(field), u16(0), new TextEncoder().encode(value), new Uint8Array([0]));
const instance = (fn = 'Function', engraving = 'Engraving', extra: Uint8Array = new Uint8Array()) => new EodRecord(1, 17, 1,
  concat(u16(0xee2d), new TextEncoder().encode('U1'), new Uint8Array([0]), stringProperty(20011, fn),
    stringProperty(20025, engraving), extra));
const layers = new Map([[400, { fontSize: 2.5, angle: 0 }], [501, { fontSize: 1.8, angle: 0 }]]);
const chain = concat(placement(10, 20010), placement(11, 20300, 10), placement(12, 20027, 11),
  placement(13, 20901, 12), placement(14, 20011, 13), placement(15, 20025, 14));
const close = (a: number, b: number, tolerance = 1e-8) => assert(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const layouts = nativePropertyLayouts(chain, instance(), layers);
assert.deepEqual([...layouts.keys()], [20011, 20025]);
close(layouts.get(20011)!.point.x, -1.5);
close(layouts.get(20011)!.point.y, -.5 - 2.5 * 1.5 - 1.8 * 1.242 * 1.08014513);
close(layouts.get(20025)!.point.y - layouts.get(20011)!.point.y, -2.7);
assert.equal(layouts.get(20011)!.alignment, 'end');
assert.equal(layouts.get(20011)!.rotation, 0);
close(layouts.get(20011)!.fontSize, 2.2356);
assert(!layouts.has(20010), 'Existing BMK rendering is not overwritten');
const withoutFunction = nativePropertyLayouts(chain, instance('', 'Engraving'), layers);
assert(!withoutFunction.has(20011));
close(withoutFunction.get(20025)!.point.y, layouts.get(20011)!.point.y, 1e-8);
assert.equal(nativePropertyLayouts(chain, instance('', ''), layers).size, 0);
assert.equal(nativePropertyLayouts(chain, instance(), new Map()).size, 0, 'Missing metrics cannot fabricate a layout');
const brokenChain = concat(placement(10, 20010).subarray(0, 35), placement(14, 20011, 10));
assert.equal(nativePropertyLayouts(brokenChain, instance(), layers).size, 0, 'A truncated predecessor cannot borrow fields');
const cycle = concat(placement(10, 20011, 11), placement(11, 20025, 10));
assert.equal(nativePropertyLayouts(cycle, instance(), layers).size, 0, 'Cyclic references are bounded');
const deviceChain = concat(placement(10, 20010), placement(11, 20030, 10), placement(12, 20027, 11), placement(13, 20011, 12));
const deviceInstance = instance('Function', '', concat(stringProperty(20030, 'Device'), stringProperty(20027, 'Data')));
const deviceLayouts = nativePropertyLayouts(deviceChain, deviceInstance, layers);
assert.deepEqual([...deviceLayouts.keys()], [20030, 20027, 20011]);
close(deviceLayouts.get(20011)!.point.y - deviceLayouts.get(20030)!.point.y, -5.4);
assert.equal(nativePropertyLayouts(concat(placement(10, 20010), placement(11, 27000, 10), placement(12, 20011, 11)), instance(), layers).size, 0, 'An unknown property cannot be treated as empty');
const alternatives = concat(chain, placement(20, 20010, undefined, 2, -8), placement(21, 20011, 20, 2));
const override = placement(100, 20011, undefined, 2);
close(nativePropertyLayouts(alternatives, instance('Function', '', override), layers).get(20011)!.point.x, -8);

// Independent shipped-source/PDF regression, without a page-name special case.
const fixture=await openNativeFixture();
if(fixture){
const {zip,root}=fixture;


const functions = readEodTable(await zip.file(root + 'Function.eod')!.async('uint8array'),
  await zip.file(root + 'Function.eox')!.async('uint8array'), 'Function');
const readLibrary = async (name: string, size: number) => readIndexedEodRecords(
  await zip.file(root + 'SPECIAL.sdb/' + name + '.eod')!.async('uint8array'),
  await zip.file(root + 'SPECIAL.sdb/' + name + '.eox')!.async('uint8array'), { size, typedIndex: false }, name);
const symbol = (await readLibrary('Symbol', 901)).find(r => (r.number(0xeb52) ?? 0) === 0)!;
const variant = (await readLibrary('Variant', 635)).find(r => r.number(0xed95, 4, 4) === symbol.id && (r.number(0xed96, 1) ?? 0) === 0)!;
const sourceLayers = await readNativeLayers(zip, root);
for (const id of [40478, 40440]) {
  const source = functions.find(r => r.id === id)!;
  const positions = nativePropertyLayouts(variant.data, source, sourceLayers);
  const fn = positions.get(20011)!;
  assert(fn);
  close(fn.point.x, -1.5);
  close(fn.point.y, -6.664817, .001);
  close(fn.fontSize, 2.2356);
  assert.equal(fn.alignment, 'end');
  if (id === 40478) close(positions.get(20025)!.point.y, -9.364620, .001);
  else assert(!positions.has(20025));
}
console.log('Native property chain layouts: passed');

}
