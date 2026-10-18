import { openNativeFixture } from './testing/NativeFixture';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { EodRecord, readEodTable } from './EodReader';
import { readNativePageImages } from './NativeImages';
import { NATIVE_SCALE } from './NativeSymbolLibrary';

const concat = (...parts: Uint8Array[]) => new Uint8Array(parts.flatMap(p => [...p]));
const u16 = (v: number) => new Uint8Array([v & 255, (v >>> 8) & 255]);
const u32 = (v: number) => new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]);
const dbl = (v: number) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v, true); return b; };
const reference = (tag: number, type: number, id: number) => concat(u16(tag), u16(type), u32(id));
function image(id: number, path: string, parentType = 4, parentId = 13, explicitPageType?: number): EodRecord {
  return new EodRecord(id, 91, id, concat(reference(0xebf1, parentType, parentId),
    explicitPageType === undefined ? new Uint8Array() : reference(0xebf2, explicitPageType, parentId),
    u16(0xf0d3), dbl(88), dbl(28), u16(0xf0d4), dbl(12), dbl(104),
    u16(0xf0e7), new TextEncoder().encode(path), new Uint8Array([0])));
}
const zip = new JSZip();
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
zip.file('Project/Images/nested/Device.PNG', png);
zip.file('Project/Images/logo.JPG', new Uint8Array([255, 216, 255, 224, 0]));
zip.file('Project/Images/other.webp', new Uint8Array([82, 73, 70, 70]));
zip.file('Project/Images/a/ambiguous.png', png);
zip.file('Project/Images/b/ambiguous.png', png);
zip.file('Other/Images/unrelated.png', png);
const parent = new EodRecord(50, 17, 1, reference(0xebf1, 4, 20));
const cycle = new EodRecord(51, 17, 1, reference(0xebf1, 17, 51));
const messages: string[] = [];
const images = await readNativePageImages(zip, 'Project/', [
  image(1, 'D:\\images\\device.png'), image(2, 'logo.JPG', 17, 50), parent,
  image(3, 'Device.PNG', 51, 13, 51), // A form with the same ID is not page 13.
  image(4, 'Device.PNG', 17, 51), cycle,
  image(5, 'ambiguous.png'), image(6, 'missing.png'), image(7, 'other.webp'), image(8, 'unrelated.png'),
  image(9, 'Device.PNG', 17, 999, 4) // Explicit graphical page wins over an unresolved logical parent.
], message => messages.push(message));
assert.equal(images.get(13)!.length, 1);
assert.equal(images.get(20)!.length, 1);
assert.equal(images.get(999)!.length, 1);
assert.equal(images.size, 3);
assert(images.get(13)![0].dataUrl.startsWith('data:image/png;base64,'));
assert(images.get(20)![0].dataUrl.startsWith('data:image/jpeg;base64,'));
assert.equal(images.get(20)![0].caption, 'logo.JPG', 'Normal page images have no logo-name exclusion');
assert.equal(messages.length, 4);
const close = (a: number, b: number) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
close(images.get(13)![0].x / NATIVE_SCALE, 12);
close(images.get(13)![0].y / NATIVE_SCALE, 193);
close(images.get(13)![0].width / NATIVE_SCALE, 76);
close(images.get(13)![0].height / NATIVE_SCALE, 76);

// Source archive regression: geometry comes from the placement, not its caption.
const fixture=await openNativeFixture();
if(fixture){
const {zip,root}=fixture;
const sourceZip=zip;


const records = readEodTable(await sourceZip.file(root + 'Instance.eod')!.async('uint8array'),
  await sourceZip.file(root + 'Instance.eox')!.async('uint8array'), 'Instance');
const imported = await readNativePageImages(sourceZip, root, records);
assert.equal([...imported.values()].reduce((n, list) => n + list.length, 0), 8);
assert(!imported.has(101), 'Form images remain resources of the form');
const supply = imported.get(13)!;
assert.equal(supply.length, 1);
assert.equal(supply[0].id, 'native-image-153386');
assert.equal(supply[0].caption, 'Screenshot 2026-05-23 142432.png');
assert(supply[0].dataUrl.startsWith('data:image/png;base64,'));
close(supply[0].x / NATIVE_SCALE, 12);
close(supply[0].y / NATIVE_SCALE, 193);
close(supply[0].width / NATIVE_SCALE, 76);
close(supply[0].height / NATIVE_SCALE, 104 - 28.201591511936343);
assert.equal(imported.get(783)!.length, 5);
console.log('Native editable page images: passed');

}
