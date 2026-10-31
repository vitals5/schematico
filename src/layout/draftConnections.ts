import type {Project,Page,Wire,PlacedComponent,PinDefinition} from '../model/types';
import {getSymbolById,getSymbolForComponent} from '../model/symbols';
import {AutoconnectEngine} from '../model/AutoconnectEngine';
type Direction=PinDefinition['direction'];
const opposite:Record<Direction,Direction>={top:'bottom',bottom:'top',left:'right',right:'left'};
const symbols=['t_piece_down','t_piece_up','t_piece_left','t_piece_right','corner_top_left','corner_top_right','corner_bottom_left','corner_bottom_right'];
/** Only newly planned, uniformly specified star branches are expanded. Old project
 * wiring and branches crossing explicit group boundaries retain their graph. */
export function prepareDraftConnections(project:Project,page:Page,newDevices:Set<string>,newWires:Set<string>):void {
 const key=(ep:Wire['from'])=>JSON.stringify([ep.componentId,ep.pinId]);
 const ends=new Map<string,Wire[]>();
 for(const w of page.wires)for(const ep of [w.from,w.to]){const k=key(ep);ends.set(k,[...(ends.get(k)??[]),w]);}
 const used=new Set(project.pages.flatMap(p=>[...p.components,...p.wires,...(p.groups??[]),...(p.texts??[]),...(p.images??[]),...(p.boxes??[]),...(p.cables??[]),{id:p.id}].map(n=>n.id)));
 const allocate=(base:string)=>{let id=base;let i=1;while(used.has(id))id=base+'-'+i++;used.add(id);return id;};
 const consumed=new Set<string>();
 const directions=(ep:Wire['from'])=>{const c=page.components.find(c=>c.id===ep.componentId);const s=c&&getSymbolForComponent(c,project),p=s?.pins.find(p=>p.id===ep.pinId);return c&&s&&p?AutoconnectEngine.getRotatedPinInfo(c,p,s).direction:undefined;};
 const specification=(w:Wire)=>{const {id,from,to,waypoints,isAutoconnect,routingMode,...rest}=w;return JSON.stringify(rest);};
 for(const [endpoint,incident]of [...ends].sort(([a],[b])=>a.localeCompare(b))){
  const wires=[...incident].sort((a,b)=>a.id.localeCompare(b.id));
  const [componentId,pinId]=JSON.parse(endpoint) as [string,string],source={componentId,pinId};
  if(wires.length<2||wires.length>8||!newDevices.has(componentId)||wires.some(w=>!newWires.has(w.id)||consumed.has(w.id)||specification(w)!==specification(wires[0])))continue;
  const targets=wires.map(w=>key(w.from)===endpoint?w.to:w.from);
  const direction=directions(source);
  if(!direction||targets.some(t=>!newDevices.has(t.componentId)||t.componentId===componentId||directions(t)!==opposite[direction])||new Set(targets.map(key)).size!==targets.length)continue;
  const memberships=[source,...targets].map(ep=>(page.groups??[]).filter(g=>g.members.some(m=>m.kind==='component'&&m.id===ep.componentId)).map(g=>g.id).sort());
  if(memberships.some(ids=>JSON.stringify(ids)!==JSON.stringify(memberships[0])))continue;
  if(page.groups?.some(g=>g.members.some(m=>m.kind==='wire'&&wires.some(w=>w.id===m.id))&&!memberships[0].includes(g.id)))continue;
  if(page.components.length+targets.length+1>200)continue;
  const along:Direction=direction==='top'||direction==='bottom'?'right':'bottom';
  const requested:Direction[][]=[[opposite[direction],along],...targets.slice(0,-1).map(()=>[opposite[along],along,direction]),[opposite[along],direction]];
  const selected=requested.map(ds=>symbols.map(id=>getSymbolById(id,project)).find(s=>s&&!s.unresolved&&s.pins.length===ds.length&&ds.every(d=>s.pins.filter(p=>p.direction===d).length===1)));
  if(selected.some(s=>!s))continue;
  const nodes:PlacedComponent[]=selected.map((s,i)=>({id:allocate(wires[0].id+'-junction-'+i),symbolId:s!.id,bmk:'',functionText:'',x:0,y:0,rotation:0,higherLevelFunction:page.higherLevel,mountingLocation:page.location,pinLabelPosition:{visible:false},pins:Object.fromEntries(s!.pins.map(p=>[p.id,{wireIds:[]}]))}));
  const at=(i:number,d:Direction)=>({componentId:nodes[i].id,pinId:selected[i]!.pins.find(p=>p.direction===d)!.id});
  const trunks:Wire[]=[];
  const add=(from:Wire['from'],to:Wire['to'])=>trunks.push({...wires[0],id:allocate(wires[0].id+'-trunk-'+trunks.length),from,to,waypoints:[],isAutoconnect:false});
  add(source,at(0,opposite[direction]));
  for(let i=1;i<nodes.length;i++)add(at(i-1,along),at(i,opposite[along]));
  wires.forEach((w,i)=>{const branch=at(i+1,direction);if(key(w.from)===endpoint)w.from=branch;else w.to=branch;consumed.add(w.id);});
  page.components.push(...nodes);page.wires.push(...trunks);
  for(const g of page.groups??[])if(memberships[0].includes(g.id))g.members.push(...nodes.map(n=>({kind:'component' as const,id:n.id})),...trunks.map(w=>({kind:'wire' as const,id:w.id})));
 }
 for(const c of page.components)for(const pin of Object.values(c.pins))pin.wireIds=[];
 for(const w of page.wires)for(const ep of [w.from,w.to])page.components.find(c=>c.id===ep.componentId)?.pins[ep.pinId]?.wireIds?.push(w.id);
}
/** Promote only existing edges which the real autoconnect detector can reproduce.
 * Protected explicit endpoints still prevent alignment from inventing extra nets. */
export function markLayoutAutoconnections(project:Project,page:Page):void {
 const key=(a:Wire['from'],b:Wire['to'])=>JSON.stringify([JSON.stringify([a.componentId,a.pinId]),JSON.stringify([b.componentId,b.pinId])].sort());
 const eligible=new Set(AutoconnectEngine.findAutoconnectPairs(page.components,1e-6,page.grid?page.grid.spacing/4:8,project).map(p=>key({componentId:p.pin1.componentId,pinId:p.pin1.pinId},{componentId:p.pin2.componentId,pinId:p.pin2.pinId})));
 for(const w of page.wires){
  if(!eligible.has(key(w.from,w.to))||w.waypoints?.length)continue;
  w.isAutoconnect=true;
 }
}

/** Align a separable bus section to its inlet corner. Internal geometry is
 * translated as one unit; the caller must validate and roll back on collision. */
export function alignBusInlet(project:Project,page:Page):boolean {
 if(page.groups?.length)return false;
 const components=new Map(page.components.map(c=>[c.id,c]));
 for(const wire of page.wires){
  if(!wire.waypoints?.length)continue;
  const a=components.get(wire.from.componentId)!,b=components.get(wire.to.componentId)!;
  const sa=getSymbolForComponent(a,project),sb=getSymbolForComponent(b,project);
  if(!sa||!sb)continue;
  const forward=sa.id.startsWith('corner')&&sb.id.startsWith('t_piece');
  const backward=sb.id.startsWith('corner')&&sa.id.startsWith('t_piece');
  if(!forward&&!backward)continue;
  const inlet=forward?a:b,bank=forward?b:a,sp=forward?sa:sb,tp=forward?sb:sa;
  const own=sp.pins.find(p=>p.id===(forward?wire.from.pinId:wire.to.pinId)),other=tp.pins.find(p=>p.id===(forward?wire.to.pinId:wire.from.pinId));
  if(!own||!other)continue;
  const p=AutoconnectEngine.getRotatedPinInfo(inlet,own,sp),q=AutoconnectEngine.getRotatedPinInfo(bank,other,tp);
  if(p.direction!==opposite[q.direction])continue;
  const horizontal=p.direction==='left'||p.direction==='right',delta=horizontal?p.worldY-q.worldY:p.worldX-q.worldX;
  if(Math.abs(delta)<1e-6)continue;
  const members=new Set<string>(),queue=[bank.id];
  while(queue.length){const id=queue.pop()!;if(members.has(id))continue;members.add(id);for(const e of page.wires){if(e.id===wire.id)continue;if(e.from.componentId===id)queue.push(e.to.componentId);else if(e.to.componentId===id)queue.push(e.from.componentId);}}
  if(members.has(inlet.id)||[...members].some(id=>components.get(id)?.source))continue;
  for(const id of members){const c=components.get(id)!;if(horizontal)c.y+=delta;else c.x+=delta;}
  for(const e of page.wires)if(members.has(e.from.componentId)&&members.has(e.to.componentId))e.waypoints=e.waypoints?.map(p=>({x:p.x+(horizontal?0:delta),y:p.y+(horizontal?delta:0)}));
  wire.waypoints=[];
  return true;
 }
 return false;
}
