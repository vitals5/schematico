import assert from 'node:assert/strict';
import {fixture,add} from '../layout/testing/fixture';
import {automationData,editAutomation,type AutomationEntity} from './Automation';
import {automationExchangeFields as schemas,exportAutomationExchange as output,previewAutomationExchange as preview,automationExchangeIssueReport,automationExchangeMaxBytes} from './AutomationExchange';
import {ProjectHistory} from './ProjectHistory';
let p=fixture();const component=add(p,'plc','catalog_plc_compact');
const save=(entity:AutomationEntity,value:any)=>{p=editAutomation(p,{kind:'save',entity,value});};
save('controllers',{id:'cpu',bmk:'-A1',plant:'=',location:'Test',description:'Example'});
save('modules',{id:'module',controllerId:'cpu',bmk:'-A1.1',rack:'0',slot:'1',description:''});
save('channels',{id:'ch0',moduleId:'module',number:'0',kind:'DI',address:'I0.0',signalText:'Door',reserve:false,signal:{pageId:'p',componentId:component.id,pinId:'I1'}});
save('channels',{id:'ch1',moduleId:'module',number:'1',kind:'DI',address:'I0.1',signalText:'Window',reserve:false});
save('nodes',{id:'interface',name:'Tree branch',network:'Home',protocol:'Loxone Tree',address:'',interfaceRole:'interface',capacity:50});
save('nodes',{id:'touch',name:'Touch',network:'Home',protocol:'Loxone Tree',address:'',interfaceId:'interface'});
save('links',{id:'tree-wire',from:'interface',to:'touch',fromPort:'BUS',toPort:'BUS',lengthM:10.5});
save('nodes',{id:'knx',name:'Sensor',network:'KNX',protocol:'KNX TP',address:'1.1.1'});
save('knxGroups',{id:'light',name:'Light',network:'KNX',address:'1/1/1',dpt:'1.001'});
save('knxObjects',{id:'obj',nodeId:'knx',groupId:'light',number:'1',name:'Switch',dpt:'1.001',direction:'send'});
// This fixture includes every entity plus nested binding and optional data.
for(const entity of Object.keys(schemas) as AutomationEntity[]){const result=await preview(p,await output(p,entity));assert.deepEqual(result.issues,[],entity);assert.equal(result.changes.length,0,entity);assert.equal(result.unchanged,automationData(p)[entity].length,entity);assert.deepEqual(result.next?.automation,p.automation);}
const csv=await output(p,'channels');const before=structuredClone(p);
const swapped=await preview(p,csv.replace(/"I0\.[01]"/g,v=>v==='"I0.0"'?'"I0.1"':'"I0.0"'));
assert.deepEqual(swapped.issues,[]);assert.equal(swapped.changes.length,2);assert.equal(swapped.next!.automation!.channels[0].address,'I0.1');assert.deepEqual(swapped.next!.pages,p.pages);assert.deepEqual(p,before,'Preview never mutates the source');assert.equal((await preview(swapped.next!,csv.replace(/\"I0\.[01]\"/g,v=>v==='\"I0.0\"'?'\"I0.1\"':'\"I0.0\"'))).changes.length,0,'Importing an already applied file is a no-op');
const invalid=await preview(p,csv.replace('"I0.0"','"I0.1"'));assert(!invalid.next);assert(invalid.issues.some(i=>i.message.includes('überschneidet')));assert(invalid.issues.some(i=>i.row===3));
// Existing records not in the export/filter remain untouched.
const filtered=await output(p,'channels',new Set(['ch0']));const subset=await preview(p,filtered.replace('"Door"','""'));assert.equal(subset.next!.automation!.channels[0].signalText,'');assert.deepEqual(subset.next!.automation!.channels[1],p.automation!.channels[1]);
const altered=structuredClone(p);altered.automation!.channels[0].signalText='New local edit';const conflict=await preview(altered,csv);assert(conflict.issues.some(i=>i.id==='ch0'&&i.column==='Stand'));assert(!conflict.next);
const gone=structuredClone(p);gone.automation!.channels=gone.automation!.channels.filter(c=>c.id!=='ch0');assert((await preview(gone,csv)).issues.some(i=>i.message.includes('fehlt im Projekt')));
const wrong=structuredClone(p);wrong.id='another-project';assert((await preview(wrong,csv)).issues.some(i=>i.message.includes('anderen Projekt')));
// Formula protection, literal apostrophes, quotes and multiline free text survive unchanged.
for(const text of ['=SUM(A1:A2)',"'Original",'+24V','-Door','  =1+1',"  'text",'@Device','\tTest','First; "quoted"\r\nSecond\nThird','  spaces retained  ']){const clone=structuredClone(p);clone.automation!.channels[0].signalText=text;const file=await output(clone,'channels');assert((await preview(clone,file)).changes.length===0,text);if(/^[=+@\-\t']/.test(text))assert(file.includes('"\''),text);}
// Test controlled table edits; these simple rows do not contain embedded line breaks.
const table=(text:string)=>text.replace(/^\uFEFF/,'').split('\r\n').map(line=>line.slice(1,-1).split('";"').map(v=>v.replaceAll('""','"')));
const write=(rows:string[][],delimiter=';')=>'\uFEFF'+rows.map(r=>r.map(v=>'"'+v.replaceAll('"','""')+'"').join(delimiter)).join('\r\n');
const rows=table(csv),col=(label:string)=>rows[1].indexOf(label);
const extra=structuredClone(rows);extra.push([...rows[2]]);extra[4][col('ID')]='';extra[4][col('Stand')]='';extra[4][col('Kanalnummer')]='2';extra[4][col('E/A-Adresse')]='I0.2';for(const f of schemas.channels.filter(f=>f.kind==='binding'))extra[4][col(f.label)]='';
const added=await preview(p,write(extra));assert.deepEqual(added.issues,[]);assert.equal(added.changes[0].kind,'add');assert.equal(added.next!.automation!.channels.length,3);
const duplicate=structuredClone(rows);duplicate.push([...rows[2]]);assert((await preview(p,write(duplicate))).issues.some(i=>i.message.includes('mehrfach')));
const partial=structuredClone(rows);partial[2][col('Signal Anschluss-ID')]='';assert((await preview(p,write(partial))).issues.some(i=>i.column==='Signal Blatt-ID'));
const cleared=structuredClone(rows);for(const f of schemas.channels.filter(f=>f.key.startsWith('signal.')))cleared[2][col(f.label)]='';assert(!((await preview(p,write(cleared))).next!.automation!.channels[0].signal));
const badBoolean=structuredClone(rows);badBoolean[2][col('Reserve')]='maybe';assert((await preview(p,write(badBoolean))).issues.some(i=>i.column==='Reserve'));
const reordered=rows.map((r,i)=>i===0?r:[...r].reverse());assert((await preview(p,write(reordered))).changes.length===0);
for(const delimiter of [',','\t'])assert.deepEqual((await preview(p,write(rows,delimiter))).issues,[]);
const badHeaders=structuredClone(rows);badHeaders[1][2]='Unknown';assert((await preview(p,write(badHeaders))).issues.length);
assert((await preview(p,csv+'\r\n"unfinished')).issues.some(i=>i.message.includes('abgeschlossener')));
assert((await preview(p,'Wrong file')).issues.length);assert((await preview(p,'x'.repeat(automationExchangeMaxBytes+1))).issues.length);
const tooMany=[...rows.slice(0,2),...Array.from({length:5001},()=>rows[2])];assert((await preview(p,write(tooMany))).issues.some(i=>i.message.includes('5000')));
const links=table(await output(p,'links')),length=links[1].indexOf('Kabellänge m');links[2][length]='12,5';assert.equal((await preview(p,write(links))).next!.automation!.links[0].lengthM,12.5);links[2][length]='NaN';assert((await preview(p,write(links))).issues.some(i=>i.column==='Kabellänge m'));
// Cross-entity references still use the common protocol/DPT validator.
const groups=await preview(p,(await output(p,'knxGroups')).replace('"1.001"','"5.001"'));assert(!groups.next);assert(groups.issues.some(i=>i.message.includes('widerspr')));
const newer=structuredClone(p);(newer.automation!.channels[0] as any).futureMetadata={keep:true};const future=await output(newer,'channels');assert.deepEqual((await preview(newer,future.replace('"Door"','"Changed"'))).next!.automation!.channels[0],{...newer.automation!.channels[0],signalText:'Changed'});
const badProtocol=await preview(p,(await output(p,'nodes')).replaceAll('Loxone Tree','Not a protocol'));assert(badProtocol.issues.some(i=>i.column==='Protokoll'));
const lowerCapacity=await preview(p,(await output(p,'nodes')).replaceAll('\"50\"','\"51\"'));assert(lowerCapacity.issues.some(i=>i.message.includes('Profilgrenze')));
const history=new ProjectHistory();history.reset(p);history.record(swapped.next!);assert.deepEqual(history.undo(),p);assert.deepEqual(history.redo(),swapped.next);assert.equal(JSON.parse(automationExchangeIssueReport(conflict)).issues[0].id,'ch0');
const empty=fixture();const template=await output(empty,'channels');assert((await preview(empty,template)).unchanged===0);
console.log('✓ Automation CSV exchange: all entities, reversible escaping, multiline/UTF-8, atomic address swaps, filtered imports, field clearing, preserved bindings/unknown fields, identity and stale-data guards, diagnostics, protocol checks and single-step undo');
