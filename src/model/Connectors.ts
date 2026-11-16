import type {Project} from './types';
import {ProjectIndex} from './ProjectIndex';
import {ElectricalNetService} from './ElectricalNetService';
import {connectionPinLabel} from '../reports/ConnectionList';
export interface ConnectorPinAddress {pageId:string;componentId:string;pinId:string}
export interface ConnectorContact {position:string;disposition?:'free'|'reserve';binding?:ConnectorPinAddress}
export interface ConnectorAssembly {id:string;bmk:string;plant:string;location:string;side:'male'|'female';description:string;contacts:ConnectorContact[]}
export interface ConnectorPairing {id:string;maleId:string;femaleId:string;contacts:{malePosition:string;femalePosition:string}[]}
export interface ConnectorRow {connectorId:string;position:string;bmk:string;side:string;description:string;state:string;endpoint:string;page:string;binding?:ConnectorPinAddress;mate:string;matePosition:string;mateEndpoint:string;targets:string[];issues:string[]}
const address=(a:ConnectorPinAddress)=>JSON.stringify([a.pageId,a.componentId,a.pinId]);
export const connectorLabel=(c:ConnectorAssembly)=>[c.plant?'='+c.plant.replace(/^=+/,''):'',c.location?'+'+c.location.replace(/^\++/,''):'',c.bmk].join('');
export function connectorRows(project:Project,index=new ProjectIndex(project),nets=new ElectricalNetService(index)):ConnectorRow[]{
  const all=project.connectorAssemblies??[],pairs=project.connectorPairings??[];
  const uses=new Map<string,number>();for(const c of all)for(const p of c.contacts)if(p.binding)uses.set(address(p.binding),(uses.get(address(p.binding))??0)+1);
  const resolve=(a?:ConnectorPinAddress)=>{const entry=a&&index.component(a.componentId,a.pageId),pin=entry&&a&&index.pin(entry,a.pinId);return pin?.definition&&index.componentsById.get(a!.componentId)?.length===1?pin:undefined;};
  return all.flatMap(c=>c.contacts.map(p=>{
    const issues:string[]=[],pin=resolve(p.binding),pairings=pairs.filter(v=>v.maleId===c.id||v.femaleId===c.id),pair=pairings.length===1?pairings[0]:undefined;
    const counterpart=pair?all.filter(v=>v.id===(c.id===pair.maleId?pair.femaleId:pair.maleId)):[];
    const mappings=pair?.contacts.filter(m=>c.id===pair.maleId?m.malePosition===p.position:m.femalePosition===p.position)??[];
    const position=mappings.length===1?(c.id===pair!.maleId?mappings[0].femalePosition:mappings[0].malePosition):'';
    const peer=counterpart.length===1?counterpart[0]:undefined,peerContacts=peer?.contacts.filter(v=>v.position===position)??[],peerPin=resolve(peerContacts.length===1?peerContacts[0].binding:undefined);
    if(all.filter(v=>v.id===c.id).length!==1)issues.push('Gehäusekennung ist mehrfach vorhanden');
    if(c.contacts.filter(v=>v.position===p.position).length!==1)issues.push('Kontaktposition ist mehrfach vorhanden');
    if(p.binding&&!pin)issues.push('Anschluss fehlt oder ist mehrdeutig');
    if(p.binding&&(uses.get(address(p.binding))??0)>1)issues.push('Anschluss mehrfach zugeordnet');
    if(p.binding&&p.disposition)issues.push('Freie oder Reserveposition besitzt eine Anschlusszuordnung');
    if(pairings.length>1)issues.push('Mehrere Gegenstücke');
    if(pair&&(!peer||peer.side===c.side))issues.push('Gegenstück fehlt oder hat denselben Kontakttyp');
    if(mappings.length>1||pair&&position&&(peerContacts.length!==1||pair.contacts.filter(m=>c.id===pair.maleId?m.femalePosition===position:m.malePosition===position).length!==1))issues.push('Kontaktpaarung ist nicht eindeutig');
    if(pair&&!position)issues.push('Kontakt besitzt keine Gegenstückzuordnung');
    const net=pin&&nets.netForPin(pin);if(pin&&!net)issues.push('Elektrisches Netz nicht auflösbar');
    return {connectorId:c.id,position:p.position,bmk:connectorLabel(c),side:c.side==='male'?'Stecker':'Buchse',description:c.description,
      state:p.binding?'Zugeordnet':p.disposition==='free'?'Frei':p.disposition==='reserve'?'Reserve':'Ungeklärt',endpoint:pin?connectionPinLabel(pin):p.binding?'? '+address(p.binding):'',page:pin?.owner.page.pageNumber??'',binding:p.binding,
      mate:peer?connectorLabel(peer):'',matePosition:position,mateEndpoint:peerPin?connectionPinLabel(peerPin):'',targets:pin?nets.traceTargets(pin).targets.map(connectionPinLabel):[],issues};
  }));
}
export type ConnectorEdit={kind:'save';connector:ConnectorAssembly}|{kind:'delete';id:string}|{kind:'contact';id:string;contact:ConnectorContact}|{kind:'pair';pair:ConnectorPairing}|{kind:'unpair';id:string};
/** Metadata-only transaction: never adds conductor links or alters symbol geometry. */
export function editConnectors(project:Project,edit:ConnectorEdit):Project{
  const next=structuredClone(project),all=next.connectorAssemblies??=[],pairs=next.connectorPairings??=[];
  const one=(id:string)=>{const matches=all.filter(c=>c.id===id);if(matches.length!==1)throw new Error('Steckverbinder ist nicht eindeutig.');return matches[0];};
  if(edit.kind==='save'){
    const c=structuredClone(edit.connector);c.bmk=c.bmk.trim();c.plant=c.plant.trim().replace(/^=+/,'');c.location=c.location.trim().replace(/^\++/,'');
    if(!c.id||!c.bmk||!['male','female'].includes(c.side)||!c.contacts.length||c.contacts.length>1000)throw new Error('BMK, Kontakttyp und 1–1000 Positionen angeben.');
    if(c.contacts.some(p=>!p.position.trim())||new Set(c.contacts.map(p=>p.position.trim())).size!==c.contacts.length)throw new Error('Kontaktpositionen müssen eindeutig und ausgefüllt sein.');
    c.contacts=c.contacts.map(p=>({...p,position:p.position.trim()}));
    if(all.some(v=>v.id!==c.id&&v.side===c.side&&connectorLabel(v)===connectorLabel(c)))throw new Error('Dieses BMK mit Kontakttyp existiert im Strukturkontext bereits.');
    const old=all.filter(v=>v.id===c.id);if(old.length>1)throw new Error('Mehrdeutige Gehäusekennung.');
    if(old.length&&pairs.some(p=>p.maleId===c.id||p.femaleId===c.id)&&(old[0].side!==c.side||old[0].contacts.some(p=>!c.contacts.some(v=>v.position===p.position))))throw new Error('Vor Typwechsel oder Entfernen gepaarter Positionen zuerst Gegenstück lösen.');
    const at=all.findIndex(v=>v.id===c.id);if(at<0)all.push(c);else all[at]=c;
    // Validate bindings using the same strict transaction as individual assignments.
    const index=new ProjectIndex(next);for(const contact of c.contacts)validateContact(next,c.id,contact,index);
  }else if(edit.kind==='delete'){one(edit.id);next.connectorAssemblies=all.filter(c=>c.id!==edit.id);next.connectorPairings=pairs.filter(p=>p.maleId!==edit.id&&p.femaleId!==edit.id);
  }else if(edit.kind==='contact'){const c=one(edit.id);if(c.contacts.filter(p=>p.position===edit.contact.position).length!==1)throw new Error('Kontaktposition ist nicht eindeutig.');validateContact(next,c.id,edit.contact);c.contacts[c.contacts.findIndex(p=>p.position===edit.contact.position)]=structuredClone(edit.contact);
  }else if(edit.kind==='unpair'){one(edit.id);next.connectorPairings=pairs.filter(p=>p.maleId!==edit.id&&p.femaleId!==edit.id);
  }else{
    const p=structuredClone(edit.pair),male=one(p.maleId),female=one(p.femaleId);
    if(male.side!=='male'||female.side!=='female'||male.id===female.id||!p.id||!p.contacts.length)throw new Error('Ein Stecker, eine Buchse und mindestens eine Kontaktpaarung sind erforderlich.');
    if(pairs.some(v=>v.id===p.id||[v.maleId,v.femaleId].some(id=>id===male.id||id===female.id)))throw new Error('Gegenstück zuerst lösen.');
    if(new Set(p.contacts.map(v=>v.malePosition)).size!==p.contacts.length||new Set(p.contacts.map(v=>v.femalePosition)).size!==p.contacts.length||p.contacts.some(v=>male.contacts.filter(c=>c.position===v.malePosition).length!==1||female.contacts.filter(c=>c.position===v.femalePosition).length!==1))throw new Error('Kontaktpaarungen müssen vorhandene Positionen eins zu eins zuordnen.');
    pairs.push(p);
  }
  return next;
}
function validateContact(project:Project,id:string,p:ConnectorContact,index?:ProjectIndex){
  if(p.disposition&&!['free','reserve'].includes(p.disposition))throw new Error('Unbekannter Belegungsstatus.');
  if(!p.binding)return;if(p.disposition)throw new Error('Frei/Reserve darf keine Anschlusszuordnung besitzen.');
  const a=p.binding;index??=new ProjectIndex(project);const entry=index.component(a.componentId,a.pageId),pin=entry&&index.pin(entry,a.pinId);
  if(!pin?.definition||index.componentsById.get(a.componentId)?.length!==1)throw new Error('Anschluss ist nicht eindeutig in der Bibliothek vorhanden.');
  if((project.connectorAssemblies??[]).some(c=>c.contacts.some(v=>(c.id!==id||v.position!==p.position)&&v.binding&&address(v.binding)===address(a))))throw new Error('Anschluss ist bereits einer anderen Kontaktposition zugeordnet.');
}
