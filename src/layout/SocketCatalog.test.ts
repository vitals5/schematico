import assert from 'node:assert/strict';
import {fixture} from './testing/fixture';
import {socketDraft} from './testing/socketDraft';
import {buildDraft,handleCreateDraft} from './tools';
import {applyLayout} from './service';
import {snapshotPage} from './geometry';
import {netIds,validateLayout} from './validate';
import {getSymbolById,getSymbolDefinitions} from '../model/symbols';
import {rcdPorts,breakerPorts,socketPorts} from './distributionRoles';
import type {CanvasStateManager} from '../ai/mcp-tools/handlers';
import type {LayoutPreview} from './types';
import type {Project} from '../model/types';
function source(){const p=fixture();p.pages[0].plotFrame.width=1000;p.pages[0].plotFrame.height=700;return p;}
function input(){
 const args=socketDraft(),rcd=args.components.find(c=>c.id==='R')!;
 rcd.symbolId='catalog_rcd_4p_a_30';rcd.technicalCharacteristics='4P, 40 A / 30 mA / Typ A';
 for(const c of args.components){
  if(c.id.startsWith('IN'))c.technicalCharacteristics='Zuleitung 5x2,5 mm²';
  if(/^F\d/.test(c.id)){const i=Number(c.id.slice(1));c.functionText=`Stromkreis ${i+1} (L${Math.floor(i/2)+1}) – Schuko`;c.technicalCharacteristics='B 16 A, 230 V';}
  if(c.id.startsWith('X')){c.functionText='Steckdose '+(Number(c.id.slice(1).split('_')[0])*2+Number(c.id.split('_')[1])+1);c.technicalCharacteristics='16 A / 230 V / Schuko';}
 }
 for(const w of args.connections){
  for(const ep of [w.from,w.to])if(ep.componentId==='R')ep.pinId=ep.pinId.replace('N_in','N-in').replace('N_out','N-out');
  if(w.from.componentId.startsWith('IN'))w.from.pinId='2';
  if(w.to.componentId.startsWith('X')&&w.to.pinId==='N')w.from={componentId:'R',pinId:'N-out'};
  if(w.to.componentId.startsWith('X')&&w.to.pinId==='PE')w.from={componentId:'IN4',pinId:'2'};
  if(w.from.componentId==='R'&&w.to.componentId.startsWith('F')){const phase=Math.floor(Number(w.to.componentId.slice(1))/2);w.from.pinId=['2','4','6'][phase];w.potential='L'+(phase+1);}
  if(w.from.componentId.startsWith('F'))w.potential='L'+(Math.floor(Number(w.from.componentId.slice(1))/2)+1);
 }
 args.groups.push({id:'supply',members:args.components.filter(c=>c.id.startsWith('IN')).map(c=>c.id)},{id:'residual',members:['R']});
 return args;
}
const library=getSymbolDefinitions(source());
const rcds=library.filter(s=>s.family==='rcd'&&s.pins.length===8);assert.equal(rcds.length,16);
for(const s of rcds){
 const ports=rcdPorts(s)!;assert(ports);assert.equal(ports.neutralIn,'N-in');assert.equal(ports.neutralOut,'N-out');assert.equal(ports.outputs.length,3);
 const args=input(),r=args.components.find(c=>c.id==='R')!;r.symbolId=s.id;r.technicalCharacteristics=s.technicalCharacteristics;
 const planned=buildDraft(source(),'p',{...args,preferAutoconnect:true});assert.equal(planned.pages[0].layoutConstraints?.draftPreparation?.status,'applied',s.id);
 assert.equal(planned.pages[0].components.find(c=>c.id==='ai-R')!.symbolId,s.id);assert(planned.pages[0].wires.every(w=>w.isAutoconnect));
}
for(const s of library.filter(s=>s.family==='mcb'&&s.pins.length===2))assert(breakerPorts(s));
for(const s of library.filter(s=>s.family==='rcd'&&s.pins.length===4))assert.equal(rcdPorts(s),undefined,'Two-pole RCD cannot masquerade as four-pole protection');
assert(socketPorts(getSymbolById('catalog_socket_schuko',source())));
assert.equal(breakerPorts(getSymbolById('catalog_rcbo_1te_b',source())),undefined);
function partition(p:Project,originals:Set<string>){
 const s=snapshotPage(p.pages[0],p),ids=netIds(s),contacts=new Map<string,string>();
 for(const e of s.edges)for(const ep of [e.from,e.to])if(originals.has(ep.componentId))contacts.set(JSON.stringify(ep),ids.get(e.id)!);
 return [...new Set(contacts.values())].map(id=>[...contacts].filter(([,n])=>n===id).map(([ep])=>ep).sort()).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
// The same public entry point and omitted preference as a real model tool call.
const project=source(),before=JSON.stringify(project),args=input(),raw=buildDraft(project,'p',args);
let captured: {preview:LayoutPreview,draft:Project}|undefined;
const manager={getProject:()=>project,getActivePage:()=>project.pages[0],showLayoutPreview:(preview:LayoutPreview,draft:Project)=>{captured={preview,draft};},notifyModified:()=>assert.fail('AI preview cannot mutate the page'),render:()=>{}} as CanvasStateManager;
const response=await handleCreateDraft(args,manager);
assert.equal(response.status,'preview_ready');assert.equal(response.layoutPreparation?.status,'applied');assert(captured);
assert.equal(captured.preview.preparation?.code,'applied');assert.equal(captured.preview.candidates.length,1);assert(!captured.preview.candidates[0].multiPage);
const candidate=captured.preview.candidates[0];assert.equal(candidate.page.wires.length,88);assert(candidate.page.wires.every(w=>w.isAutoconnect));
assert.equal(candidate.page.components.find(c=>c.id==='ai-R')!.symbolId,'catalog_rcd_4p_a_30','Selected FI master data is never replaced');
assert.equal(JSON.stringify(project),before);
const originals=new Set(raw.pages[0].components.map(c=>c.id));assert.deepEqual(partition(captured.draft,originals),partition(raw,originals));
assert(validateLayout(snapshotPage(candidate.page,captured.draft)).valid);
applyLayout(project,candidate,captured.draft);assert.equal(project.pages[0].layoutConstraints?.draftPreparation?.status,'applied');
// Display names and IDs are irrelevant when master-data families and ports agree.
const aliased=source(),aliasArgs=input(),definition=structuredClone(getSymbolById('catalog_rcd_4p_bplus_300',aliased)!);
definition.id='custom-residual-123';definition.name='Herstellervariante';aliased.symbolLibrary=[definition];aliasArgs.components.find(c=>c.id==='R')!.symbolId=definition.id;
const alias=buildDraft(aliased,'p',{...aliasArgs,preferAutoconnect:true});assert.equal(alias.pages[0].layoutConstraints?.draftPreparation?.status,'applied');assert.equal(alias.pages[0].components.find(c=>c.id==='ai-R')!.symbolId,definition.id);
// Other supported socket families use their actual L/N/PE pins and contact order.
const catalogArgs=input();
for(const c of catalogArgs.components)if(c.symbolId==='socket_schuko')c.symbolId='catalog_socket_schuko';
for(const w of catalogArgs.connections)for(const ep of [w.from,w.to])if(ep.componentId.startsWith('X')&&ep.pinId==='1')ep.pinId='L';
const roomy=source();roomy.pages[0].plotFrame.width=1400;roomy.pages[0].plotFrame.height=1000;
const catalog=buildDraft(roomy,'p',{...catalogArgs,preferAutoconnect:true});assert.equal(catalog.pages[0].layoutConstraints?.draftPreparation?.status,'applied',JSON.stringify(catalog.pages[0].layoutConstraints?.draftPreparation));assert(catalog.pages[0].wires.every(w=>w.isAutoconnect));
const feedArgs=input(),feed=library.find(s=>s.family==='feed_terminal'&&s.pins.length===2)!,peFeed=library.find(s=>s.family==='pe_terminal'&&s.pins.length===2)!;
for(const c of feedArgs.components)if(c.id.startsWith('IN'))c.symbolId=c.id==='IN4'?peFeed.id:feed.id;
for(const w of feedArgs.connections)for(const ep of [w.from,w.to])if(ep.componentId.startsWith('IN'))ep.pinId='1.2';
const terminals=buildDraft(roomy,'p',{...feedArgs,preferAutoconnect:true});assert.equal(terminals.pages[0].layoutConstraints?.draftPreparation?.status,'applied',JSON.stringify(terminals.pages[0].layoutConstraints?.draftPreparation));assert(terminals.pages[0].wires.every(w=>w.isAutoconnect));
// A fallback must retain a concrete reason in the tool response, JSON and preview.
const bad=input();bad.connections.find(w=>w.from.pinId==='N-out')!.from.pinId='N-in';
const rejected=buildDraft(source(),'p',{...bad,preferAutoconnect:true});assert.equal(rejected.pages[0].layoutConstraints?.draftPreparation?.status,'rejected');assert.equal(rejected.pages[0].layoutConstraints?.draftPreparation?.code,'neutral_protective_nets');
const badProject=source(),badBefore=JSON.stringify(badProject);
const rejectedResponse=await handleCreateDraft(bad,{...manager,getProject:()=>badProject,getActivePage:()=>badProject.pages[0],showLayoutPreview:(preview)=>assert.equal(preview.preparation?.code,'neutral_protective_nets')});
assert.equal(rejectedResponse.layoutPreparation?.code,'neutral_protective_nets');assert.equal(JSON.stringify(badProject),badBefore);
const tiny=source();tiny.pages[0].plotFrame.width=300;
const unfitted=buildDraft(tiny,'p',{...input(),preferAutoconnect:true});assert.equal(unfitted.pages[0].layoutConstraints?.draftPreparation?.code,'geometry_rejected');assert(unfitted.pages[0].layoutConstraints?.draftPreparation?.issues?.length);
console.log('✓ Actual AI tool flow: catalog FI and real port names, long equipment data, shared buses, preserved nets on one page, 16 four-pole FI variants, renamed master data, catalog sockets and explicit rejection diagnostics');
