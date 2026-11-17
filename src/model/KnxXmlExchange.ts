import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import type {Project} from './types';
import {automationData,inspectAutomation,type KnxGroup} from './Automation';
import {knxDpt,knxGroupAddress} from './BusProfiles';

const namespace='http://knx.org/xml/ga-export/01';
const xmlns='http://www.w3.org/2000/xmlns/';
export const knxXmlMaxBytes=4*1024*1024;
export interface KnxXmlRange {attributes:Record<string,string>}
export interface KnxXmlSource {format:'knx-ga-xml-v1';elementXml:string;ranges:KnxXmlRange[];effectiveDptAtImport:string}
export interface KnxXmlEntry {index:number;name:string;address:string;description?:string;dpt:string;source:KnxXmlSource}
export interface KnxXmlIssue {entry?:number;address?:string;message:string}
export interface KnxXmlRead {entries:KnxXmlEntry[];issues:KnxXmlIssue[];notes:string[]}
export interface KnxXmlChange {id:string;entry:number;address:string;kind:'add'|'update';before?:KnxGroup;after:KnxGroup}
export interface KnxXmlPreview {next?:Project;changes:KnxXmlChange[];unchanged:number;issues:KnxXmlIssue[];notes:string[]}
const serializer=new XMLSerializer();
export {decodeEngineeringXml as decodeKnxGroupXml} from './XmlInput';
function xmlDocument(xml:string):Document {
 if(new TextEncoder().encode(xml).length>knxXmlMaxBytes||/<!DOCTYPE\b|<!ENTITY\b/i.test(xml))throw new Error('XML ist größer als 4 MiB oder enthält nicht unterstützte DTD-/Entity-Deklarationen.');
 let failed=false;const doc=new DOMParser({errorHandler:{warning:()=>{failed=true;},error:()=>{failed=true;},fatalError:()=>{failed=true;}}}).parseFromString(xml.replace(/^\uFEFF/,''),'text/xml');
 if(failed||!doc.documentElement)throw new Error('XML ist nicht wohlgeformt. Bitte einen Gruppenadress-XML-Export verwenden.');
 return doc;
}
const attrs=(e:Element)=>Object.fromEntries(Array.from(e.attributes).map(a=>[a.name,a.value]));
function scopedAttrs(e:Element):Record<string,string>{const result=attrs(e);for(let p:Element|null=e;p;p=p.parentNode?.nodeType===1?p.parentNode as Element:null)for(const a of Array.from(p.attributes))if((a.name==='xmlns'||a.name.startsWith('xmlns:'))&&!Object.hasOwn(result,a.name))result[a.name]=a.value;return result;}
function sourceXml(e:Element):string {const node=e.cloneNode(true) as Element;for(const [key,value]of Object.entries(scopedAttrs(e)))if(key==='xmlns'||key.startsWith('xmlns:'))node.setAttributeNS(xmlns,key,value);return serializer.serializeToString(node);}
const sameNs=(e:Element)=>!e.namespaceURI||e.namespaceURI===namespace;
export function knxXmlAddress(value:string):number|undefined {const v=value.trim();if(v.includes('/'))return knxGroupAddress(v);if(!/^\d{1,5}$/.test(v))return;const n=Number(v);return n>0&&n<=65535?n:undefined;}
const threeLevel=(n:number)=>`${n>>11}/${(n>>8)&7}/${n&255}`;
const subtype=(token:string)=>{const m=token.match(/^DPST-(\d{1,5})-(\d{1,3})$/i);return m?knxDpt(`${Number(m[1])}.${m[2].padStart(3,'0')}`):undefined;};
const subtypeToken=(value:string)=>{const dpt=knxDpt(value);if(!dpt)return;const [main,sub]=dpt.split('.');return `DPST-${main}-${Number(sub)}`;};
function rangeBounds(range:KnxXmlRange):[number,number]{const a=range.attributes,from=a.RangeStart,to=a.RangeEnd;if(!/^\d{1,5}$/.test(from??'')||!/^\d{1,5}$/.test(to??'')||Number(from)>Number(to)||Number(to)>65535)throw new Error('Gruppenbereich mit ungültigen RangeStart/RangeEnd-Werten');return [Number(from),Number(to)];}
export function readKnxGroupXml(xml:string):KnxXmlRead {
 const result:KnxXmlRead={entries:[],issues:[],notes:[]};
 try{
  const doc=xmlDocument(xml),root=doc.documentElement;
  if(root.localName!=='GroupAddress-Export'||!sameNs(root))throw new Error('Keine unterstützte KNX-Gruppenadress-XML-Datei. Vollständige Projektarchive werden hier nicht eingelesen.');
  if(Array.from(root.attributes).some(a=>a.name!=='xmlns'&&!a.name.startsWith('xmlns:')))result.notes.push('Zusätzliche Attribute der Export-Wurzel werden nicht als Projektdaten übernommen.');
  const seen=new Set<number>();let elements=0,entryCount=0;
  const visit=(parent:Element,ranges:KnxXmlRange[])=>{
   if(ranges.length>32)throw new Error('Mehr als 32 Bereichsebenen werden nicht unterstützt.');
   for(const child of Array.from(parent.childNodes)){
    if(child.nodeType!==1){if(child.nodeType===3&&child.textContent?.trim())throw new Error('Unerwarteter Text außerhalb einer Gruppenadresse.');continue;}
    const element=child as Element;if(++elements>15000)throw new Error('Zu viele XML-Elemente.');
    if(!sameNs(element))throw new Error('Nicht unterstützter Namensraum in der Gruppenstruktur.');
    if(element.localName==='GroupRange'){
     const range={attributes:scopedAttrs(element)},[from,to]=rangeBounds(range);if(ranges.some(r=>{const [a,b]=rangeBounds(r);return from<a||to>b;}))throw new Error('Gruppenbereich liegt außerhalb seines übergeordneten Bereichs.');
     visit(element,[...ranges,range]);continue;
    }
    if(element.localName!=='GroupAddress')throw new Error(`Nicht unterstütztes Strukturelement: ${element.localName}`);
    const index=++entryCount;if(index>5000)throw new Error('Höchstens 5000 Gruppenadressen je Datei.');
    const raw=element.getAttribute('Address')??'',number=knxXmlAddress(raw),name=element.getAttribute('Name')??'';
    if(number===undefined){result.issues.push({entry:index,address:raw,message:'Gruppenadresse ist ungültig oder reserviert (0).'});continue;}
    if(!name.trim()){result.issues.push({entry:index,address:raw,message:'Gruppenname fehlt.'});continue;}
    if(seen.has(number))result.issues.push({entry:index,address:raw,message:'Gruppenadresse ist in der Datei mehrfach enthalten (auch bei anderer Schreibweise).'});seen.add(number);
    if(ranges.some(r=>{const [a,b]=rangeBounds(r);return number<a||number>b;}))result.issues.push({entry:index,address:raw,message:'Adresse liegt außerhalb ihres Gruppenbereichs.'});
    const tokens=(element.getAttribute('DPTs')??'').split(/[,\s]+/).filter(Boolean),mapped=tokens.map(subtype),unique=new Set(mapped.filter(Boolean));
    const dpt=tokens.length&&mapped.every(Boolean)&&unique.size===1?mapped[0]!:'';
    if(tokens.length&&!dpt)result.notes.push(`${raw}: DPTs-Sequenz bleibt unverändert erhalten; daraus wird kein eindeutiger Datenpunkttyp angenommen.`);
    const entry:KnxXmlEntry={index,name,address:raw.includes('/')?raw.trim():threeLevel(number),dpt,source:{format:'knx-ga-xml-v1',elementXml:sourceXml(element),ranges:structuredClone(ranges),effectiveDptAtImport:dpt}};
    if(element.hasAttribute('Description'))entry.description=element.getAttribute('Description')??'';
    result.entries.push(entry);
   }
  };visit(root,[]);
  if(!result.entries.length&&!result.issues.length)result.notes.push('Die Datei enthält keine Gruppenadressen.');
 }catch(e){result.issues.push({message:e instanceof Error?e.message:String(e)});}
 return result;
}
function mergeSource(old:KnxGroup|undefined,incoming:KnxXmlSource,effective:string):KnxXmlSource {
 const source=structuredClone(incoming);
 if(old?.xmlSource){const prior=xmlDocument(old.xmlSource.elementXml).documentElement,current=xmlDocument(source.elementXml).documentElement;
  for(const a of Array.from(prior.attributes))if(a.name!=='xmlns'&&!current.hasAttribute(a.name))current.setAttributeNS(a.namespaceURI,a.name,a.value);
  if(!Array.from(current.childNodes).some(c=>c.nodeType===1||c.nodeType===3&&c.textContent?.trim())){while(current.firstChild)current.removeChild(current.firstChild);for(const child of Array.from(prior.childNodes))current.appendChild(child.cloneNode(true));}
  source.elementXml=serializer.serializeToString(current);
 }
 if(!source.ranges.length&&old?.xmlSource?.ranges.length)source.ranges=structuredClone(old.xmlSource.ranges);
 source.effectiveDptAtImport=effective;return source;
}
export function previewKnxGroupXml(project:Project,xml:string,network:string,updateExisting=false):KnxXmlPreview {
 const parsed=readKnxGroupXml(xml),result:KnxXmlPreview={changes:[],unchanged:0,issues:[...parsed.issues],notes:[...parsed.notes]};network=network.trim();
 if(!network)result.issues.push({message:'KNX-Zielnetz angeben. Die XML-Datei legt kein Schematico-Netz fest.'});
 if(result.issues.length)return result;
 const next=structuredClone(project),data=automationData(next);next.automation=data;
 for(const e of parsed.entries){const matches=data.knxGroups.filter(g=>g.network===network&&knxGroupAddress(g.address)===knxGroupAddress(e.address));
  if(matches.length>1){result.issues.push({entry:e.index,address:e.address,message:'Vorhandene Gruppenadresse ist im Zielnetz mehrdeutig.'});continue;}
  const old=matches[0],dpt=e.dpt||old?.dpt||'',after:KnxGroup={...old,id:old?.id??crypto.randomUUID(),network,name:e.name,address:old?.address??e.address,dpt};
  if(e.description!==undefined)after.description=e.description;
  if(!e.dpt&&old?.dpt)result.notes.push(`${e.address}: vorhandener Datenpunkttyp ${old.dpt} bleibt erhalten.`);
  try{after.xmlSource=mergeSource(old,e.source,dpt);}catch(error){result.issues.push({entry:e.index,address:after.address,message:'Gespeicherte XML-Quelldaten sind ungültig. '+String(error)});continue;}
  if(old&&JSON.stringify(old)===JSON.stringify(after)){result.unchanged++;continue;}
  result.changes.push({id:after.id,entry:e.index,address:after.address,kind:old?'update':'add',before:old,after});
  if(old&&!updateExisting){result.issues.push({entry:e.index,address:e.address,message:'Vorhandene Adresse unterscheidet sich. Zum geprüften Aktualisieren „Vorhandene Adressen aktualisieren“ aktivieren.'});continue;}
  if(old)data.knxGroups[data.knxGroups.indexOf(old)]=after;else data.knxGroups.push(after);
 }
 if(result.issues.length)return result;
 const before=new Set(inspectAutomation(project).map(i=>i.id));for(const i of inspectAutomation(next).filter(i=>!before.has(i.id)))result.issues.push({address:data.knxGroups.find(g=>g.id===i.recordId)?.address,message:i.message});
 if(!result.issues.length)result.next=next;
 return result;
}
export function exportKnxGroupXml(project:Project,network:string,ids?:ReadonlySet<string>,preserveRanges=true):{xml:string;notes:string[]} {
 network=network.trim();
 const groups=automationData(project).knxGroups.filter(g=>g.network===network&&(!ids||ids.has(g.id))).sort((a,b)=>(knxGroupAddress(a.address)??0)-(knxGroupAddress(b.address)??0));
 if(!groups.length)throw new Error('Keine Gruppenadressen im ausgewählten Netz und Suchfilter.');if(groups.length>5000)throw new Error('Höchstens 5000 Gruppenadressen je Datei.');
 const doc=xmlDocument(`<GroupAddress-Export xmlns="${namespace}"/>`),root=doc.documentElement,paths=new Map<string,Element>(),seen=new Set<number>(),notes:string[]=[];
 for(const g of groups){const address=knxGroupAddress(g.address);if(g.dpt&&!knxDpt(g.dpt))throw new Error('Ungültiger Datenpunkttyp: '+g.dpt);if(address===undefined||!g.name.trim()||seen.has(address))throw new Error('Ungültige oder doppelte Gruppenadresse im Export: '+g.address);seen.add(address);
  const source=g.xmlSource,originalElement=source?xmlDocument(source.elementXml).documentElement:undefined,element=doc.createElementNS(namespace,'GroupAddress');
  if(originalElement){if(originalElement.localName!=='GroupAddress'||!sameNs(originalElement))throw new Error('Ungültige gespeicherte Gruppenadress-Quelldaten: '+g.address);for(const a of Array.from(originalElement.attributes))if(a.name!=='xmlns')element.setAttributeNS(a.namespaceURI,a.name,a.value);for(const child of Array.from(originalElement.childNodes))element.appendChild(doc.importNode(child,true));}

  element.setAttribute('Name',g.name);const original=element.getAttribute('Address')??'';element.setAttribute('Address',knxXmlAddress(original)===address?original:g.address);
  if(g.description!==undefined)element.setAttribute('Description',g.description);
  if(!source||knxDpt(g.dpt)!==knxDpt(source.effectiveDptAtImport)||!element.hasAttribute('DPTs')&&g.dpt){
   if(g.dpt){const token=subtypeToken(g.dpt);if(!token)throw new Error('Ungültiger Datenpunkttyp: '+g.dpt);element.setAttribute('DPTs',token);}else element.removeAttribute('DPTs');
   if(source?.elementXml.includes('DPTs='))notes.push(`${g.address}: DPTs-Sequenz wurde entsprechend dem bearbeiteten Datenpunkttyp ersetzt.`);
  }
  let parent:Element=root,path='';
  if(preserveRanges)for(const range of source?.ranges??[]){const [a,b]=rangeBounds(range);if(address<a||address>b)throw new Error(`${g.address}: Adresse liegt außerhalb des gespeicherten Bereichs. Für eine flache Adressliste „Bereiche beibehalten“ ausschalten.`);
   path+=JSON.stringify(Object.entries(range.attributes).sort(([a],[b])=>a<b?-1:1));let node=paths.get(path);if(!node){node=doc.createElementNS(namespace,'GroupRange');for(const [key,value]of Object.entries(range.attributes))if(key.startsWith('xmlns:'))node.setAttributeNS(xmlns,key,value);for(const [key,value]of Object.entries(range.attributes))if(key!=='xmlns'&&!key.startsWith('xmlns:')){const prefix=key.includes(':')?key.split(':')[0]:'';node.setAttributeNS(prefix?range.attributes['xmlns:'+prefix]??null:null,key,value);}for(const sibling of Array.from(parent.childNodes).filter(n=>n.nodeType===1&&(n as Element).localName==='GroupRange') as Element[]){const [x,y]=rangeBounds({attributes:attrs(sibling)});if(a<=y&&b>=x)throw new Error('Gespeicherte Bereiche überschneiden sich. Für eine flache Adressliste „Bereiche beibehalten“ ausschalten.');}parent.appendChild(node);paths.set(path,node);}parent=node;
  }
  parent.appendChild(doc.importNode(element,true));
 }
 const xml='<?xml version="1.0" encoding="utf-8"?>\n'+serializer.serializeToString(doc);
 if(new TextEncoder().encode(xml).length>knxXmlMaxBytes)throw new Error('Export ist größer als 4 MiB. Bitte Suchfilter eingrenzen.');
 if(!preserveRanges)notes.push('Flache Adressliste: gespeicherte Bereichsnamen und Bereichsgrenzen sind nicht in dieser Datei enthalten.');
 return {xml,notes};
}
