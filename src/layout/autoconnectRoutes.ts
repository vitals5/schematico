import type {Page,Project,Wire,PlacedComponent,PinDefinition} from '../model/types';
import {getSymbolDefinitions,getSymbolForComponent,getDrawingUnitsPerMm} from '../model/symbols';
import {AutoconnectEngine} from '../model/AutoconnectEngine';
import {snapshotPage} from './geometry';
import {netIds,validateLayout} from './validate';
import {clone,type LayoutSnapshot,type LayoutIssue} from './types';
import {markLayoutAutoconnections} from './draftConnections';
import {sessionDiagnostics} from '../ai/SessionDiagnostics';
type Point={x:number;y:number};type EP=Wire['from'];type Dir=PinDefinition['direction'];
const eps=1e-6;
const coordinate=(p:Point)=>[p.x,p.y].map(n=>Math.round(n/eps)).join(',');
const contact=(ep:EP)=>JSON.stringify([ep.componentId,ep.pinId]);
const direction=(a:Point,b:Point):Dir=>Math.abs(a.x-b.x)<eps?(b.y>a.y?'bottom':'top'):(b.x>a.x?'right':'left');
const opposite:Record<Dir,Dir>={top:'bottom',bottom:'top',left:'right',right:'left'};
/** Compare reachability AND separation of all pre-existing physical contacts. */
export function contactPartition(snapshot:LayoutSnapshot,originals:Set<string>):string {
  const nets=netIds(snapshot),contacts=new Map<string,string>();
  for(const e of snapshot.edges)for(const ep of [e.from,e.to])if(originals.has(ep.componentId))contacts.set(contact(ep),nets.get(e.id)!);
  return JSON.stringify([...new Set(contacts.values())].map(n=>[...contacts].filter(([,id])=>id===n).map(([key])=>key).sort()).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
export interface ConnectionConstruction {
  status:'complete'|'partial';autoconnect:number;routed:number;addedSymbols:number;convertedNets:number;issues:LayoutIssue[];
}
/** Compile already checked orthogonal routes into real library corners/tees.
 * Shared paths are merged ONLY within an existing, uniformly specified net.
 * Every net is atomic: geometry, original contacts and actual detection must pass.
 * This is called for new drafts, never to rewrite user-authored project wiring. */
export function constructAutoconnectRoutes(project:Project,pageId:string,blocked=new Set<string>()) {
  const work=clone(project),page=work.pages.find(p=>p.id===pageId)!;
  const initial=snapshotPage(page,work),originals=new Set(page.components.map(c=>c.id));
  const report:ConnectionConstruction={status:'partial',autoconnect:0,routed:page.wires.length,addedSymbols:0,convertedNets:0,issues:[]};
  const replaced=new Set<string>(),added=new Set<string>();
  if(!validateLayout(initial).valid)return {project:work,report,replaced,added};
  const nets=netIds(initial),groups=new Map<string,Wire[]>();
  for(const w of page.wires){const id=nets.get(w.id)!;groups.set(id,[...(groups.get(id)??[]),w]);}
  const library=getSymbolDefinitions(work).filter(s=>!s.unresolved&&(/^(corner_compact_|t_piece_directed_|cross_junction_bus_)/.test(s.id)));
  const used=new Set(work.pages.flatMap(p=>[p,...p.components,...p.wires,...(p.groups??[]),...(p.texts??[]),...(p.images??[]),...(p.cables??[]),...(p.boxes??[])].map(x=>x.id)));
  const specification=(w:Wire)=>{const {id,from,to,waypoints,isAutoconnect,routingMode,...rest}=w;return JSON.stringify(rest);};
  const reasons:Record<string,string>={group_membership:'Die Leitungsgruppierung benötigt einen eigenen Verbindungsweg.',cross_sheet_reference:'Blattverweise behalten ihre geprüften Anschlüsse.',different_wire_data:'Unterschiedliche Leitungsdaten innerhalb eines Netzes.',routing_budget:'Das Netz überschreitet die Grenze für eine automatische Umwandlung.',coincident_contacts:'Mehrere Geräteanschlüsse liegen auf derselben Position.',junction_space_or_grid:'Für die Verbindungselemente fehlt Rasterabstand oder ein passendes Bibliothekssymbol.',wire_identity_count:'Die Leitungskennungen können bei einer Zusammenfassung nicht vollständig erhalten bleiben.',autoconnect_geometry_rejected:'Die Verbindungselemente passen nicht kollisionsfrei oder werden nicht vollständig von Autoconnect erkannt.'};
  const reject=(wires:Wire[],code:string)=>report.issues.push({type:code,severity:'warning',objectIds:wires.map(w=>w.id),message:reasons[code]??code});
  const u=getDrawingUnitsPerMm(work);
  for(const wires of groups.values()) {
    if(wires.every(w=>w.isAutoconnect))continue;
    if(wires.some(w=>blocked.has(w.id))){reject(wires,'cross_sheet_reference');continue;}
    if(wires.some(w=>specification(w)!==specification(wires[0]))){reject(wires,'different_wire_data');continue;}
    const edges=initial.edges.filter(e=>wires.some(w=>w.id===e.id));
    const segments=edges.flatMap(e=>e.points.slice(1).map((b,i)=>({a:e.points[i],b})));
    if(segments.length>512){reject(wires,'routing_budget');continue;}
    const points=new Map<string,Point>(),ports=new Map<string,EP>();let failed=false;
    const addPoint=(p:Point)=>{const key=coordinate(p);points.set(key,p);return key;};
    for(const edge of edges) {
      for(const p of edge.points)addPoint(p);
      for(const [ep,p] of [[edge.from,edge.points[0]],[edge.to,edge.points.at(-1)!]] as const){
        const key=coordinate(p),old=ports.get(key);if(old&&contact(old)!==contact(ep))failed=true;ports.set(key,ep);
      }
    }
    if(failed){reject(wires,'coincident_contacts');continue;}
    const netMembers=new Set([...ports.values()].map(ep=>ep.componentId));
    const containsMember=(groupId:string,id:string,seen=new Set<string>()):boolean=>{
      if(seen.has(groupId))return false;
      const group=page.groups?.find(g=>g.id===groupId);
      return !!group?.members.some(m=>m.kind==='component'&&m.id===id||m.kind==='group'&&containsMember(m.id,id,new Set([...seen,groupId])));
    };
    if(page.groups?.some(g=>g.members.some(m=>m.kind==='wire'&&wires.some(w=>w.id===m.id))&&![...netMembers].every(id=>containsMember(g.id,id)))){reject(wires,'group_membership');continue;}
    // Intersections of DIFFERENT nets are deliberately never introduced here.
    for(const a of segments)for(const b of segments)if(Math.abs(a.a.x-a.b.x)<eps&&Math.abs(b.a.y-b.b.y)<eps){
      const p={x:a.a.x,y:b.a.y};
      if(p.y>=Math.min(a.a.y,a.b.y)-eps&&p.y<=Math.max(a.a.y,a.b.y)+eps&&p.x>=Math.min(b.a.x,b.b.x)-eps&&p.x<=Math.max(b.a.x,b.b.x)+eps)addPoint(p);
    }
    const adjacency=new Map<string,Set<string>>();
    for(const segment of segments){
      const vertical=Math.abs(segment.a.x-segment.b.x)<eps;
      const on=[...points].filter(([,p])=>vertical?Math.abs(p.x-segment.a.x)<eps&&p.y>=Math.min(segment.a.y,segment.b.y)-eps&&p.y<=Math.max(segment.a.y,segment.b.y)+eps:Math.abs(p.y-segment.a.y)<eps&&p.x>=Math.min(segment.a.x,segment.b.x)-eps&&p.x<=Math.max(segment.a.x,segment.b.x)+eps)
        .sort(([,a],[,b])=>vertical?a.y-b.y:a.x-b.x);
      for(let i=1;i<on.length;i++){const a=on[i-1][0],b=on[i][0];if(a===b)continue;(adjacency.get(a)??adjacency.set(a,new Set()).get(a)!).add(b);(adjacency.get(b)??adjacency.set(b,new Set()).get(b)!).add(a);}
    }
    const critical=new Set([...adjacency].filter(([id,neighbours])=>{
      if(ports.has(id)||neighbours.size!==2)return true;
      const [a,b]=[...neighbours].map(n=>direction(points.get(id)!,points.get(n)!));return a!==opposite[b];
    }).map(([id])=>id));
    const localUsed=new Set(used),fresh=(base:string)=>{let id=base,n=2;while(localUsed.has(id))id=base+'-'+n++;localUsed.add(id);return id;};
    const proposed=clone(page),nodes:PlacedComponent[]=[],anchors=new Map<string,(dir:Dir)=>EP>();
    for(const id of critical){
      const p=points.get(id)!,neighbours=adjacency.get(id)!,dirs=[...neighbours].map(n=>direction(p,points.get(n)!));
      const port=ports.get(id);
      if(port){
        const c=page.components.find(c=>c.id===port.componentId)!,s=getSymbolForComponent(c,work)!,pin=s.pins.find(p=>p.id===port.pinId)!;
        if(dirs.length!==1||AutoconnectEngine.getRotatedPinInfo(c,pin,s).direction!==dirs[0]){failed=true;break;}
        anchors.set(id,()=>port);continue;
      }
      const step=initial.grid.spacing/2;
      if(Math.abs((p.x-initial.grid.origin.x)/step-Math.round((p.x-initial.grid.origin.x)/step))>eps||Math.abs((p.y-initial.grid.origin.y)/step-Math.round((p.y-initial.grid.origin.y)/step))>eps){failed=true;break;}
      const s=library.find(s=>s.pins.length===dirs.length&&dirs.every(d=>s.pins.filter(p=>p.direction===d).length===1));
      if(!s){failed=true;break;}
      const c:PlacedComponent={id:fresh(wires[0].id+'-auto-node-'+nodes.length),symbolId:s.id,bmk:'',functionText:'',rotation:0,
        x:p.x*u-s.width/2,y:p.y*u-s.height/2,pinLabelPosition:{visible:false},higherLevelFunction:page.higherLevel,mountingLocation:page.location,
        pins:Object.fromEntries(s.pins.map(p=>[p.id,{wireIds:[]}]))};
      nodes.push(c);anchors.set(id,d=>({componentId:c.id,pinId:s.pins.find(p=>p.direction===d)!.id}));
    }
    if(failed||page.components.length+nodes.length>200){reject(wires,'junction_space_or_grid');continue;}
    const links:{from:EP;to:EP}[]=[],seen=new Set<string>();
    for(const id of critical)for(const neighbour of adjacency.get(id)!){
      let previous=id,next=neighbour;const startDir=direction(points.get(id)!,points.get(next)!);
      while(!critical.has(next)){const onward=[...adjacency.get(next)!].find(n=>n!==previous)!;previous=next;next=onward;}
      const key=JSON.stringify([id,next].sort());if(seen.has(key))continue;seen.add(key);
      links.push({from:anchors.get(id)!(startDir),to:anchors.get(next)!(direction(points.get(next)!,points.get(previous)!))});
    }
    if(links.length<wires.length){reject(wires,'wire_identity_count');continue;}
    const generated=links.map((ep,i):Wire=>({...wires[0],id:wires[i]?.id??fresh(wires[0].id+'-auto-wire-'+i),...ep,waypoints:[],isAutoconnect:false,routingMode:'auto'}));
    proposed.components.push(...nodes);const oldIds=new Set(wires.map(w=>w.id));proposed.wires=proposed.wires.filter(w=>!oldIds.has(w.id)).concat(generated);
    for(const g of proposed.groups??[])if([...netMembers].every(id=>containsMember(g.id,id)))g.members.push(...nodes.map(c=>({kind:'component' as const,id:c.id})));
    proposed.connectionMode='explicit';
    proposed.layoutConstraints={...proposed.layoutConstraints,protectedComponentIds:proposed.components.map(c=>c.id)};
    for(const c of proposed.components)for(const p of Object.values(c.pins))p.wireIds=[];
    for(const w of proposed.wires){w.isAutoconnect=false;for(const ep of [w.from,w.to])proposed.components.find(c=>c.id===ep.componentId)!.pins[ep.pinId].wireIds!.push(w.id);}
    const candidate=clone(work);candidate.pages[candidate.pages.findIndex(p=>p.id===pageId)]=proposed;
    markLayoutAutoconnections(candidate,proposed);
    const snapshot=snapshotPage(proposed,candidate);
    const checked=validateLayout(snapshot),missing=generated.filter(w=>!w.isAutoconnect);
    if(missing.length||page.wires.some(w=>w.isAutoconnect&&!oldIds.has(w.id)&&!proposed.wires.find(n=>n.id===w.id)?.isAutoconnect)||!checked.valid||contactPartition(snapshot,originals)!==contactPartition(initial,originals)){
      sessionDiagnostics.record('autoconnect_net_rejected',{wireIds:wires.map(w=>w.id),addedNodes:nodes,issues:checked.issues,unavailable:snapshot.edges.filter(e=>missing.some(w=>w.id===e.id))});
      reject(wires,'autoconnect_geometry_rejected');continue;
    }
    Object.assign(page,proposed);for(const id of localUsed)used.add(id);
    for(const w of wires)replaced.add(w.id);for(const c of nodes)added.add(c.id);
    report.convertedNets++;report.addedSymbols+=nodes.length;
  }
  page.connectionMode='explicit';page.layoutConstraints={...page.layoutConstraints,protectedComponentIds:page.components.map(c=>c.id)};
  markLayoutAutoconnections(work,page);
  report.autoconnect=page.wires.filter(w=>w.isAutoconnect).length;report.routed=page.wires.length-report.autoconnect;
  report.status=report.routed?'partial':'complete';report.issues=report.issues.slice(0,40);
  return {project:work,report,replaced,added};
}
