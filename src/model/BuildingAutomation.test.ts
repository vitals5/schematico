import assert from 'node:assert/strict';
import {fixture,add} from '../layout/testing/fixture';
import {automationData,editAutomation,inspectAutomation,type AutomationEntity,type BusNode} from './Automation';
import {knxIndividualAddress,knxGroupAddress,knxDpt} from './BusProfiles';
import {automationPlan,automationCsv} from '../reports/AutomationPlan';
import {automationPlanPdf} from '../export/AutomationPlanPdf';
import {inspectElectricalProject} from './ElectricalInspection';
import {ProjectHistory} from './ProjectHistory';
let p=fixture();const symbol=add(p,'knx','catalog_plc_compact'),drawing=structuredClone(p.pages);
const save=(entity:AutomationEntity,value:any)=>{p=editAutomation(p,{kind:'save',entity,value});};
const node=(id:string,protocol:BusNode['protocol'],extra:Partial<BusNode>={}):BusNode=>({id,name:id,network:'Building',protocol,address:'',...extra});
const link=(id:string,from:string,to:string,lengthM?:number)=>({id,from,to,fromPort:'BUS',toPort:'BUS',...(lengthM===undefined?{}:{lengthM})});
assert.equal(knxIndividualAddress('01.02.003'),'1.2.3');assert.equal(knxIndividualAddress('15.15.255'),'15.15.255');assert.equal(knxIndividualAddress('16.0.1'),undefined);
assert.equal(knxGroupAddress('1/2/3'),knxGroupAddress('1/515'));assert.equal(knxGroupAddress('31/7/255'),65535);assert.equal(knxGroupAddress('31/2047'),65535);
for(const a of ['0/0/0','0/0','32/0/1','1/8/1','1/0/256','1/2048','1.2.3','1//2'])assert.equal(knxGroupAddress(a),undefined,a);
assert.equal(knxDpt('DPT-01.001'),'1.001');assert.equal(knxDpt('1.1'),undefined);
save('nodes',node('sensor','KNX TP',{address:'1.1.1',binding:{pageId:'p',componentId:symbol.id}}));
save('nodes',node('actuator','KNX TP',{address:'1.1.2'}));
assert.throws(()=>save('nodes',node('duplicate','KNX IP',{address:'01.01.001'})),/mehrfach/);
assert.throws(()=>save('nodes',node('bad','KNX IP',{address:'192.168.1.1'})),/individuelle Adresse/);
save('nodes',node('router','KNX IP',{address:'1.1.0',ipAddress:'192.168.1.2'}));
assert.throws(()=>save('nodes',node('bad-ip','KNX IP',{address:'1.1.3',ipAddress:'192.168.1.256'})),/IPv4/);
save('knxGroups',{id:'light',network:'Building',name:'Light',address:'1/2/3',dpt:'1.001'});
assert.throws(()=>save('knxGroups',{id:'alias',network:'Building',name:'Alias',address:'1/515',dpt:''}),/doppelt/);
const object=(id:string,nodeId='sensor',extra={})=>({id,nodeId,number:'1',name:'Switch',groupId:'light',dpt:'DPT-1.001',direction:'send',...extra});
save('knxObjects',object('switch'));save('knxObjects',object('output','actuator',{direction:'receive'}));
assert.throws(()=>save('knxObjects',object('again')),/mehrfach/);
assert.throws(()=>save('knxObjects',object('mismatch','actuator',{number:'2',dpt:'5.001'})),/widerspr/);
save('knxGroups',{id:'feedback',network:'Building',name:'Feedback',address:'1/2/4',dpt:'1.001'});
save('knxObjects',object('switch-feedback','sensor',{groupId:'feedback'})); // one object, multiple groups
assert.throws(()=>save('knxGroups',{id:'feedback',network:'Other',name:'Feedback',address:'1/2/4',dpt:'1.001'}),/selben KNX-Netz/);
save('links',link('tp','sensor','actuator'));save('nodes',node('sensor2','KNX TP',{address:'1.1.3'}));save('links',link('branch','sensor','sensor2')); // shared terminal allowed
assert.throws(()=>save('links',link('ring','actuator','sensor2')),/Ring/);
for(const [id,protocol] of [['link','Loxone Link'],['tree','Loxone Tree'],['tree2','Loxone Tree'],['air','Loxone Air']] as const)save('nodes',node(id,protocol,{interfaceRole:'interface',...(id==='air'?{interfaceProfile:'air-base'}:{})}));
save('nodes',node('ext1','Loxone Link',{interfaceId:'link'}));save('nodes',node('ext2','Loxone Link',{interfaceId:'link'}));save('nodes',node('ext3','Loxone Link',{interfaceId:'link'}));
save('links',link('line-start','link','ext1',250));save('links',link('line-next','ext1','ext2',250));
assert.throws(()=>save('links',link('line-too-long','ext2','ext3',1)),/500 m/);
assert.throws(()=>save('links',link('line-branch','ext1','ext3')),/keine Verzweigung/);
assert.throws(()=>save('nodes',node('unassigned','Loxone Tree')),/Tree-Zweig/);
for(const id of ['touch1','touch2','touch3'])save('nodes',node(id,'Loxone Tree',{interfaceId:'tree'}));
save('nodes',node('other-touch','Loxone Tree',{interfaceId:'tree2'}));
save('links',link('tree-start','tree','touch1',100));save('links',link('tree-branch','touch1','touch2',100));save('links',link('tree-branch2','touch1','touch3',100));
assert.throws(()=>save('links',link('tree-ring','touch2','touch3')),/Ring/);
assert.throws(()=>save('links',link('cross-tree','touch2','other-touch')),/nicht verbunden/);
save('nodes',node('air-touch','Loxone Air',{interfaceId:'air'}));save('links',{id:'air-pair',from:'air',to:'air-touch',fromPort:'',toPort:''});
assert.throws(()=>save('links',{id:'air-pair',from:'air',to:'air-touch',fromPort:'',toPort:'',lengthM:10}),/Funkzuordnung/);
assert.throws(()=>save('nodes',node('air','Loxone Air',{interfaceRole:'interface',interfaceProfile:'air-base',capacity:129})),/Profilgrenze/);
save('nodes',node('unknown-air','Loxone Air',{interfaceRole:'interface'}));assert(automationPlan(p).find(r=>r.id==='unknown-air')!.cells.join(' ').includes('Grenze ungeklärt'));
for(const [root,protocol,max] of [['link','Loxone Link',30],['tree','Loxone Tree',50],['air','Loxone Air',128]] as const){const bulk=structuredClone(p),d=automationData(bulk);bulk.automation=d;d.nodes=d.nodes.filter(n=>n.interfaceId!==root);d.links=[];for(let i=0;i<max;i++)d.nodes.push(node('bulk'+root+i,protocol,{interfaceId:root}));assert(!inspectAutomation(bulk).some(i=>i.recordId===root),'exact limit valid');d.nodes.push(node('excess',protocol,{interfaceId:root}));assert(inspectAutomation(bulk).some(i=>i.recordId===root&&i.message.includes('Teilnehmergrenze')));}
const bad=structuredClone(p);bad.automation!.knxObjects[0].dpt='5.001';assert(inspectElectricalProject(bad).messages.some(m=>m.ruleId==='bus_configuration'));
const noGroup=editAutomation(p,{kind:'remove',entity:'knxGroups',id:'light'});assert(!noGroup.automation!.knxObjects.some(o=>o.groupId==='light'));
const noNode=editAutomation(p,{kind:'remove',entity:'nodes',id:'sensor'});assert(!noNode.automation!.knxObjects.some(o=>o.nodeId==='sensor'));assert(!noNode.automation!.links.some(l=>l.from==='sensor'||l.to==='sensor'));
assert.throws(()=>editAutomation(p,{kind:'remove',entity:'nodes',id:'tree'}),/Tree-Zweig/,'Reassign devices before deleting their interface');
assert.equal(inspectAutomation(p).length,0);assert.deepEqual(p.pages,drawing);
const history=new ProjectHistory();history.reset(p);history.record(noGroup);assert.deepEqual(history.undo(),p);assert.deepEqual(history.redo(),noGroup);
const rows=automationPlan(p);assert.deepEqual(automationPlan(JSON.parse(JSON.stringify(p))),rows);assert(automationCsv(rows).includes('Funkzuordnung'));assert(rows.some(r=>r.entity==='knxObjects'&&r.componentId===symbol.id));assert(automationPlanPdf(rows,'Building automation').getNumberOfPages()>0);

// Industrial & building bus rules: PROFIBUS DP, IO-Link, DALI, Modbus RTU rings, duplicate IPv4
{
 const profiProj=structuredClone(p);
 profiProj.pages=[];
 profiProj.automation={
  controllers:[],modules:[],channels:[],knxGroups:[],knxObjects:[],
  nodes:[
   {id:'pb-m',name:'DP Master',network:'DP1',protocol:'PROFIBUS DP',address:'2'},
   {id:'pb-s1',name:'Slave 1',network:'DP1',protocol:'PROFIBUS DP',address:'03'},
   {id:'pb-s2',name:'Slave 2',network:'DP1',protocol:'PROFIBUS DP',address:'126'},
  ],
  links:[
   {id:'pb-l1',from:'pb-m',fromPort:'A/B',to:'pb-s1',toPort:'A/B',lengthM:12},
   {id:'pb-l2',from:'pb-s1',fromPort:'A/B',to:'pb-s2',toPort:'A/B',lengthM:15},
  ],
 };
 assert.equal(inspectAutomation(profiProj).length,0,'PROFIBUS DP shared A/B bus & 0..126 valid');
 const pbOob=structuredClone(profiProj);pbOob.automation!.nodes[2].address='127';
 assert(inspectAutomation(pbOob).some(i=>i.message.includes('126')),'PROFIBUS DP rejects address >126');
 const pbDupe=structuredClone(profiProj);pbDupe.automation!.nodes[2].address='3';
 assert(inspectAutomation(pbDupe).length>0,'PROFIBUS DP detects numeric duplicate 03 vs 3');
 const pbRing=structuredClone(profiProj);pbRing.automation!.links.push({id:'pb-ring',from:'pb-s2',fromPort:'A/B',to:'pb-m',toPort:'A/B',lengthM:5});
 assert(inspectAutomation(pbRing).length>0,'PROFIBUS DP rejects closed ring');
}

{
 const ioProj=structuredClone(p);
 ioProj.pages=[];
 ioProj.automation={
  controllers:[],modules:[],channels:[],knxGroups:[],knxObjects:[],
  nodes:[
   {id:'iol-m',name:'IO-Link Master',network:'IOL1',protocol:'IO-Link',address:'192.168.0.20',ipAddress:'192.168.0.20'},
   {id:'iol-s1',name:'Sensor 1',network:'IOL1',protocol:'IO-Link',address:'Port 1'},
   {id:'iol-s2',name:'Sensor 2',network:'IOL1',protocol:'IO-Link',address:'Port 2'},
  ],
  links:[
   {id:'iol-l1',from:'iol-m',fromPort:'Port 1',to:'iol-s1',toPort:'L+/C/L-',lengthM:20},
   {id:'iol-l2',from:'iol-m',fromPort:'Port 2',to:'iol-s2',toPort:'L+/C/L-',lengthM:12},
  ],
 };
 assert.equal(inspectAutomation(ioProj).length,0,'IO-Link P2P distinct ports & 20m length valid');
 const ioOver=structuredClone(ioProj);ioOver.automation!.links[0].lengthM=21;
 assert(inspectAutomation(ioOver).some(i=>i.message.includes('20')),'IO-Link rejects >20m cable length');
 const ioReuse=structuredClone(ioProj);ioReuse.automation!.links[1].fromPort='Port 1';
 assert(inspectAutomation(ioReuse).length>0,'IO-Link rejects shared master port');
 const ioRing=structuredClone(ioProj);ioRing.automation!.links.push({id:'iol-ring',from:'iol-s1',fromPort:'X',to:'iol-s2',toPort:'X',lengthM:3});
 assert(inspectAutomation(ioRing).length>0,'IO-Link rejects closed ring');
}

{
 const daliProj=structuredClone(p);
 daliProj.pages=[];
 daliProj.automation={
  controllers:[],modules:[],channels:[],knxGroups:[],knxObjects:[],
  nodes:[
   {id:'d-m',name:'DALI Gateway',network:'DALI1',protocol:'DALI',address:'0'},
   {id:'d-1',name:'EVG 1',network:'DALI1',protocol:'DALI',address:'1'},
   {id:'d-2',name:'EVG 2',network:'DALI1',protocol:'DALI',address:'63'},
  ],
  links:[
   {id:'d-l1',from:'d-m',fromPort:'DA+/DA-',to:'d-1',toPort:'DA+/DA-',lengthM:150},
   {id:'d-l2',from:'d-1',fromPort:'DA+/DA-',to:'d-2',toPort:'DA+/DA-',lengthM:150},
  ],
 };
 assert.equal(inspectAutomation(daliProj).length,0,'DALI 0..63, shared DA+/DA- and 300m total valid');
 const daliOob=structuredClone(daliProj);daliOob.automation!.nodes[2].address='64';
 assert(inspectAutomation(daliOob).some(i=>i.message.includes('63')),'DALI rejects address >63');
 const daliOver=structuredClone(daliProj);daliOver.automation!.links[1].lengthM=151;
 assert(inspectAutomation(daliOver).some(i=>i.message.includes('300')),'DALI rejects >300m total cable length');
 const daliRing=structuredClone(daliProj);daliRing.automation!.links.push({id:'d-ring',from:'d-2',fromPort:'DA+/DA-',to:'d-m',toPort:'DA+/DA-',lengthM:10});
 assert(inspectAutomation(daliRing).length>0,'DALI rejects closed ring');
}

{
 const modRing=structuredClone(p);
 modRing.pages=[];
 modRing.automation={
  controllers:[],modules:[],channels:[],knxGroups:[],knxObjects:[],
  nodes:[
   {id:'mb-1',name:'Master',network:'RS485',protocol:'Modbus RTU',address:'1'},
   {id:'mb-2',name:'Slave 2',network:'RS485',protocol:'Modbus RTU',address:'2'},
   {id:'mb-3',name:'Slave 3',network:'RS485',protocol:'Modbus RTU',address:'3'},
  ],
  links:[
   {id:'mb-l1',from:'mb-1',fromPort:'A/B',to:'mb-2',toPort:'A/B',lengthM:10},
   {id:'mb-l2',from:'mb-2',fromPort:'A/B',to:'mb-3',toPort:'A/B',lengthM:10},
   {id:'mb-l3',from:'mb-3',fromPort:'A/B',to:'mb-1',toPort:'A/B',lengthM:10},
  ],
 };
 assert(inspectAutomation(modRing).length>0,'Modbus RTU rejects closed ring');
}

{
 const ipDupe=structuredClone(p);
 ipDupe.pages=[];
 ipDupe.automation={
  controllers:[],modules:[],channels:[],knxGroups:[],knxObjects:[],
  nodes:[
   {id:'pn-1',name:'PLC 1',network:'PN1',protocol:'PROFINET',address:'plc1',ipAddress:'192.168.0.10'},
   {id:'pn-2',name:'ET200 1',network:'PN1',protocol:'PROFINET',address:'et1',ipAddress:'192.168.0.10'},
  ],
  links:[],
 };
 assert(inspectAutomation(ipDupe).some(i=>i.message.includes('IP-Adresse im selben Netz')),'PROFINET detects duplicate IPv4 in same network');
}

console.log('✓ KNX/Loxone: address namespaces, group aliases, object/DPT consistency, separate branches, Link/Tree topology, interface capacity boundaries, explicit lengths, wireless association, persistence, history and reports');
