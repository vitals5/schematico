import assert from 'node:assert/strict';
import { fixture } from '../layout/testing/fixture';
import type { PlacedComponent, SymbolDefinition, Wire } from './types';
import { ImportCleanupPlan, cleanupDefaults } from './ImportCleanup';
import { componentRole } from './ComponentSemantics';
import { deviceNavigator } from './DeviceNavigator';
import { ProjectIndex } from './ProjectIndex';
import { ElectricalNetService } from './ElectricalNetService';
import { articleDataContext } from './ArticleDataAnalysis';
import { PartsListGenerator } from '../reports/PartsList';
import { TerminalDiagramGenerator } from '../reports/TerminalDiagram';
import { connectionList, withConnectionLength } from '../reports/ConnectionList';
import { ProjectHistory } from './ProjectHistory';
import { isTerminalComponent } from './ComponentSemantics';

const p=fixture(),page=p.pages[0];
function symbol(id:string,name:string,category:SymbolDefinition['category'],number:number,pins=1,library='SPECIAL') {
  const s:SymbolDefinition={id,name,category,source:{library,number,variant:0},standard:'DIN EN 60617',
    defaultBmkPrefix:'',defaultFunctionText:'',width:10,height:10,
    pins:Array.from({length:pins},(_,i)=>({id:String(i),name:String(i+1),x:i*5,y:0,direction:'top' as const})),
    svgContent:'<rect width="10" height="10"/>',description:'Synthetic symbol',importedGraphics:[]};
  (p.symbolLibrary??=[]).push(s);return s;
}
const graphic=symbol('native:graphic:test','Projektgrafik','controls',0,0);
const dcp=symbol('native:SPECIAL:17:0','SPECIAL / DCP [17:0]','terminals',17);
const socket=symbol('native:IEC_symbol:1169:0','IEC_symbol / XU [1169:0]','terminals',1169,1,'IEC_symbol');
const terminal=symbol('native:IEC_symbol:30:0','IEC_symbol / X [30:0]','terminals',30,1,'IEC_symbol');
const device=symbol('native:IEC_symbol:1:0','IEC_symbol / S [1:0]','controls',1,1,'IEC_symbol');
const box=symbol('native:SPECIAL:0:0','Gerätekasten','structure',0,0);box.deviceBox=true;
function put(id:string,s:SymbolDefinition,bmk=''):PlacedComponent {
  const c:PlacedComponent={id,symbolId:s.id,bmk,functionText:'',x:30+page.components.length*20,y:40,rotation:0,
    pins:Object.fromEntries(s.pins.map(p=>[p.id,{wireIds:[]}])),source:{format:'NATIVE_CAD',objectType:s===graphic?31:17,objectId:page.components.length+1}};
  page.components.push(c);return c;
}
const g=put('g',graphic),port=put('port',dcp,'-Q1'),outlet=put('outlet',socket,'-X2'),term=put('term',terminal,'-X1');
term.functionText='Steuerkreis 24 V';term.deviceTag='Hauptklemme 42';
put('numbered',terminal,'-X3:7');const owner=put('owner',box,'-Q1');
const assigned=put('real',device,'-S1');assigned.articleNumber='REAL-1';assigned.manufacturer='Synthetic';
page.groups=[{id:'assembly',name:'Graphic assembly',members:[{kind:'component',id:assigned.id}]} as any];
p.cabinetLayouts=[{schemaVersion:1,id:'cab',name:'Keep',widthMm:300,heightMm:950,marginMm:10,gridMm:1,
  sections:[{id:'zone',label:'Keep zone',x:10,y:10,widthMm:280,heightMm:900}],items:[]}];
const wire=(id:string,from:string,to:string,potential='Signal'):Wire=>({id,from:{componentId:from,pinId:'0'},to:{componentId:to,pinId:'0'},potential});
page.wires.push(wire('native_run_pair',port.id,outlet.id));
p.logicalConnections=[wire('native_logical_pair',outlet.id,port.id)];
const before=structuredClone(p);
const topology=(project:typeof p)=>new ElectricalNetService(new ProjectIndex(project)).nets.map(n=>
  n.ports.map(q=>JSON.stringify([q.owner.page.id,q.owner.component.id,q.id])).sort()).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
const plan=new ImportCleanupPlan(p),next=plan.apply(p);
assert.deepEqual(p,before,'Preview and apply do not mutate the source');
assert.equal(plan.preview.roles.graphic,1);
assert.equal(plan.preview.before.terminals,4);
assert.equal(plan.preview.after.terminals,2);
assert.equal(plan.preview.before.connections,2);
assert.equal(plan.preview.after.connections,1);
assert(plan.preview.after.navigator<plan.preview.before.navigator);
assert.deepEqual(next.pages,p.pages,'Every visual/electrical page object remains byte-for-byte equivalent');
assert.deepEqual(next.symbolLibrary,p.symbolLibrary);
assert.deepEqual(next.logicalConnections,p.logicalConnections);
assert.deepEqual(next.cabinetLayouts,p.cabinetLayouts);
assert.deepEqual(topology(next),topology(p),'Every pin stays in the same electrical net');
assert(deviceNavigator(next).some(r=>r.main?.componentId===owner.id),'Named device box remains assignable');
assert(!deviceNavigator(next).some(r=>r.main?.componentId===g.id));
assert(!deviceNavigator(next).some(r=>r.main?.componentId===port.id));
assert(deviceNavigator(next).some(r=>r.main?.componentId===outlet.id));
assert.equal(componentRole(port,dcp),'device_connection');
const index=new ProjectIndex(next);
assert.equal(articleDataContext(index.entry(g)??index.component('g')!,index).state,'not_applicable');
assert.equal(articleDataContext(index.component('port')!,index).role,'device_connection');
const entries=[...TerminalDiagramGenerator.generateTerminalReport(next).values()].flat();
assert.equal(entries.find(e=>e.componentId===term.id)?.terminalNumber,'?','Numbers in descriptive text are not terminal numbers');
assert.equal(entries.find(e=>e.componentId===term.id)?.numberSource,'unresolved');
assert.equal(entries.find(e=>e.componentId==='numbered')?.terminalNumber,'7');
const bom=PartsListGenerator.generatePartsList(next);
assert.equal(bom.length,1,'Unassigned graphical group does not hide an assigned member');
assert.equal(bom[0].articleNumber,'REAL-1');
assert(!bom.some(b=>b.articleNumber.startsWith('STD-')));
const row=connectionList(next)[0];assert.equal(row.representations?.length,2);
const partial=structuredClone(next);partial.logicalConnections![0].color='blue';
assert.equal(connectionList(partial)[0].color,'blue','A value present only on the logical representation remains available');
assert.equal(connectionList(partial)[0].representations?.length,2);
const measured=withConnectionLength(next,row,1250);
assert.equal(measured.pages[0].wires[0].lengthMm,1250);
assert.equal(measured.logicalConnections![0].lengthMm,1250);
assert.equal(connectionList(measured).length,1,'A deliberate length edit preserves representation mapping');
assert.equal(connectionList(withConnectionLength(measured,connectionList(measured)[0],undefined))[0].lengthMm,undefined);

const conflict=structuredClone(next);conflict.logicalConnections![0].potential='L1';
const conflicts=connectionList(conflict);
assert.equal(conflicts.length,2,'Contradictory source evidence is never hidden');
assert(conflicts.every(r=>r.issues.some(i=>i.includes('potential'))));
assert(new ImportCleanupPlan(conflict).preview.issues.some(i=>i.kind==='connection_conflict'));
const parallel=structuredClone(next);parallel.pages[0].wires.push({...parallel.pages[0].wires[0],id:'native_run_parallel'});
assert.equal(connectionList(parallel).length,3,'Parallel drawings do not prove duplicate representation');
const manual=structuredClone(next);manual.pages[0].wires[0].id='manual-user-wire';
assert.equal(connectionList(manual).length,2,'New user wires are not reinterpreted as native representation pairs');
const cableConflict=structuredClone(next);
cableConflict.pages[0].cables=['A','B'].map((bmk,i)=>({id:bmk,bmk,start:{x:0,y:0},end:{x:10,y:0},cableType:'',coreCount:1,crossSection:'',description:'',
  cores:[{id:'core'+i,designation:'1',wireIds:[i?'native_logical_pair':'native_run_pair']}]} as any));
assert.equal(connectionList(cableConflict).length,2,'Different cable ownership cannot be collapsed');
assert(new ImportCleanupPlan(cableConflict).preview.issues.some(i=>i.kind==='connection_conflict'&&i.details.includes('cable')),'Cable ownership conflict is actionable in the preview');
const ambiguous=structuredClone(next);ambiguous.pages[0].components.push({...ambiguous.pages[0].components[0],id:port.id});
assert.equal(connectionList(ambiguous).length,2,'Ambiguous endpoint identities cannot be consolidated');
const marked=structuredClone(next);marked.pages[0].components.find(c=>c.id===g.id)!.articleNumber='GRAPHIC-ASSIGNMENT';
assert(deviceNavigator(marked).some(r=>r.main?.componentId===g.id),'Explicit assignment on an unusual symbol stays accessible');
const explicitTerminal=structuredClone(next);explicitTerminal.pages[0].components.find(c=>c.id===port.id)!.terminal={strip:'-X9',number:'8',level:'',pinSides:{}};
assert([...TerminalDiagramGenerator.generateTerminalReport(explicitTerminal).values()].flat().some(t=>t.componentId===port.id&&t.terminalNumber==='8'),'Explicit terminal configuration overrides inferred role');
const configured=structuredClone(next);
configured.terminalStrips=[{id:'declared',plant:'',location:'',strip:'-Q1',positions:[{id:'position',kind:'terminal',members:[{pageId:'p',componentId:port.id}]}]}];
assert(isTerminalComponent(configured,configured.pages[0].components.find(c=>c.id===port.id)!,dcp),'Existing explicit strip membership is preserved');
const changedOptions={...cleanupDefaults};const guardedPlan=new ImportCleanupPlan(p,changedOptions);
changedOptions.nativeRoles=false;guardedPlan.preview.profile.nativeRoles=false;
assert(guardedPlan.apply(p).dataInterpretation!.nativeRoles,'Caller mutation of options or exported preview cannot change the plan');
const stale=structuredClone(p);stale.pages[0].components[0].x++;
assert.throws(()=>plan.apply(stale),/articlesProjectStale/);
const navigated=structuredClone(p);navigated.activePageId='different';navigated.modified='changed';
assert.equal(plan.apply(navigated).activePageId,'different','Navigation does not stale the plan');
assert.throws(()=>new ImportCleanupPlan(p,{...cleanupDefaults,version:2} as any),/cleanupInvalid/);
const off=new ImportCleanupPlan(next,{version:1,nativeRoles:false,assignedArticlesOnly:false,consolidateConnections:false}).apply(next);
assert.equal(deviceNavigator(off).length,deviceNavigator(p).length);
assert.equal(connectionList(off).length,2,'Each interpretation rule is reversible');
const history=new ProjectHistory();history.reset(p);history.record(next);
assert.deepEqual(history.undo()!.pages,p.pages);
assert.deepEqual(history.redo()!.dataInterpretation,cleanupDefaults);
assert.deepEqual(JSON.parse(JSON.stringify(next)).dataInterpretation,cleanupDefaults);
console.log('✓ Import cleanup: shared roles, assigned-only BOM, honest terminal numbers, native representation mapping/conflicts, stale preview, source/cabinet/net invariants, persistence and undo/redo');
