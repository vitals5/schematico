import { openNativeFixture } from './testing/NativeFixture';
import assert from 'node:assert/strict';
import { nativePageText } from './NativeText';
import { EodRecord } from './EodReader';
import { EdbProjectParser } from './EdbProjectParser';
import { computeFunctionTextPosition, computeAdditionalTextPosition } from '../model/LabelLayout';
import { getSymbolForComponent } from '../model/symbols';

const tag=(id:number,data:Uint8Array)=>new Uint8Array([id&255,id>>>8,...data]);
const bytes=(...values:Uint8Array[])=>new Uint8Array(values.flatMap(v=>Array.from(v)));
const point=new Uint8Array(16);new DataView(point.buffer).setFloat64(0,132,true);new DataView(point.buffer).setFloat64(8,32,true);
const layer=tag(0xebfb,new Uint8Array([110,0])),value=tag(0xec5f,new TextEncoder().encode('de_DE@Freier Text;\0'));
const payload=bytes(tag(0xec55,point),layer,tag(0xee26,new Uint8Array([10])),value);
const layers=new Map([[110,{fontSize:2.5,fontColor:'#ff00ff'}]]);
for(const type of [0x1e,0x53]){
  const text=nativePageText(new EodRecord(1,type,1,payload),layers)!;
  assert.equal(text.text,'Freier Text');assert.deepEqual(text.position,{x:132,y:32});
  assert.equal(text.fontSize,2.5*1000/420*1.242);assert.equal(text.config.fontColor,'#ff00ff');assert.equal(text.config.alignment,'start');
}
assert.equal(nativePageText(new EodRecord(1,53,1,payload),layers),undefined,'Property placeholders are not literal page text');
assert.equal(nativePageText(new EodRecord(1,83,1,value),layers),undefined,'Incomplete positions must not create a fabricated text');
const explicit=new Uint8Array(8);new DataView(explicit.buffer).setFloat64(0,1.8,true);
const smaller=nativePageText(new EodRecord(1,83,1,bytes(payload,tag(0xee21,explicit))),layers)!;
assert.equal(smaller.fontSize,1.8*1000/420*1.242,'Per-instance text height overrides the layer');
const fixture=await openNativeFixture();
if(fixture){
  const {zip,root}=fixture;
  const {project}=await EdbProjectParser.parseEdbProject(zip);
  const page=project.pages.find(p=>p.title==='Server')!,scale=1000/420;
  assert.equal(page.wires.length,42);assert.equal(project.logicalConnections!.length,1915);
  const expected=[['X-Sense Hub',132],['Server',172],['Zigbee',236],['Thread',256],['RF433',276],['Bluetooth',296],['KVM',316]] as const;
  for(const [text,x] of expected){
    const component=page.components.find(c=>c.source?.objectType===83&&c.functionText===text)!;
    assert(component,`${text} is an editable literal placement`);
    const symbol=getSymbolForComponent(component,project)!;assert(project.symbolLibrary!.some(s=>s.id===symbol.id));
    const label=computeFunctionTextPosition(component,symbol);
    assert(Math.abs(component.x+label.x-x*scale)<1e-7);
    assert(Math.abs(component.y+label.y-(297-32)*scale)<1e-7);
    assert.equal(label.fontColor,'#ff00ff');assert.equal(label.fontSize,2.5*scale*1.242);assert.equal(label.visible,true);
  }
  const hub=page.components.find(c=>c.id==='native_789_17_40478')!;
  assert.equal(hub.additionalText,'Hub');assert.equal(hub.functionText,'X-Sense');
  assert.equal(hub.functionTextPosition?.visible,true);assert.equal(hub.additionalTextPosition?.visible,true);
  const symbol=getSymbolForComponent(hub,project)!;
  for (const [label,y] of [[computeFunctionTextPosition(hub,symbol),151.664817],[computeAdditionalTextPosition(hub,symbol),154.364620]] as const) {
    assert(Math.abs((hub.x+label.x)/scale-122.5)<.001);
    assert(Math.abs((hub.y+label.y)/scale-y)<.001);
    assert.equal(label.anchor,'end');assert(Math.abs(label.fontSize-2.2356*scale)<1e-10);
  }
  for (const id of [40456,40457,40458,40459,40460,40461,40487,40488]) {
    const socket=page.components.find(c=>c.source?.objectId===id)!;
    const definition=getSymbolForComponent(socket,project)!,label=socket.pins['0'].labelPosition!;
    assert(label);assert.equal(socket.pins['0'].customLabel,'USB');assert.equal(label.alignment,'middle');
    assert(Math.abs((socket.y+label.y)/scale-152.714688)<.001);
    assert.equal(definition.pins[0].labelPosition,undefined,'Instance layout does not change the master geometry');
  }
  assert.equal(page.components.find(c=>c.source?.objectId===40424)!.pins['0'].labelPosition,undefined,'An absent source designation must not create a placeholder label');
  const image=project.pages.find(p=>p.title==='Einspeisung')!.images!.find(i=>i.id==='native-image-153386')!;
  assert(image);assert(Math.abs(image.x/scale-12)<1e-7);assert(Math.abs(image.y/scale-193)<1e-7);
  assert(Math.abs(image.width/scale-76)<1e-7);assert(image.dataUrl.startsWith('data:image/png;'));
  assert.equal(project.pages.reduce((n,p)=>n+(p.images?.length??0),0),8);
}
console.log('✓ Ordinary/special literal texts, layer height/color, editable native page placements and imported engraving');
