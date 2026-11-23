import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fixture } from '../layout/testing/fixture';
import type { PlacedComponent, SymbolDefinition } from './types';
import { structureImportedTerminals } from './ImportedTerminalStructure';
import { cleanupDefaults, ImportCleanupPlan } from './ImportCleanup';
import { sameConductorTopology } from './ElectricalNetService';
import { terminalStripBindings } from './TerminalStripTypes';
import { TerminalDiagramGenerator } from '../reports/TerminalDiagram';
import { ProjectHistory } from './ProjectHistory';
import { setProjectSymbolLibrary } from './symbols';

const p = fixture(), page = p.pages[0];
const symbol: SymbolDefinition = { id:'native:IEC_symbol:30:0', name:'IEC_symbol / X [30:0]', category:'terminals',
  standard:'DIN EN 60617',defaultBmkPrefix:'',defaultFunctionText:'',width:4,height:10,svgContent:'',description:'Synthetic',
  source:{library:'IEC_symbol',number:30,variant:0},pins:[{id:'0',name:'1',x:2,y:0,direction:'top'}, {id:'1',name:'2',x:2,y:10,direction:'bottom'}] };
p.symbolLibrary = [symbol];
function put(id:string,bmk:string,number:string, sid=symbol.id) {
  const c:PlacedComponent={id,symbolId:sid,bmk,deviceTag:number,functionText:'Circuit 24 V',x:30+page.components.length*20,y:60,
    rotation:0,pins:{'0':{},'1':{}},source:{format:'NATIVE_CAD',objectType:17,objectId:page.components.length+1},bmkPosition:{visible:false}};
  page.components.push(c);return c;
}
const two=put('two','-X1','2'),one=put('one','-X1','1');two.x=100;one.x=60;
put('n','-X1','N').x=120;put('pe','-X1','PE').x=140;
put('dup1','-X2','1');put('dup2','-X2','1');put('blank','-X2','');put('descriptive','-X2','Hauptklemme 42');
put('unlabelled','','7');put('device','-U1','1');put('conflict','-X3:8','7');
const devicePin={...symbol,id:'native:SPECIAL:17:0',name:'SPECIAL / DCP [17:0]',source:{library:'SPECIAL',number:17,variant:0}};
const socket={...symbol,id:'native:IEC_symbol:1169:0',name:'IEC_symbol / XU [1169:0]',source:{library:'IEC_symbol',number:1169,variant:0}};
p.symbolLibrary.push(devicePin,socket);
put('devicePin','-X1','7',devicePin.id);put('socket','-X1','7',socket.id);
const scoped=put('scoped','-X1','1');scoped.mountingLocation='+OTHER';
page.wires=[{id:'wire',from:{componentId:'one',pinId:'0'},to:{componentId:'two',pinId:'1'},potential:'Signal',waypoints:[{x:10,y:15}]}];
const original=structuredClone(p), result=structureImportedTerminals(p);
assert.deepEqual(p,original,'Recognition is isolated');
assert.equal(result.preview.recognised,12);assert.equal(result.preview.converted,5);assert.equal(result.preview.createdStrips,2);
assert.equal(result.preview.issues.filter(i=>i.reason==='duplicate_number').length,2);
assert(result.preview.issues.some(i=>i.reason==='conflicting_number'));
assert(result.preview.issues.some(i=>i.reason==='missing_number'&&i.addresses[0].componentId==='descriptive'));
assert.equal(terminalStripBindings(result.project).issues.length,0);
assert.deepEqual(result.project.terminalStrips![0].positions.flatMap(pos=>pos.kind==='terminal'?pos.members.map(a=>a.componentId):[]),['one','two','n','pe']);
const withoutMetadata=structuredClone(result.project);for(const pg of withoutMetadata.pages)for(const c of pg.components)delete c.terminal;
assert.deepEqual(withoutMetadata.pages,original.pages,'No coordinates, full tags, text settings, wire points or pin IDs change');
assert.deepEqual(result.project.symbolLibrary,p.symbolLibrary);assert.equal(result.project.physicalDevices,undefined);
assert(sameConductorTopology(p,result.project));
const again=structureImportedTerminals(result.project);assert.equal(again.preview.converted,0);assert.deepEqual(again.project,result.project);
const existing=structuredClone(result.project);existing.pages[0].components.push({...one,id:'append',bmk:'-X1',deviceTag:'3'});
const extended=structureImportedTerminals(existing);assert.equal(extended.preview.converted,1);assert.equal(extended.preview.extendedStrips,1);
assert.deepEqual(extended.project.terminalStrips![0].positions.slice(0,4),result.project.terminalStrips![0].positions);
const ambiguous=structuredClone(p);ambiguous.pages[0].components.push({...one});
assert(structureImportedTerminals(ambiguous).preview.issues.some(i=>i.reason==='ambiguous_identity'));
const owned=structuredClone(p);owned.physicalDevices=[{id:'owned',verification:'user_confirmed',main:{pageId:page.id,componentId:'one'},members:[{pageId:page.id,componentId:'one'}]}];
assert(structureImportedTerminals(owned).preview.issues.some(i=>i.reason==='existing_ownership'));
const manual=structuredClone(p);manual.pages[0].components[0].terminal={strip:'-X1',number:'9',level:'',pinSides:{'0':'external'}};
const kept=structureImportedTerminals(manual).project.pages[0].components[0];assert.deepEqual(kept.terminal,manual.pages[0].components[0].terminal);
const plan=new ImportCleanupPlan(p,cleanupDefaults,{structureTerminals:true}),next=plan.apply(p);
assert.equal(plan.preview.terminalStructure!.converted,5);
assert(!plan.preview.issues.some(i=>i.kind==='terminal_number'&&plan.preview.issues.some(other=>other.kind==='terminal_structure'&&other.addresses[0].componentId===i.addresses[0].componentId)),'Review tasks are not duplicated as unresolved-number findings');
assert([...TerminalDiagramGenerator.generateTerminalReport(next).values()].flat().some(e=>e.componentId==='one'&&e.terminalNumber==='1'));
assert.deepEqual(new ImportCleanupPlan(p).apply(p).pages,p.pages,'Interpretation-only mode remains available');
const stale=structuredClone(p);stale.pages[0].components[0].x++;assert.throws(()=>plan.apply(stale),/articlesProjectStale/);
plan.preview.terminalStructure!.rows.length=0;assert.equal(plan.apply(p).terminalStrips!.length,2,'Exported preview cannot mutate the plan');
const history=new ProjectHistory();history.reset(p);history.record(next);assert.deepEqual(history.undo()!.pages,p.pages);assert.deepEqual(history.redo()!.terminalStrips,next.terminalStrips);
assert.deepEqual(JSON.parse(JSON.stringify(next)).terminalStrips,next.terminalStrips);

// Optional private regression: never copy uploaded project data into this repository.
const path=process.env.SCHEMATICO_TERMINAL_IMPORT_FIXTURE;
if(path){const sample=JSON.parse(fs.readFileSync(path,'utf8'));setProjectSymbolLibrary(sample);const converted=structureImportedTerminals(sample);
  assert.equal(converted.preview.recognised,361);assert.equal(converted.preview.converted,321);assert.equal(converted.preview.createdStrips,70);
  assert.equal(converted.preview.issues.length,40);assert(sameConductorTopology(sample,converted.project));assert.equal(terminalStripBindings(converted.project).issues.length,0);
  const stripped=structuredClone(converted.project);for(const pg of stripped.pages)for(const c of pg.components)delete c.terminal;
  assert.deepEqual(stripped.pages,sample.pages);assert.deepEqual(converted.project.symbolLibrary,sample.symbolLibrary);
  assert.equal(structureImportedTerminals(converted.project).preview.converted,0);
  console.log('✓ Private terminal import fixture: 361 recognised, 321 structured in 70 strips, 40 explicit review tasks, unchanged drawing and conductor topology');
}
console.log('✓ Terminal recognition: evidenced source designations, roles/scopes, duplicate/missing/conflict guards, existing ownership, visual/net invariants, physical ordering, idempotence, append, preview isolation, stale guard and undo');
