import assert from 'node:assert/strict';
import {fixture} from './testing/fixture';
import {buildDraft} from './tools';
import {prepareSocketDistribution} from './socketDistribution';
import {snapshotPage} from './geometry';
import {netIds,validateLayout} from './validate';
import {previewLayout,applyLayout} from './service';
import {ProjectHistory} from '../model/ProjectHistory';
import {AutoconnectEngine} from '../model/AutoconnectEngine';
import type {Project} from '../model/types';
export function socketDraft(count=5,perCircuit=2){
 const components:any[]=[{id:'R',symbolId:'rcd_4p',bmk:'-F1',functionText:'FI-Schutzschalter 30 mA',technicalCharacteristics:'40 A / 30 mA Typ A'}];
 const connections:any[]=[],groups:any[]=[];
 const connect=(a:string,p:string,b:string,q:string,potential:string)=>connections.push({id:'w'+connections.length,from:{componentId:a,pinId:p},to:{componentId:b,pinId:q},potential});
 ['L1','L2','L3','N','PE'].forEach((p,i)=>{components.push({id:'IN'+i,symbolId:p==='PE'?'terminal_pe':'terminal_single',bmk:'-X1:'+i,functionText:'Einspeisung '+p});if(i<4)connect('IN'+i,'1','R',['1','3','5','N_in'][i],p);});
 for(let i=0;i<count;i++){
  const breaker='F'+i,phase=i%3;
  components.push({id:breaker,symbolId:'catalog_mcb_1p_b',bmk:'-F'+(i+2),functionText:`Steckdosenkreis ${i+1} (L${phase+1})`,technicalCharacteristics:'B16 A'});
  connect('R',['2','4','6'][phase],breaker,'1','L'+(phase+1));
  const members=[breaker];
  for(let j=0;j<perCircuit;j++){
   const id='X'+i+'_'+j;members.push(id);
   components.push({id,symbolId:'socket_schuko',bmk:'-X'+(i*perCircuit+j+2),functionText:`Steckdose ${i+1}.${j+1} (Kreis ${i+1})`});
   connect(breaker,'2',id,'1','L'+(phase+1));
   connect(j?members[members.length-2]:'R',j?'N':'N_out',id,'N','N');
   connect(j?members[members.length-2]:'IN4',j?'PE':'1',id,'PE','PE');
  }
  groups.push({id:'group'+i,members});
 }
 return {components,connections,groups};
}
function source(){const p=fixture();p.pages[0].plotFrame.width=1000;p.pages[0].plotFrame.height=700;return p;}
function partition(p:Project,originalIds:Set<string>){
 const s=snapshotPage(p.pages[0],p),nets=netIds(s),contacts=new Map<string,string>();
 for(const e of s.edges)for(const ep of [e.from,e.to])if(originalIds.has(ep.componentId))contacts.set(JSON.stringify(ep),nets.get(e.id)!);
 return [...new Set(contacts.values())].map(n=>[...contacts].filter(([,id])=>id===n).map(([ep])=>ep).sort()).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
const input=socketDraft(),p=source(),before=JSON.stringify(p),raw=buildDraft(p,'p',input),originalIds=new Set(raw.pages[0].components.map(c=>c.id));
const draft=buildDraft(p,'p',{...input,preferAutoconnect:true}),page=draft.pages[0];
assert.equal(JSON.stringify(p),before);assert.equal(page.components.filter(c=>c.symbolId==='socket_schuko').length,10);
assert(page.components.some(c=>c.symbolId.startsWith('corner_compact_')));
assert.equal(page.wires.length,88);assert(page.wires.every(w=>w.isAutoconnect && !w.waypoints?.length));
assert(validateLayout(snapshotPage(page,draft)).valid);assert.deepEqual(partition(draft,originalIds),partition(raw,originalIds));
assert(raw.pages[0].wires.every(w=>page.wires.some(n=>n.id===w.id)),'Every original wire ID survives');
for(const c of raw.pages[0].components){const planned=page.components.find(n=>n.id===c.id)!;for(const property of ['bmk','functionText','technicalCharacteristics','manufacturer','articleNumber'] as const)assert.equal(planned[property],c[property]);}
const preview=await previewLayout(p,'p',{multiPage:false},draft);assert.equal(preview.candidates.length,1);assert(!preview.candidates[0].multiPage);assert(preview.candidates[0].page.wires.every(w=>w.isAutoconnect));
const history=new ProjectHistory();history.reset(p);applyLayout(p,preview.candidates[0],draft);history.record(p);
const wires=JSON.stringify(p.pages[0].wires);AutoconnectEngine.updatePageAutoconnections(p.pages[0]);assert.equal(JSON.stringify(p.pages[0].wires),wires);assert.deepEqual(history.undo(),JSON.parse(before));
const reverse=structuredClone(input);reverse.components.reverse();reverse.groups.reverse();reverse.connections.reverse();for(const w of reverse.connections)[w.from,w.to]=[w.to,w.from];
const reversed=buildDraft(source(),'p',{...reverse,preferAutoconnect:true});assert(reversed.pages[0].wires.every(w=>w.isAutoconnect));assert.deepEqual(partition(reversed,originalIds),partition(raw,originalIds));
for(const [count,loads]of [[2,1],[3,2],[4,2]] as const){const args=socketDraft(count,loads),built=buildDraft(source(),'p',{...args,preferAutoconnect:true});assert(built.pages[0].wires.every(w=>w.isAutoconnect),`Grammar must work for ${count} branches / ${loads} sockets`);assert(validateLayout(snapshotPage(built.pages[0],built)).valid);}
const permuted=socketDraft();
for(const w of permuted.connections)if(w.from.componentId==='R'&&['2','4','6'].includes(w.from.pinId))w.from.pinId=({'2':'6','4':'2','6':'4'} as Record<string,string>)[w.from.pinId];
const permutedSource=source(),permutedRaw=buildDraft(permutedSource,'p',permuted),permutedPlan=buildDraft(permutedSource,'p',{...permuted,preferAutoconnect:true});
assert(permutedPlan.pages[0].wires.every(w=>w.isAutoconnect));assert.deepEqual(partition(permutedPlan,originalIds),partition(permutedRaw,originalIds),'Phase permutation is preserved, including a bus fed between two targets');
const shifted=source();shifted.pages[0].grid={spacing:8,origin:{x:3,y:5}};
const offset=buildDraft(shifted,'p',{...input,preferAutoconnect:true});
for(const n of snapshotPage(offset.pages[0],offset).nodes)for(const pin of n.pins){assert(Math.abs((pin.x-1.5)/2-Math.round((pin.x-1.5)/2))<1e-6);assert(Math.abs((pin.y-2.5)/2-Math.round((pin.y-2.5)/2))<1e-6);}
const large=source();large.pages[0].plotFrame.width=1400;large.pages[0].plotFrame.height=1000;
const triple=buildDraft(large,'p',{...socketDraft(3,3),preferAutoconnect:true});assert(triple.pages[0].wires.every(w=>w.isAutoconnect));assert(validateLayout(snapshotPage(triple.pages[0],triple)).valid);
// Fail closed and atomically: pre-FI neutrals, extra bridges, mixed wire metadata, existing devices and small sheets.
for(const kind of ['neutral','bridge','metadata','existing','capacity'] as const){
 const test=buildDraft(source(),'p',input),page=test.pages[0];
 if(kind==='neutral'){const w=page.wires.find(w=>w.from.pinId==='N_out')!;w.from.pinId='N_in';}
 if(kind==='bridge')page.wires.push({id:'bad',from:{componentId:'ai-R',pinId:'N_out'},to:{componentId:'ai-IN4',pinId:'1'},potential:'PE',isAutoconnect:false});
 if(kind==='metadata')page.wires.filter(w=>w.potential==='PE')[1].crossSection='2.5mm²';
 if(kind==='capacity')page.plotFrame.width=300;
 const saved=JSON.stringify(test),devices=new Set(page.components.map(c=>c.id)),wires=new Set(page.wires.map(w=>w.id));
 if(kind==='existing')devices.delete('ai-R');
 assert.equal(prepareSocketDistribution(test,page,devices,wires),false,kind);assert.equal(JSON.stringify(test),saved,'Rejected preparation cannot mutate project: '+kind);
}
console.log('✓ Complete socket distribution: one sheet, 88 true autoconnect segments, separated original nets, unchanged labels, groups/IDs, reversed endpoints, other branch counts, rejection isolation, refresh and undo');
