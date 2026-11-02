import assert from 'node:assert/strict';
import {fixture} from './testing/fixture';
import {buildDraft,handleCreateDraft,handleOptimizeLayout} from './tools';
import {prepareSocketDistribution} from './socketDistribution';
import {snapshotPage} from './geometry';
import {netIds,validateLayout} from './validate';
import {previewLayout,applyLayout} from './service';
import {ProjectHistory} from '../model/ProjectHistory';
import {AutoconnectEngine} from '../model/AutoconnectEngine';
import type {Project} from '../model/types';
import {socketDraft} from './testing/socketDraft';

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
// A third socket row must spend optional whitespace before abandoning the
// complete Autoconnect construction and splitting the circuit over sheets.
const adaptiveSource=source(),adaptiveArgs=socketDraft(4,3),adaptiveRaw=buildDraft(adaptiveSource,'p',adaptiveArgs);
const adaptive=buildDraft(adaptiveSource,'p',{...adaptiveArgs,preferAutoconnect:true});
assert.equal(adaptive.pages[0].layoutConstraints?.draftPreparation?.status,'applied');assert.equal(adaptive.pages[0].wires.length,98);
assert(adaptive.pages[0].wires.every(w=>w.isAutoconnect));assert(validateLayout(snapshotPage(adaptive.pages[0],adaptive)).valid);
assert.equal(adaptive.pages.length,1);assert.deepEqual(partition(adaptive,new Set(adaptiveRaw.pages[0].components.map(c=>c.id))),partition(adaptiveRaw,new Set(adaptiveRaw.pages[0].components.map(c=>c.id))));
// Long FI labels must reserve space beside the PE/N return corridor too, even
// when the outgoing devices have much shorter labels. No font shrinking/fallback.
for(const functionText of ['Fehlerstromschutzschalter FI','Fehlerstromschutzschalter Verteilung']){
 const args=socketDraft();args.components.find(c=>c.id==='R')!.functionText=functionText;
 for(const c of args.components)if(c.id!=='R')c.functionText=c.id.startsWith('IN')?'Einspeisung':'Steckdose';
 const base=source(),raw=buildDraft(base,'p',args),planned=buildDraft(base,'p',{...args,preferAutoconnect:true});
 assert.equal(planned.pages[0].layoutConstraints?.draftPreparation?.status,'applied',JSON.stringify(planned.pages[0].layoutConstraints?.draftPreparation));
 assert(planned.pages[0].wires.every(w=>w.isAutoconnect));assert(validateLayout(snapshotPage(planned.pages[0],planned)).valid);
 assert.deepEqual(partition(planned,originalIds),partition(raw,originalIds));
 assert.equal(planned.pages[0].components.find(c=>c.id==='ai-R')!.functionText,functionText);
}
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

// General multi-tier circuit (e.g. sub-distribution with main switch, SPD, RCD, 3P MCBs, 1P+N MCBs, RCBOs, and terminals)
const generalArgs={
 components:[
  {id:'x1_l1',symbolId:'terminal_single',bmk:'-X1:L1',functionText:'Einspeisung L1'},
  {id:'x1_l2',symbolId:'terminal_single',bmk:'-X1:L2',functionText:'Einspeisung L2'},
  {id:'x1_l3',symbolId:'terminal_single',bmk:'-X1:L3',functionText:'Einspeisung L3'},
  {id:'x1_n',symbolId:'terminal_single',bmk:'-X1:N',functionText:'Einspeisung N'},
  {id:'x1_pe',symbolId:'terminal_pe',bmk:'-X1:PE',functionText:'Einspeisung PE'},
  {id:'q1',symbolId:'main_switch_4p',bmk:'-Q1',functionText:'Hauptschalter'},
  {id:'f1',symbolId:'catalog_spd_type_2_4p',bmk:'-F1',functionText:'Überspannungsschutz'},
  {id:'q2',symbolId:'rcd_4p',bmk:'-Q2',functionText:'FI-Schutzschalter'},
  {id:'f2',symbolId:'circuit_breaker_3p',bmk:'-F2',functionText:'Abgang 1'},
  {id:'f3',symbolId:'circuit_breaker_3p',bmk:'-F3',functionText:'Abgang 2'},
  {id:'f4',symbolId:'catalog_mcb_1p_n_c',bmk:'-F4',functionText:'Steckdosen 1'},
  {id:'f5',symbolId:'catalog_mcb_1p_n_c',bmk:'-F5',functionText:'Steckdosen 2'},
  {id:'f6',symbolId:'catalog_mcb_1p_n_c',bmk:'-F6',functionText:'Beleuchtung 1'},
  {id:'f7',symbolId:'catalog_mcb_1p_n_c',bmk:'-F7',functionText:'Beleuchtung 2'},
  {id:'q3',symbolId:'rcbo_1p_n',bmk:'-Q3',functionText:'FI/LS Reserve'},
  {id:'x_n1',symbolId:'terminal_single',bmk:'-X_N1',functionText:'N-Schiene'},
  {id:'x_pe',symbolId:'terminal_pe',bmk:'-X_PE',functionText:'PE-Schiene'},
 ],
 connections:[
  {id:'w1',from:{componentId:'x1_l1',pinId:'1'},to:{componentId:'q1',pinId:'1'},potential:'L1'},
  {id:'w2',from:{componentId:'x1_l2',pinId:'1'},to:{componentId:'q1',pinId:'3'},potential:'L2'},
  {id:'w3',from:{componentId:'x1_l3',pinId:'1'},to:{componentId:'q1',pinId:'5'},potential:'L3'},
  {id:'w4',from:{componentId:'x1_n',pinId:'1'},to:{componentId:'q1',pinId:'7'},potential:'N'},
  {id:'w5',from:{componentId:'x1_pe',pinId:'1'},to:{componentId:'x_pe',pinId:'1'},potential:'PE'},
  {id:'w6',from:{componentId:'q1',pinId:'2'},to:{componentId:'f1',pinId:'L1'},potential:'L1'},
  {id:'w7',from:{componentId:'q1',pinId:'4'},to:{componentId:'f1',pinId:'L2'},potential:'L2'},
  {id:'w8',from:{componentId:'q1',pinId:'6'},to:{componentId:'f1',pinId:'L3'},potential:'L3'},
  {id:'w9',from:{componentId:'q1',pinId:'8'},to:{componentId:'f1',pinId:'N'},potential:'N'},
  {id:'w10',from:{componentId:'f1',pinId:'PE'},to:{componentId:'x_pe',pinId:'2'},potential:'PE'},
  {id:'w11',from:{componentId:'q1',pinId:'2'},to:{componentId:'q2',pinId:'1'},potential:'L1'},
  {id:'w12',from:{componentId:'q1',pinId:'4'},to:{componentId:'q2',pinId:'3'},potential:'L2'},
  {id:'w13',from:{componentId:'q1',pinId:'6'},to:{componentId:'q2',pinId:'5'},potential:'L3'},
  {id:'w14',from:{componentId:'q1',pinId:'8'},to:{componentId:'q2',pinId:'N_in'},potential:'N'},
  {id:'w15',from:{componentId:'q1',pinId:'2'},to:{componentId:'q3',pinId:'1'},potential:'L1'},
  {id:'w16',from:{componentId:'q1',pinId:'8'},to:{componentId:'q3',pinId:'N_in'},potential:'N'},
  {id:'w17',from:{componentId:'q2',pinId:'2'},to:{componentId:'f2',pinId:'1'},potential:'L1'},
  {id:'w18',from:{componentId:'q2',pinId:'4'},to:{componentId:'f2',pinId:'3'},potential:'L2'},
  {id:'w19',from:{componentId:'q2',pinId:'6'},to:{componentId:'f2',pinId:'5'},potential:'L3'},
  {id:'w20',from:{componentId:'q2',pinId:'2'},to:{componentId:'f3',pinId:'1'},potential:'L1'},
  {id:'w21',from:{componentId:'q2',pinId:'4'},to:{componentId:'f3',pinId:'3'},potential:'L2'},
  {id:'w22',from:{componentId:'q2',pinId:'6'},to:{componentId:'f3',pinId:'5'},potential:'L3'},
  {id:'w23',from:{componentId:'q2',pinId:'2'},to:{componentId:'f4',pinId:'1'},potential:'L1'},
  {id:'w24',from:{componentId:'q2',pinId:'4'},to:{componentId:'f5',pinId:'1'},potential:'L2'},
  {id:'w25',from:{componentId:'q2',pinId:'6'},to:{componentId:'f6',pinId:'1'},potential:'L3'},
  {id:'w26',from:{componentId:'q2',pinId:'2'},to:{componentId:'f7',pinId:'1'},potential:'L1'},
  {id:'w27',from:{componentId:'q2',pinId:'N_out'},to:{componentId:'x_n1',pinId:'1'},potential:'N'},
  {id:'w28',from:{componentId:'x_n1',pinId:'2'},to:{componentId:'f4',pinId:'N-in'},potential:'N'},
  {id:'w29',from:{componentId:'x_n1',pinId:'2'},to:{componentId:'f5',pinId:'N-in'},potential:'N'},
  {id:'w30',from:{componentId:'x_n1',pinId:'2'},to:{componentId:'f6',pinId:'N-in'},potential:'N'},
  {id:'w31',from:{componentId:'x_n1',pinId:'2'},to:{componentId:'f7',pinId:'N-in'},potential:'N'},
 ],
 groups:[{id:'uv1',name:'+UV1',members:['q1','f1','q2','f2','f3','f4','f5','f6','f7','q3','x_n1','x_pe']}],
};
const generalBase=source(),generalRaw=buildDraft(generalBase,'p',generalArgs),generalOriginals=new Set(generalRaw.pages[0].components.map(c=>c.id));
let generalCaptured:any;
const generalResponse=await handleCreateDraft(generalArgs,{getProject:()=>generalBase,getActivePage:()=>generalBase.pages[0],showLayoutPreview:(preview:any,draft:any)=>{generalCaptured={preview,draft};}} as any);
assert.equal(generalResponse.status,'preview_ready');
assert.equal(generalResponse.layoutPreparation?.status,'applied');
assert.equal(generalResponse.connectionConstruction?.routed,0);
assert(generalCaptured.preview.candidates[0].page.wires.every((w:any)=>w.isAutoconnect));
assert(validateLayout(snapshotPage(generalCaptured.preview.candidates[0].page,generalCaptured.draft)).valid);
assert.deepEqual(partition(generalCaptured.draft,generalOriginals),partition(generalRaw,generalOriginals));
const optResponse=await handleOptimizeLayout({pageId:'p'},{getProject:()=>generalRaw,getActivePage:()=>generalRaw.pages[0],showLayoutPreview:(preview:any,draft:any)=>{generalCaptured={preview,draft};}} as any);
assert.equal(optResponse.status,'preview_ready');
assert.equal(optResponse.connectionConstruction?.routed,0);

// Pin alias tolerance: N_out/N-out and N_in/N-in variations resolve cleanly without failing draft creation
const aliasToleranceArgs={
 components:[
  {id:'mcb',symbolId:'catalog_mcb_1p_n_b'},
  {id:'term',symbolId:'terminal_single'}
 ],
 connections:[
  {id:'wa',from:{componentId:'mcb',pinId:'N_out'},to:{componentId:'term',pinId:'1'},potential:'N'},
  {id:'wb',from:{componentId:'mcb',pinId:'n_in'},to:{componentId:'term',pinId:'2'},potential:'N'}
 ]
};
const aliasDraft=buildDraft(source(),'p',aliasToleranceArgs);
assert.equal(aliasDraft.pages[0].wires[0].from.pinId,'N-out');
assert.equal(aliasDraft.pages[0].wires[1].from.pinId,'N-in');

// General circuit N-PE short circuit rejection (e.g. connecting terminal_pe to RCD N-out)
const nPeMixArgs={
 components:[
  {id:'X4_1',symbolId:'terminal_single',bmk:'-X4:1'},
  {id:'X4_4',symbolId:'terminal_single',bmk:'-X4:4'},
  {id:'X4_5',symbolId:'terminal_pe',bmk:'-X4:5'},
  {id:'F15',symbolId:'catalog_rcd_4p_a_30',bmk:'-F15'},
  {id:'F16',symbolId:'catalog_mcb_1p_b',bmk:'-F16'},
 ],
 connections:[
  {id:'c1',from:{componentId:'X4_1',pinId:'2'},to:{componentId:'F15',pinId:'1'},potential:'L1'},
  {id:'c4',from:{componentId:'X4_4',pinId:'2'},to:{componentId:'F15',pinId:'N-in'},potential:'N'},
  {id:'c5',from:{componentId:'X4_5',pinId:'2'},to:{componentId:'F15',pinId:'N-out'},potential:'PE'},
  {id:'c6',from:{componentId:'F15',pinId:'2'},to:{componentId:'F16',pinId:'1'},potential:'L1'},
 ],
};
const nPeMixDraft=buildDraft(source(),'p',{...nPeMixArgs,preferAutoconnect:true});
assert.equal(nPeMixDraft.pages[0].layoutConstraints?.draftPreparation?.status,'rejected');
assert.equal(nPeMixDraft.pages[0].layoutConstraints?.draftPreparation?.code,'neutral_protective_nets');
console.log('✓ Complete socket distribution & general multi-tier circuits: one sheet, 100% true autoconnect segments, separated original nets, unchanged labels, groups/IDs, reversed endpoints, other branch counts, rejection isolation, refresh and undo');
