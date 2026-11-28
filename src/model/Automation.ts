import type {Project} from './types';
import {busProtocols,isKnx,sharedBusPort,knxIndividualAddress,type BusProtocol} from './BusProfiles';
import {inspectBuildingAutomation} from './BuildingAutomation';
import {ProjectIndex} from './ProjectIndex';
import type {ConnectorPinAddress} from './Connectors';
export interface PlcController {id:string;bmk:string;plant:string;location:string;description:string}
export interface PlcModule {id:string;controllerId:string;rack:string;slot:string;bmk:string;description:string}
export interface PlcChannel {id:string;moduleId:string;number:string;kind:'DI'|'DO'|'AI'|'AO';address:string;signalText:string;symbolicName?:string;dataType?:string;reserve:boolean;signal?:ConnectorPinAddress;supply?:ConnectorPinAddress;common?:ConnectorPinAddress}
export interface BusNode {id:string;name:string;network:string;protocol:BusProtocol;address:string;ipAddress?:string;interfaceRole?:'device'|'interface';interfaceId?:string;interfaceProfile?:'generic'|'air-base';capacity?:number;controllerId?:string;binding?:{pageId:string;componentId:string}}
export interface BusLink {id:string;from:string;to:string;fromPort:string;toPort:string;lengthM?:number}
export interface KnxGroup {id:string;network:string;name:string;address:string;dpt:string;description?:string;xmlSource?:import('./KnxXmlExchange').KnxXmlSource}
export interface KnxObject {id:string;nodeId:string;number:string;name:string;groupId:string;dpt:string;direction:'send'|'receive'|'both'}
export interface AutomationData {controllers:PlcController[];modules:PlcModule[];channels:PlcChannel[];nodes:BusNode[];links:BusLink[];knxGroups:KnxGroup[];knxObjects:KnxObject[]}
export type AutomationEntity=keyof AutomationData;
export type AutomationEdit={kind:'save';entity:AutomationEntity;value:PlcController|PlcModule|PlcChannel|BusNode|BusLink|KnxGroup|KnxObject}|{kind:'remove';entity:AutomationEntity;id:string};
export interface AutomationIssue {id:string;domain:'plc'|'bus';entity:AutomationEntity;recordId:string;message:string;binding?:ConnectorPinAddress|{pageId:string;componentId:string}}
export const automationData=(p:Project):AutomationData=>({controllers:p.automation?.controllers??[],modules:p.automation?.modules??[],channels:p.automation?.channels??[],nodes:p.automation?.nodes??[],links:p.automation?.links??[],knxGroups:p.automation?.knxGroups??[],knxObjects:p.automation?.knxObjects??[]});
export const controllerLabel=(c:PlcController)=>[c.plant?'='+c.plant.replace(/^=+/,''):'',c.location?'+'+c.location.replace(/^\++/,''):'',c.bmk].join('');
/** Recognised IEC/German I/O aliases share a bit range; other addresses remain symbolic. */
export function plcAddress(value:string):{area:'I'|'Q';start:number;end:number}|undefined{
 const m=value.trim().toUpperCase().match(/^%?([IEQA])(?:(B|W|D)(\d+)|(\d+)(?:\.([0-7]))?)$/);if(!m)return;
 const area=m[1]==='I'||m[1]==='E'?'I':'Q',byte=Number(m[3]??m[4]),width=m[2]?({B:8,W:16,D:32})[m[2] as 'B'|'W'|'D']:m[5]!==undefined?1:8;
 if(!Number.isSafeInteger(byte)||byte<0||byte>1000000)return;const start=byte*8+Number(m[5]??0);return {area,start,end:start+width};
}
export function inspectAutomation(project:Project,index=new ProjectIndex(project)):AutomationIssue[]{
 const d=automationData(project),issues:AutomationIssue[]=[];
 const issue=(entity:AutomationEntity,id:string,message:string,binding?:AutomationIssue['binding'])=>issues.push({id:JSON.stringify([entity,id,message]),domain:['nodes','links','knxGroups','knxObjects'].includes(entity)?'bus':'plc',entity,recordId:id,message,binding});
 const one=<T extends {id:string}>(items:T[],id:string)=>items.filter(v=>v.id===id).length===1?items.find(v=>v.id===id):undefined;
 const portKey=(a:ConnectorPinAddress)=>JSON.stringify([a.pageId,a.componentId,a.pinId]);
 const pin=(a:ConnectorPinAddress)=>{const e=index.component(a.componentId,a.pageId);return !!e&&!!index.pin(e,a.pinId)?.definition&&index.componentsById.get(a.componentId)?.length===1;};
 for(const entity of Object.keys(d) as AutomationEntity[])for(const r of d[entity])if(!r.id||d[entity].filter(v=>v.id===r.id).length!==1)issue(entity,r.id,'Kennung fehlt oder ist mehrfach vorhanden');
 for(const c of d.controllers){if(!c.bmk.trim())issue('controllers',c.id,'CPU-BMK fehlt');if(d.controllers.some(v=>v.id!==c.id&&controllerLabel(v)===controllerLabel(c)))issue('controllers',c.id,'CPU-Kennzeichnung im Strukturkontext ist mehrfach vorhanden');}
 for(const m of d.modules){if(!one(d.controllers,m.controllerId))issue('modules',m.id,'CPU fehlt oder ist mehrdeutig');if(!m.slot.trim()||!m.bmk.trim())issue('modules',m.id,'Steckplatz oder Baugruppen-BMK fehlt');if(d.modules.some(v=>v.id!==m.id&&v.controllerId===m.controllerId&&v.rack===m.rack&&v.slot===m.slot))issue('modules',m.id,'Rack/Steckplatz ist innerhalb der CPU mehrfach belegt');}
 const overlap=new Set<PlcChannel>(),groups=new Map<string,PlcChannel[]>();
 for(const c of d.channels){const m=one(d.modules,c.moduleId);if(!m||!c.address.trim())continue;const items=groups.get(m.controllerId)??[];items.push(c);groups.set(m.controllerId,items);}
 for(const channels of groups.values()){
  const symbolic=new Map<string,PlcChannel>();
  for(const c of channels.filter(c=>!plcAddress(c.address))){const key=c.address.trim().toUpperCase(),old=symbolic.get(key);if(old){overlap.add(old);overlap.add(c);}symbolic.set(key,c);}
  for(const area of ['I','Q']){let end=-1,owner:PlcChannel|undefined;for(const item of channels.map(c=>({c,a:plcAddress(c.address)})).filter((v):v is {c:PlcChannel;a:NonNullable<ReturnType<typeof plcAddress>>}=>!!v.a&&v.a.area===area).sort((a,b)=>a.a.start-b.a.start)){if(item.a.start<end&&owner){overlap.add(owner);overlap.add(item.c);}if(item.a.end>end){end=item.a.end;owner=item.c;}}}
 }
 for(const c of d.channels){const module=one(d.modules,c.moduleId),binding=c.signal;
  if(!module)issue('channels',c.id,'Baugruppe fehlt oder ist mehrdeutig',binding);
  if(!c.number.trim()||!['DI','DO','AI','AO'].includes(c.kind))issue('channels',c.id,'Kanalnummer oder Kanaltyp ist ungültig',binding);
  if(d.channels.some(v=>v.id!==c.id&&v.moduleId===c.moduleId&&v.kind===c.kind&&v.number===c.number))issue('channels',c.id,'Kanalnummer ist für diesen Kanaltyp in der Baugruppe mehrfach vorhanden',binding);
  if(c.reserve&&(c.signal||c.supply||c.common))issue('channels',c.id,'Reservekanal besitzt Anschlusszuordnungen',binding);
  for(const role of ['signal','supply','common'] as const)if(c[role]&&!pin(c[role]!))issue('channels',c.id,`${role}: Bibliotheksanschluss fehlt oder ist mehrdeutig`,c[role]);
  const ports=[c.signal,c.supply,c.common].filter(Boolean).map(a=>portKey(a!));if(new Set(ports).size!==ports.length)issue('channels',c.id,'Signal, Versorgung und Bezug dürfen nicht derselbe Anschluss sein',binding);
  if(c.signal&&d.channels.some(v=>v.id!==c.id&&v.signal&&portKey(v.signal)===portKey(c.signal!)))issue('channels',c.id,'Signalanschluss ist mehreren Kanälen zugeordnet',binding);
  const a=plcAddress(c.address);if(a&&a.area!==(c.kind==='DI'||c.kind==='AI'?'I':'Q'))issue('channels',c.id,'Adressbereich passt nicht zur Ein-/Ausgangsrichtung',binding);
  if(!a&&/^%?[IEQA](?:\d|[BWD]\d)/i.test(c.address.trim()))issue('channels',c.id,'Numerische E/A-Adresse ist ungültig',binding);
  if(overlap.has(c))issue('channels',c.id,'E/A-Adresse überschneidet sich innerhalb der CPU',binding);
 }
 for(const n of d.nodes){if(!n.name.trim()||!n.network.trim()||!busProtocols.includes(n.protocol))issue('nodes',n.id,'Busname, Netz oder Protokoll fehlt/ist ungültig',n.binding);
  if(n.controllerId&&!one(d.controllers,n.controllerId))issue('nodes',n.id,'Zugeordnete CPU fehlt',n.binding);
  if(n.binding&&(!index.component(n.binding.componentId,n.binding.pageId)||index.componentsById.get(n.binding.componentId)?.length!==1))issue('nodes',n.id,'Busgerät in der Zeichnung fehlt oder ist mehrdeutig',n.binding);
  if(n.protocol==='Modbus RTU'&&n.address&&(!/^\d+$/.test(n.address)||Number(n.address)<1||Number(n.address)>247))issue('nodes',n.id,'Modbus-RTU-Adresse muss zwischen 1 und 247 liegen',n.binding);
  if(n.protocol==='PROFIBUS DP'&&n.address&&(!/^\d+$/.test(n.address)||Number(n.address)<0||Number(n.address)>126))issue('nodes',n.id,'PROFIBUS-DP-Adresse muss zwischen 0 und 126 liegen (127 ist Broadcast)',n.binding);
  if(n.protocol==='DALI'&&n.address&&(!/^\d+$/.test(n.address)||Number(n.address)<0||Number(n.address)>63))issue('nodes',n.id,'DALI-Kurzadresse muss zwischen 0 und 63 liegen (IEC 62386)',n.binding);
  const numericAddr=n.protocol==='Modbus RTU'||n.protocol==='PROFIBUS DP'||n.protocol==='DALI';
  if(d.nodes.some(v=>v.id!==n.id&&v.network===n.network&&(v.protocol===n.protocol||isKnx(v.protocol)&&isKnx(n.protocol))&&((n.address.trim()&&(isKnx(n.protocol)?knxIndividualAddress(v.address)===knxIndividualAddress(n.address):numericAddr?(/^\d+$/.test(v.address.trim())&&/^\d+$/.test(n.address.trim())&&Number(v.address)===Number(n.address)):v.address.trim().toLowerCase()===n.address.trim().toLowerCase()))||v.name===n.name)))issue('nodes',n.id,'Busname oder Adresse im selben Netz ist mehrfach vergeben',n.binding);
  if(n.ipAddress?.trim()&&d.nodes.some(v=>v.id!==n.id&&v.network===n.network&&(v.protocol===n.protocol||isKnx(v.protocol)&&isKnx(n.protocol))&&v.ipAddress?.trim()===n.ipAddress!.trim()))issue('nodes',n.id,'IP-Adresse im selben Netz ist mehrfach vergeben',n.binding);
 }
 for(const l of d.links){const a=one(d.nodes,l.from),b=one(d.nodes,l.to);
  if(!a||!b||l.from===l.to)issue('links',l.id,'Busverbindung benötigt zwei eindeutige verschiedene Teilnehmer');
  else if(a.network!==b.network||a.protocol!==b.protocol)issue('links',l.id,'Teilnehmer gehören nicht zum selben Netz/Protokoll');
  if(a&&!sharedBusPort(a.protocol)&&d.links.some(v=>v.id!==l.id&&[[l.from,l.fromPort],[l.to,l.toPort]].some(([node,port])=>v.from===node&&v.fromPort===port||v.to===node&&v.toPort===port)))issue('links',l.id,'Busport ist mehrfach belegt');
  if(a?.protocol!=='Loxone Air'&&(!l.fromPort.trim()||!l.toPort.trim()))issue('links',l.id,'Busportbezeichnungen fehlen');
  if(d.links.some(v=>v.id!==l.id&&(v.from===l.from&&v.to===l.to&&v.fromPort===l.fromPort&&v.toPort===l.toPort||v.to===l.from&&v.from===l.to&&v.toPort===l.fromPort&&v.fromPort===l.toPort)))issue('links',l.id,'Busverbindung ist doppelt vorhanden');
 }
 inspectBuildingAutomation(d,issue);
 return [...new Map(issues.map(i=>[i.id,i])).values()];
}
export function editAutomation(project:Project,edit:AutomationEdit):Project{
 const next=structuredClone(project),d=automationData(next);next.automation=d;
 if(edit.kind==='save'){const value=structuredClone(edit.value) as any;for(const key of Object.keys(value))if(typeof value[key]==='string')value[key]=value[key].trim();if(!value.id)throw new Error('Kennung fehlt.');const entries=d[edit.entity] as {id:string}[];if(entries.filter(v=>v.id===value.id).length>1)throw new Error('Mehrdeutige Kennung.');const at=entries.findIndex(v=>v.id===value.id);if(at<0)entries.push(value);else entries[at]=value;
 }else{const removedModules=new Set(edit.entity==='controllers'?d.modules.filter(m=>m.controllerId===edit.id).map(m=>m.id):edit.entity==='modules'?[edit.id]:[]);if(d[edit.entity].filter(v=>v.id===edit.id).length!==1)throw new Error('Datensatz ist nicht eindeutig.');(d as any)[edit.entity]=d[edit.entity].filter(v=>v.id!==edit.id);
  if(edit.entity==='controllers'){d.modules=d.modules.filter(m=>m.controllerId!==edit.id);d.nodes=d.nodes.map(n=>{if(n.controllerId===edit.id)delete n.controllerId;return n;});}
  if(edit.entity==='controllers'||edit.entity==='modules')d.channels=d.channels.filter(c=>!removedModules.has(c.moduleId));
  if(edit.entity==='nodes'){d.links=d.links.filter(l=>l.from!==edit.id&&l.to!==edit.id);d.knxObjects=d.knxObjects.filter(o=>o.nodeId!==edit.id);d.nodes=d.nodes.map(n=>{if(n.interfaceId===edit.id)delete n.interfaceId;return n;});}
  if(edit.entity==='knxGroups')d.knxObjects=d.knxObjects.filter(o=>o.groupId!==edit.id);
 }
 const before=new Set(inspectAutomation(project).map(i=>i.id)),introduced=inspectAutomation(next).filter(i=>!before.has(i.id));if(introduced.length)throw new Error(introduced.map(i=>i.message).join('\n'));return next;
}
