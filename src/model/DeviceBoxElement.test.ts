import assert from 'node:assert/strict';
import { componentFromBox,newDeviceBox,resizeDeviceBox } from './DeviceBoxElement';
import { getSymbolById,getSymbolForComponent,setProjectSymbolLibrary } from './symbols';
import { computeBmkPosition,computeFunctionTextPosition,computeTechnicalDataPosition,computeAdditionalTextPosition } from './LabelLayout';
import { rotatedLocalPoint,scalePlacedComponent } from './SymbolGeometry';
import { applySelectionProperties } from './SelectionProperties';
import { ProjectHistory } from './ProjectHistory';
import { MacroManager } from './MacroManager';
import { CadCanvas } from '../editor/CadCanvas';
import { PdfExporter } from '../export/PdfExporter';
import type {Page,Project,PlacedComponent}from'./types';
const page={id:'p',pageNumber:'1',title:'Gerätekästen',components:[],wires:[],boxes:[{id:'old',kind:'device',bmk:'-A1',x:160,y:160,width:240,height:120,label:'Steuerung',description:'Beschreibung',subLabel:'Gravur',fontSize:6,lineStyle:'dashed',lineWidth:1}],plotFrame:{width:1000,height:700,titleBlock:{}}}as unknown as Page;
const project={id:'p',pages:[page],activePageId:'p',drawingUnitsPerMm:2}as Project;
setProjectSymbolLibrary(project);assert.equal(page.boxes!.length,0);assert.equal(page.components.length,1);
const frame=page.components[0];assert.equal(frame.id,'old');assert.equal(frame.functionText,'Steuerung');assert.equal(frame.additionalText,'Beschreibung\nGravur');assert.equal(frame.deviceBox!.width,240);
setProjectSymbolLibrary(project);assert.equal(page.components.length,1,'Migration is idempotent');
const master=getSymbolById('device_box',project)!,masterJson=JSON.stringify(master);
frame.deviceTag='Gerät';frame.technicalCharacteristics='24 V';
for(const rotation of [0,90,180,270]as const){
  frame.rotation=rotation;const symbol=getSymbolForComponent(frame,project)!;
  const corners=[{x:0,y:0},{x:symbol.width,y:symbol.height}].map(p=>rotatedLocalPoint(p,symbol,rotation));const left=Math.min(...corners.map(p=>p.x));
  for(const position of [computeBmkPosition(frame,symbol),computeFunctionTextPosition(frame,symbol),computeTechnicalDataPosition(frame,symbol),computeAdditionalTextPosition(frame,symbol)]){
    assert.equal(position.anchor,'end');assert.equal(position.rotation,0);assert(rotatedLocalPoint(position,symbol,rotation).x<left,'Default labels are on world-left at all rotations');
  }
  const before=rotatedLocalPoint({x:0,y:0},symbol,rotation),anchor={x:frame.x+before.x,y:frame.y+before.y};
  resizeDeviceBox(frame,frame.deviceBox!.width+16,frame.deviceBox!.height+8);
  const after=rotatedLocalPoint({x:0,y:0},getSymbolForComponent(frame,project)!,rotation);
  assert(Math.abs(frame.x+after.x-anchor.x)<1e-9&&Math.abs(frame.y+after.y-anchor.y)<1e-9,'Resizing preserves the opposite frame corner');
}
assert.equal(JSON.stringify(master),masterJson,'A variable frame must not mutate its shared library template');
const other=newDeviceBox('second','-A2',500,300,80,64,2);page.components.push(other);
assert(applySelectionProperties(page,project,{componentIds:[frame.id,other.id],cableIds:[]},{bmkFontSize:2,functionFontSize:1.8,boxLineStyle:'solid',boxLineWidth:.4}));
assert.equal(frame.bmkPosition!.fontSize,4);assert.equal(other.functionTextPosition!.fontSize,3.6);assert.equal(other.deviceBox!.lineWidth,.8);
const saved=JSON.parse(JSON.stringify(project))as Project;setProjectSymbolLibrary(saved);assert.deepEqual(saved.pages[0].components,page.components);
const history=new ProjectHistory();history.reset(project);resizeDeviceBox(other,160,96);history.record(project);assert.equal(history.undo()!.pages[0].components[1].deviceBox!.width,80);
const source=componentFromBox({id:'custom',x:0,y:0,width:80,height:64},2);source.bmkPosition={preset:'custom',offsetX:-38,offsetY:8};source.functionTextPosition={preset:'custom',offsetX:-44,offsetY:-60};
const oldBmk=computeBmkPosition(source,getSymbolForComponent(source,project)!),oldFn=computeFunctionTextPosition(source,getSymbolForComponent(source,project)!);
resizeDeviceBox(source,160,128);assert.deepEqual(computeBmkPosition(source,getSymbolForComponent(source,project)!),oldBmk);assert.deepEqual(computeFunctionTextPosition(source,getSymbolForComponent(source,project)!),oldFn);
const scaled=scalePlacedComponent(frame,2);assert.equal(scaled.deviceBox!.width,frame.deviceBox!.width*2);assert.equal(scaled.bmkPosition!.fontSize,frame.bmkPosition!.fontSize!*2);
setProjectSymbolLibrary(project);const macro=MacroManager.createMacroFromComponents('Gerätekästen','','',page.components);const placed=MacroManager.instantiateWindowMacro(macro,0,0,[],{...project,drawingUnitsPerMm:4});
assert.equal(placed.components[0].deviceBox!.width,frame.deviceBox!.width*2);assert.equal(placed.components[1].deviceBox!.width,other.deviceBox!.width*2);
const canvas:any=Object.assign(Object.create(CadCanvas.prototype),{activePage:page,project,selectedComponentId:other.id});const svg=canvas.renderComponents();assert.match(svg,/data-element-box-resize="second"/);assert.match(svg,/data-label="bmkPosition"/);assert.match(svg,/pointer-events="stroke"/);
const inside:PlacedComponent={id:'inside',symbolId:'contactor_coil',x:other.x+16,y:other.y+16,rotation:0,bmk:'-K1',functionText:'',pins:{}};page.components.push(inside);
assert.equal(canvas.findComponentAt(inside.x+16,inside.y+24)?.id,'inside','Frame interior must never steal a contained component click');
assert.equal(canvas.findComponentAt(other.x+other.deviceBox!.width-10,other.y+other.deviceBox!.height-10),null,'Empty frame interior remains empty canvas');
const texts:string[]=[],rects:number[][]=[],pdf:any={};for(const name of ['setDrawColor','setTextColor','setFont','setFontSize','setLineWidth','setLineDashPattern','setFillColor','circle','line','path','stroke','fillStroke'])pdf[name]=()=>{};pdf.text=(v:string)=>texts.push(v);pdf.rect=(...v:number[])=>rects.push(v);
(PdfExporter as any).renderComponents(pdf,page,project,420,297,{colorMode:'monochrome'},new Map());assert(texts.includes('-A1')&&texts.includes('Steuerung'));assert(rects.some(r=>Math.abs(r[2]-other.deviceBox!.width*.42)<1e-8));
console.log('✓ Device frames are ordinary elements: legacy migration, shared labels and properties, isolated variable geometry, all rotations, fixed-corner resizing, macro scaling, history, hit-testing and PDF');
