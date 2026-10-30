import assert from 'node:assert/strict';
import {fixture,add} from './testing/fixture';
import {snapshotPage} from './geometry';
import {relatedCircuits} from './relatedCircuits';
import {functionalBlocks} from './functionalBlocks';
import {relatedAreaPenalty,separatedAreaPenalty} from './areaQuality';
import {previewLayout,applyLayout} from './service';
import {ProjectHistory} from '../model/ProjectHistory';
import {multiPageCandidate} from './multipage';
import {topology} from './types';

const project=fixture();
for(let i=1;i<=3;i++){
 for(const [suffix,symbol,bmk]of [['p','contactor_power_3p','-K'+i],['m','motor_3phase','-M'+i],['s','pushbutton_no','-S'+i],['c','contactor_coil','-K'+i]]){
  const c=add(project,(suffix==='s'||suffix==='c'?'a':'z')+i+suffix,symbol);c.bmk=bmk;c.functionText='';
 }
 project.pages[0].wires.push({id:'control'+i,from:{componentId:'a'+i+'s',pinId:'14'},to:{componentId:'a'+i+'c',pinId:'A1'},potential:'',waypoints:[],isAutoconnect:false});
 for(const[j,[a,b]]of [['2','U1'],['4','V1'],['6','W1']].entries())project.pages[0].wires.push({id:'power'+i+j,from:{componentId:'z'+i+'p',pinId:a},to:{componentId:'z'+i+'m',pinId:b},potential:'',waypoints:[],isAutoconnect:false});
}
project.pages[0].wires.push({id:'shared-control',from:{componentId:'a1s',pinId:'13'},to:{componentId:'a2s',pinId:'13'},potential:'',waypoints:[],isAutoconnect:false});
const snapshot=snapshotPage(project.pages[0],project);
const circuits=[['a1s','a1c','a2s','a2c'],['a3s','a3c'],['z1p','z1m'],['z2p','z2m'],['z3p','z3m']].map(ids=>ids.map(id=>({id})));
const before=JSON.stringify(snapshot);
const units=relatedCircuits(circuits,snapshot);
assert.deepEqual(units.map(u=>u.map(c=>c[0].id)),[['z1p','z2p','a1s'],['z3p','a3s']]);
const reversed={...snapshot,nodes:[...snapshot.nodes].reverse(),edges:[...snapshot.edges].reverse().map(e=>({...e,from:e.to,to:e.from}))};
assert.deepEqual(relatedCircuits([...circuits].reverse(),reversed).map(u=>u.map(c=>c.map(n=>n.id))),units.map(u=>u.map(c=>c.map(n=>n.id))));
const atomic=snapshot.nodes.map(n=>[n.id]),blocks=functionalBlocks(atomic,snapshot);
assert.equal(blocks.length,2);
assert(blocks.some(b=>['a1s','a1c','a2s','a2c','z1p','z1m','z2p','z2m'].every(id=>b.includes(id))));
const ambiguous=structuredClone(snapshot);ambiguous.nodes.find(n=>n.id==='a2c')!.deviceRelation=structuredClone(ambiguous.nodes.find(n=>n.id==='a1c')!.deviceRelation);
assert(!relatedCircuits(circuits,ambiguous).some(u=>u.length===3),'Duplicate device masters must not create a shared unit');
const unknown=structuredClone(snapshot);for(const n of unknown.nodes.filter(n=>['z2p','z2m'].includes(n.id)))delete n.circuitRole;
assert(!relatedCircuits(circuits,unknown).some(u=>u.some(c=>c[0].id==='z2p')&&u.length>1),'Unknown power roles must not be guessed');
// Keep the first function on one sheet or split one of its power paths away.
const owners=new Map(snapshot.nodes.map(n=>[n.id,n.id.includes('3')?'second':'first']));
assert.equal(separatedAreaPenalty(snapshot,owners),0);
owners.set('z2p','third');owners.set('z2m','third');
assert.equal(separatedAreaPenalty(snapshot,owners),120);
const fixed=structuredClone(snapshot);fixed.nodes.find(n=>n.id==='z1m')!.fixed=true;
assert.equal(separatedAreaPenalty(fixed,owners),0);
assert.equal(JSON.stringify(snapshot),before);
const original=JSON.stringify(project),net=topology(project),history=new ProjectHistory();history.reset(project);
const candidate=(await previewLayout(project,'p',{multiPage:false})).candidates.find(c=>c.profile==='structured');assert(candidate);
const placed=snapshotPage(candidate.page,project);
const rect=(ids:string[])=>{const ns=placed.nodes.filter(n=>ids.includes(n.id));return {left:Math.min(...ns.map(n=>n.rect.x)),right:Math.max(...ns.map(n=>n.rect.x+n.rect.width)),top:Math.min(...ns.map(n=>n.rect.y))};};
const p1=rect(['z1p','z1m']),p2=rect(['z2p','z2m']),control=rect(['a1s','a1c','a2s','a2c']),other=rect(['z3p','z3m']);
assert(p1.right<p2.left&&p2.right<control.left&&(control.right<other.left||other.top>control.top),'All associated power paths precede their common control before the independent drive');
assert(Math.abs(p1.top-p2.top)<1e-6&&Math.abs(p2.top-control.top)<1e-6);
assert.equal(relatedAreaPenalty(placed),0);
const interposed=structuredClone(placed);
for(const n of interposed.nodes.filter(n=>n.id.includes('3')))delete n.deviceRelation;
// Put the independent power area into the first unit's internal gap, without
// changing relationship or wire data. The quality score must detect this too.
for(const n of interposed.nodes.filter(n=>['z3p','z3m'].includes(n.id)))n.rect={...n.rect,x:p1.right+1,width:Math.max(1,p2.left-p1.right-2),y:p1.top};
assert(relatedAreaPenalty(interposed)>relatedAreaPenalty(placed),'Foreign areas between associated power paths must worsen the common score');
assert.equal(candidate.report.metrics.crossings,0);
assert.equal(JSON.stringify(project),original);applyLayout(project,candidate);history.record(project);assert.equal(topology(project),net);assert.deepEqual(history.undo(),JSON.parse(original));
console.log('✓ Shared control units, unique relationships, unknown/ambiguous/fixed guards, complete page blocks, common scoring, adjacent routed areas, unchanged topology and undo');

const sharedPower=JSON.parse(original) as typeof project;
sharedPower.pages[0].wires=sharedPower.pages[0].wires.filter(w=>w.id!=='shared-control');
sharedPower.pages[0].wires.push({id:'shared-supply',from:{componentId:'z1p',pinId:'1'},to:{componentId:'z2p',pinId:'1'},potential:'L1',waypoints:[],isAutoconnect:false});
const inverseCircuits=[['z1p','z1m','z2p','z2m'],['a1s','a1c'],['a2s','a2c'],['z3p','z3m'],['a3s','a3c']].map(ids=>ids.map(id=>({id})));
assert.deepEqual(relatedCircuits(inverseCircuits,snapshotPage(sharedPower.pages[0],sharedPower)).map(u=>u.map(c=>c[0].id)),[['z1p','a1s','a2s'],['z3p','a3s']],'One power area may have several independently connected control areas');
const separate=JSON.parse(original) as typeof project;
const multi=await multiPageCandidate(separate,separate,'p',{});assert(multi?.multiPage);
assert.equal(multi.multiPage.pages.length,2);assert.equal(multi.multiPage.links.length,0);
assert(multi.multiPage.pages.some(p=>['a1s','a1c','a2s','a2c','z1p','z1m','z2p','z2m'].every(id=>p.components.some(c=>c.id===id))));
assert.equal(JSON.stringify(separate),original,'Multi-page planning remains isolated');
console.log('✓ Several control areas for a shared power area and checked two-page planning with complete functional units');

// A narrower, taller drawing area and full-sized labels need internal wrapping.
const portrait=JSON.parse(original) as typeof project;
portrait.pages[0].plotFrame.width=594;portrait.pages[0].plotFrame.height=840;
for(const c of portrait.pages[0].components.filter(c=>['z1p','z2p'].includes(c.id)))c.functionText='Leistungsschaltglied Antrieb';
const portraitBefore=JSON.stringify(portrait),portraitNet=topology(portrait),portraitHistory=new ProjectHistory();portraitHistory.reset(portrait);
const wrapped=(await previewLayout(portrait,'p',{multiPage:false})).candidates.find(c=>c.profile==='structured');assert(wrapped);
const wrappedGeometry=snapshotPage(wrapped.page,portrait);
const bounds=(ids:string[])=>{const ns=wrappedGeometry.nodes.filter(n=>ids.includes(n.id));return {top:Math.min(...ns.map(n=>n.rect.y)),bottom:Math.max(...ns.map(n=>n.rect.y+n.rect.height))};};
const power=bounds(['z1p','z1m','z2p','z2m']),shared=bounds(['a1s','a1c','a2s','a2c']),independent=bounds(['z3p','z3m','a3s','a3c']);
assert(power.bottom<shared.top,'The common control follows its power areas on the next internal row');
assert(shared.bottom+16<independent.top,'The independent drive must retain a separator below the complete wrapped unit');
assert.equal(wrapped.report.metrics.crossings,0);
assert.equal(JSON.stringify(portrait),portraitBefore);
applyLayout(portrait,wrapped);portraitHistory.record(portrait);assert.equal(topology(portrait),portraitNet);assert.deepEqual(portraitHistory.undo(),JSON.parse(portraitBefore));
console.log('✓ Wrapped functional areas with real symbols and unchanged large labels, separate independent drive, routing, original topology and undo');
