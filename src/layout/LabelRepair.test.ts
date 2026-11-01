import assert from 'node:assert/strict';
import {fixture,add} from './testing/fixture';
import {handleOptimizeLayout} from './tools';
import {applyLayout} from './service';
import {unverifiedAutoconnections} from './autoconnectPolicy';
import {snapshotPage,union} from './geometry';
import {validateLayout} from './validate';
import {AutoconnectEngine} from '../model/AutoconnectEngine';
const p=fixture();add(p,'a','contactor_coil',100,100).bmkPosition={offsetX:-80};add(p,'b','contactor_coil',100,240);
p.pages[0].wires=[{id:'w',from:{componentId:'a',pinId:'A2'},to:{componentId:'b',pinId:'A1'},potential:'L1'}];
p.pages[0].cables=[{id:'c',start:{x:40,y:400},end:{x:60,y:400},bmk:'-W1',cableType:'test',crossSection:'1.5',cores:[{id:'core',t:0.5,wireIds:['w']}]}];
const before=JSON.stringify(p),positions=p.pages[0].components.map(c=>[c.x,c.y,c.rotation]);let shown:any;
const response=await handleOptimizeLayout({}, {getProject:()=>p,showLayoutPreview:(preview:any,draft:any)=>shown={preview,draft}} as any);
assert.equal(response.status,'preview_ready');assert.equal(JSON.stringify(p),before);assert.equal(shown.preview.candidates[0].id,'layout-label-repair');
applyLayout(p,shown.preview.candidates[0],shown.draft);
assert.deepEqual(p.pages[0].components.map(c=>[c.x,c.y,c.rotation]),positions);assert.deepEqual(p.pages[0].cables,JSON.parse(before).pages[0].cables);assert.equal(unverifiedAutoconnections(p,p.pages[0]).length,0);
// A wide real sheet must not impose the historical 800-unit distance ceiling.
const wide=fixture();wide.pages[0].plotFrame.width=1200;
add(wide,'top','contactor_coil',100,40);add(wide,'bottom','contactor_coil',100,940);
assert(AutoconnectEngine.findAutoconnectPairs(wide.pages[0].components,1e-6,8,wide).some(pair=>pair.distance>800));
console.log('✓ Existing-sheet label repair preserves symbol positions, preview isolation, cables/cores and verified long Autoconnect paths');

const boxed=fixture();add(boxed,'inside','contactor_coil',100,100);
const snapshot=snapshotPage(boxed.pages[0],boxed),node=snapshot.nodes[0],paint=union(node.shapes.map(s=>s.rect));
snapshot.frames=[{id:'box',kind:'component',fixed:true,members:[node.id],rect:paint}];
node.rect={...node.rect,y:node.rect.y-10,height:node.rect.height+10};
assert(!validateLayout(snapshot).issues.some(i=>i.type==='group_overflow'),'External routing reservation is not painted box content');
node.shapes[0].rect={...node.shapes[0].rect,x:500};
assert(validateLayout(snapshot).issues.some(i=>i.type==='group_overflow'),'Actual painted content must remain inside its box');
