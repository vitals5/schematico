import assert from 'node:assert/strict';
import {fixture,add} from './testing/fixture';
import {snapshotPage} from './geometry';
import {structuredGroup} from './structured';
import {previewLayout,applyLayout} from './service';
import {topology} from './types';
import {ProjectHistory} from '../model/ProjectHistory';
const project=fixture();
for(const [id,symbol,bmk] of [['power','contactor_power_3p','-K1'],['motor','motor_3phase','-M1'],['button','pushbutton_no','-S1'],['coil','contactor_coil','-K1'],['reserve1','contactor_coil','-K2'],['reserve2','contact_no','-K3']]){
 const c=add(project,id,symbol);c.bmk=bmk;c.functionText=id.startsWith('reserve')?'Reserve':'';
}
project.pages[0].wires=[{id:'control',from:{componentId:'button',pinId:'14'},to:{componentId:'coil',pinId:'A1'},potential:'',waypoints:[],isAutoconnect:false},
 ...[['2','U1'],['4','V1'],['6','W1']].map(([a,b],i)=>({id:'phase'+i,from:{componentId:'power',pinId:a},to:{componentId:'motor',pinId:b},potential:'',waypoints:[],isAutoconnect:false}))];
const before=JSON.stringify(project),net=topology(project),history=new ProjectHistory();history.reset(project);
const preview=await previewLayout(project,'p',{multiPage:false});const candidate=preview.candidates.find(c=>c.profile==='structured');assert(candidate);
const geometry=snapshotPage(candidate.page,project);
const bounds=(ids:string[])=>{const r=geometry.nodes.filter(n=>ids.includes(n.id)).map(n=>n.rect);return {x:Math.min(...r.map(r=>r.x)),y:Math.min(...r.map(r=>r.y)),right:Math.max(...r.map(r=>r.x+r.width)),bottom:Math.max(...r.map(r=>r.y+r.height))};};
const power=bounds(['power','motor']),control=bounds(['button','coil']),spare=bounds(['reserve1','reserve2']);
assert(power.right<control.x,'Reserve objects must not disable related circuit placement');
assert(spare.x>=control.right||spare.y>=Math.max(power.bottom,control.bottom),'Unwired devices follow the active circuitry in their own area');
assert.equal(candidate.page.components.length,6);assert.equal(candidate.page.wires.length,4);
assert(candidate.page.wires.every(w=>[w.from,w.to].every(e=>!e.componentId.startsWith('reserve'))),'Reserve terminals remain unwired');
assert.equal(candidate.report.metrics.crossings,0);assert.equal(candidate.report.metrics.bends,0);assert.equal(JSON.stringify(project),before);
// A device with a connection outside the movable subset is active, not a spare.
const source=snapshotPage(project.pages[0],project);
const subset=source.nodes.filter(n=>['power','reserve1'].includes(n.id)).map(n=>({id:n.id,width:n.rect.width,height:n.rect.height,ports:n.pins.map(p=>({id:JSON.stringify([n.id,p.id]),x:p.x-n.rect.x,y:p.y-n.rect.y}))}));
const direct=structuredGroup('subset',subset,source,6,{left:8,right:8,top:8,bottom:8});assert(direct);assert.deepEqual(new Set(direct.children!.map(n=>n.id)),new Set(['power','reserve1']));
const many=JSON.parse(before);
for(let i=3;i<=15;i++){const c=add(many,'reserve'+i,'contact_no');c.bmk='-R'+i;c.functionText='';}
const multiple=(await previewLayout(many,'p',{multiPage:false})).candidates.find(c=>c.profile==='structured');assert(multiple,'Many isolated devices need a wrapped reserve area');
assert.equal(multiple.page.components.length,19);
const r3=multiple.page.components.find(c=>c.id==='reserve3')!,r10=multiple.page.components.find(c=>c.id==='reserve10')!;
assert(r3.y<r10.y||Math.abs(r3.y-r10.y)<1e-6&&r3.x<r10.x,'Reserve tags must follow natural numerical order, R3 before R10');
assert(multiple.page.wires.every(w=>[w.from,w.to].every(e=>!e.componentId.startsWith('reserve'))));
applyLayout(project,candidate);history.record(project);assert.equal(topology(project),net);assert.deepEqual(history.undo(),JSON.parse(before));
console.log('✓ Active power/control areas survive spare devices; separate reserve envelope, unwired pins, external subset connection, original IDs/topology and undo');
