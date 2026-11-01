import type {Project,PlacedComponent,TextFormatConfig} from '../model/types';
import {getSymbolForComponent,getDrawingUnitsPerMm} from '../model/symbols';
import {computePinLabelPosition} from '../model/LabelLayout';
import {pinStub} from './router';
import {snapshotPage,componentShapes,union} from './geometry';
import {validateLayout} from './validate';
import {clone,type LayoutOptions} from './types';
const fields:Record<string,keyof PlacedComponent>={bmk:'bmkPosition',function:'functionTextPosition',technical:'technicalDataPosition',additional:'additionalTextPosition',crossRef:'crossRefPosition'};
/** Preserve an existing drawing's electrical geometry; only move visible labels.
 * Every trial uses the shared validator and never hides or shrinks text. */
export async function repairExistingLabels(project:Project,pageId:string,options:LayoutOptions){
 const work=clone(project),page=work.pages.find(p=>p.id===pageId)!,u=getDrawingUnitsPerMm(work);
 let snapshot=snapshotPage(page,work,options),report=validateLayout(snapshot);
 const score=(r:typeof report)=>r.issues.filter(i=>i.severity==='error').reduce((sum,i)=>sum+1000+(i.bounds?.[0]?(i.bounds[0].width*i.bounds[0].height):0),0);
 let cost=score(report);
 for(let pass=0;pass<3&&cost;pass++){
  let improved=false;
  const owners=new Set(report.issues.filter(i=>i.severity==='error').flatMap(i=>i.objectIds));
  for(const node of [...snapshot.nodes,...snapshot.frames].filter(n=>owners.has(n.id)&&!n.fixed&&n.kind==='component')){
   if(typeof document!=='undefined')await new Promise(resolve=>setTimeout(resolve,0));
   const comp=page.components.find(c=>c.id===node.id)!,sym=getSymbolForComponent(comp,work)!;
   for(const shape of (node.shapes??[]).filter(s=>s.kind==='label'||s.kind==='pin_label')){
    const key=shape.id.slice(comp.id.length+1),field=fields[key];
    if(!field&&!shape.pinId)continue;
    const saved=clone(comp),angle=-comp.rotation*Math.PI/180;
    let best=cost,bestComp:PlacedComponent|undefined;
    search: for(const radius of [2,4,6,8,12,16])for(const [x,y] of [[radius,0],[-radius,0],[0,radius],[0,-radius],[radius,radius],[-radius,radius],[radius,-radius],[-radius,-radius]]){
     Object.assign(comp,clone(saved));
     const dx=(x*Math.cos(angle)-y*Math.sin(angle))*u,dy=(x*Math.sin(angle)+y*Math.cos(angle))*u;
     if(shape.pinId){
      const pin=sym.pins.find(p=>p.id===shape.pinId)!,pos=computePinLabelPosition(saved,sym,pin),cfg=saved.pinLabelPosition;
      comp.pins[pin.id]={...comp.pins[pin.id],labelPosition:{x:pos.x-(cfg?.offsetX??0)+dx,y:pos.y-(cfg?.offsetY??0)+dy,fontSize:pos.fontSize,alignment:pos.anchor,rotation:pos.rotation as 0,visible:pos.visible}};
     }else{
      const cfg=(saved[field!]??{}) as TextFormatConfig;
      (comp as any)[field!]={...cfg,offsetX:(cfg.offsetX??0)+dx,offsetY:(cfg.offsetY??0)+dy};
     }
     node.shapes=componentShapes(comp,sym,work);if(snapshot.nodes.includes(node as any))node.rect=union([...node.shapes.map(s=>s.rect),...('pins' in node?node.pins.map(pin=>({...pinStub(snapshot,pin,node.id),width:0,height:0})):[])]);
     const candidate=validateLayout(snapshot),value=score(candidate);
     if(value<best){best=value;bestComp=clone(comp);if(!value)break search;}
    }
    // Remove trial-added properties when restoring an unmodified placement.
    for(const k of Object.keys(comp))delete (comp as any)[k];
    Object.assign(comp,bestComp??saved);
    node.shapes=componentShapes(comp,sym,work);if(snapshot.nodes.includes(node as any))node.rect=union([...node.shapes.map(s=>s.rect),...('pins' in node?node.pins.map(pin=>({...pinStub(snapshot,pin,node.id),width:0,height:0})):[])]);
    if(bestComp){cost=best;improved=true;}
   }
  }
  for(const node of snapshot.nodes.filter(n=>n.kind==='text'&&owners.has(n.id)&&!(options.lockedIds??page.layoutConstraints?.lockedIds??[]).includes(n.id)&&(!options.selectedIds?.length||options.selectedIds.includes(n.id)))){
   const text=page.texts!.find(t=>t.id===node.id)!,saved=clone(text);let best=cost,bestText=clone(text);
   for(const r of [2,4,8,16,24,32])for(const [dx,dy] of [[r,0],[-r,0],[0,r],[0,-r]]){
    text.x=saved.x+dx*u;text.y=saved.y+dy*u;
    const value=score(validateLayout(snapshotPage(page,work,options)));
    if(value<best){best=value;bestText=clone(text);}
   }
   Object.assign(text,bestText);if(best<cost){cost=best;improved=true;}
  }
  snapshot=snapshotPage(page,work,options);report=validateLayout(snapshot);cost=score(report);
  if(!improved)break;
 }
 return {project:work,report};
}
