import assert from 'node:assert/strict';
import { getSymbolById, setProjectSymbolLibrary } from './symbols';
import { isConnectionSymbol, interruptionLabelPosition, interruptionReferencePosition } from './ConnectionSymbols';
import { computeCrossReferencePosition } from './LabelLayout';
import { AutoconnectEngine } from './AutoconnectEngine';
import { rotatedLocalPoint } from './SymbolGeometry';
import { PlacedComponent, Project, SymbolDefinition } from './types';

for (const symbolId of ['potential_arrow','potential_arrow_right','potential_arrow_left','potential_arrow_up','potential_arrow_down']) {
  const sym = getSymbolById(symbolId)!;
  assert(isConnectionSymbol(sym));
  assert.equal(sym.pins.length, 2);
  for (const rotation of [0,90,180,270] as const) {
    const arrow: PlacedComponent = {id:'arrow',symbolId,bmk:'L',functionText:'L',x:200,y:200,rotation,pins:{}};
    const targets = sym.pins.map((p,i) => {
      const pin = AutoconnectEngine.getRotatedPinInfo(arrow,p,sym);
      const delta = {top:[0,-100],right:[100,0],bottom:[0,100],left:[-100,0]}[pin.direction];
      const opposite = {top:'bottom',right:'left',bottom:'top',left:'right'}[pin.direction] as 'top'|'right'|'bottom'|'left';
      const target: SymbolDefinition = {...sym,id:'target-'+i,width:0,height:0,pins:[{id:'0',name:'',x:0,y:0,direction:opposite}]};
      return {target, component:{...arrow,id:target.id,symbolId:target.id,rotation:0 as const,x:pin.worldX+delta[0],y:pin.worldY+delta[1]}};
    });
    setProjectSymbolLibrary({pages:[],symbolLibrary:targets.map(t=>t.target)} as unknown as Project);
    const pairs = AutoconnectEngine.findAutoconnectPairs([arrow,...targets.map(t=>t.component)]);
    assert.equal(pairs.filter(p=>p.pin1.componentId==='arrow'||p.pin2.componentId==='arrow').length,2,`${symbolId} ${rotation}° connects on both sides`);
    const before = interruptionLabelPosition({settings:{interruptionLabelSide:'before'}} as Project,arrow,sym)!;
    const after = interruptionLabelPosition({settings:{interruptionLabelSide:'after'}} as Project,arrow,sym)!;
    const a=rotatedLocalPoint(before,sym,rotation),b=rotatedLocalPoint(after,sym,rotation);
    assert(Math.hypot(a.x-b.x,a.y-b.y)>sym.width);
    if(a.x<b.x-1e-6) assert.equal(before.anchor,'end');
    if(a.x>b.x+1e-6) assert.equal(before.anchor,'start');
  }
}
// Native interruption points have coincident opposite ports; input order must
// never hide one of them during the adjacent-position search.
const native = {...getSymbolById('potential_arrow_right')!,id:'native',pins:[
  {id:'0',name:'',x:10,y:10,direction:'left' as const},
  {id:'1',name:'',x:10,y:10,direction:'right' as const}]};
setProjectSymbolLibrary({pages:[],symbolLibrary:[native]} as unknown as Project);
const components = [0,100,200].map((x,i)=>({id:String(i),symbolId:'native',bmk:'',functionText:'',x,y:0,rotation:0 as const,pins:{}}));
assert.equal(AutoconnectEngine.findAutoconnectPairs(components).length,2);
assert.equal(AutoconnectEngine.findAutoconnectPairs(components.reverse()).length,2);
setProjectSymbolLibrary({pages:[],symbolLibrary:[]} as unknown as Project);
console.log('✓ Bidirectional interruption autoconnect and label side for every rotation, including coincident native ports');

const sourceArrow: SymbolDefinition = { ...getSymbolById('potential_arrow_right')!, id:'source-arrow',
  source:{library:'SPECIAL',number:8,variant:0}, pins:[
    {id:'0',name:'',x:10,y:10,direction:'left'}, {id:'1',name:'',x:10,y:10,direction:'right'}] };
for (const sym of [...['potential_arrow_up','potential_arrow_down','potential_arrow_left','potential_arrow_right'].map(id=>getSymbolById(id)!),sourceArrow]) {
  for(const rotation of [0,90,180,270] as const)for(const pin of sym.pins)for(const reverse of [false,true]) {
    const arrow: PlacedComponent = {id:'arrow',symbolId:sym.id,bmk:'L',functionText:'L',crossRef:'/3.2',x:200,y:200,rotation,pins:{},crossRefFontSize:13};
    const own=AutoconnectEngine.getRotatedPinInfo(arrow,pin,sym), delta={top:[0,-100],right:[100,0],bottom:[0,100],left:[-100,0]}[own.direction];
    const facing={top:'bottom',right:'left',bottom:'top',left:'right'}[own.direction] as typeof pin.direction;
    const targetSymbol: SymbolDefinition = {...sym,id:'end',source:undefined,width:0,height:0,pins:[{id:'0',name:'',x:0,y:0,direction:facing}]};
    const target={...arrow,id:'end',symbolId:'end',rotation:0 as const,x:own.worldX+delta[0],y:own.worldY+delta[1]};
    const a={componentId:arrow.id,pinId:pin.id},b={componentId:target.id,pinId:'0'};
    const page={components:[arrow,target],wires:[{id:'wire',from:reverse?b:a,to:reverse?a:b,potential:'L1',
      waypoints:[{x:own.worldX+delta[0]/2,y:own.worldY+delta[1]/2}]}]};
    const project={pages:[page],symbolLibrary:[sym,targetSymbol],settings:{interruptionLabelSide:'before'}} as unknown as Project;
    const before=JSON.stringify(project);
    assert(interruptionReferencePosition(project,arrow,sym));
    const ref=computeCrossReferencePosition(arrow,sym,project), p=rotatedLocalPoint(ref,sym,rotation);
    const corners=[{x:0,y:0},{x:sym.width,y:0},{x:0,y:sym.height},{x:sym.width,y:sym.height}].map(p=>rotatedLocalPoint(p,sym,rotation));
    const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);
    if(own.direction==='bottom')assert(p.y<Math.min(...ys),'Connected below → reference above');
    if(own.direction==='top')assert(p.y>Math.max(...ys),'Connected above → reference below');
    if(own.direction==='left')assert(p.x>Math.max(...xs),'Connected left → reference right');
    if(own.direction==='right')assert(p.x<Math.min(...xs),'Connected right → reference left');
    const explicit=computeCrossReferencePosition({...arrow,crossRefPosition:{preset:'right',offsetX:2}},sym,project);
    assert.equal(explicit.x,sym.width+10,'Explicit reference positioning remains available');
    assert.equal(JSON.stringify(project),before,'Reading wire direction never edits the project or its routes');

    // Default settings without explicit side must also resolve connected labels for native/source symbols
    const defaultProject = { pages: [page], symbolLibrary: [sym, targetSymbol] } as unknown as Project;
    const defaultLabelPos = interruptionLabelPosition(defaultProject, arrow, sym);
    assert(defaultLabelPos, 'Connected interruption symbol resolves label position under default settings');
    const defaultRefPos = computeCrossReferencePosition(arrow, sym, defaultProject);
    const dist = Math.hypot(defaultLabelPos.x - defaultRefPos.x, defaultLabelPos.y - defaultRefPos.y);
    assert(dist >= 5, `Label and cross-reference must not collide (dist=${dist})`);
  }
}
console.log('✓ References opposite actual wire segments, every port/rotation/endpoint order, routed wires, native symbols and manual overrides');
