import assert from 'node:assert/strict';
import { fixture, add } from './testing/fixture';
import { snapshotPage } from './geometry';
import { previewLayout, applyLayout } from './service';
import { topology } from './types';
import { ProjectHistory } from '../model/ProjectHistory';

function circuit(horizontal = false, reverse = false) {
  const p = fixture();
  add(p,'feed','fuse_1p').functionText = 'Steuerspannung';
  add(p,'end','terminal_single').functionText = 'Gemeinsamer Rückleiter';
  const wire = (a:string, ap:string, b:string, bp:string) => p.pages[0].wires.push({id:'w'+p.pages[0].wires.length,from:{componentId:a,pinId:ap},to:{componentId:b,pinId:bp},potential:'',waypoints:[],isAutoconnect:false});
  for(let branch=0;branch<3;branch++) {
    for(let level=0;level<=branch;level++) {
      const c=add(p,'contact'+branch+'-'+level,'contact_no');c.bmk='-S'+branch+level;
      c.functionText=branch===1 ? 'Zusätzliche Freigabebedingung' : 'Freigabe';
      if(level) wire('contact'+branch+'-'+(level-1),'14',c.id,'13');else wire('feed','2',c.id,'13');
    }
    const c=add(p,'coil'+branch,'contactor_coil');c.bmk='-K'+(branch+1);c.functionText=branch===2?'Dritte Schaltstufe':'Schaltstufe';
    wire('contact'+branch+'-'+branch,'14',c.id,'A1');wire(c.id,'A2','end','1');
  }
  if(horizontal) { p.pages[0].plotFrame.width=1682; p.pages[0].plotFrame.height=1188; }
  if(horizontal)for(const c of p.pages[0].components){c.rotation=270;c.bmkPosition={offsetX:80};c.functionTextPosition={offsetX:80};c.crossRefPosition={offsetX:80};}
  if(reverse){p.pages[0].components.reverse();p.pages[0].wires.reverse();for(const w of p.pages[0].wires)[w.from,w.to]=[w.to,w.from];}
  return p;
}
for(const horizontal of [false,true]) {
  let previous:Map<string,{x:number;y:number}>|undefined;
  for(const reverse of [false,true]) {
    const project=circuit(horizontal,reverse),original=JSON.stringify(project),net=topology(project),history=new ProjectHistory();history.reset(project);
    const preview=await previewLayout(project,'p',{multiPage:false});
    const candidate=preview.candidates.find(c=>c.profile==='structured');assert(candidate,JSON.stringify(preview.issues));
    const geometry=snapshotPage(candidate.page,project);
    const pin=(id:string,pin:string)=>geometry.nodes.find(n=>n.id===id)!.pins.find(p=>p.id===pin)!;
    const axis=(id:string,p:string)=>horizontal?pin(id,p).y:pin(id,p).x;
    const axes=[0,1,2].map(i=>axis('contact'+i+'-0','13'));
    assert(Math.abs(axes[1]-axes[0]-(axes[2]-axes[1]))<1e-6,'Unequal paths need equal physical column pitch');
    for(let branch=0;branch<3;branch++) {
      for(let level=0;level<=branch;level++)assert(Math.abs(axis('contact'+branch+'-'+level,'13')-axes[branch])<1e-6,'Every branch retains its straight device axis');
      assert(Math.abs(axis('coil'+branch,'A1')-axes[branch])<1e-6);
    }
    const coilLevel=(i:number)=>horizontal?pin('coil'+i,'A1').x:pin('coil'+i,'A1').y;
    assert(Math.abs(coilLevel(0)-coilLevel(1))<1e-6&&Math.abs(coilLevel(1)-coilLevel(2))<1e-6,'Common return keeps outputs on the same level');
    assert.equal(candidate.report.metrics.crossings,0);
    assert.equal(JSON.stringify(project),original);
    if(previous)for(const c of candidate.page.components){const old=previous.get(c.id)!;assert(Math.abs(old.x-c.x)<1e-6&&Math.abs(old.y-c.y)<1e-6);}
    previous=new Map(candidate.page.components.map(c=>[c.id,{x:c.x,y:c.y}]));
    applyLayout(project,candidate);history.record(project);assert.equal(topology(project),net);assert.deepEqual(history.undo(),JSON.parse(original));
  }
}
console.log('✓ Unequal control paths, regular pitch, straight axes, common outputs, both axes, input-order independence, routed topology and undo');

// A wide middle-level label can extend over an empty intervening column.
// Clearance must therefore include non-adjacent branches as well.
const {spaceParallelBranches}=await import('./branchSpacing');
const {snapshot,rows,connections}=(()=>{
  const rows:import('elkjs/lib/elk-api').ElkNode[][]=[[],[],[]];
  const snapshot:import('./types').LayoutSnapshot={pageId:'p',area:{x:0,y:0,width:1000,height:1000},grid:{spacing:4,origin:{x:0,y:0}},nodes:[],frames:[],edges:[],issues:[]};
  const connections:{a:string;b:string;ac:string;bc:string}[]=[];
  const key=(id:string,pin:string)=>JSON.stringify([id,pin]);
  const edge=(a:string,ap:string,b:string,bp:string)=>snapshot.edges.push({id:'w'+snapshot.edges.length,from:{componentId:a,pinId:ap},to:{componentId:b,pinId:bp},potential:'',points:[]});
  for(let branch=0;branch<3;branch++) {
    const ids=['first'+branch,...(branch===1?[]:['middle'+branch]),'last'+branch];
    for(const [i,id]of ids.entries()) {
      const row=i===0?0:i===ids.length-1?2:1,width=id==='middle0'?300:40;
      const ports=[{id:key(id,'in'),x:10,y:0},{id:key(id,'out'),x:10,y:20}];
      rows[row].push({id,x:[50,150,250][branch]-10,y:row*80,width,height:20,ports});
      snapshot.nodes.push({id,kind:'component',fixed:false,origin:{x:0,y:0},rect:{x:0,y:0,width,height:20},shapes:[],pins:[{id:'in',x:10,y:0,direction:'top'},{id:'out',x:10,y:20,direction:'bottom'}]});
      if(i){edge(ids[i-1],'out',id,'in');connections.push({a:key(ids[i-1],'out'),b:key(id,'in'),ac:ids[i-1],bc:id});}
    }
    if(branch){edge('first0','in','first'+branch,'in');edge('last0','out','last'+branch,'out');}
  }
  return {snapshot,rows,connections};
})();
const saved=JSON.stringify(snapshot);
assert(spaceParallelBranches(rows,connections,snapshot,6,8));
const first=rows[0].map(n=>n.x!+10);
assert.equal(first[1]-first[0],first[2]-first[1]);
const left=rows[1].find(n=>n.id==='middle0')!,right=rows[1].find(n=>n.id==='middle2')!;
assert(left.x!+left.width!+6<=right.x!,'A label across a vacant middle column still reserves clearance');
assert.equal(JSON.stringify(snapshot),saved);
const blockedRows=structuredClone(rows);blockedRows[1].push({id:'fixed-neighbour',x:0,y:80,width:1000,height:20,ports:[]});
const blockedBefore=JSON.stringify(blockedRows);
assert.equal(spaceParallelBranches(blockedRows,connections,snapshot,6,8),false);
assert.equal(JSON.stringify(blockedRows),blockedBefore,'Blocked uneven banks must not move partially');
console.log('✓ Empty intermediate columns, measured non-neighbour clearance and atomic obstacle rejection');
