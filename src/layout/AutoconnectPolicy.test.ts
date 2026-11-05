import assert from 'node:assert/strict';
import {fixture,add} from './testing/fixture';
import {preferDraftAutoconnect} from './autoconnectDraft';
import {unverifiedAutoconnections} from './autoconnectPolicy';
import {snapshotPage} from './geometry';
import {validateLayout} from './validate';
import {clone,projectRevision,type LayoutPreview} from './types';
import {applyLayout} from './service';
import {handleCreateDraft} from './tools';
import {ProjectHistory} from '../model/ProjectHistory';
function example(stub:number){
 const p=fixture(),a=add(p,'a','contactor_coil',100,100),b=add(p,'b','contactor_coil',200,100);a.functionText='';b.functionText='';
 p.pages[0].wires=[{id:'w',from:{componentId:'a',pinId:'A1'},to:{componentId:'b',pinId:'A1'},potential:'L1',isAutoconnect:false,waypoints:[{x:116,y:100-stub},{x:216,y:100-stub}]}];
 const report=validateLayout(snapshotPage(p.pages[0],p));assert(report.valid);
 const preview:LayoutPreview={pageId:'p',status:'preview_ready',before:report,issues:[],candidates:[{id:'test',base:projectRevision(p),pageId:'p',page:clone(p.pages[0]),report,profile:'structured'}]};
 return {p,preview};
}
const existing=example(32),before=JSON.stringify(existing.p);
const checked=preferDraftAutoconnect(existing.p,existing.p,existing.preview,true);
assert.equal(checked.preview.status,'preview_ready');assert.equal(checked.preview.connectionConstruction?.routed,0);
assert.equal(checked.preview.candidates[0].autoconnectRequired,true);
assert.equal(unverifiedAutoconnections(checked.draft,checked.preview.candidates[0].page).length,0);
assert.equal(JSON.stringify(existing.p),before,'Compiling an existing manual circuit is only a preview');
const tampered=clone(checked.preview.candidates[0]);tampered.page.wires[0].waypoints=[{x:50,y:50}];
assert.throws(()=>applyLayout(existing.p,tampered,checked.draft),/Autoconnect/);assert.equal(JSON.stringify(existing.p),before);
const forged=clone(checked.preview.candidates[0]);forged.page.components[0].x+=3;
assert.throws(()=>applyLayout(existing.p,forged,checked.draft),/Autoconnect/,'Forged flags cannot bypass actual detector');
const history=new ProjectHistory();history.reset(existing.p);applyLayout(existing.p,checked.preview.candidates[0],checked.draft);history.record(existing.p);assert.deepEqual(history.undo(),JSON.parse(before));
const tight=example(16),tightBefore=JSON.stringify(tight.p),failed=preferDraftAutoconnect(tight.p,tight.p,tight.preview,true);
assert.equal(failed.preview.status,'layout_invalid');assert.equal(failed.preview.candidates.length,0);assert(failed.preview.issues.some(i=>i.type==='autoconnect_required'));assert.equal(JSON.stringify(tight.p),tightBefore);
// Verify every sheet, including a second normalization when the dialog opens.
const empty=fixture(),left=example(32),right=example(32);
right.p.pages[0].id='second';right.p.pages[0].pageNumber='2';
for(const c of right.p.pages[0].components)c.id+='-right';
for(const w of right.p.pages[0].wires){w.id+='-right';w.from.componentId+='-right';w.to.componentId+='-right';}
const virtual=clone(left.p);virtual.pages[0].components.push(...clone(right.p.pages[0].components));virtual.pages[0].wires.push(...clone(right.p.pages[0].wires));
const multiPreview:LayoutPreview={...left.preview,candidates:[{...left.preview.candidates[0],base:projectRevision(empty),multiPage:{pages:[left.p.pages[0],right.p.pages[0]],links:[]}}]};
const multi=preferDraftAutoconnect(empty,virtual,multiPreview,true);
assert.equal(multi.preview.status,'preview_ready');
const reopened=preferDraftAutoconnect(empty,multi.draft,multi.preview,true);
assert.equal(reopened.preview.status,'preview_ready');
const altered=clone(reopened.preview.candidates[0]);altered.multiPage!.pages[1].wires[0].isAutoconnect=false;
assert.throws(()=>applyLayout(empty,altered,reopened.draft),/Autoconnect/);assert.equal(empty.pages.length,1);
applyLayout(empty,reopened.preview.candidates[0],reopened.draft);assert.equal(empty.pages.length,2);
assert(empty.pages.every(p=>unverifiedAutoconnections(empty,p).length===0));
// A geometrically valid multi-sheet route must not bypass mandatory Autoconnect.
const tightLeft=example(16),tightRight=example(16),emptySource=fixture();
tightRight.p.pages[0].id='other';tightRight.p.pages[0].pageNumber='2';
for(const c of tightRight.p.pages[0].components)c.id+='-other';
for(const w of tightRight.p.pages[0].wires){w.id+='-other';w.from.componentId+='-other';w.to.componentId+='-other';}
const tightDraft=clone(tightLeft.p);tightDraft.pages[0].components.push(...clone(tightRight.p.pages[0].components));tightDraft.pages[0].wires.push(...clone(tightRight.p.pages[0].wires));
const mixedPreview:LayoutPreview={...tightLeft.preview,candidates:[{...tightLeft.preview.candidates[0],base:projectRevision(emptySource),multiPage:{pages:[tightLeft.p.pages[0],tightRight.p.pages[0]],links:[]}}]};
const blocked=preferDraftAutoconnect(emptySource,tightDraft,mixedPreview,true);
assert.equal(blocked.preview.status,'layout_invalid');assert.equal(blocked.preview.candidates.length,0);assert(blocked.preview.issues.some(i=>i.type==='autoconnect_required'));
const source=fixture();let captured:any;
const result=await handleCreateDraft({preferAutoconnect:false,components:[{id:'a',symbolId:'contactor_coil',functionText:''},{id:'b',symbolId:'contactor_coil',functionText:''}],connections:[{id:'edge',from:{componentId:'a',pinId:'A1'},to:{componentId:'b',pinId:'A1'},potential:'L1'}]}, {getProject:()=>source,showLayoutPreview:(preview:any,draft:any)=>captured={preview,draft}} as any);
assert.equal(result.status,'preview_ready');assert.equal(result.connectionConstruction?.routed,0);assert(captured.preview.candidates[0].autoconnectRequired,'Legacy false option cannot disable mandatory Autoconnect');
console.log('✓ Mandatory Autoconnect for existing circuits and new AI drafts: real detector verification, failed-conversion rejection, false-option resistance, tamper checks and undo');
