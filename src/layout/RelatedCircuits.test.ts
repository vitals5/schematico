import assert from 'node:assert/strict';
import {fixture,add} from './testing/fixture';
import {snapshotPage} from './geometry';
import {relatedCircuits} from './relatedCircuits';
import {previewLayout,applyLayout} from './service';
import {topology} from './types';
import {ProjectHistory} from '../model/ProjectHistory';
const project=fixture();
for(let i=1;i<=2;i++){
 for(const [suffix,symbol,bmk] of [['p','contactor_power_3p','-K'+i],['m','motor_3phase','-M'+i],['s','pushbutton_no','-S'+i],['c','contactor_coil','-K'+i]]){
  const c=add(project,(suffix==='s'||suffix==='c'?'a':'z')+i+suffix,symbol);c.bmk=bmk;c.functionText='';
 }
 project.pages[0].wires.push({id:'control'+i,from:{componentId:'a'+i+'s',pinId:'14'},to:{componentId:'a'+i+'c',pinId:'A1'},potential:'',waypoints:[],isAutoconnect:false});
 for(const [j,[a,b]] of [['2','U1'],['4','V1'],['6','W1']].entries())project.pages[0].wires.push({id:'power'+i+j,from:{componentId:'z'+i+'p',pinId:a},to:{componentId:'z'+i+'m',pinId:b},potential:'',waypoints:[],isAutoconnect:false});
}
const source=snapshotPage(project.pages[0],project);
const circuits=[['a1s','a1c'],['a2s','a2c'],['z1p','z1m'],['z2p','z2m']].map(ids=>ids.map(id=>({id})));
const units=relatedCircuits(circuits,source);
assert.equal(units.length,2);
assert.deepEqual(units.map(u=>u.map(c=>c[0].id)),[['z1p','a1s'],['z2p','a2s']]);
const auxiliary=structuredClone(source);auxiliary.nodes.find(n=>n.id==='a1s')!.deviceRelation={...auxiliary.nodes.find(n=>n.id==='a1c')!.deviceRelation!,kind:'contact'};
assert.equal(relatedCircuits(circuits,auxiliary).length,2,'An auxiliary contact in the control area must not invalidate a power/control pair');
const ambiguous=structuredClone(source);ambiguous.nodes.find(n=>n.id==='a2c')!.deviceRelation=structuredClone(ambiguous.nodes.find(n=>n.id==='a1c')!.deviceRelation);
assert(relatedCircuits(circuits,ambiguous).every(u=>u.length===1),'Duplicate masters must not create guessed pairings');
const isolated=structuredClone(project);isolated.pages[0].components.find(c=>c.id==='a1c')!.mountingLocation='+Other';
assert(!relatedCircuits(circuits,snapshotPage(isolated.pages[0],isolated)).some(u=>u.length===2&&u.some(c=>c[0].id==='a1s')),'Equal BMK in different locations are not paired');
const before=JSON.stringify(project),net=topology(project),history=new ProjectHistory();history.reset(project);
const candidate=(await previewLayout(project,'p',{multiPage:false})).candidates.find(c=>c.profile==='structured');assert(candidate);
const bounds=(ids:string[])=>{const ns=snapshotPage(candidate.page,project).nodes.filter(n=>ids.includes(n.id));return {x:Math.min(...ns.map(n=>n.rect.x)),y:Math.min(...ns.map(n=>n.rect.y)),right:Math.max(...ns.map(n=>n.rect.x+n.rect.width))};};
for(let i=1;i<=2;i++){const power=bounds(['z'+i+'p','z'+i+'m']),control=bounds(['a'+i+'s','a'+i+'c']);assert(power.right<control.x);assert(Math.abs(power.y-control.y)<1e-6);}
assert.equal(candidate.report.metrics.crossings,0);assert.equal(candidate.report.metrics.bends,0);
const narrow=JSON.parse(before);narrow.pages[0].plotFrame.width=360;
const wrapped=(await previewLayout(narrow,'p',{multiPage:false})).candidates.find(c=>c.profile==='structured');assert(wrapped,'Paired areas must also support row wrapping');
const wrappedGeometry=snapshotPage(wrapped.page,narrow);
const top=(ids:string[])=>Math.min(...wrappedGeometry.nodes.filter(n=>ids.includes(n.id)).map(n=>n.rect.y));
for(let i=1;i<=2;i++)assert(Math.abs(top(['z'+i+'p','z'+i+'m'])-top(['a'+i+'s','a'+i+'c']))<1e-6);
assert(top(['z2p','z2m'])>top(['z1p','z1m']),'Whole pairs move to the next row together');
assert.equal(JSON.stringify(project),before);applyLayout(project,candidate);history.record(project);assert.equal(topology(project),net);assert.deepEqual(history.undo(),JSON.parse(before));
console.log('✓ Related drive areas, exact structured identity, duplicate-master guards, neighbouring power/control pairs, original topology and undo');
