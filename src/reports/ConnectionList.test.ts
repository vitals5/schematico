import assert from 'node:assert/strict';
import {fixture,add} from '../layout/testing/fixture';
import {connectionList,filterConnections,connectionCsv,withConnectionLength} from './ConnectionList';
import {connectionListPdf} from '../export/ConnectionListPdf';
import {ProjectHistory} from '../model/ProjectHistory';
const p=fixture(),page=p.pages[0],a=add(p,'a','socket_schuko'),b=add(p,'b','socket_schuko'),c=add(p,'c','socket_schuko');
a.bmk='-X1';b.bmk='-X2';c.bmk='-X3';
page.wires=[{id:'n1',from:{componentId:a.id,pinId:'N'},to:{componentId:b.id,pinId:'N'},potential:'N',isAutoconnect:true},
{id:'n2',from:{componentId:b.id,pinId:'N'},to:{componentId:c.id,pinId:'N'},potential:'N',terminalBridge:'wire'},
{id:'pe',from:{componentId:a.id,pinId:'PE'},to:{componentId:b.id,pinId:'PE'},potential:'N'},
{id:'bad',from:{componentId:'absent',pinId:'1'},to:{componentId:b.id,pinId:'N'},potential:''}];
page.cables=[{id:'w',bmk:'-W1',cableType:'Test',crossSection:'1.5',start:{x:0,y:0},end:{x:1,y:1},cores:[{id:'core',designation:'1',color:'BU',t:0,wireIds:['n1']}]}];
p.logicalConnections=[{id:'log',from:{componentId:a.id,pinId:'1'},to:{componentId:c.id,pinId:'1'},potential:'L1'}];
const before=JSON.stringify(p),rows=connectionList(p),n=rows.find(r=>r.wireId==='n1')!,earth=rows.find(r=>r.wireId==='pe')!;
assert.equal(rows.length,5);assert.equal(n.kind,'autoconnect');assert.equal(rows.find(r=>r.wireId==='n2')!.kind,'bridge');assert.equal(rows.find(r=>r.wireId==='log')!.kind,'logical');
assert.equal(rows.find(r=>r.wireId==='log')!.pageNumber,page.pageNumber);assert.equal(n.cable,'-W1');assert.equal(n.core,'1');assert.equal(n.color,'BU');assert.equal(n.crossSection,'1.5');assert.equal(n.lengthMm,undefined);
assert.notEqual(n.netId,earth.netId,'Names do not merge different contact nets');assert(n.targets.includes('-X3:N'),'Branch participants are reported without inventing pairwise wires');assert.equal(n.from,'-X1:N');
assert(rows.find(r=>r.wireId==='bad')!.issues.length);assert.equal(JSON.stringify(p),before,'Report never changes project data');
assert.equal(filterConnections(rows,'-W1 BU').length,1);assert.equal(filterConnections(rows,'',page.id).length,5);assert.equal(filterConnections(rows,'','',true).length,1);
const history=new ProjectHistory();history.reset(p);const edited=withConnectionLength(p,n,1234.5);history.record(edited);assert.equal(connectionList(edited).find(r=>r.wireId==='n1')!.lengthMm,1234.5);assert.deepEqual(history.undo(),p);
assert.equal(connectionList(withConnectionLength(edited,n,undefined)).find(r=>r.wireId==='n1')!.lengthMm,undefined);
assert.throws(()=>withConnectionLength(p,n,-1));assert.throws(()=>withConnectionLength(p,n,NaN));assert.throws(()=>withConnectionLength(p,{...n,wireId:'gone'},1));
const duplicate=structuredClone(p);duplicate.pages[0].wires.push(structuredClone(page.wires[0]));assert.throws(()=>withConnectionLength(duplicate,n,1));assert(connectionList(duplicate).filter(r=>r.wireId==='n1').every(r=>r.issues.length));
const conflict=structuredClone(p);conflict.pages[0].cables![0].cores.push({...conflict.pages[0].cables![0].cores[0],id:'core2'});assert(connectionList(conflict).find(r=>r.wireId==='n1')!.issues.includes('Mehrere Kabel-/Aderzuordnungen'));
const csv=connectionCsv([{...n,from:'=SUM(1)',to:'a;"b\nc'}]);assert(csv.startsWith('\uFEFF'));assert(csv.includes("'=SUM(1)"));assert(csv.includes('a;""b\nc'));
const pdf=connectionListPdf(Array.from({length:130},(_,i)=>({...n,number:String(i),issues:[('Long text ').repeat(60)]})),'Test');assert(pdf.getNumberOfPages()>1);assert(pdf.output().startsWith('%PDF'));
assert.equal(connectionListPdf([],'Empty').getNumberOfPages(),1);
console.log('✓ Connection list: all connection kinds, branch topology, missing endpoints, filters, cable ambiguity, explicit lengths with undo, CSV escaping and paginated PDF');
