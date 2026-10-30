import assert from 'node:assert/strict';
import {fixture,add} from './testing/fixture';
import {snapshotPage} from './geometry';
import {previewLayout,applyLayout} from './service';
import {topology} from './types';
import {ProjectHistory} from '../model/ProjectHistory';
const project=fixture();
for(const [id,symbol,rotation,bmk,text] of [
 ['feed','fuse_1p',270,'-F1','Leistungskreis'],['contact','contact_no',270,'-K1','Leistungskontakt'],
 ['start','pushbutton_no',0,'-S1','Steuerkreis'],['coil','contactor_coil',0,'-K1','Schützspule'],
] as const){const c=add(project,id,symbol);c.rotation=rotation;c.bmk=bmk;c.functionText=text;if(rotation){c.bmkPosition={offsetX:80};c.functionTextPosition={offsetX:80};c.crossRefPosition={offsetX:80};}}
project.pages[0].wires=[{id:'power',from:{componentId:'feed',pinId:'2'},to:{componentId:'contact',pinId:'13'},potential:'',waypoints:[],isAutoconnect:false},
 {id:'control',from:{componentId:'start',pinId:'14'},to:{componentId:'coil',pinId:'A1'},potential:'',waypoints:[],isAutoconnect:false}];
const saved=JSON.stringify(project),net=topology(project),history=new ProjectHistory();history.reset(project);
const preview=await previewLayout(project,'p',{multiPage:false});
const candidate=preview.candidates.find(c=>c.profile==='structured');assert(candidate,JSON.stringify(preview.issues.slice(0,5)));
const geometry=snapshotPage(candidate.page,project);
const bounds=(ids:string[])=>{const r=geometry.nodes.filter(n=>ids.includes(n.id)).map(n=>n.rect);return {x:Math.min(...r.map(r=>r.x)),y:Math.min(...r.map(r=>r.y)),right:Math.max(...r.map(r=>r.x+r.width)),bottom:Math.max(...r.map(r=>r.y+r.height))};};
const power=bounds(['feed','contact']),control=bounds(['start','coil']);
assert(power.right<=control.x||control.right<=power.x||power.bottom<=control.y||control.bottom<=power.y,'Independent circuits must have separate complete measured envelopes');
const pin=(id:string,pin:string)=>geometry.nodes.find(n=>n.id===id)!.pins.find(p=>p.id===pin)!;
assert(Math.abs(pin('feed','2').y-pin('contact','13').y)<1e-6);
assert(Math.abs(pin('start','14').x-pin('coil','A1').x)<1e-6);
assert.equal(candidate.report.metrics.crossings,0);assert.equal(candidate.report.metrics.bends,0);
assert.equal(JSON.stringify(project),saved);
const reversed=JSON.parse(saved);reversed.pages[0].components.reverse();reversed.pages[0].wires.reverse();
for(const w of reversed.pages[0].wires)[w.from,w.to]=[w.to,w.from];
const again=(await previewLayout(reversed,'p',{multiPage:false})).candidates.find(c=>c.profile==='structured');assert(again);
for(const c of candidate.page.components){const other=again.page.components.find(n=>n.id===c.id)!;assert(Math.abs(c.x-other.x)<1e-6&&Math.abs(c.y-other.y)<1e-6);}

applyLayout(project,candidate);history.record(project);assert.equal(topology(project),net);assert.deepEqual(history.undo(),JSON.parse(saved));
console.log('✓ Separate measured power/control areas, independent reading axes, shared device tags without electrical merging, original wiring and undo');
