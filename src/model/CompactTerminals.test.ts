import assert from 'node:assert/strict';
import { fixture } from '../layout/testing/fixture';
import type { PlacedComponent, Project } from './types';
import { getSymbolById,getSymbolForComponent,setProjectSymbolLibrary,historicalTerminalDefinition,SYMBOL_GEOMETRY_REVISION } from './symbols';
import { AutoconnectEngine } from './AutoconnectEngine';
import { snapSymbolPosition,gridStep } from './DrawingGrid';
import { MacroManager,type WindowMacro } from './MacroManager';
import { macroForPlacement } from './MacroPlacement';
import { ElectricalNetService } from './ElectricalNetService';
import { ProjectIndex } from './ProjectIndex';
import { arePinLabelsVisible, computePinLabelPosition, terminalDesignation } from './LabelLayout';
import { jsPDF } from 'jspdf';
import { PdfExporter } from '../export/PdfExporter';
import { componentShapes } from '../layout/geometry';

const placed=(id:string):PlacedComponent=>({id:'terminal',symbolId:id,bmk:'-X1:1',functionText:'',x:80,y:80,rotation:0,pins:{}});
for(const id of ['terminal_single','terminal_pe']) {
  const p=fixture();setProjectSymbolLibrary(p);
  const compact=getSymbolById(id,p)!,old=historicalTerminalDefinition(id)!;
  assert.equal(compact.width,12);assert.equal(compact.height,20);assert.equal(compact.unitsPerMm,2);
  assert.deepEqual(compact.pins.map(p=>[p.x,p.y]),[[6,0],[6,20]]);
  assert.equal(compact.insertionPoint!.x,6);
  for(const rotation of [0,90,180,270] as const){
    const c={...placed(id),rotation};
    for(let i=0;i<compact.pins.length;i++)assert.deepEqual(
      AutoconnectEngine.getRotatedPinInfo(c,compact.pins[i],compact),
      AutoconnectEngine.getRotatedPinInfo({...c,scale:.5},old.pins[i],old),
      'New 100% pin geometry equals the former 50% at every rotation');
    const grid={spacing:8,origin:{x:0,y:0}},step=gridStep(8,'half');
    const pos=snapSymbolPosition({x:79,y:79},compact,rotation,grid,step);
    for(const pin of compact.pins){const point=AutoconnectEngine.getRotatedPinInfo({...c,...pos},pin,compact);
      assert.equal(point.worldX%step,0);assert.equal(point.worldY%step,0);}
  }
  const a=placed(id),b={...placed(id),id:'second',y:160};
  assert(AutoconnectEngine.findAutoconnectPairs([a,b],1e-6,4,p).some(pair=>pair.pin1.componentId===a.id&&pair.pin2.componentId===b.id));
  if(id==='terminal_pe')assert(compact.pins.every(p=>p.electricalRole==='protective_earth'));

  // Existing placements retain the historical contour, rotations, explicit scale
  // and exact wire endpoints, without replacing project-owned definitions.
  const legacy=fixture();legacy.pages[0].components=[{...placed(id),scale:.5},b];
  legacy.pages[0].wires=[{id:'wire',from:{componentId:'terminal',pinId:'2'},to:{componentId:'second',pinId:'1'},potential:'Signal'}];
  const wires=structuredClone(legacy.pages[0].wires);
  const beforePins=legacy.pages[0].components.flatMap(c=>old.pins.map(pin=>AutoconnectEngine.getRotatedPinInfo(c,pin,old)));
  setProjectSymbolLibrary(legacy);
  assert.equal(legacy.symbolGeometryRevision,SYMBOL_GEOMETRY_REVISION);
  assert(legacy.pages[0].components.every(c=>c.symbolId.includes(':legacy-geometry')));
  const afterPins=legacy.pages[0].components.flatMap(c=>{const s=getSymbolForComponent(c,legacy)!;return s.pins.map(pin=>AutoconnectEngine.getRotatedPinInfo(c,pin,s));});
  assert.deepEqual(afterPins,beforePins);assert.deepEqual(legacy.pages[0].wires,wires);
  const retained=getSymbolForComponent(legacy.pages[0].components[0],legacy)!;
  assert.equal(arePinLabelsVisible(legacy.pages[0].components[0],retained),arePinLabelsVisible(legacy.pages[0].components[0],old));
  for(const pin of old.pins)assert.deepEqual(computePinLabelPosition(legacy.pages[0].components[0],retained,pin),computePinLabelPosition(legacy.pages[0].components[0],old,pin));
  const state=JSON.stringify(legacy);setProjectSymbolLibrary(legacy);assert.equal(JSON.stringify(legacy),state);
  const restored=JSON.parse(state) as Project;setProjectSymbolLibrary(restored);
  assert.equal(getSymbolForComponent(restored.pages[0].components[0],restored)!.width,24);
  assert.equal(getSymbolById(id,restored)!.width,12,'The standard palette stays compact in an old project');
  const native=fixture();native.symbolLibrary=[{...structuredClone(old),width:31}];native.pages[0].components=[placed(id)];
  setProjectSymbolLibrary(native);assert.equal(native.pages[0].components[0].symbolId,id);
  assert.equal(getSymbolForComponent(native.pages[0].components[0],native)!.width,31);
  const context=fixture();context.drawingUnitsPerMm=4;setProjectSymbolLibrary(context);
  assert.equal(getSymbolById(id,context)!.width,24);assert.equal(getSymbolById(id,context)!.height,40);

  const current=fixture();setProjectSymbolLibrary(current);current.pages[0].components=[placed(id)];
  const macro=MacroManager.createMacroFromComponents('Terminal','','',current.pages[0].components);
  assert.equal(macro.symbolGeometryRevision,SYMBOL_GEOMETRY_REVISION);
  assert(macro.symbolLibrary?.some(s=>s.id===id&&s.width===12));
  const exported=MacroManager.exportMacro(macro),parsed=await MacroManager.parseMacroFile(new File([exported.blob],exported.filename));
  assert.equal(parsed.symbolGeometryRevision,SYMBOL_GEOMETRY_REVISION);
  if(parsed.type!=='ema')throw Error('Expected window macro');
  const destination=fixture();setProjectSymbolLibrary(destination);
  const result=MacroManager.instantiateWindowMacro(parsed,120,120,[],destination);
  assert.equal(getSymbolForComponent(result.components[0],destination)!.width,12);
  const historical:WindowMacro={id:'old',name:'Old',type:'ema',category:'',description:'',width:24,height:40,components:[placed(id)]};
  const previous=MacroManager.instantiateWindowMacro(historical,120,120,[],destination);
  assert.equal(getSymbolForComponent(previous.components[0],destination)!.width,24);
  const oldPage=macroForPlacement({id:'old-page',name:'Old page',type:'ems',category:'',description:'',page:{...fixture().pages[0],components:[placed(id)]}});
  assert(oldPage.symbolLibrary?.some(s=>s.id===id&&s.width===24));
  const formerPage=MacroManager.instantiateWindowMacro(oldPage,200,200,[],destination);
  const formerSymbol=getSymbolForComponent(formerPage.components[0],destination)!;
  assert.equal(formerSymbol.width,24);
  assert.equal(arePinLabelsVisible(formerPage.components[0],formerSymbol),arePinLabelsVisible(placed(id),old));
  const pageMacro=MacroManager.createMacroFromPage(current.pages[0]);
  assert.equal(pageMacro.symbolGeometryRevision,SYMBOL_GEOMETRY_REVISION);
  assert.equal(getSymbolForComponent(MacroManager.instantiatePageMacro(pageMacro,destination).components[0],destination)!.width,12);
  assert(new ElectricalNetService(new ProjectIndex(restored)).nets.length>0);
}
const labels=fixture();setProjectSymbolLibrary(labels);
for(const symbolId of ['terminal_single','terminal_single:legacy-geometry']) {
  const base=placed('terminal_single');labels.pages[0].components=[base];
  if(symbolId.includes(':')){
    labels.symbolLibrary=[{...historicalTerminalDefinition('terminal_single')!,id:symbolId}];
    base.symbolId=symbolId;
  }
  for(const field of ['functionText','deviceTag','technicalCharacteristics'] as const)for(const hidden of [false,true]) {
    const component={...base,[field]:'1',bmkPosition:{visible:false},additionalTextPosition:{visible:false},crossRefPosition:{visible:false},
      functionTextPosition:{visible:!hidden},technicalDataPosition:{visible:!hidden},pinLabelPosition:{visible:false}};
    labels.pages[0].components=[component];
    const symbol=getSymbolForComponent(component,labels)!;
    assert.equal(terminalDesignation(component,symbol),hidden?'':'1');
    assert.deepEqual(componentShapes(component,symbol,labels).filter(s=>s.text).map(s=>s.text!.value),hidden?[]:['1']);
    const doc=new jsPDF(),text:string[]=[];
    doc.text=((value:string)=>{text.push(value);return doc;}) as typeof doc.text;
    (PdfExporter as any).renderComponents(doc,labels.pages[0],labels,420,297,{colorMode:'monochrome'},new Map());
    assert.deepEqual(text,hidden?[]:['1'],'PDF respects the visibility of the designation source');
  }
  assert.equal(terminalDesignation(base,getSymbolForComponent(base,labels)!), '','Empty terminals never invent a designation');
}
console.log('✓ Compact terminals: former 50% geometry, rotations, grid, autoconnect, preserved historical projects/macros; no invented designation and matching source-field visibility in layout and PDF');
