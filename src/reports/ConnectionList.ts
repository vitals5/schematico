import type {Project,Wire} from '../model/types';
import {ProjectIndex,displayDesignation,type IndexedPin} from '../model/ProjectIndex';
import {ElectricalNetService} from '../model/ElectricalNetService';
import {isConnectionSymbol} from '../model/ConnectionSymbols';
import {interpretationEnabled} from '../model/ComponentSemantics';
import {connectionRepresentationPairs} from '../model/ConnectionRepresentations';
export interface ConnectionRow {
  key:string; wireId:string; pageId?:string; pageNumber:string; fromPageId?:string; toPageId?:string;
  fromComponentId:string; toComponentId:string; from:string; to:string; number:string;
  potential:string; color:string; crossSection:string; cable:string; core:string;
  lengthMm?:number; kind:'manual'|'autoconnect'|'logical'|'bridge'; netId?:string; targets:string[]; issues:string[];
  representations?: {wireId:string;pageId?:string;kind:ConnectionRow['kind']}[];
}
export const connectionPinLabel=(pin:IndexedPin)=>`${displayDesignation(pin.owner.structure,pin.owner.tag)||pin.owner.component.id}:${pin.label}`;
/** One row per explicit connection, not invented pairwise wires in a branched net. */
export function connectionList(project:Project):ConnectionRow[]{
  const index=new ProjectIndex(project),nets=new ElectricalNetService(index);
  const netByWire=new Map(nets.nets.flatMap(n=>n.connections.map(c=>[c,n] as const)));
  const byScope=new Map<string,typeof index.connections>();
  for(const c of index.connections){const key=JSON.stringify([c.page?.id??null,c.wire.id]);const entries=byScope.get(key)??[];entries.push(c);byScope.set(key,entries);}
  const assignments=new Map<Wire,{cable:string;core:string;color?:string;crossSection?:string;reserve?:boolean}[]>();
  for(const page of project.pages)for(const cable of page.cables??[])for(const core of cable.cores)for(const id of new Set(core.wireIds??[])){
    const matches=byScope.get(JSON.stringify([page.id,id]))??byScope.get(JSON.stringify([null,id]))??[];
    if(matches.length!==1)continue;
    const wire=matches[0].wire,items=assignments.get(wire)??[];
    items.push({cable:cable.bmk,core:core.designation??'',color:core.color,crossSection:core.crossSection??cable.crossSection,reserve:core.reserve});assignments.set(wire,items);
  }
  const netTargets=new Map(nets.nets.map(n=>[n,n.ports.filter(p=>!p.owner.symbol||!isConnectionSymbol(p.owner.symbol)).map(connectionPinLabel).sort()]));
  const rows = index.connections.map((c,i):ConnectionRow=>{
    const w=c.wire,net=netByWire.get(c),items=assignments.get(w)??[],issues:string[]=[];
    if(!c.from||!c.to)issues.push('Anschluss fehlt oder ist mehrdeutig');
    if(!net)issues.push('Elektrisches Netz nicht auflösbar');
    if((byScope.get(JSON.stringify([c.page?.id??null,w.id]))?.length??0)>1)issues.push('Verbindungskennung mehrfach vorhanden');
    if(items.length>1)issues.push('Mehrere Kabel-/Aderzuordnungen');
    if(items.some(a=>a.reserve))issues.push('Reserveader ist verbunden');
    if(w.lengthMm!==undefined&&(!Number.isFinite(w.lengthMm)||w.lengthMm<0))issues.push('Ungültige reale Länge');
    const item=items.length===1?items[0]:undefined;
    if(w.color&&item?.color&&w.color!==item.color)issues.push('Abweichende Farben an Leitung und Ader');
    if(w.crossSection&&item?.crossSection&&w.crossSection!==item.crossSection)issues.push('Abweichende Querschnitte an Leitung und Ader');
    return {key:JSON.stringify([c.page?.id??null,w.id,i]),wireId:w.id,pageId:c.page?.id,pageNumber:c.page?.pageNumber??[...new Set([c.from?.owner.page.pageNumber,c.to?.owner.page.pageNumber].filter(Boolean))].join(' → '),
      fromPageId:c.from?.owner.page.id,toPageId:c.to?.owner.page.id,fromComponentId:w.from.componentId,toComponentId:w.to.componentId,
      from:c.from?connectionPinLabel(c.from):`? ${w.from.componentId}:${w.from.pinId}`,to:c.to?connectionPinLabel(c.to):`? ${w.to.componentId}:${w.to.pinId}`,
      number:w.wireNumber??'',potential:w.potential??'',color:w.color??item?.color??'',crossSection:w.crossSection??item?.crossSection??'',
      cable:items.map(a=>a.cable).join(' | '),core:items.map(a=>a.core).join(' | '),lengthMm:w.lengthMm,
      kind:c.logical?'logical':w.terminalBridge?'bridge':w.isAutoconnect?'autoconnect':'manual',netId:net?.id,targets:net?netTargets.get(net)??[]:[],issues};
  });
  if(interpretationEnabled(project,'consolidateConnections')) {
    const byConnection = new Map(index.connections.map((c,i)=>[c,rows[i]]));
    const removed = new Set<ConnectionRow>();
    for(const pair of connectionRepresentationPairs(index.connections)) {
      const drawing=byConnection.get(pair.drawing)!,logical=byConnection.get(pair.logical)!;
      const conflicts=[...pair.conflicts,...(['cable','core'] as const).filter(k=>drawing[k]&&logical[k]&&drawing[k]!==logical[k])];
      if(conflicts.length) {
        const message=(project.language==='en'?'Conflicting drawing/logical data: ':'Widerspruch zwischen Zeichnung und logischer Verbindung: ')+conflicts.join(', ');
        drawing.issues.push(message); logical.issues.push(message);
        continue;
      }
      // Keep both source identities for inspection and subsequent explicit edits.
      drawing.representations=[drawing,logical].map(r=>({wireId:r.wireId,pageId:r.pageId,kind:r.kind}));
      drawing.issues=[...new Set([...drawing.issues,...logical.issues])];
      for(const k of ['potential','color','crossSection','number','cable','core'] as const)
        if(!drawing[k])drawing[k]=logical[k];
      drawing.lengthMm ??= logical.lengthMm;
      removed.add(logical);
    }
    return rows.filter(r=>!removed.has(r)).sort(sortRows);
  }
  return rows.sort(sortRows);
}
const sortRows=(a:ConnectionRow,b:ConnectionRow)=>a.pageNumber.localeCompare(b.pageNumber,undefined,{numeric:true})||a.from.localeCompare(b.from)||a.key.localeCompare(b.key);
export function filterConnections(rows:ConnectionRow[],search='',pageId='',issuesOnly=false):ConnectionRow[]{
  const words=search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return rows.filter(r=>(!pageId||[r.pageId,r.fromPageId,r.toPageId].includes(pageId))&&(!issuesOnly||r.issues.length>0)&&words.every(w=>[r.from,r.to,r.number,r.wireId,r.pageNumber,r.potential,r.color,r.crossSection,r.cable,r.core,r.kind,...r.issues].join(' ').toLocaleLowerCase().includes(w)));
}
export const connectionColumns=['Blatt','Verbindung','Art','Quelle','Ziel','Potenzial','Farbe','Querschnitt','Kabel','Ader','Reale Länge [mm]','Hinweise'];
export const connectionCells=(r:ConnectionRow)=>[r.pageNumber,r.number||r.wireId,({manual:'Manuell',autoconnect:'Autoconnect',logical:'Logisch',bridge:'Brücke'})[r.kind],r.from,r.to,r.potential,r.color,r.crossSection,r.cable,r.core,r.lengthMm===undefined?'':String(r.lengthMm),r.issues.join('; ')];
export function connectionCsv(rows:ConnectionRow[]):string{
  const quote=(v:string)=>'"'+(/^[=+@\-\t\r]/.test(v)?"'":'')+v.replaceAll('"','""')+'"';
  return '\uFEFF'+[connectionColumns,...rows.map(connectionCells)].map(row=>row.map(quote).join(';')).join('\r\n');
}

export function withConnectionLength(project:Project,row:ConnectionRow,lengthMm:number|undefined):Project{
  if(lengthMm!==undefined&&(!Number.isFinite(lengthMm)||lengthMm<0))throw new Error('Die Länge muss eine endliche, nicht negative Zahl sein.');
  const next=structuredClone(project);
  for(const ref of row.representations??[{wireId:row.wireId,pageId:row.pageId,kind:row.kind}]) {
  const pages=next.pages.filter(p=>p.id===ref.pageId);
  if(ref.pageId&&pages.length!==1)throw new Error('Blatt ist nicht eindeutig.');
  const wires=ref.kind==='logical'?next.logicalConnections??[]:pages[0]?.wires??[];
  const matches=wires.filter(w=>w.id===ref.wireId);
  if(matches.length!==1)throw new Error('Verbindung ist nicht eindeutig.');
  if(lengthMm===undefined)delete matches[0].lengthMm;else matches[0].lengthMm=lengthMm;
  }
  return next;
}
