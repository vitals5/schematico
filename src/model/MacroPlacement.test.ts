import assert from 'node:assert/strict';
import { MacroManager, PageMacro, BUILTIN_MACROS } from './MacroManager';
import { Page, Project, SymbolDefinition } from './types';
import { componentInsertionPoint } from './SymbolGeometry';
import { getSymbolForComponent } from './symbols';
import { computeFunctionTextPosition } from './LabelLayout';

const symbol: SymbolDefinition = { id: 'portable:source', name: 'Testgerät', category: 'controls', standard: 'DIN EN 60617',
  defaultBmkPrefix: '-K', defaultFunctionText: '', description: '', width: 30, height: 45, unitsPerMm: 3,
  insertionPoint: { x: 15, y: 0 }, pins: [{ id: 'P', name: 'P', x: 15, y: 0, direction: 'top' }],
  svgContent: '', importedGraphics: [{ kind: 'rect', x: 0, y: 0, width: 30, height: 45, color: 'currentColor' }] };
const page = { id: 'original-page', pageNumber: '99', pageType: 'schematic', title: 'Original', higherLevel: '=A', location: '+B',
  components: [0,1].map(i => ({ id: `original-${i}`, symbolId: symbol.id, bmk: `-K${i+1}`, functionText: `Gerät ${i}`, x: 300+i*90, y: 200+i*90,
    rotation: (i===0?90:0) as 0|90, pins: { P: { customLabel: 'P', wireIds: ['original-wire'] } } })),
  wires: [{ id: 'original-wire', from: { componentId: 'original-0', pinId: 'P' }, to: { componentId: 'original-1', pinId: 'P' }, potential: 'L1', waypoints: [{ x: 340, y: 270 }], lineWidth: 1.5 }],
  images: [{ id: 'original-image', dataUrl: 'data:image/png;base64,AA==', x: 250, y: 160, width: 30, height: 20 }],
  texts: [{ id: 'original-text', x: 280, y: 195, text: 'Freier Text', fontSize: 7, rotation: 180, fontColor: '#ff00ff', fontWeight: 'bold' }],
  boxes: [{ id: 'original-box', x: 270, y: 180, width: 200, height: 150, label: 'Bereich', description: 'Beschreibung', subLabel: 'Ort' }],
  cables: [{ id: 'original-cable', start: { x: 320, y: 250 }, end: { x: 360, y: 250 }, bmk: '-W50', cableType: 'NYM', crossSection: '1.5',
    fontSize: 6, labelOffset: { x: 3, y: -6 }, cores: [{ id: 'original-core', t: .5, designation: 'L', wireIds: ['original-wire'] }] }],
  plotFrame: { type:'DIN_A3_LANDSCAPE', columns:10, rows:['A'], width: 5000, height: 4000, titleBlock: { projectTitle: 'Rahmen gehört zur Quellseite', totalSheets: '99', commission:'',company:'',author:'',date:'',revision:'',sheetNumber:'99' } } } as Page;
const source: PageMacro = { id: 'source', type: 'ems', name: 'EMS', category: '', description: '', unitsPerMm: 3, symbolLibrary: [symbol], page };
const original = JSON.stringify(source), prepared = MacroManager.forPlacement(source);
assert.equal(prepared.type, 'ema'); assert.equal(prepared.components.length, 3);
assert(prepared.width < 500 && prepared.height < 500, 'Placement bounds use content, not the source sheet');
assert.equal(JSON.stringify(source), original, 'Preparing a placement never mutates the library entry');
const p0=prepared.components.find(c=>c.id==='original-0')!,p1=prepared.components.find(c=>c.id==='original-1')!;
assert.equal(p1.x-p0.x,90);assert.equal(p1.y-p0.y,90);
assert.equal(prepared.boxes![0].label,'Bereich','Boxes retain their editable object type');
assert(!('page' in prepared), 'Page metadata is excluded from the placement');
const destination = { ...page, id: 'target', pageNumber: '2', title: 'Ziel', components: [], wires: [], images: [], cables: [{ ...page.cables![0], bmk: '-W1' }], texts: [], boxes: [],
  plotFrame: { ...page.plotFrame, width: 1000, height: 700, titleBlock: { ...page.plotFrame.titleBlock, projectTitle: 'Zielrahmen', totalSheets: '1' } } } as Page;
const project = { id: 'target-project', drawingUnitsPerMm: 2, pages: [destination], activePageId: destination.id } as Project;
const metadata = JSON.stringify({ title: destination.title, frame: destination.plotFrame, pages: project.pages.length, active: project.activePageId });
const result = MacroManager.instantiateWindowMacro(prepared,100,200,[],project), factor = 2/3;
const d0=result.components.find(c=>c.functionText==='Gerät 0')!,d1=result.components.find(c=>c.functionText==='Gerät 1')!;
assert.equal(result.components.length,3); assert.equal(result.wires.length,1); assert.equal(result.images.length,1); assert.equal(result.cables.length,1);
assert(Math.abs(d1.x-d0.x-60)<1e-9); assert(Math.abs(d1.y-d0.y-60)<1e-9);
assert.equal(d0.rotation,90);
assert.notEqual(d0.id,'original-0'); assert.equal(result.wires[0].from.componentId,d0.id);
assert.equal(result.wires[0].to.componentId,d1.id); assert.notEqual(result.wires[0].id,'original-wire');
assert.deepEqual(d0.pins.P.wireIds,[result.wires[0].id]);
assert.deepEqual(result.wires[0].waypoints,prepared.wires!.map(w=>w.waypoints![0]).map(p=>({x:100+p.x*factor,y:200+p.y*factor})));
assert.equal(result.wires[0].lineWidth,1);
assert.equal(result.images[0].width,20); assert.notEqual(result.images[0].id,'original-image');
assert.equal(result.cables[0].bmk,'-W2'); assert.notEqual(result.cables[0].id,'original-cable');
assert.deepEqual(result.cables[0].cores[0].wireIds,[result.wires[0].id]); assert.notEqual(result.cables[0].cores[0].id,'original-core');
assert.equal(result.cables[0].fontSize,4); assert.deepEqual(result.cables[0].labelOffset,{x:2,y:-4});
const text=result.components.find(c=>c.functionText==='Freier Text')!,textSymbol=getSymbolForComponent(text,project)!;
const position=computeFunctionTextPosition(text,textSymbol); assert.equal(position.rotation,180); assert.equal(position.fontColor,'#ff00ff'); assert.equal(position.fontWeight,'bold');
assert(Math.abs(position.fontSize-7*factor)<1e-10);
assert.equal(result.boxes[0].subLabel,'Ort');
assert.equal(metadata,JSON.stringify({title:destination.title,frame:destination.plotFrame,pages:project.pages.length,active:project.activePageId}));
assert.equal(JSON.stringify(source),original);
const anchor=componentInsertionPoint(d0,getSymbolForComponent(d0,project)!);
const handle=prepared.handlePoint!;assert(Math.abs(anchor.x-(100+handle.x*factor))<1e-8);assert(Math.abs(anchor.y-(200+handle.y*factor))<1e-8);
destination.cables!.push(...result.cables);
const next=MacroManager.instantiateWindowMacro(prepared,300,400,result.components,project);
assert.equal(next.cables[0].bmk,'-W3'); assert.notEqual(next.images[0].id,result.images[0].id); assert.notEqual(next.components[0].id,d0.id);
assert.notEqual(next.wires[0].id,result.wires[0].id); assert.equal(next.components.find(c=>c.functionText==='Gerät 0')!.bmk,'-K3');
const imageOnly=structuredClone(source);imageOnly.page.components=[];imageOnly.page.wires=[];imageOnly.page.texts=[];imageOnly.page.boxes=[];imageOnly.page.cables=[];
const imagePlacement=MacroManager.forPlacement(imageOnly);assert.equal(imagePlacement.components.length,0);assert.equal(imagePlacement.images!.length,1);
const empty=structuredClone(imageOnly);empty.page.images=[];assert.throws(()=>MacroManager.forPlacement(empty),/keine platzierbaren/);
const ema=MacroManager.forPlacement(prepared);assert.deepEqual(ema,prepared);assert.notEqual(ema,prepared);
console.log('EMS element placement: source isolation, content bounds, shared symbols, rotated anchors, scaling, wiring, editable text/boxes, images, cables and unique repeated placements passed');

const builtIn=BUILTIN_MACROS.find(m=>m.type==='ems')!;
const importedCopy=await MacroManager.parseMacroFile(new File([JSON.stringify(builtIn)],'Kopie.ems'));
assert.notEqual(importedCopy.id,builtIn.id,'An imported copy must not resolve to the original built-in macro');
