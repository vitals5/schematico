import assert from 'node:assert/strict';
import {fixture,add} from './testing/fixture';
import {snapshotPage} from './geometry';
import {structuredGroup} from './structured';
import {previewLayout,applyLayout} from './service';
import {topology} from './types';
import {ProjectHistory} from '../model/ProjectHistory';
const project=fixture();
for(const [id,symbol,bmk] of [['a-start','pushbutton_no','-S1'],['a-coil','contactor_coil','-K1'],['z-contact','contactor_power_3p','-K1'],['z-motor','motor_3phase','-M1']]){
 const c=add(project,id,symbol);c.bmk=bmk;c.functionText='';
}
project.pages[0].wires=[{id:'control',from:{componentId:'a-start',pinId:'14'},to:{componentId:'a-coil',pinId:'A1'},potential:'',waypoints:[],isAutoconnect:false},
 ...[['2','U1'],['4','V1'],['6','W1']].map(([a,b],i)=>({id:'phase'+i,from:{componentId:'z-contact',pinId:a},to:{componentId:'z-motor',pinId:b},potential:'',waypoints:[],isAutoconnect:false}))];
const source=snapshotPage(project.pages[0],project),padding={left:8,right:8,top:8,bottom:8};
const children=source.nodes.map(n=>({id:n.id,width:n.rect.width,height:n.rect.height,ports:n.pins.map(p=>({id:JSON.stringify([n.id,p.id]),x:p.x-n.rect.x,y:p.y-n.rect.y}))}));
const input=JSON.stringify({source,children});
const calculate=(s=source,c=children)=>structuredGroup('root',c,s,6,padding)!;
const result=calculate();assert(result);
const power=result.children!.filter(c=>c.id.startsWith('z-')),control=result.children!.filter(c=>c.id.startsWith('a-'));
assert(Math.max(...power.map(c=>c.x!+c.width!))<Math.min(...control.map(c=>c.x!)),'Known power circuit precedes control regardless of alphabetical IDs');
const reversed=calculate({...source,edges:[...source.edges].reverse().map(e=>({...e,from:e.to,to:e.from}))},[...children].reverse());
for(const c of result.children!){const other=reversed.children!.find(n=>n.id===c.id)!;assert.equal(c.x,other.x);assert.equal(c.y,other.y);}
const neutral=calculate({...source,nodes:source.nodes.map(n=>({...n,circuitRole:undefined}))});
assert(neutral.children!.find(c=>c.id==='a-start')!.x!<neutral.children!.find(c=>c.id==='z-contact')!.x!,'Unknown definitions retain deterministic neutral ordering');
const mixed=calculate({...source,nodes:source.nodes.map(n=>({...n,circuitRole:(n.id.endsWith('start')||n.id.endsWith('contact')?'power':'control') as 'power'|'control'}))});
assert(mixed.children!.find(c=>c.id==='a-start')!.x!<mixed.children!.find(c=>c.id==='z-contact')!.x!,'Mixed roles must stay neutral');
assert.equal(JSON.stringify({source,children}),input);
const original=JSON.stringify(project),net=topology(project),history=new ProjectHistory();history.reset(project);
const candidate=(await previewLayout(project,'p',{multiPage:false})).candidates.find(c=>c.profile==='structured');assert(candidate);
assert.equal(candidate.report.metrics.crossings,0);assert.equal(candidate.report.metrics.bends,0);
assert.equal(JSON.stringify(project),original);applyLayout(project,candidate);history.record(project);assert.equal(topology(project),net);assert.deepEqual(history.undo(),JSON.parse(original));
console.log('✓ Explicit library roles, power-before-control ordering, neutral unknowns, input-order independence, three-phase topology, routing and undo');
