import assert from 'node:assert/strict';
import { createElementGroup,dissolveElementGroups,expandGroupedSelection,groupSelection,pruneElementGroups,remapElementGroups,canGroupSelection } from './ElementGroups';
import { captureSelectionMove,translateSelection,selectionCount } from './ElementSelection';
import { ProjectHistory } from './ProjectHistory';
import { MacroManager } from './MacroManager';
import { macroForPlacement } from './MacroPlacement';
import { PackageHandler } from '../packages/PackageHandler';
import { defaultPlotFrame } from './PlotFrame';
import type { Page,Project,PlacedComponent } from './types';

const component=(id:string,x:number):PlacedComponent=>({id,symbolId:'contactor_coil',x,y:50,rotation:0,pins:{'1':{wireIds:['w']},'2':{}},bmk:'-K'+id,functionText:id});
const page:Page={id:'p',title:'Gruppen',pageNumber:'1',pageType:'schematic',higherLevel:'',location:'',components:[component('a',20),component('b',100),component('c',200)],
  wires:[{id:'w',from:{componentId:'a',pinId:'1'},to:{componentId:'b',pinId:'1'},potential:'Signal',waypoints:[{x:60,y:60}]}],
  images:[{id:'image',dataUrl:'data:image/png;base64,AA==',x:200,y:250,width:40,height:40}],texts:[{id:'text',text:'Gruppe',x:80,y:70,fontSize:9}],
  plotFrame:{type:'DIN_A3_LANDSCAPE',width:840,height:594,columns:10,rows:['A'],titleBlock:{projectTitle:'',commission:'',company:'',author:'',date:'',revision:'',sheetNumber:'1',totalSheets:'1'}}};
const project={id:'test',name:'Test',description:'',author:'',company:'',created:'',version:'1',standard:'DIN EN 81346-2 / IEC 60617',drawingUnitsPerMm:2,activePageId:'p',pages:[page],modified:'',symbolLibrary:[],plotFrameTemplate:defaultPlotFrame()} as unknown as Project;
const history=new ProjectHistory();history.reset(project);
const pair={componentIds:['a','b'],cableIds:[]};
assert(!createElementGroup(page,{componentIds:['a'],cableIds:[]}));assert.equal(page.groups,undefined);
const group=createElementGroup(page,pair)!;history.record(project);
assert.equal(group.members.length,2);assert.deepEqual(expandGroupedSelection(page,{componentIds:['b'],cableIds:[]}).componentIds.sort(),pair.componentIds);
assert(!canGroupSelection(page,pair),'Selecting one existing group cannot create identical wrappers');
const outer=createElementGroup(page,{componentIds:['a','c'],cableIds:[],imageIds:['image'],textIds:['text']})!;
assert(outer.members.some(m=>m.kind==='group'&&m.id===group.id));assert.equal(selectionCount(groupSelection(page,outer.id)),5);
const selected=expandGroupedSelection(page,{componentIds:['b'],cableIds:[]}),before=structuredClone(page);
const snapshot=captureSelectionMove(page,selected);translateSelection(page,snapshot,20,40);translateSelection(page,snapshot,40,60);
assert.deepEqual(page.components.map(c=>[c.x,c.y]),[[60,110],[140,110],[240,110]]);assert.deepEqual(page.wires[0].waypoints,[{x:100,y:120}]);
assert.deepEqual([page.images![0].x,page.images![0].y,page.texts![0].x,page.texts![0].y],[240,310,120,130]);
assert.deepEqual(page.groups,before.groups);assert(dissolveElementGroups(page,selected));assert.equal(page.groups!.length,1);assert.equal(page.groups![0].id,group.id);
assert.equal(selectionCount(expandGroupedSelection(page,{componentIds:['a'],cableIds:[]})),2,'Inner group survives outer dissolve');
assert(dissolveElementGroups(page,pair));assert.equal(page.groups!.length,0);assert.equal(selectionCount(expandGroupedSelection(page,{componentIds:['a'],cableIds:[]})),1);
history.record(project);assert.equal(history.undo()!.pages[0].groups!.length,1);assert.equal(history.undo()!.pages[0].groups,undefined);assert.equal(history.redo()!.pages[0].groups!.length,1);
page.groups=before.groups;
for(const format of ['xml','zw1']as const){
  const file=format==='xml'?new File([PackageHandler.generateProjectXml(project)],'groups.xml'):new File([await PackageHandler.exportToZw1(project)],'groups.zw1');
  const saved=await PackageHandler.inspectFile(file);assert.deepEqual(saved.extractedProject!.pages[0].groups,page.groups);
}
assert.deepEqual(JSON.parse(JSON.stringify(project)).pages[0].groups,page.groups);
// Dangling and duplicate members and cycles cannot hang a loaded project.
const malformed=structuredClone(page);malformed.groups=[{id:'x',members:[{kind:'group',id:'y'},{kind:'component',id:'a'},{kind:'component',id:'gone'}]},{id:'y',members:[{kind:'group',id:'x'},{kind:'component',id:'a'},{kind:'component',id:'b'}]}];
pruneElementGroups(malformed);assert.equal(selectionCount(groupSelection(malformed,malformed.groups![0].id)),2);
const deleted=structuredClone(page);deleted.components=deleted.components.filter(c=>c.id!=='a');pruneElementGroups(deleted);assert(!JSON.stringify(deleted.groups).includes('"id":"a"'));
// Export/insertion makes independent group/member identities on every placement.
const window=MacroManager.createMacroFromComponents('Gruppe','','',page.components,page.wires,page.groups);
assert.equal(window.groups!.length,2);assert.equal(window.groups!.flatMap(g=>g.members).filter(m=>m.kind==='image'||m.kind==='text').length,0);
const first=MacroManager.instantiateWindowMacro(window,100,200,[],project),second=MacroManager.instantiateWindowMacro(window,300,400,first.components,project);
assert(first.groups.length===2&&second.groups.length===2);assert(!first.groups.some(g=>second.groups.some(h=>g.id===h.id)));
assert.deepEqual(first.groups.flatMap(g=>g.members.filter(m=>m.kind==='component').map(m=>m.id)).sort(),first.components.map(c=>c.id).sort());
const mixed=MacroManager.createMacroFromSelection('Gemischt','','',page,expandGroupedSelection(page,{componentIds:['a'],cableIds:[]}));
assert.equal(mixed.groups!.length,2);assert.equal(mixed.images!.length,1);assert.equal(mixed.components.length,4,'Selected free text is exported with all three electrical members');
const mixedPlaced=MacroManager.instantiateWindowMacro(mixed,80,80,[],project);assert.equal(mixedPlaced.groups.length,2);assert.equal(mixedPlaced.images.length,1);
assert.equal(mixedPlaced.groups.flatMap(g=>g.members).filter(m=>m.kind==='component').length,4);
const pageMacro=MacroManager.createMacroFromPage(page),placed=macroForPlacement(pageMacro);
assert(placed.groups!.flatMap(g=>g.members).every(m=>m.kind!=='text'),'Text converted to an editable component keeps group ownership');
const inserted=MacroManager.instantiateWindowMacro(placed,0,0,[],project);assert.equal(inserted.groups.length,2);assert(inserted.groups.flatMap(g=>g.members).some(m=>m.kind==='image'&&inserted.images.some(i=>i.id===m.id)));
const cloned=MacroManager.instantiatePageMacro(pageMacro,project);assert.equal(cloned.groups!.length,2);assert(cloned.groups!.flatMap(g=>g.members).some(m=>m.kind==='text'&&cloned.texts!.some(t=>t.id===m.id)));
assert.notEqual(cloned.images![0].id,page.images![0].id);assert.deepEqual(cloned.components[0].pins['1'].wireIds,[cloned.wires[0].id]);
assert.deepEqual(remapElementGroups(page.groups,{component:new Map()}),[]);
console.log('✓ Persistent nested groups: selection, movement, dissolve, history, deletion, JSON/XML/archive roundtrips and independent window/page macro insertion');
