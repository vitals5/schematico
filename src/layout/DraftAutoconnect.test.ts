import assert from 'node:assert/strict';
import {fixture} from './testing/fixture';
import {buildDraft,handleCreateDraft} from './tools';
import type {CanvasStateManager} from '../ai/mcp-tools/handlers';
import {previewLayout,applyLayout} from './service';
import {snapshotPage} from './geometry';
import {netIds} from './validate';
import {AutoconnectEngine} from '../model/AutoconnectEngine';
import {ProjectHistory} from '../model/ProjectHistory';
const input={preferAutoconnect:true,components:[{id:'feed',symbolId:'fuse_1p',functionText:''},...[0,1,2].map(i=>({id:'load'+i,symbolId:'contactor_coil',functionText:''}))],connections:[0,1,2].map(i=>({id:'branch'+i,from:{componentId:'feed',pinId:'2'},to:{componentId:'load'+i,pinId:'A1'},potential:'L'}))};
const source=fixture(),before=JSON.stringify(source),draft=buildDraft(source,'p',input);
assert.equal(JSON.stringify(source),before);
assert.equal(draft.pages[0].components.length,8);assert.equal(draft.pages[0].wires.length,7);
assert.equal(draft.pages[0].components.filter(c=>c.symbolId.startsWith('t_piece')).length,2);
assert.equal(draft.pages[0].components.filter(c=>c.symbolId.startsWith('corner')).length,2);
const nets=netIds(snapshotPage(draft.pages[0],draft));assert.equal(new Set(nets.values()).size,1,'Original star remains exactly one net through real joined library pins');
const preview=await previewLayout(source,'p',{multiPage:false},draft);

const candidate=preview.candidates.find(c=>c.profile==='structured')??preview.candidates[0];assert(candidate);

assert(candidate.page.wires.every(w=>w.isAutoconnect),'Independent bus inlet and branches must all use verified autoconnect');
const history=new ProjectHistory();history.reset(source);applyLayout(source,candidate,draft);history.record(source);
const saved=JSON.stringify(source.pages[0].wires.map(w=>[w.id,w.from,w.to]));AutoconnectEngine.updatePageAutoconnections(source.pages[0]);assert.equal(JSON.stringify(source.pages[0].wires.map(w=>[w.id,w.from,w.to])),saved,'Normal autoconnect refresh cannot add or drop checked nets');
assert.deepEqual(history.undo(),JSON.parse(before));
const reverse=structuredClone(input);for(const w of reverse.connections)[w.from,w.to]=[w.to,w.from];assert.deepEqual(buildDraft(fixture(),'p',reverse).pages[0].components.map(c=>c.symbolId),draft.pages[0].components.map(c=>c.symbolId));
const mixed=structuredClone(input);mixed.connections[1].potential='N';assert.equal(buildDraft(fixture(),'p',mixed).pages[0].components.length,4);
const old=structuredClone(input);old.preferAutoconnect=false;assert.equal(buildDraft(fixture(),'p',old).pages[0].components.length,4);
const grouped={...input,groups:[{id:'all',members:input.components.map(c=>c.id)}]};const g=buildDraft(fixture(),'p',grouped);assert.equal(g.pages[0].groups![0].members.filter(m=>m.kind==='component').length,8);
const divided={...input,groups:[{id:'one',members:['load0']}]};assert.equal(buildDraft(fixture(),'p',divided).pages[0].components.length,4);
console.log('✓ New draft library bus/corners/Ts, true autoconnect segments, unchanged original terminal net, group boundaries, reversal, explicit opt-out and undo');
for(const direction of ['top','bottom','left','right'] as const){
 const p=fixture(),vertical=direction==='top'||direction==='bottom';
 const opposite={top:'bottom',bottom:'top',left:'right',right:'left'} as const;
 p.symbolLibrary=[{id:'test-pole',name:'Test pole',category:'supply',standard:'',description:'',defaultBmkPrefix:'X',defaultFunctionText:'',width:16,height:16,svgContent:'<rect width="16" height="16"/>',pins:[{id:'source',name:'source',x:vertical?8:direction==='left'?0:16,y:vertical?(direction==='top'?0:16):8,direction},{id:'target',name:'target',x:vertical?8:direction==='left'?16:0,y:vertical?(direction==='top'?16:0):8,direction:opposite[direction]}]}];
 const args={preferAutoconnect:true,components:['feed','a','b'].map(id=>({id,symbolId:'test-pole',functionText:''})),connections:['a','b'].map(id=>({id:'edge-'+id,from:{componentId:'feed',pinId:'source'},to:{componentId:id,pinId:'target'},potential:'P'}))};
 const planned=buildDraft(p,'p',args),s=snapshotPage(planned.pages[0],planned);
 assert.equal(planned.pages[0].components.length,6);assert.equal(new Set(netIds(s).values()).size,1,'Bus remains a single actual joined net in direction '+direction);
}
assert((await previewLayout(fixture(),'p',{multiPage:false},g)).candidates.length,'Generated connections must also layout inside an explicit group');
// The public AI entry point enables preparation without asking the model for an option.
const toolSource=fixture(),toolBefore=JSON.stringify(toolSource);
let presented=false;
const {preferAutoconnect,...toolInput}=input;
const toolResult=await handleCreateDraft(toolInput,{
 getProject:()=>toolSource,
 showLayoutPreview:(preview,draft)=>{
  presented=true;
  assert.equal(draft!.pages[0].components.length,8);
  assert(preview.candidates.some(c=>c.page.wires.every(w=>w.isAutoconnect)));
 },
} as CanvasStateManager);
assert(presented);
assert.equal(toolResult.status,'preview_ready');
assert.equal(JSON.stringify(toolSource),toolBefore,'AI tool only presents a preview');
