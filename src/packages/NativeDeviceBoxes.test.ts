import { openNativeFixture } from './testing/NativeFixture';
import assert from'node:assert/strict';
import{EdbProjectParser}from'./EdbProjectParser';import{getSymbolForComponent,setProjectSymbolLibrary}from'../model/symbols';import{computeBmkPosition,computeFunctionTextPosition,computeAdditionalTextPosition}from'../model/LabelLayout';import{readEodTable}from'./EodReader';import{NATIVE_SCALE as SCALE}from'./NativeSymbolLibrary';import{resizeDeviceBox}from'../model/DeviceBoxElement';import{CadCanvas}from'../editor/CadCanvas';
const fixture=await openNativeFixture();
if(fixture){
const {zip,root}=fixture;
const{project}=await EdbProjectParser.parseEdbProject(zip);setProjectSymbolLibrary(project);
const frames=project.pages.flatMap(p=>p.components.filter(c=>c.deviceBox));assert.equal(frames.length,119);assert(frames.every(c=>c.source?.objectType===17&&getSymbolForComponent(c,project)!.source?.library==='SPECIAL'&&getSymbolForComponent(c,project)!.pins.length===0));
const rows=readEodTable(await zip.file(root+'Function.eod')!.async('uint8array'),await zip.file(root+'Function.eox')!.async('uint8array'),'Function');
for(const frame of frames){
 const row=rows.find(r=>r.id===frame.source!.objectId&&r.type===frame.source!.objectType)!;
 const a=row.point(0xeb1e)!,b=row.point(0xeb1f)!,at=row.position!;
 assert(Math.abs(frame.x/SCALE-(at.x+Math.min(a.x,b.x)))<1e-8);assert(Math.abs(297-frame.y/SCALE-(at.y+Math.max(a.y,b.y)))<1e-8);
 assert(Math.abs(frame.deviceBox!.width/SCALE-Math.abs(a.x-b.x))<1e-8);assert(Math.abs(frame.deviceBox!.height/SCALE-Math.abs(a.y-b.y))<1e-8);
}
const living=project.pages.find(p=>p.title==='Wohnzimmer 1')!,server=project.pages.find(p=>p.title==='Server')!;
const close=(a:number,b:number)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const [page,id,bmk,x,y,w,h]of [[living,37010,'-M4',204,164,32,24],[living,37016,'-M3',204,92,32,24],[server,40440,'-U61',164,152,236,16],[server,40478,'-U66',124,152,24,16]]as const){
 const component=page.components.find(c=>c.source?.objectId===id)!;assert.equal(component.bmk,bmk);const symbol=getSymbolForComponent(component,project)!;
 close(component.x/SCALE,x);close(297-component.y/SCALE,y);close(symbol.width/SCALE,w);close(symbol.height/SCALE,h);assert.equal(component.deviceBox!.lineStyle,'solid');close(component.deviceBox!.lineWidth/SCALE,.25);
 const b=computeBmkPosition(component,symbol),f=computeFunctionTextPosition(component,symbol);close((component.x+b.x)/SCALE,x+1.5);close(297-(component.y+b.y)/SCALE,y);assert.equal(f.anchor,'end');close((component.x+f.x)/SCALE,x-1.5);
 const oldF={x:f.x,y:f.y},before=JSON.stringify(project.symbolLibrary!.find(s=>s.id===component.symbolId));resizeDeviceBox(component,symbol.width+4*SCALE,symbol.height+4*SCALE);
 const changed=getSymbolForComponent(component,project)!;close(changed.width-symbol.width,4*SCALE);const after=computeFunctionTextPosition(component,changed);close(after.x,oldF.x);close(after.y,oldF.y);assert.equal(JSON.stringify(project.symbolLibrary!.find(s=>s.id===component.symbolId)),before);
}
const hub=server.components.find(c=>c.source?.objectId===40478)!,sym=getSymbolForComponent(hub,project)!;assert.equal(hub.additionalText,'Hub');assert.equal(computeAdditionalTextPosition(hub,sym).anchor,'end');
const structure=project.pages.find(p=>p.title==='Einspeisung')!.components.find(c=>c.source?.objectType===88&&c.source.objectId===35207)!;assert(!structure.deviceBox,'Source structure box must not be confused with an electrical device box');
const nativeWires=JSON.stringify(project.pages.map(p=>p.wires)),restored=JSON.parse(JSON.stringify(project));setProjectSymbolLibrary(restored);assert.equal(restored.pages.flatMap((p:any)=>p.components.filter((c:any)=>c.deviceBox)).length,119);assert.equal(JSON.stringify(restored.pages.map((p:any)=>p.wires)),nativeWires);
const canvas:any=Object.assign(Object.create(CadCanvas.prototype),{activePage:server,project});assert.match(canvas.renderComponents(),/data-element-box-resize=/);
console.log('✓ 119 native device frames: original bounds, 0.25 mm source line, explicit BMK/function/engraving layouts, independent resizing, shared library, ordinary component editing and unchanged wiring');

}
