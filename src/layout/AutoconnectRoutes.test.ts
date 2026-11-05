import assert from 'node:assert/strict';
import {fixture} from './testing/fixture';
import {constructAutoconnectRoutes,contactPartition} from './autoconnectRoutes';
import {preferDraftAutoconnect} from './autoconnectDraft';
import {snapshotPage} from './geometry';
import {validateLayout,netIds} from './validate';
import {applyLayout} from './service';
import {buildDraft,handleCreateDraft} from './tools';
import {handleCreatePage} from '../ai/mcp-tools/handlers';
import {AutoconnectEngine} from '../model/AutoconnectEngine';
import {ProjectHistory} from '../model/ProjectHistory';
import type {Project,PlacedComponent,SymbolDefinition,Wire} from '../model/types';
import type {LayoutPreview} from './types';

function graph(prefix='a',crossing=false){
 const project=fixture(),page=project.pages[0];
 const pin=(id:string,direction:'top'|'bottom'|'left'|'right'):SymbolDefinition=>({id,name:id,description:'',category:'supply',standard:'',defaultBmkPrefix:'',defaultFunctionText:'',width:16,height:16,pins:[{id:'1',name:'1',direction,x:direction==='left'?0:direction==='right'?16:8,y:direction==='top'?0:direction==='bottom'?16:8}],svgContent:'<rect width="16" height="16" fill="none" stroke="currentColor"/>'});
 project.symbolLibrary=[pin('out','bottom'),pin('in','top'),pin('east','right'),pin('west','left')];
 const add=(id:string,symbolId:string,x:number,y:number):PlacedComponent=>{const c:PlacedComponent={id:prefix+id,symbolId,bmk:'',functionText:'',x,y,rotation:0,pinLabelPosition:{visible:false},pins:{'1':{wireIds:[]}}};page.components.push(c);return c;};
 const feed=add('feed','out',92,64),one=add('one','in',92,240),two=add('two','in',212,240);
 const wire=(id:string,a:PlacedComponent,b:PlacedComponent,waypoints:Wire['waypoints'],potential='L1')=>page.wires.push({id:prefix+id,from:{componentId:a.id,pinId:'1'},to:{componentId:b.id,pinId:'1'},waypoints,potential,routingMode:'auto',isAutoconnect:false});
 wire('first',feed,one,[]);wire('second',feed,two,[{x:100,y:160},{x:220,y:160}]);
 page.groups=[{id:prefix+'group',members:[feed,one,two].map(c=>({kind:'component',id:c.id}))}];
 if(crossing){const left=add('left','east',24,192),right=add('right','west',280,192);wire('crossing',left,right,[],'N');}
 return project;
}
const project=graph('a',true),before=JSON.stringify(project),originals=new Set(project.pages[0].components.map(c=>c.id));
assert(validateLayout(snapshotPage(project.pages[0],project)).valid);
const built=constructAutoconnectRoutes(project,'p'),page=built.project.pages[0];
assert.equal(JSON.stringify(project),before,'Compilation is isolated');
assert.equal(built.report.status,'complete');assert.equal(built.report.addedSymbols,2);
assert(page.components.some(c=>c.symbolId.startsWith('t_piece_directed')));assert(page.components.some(c=>c.symbolId.startsWith('corner_compact')));
assert(page.wires.every(w=>w.isAutoconnect&&!w.waypoints?.length));assert(validateLayout(snapshotPage(page,built.project)).valid);
assert.equal(contactPartition(snapshotPage(page,built.project),originals),contactPartition(snapshotPage(project.pages[0],project),originals));
assert.equal(new Set(netIds(snapshotPage(page,built.project)).values()).size,2,'An unrelated crossing remains a separate net');
for(const w of project.pages[0].wires)assert(page.wires.some(n=>n.id===w.id),'Every original wire ID survives');
assert.equal(page.groups![0].members.length,5,'Shared functional membership includes the generated pieces');
for(const c of project.pages[0].components){const n=page.components.find(n=>n.id===c.id)!;const shape=(v:PlacedComponent)=>JSON.stringify({...v,pins:undefined});assert.equal(shape(n),shape(c),'Original devices remain exact');}
const pairs=AutoconnectEngine.findAutoconnectPairs(page.components,1e-6,8,built.project);
for(const w of page.wires)assert(pairs.some(p=>[p.pin1,p.pin2].every(pin=>[w.from,w.to].some(ep=>ep.componentId===pin.componentId&&ep.pinId===pin.pinId))));
const reverse=graph();for(const w of reverse.pages[0].wires){[w.from,w.to]=[w.to,w.from];w.waypoints=w.waypoints?.slice().reverse();}
assert.equal(constructAutoconnectRoutes(reverse,'p').report.status,'complete');
for(const rotation of [90,180,270] as const){
 const turned=graph(),a=rotation*Math.PI/180,turn=(p:{x:number;y:number})=>({x:200+(p.x-200)*Math.cos(a)-(p.y-180)*Math.sin(a),y:180+(p.x-200)*Math.sin(a)+(p.y-180)*Math.cos(a)});
 for(const c of turned.pages[0].components){const p=turn({x:c.x+8,y:c.y+8});c.x=p.x-8;c.y=p.y-8;c.rotation=rotation;}
 for(const w of turned.pages[0].wires)w.waypoints=w.waypoints?.map(turn);
 const result=constructAutoconnectRoutes(turned,'p');assert.equal(result.report.status,'complete',JSON.stringify(result.report));
 assert.equal(contactPartition(snapshotPage(result.project.pages[0],result.project),new Set(turned.pages[0].components.map(c=>c.id))),contactPartition(snapshotPage(turned.pages[0],turned),new Set(turned.pages[0].components.map(c=>c.id))));
}
const mixed=graph();mixed.pages[0].wires[1].crossSection='2.5';
const rejected=constructAutoconnectRoutes(mixed,'p');assert.equal(rejected.report.addedSymbols,0);assert(rejected.report.issues.some(i=>i.type==='different_wire_data'));
assert.equal(constructAutoconnectRoutes(graph(),'p',new Set(['afirst'])).report.addedSymbols,0,'Cross-sheet link nets retain audited endpoints');
const wireGroup=graph();wireGroup.pages[0].groups!.push({id:'wire-group',members:[{kind:'wire',id:'afirst'}]});
assert(constructAutoconnectRoutes(wireGroup,'p').report.issues.some(i=>i.type==='group_membership'),'A separately grouped wire is not reassigned to another branch');

const source=fixture(),draft=graph(),report=validateLayout(snapshotPage(draft.pages[0],draft));
const preview:LayoutPreview={pageId:'p',status:'preview_ready',before:validateLayout(snapshotPage(source.pages[0],source)),issues:[],candidates:[{id:'layout-test',base:JSON.stringify({...source,activePageId:undefined,modified:undefined}),pageId:'p',page:draft.pages[0],profile:'structured',report}]};
const compiled=preferDraftAutoconnect(source,draft,preview);assert.equal(compiled.preview.connectionConstruction?.status,'complete');
const history=new ProjectHistory();history.reset(source);const saved=JSON.stringify(source);applyLayout(source,compiled.preview.candidates[0],compiled.draft);history.record(source);
const wires=JSON.stringify(source.pages[0].wires);AutoconnectEngine.updatePageAutoconnections(source.pages[0]);assert.equal(JSON.stringify(source.pages[0].wires),wires);assert.deepEqual(history.undo(),JSON.parse(saved));
const alreadyExisting=graph();assert.equal(preferDraftAutoconnect(alreadyExisting,draft,preview).preview,preview,'Existing authored pages are never rewritten by draft compilation');

// The same compiler works on local nets of checked multi-sheet proposals; the
// virtual source and normal Apply audit retain every added object and segment.
const empty=fixture(),left=graph('l'),right=graph('r'),multiDraft=structuredClone(left);
const second={...structuredClone(right.pages[0]),id:'other',pageNumber:'1-2'};
multiDraft.pages[0].components.push(...structuredClone(second.components));multiDraft.pages[0].wires.push(...structuredClone(second.wires));multiDraft.pages[0].groups!.push(...structuredClone(second.groups!));
const multiPreview:LayoutPreview={...preview,candidates:[{...preview.candidates[0],page:left.pages[0],multiPage:{pages:[left.pages[0],second],links:[]}}]};
const multi=preferDraftAutoconnect(empty,multiDraft,multiPreview);assert.equal(multi.preview.connectionConstruction?.status,'complete');assert.equal(multi.preview.connectionConstruction?.addedSymbols,4);
applyLayout(empty,multi.preview.candidates[0],multi.draft);assert.equal(empty.pages.length,2);assert(empty.pages.every(p=>p.wires.every(w=>w.isAutoconnect)));

// Draft IDs are local aliases, not a requirement to be globally unused.
const ids=fixture();const old=buildDraft(ids,'p',{components:[{id:'A',symbolId:'fuse_1p',functionText:''}],connections:[]});
const newPage=structuredClone(ids.pages[0]);newPage.id='new';newPage.pageNumber='2';old.pages.push(newPage);
const duplicate=buildDraft(old,'new',{components:[{id:'A',symbolId:'fuse_1p',functionText:''},{id:'B',symbolId:'contactor_coil',functionText:''}],connections:[{id:'link',from:{componentId:'A',pinId:'2'},to:{componentId:'B',pinId:'A1'},potential:'L1'}],groups:[{id:'group',members:['A','B']}]});
assert.equal(duplicate.pages[1].components[0].id,'ai-A-2');assert.equal(duplicate.pages[1].wires[0].from.componentId,'ai-A-2');assert.equal(duplicate.pages[1].groups![0].members[0].id,'ai-A-2');assert.equal(JSON.stringify(duplicate.pages[0]),JSON.stringify(old.pages[0]));
assert.throws(()=>buildDraft(ids,'p',{components:[{id:'A',symbolId:'fuse_1p'},{id:'A',symbolId:'fuse_1p'}],connections:[]}),/eindeutig/);
const invalidNumbers=structuredClone(old);invalidNumbers.pages[1].pageNumber='1';
assert.equal(buildDraft(invalidNumbers,'new',{components:[{id:'new',symbolId:'fuse_1p'}],connections:[]}).pages[1].pageNumber,'2','An empty destination from an older session is repaired inside the draft');
const numbering=fixture();numbering.pages[0].higherLevel='=A1';numbering.pages[0].location='+S1';
const manager:any={getProject:()=>numbering,notifyModified:()=>{},render:()=>{}};
const created=await handleCreatePage({pageNumber:'1'},manager);assert.equal(created.page.pageNumber,'2');
const distinct=await handleCreatePage({pageNumber:'1',location:'+Other'},manager);assert.equal(distinct.page.pageNumber,'1','Structure scope remains separate');
// Actual coordinate-free AI workflow, outside the socket-distribution grammar:
// two upward ports need a U-shaped path with two real library corners.
const general=fixture();let captured:any;
const response=await handleCreateDraft({components:[{id:'a',symbolId:'contactor_coil',functionText:''},{id:'b',symbolId:'contactor_coil',functionText:''}],connections:[{id:'link',from:{componentId:'a',pinId:'A1'},to:{componentId:'b',pinId:'A1'},potential:'L1'}]}, {getProject:()=>general,showLayoutPreview:(preview:any,draft:any)=>{captured={preview,draft};}} as any);
assert.equal(response.connectionConstruction?.status,'complete');assert.equal(response.connectionConstruction?.routed,0);assert.equal(response.candidates[0].routedConnections,0);
applyLayout(general,captured.preview.candidates[0],captured.draft);assert.equal(general.pages[0].components.filter(c=>c.symbolId.startsWith('corner_compact')).length,2);
console.log('✓ General checked route-to-library compilation: merged tees/corners, unrelated crossings, rotations/reversal, original net partition/IDs/data, multi-sheet Apply, undo and collision-safe aliases/page numbering');
