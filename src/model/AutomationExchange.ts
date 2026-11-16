import {busProtocols} from './BusProfiles';
import type {Project} from './types';
import {automationData,inspectAutomation,type AutomationEntity} from './Automation';

/** Editable interchange is separate from the printable report. IDs and revision
 * fingerprints are carried explicitly; rows omitted from a file never delete data. */
type Field={key:string;label:string;kind?:'boolean'|'number'|'optional'|'binding'};
const text=(key:string,label:string):Field=>({key,label});
const optional=(key:string,label:string):Field=>({key,label,kind:'optional'});
const binding=(key:string,label:string,pin=false):Field[]=>[
 {key:key+'.pageId',label:label+' Blatt-ID',kind:'binding'},
 {key:key+'.componentId',label:label+' Element-ID',kind:'binding'},
 ...(pin?[{key:key+'.pinId',label:label+' Anschluss-ID',kind:'binding' as const}]:[])
];
export const automationExchangeFields:Record<AutomationEntity,Field[]>={
 controllers:[text('bmk','CPU-BMK'),text('plant','Anlage'),text('location','Ort'),text('description','Beschreibung')],
 modules:[text('controllerId','CPU-ID'),text('rack','Rack'),text('slot','Steckplatz'),text('bmk','Baugruppen-BMK'),text('description','Beschreibung')],
 channels:[text('moduleId','Baugruppen-ID'),text('number','Kanalnummer'),text('kind','Kanaltyp'),text('address','E/A-Adresse'),text('signalText','Signaltext'),{key:'reserve',label:'Reserve',kind:'boolean'},...binding('signal','Signal',true),...binding('supply','Versorgung',true),...binding('common','Bezug',true)],
 nodes:[text('name','Teilnehmername'),text('network','Netzname'),text('protocol','Protokoll'),text('address','Busadresse'),optional('ipAddress','IP-Adresse'),optional('controllerId','CPU-ID'),optional('interfaceRole','Schnittstellenrolle'),optional('interfaceId','Schnittstellen-ID'),optional('interfaceProfile','Schnittstellenprofil'),{key:'capacity',label:'Teilnehmergrenze',kind:'number'},...binding('binding','Zeichnung')],
 links:[text('from','Von Teilnehmer-ID'),text('fromPort','Von Port'),text('to','Zu Teilnehmer-ID'),text('toPort','Zu Port'),{key:'lengthM',label:'Kabellänge m',kind:'number'}],
 knxGroups:[text('network','KNX-Netz'),text('name','Gruppenname'),text('address','Gruppenadresse'),text('dpt','Datenpunkttyp')],
 knxObjects:[text('nodeId','KNX-Teilnehmer-ID'),text('number','Objektnummer'),text('name','Objektname'),text('groupId','Gruppen-ID'),text('dpt','Datenpunkttyp'),text('direction','Richtung')]
};
export interface AutomationExchangeIssue {row:number;id?:string;column?:string;message:string}
export interface AutomationExchangeChange {row:number;id:string;kind:'add'|'update';fields:{label:string;before:string;after:string}[]}
export interface AutomationExchangePreview {entity?:AutomationEntity;next?:Project;changes:AutomationExchangeChange[];unchanged:number;issues:AutomationExchangeIssue[]}
export const automationExchangeMaxBytes=4*1024*1024;
const maxRows=5000;
const marker='Schematico-Automation-CSV';
const canonical=(v:unknown):string=>JSON.stringify(v,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0)):item);
async function fingerprint(value:unknown):Promise<string>{const bytes=new TextEncoder().encode(canonical(value));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
const get=(value:any,key:string):unknown=>key.split('.').reduce((v,k)=>v?.[k],value);
const shown=(value:unknown):string=>value===undefined?'':typeof value==='boolean'?value?'true':'false':String(value);
// Reversible formula escaping, including original apostrophes. Metadata declares this format.
const needsEscape=(value:string)=>/^[\s]*[=+@\-\t\r\n']/.test(value);
const protect=(value:string)=>needsEscape(value)?"'"+value:value;
const unprotect=(value:string)=>value.startsWith("'")&&needsEscape(value.slice(1))?value.slice(1):value;
const csv=(rows:string[][])=>'\uFEFF'+rows.map(r=>r.map(v=>'"'+v.replaceAll('"','""')+'"').join(';')).join('\r\n');
export async function exportAutomationExchange(project:Project,entity:AutomationEntity,ids?:ReadonlySet<string>):Promise<string>{
 const projectId=project.id,records=structuredClone(automationData(project)[entity].filter(r=>!ids||ids.has(r.id)));
 if(records.length>maxRows)throw new Error(`Höchstens ${maxRows} Datensätze je Datei. Bitte Auswahl über die Suche eingrenzen.`);
 const rows=await Promise.all(records.map(async r=>[r.id,await fingerprint(r),...automationExchangeFields[entity].map(f=>shown(get(r,f.key)))].map(protect)));
 const result=csv([[marker,'1',protect(projectId),entity],['ID','Stand',...automationExchangeFields[entity].map(f=>f.label)],...rows]);
 if(new TextEncoder().encode(result).length>automationExchangeMaxBytes)throw new Error('CSV ist größer als 4 MiB. Bitte Auswahl eingrenzen.');
 return result;
}
interface CsvRow {line:number;cells:string[]}
/** Strict CSV, with quoted multiline cells and real file line numbers. */
function parse(text:string):CsvRow[]{
 text=text.replace(/^\uFEFF/,'');let delimiter=';',inQuote=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(inQuote&&text[i+1]==='"')i++;else inQuote=!inQuote;}else if(!inQuote&&[';',',','\t'].includes(c)){delimiter=c;break;}else if(!inQuote&&(c==='\r'||c==='\n'))break;}

 const rows:CsvRow[]=[];let cells:string[]=[],cell='',quoted=false,after=false,line=1,start=1;
 const push=()=>{cells.push(cell);if(cells.some(v=>v.length))rows.push({line:start,cells});cell='';cells=[];after=false;};
 for(let i=0;i<text.length;i++){const ch=text[i];
  if(quoted){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;after=true;}}else{cell+=ch;if(ch==='\n'||ch==='\r'&&text[i+1]!=='\n')line++;}continue;}
  if(ch===delimiter){cells.push(cell);cell='';after=false;}
  else if(ch==='\r'||ch==='\n'){if(ch==='\r'&&text[i+1]==='\n')i++;push();line++;start=line;}
  else if(ch==='"'&&!cell&&!after)quoted=true;
  else{if(after||ch==='"')throw new Error(`Zeile ${line}: ungültige CSV-Anführungszeichen`);cell+=ch;}
 }
 if(quoted)throw new Error(`Zeile ${start}: nicht abgeschlossener CSV-Text`);if(cell||cells.length||after)push();
 return rows;
}
export async function previewAutomationExchange(project:Project,content:string):Promise<AutomationExchangePreview>{
 project=structuredClone(project);
 const result:AutomationExchangePreview={changes:[],unchanged:0,issues:[]};
 const issue=(row:number,message:string,id?:string,column?:string)=>result.issues.push({row,message,id,column});
 if(new TextEncoder().encode(content).length>automationExchangeMaxBytes){issue(1,'Datei ist größer als 4 MiB');return result;}
 let rows:CsvRow[];try{rows=parse(content);}catch(e){issue(1,(e as Error).message);return result;}
 const meta=rows[0]?.cells;
 if(meta?.length!==4||meta[0]!==marker||meta[1]!=='1'){issue(1,'Keine unterstützte Schematico-Bearbeitungs-CSV (Version 1). Bitte „Bearbeitungs-CSV exportieren“ verwenden.');return result;}
 if(unprotect(meta[2])!==project.id){issue(1,'CSV gehört zu einem anderen Projekt. Bitte aus dem geöffneten Projekt neu exportieren.');return result;}
 const entity=meta[3] as AutomationEntity;
 if(!Object.hasOwn(automationExchangeFields,entity)){issue(1,'Unbekannter Datenbereich');return result;}
 result.entity=entity;
 const fields=automationExchangeFields[entity],expected=['ID','Stand',...fields.map(f=>f.label)],headers=rows[1]?.cells??[];
 if(headers.length!==expected.length||new Set(headers).size!==headers.length||expected.some(h=>!headers.includes(h))){issue(rows[1]?.line??2,'Spalten fehlen, sind doppelt oder unbekannt. Originalüberschriften beibehalten; Spalten dürfen umsortiert werden.');return result;}
 if(rows.length-2>maxRows){issue(3,`Höchstens ${maxRows} Datensätze je Datei`);return result;}
 const data=structuredClone(automationData(project)),next:Project={...project,automation:data};
 const records=data[entity] as {id:string}[],byId=new Map<string,{id:string}[]>();
 for(const r of records)byId.set(r.id,[...byId.get(r.id)??[],r]);
 const seen=new Set<string>();
 for(const row of rows.slice(2)){
  if(row.cells.length!==headers.length){issue(row.line,'Falsche Anzahl von Spalten');continue;}
  const read=(label:string)=>unprotect(row.cells[headers.indexOf(label)]),id=read('ID').trim()||crypto.randomUUID(),stamp=read('Stand').trim();
  if(seen.has(id)){issue(row.line,'ID kommt mehrfach in der Importdatei vor',id,'ID');continue;}seen.add(id);
  const matches=byId.get(id)??[],old=matches[0];
  if(matches.length>1){issue(row.line,'ID ist im Projekt mehrdeutig',id,'ID');continue;}
  if(!old&&stamp){issue(row.line,'Datensatz aus dem Export fehlt im Projekt. Kein automatisches Wiederanlegen; neue Zeile mit leerem Stand anlegen.',id,'Stand');continue;}
  const value:any=old?structuredClone(old):{id};const beforeIssues=result.issues.length;
  for(const f of fields){if(f.kind==='binding')continue;const raw=read(f.label),v=f.key==='signalText'||f.key==='description'?raw:raw.trim();
   const choices=entity==='channels'&&f.key==='kind'?['DI','DO','AI','AO']:entity==='nodes'&&f.key==='protocol'?busProtocols:entity==='nodes'&&f.key==='interfaceRole'?['device','interface']:entity==='nodes'&&f.key==='interfaceProfile'?['generic','air-base']:entity==='knxObjects'&&f.key==='direction'?['send','receive','both']:undefined;
   if(choices&&v&&!(choices as readonly string[]).includes(v)){issue(row.line,'Erlaubte Werte: '+choices.join(', '),id,f.label);continue;}
   if(f.kind==='number'){
    if(!v){delete value[f.key];continue;}
    if(!/^\d+(?:[.,]\d+)?$/.test(v)||!Number.isFinite(Number(v.replace(',','.')))){issue(row.line,'Nicht negative Zahl erwartet (Punkt oder Komma als Dezimaltrenner)',id,f.label);continue;}
    value[f.key]=Number(v.replace(',','.'));
   }else if(f.kind==='boolean'){
    if(!['true','false','1','0','ja','nein'].includes(v.toLowerCase())){issue(row.line,'true/false, ja/nein oder 1/0 erwartet',id,f.label);continue;}
    value[f.key]=['true','1','ja'].includes(v.toLowerCase());
   }else if(f.kind==='optional'&&!v){if(value[f.key]!==''||!old)delete value[f.key];}
   else value[f.key]=v;
  }
  for(const root of new Set(fields.filter(f=>f.kind==='binding').map(f=>f.key.split('.')[0]))){const parts=fields.filter(f=>f.key.startsWith(root+'.')),values=parts.map(f=>read(f.label).trim());
   if(values.every(v=>!v)){delete value[root];continue;}
   if(values.some(v=>!v)){issue(row.line,'Zeichnungszuordnung vollständig ausfüllen oder alle zugehörigen Felder leeren',id,parts[0].label);continue;}
   value[root]={...(old as any)?.[root],...Object.fromEntries(parts.map((f,i)=>[f.key.split('.')[1],values[i]]))};
  }
  if(result.issues.length!==beforeIssues)continue;
  if(old&&canonical(old)===canonical(value)){result.unchanged++;continue;}
  if(old&&await fingerprint(old)!==stamp){issue(row.line,'Datensatz wurde seit dem Export geändert oder die ID/Stand-Spalte wurde verändert. Neu exportieren und Änderungen abgleichen.',id,'Stand');continue;}
  const changes=fields.filter(f=>shown(get(old,f.key))!==shown(get(value,f.key))).map(f=>({label:f.label,before:shown(get(old,f.key)),after:shown(get(value,f.key))}));
  result.changes.push({row:row.line,id,kind:old?'update':'add',fields:changes});
  if(old)records[records.indexOf(old)]=value;else records.push(value);
 }
 if(result.issues.length)return result;
 // Validate only the final batch, allowing address swaps and coordinated role changes.
 const before=new Set(inspectAutomation(project).map(i=>i.id));
 for(const i of inspectAutomation(next).filter(i=>!before.has(i.id))){const change=result.changes.find(c=>c.id===i.recordId&&i.entity===entity);issue(change?.row??0,i.message,i.recordId);}
 if(!result.issues.length)result.next=next;
 return result;
}
export const automationExchangeIssueReport=(preview:AutomationExchangePreview)=>JSON.stringify({format:'schematico-automation-import-errors',version:1,entity:preview.entity,issues:preview.issues},null,2);
