import type {AutomationData, AutomationEntity, AutomationIssue, BusNode} from './Automation';
import {isKnx,isLoxone,knxIndividualAddress,knxGroupAddress,knxDpt} from './BusProfiles';
type Issue = (entity:AutomationEntity,id:string,message:string,binding?:AutomationIssue['binding'])=>void;
/** Planning metadata only: never infer physical wiring or device capability from geometry. */
export function inspectBuildingAutomation(d:AutomationData, issue:Issue):void {
 const node=(id:string)=>d.nodes.filter(n=>n.id===id).length===1?d.nodes.find(n=>n.id===id):undefined;
 const root=(n:BusNode)=>n.interfaceRole==='interface'?n.id:n.interfaceId;
 for(const n of d.nodes){
  const fail=(message:string)=>issue('nodes',n.id,message,n.binding);
  if(isKnx(n.protocol)&&n.address&&!knxIndividualAddress(n.address))fail('KNX: individuelle Adresse muss Bereich.Linie.Gerät sein (0–15.0–15.0–255)');
  if(n.ipAddress&&!validIpv4(n.ipAddress))fail('IP-Adresse muss eine IPv4-Adresse sein');
  if(!isLoxone(n.protocol)){if(n.interfaceId||n.interfaceRole==='interface'||n.interfaceProfile&&n.interfaceProfile!=='generic'||n.capacity!==undefined)fail('Loxone-Schnittstellenfelder nur für Loxone-Teilnehmer verwenden');continue;}
  if(n.interfaceRole!==undefined&&!['device','interface'].includes(n.interfaceRole))fail('Loxone: ungültige Schnittstellenrolle');
  if(n.interfaceProfile!==undefined&&!['generic','air-base'].includes(n.interfaceProfile))fail('Loxone: unbekanntes Schnittstellenprofil');
  if(n.interfaceRole==='interface'){
   if(n.interfaceId)fail('Loxone: eine Schnittstelle darf keiner weiteren Schnittstelle zugeordnet sein');
   if(n.interfaceProfile==='air-base'&&n.protocol!=='Loxone Air')fail('Air-Base-Profil benötigt Loxone Air');
   if(n.capacity!==undefined&&(!Number.isInteger(n.capacity)||n.capacity<1))fail('Teilnehmergrenze muss eine positive ganze Zahl sein');
   const fixed=n.protocol==='Loxone Link'?30:n.protocol==='Loxone Tree'?50:n.interfaceProfile==='air-base'?128:undefined;
   if(fixed!==undefined&&n.capacity!==undefined&&n.capacity>fixed)fail(`Teilnehmergrenze darf die Profilgrenze ${fixed} nicht überschreiten`);
   const limit=n.capacity??fixed,members=d.nodes.filter(v=>v.interfaceId===n.id&&v.protocol===n.protocol&&v.network===n.network);
   if(limit!==undefined&&members.length>limit)fail(`Schnittstelle/Zweig überschreitet die Teilnehmergrenze (${limit})`);
   const ids=new Set([n.id,...members.map(v=>v.id)]),links=d.links.filter(l=>ids.has(l.from)&&ids.has(l.to));
   if(n.protocol!=='Loxone Air'&&links.reduce((sum,l)=>sum+(Number.isFinite(l.lengthM)&&l.lengthM!>=0?l.lengthM!:0),0)>500)fail('Datenleitung überschreitet 500 m je Schnittstelle/Zweig (nur erfasste Längen)');
  }else{
   if(n.interfaceProfile&&n.interfaceProfile!=='generic'||n.capacity!==undefined)fail('Profil und Teilnehmergrenze gehören zur Schnittstelle');
   const r=n.interfaceId&&node(n.interfaceId);
   if(!r||r.interfaceRole!=='interface'||r.protocol!==n.protocol||r.network!==n.network)fail('Loxone: passende Schnittstelle bzw. Tree-Zweig im selben Netz zuordnen');
  }
 }
 for(const l of d.links){const a=node(l.from),b=node(l.to);if(!a||!b)continue;
  const fail=(message:string)=>issue('links',l.id,message,a.binding);
  if(l.lengthM!==undefined&&(!Number.isFinite(l.lengthM)||l.lengthM<0))fail('Kabellänge muss eine endliche, nicht negative Zahl sein');
  if(a.protocol==='IO-Link'&&b.protocol==='IO-Link'&&l.lengthM!==undefined&&l.lengthM>20)fail('IO-Link: maximale Leitungslänge von 20 m pro Punkt-zu-Punkt-Verbindung überschritten (IEC 61131-9)');
  if(isLoxone(a.protocol)&&a.protocol===b.protocol){
   if(!root(a)||root(a)!==root(b))fail('Loxone: Schnittstellen bzw. Tree-Zweige dürfen nicht verbunden werden');
   if(a.protocol==='Loxone Air'){
    if(l.lengthM!==undefined||l.fromPort||l.toPort)fail('Air ist eine Funkzuordnung: keine Kabelports oder Kabellänge eintragen');
    if((a.interfaceRole==='interface')===(b.interfaceRole==='interface'))fail('Air-Zuordnung muss zwischen Schnittstelle und zugeordnetem Gerät liegen');
   }
   if(a.protocol==='Loxone Link')for(const n of [a,b]){const degree=d.links.filter(v=>v.from===n.id||v.to===n.id).length;if(degree>(n.interfaceRole==='interface'?1:2))fail('Loxone Link benötigt eine Linie ab der Schnittstelle, keine Verzweigung');}
  }
 }
 // Forest check for documented physical bus segments without loops. Ethernet rings are not governed by this rule.
 for(const protocol of ['KNX TP','Loxone Link','Loxone Tree','Modbus RTU','PROFIBUS DP','DALI','IO-Link']){
  const parent=new Map<string,string>();const find=(id:string):string=>{let p=id;while(parent.has(p)&&parent.get(p)!==p)p=parent.get(p)!;return p;};
  for(const l of d.links){const a=node(l.from),b=node(l.to);if(!a||!b||a.protocol!==protocol||b.protocol!==protocol||a.network!==b.network||a.id===b.id)continue;const x=find(a.id),y=find(b.id);if(x===y)issue('links',l.id,`${protocol}: geschlossener Ring in der dokumentierten Busverkabelung`);else parent.set(x,y);}
 }
 // DALI: maximum 300 m total documented bus cable length per network (IEC 62386).
 const daliNets=new Map<string,{links:typeof d.links;sum:number}>();
 for(const l of d.links){const a=node(l.from),b=node(l.to);if(!a||!b||a.protocol!=='DALI'||b.protocol!=='DALI'||a.network!==b.network)continue;const entry=daliNets.get(a.network)??{links:[],sum:0};entry.links.push(l);if(l.lengthM!==undefined&&Number.isFinite(l.lengthM)&&l.lengthM>=0)entry.sum+=l.lengthM;daliNets.set(a.network,entry);}
 for(const entry of daliNets.values())if(entry.sum>300)for(const l of entry.links)issue('links',l.id,'DALI: dokumentierte Gesamtleitungslänge überschreitet 300 m (IEC 62386)',node(l.from)?.binding);
 for(const g of d.knxGroups){
  const fail=(message:string)=>issue('knxGroups',g.id,message);
  const address=knxGroupAddress(g.address);
  if(!g.name.trim()||!g.network.trim())fail('KNX-Gruppenname und Netz fehlen');
  if(address===undefined)fail('KNX-Gruppenadresse: Hauptgruppe 0–31, Mittelgruppe 0–7, Untergruppe 0–255 bzw. zweistufig 0–2047; Null ist reserviert');
  if(address!==undefined&&d.knxGroups.some(v=>v.id!==g.id&&v.network===g.network&&knxGroupAddress(v.address)===address))fail('KNX-Gruppenadresse ist im selben Netz doppelt vorhanden (auch bei anderer Schreibweise)');
  const types=new Set([g.dpt,...d.knxObjects.filter(o=>o.groupId===g.id).map(o=>o.dpt)].filter(Boolean).map(knxDpt).filter(Boolean));
  if(types.size>1)fail('KNX-Gruppenadresse besitzt widersprüchliche Datenpunkttypen ihrer Kommunikationsobjekte');
  if(g.dpt&&!knxDpt(g.dpt))fail('KNX-Datenpunkttyp im Format 1.001 bzw. DPT-1.001 eingeben');
 }
 for(const o of d.knxObjects){const n=node(o.nodeId),g=d.knxGroups.filter(g=>g.id===o.groupId),group=g.length===1?g[0]:undefined;
  const fail=(message:string)=>issue('knxObjects',o.id,message,n?.binding);
  if(!n||!isKnx(n.protocol))fail('Kommunikationsobjekt benötigt einen eindeutigen KNX-Teilnehmer');
  if(!group||group.network!==n?.network)fail('Kommunikationsobjekt benötigt eine Gruppenadresse im selben KNX-Netz');
  if(!/^\d+$/.test(o.number)||!Number.isSafeInteger(Number(o.number)))fail('KNX-Objektnummer muss eine nicht negative ganze Zahl sein');
  if(!['send','receive','both'].includes(o.direction))fail('KNX-Kommunikationsrichtung ist ungültig');
  if(o.dpt&&!knxDpt(o.dpt))fail('KNX-Datenpunkttyp im Format 1.001 bzw. DPT-1.001 eingeben');
  const peers=d.knxObjects.filter(v=>v.nodeId===o.nodeId&&Number(v.number)===Number(o.number));
  if(peers.some(v=>v.id!==o.id&&v.groupId===o.groupId))fail('KNX-Objekt ist derselben Gruppenadresse mehrfach zugeordnet');
  // A physical communication object has one DPT, even if linked to several groups.
  const types=new Set(peers.flatMap(v=>[v.dpt,d.knxGroups.find(g=>g.id===v.groupId)?.dpt]).filter((v):v is string=>!!v).map(knxDpt).filter(Boolean));
  if(types.size>1||group?.dpt&&o.dpt&&knxDpt(group.dpt)!==knxDpt(o.dpt))fail('KNX-Datenpunkttypen von Kommunikationsobjekt und Gruppenadresse widersprechen sich');
 }
}
function validIpv4(value:string):boolean {const p=value.split('.');return p.length===4&&p.every(v=>/^\d{1,3}$/.test(v)&&Number(v)<=255);}
