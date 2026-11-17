import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import type {Project} from './types';
import {automationData,inspectAutomation,plcAddress,type PlcController,type PlcModule,type PlcChannel} from './Automation';

const ROLE='AutomationProjectConfigurationRoleClassLib/';
const FACE='AutomationProjectConfigurationInterfaceClassLib/';
const LIMIT=4*1024*1024;
const serializer=new XMLSerializer();
export type AmlEntity='controllers'|'modules'|'channels';
export interface AmlRecordMap {entity:AmlEntity;localId:string;nativeId:string;ownerId?:string;number?:string;kind?:PlcChannel['kind'];interfaceName?:string;tagOwnerId?:string;tagName?:string;baseline:Record<string,string|boolean|undefined>}
export interface AutomationMlSource {version:1;xml:string;maps:AmlRecordMap[]}
export interface AmlIssue {nativeId?:string;message:string}
export interface AmlChange {entity:AmlEntity;id:string;name:string;kind:'add'|'update';fields:{key:string;before:string;after:string}[]}
export interface AmlPreview {next?:Project;sourceChanged:boolean;changes:AmlChange[];unchanged:number;issues:AmlIssue[];notes:string[]}
export interface AmlExport {xml?:string;issues:AmlIssue[];notes:string[]}
const children=(e:Element,name?:string)=>Array.from(e.childNodes).filter(n=>n.nodeType===1&&((n as Element).namespaceURI??'')===(e.namespaceURI??'')&&(!name||(n as Element).localName===name)) as Element[];
const direct=(e:Element,name:string)=>children(e,name)[0];
const id=(e:Element)=>e.getAttribute('ID')??'';
const normalId=(value:string)=>/^[{]?[0-9a-f]{8}-[0-9a-f-]{27,}[}]?$/i.test(value)?value.replace(/[{}]/g,'').toLowerCase():value;
const xmlTrue=(value:string)=>['true','1'].includes(value.trim().toLowerCase());
const name=(e:Element)=>e.getAttribute('Name')??'';
function document(xml:string):Document {
 if(new TextEncoder().encode(xml).length>LIMIT||/<!DOCTYPE\b|<!ENTITY\b/i.test(xml))throw new Error('AutomationML: höchstens 4 MiB, keine DTD-/Entity-Deklarationen.');
 let invalid=false;const doc=new DOMParser({errorHandler:{warning:()=>{invalid=true;},error:()=>{invalid=true;},fatalError:()=>{invalid=true;}}}).parseFromString(xml.replace(/^\uFEFF/,''),'text/xml');
 const root=doc.documentElement;if(invalid||root?.localName!=='CAEXFile'||!['2.15','3.0'].includes(root.getAttribute('SchemaVersion')??''))throw new Error('Wohlgeformte CAEX-Datei mit SchemaVersion 2.15 oder 3.0 erwartet.');
 if(root.namespaceURI&&root.namespaceURI!=='http://www.dke.de/CAEX')throw new Error('Nicht unterstützter CAEX-Namensraum.');
 return doc;
}
const semantics:Record<string,string>={'PlantDesignation IEC':'IEC 81346-1:2009-07#5.3 - Function-oriented structure','LocationIdentifier IEC':'IEC 81346-1:2009-07#5.5 - Location-oriented structure','ProductDesignation IEC':'IEC 81346-1:2009-07#5.4 - Product-oriented structure'};
const attr=(e:Element,key:string)=>children(e,'Attribute').find(a=>name(a).toLowerCase()===key.toLowerCase())??(semantics[key]?children(e,'Attribute').find(a=>children(a,'RefSemantic').some(s=>(s.getAttribute('CorrespondingAttributePath')??'').startsWith(semantics[key].split(' - ')[0]))):undefined);
const scalar=(a?:Element)=>a?(direct(a,'Value')??direct(a,'DefaultValue'))?.textContent??'':'';
const parentElement=(e:Element):Element|undefined=>e.parentNode?.nodeType===1?e.parentNode as Element:undefined;
function ancestor(e:Element,predicate:(v:Element)=>boolean):Element|undefined {for(let p=parentElement(e);p;p=parentElement(p))if(predicate(p))return p;}
const identity=(m:Pick<AmlRecordMap,'entity'|'nativeId'|'number'|'kind'>)=>JSON.stringify([m.entity,normalId(m.nativeId),m.entity==='channels'?m.number:'',m.entity==='channels'?m.kind:'']);
const dataWidth=(value:string)=>({BOOL:1,BYTE:8,WORD:16,INT:16,UINT:16,DWORD:32,DINT:32,UDINT:32,REAL:32} as Record<string,number>)[value.toUpperCase()];
const show=(value:unknown)=>value===undefined?'':String(value);
function pathParts(path:string):string[]|undefined {
 const parts:string[]=[];let value='',bracket=false,escaped=false;
 for(const ch of path){if(escaped){value+=ch;escaped=false;}else if(ch==='\\')escaped=true;else if(ch==='['&&!bracket)bracket=true;else if(ch===']'&&bracket)bracket=false;else if(ch===':'&&!bracket){parts.push(value);value='';}else value+=ch;}
 if(bracket||escaped)return;parts.push(value);return parts.length===2?parts:undefined;
}
function endpoint(owner:string,face:string):string {const part=(v:string)=>'['+v.replaceAll('\\','\\\\').replaceAll('[','\\[').replaceAll(']','\\]')+']';return part(owner)+':'+part(face);}
function parseModel(xml:string){
 const doc=document(xml),root=doc.documentElement,issues:AmlIssue[]=[],notes:string[]=[];if(children(root,'ExternalReference').length)notes.push('Externe Bibliotheksdateien werden nicht nachgeladen. Die ursprünglichen Verweise bleiben erhalten.');
 const classes=new Map<string,Element>(),units=new Map<string,Element>(),instances:Element[]=[];
 const addClasses=(node:Element,path:string,map:Map<string,Element>,tag:string)=>{for(const c of children(node,tag)){const key=path+'/'+name(c);if(map.has(key))throw new Error('Mehrdeutige AML-Klassendefinition: '+key);map.set(key,c);addClasses(c,key,map,tag);}};
 for(const lib of children(root)){if(['RoleClassLib','InterfaceClassLib'].includes(lib.localName))addClasses(lib,name(lib),classes,lib.localName==='RoleClassLib'?'RoleClass':'InterfaceClass');if(lib.localName==='SystemUnitClassLib')addClasses(lib,name(lib),units,'SystemUnitClass');}
 const derives=(path:string,target:string,seen=new Set<string>()):boolean=>{if(path===target)return true;if(seen.has(path)||seen.size>32)return false;seen.add(path);const c=classes.get(path);if(!c)return false;const base=c.getAttribute('RefBaseClassPath')??'',relative=path.slice(0,path.lastIndexOf('/')+1)+base;return derives(base,target,seen)||derives(relative,target,new Set(seen));};
 const base=(e:Element)=>(['ExternalInterface','InterfaceClass'].includes(e.localName)?classes:units).get(e.getAttribute('RefBaseSystemUnitPath')??e.getAttribute('RefBaseClassPath')??'');
 const inherits=(e:Element,fn:(v:Element)=>boolean,seen=new Set<Element>()):boolean=>{if(seen.has(e)||seen.size>32)return false;seen.add(e);if(fn(e))return true;const b=base(e);return !!b&&inherits(b,fn,seen);};
 const role=(e:Element,key:string)=>inherits(e,v=>children(v,'SupportedRoleClass').some(r=>derives(r.getAttribute('RefRoleClassPath')??'',ROLE+key))||children(v,'RoleRequirements').some(r=>derives(r.getAttribute('RefBaseRoleClassPath')??'',ROLE+key)));
 const face=(e:Element,key:string)=>derives(e.getAttribute('RefBaseClassPath')??'',FACE+key);
 const attribute=(e:Element,key:string):Element|undefined=>{let p:Element|undefined=e;const seen=new Set<Element>();while(p&&!seen.has(p)&&seen.size<32){seen.add(p);const a=attr(p,key);if(a)return a;p=base(p);}return;};
 const value=(e:Element,key:string)=>scalar(attribute(e,key));
 const walk=(e:Element,depth=0)=>{if(depth>64)throw new Error('AML-Instanzhierarchie ist tiefer als 64 Ebenen.');for(const child of children(e,'InternalElement')){instances.push(child);if(instances.length>15000)throw new Error('Zu viele AML-Instanzen.');walk(child,depth+1);}};
 for(const hierarchy of children(root,'InstanceHierarchy'))walk(hierarchy);
 const ids=new Map<string,Element>();for(const e of instances){const key=normalId(id(e));if(!key)notes.push('Strukturobjekt ohne ID bleibt in der Vorlage: '+name(e));else if(ids.has(key))issues.push({nativeId:id(e),message:'Doppelte CAEX-Instanz-ID.'});else ids.set(key,e);}
 const cpus=instances.filter(e=>role(e,'DeviceItem')&&value(e,'DeviceItemType').toLowerCase()==='cpu');
 for(const cpu of cpus)if(!id(cpu))issues.push({message:'CPU benötigt eine native CAEX-ID.'});
 for(const cpu of cpus)if(xmlTrue(scalar(attr(attribute(cpu,'DeviceItemType')!,'Customized'))))issues.push({nativeId:id(cpu),message:'Herstellerspezifische CPU-Klassifizierung kann nicht eindeutig zugeordnet werden.'});
 const isCpu=(e:Element)=>cpus.includes(e);
 for(const e of Array.from(root.getElementsByTagName('*')).filter(e=>e.localName==='ExternalInterface'&&ancestor(e,p=>p.localName==='InstanceHierarchy')))if(face(e,'Channel')&&parentElement(e)?.localName!=='InternalElement')issues.push({message:'Verschachtelte Channel-Schnittstellen werden nicht abgeflacht. Materialisierte Kanäle im DeviceItem exportieren.'});
 const interfaces=instances.flatMap(e=>children(e,'ExternalInterface').map(f=>({owner:e,node:f}))),endpoints=new Map<string,{owner:Element;node:Element}[]>();
 const key=(owner:string,faceName:string)=>JSON.stringify([normalId(owner),faceName]);
 for(const e of instances){const b=base(e);if(b&&children(b,'ExternalInterface').some(f=>face(f,'Channel')&&!children(e,'ExternalInterface').some(c=>name(c)===name(f))))issues.push({nativeId:id(e),message:'Geerbte Kanäle müssen für diesen Import auf Instanzebene materialisiert exportiert werden.'});}
 for(const f of interfaces){if(!name(f.node))issues.push({nativeId:id(f.owner),message:'Externe Schnittstelle hat keinen Namen.'});const k=key(id(f.owner),name(f.node));endpoints.set(k,[...endpoints.get(k)??[],f]);}
 for(const [k,items] of endpoints)if(items.length>1)issues.push({nativeId:id(items[0].owner),message:'Schnittstellenname innerhalb einer Instanz ist mehrfach vorhanden.'});
 const resolve=(text:string)=>{const parts=pathParts(text);if(parts){const matches=endpoints.get(key(parts[0],parts[1]));return matches?.length===1?matches[0]:undefined;}const byId=interfaces.filter(f=>id(f.node)&&normalId(id(f.node))===normalId(text));return byId.length===1?byId[0]:undefined;};
 const links=new Map<Element,{owner:Element;node:Element}[]>();
 for(const link of Array.from(root.getElementsByTagName('*')).filter(e=>e.localName==='InternalLink'&&ancestor(e,p=>p.localName==='InstanceHierarchy'))){const a=resolve(link.getAttribute('RefPartnerSideA')??''),b=resolve(link.getAttribute('RefPartnerSideB')??'');if(!a||!b){const message='Nicht auflösbarer InternalLink: '+name(link);if(a&&face(a.node,'Channel')||b&&face(b.node,'Channel'))issues.push({message});else notes.push(message+' (unverändert in der Vorlage)');continue;}links.set(a.node,[...links.get(a.node)??[],b]);links.set(b.node,[...links.get(b.node)??[],a]);}
 const records:{entity:AmlEntity;value:any;map:AmlRecordMap}[]=[];
 for(const cpu of cpus){const controller:PlcController={id:'',bmk:value(cpu,'ProductDesignation IEC')||name(cpu),plant:value(cpu,'PlantDesignation IEC'),location:value(cpu,'LocationIdentifier IEC'),description:value(cpu,'Comment')};records.push({entity:'controllers',value:controller,map:{entity:'controllers',localId:'',nativeId:id(cpu),baseline:{}}});}
 let channelCount=0;
 for(const module of instances){const channels=children(module,'ExternalInterface').filter(f=>face(f,'Channel'));if(!channels.length)continue;
  if(!id(module)){issues.push({message:'Kanalführendes DeviceItem benötigt eine native CAEX-ID.'});continue;}
  if(!role(module,'DeviceItem')){issues.push({nativeId:id(module),message:'Channel liegt nicht in einem APC-DeviceItem.'});continue;}
  const parsed=channels.map(c=>{const type=value(c,'Type').toLowerCase(),io=value(c,'IoType').toLowerCase(),number=value(c,'Number');if(!['digital','analog'].includes(type)||!['input','output'].includes(io)||!/^\d+$/.test(number)||!Number.isSafeInteger(Number(number))){issues.push({nativeId:id(module),message:'Kanal benötigt Type Digital/Analog, IoType Input/Output und eine numerische Number.'});return;}
   const tags=(links.get(c)??[]).filter(t=>face(t.node,'Tag'));if(tags.length>1){issues.push({nativeId:id(module),message:'Mehrere Tags an einem Kanal werden nicht zusammengeführt.'});return;}
   const tag=tags[0],cpu=tag&&ancestor(tag.owner,isCpu),table=tag&&(role(tag.owner,'TagTable'));
   if(tag&&(!cpu||!table||!id(tag.owner))){issues.push({nativeId:id(module),message:'Tag benötigt eine TagTable mit nativer ID unter einer eindeutigen CPU. ComplexTag-Strukturen werden nicht abgeflacht.'});return;}
   return {node:c,kind:((type==='digital'?'D':'A')+(io==='input'?'I':'O')) as PlcChannel['kind'],number:String(Number(number)),tag,cpu};
  }).filter((v):v is NonNullable<typeof v>=>!!v);
  const candidates=new Set(parsed.map(c=>c.cpu).filter((v):v is Element=>!!v));
  const assignments=children(module,'ExternalInterface').filter(f=>face(f,'ModuleAssignment'));if(assignments.length>1)issues.push({nativeId:id(module),message:'DeviceItem hat mehr als eine ModuleAssignment-Schnittstelle.'});for(const assignment of assignments)for(const target of links.get(assignment)??[])if(face(target.node,'ModuleAssignment')&&isCpu(target.owner))candidates.add(target.owner);
  if(!candidates.size){const device=ancestor(module,e=>role(e,'Device'));const siblings=device?cpus.filter(c=>ancestor(c,e=>role(e,'Device'))===device):[];if(isCpu(module))candidates.add(module);else if(siblings.length===1)candidates.add(siblings[0]);else if(cpus.length===1)candidates.add(cpus[0]);}
  if(candidates.size!==1){issues.push({nativeId:id(module),message:'I/O-Baugruppe hat keine eindeutige CPU-Zuordnung. Tag-Verknüpfungen oder eine eindeutige Device-Struktur sind erforderlich.'});continue;}
  const cpu=[...candidates][0],parents:Element[]=[];for(let a=parentElement(module);a&&a.localName!=='InstanceHierarchy';a=parentElement(a))if(role(a,'DeviceItem')&&!isCpu(a))parents.unshift(a);
  const rack=parents.map(p=>value(p,'PositionNumber')||name(p)).join('/'),slot=value(module,'PositionNumber')||'ohne Positionsnummer: '+name(module);
  const m:PlcModule={id:'',controllerId:id(cpu),rack,slot,bmk:value(module,'ProductDesignation IEC')||name(module),description:value(module,'Comment')};
  records.push({entity:'modules',value:m,map:{entity:'modules',localId:'',nativeId:id(module),baseline:{rack,slot,controllerId:id(cpu)}}});
  for(const c of parsed){if(++channelCount>5000)throw new Error('Höchstens 5000 E/A-Kanäle je Datei.');const tag=c.tag?.node;
   const raw=tag?value(tag,'LogicalAddress'):'',datatype=tag?value(tag,'DataType'):'';
   let address='';try{address=addressFromAml(raw,tag&&xmlTrue(scalar(attr(attribute(tag,'DataType')??tag,'Customized')))?'':datatype,c.kind,tag?value(tag,'IoType'):'');}catch(e){issues.push({nativeId:id(module),message:String((e as Error).message)});}
   const channel:PlcChannel={id:'',moduleId:id(module),number:c.number,kind:c.kind,address,signalText:tag?value(tag,'Comment'):'',reserve:xmlTrue(scalar(attr(attribute(c.node,'CustomAttributes')??c.node,'Schematico.Reserve')))};
   if(tag){channel.symbolicName=name(tag);channel.dataType=datatype;if(!datatype)issues.push({nativeId:id(module),message:'Tag DataType fehlt.'});}
   records.push({entity:'channels',value:channel,map:{entity:'channels',localId:'',nativeId:id(module),ownerId:id(module),number:c.number,kind:c.kind,interfaceName:name(c.node),...(c.tag?{tagOwnerId:id(c.tag.owner),tagName:name(c.tag.node)}:{}),baseline:{}}});
  }
 }
 if(!cpus.length)issues.push({message:'Keine unterstützte APC-CPU gefunden. Generische XML- oder reine Bibliotheksdateien sind keine SPS-Vorlage.'});
 const unmodeled=instances.filter(e=>!cpus.includes(e)&&!records.some(r=>r.entity==='modules'&&r.map.nativeId===id(e))&&!role(e,'TagTable')).length;
 if(unmodeled)notes.push(`${unmodeled} weitere Hardware-/Netz-/Strukturobjekte bleiben ausschließlich in der AML-Vorlage erhalten.`);
 const freeTags=interfaces.filter(f=>face(f.node,'Tag')&&!records.some(r=>r.entity==='channels'&&r.map.tagOwnerId===id(f.owner)&&r.map.tagName===name(f.node))).length;
 if(freeTags)notes.push(`${freeTags} Tags ohne unterstützte Kanalzuordnung bleiben in der Vorlage erhalten.`);
 return {doc,instances,ids,records,issues,notes,role,face,value,attribute,resolve};
}
function addressFromAml(raw:string,dataType:string,kind:PlcChannel['kind'],tagIo:string):string {
 const input=kind.endsWith('I'),area=input?'I':'Q',a=raw.trim();
 if(tagIo&&!['input','output'].includes(tagIo.toLowerCase())||tagIo&&(tagIo.toLowerCase()==='input')!==input)throw new Error('Tag-IoType widerspricht dem Kanal.');
 if(!a)return '';
 const full=plcAddress(a.replace(/^%?O(?=[BWD]?\d)/i,'Q'));if(full){if(full.area!==area)throw new Error('Tag-Adresse widerspricht der Kanalrichtung.');return /^%?O(?=[BWD]?\d)/i.test(a)?a.replace(/^%?O/i,'Q'):a;}
 if(/^\d+\.[0-7]$/.test(a))return area+a;
 if(/^[BWD]\d+$/i.test(a))return area+a.toUpperCase();
 if(/^\d+$/.test(a)){const width=({BYTE:'B',WORD:'W',INT:'W',UINT:'W',DWORD:'D',DINT:'D',UDINT:'D',REAL:'D'} as Record<string,string>)[dataType.toUpperCase()];if(width)return area+width+a;throw new Error('Richtungslose numerische Tag-Adresse ohne unterstützte Datenbreite: '+a);}
 if(/^%?[IEQA]\d/i.test(a))throw new Error('Ungültige numerische Tag-Adresse: '+a);
 return a;
}
export function previewAutomationMl(project:Project,xml:string,updateExisting=false):AmlPreview {
 const result:AmlPreview={sourceChanged:false,changes:[],unchanged:0,issues:[],notes:[]};
 try{const parsed=parseModel(xml);result.issues.push(...parsed.issues);result.notes.push(...parsed.notes);if(result.issues.length)return result;
  const next=structuredClone(project),data=automationData(next);next.automation=data;
  if(project.automationMl&&project.automationMl.version!==1)throw new Error('Nicht unterstützte gespeicherte AML-Zuordnungsversion.');
  const prior=project.automationMl?.maps??[],maps:AmlRecordMap[]=[],nativeControllers=new Map<string,string>(),nativeModules=new Map<string,string>();
  for(const record of parsed.records.sort((a,b)=>['controllers','modules','channels'].indexOf(a.entity)-['controllers','modules','channels'].indexOf(b.entity))){const priorMatches=prior.filter(m=>identity(m)===identity(record.map));if(priorMatches.length>1){result.issues.push({nativeId:record.map.nativeId,message:'Mehrdeutige gespeicherte AML-Zuordnung.'});continue;}
   const entries=data[record.entity] as any[],mapped=priorMatches[0],matches=mapped?entries.filter(r=>r.id===mapped.localId):[],old=matches[0];if(matches.length>1){result.issues.push({nativeId:record.map.nativeId,message:'Lokale ID ist mehrdeutig.'});continue;}
   const value={...old,...record.value,id:old?.id??crypto.randomUUID()};
   if(record.entity==='modules')value.controllerId=nativeControllers.get(normalId(record.value.controllerId));
   if(record.entity==='channels')value.moduleId=nativeModules.get(normalId(record.value.moduleId));
   if(record.entity==='controllers')nativeControllers.set(normalId(record.map.nativeId),value.id);
   if(record.entity==='modules')nativeModules.set(normalId(record.map.nativeId),value.id);
   const map={...record.map,localId:value.id,baseline:Object.fromEntries(Object.keys(record.value).filter(k=>k!=='id').map(k=>[k,value[k]]))};maps.push(map);
   const fields=Object.keys(record.value).filter(k=>k!=='id'&&show(old?.[k])!==show(value[k])).map(key=>({key,before:show(old?.[key]),after:show(value[key])}));
   if(old&&!fields.length){result.unchanged++;continue;}
   result.changes.push({entity:record.entity,id:value.id,name:value.bmk??value.symbolicName??value.number,kind:old?'update':'add',fields});
   if(old&&!updateExisting){result.issues.push({nativeId:record.map.nativeId,message:'Vorhandene Daten unterscheiden sich. Aktualisieren aktivieren und erneut prüfen.'});continue;}
   if(old)entries[entries.indexOf(old)]=value;else entries.push(value);
  }
  if(result.issues.length)return result;
  const before=new Set(inspectAutomation(project).map(i=>i.id));for(const i of inspectAutomation(next).filter(i=>!before.has(i.id)))result.issues.push({nativeId:i.recordId,message:i.message});
  const missing=prior.filter(m=>!maps.some(n=>identity(n)===identity(m)));if(missing.length)result.notes.push(`${missing.length} zuvor zugeordnete lokale Datensätze fehlen in dieser Datei und werden nicht gelöscht.`);
  next.automationMl={version:1,xml,maps};result.sourceChanged=project.automationMl?.xml!==xml||JSON.stringify(project.automationMl?.maps)!==JSON.stringify(maps);if(result.sourceChanged)result.notes.push('Die vollständige AML-Vorlage und ihre Identitätszuordnungen werden mit dem Projekt gespeichert.');
  if(!result.issues.length)result.next=next;
 }catch(e){result.issues.push({message:(e as Error).message});}
 return result;
}
function setValue(e:Element,key:string,value:string){let a=attr(e,key);if(a&&children(a,'Attribute').length&&key==='Comment')throw new Error('Strukturierter/mehrsprachiger Kommentar muss im SPS-Werkzeug bearbeitet werden.');if(!a){a=e.ownerDocument!.createElementNS(e.namespaceURI,'Attribute');a.setAttribute('Name',key);a.setAttribute('AttributeDataType','xs:string');if(semantics[key]){const semantic=e.ownerDocument!.createElementNS(e.namespaceURI,'RefSemantic');semantic.setAttribute('CorrespondingAttributePath',semantics[key]);a.appendChild(semantic);}const before=children(e).find(c=>['ExternalInterface','InternalElement','RoleRequirements','InternalLink','SupportedRoleClass'].includes(c.localName));e.insertBefore(a,before??null);}let v=direct(a,'Value');if(!v){v=e.ownerDocument!.createElementNS(e.namespaceURI,'Value');const before=children(a).find(c=>['RefSemantic','Constraint','Attribute'].includes(c.localName));a.insertBefore(v,before??null);}v.textContent=value;}
export function exportAutomationMl(project:Project):AmlExport {
 const result:AmlExport={issues:[],notes:[]};
 try{const source=project.automationMl;if(source&&source.version!==1)throw new Error('Nicht unterstützte gespeicherte AML-Zuordnungsversion.');if(!source)throw new Error('Zuerst eine AML-Vorlage aus dem SPS-Werkzeug importieren.');const parsed=parseModel(source.xml);if(parsed.issues.length){result.issues.push(...parsed.issues);return result;}
  const data=automationData(project),selected=new Set(source.maps.map(m=>JSON.stringify([m.entity,m.localId])));
  const outside=(['controllers','modules','channels'] as const).flatMap(entity=>data[entity].filter(r=>!selected.has(JSON.stringify([entity,r.id]))).map(record=>({entity,record})));if(outside.length)result.notes.push(`${outside.length} lokale SPS-Datensätze außerhalb dieser Vorlage werden nicht exportiert.`);for(const item of outside){const r=item.record as any;result.notes.push(`Nicht exportiert (${item.entity}): ${r.bmk??r.symbolicName??r.number??r.id}`);}
  for(const map of source.maps){const matches=data[map.entity].filter(r=>r.id===map.localId);if(matches.length!==1){result.issues.push({nativeId:map.nativeId,message:'Zugeordneter Datensatz fehlt oder ist mehrdeutig. Entfernen/Neuaufbau der Hardware muss im SPS-Werkzeug erfolgen.'});continue;}const local=matches[0] as any,node=parsed.ids.get(normalId(map.nativeId));if(!node)throw new Error('AML-Quellinstanz fehlt: '+map.nativeId);
   if(map.entity==='controllers'){for(const [key,aml]of [['bmk','ProductDesignation IEC'],['plant','PlantDesignation IEC'],['location','LocationIdentifier IEC'],['description','Comment']])if(local[key]!==map.baseline[key])setValue(node,aml,local[key]);}
   else if(map.entity==='modules'){
    if(['controllerId','rack','slot'].some(k=>local[k]!==map.baseline[k]))result.issues.push({nativeId:map.nativeId,message:'CPU-Zuordnung, Rack oder Steckplatz wurde geändert. Hardwarestruktur zuerst in der SPS-Vorlage aktualisieren.'});
    if(local.bmk!==map.baseline.bmk)setValue(node,'ProductDesignation IEC',local.bmk);if(local.description!==map.baseline.description)setValue(node,'Comment',local.description);
   }else{
    if(['moduleId','kind','number'].some(k=>local[k]!==map.baseline[k])){result.issues.push({nativeId:map.nativeId,message:'Kanalidentität (Baugruppe/Nummer/Typ) wurde geändert. Diese Hardwareänderung wird nicht als derselbe Kanal exportiert.'});continue;}
    const faces=children(node,'ExternalInterface').filter(f=>name(f)===map.interfaceName),channel=faces.length===1?faces[0]:undefined;if(!channel)throw new Error('AML-Kanal fehlt oder ist mehrdeutig.');
    if(local.reserve!==map.baseline.reserve){let custom=attr(channel,'CustomAttributes');if(!custom){custom=channel.ownerDocument!.createElementNS(channel.namespaceURI,'Attribute');custom.setAttribute('Name','CustomAttributes');const semantic=channel.ownerDocument!.createElementNS(channel.namespaceURI,'RefSemantic');semantic.setAttribute('CorrespondingAttributePath','ListType');custom.appendChild(semantic);channel.appendChild(custom);}setValue(custom,'Schematico.Reserve',String(local.reserve));}
    const tag=map.tagOwnerId&&map.tagName?parsed.resolve(endpoint(map.tagOwnerId,map.tagName)):undefined;
    if(!tag){if(['address','signalText','symbolicName','dataType'].some(k=>show(local[k])!==show(map.baseline[k])))result.issues.push({nativeId:map.nativeId,message:'Kanal hat keinen Tag. Neue Tag-Zuordnung zunächst im SPS-Werkzeug erstellen.'});continue;}
    if(local.dataType!==map.baseline.dataType){const width=dataWidth(local.dataType??''),oldWidth=dataWidth(String(map.baseline.dataType??'')),nativeLength=Number(parsed.value(channel,'Length'));if(width&&width!==(nativeLength||oldWidth))result.issues.push({nativeId:map.nativeId,message:'Geänderter Datentyp passt nicht zur bekannten Kanalbreite.'});}
    if(local.signalText!==map.baseline.signalText)setValue(tag.node,'Comment',local.signalText);
    if(local.dataType!==map.baseline.dataType){if(!local.dataType||!/^(BOOL|BYTE|WORD|DWORD|INT|UINT|DINT|UDINT|REAL)$/i.test(local.dataType))result.issues.push({nativeId:map.nativeId,message:'Geänderter Datentyp ist kein unterstützter IEC-Datentyp.'});else{setValue(tag.node,'DataType',local.dataType.toUpperCase());const customized=attr(attr(tag.node,'DataType')!,'Customized');if(customized)setValue(attr(tag.node,'DataType')!,'Customized','false');}}
    if(local.address!==map.baseline.address){const a=plcAddress(local.address),input=local.kind.endsWith('I');if(a&&dataWidth(local.dataType??'')&&a.end-a.start!==dataWidth(local.dataType))result.issues.push({nativeId:map.nativeId,message:'Adressbreite passt nicht zum Datentyp.'});if(a&&a.area!==(input?'I':'Q'))result.issues.push({nativeId:map.nativeId,message:'Adresse widerspricht der Kanalrichtung.'});const original=parsed.value(tag.node,'LogicalAddress'),legacy=original.match(/^(%?[IOEQA])(?=[BWD]?\d)/i)?.[1],address=a?(legacy?legacy+local.address.replace(/^%?[IEQA]/i,''):local.address.replace(/^%?[IEQA]/i,'')):local.address;setValue(tag.node,'LogicalAddress',address);setValue(tag.node,'IoType',input?'Input':'Output');}
    if(local.symbolicName!==map.baseline.symbolicName){if(!local.symbolicName?.trim()){result.issues.push({nativeId:map.nativeId,message:'Tagname darf nicht leer sein.'});continue;}const oldName=name(tag.node),newName=local.symbolicName;const siblings=children(tag.owner,'ExternalInterface');if(siblings.some(f=>f!==tag.node&&name(f)===newName)){result.issues.push({nativeId:map.nativeId,message:'Neuer Tagname ist in der TagTable bereits vorhanden.'});continue;}
     for(const link of Array.from(parsed.doc.documentElement.getElementsByTagName('*')).filter(e=>e.localName==='InternalLink'&&ancestor(e,p=>p.localName==='InstanceHierarchy')))for(const side of ['RefPartnerSideA','RefPartnerSideB']){const resolved=parsed.resolve(link.getAttribute(side)??'');if(resolved?.node===tag.node)link.setAttribute(side,endpoint(id(tag.owner),newName));}tag.node.setAttribute('Name',newName);
     if(!oldName)throw new Error('Ursprünglicher Tagname fehlt.');
    }
   }
  }
  if(result.issues.length)return result;
  const xml='<?xml version="1.0" encoding="utf-8"?>\n'+serializer.serializeToString(parsed.doc).replace(/^<\?xml[^?]*\?>\s*/,'');const check=parseModel(xml);if(check.issues.length){result.issues.push(...check.issues);return result;}
  for(const map of source.maps.filter(m=>m.entity==='channels')){const decoded=check.records.find(r=>identity(r.map)===identity(map)),local=data.channels.find(c=>c.id===map.localId)!;if(!decoded){result.issues.push({nativeId:map.nativeId,message:'Kanal ist nach Export nicht mehr eindeutig lesbar.'});continue;}const expected=plcAddress(local.address),actual=plcAddress(decoded.value.address);const sameAddress=expected&&actual?JSON.stringify(expected)===JSON.stringify(actual):local.address===decoded.value.address;if(!sameAddress||show(local.symbolicName)!==show(decoded.value.symbolicName)||show(local.signalText)!==show(decoded.value.signalText)||show(local.dataType).toUpperCase()!==show(decoded.value.dataType).toUpperCase())result.issues.push({nativeId:map.nativeId,message:'Exportierte Kanaldaten stimmen nach erneutem Einlesen nicht mit dem Modell überein.'});}
  if(result.issues.length)return result;
  const issues=inspectAutomation(project).filter(i=>selected.has(JSON.stringify([i.entity,i.recordId])));if(issues.length){result.issues.push(...issues.map(i=>({nativeId:i.recordId,message:i.message})));return result;}
  result.xml=xml;result.notes.push('Ursprüngliche Hardware-, Bus- und Bibliotheksdaten bleiben in der AML-Vorlage erhalten. Es erfolgt keine Geräteprogrammierung.');
 }catch(e){result.issues.push({message:(e as Error).message});}
 return result;
}
