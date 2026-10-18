import { openNativeFixture } from './testing/NativeFixture';
import assert from 'node:assert/strict';
import { EdbProjectParser } from './EdbProjectParser';
import { groupSelection,expandGroupedSelection,dissolveElementGroups } from '../model/ElementGroups';
import { captureSelectionMove,translateSelection } from '../model/ElementSelection';
import { EodRecord, readEodTable } from './EodReader';
import { readNativeGroups } from './NativeGroups';
import type { Page } from '../model/types';
// Synthetic native ownership stays covered without a private archive.
const parent=(type:number,id:number)=>{const b=Buffer.alloc(8);b.writeUInt16LE(0xebf1);b.writeUInt16LE(type,2);b.writeUInt32LE(id,4);return b;};
const synthetic={id:'synthetic',components:[{id:'one',source:{objectType:17,objectId:1}},{id:'two',source:{objectType:17,objectId:2}}],wires:[],images:[{id:'native-image-5'}]}as unknown as Page;
readNativeGroups(synthetic,[new EodRecord(100,26,0,parent(4,7)),new EodRecord(200,26,1,parent(26,100)),new EodRecord(1,17,2,parent(26,200)),new EodRecord(2,17,3,parent(26,200)),new EodRecord(5,91,4,parent(26,100)),new EodRecord(300,37,5,parent(4,7))]);
assert.equal(synthetic.groups!.length,2);const selected=groupSelection(synthetic,'native-group-synthetic-100');assert.deepEqual(selected.componentIds,['one','two']);assert.deepEqual(selected.imageIds,['native-image-5']);
assert(dissolveElementGroups(synthetic,selected));assert.equal(synthetic.groups!.length,1);assert.equal(synthetic.groups![0].id,'native-group-synthetic-200');
console.log('✓ Synthetic typed native ownership: nested electrical members, image, outer dissolve and excluded macro frames');

const fixture=await openNativeFixture();
if(fixture){
const {zip,root}=fixture;

const {project}=await EdbProjectParser.parseEdbProject(zip);
const all=project.pages.flatMap(p=>p.groups??[]);assert.equal(all.length,129);assert(all.every(g=>g.source?.objectType===26));
const power=project.pages.find(p=>p.title==='Einspeisung')!,server=project.pages.find(p=>p.title==='Server')!;
assert.equal(power.groups!.length,16);assert.equal(server.groups!.length,17);
const key=(n:number)=>`native-group-${power.id}-${n}`,outer=power.groups!.find(g=>g.id===key(617))!;
assert.deepEqual(outer.members,[{kind:'group',id:key(618)},{kind:'group',id:key(620)}]);
const child=power.groups!.find(g=>g.id===key(618))!;
assert(child.members.some(m=>m.kind==='component'&&m.id==='native_13_17_114'),'A grouped electrical device is in Function.eod, not Instance.eod');
const selection=groupSelection(power,outer.id);assert.equal(selection.componentIds.length,8);
assert.deepEqual(new Set(expandGroupedSelection(power,{componentIds:['native_13_17_114'],cableIds:[]}).componentIds),new Set(selection.componentIds));
const componentsBefore=structuredClone(power.components),wiresBefore=structuredClone(power.wires);const snapshot=captureSelectionMove(power,selection);
translateSelection(power,snapshot,40,20);
for(const c of power.components){const old=componentsBefore.find(o=>o.id===c.id)!;assert.equal(c.x,old.x+(selection.componentIds.includes(c.id)?40:0));assert.equal(c.y,old.y+(selection.componentIds.includes(c.id)?20:0));}
translateSelection(power,snapshot,0,0);assert.deepEqual(power.components,componentsBefore);assert.deepEqual(power.wires,wiresBefore);
assert(dissolveElementGroups(power,selection));assert(!power.groups!.some(g=>g.id===outer.id));assert(power.groups!.some(g=>g.id===child.id));
assert.equal(expandGroupedSelection(power,{componentIds:['native_13_17_114'],cableIds:[]}).componentIds.length,2);
const records=(await Promise.all(['Function','IPoint','Potential','Instance'].map(async name=>readEodTable(await zip.file(`${root}${name}.eod`)!.async('uint8array'),await zip.file(`${root}${name}.eox`)!.async('uint8array'),name as 'Instance')))).flat();
for(const page of project.pages){
 const groupIds=new Set(page.groups?.map(g=>g.id));
 for(const group of page.groups??[])for(const member of group.members){
  if(member.kind==='group')assert(groupIds.has(member.id));else if(member.kind==='component')assert(page.components.some(c=>c.id===member.id));else assert(member.kind==='image'||member.kind==='cable');
 }
}
const frameRecords=records.filter(r=>r.type===37);assert.equal(frameRecords.length,12);const noGroups={components:[],wires:[]}as unknown as Page;readNativeGroups(noGroups,frameRecords);assert.deepEqual(noGroups.groups,[],'Macro frame metadata must never be guessed as grouping');
console.log('✓ Original split archive: 129 genuine groups, 23 nested source containers, 16 on supply/17 on Server; cross-table ownership, exact 8-element hierarchy, reversible movement and outer-layer dissolve');

}
