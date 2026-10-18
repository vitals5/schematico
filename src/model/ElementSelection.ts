import { Page, Project } from './types';
import { getSymbolForComponent } from './symbols';

export type ElementSelection = { componentIds: string[]; cableIds: string[]; imageIds?: string[]; boxIds?: string[]; wireIds?: string[]; textIds?: string[] };
export type Point = { x:number; y:number };
export type Bounds = { left:number; top:number; right:number; bottom:number };
export const emptySelection = ():ElementSelection => ({componentIds:[],cableIds:[]});
export const selectionCount = (s:ElementSelection) => s.componentIds.length+s.cableIds.length+(s.imageIds?.length ?? 0)+(s.boxIds?.length ?? 0)+(s.wireIds?.length ?? 0)+(s.textIds?.length ?? 0);
export function normalizeSelection(page:Page,s:ElementSelection):ElementSelection {
  return {
    ...(s.wireIds ? {wireIds:[...new Set(s.wireIds)].filter(id=>page.wires.some(c=>c.id===id))} : {}),
    ...(s.textIds ? {textIds:[...new Set(s.textIds)].filter(id=>page.texts?.some(c=>c.id===id))} : {}),
    componentIds:[...new Set(s.componentIds)].filter(id=>page.components.some(c=>c.id===id)),
    cableIds:[...new Set(s.cableIds)].filter(id=>page.cables?.some(c=>c.id===id)),
    ...(s.boxIds ? {boxIds:[...new Set(s.boxIds)].filter(id=>page.boxes?.some(c=>c.id===id))} : {}),
    ...(s.imageIds ? {imageIds:[...new Set(s.imageIds)].filter(id=>page.images?.some(c=>c.id===id))} : {})};
}
export function componentBounds(page:Page,project:Project,id:string):Bounds|undefined {
  const c=page.components.find(c=>c.id===id),sym=c&&getSymbolForComponent(c,project);if(!c||!sym)return;
  const turn=c.rotation===90||c.rotation===270,w=turn?sym.height:sym.width,h=turn?sym.width:sym.height;
  const x=c.x+sym.width/2,y=c.y+sym.height/2;
  return {left:x-w/2,top:y-h/2,right:x+w/2,bottom:y+h/2};
}
export function cableBounds(page:Page,id:string):Bounds|undefined {
  const c=page.cables?.find(c=>c.id===id);if(!c)return;
  return {left:Math.min(c.start.x,c.end.x),right:Math.max(c.start.x,c.end.x),top:Math.min(c.start.y,c.end.y),bottom:Math.max(c.start.y,c.end.y)};
}
export function imageBounds(page:Page,id:string):Bounds|undefined {
  const c=page.images?.find(c=>c.id===id);if(!c)return;
  return {left:c.x,top:c.y,right:c.x+c.width,bottom:c.y+c.height};
}
export function boxBounds(page:Page,id:string):Bounds|undefined {
  const box=page.boxes?.find(c=>c.id===id);if(!box)return;
  return {left:box.x,top:box.y,right:box.x+box.width,bottom:box.y+box.height};
}
export function textBounds(page:Page,id:string):Bounds|undefined {
  const t=page.texts?.find(t=>t.id===id);if(!t)return;
  const size=t.fontSize??9,w=Math.max(1,...t.text.split('\n').map(line=>line.length*size*.6)),h=size*Math.max(1,t.text.split('\n').length)*1.2;
  const angle=(t.rotation??0)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
  const points=[{x:0,y:-size},{x:w,y:-size},{x:0,y:h-size},{x:w,y:h-size}].map(p=>({x:t.x+p.x*cos-p.y*sin,y:t.y+p.x*sin+p.y*cos}));
  return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};
}
export function selectionBounds(page:Page,project:Project,s:ElementSelection):Bounds|undefined {
  const bounds=[...(s.textIds??[]).map(id=>textBounds(page,id)),...s.componentIds.map(id=>componentBounds(page,project,id)),...s.cableIds.map(id=>cableBounds(page,id)),...(s.imageIds ?? []).map(id=>imageBounds(page,id)),...(s.boxIds ?? []).map(id=>boxBounds(page,id))].filter((b):b is Bounds=>!!b);
  if(!bounds.length)return;
  return {left:Math.min(...bounds.map(b=>b.left)),top:Math.min(...bounds.map(b=>b.top)),right:Math.max(...bounds.map(b=>b.right)),bottom:Math.max(...bounds.map(b=>b.bottom))};
}
/** A selection window contains the symbol bodies; conductor crossings do not
 * pull in components outside the window. Selection itself never edits a page. */
export function elementsInWindow(page:Page,project:Project,a:Point,b:Point):ElementSelection {
  const window={left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)};
  const contains=(v?:Bounds)=>!!v && v.left>=window.left-1e-7&&v.right<=window.right+1e-7&&v.top>=window.top-1e-7&&v.bottom<=window.bottom+1e-7;
  const imageIds=(page.images ?? []).filter(c=>contains(imageBounds(page,c.id))).map(c=>c.id);
  const boxIds=(page.boxes ?? []).filter(c=>contains(boxBounds(page,c.id))).map(c=>c.id);
  const textIds=(page.texts??[]).filter(t=>contains(textBounds(page,t.id))).map(t=>t.id);
  return {...(textIds.length?{textIds}:{}),componentIds:page.components.filter(c=>c.source?.routingUsed!==false && contains(componentBounds(page,project,c.id))).map(c=>c.id),
    cableIds:(page.cables ?? []).filter(c=>contains(cableBounds(page,c.id))).map(c=>c.id),...(imageIds.length?{imageIds}:{}),...(boxIds.length?{boxIds}:{})};
}

export type MoveSnapshot = ReturnType<typeof captureSelectionMove>;
export function captureSelectionMove(page:Page,s:ElementSelection) {
  const ids=new Set(s.componentIds);
  return {texts:(page.texts??[]).filter(t=>s.textIds?.includes(t.id)).map(t=>({id:t.id,x:t.x,y:t.y})),
    components:page.components.filter(c=>ids.has(c.id)).map(c=>({id:c.id,x:c.x,y:c.y})),
    cables:(page.cables ?? []).filter(c=>s.cableIds.includes(c.id)).map(c=>({id:c.id,start:{...c.start},end:{...c.end}})),
    boxes:(page.boxes ?? []).filter(c=>s.boxIds?.includes(c.id)).map(c=>({id:c.id,x:c.x,y:c.y})),
    images:(page.images ?? []).filter(c=>s.imageIds?.includes(c.id)).map(c=>({id:c.id,x:c.x,y:c.y})),
    wires:page.wires.filter(w=>(s.wireIds?.includes(w.id)||ids.has(w.from.componentId)&&ids.has(w.to.componentId))&&w.waypoints!==undefined)
      .map(w=>({id:w.id,waypoints:w.waypoints!.map(p=>({...p}))}))};
}
/** Apply one delta to the original snapshot. Internal bends move with the
 * group; routes to fixed external devices keep their existing route anchors. */
export function translateSelection(page:Page,snapshot:MoveSnapshot,dx:number,dy:number):void {
  for(const p of snapshot.texts??[]){const t=page.texts?.find(t=>t.id===p.id);if(t){t.x=p.x+dx;t.y=p.y+dy;}}
  for(const p of snapshot.boxes ?? []){const c=page.boxes?.find(c=>c.id===p.id);if(c){c.x=p.x+dx;c.y=p.y+dy;}}
  for(const p of snapshot.images ?? []){const c=page.images?.find(c=>c.id===p.id);if(c){c.x=p.x+dx;c.y=p.y+dy;}}
  for(const p of snapshot.components){const c=page.components.find(c=>c.id===p.id);if(c){c.x=p.x+dx;c.y=p.y+dy;}}
  for(const p of snapshot.cables){const c=page.cables?.find(c=>c.id===p.id);if(c){c.start={x:p.start.x+dx,y:p.start.y+dy};c.end={x:p.end.x+dx,y:p.end.y+dy};}}
  for(const p of snapshot.wires){const w=page.wires.find(w=>w.id===p.id);if(w)w.waypoints=p.waypoints.map(q=>({x:q.x+dx,y:q.y+dy}));}
}
