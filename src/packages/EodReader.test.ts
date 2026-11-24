import assert from 'node:assert/strict';
import { zlibSync } from 'fflate';
import { readEodTable, readIndexedEodRecords } from './EodReader';

// Synthetic indexed storage only; no manufacturer/project records are bundled.
const payload = (id: number, type: number, value: string) => {
  const b = Buffer.alloc(12 + Buffer.byteLength(value));
  b.writeUInt16LE(0xea61); b.writeUInt16LE(type, 2); b.writeUInt32LE(id, 4);
  b.writeUInt16LE(0x1234, 8); b.write(value, 10); return b;
};
function table(size: number, typedIndex: boolean, overhead: 1 | 5 = 5, compressed = false) {
  const data = Buffer.alloc(size * 3), index = Buffer.alloc(160);
  Buffer.from([0xfe,0x53,2,2,4,4,15,255]).copy(index);index[11]=4;
  index.writeUIntBE(size-overhead,12,3);index.writeUInt32BE(3,33);
  for(let row=0;row<3;row++) {
    const id=row+10,type=typedIndex?17:4,slot=data.subarray(row*size,(row+1)*size);
    slot.writeUInt32BE(id);slot.writeUInt16BE(type,4);
    const content=payload(id,type,'row-'+row);
    if(compressed){const packed=zlibSync(content,{level:9});slot.writeUInt32LE(Math.max(content.length,packed.length),24);slot.writeUInt32LE(packed.length,28);slot.set(packed,32);}
    else slot.set(content,24);
    // The middle slot is obsolete and deliberately absent from the index.
    if(row!==1){const start=96+row*12;index[start]=id&255;if(typedIndex)index.writeUInt16BE(type,start+1);index.writeUInt32BE(row+1,start+(typedIndex?3:1));}
  }
  return {data,index};
}
for(const [name,size,typed] of [['Page',1146,false],['Page',1138,false],['Function',1321,true],['IPoint',506,true],['Instance',215,true],['Connection',968,false]] as const){
  for(const compressed of [false,true]){
    const t=table(size,typed,5,compressed),rows=readEodTable(t.data,t.index,name);
    assert.deepEqual(rows.map(r=>r.id),[10,12],name+' compressed='+compressed);assert.deepEqual(rows.map(r=>r.row),[1,3]);
    assert.deepEqual(rows.map(r=>r.string(0x1234)),['row-0','row-2']);
    assert(rows.every(r=>!r.partial));
  }
}
for(const overhead of [1,5] as const){
  const t=table(320,false,overhead);
  const rows=readIndexedEodRecords(t.data,t.index,{size:901,typedIndex:false,recordOverhead:overhead},'Variable');
  assert.deepEqual(rows.map(r=>r.id),[10,12]);
  // Fixed legacy dimensions remain usable with a headerless synthetic index.
  const legacy=Buffer.from(t.index);legacy.fill(0,0,49);
  assert.equal(readIndexedEodRecords(t.data,legacy,{size:320,typedIndex:false},'Legacy').length,2);
}
const original=table(1146,false),wrong=Buffer.from(original.data);
wrong.writeUInt32LE(999,28); // Payload identity differs from the indexed slot header.
assert.deepEqual(readEodTable(wrong,original.index,'Page').map(r=>r.id),[12]);
assert.throws(()=>readEodTable(original.data.subarray(0,-1),original.index,'Page'),/Page.eod Datensatzformat/);
const malformed=Buffer.from(original.index);malformed.fill(0,12,15);
assert.throws(()=>readEodTable(original.data,malformed,'Page'),/Page.eox Datensatzlänge/);
const empty=Buffer.from(original.index);empty.writeUInt32BE(0,33);
assert.deepEqual(readEodTable(new Uint8Array([0]),empty,'Potential'),[]);
assert.throws(()=>readEodTable(new Uint8Array([0]),original.index,'Potential'),/Datensatzformat/);
assert.throws(()=>readEodTable(new Uint8Array([1]),empty,'Potential'),/Datensatzformat/);
console.log('✓ Indexed table capacities across versions, project/library trailers, allocated empty tables, raw/compressed payloads, deleted-slot exclusion, header/payload identity checks, legacy fallback and malformed/truncated guards');
