import assert from 'node:assert/strict';
import {fixture,add as fixtureAdd} from '../layout/testing/fixture';
import {getSymbolById,getSymbolForComponent,setProjectSymbolLibrary} from './symbols';
import {TERMINAL_SYMBOLS} from './TerminalSymbols';
import {terminalLevels,terminalLevelValues,validTerminalLevelSettings} from './TerminalFunctions';
import {ProjectIndex} from './ProjectIndex';
import {ElectricalNetService} from './ElectricalNetService';
import {TerminalDiagramGenerator} from '../reports/TerminalDiagram';
import {PartsListGenerator} from '../reports/PartsList';
import {WiringEditPlan,inspectWiring} from './WiringManagement';
import {setArticleAssignment} from './ArticleAssignments';
import {terminalCableSnapshot,terminalStripCards} from '../ui/TerminalCableVisuals';
import {terminalFields} from '../ui/TerminalFields';
import {terminalFunctionLabels} from './LabelLayout';
import {AutoconnectEngine} from './AutoconnectEngine';
import {snapSymbolPosition} from './DrawingGrid';
import {MacroManager} from './MacroManager';
import {getLocalizedSymbol,setUiLanguage} from '../i18n';
import {PdfExporter} from '../export/PdfExporter';
import {jsPDF} from 'jspdf';
import {componentShapes} from '../layout/geometry';

const add=(...args:Parameters<typeof fixtureAdd>)=>{const c=fixtureAdd(...args);c.functionText=getSymbolForComponent(c,args[0])!.defaultFunctionText;return c;};

for(const id of ['terminal_single','terminal_pe',...TERMINAL_SYMBOLS.map(s=>s.id)])assert.equal(getSymbolById(id)!.defaultFunctionText,'');
for(const base of TERMINAL_SYMBOLS){
  const p=fixture();setProjectSymbolLibrary(p);const c=add(p,'subject',base.id,80,80),s=getSymbolForComponent(c,p)!;
  assert.equal(c.functionText,'');
  assert(terminalLevels(s).length>0);
  for(const units of [2,4])for(const rotation of [0,90,180,270] as const){
    const context={...p,drawingUnitsPerMm:units},symbol=getSymbolById(s.id,context)!,step=2*units;
    const pos=snapSymbolPosition({x:93,y:137},symbol,rotation,{spacing:4*units,origin:{x:0,y:0}},step);
    for(const pin of symbol.pins){const v=AutoconnectEngine.getRotatedPinInfo({...c,...pos,rotation},pin,symbol);
      assert(Math.abs(v.worldX/step-Math.round(v.worldX/step))<1e-9);
      assert(Math.abs(v.worldY/step-Math.round(v.worldY/step))<1e-9);}
  }
  const index=new ProjectIndex(p),nets=new ElectricalNetService(index),entry=index.component(c.id,p.pages[0].id)!;
  const net=(id:string)=>nets.netForPin(index.pin(entry,id)!)!.id;
  for(const level of terminalLevels(s)){
    const ids=new Set(level.pinIds.map(net));assert.equal(ids.size,level.disconnectable?level.pinIds.length:1);
  }
  const fixed=terminalLevels(s).filter(l=>!l.disconnectable);
  assert.equal(new Set(fixed.map(l=>net(l.pinIds[0]))).size,fixed.length,'Different levels must never be shorted by their common housing');
  if(s.id.startsWith('terminal_feed_'))assert.equal(new Set(s.pins.map(pin=>net(pin.id))).size,1,'All 3/4 wire connection points share one potential');
  assert(!nets.issues.some(i=>i.code==='neutral_pe_connection'));
  const en=getLocalizedSymbol(s,'en');assert(!en.name.includes('klemme'));
}

const multi=fixture();setProjectSymbolLibrary(multi);const distributor=add(multi,'distributor','terminal_feed_4',80,80);distributor.bmk='-X9:1';
for(const id of ['a','b','c','d']){const target=add(multi,'target'+id,'terminal_single',240,80);target.bmk='-T'+id+':1';multi.pages[0].wires.push({id:'w'+id,from:{componentId:distributor.id,pinId:id},to:{componentId:target.id,pinId:'1'},potential:'Signal'});}
const distributionRow=TerminalDiagramGenerator.generateTerminalReport(multi).get('-X9')![0];
assert.match(distributionRow.internalTarget,/a: -Ta:1:1/);
for(const id of ['b','c','d'])assert(distributionRow.externalTarget.includes(id+': -T'+id+':1:1'),'Multiwire targets retain the exact originating connection point');

const p=fixture();setProjectSymbolLibrary(p);const c=add(p,'stock','terminal_triple',80,80);c.bmk='-X1:7';
c.terminal={strip:'-X1',number:'7',level:'',pinSides:{},levels:{'1':{designation:'LOW',functionText:'Supply'},'2':{designation:'MID',functionText:'Sensor'},'3':{designation:'HIGH',functionText:''}}};
for(let level=1;level<=3;level++)for(const [i,pinId] of [level+'.a',level+'.b'].entries()){
  const target=add(p,'target-'+pinId,'terminal_single',240+level*80,80+i*160);target.bmk='-TARGET'+level+':'+i;
  p.pages[0].wires.push({id:'wire-'+pinId,from:{componentId:c.id,pinId},to:{componentId:target.id,pinId:'1'},potential:'Signal'});
}
const report=TerminalDiagramGenerator.generateTerminalReport(p).get('-X1')!;
assert.equal(report.length,3);assert.deepEqual(report.map(r=>r.terminalNumber),['7/LOW','7/MID','7/HIGH']);
assert.deepEqual(report.map(r=>r.functionText),['Supply','Sensor','']);
assert.deepEqual(report.map(r=>r.mainFunction),[true,false,false]);
for(let i=0;i<3;i++){
  assert.match(report[i].internalTarget,new RegExp('-TARGET'+(i+1)+':0:1'));
  assert.match(report[i].externalTarget,new RegExp('-TARGET'+(i+1)+':1:1'));
  assert(!report[i].internalTarget.includes('-TARGET'+((i+1)%3+1)));
}
assert(!inspectWiring(p).some(i=>i.code==='terminal_number_duplicate'));
const snapshot=terminalCableSnapshot(p),rows=snapshot.terminals.filter(r=>r.entry.componentId===c.id);
assert.equal(new Set(rows.map(r=>r.key)).size,3);assert(rows.every(r=>JSON.parse(r.key).length===3));
assert.equal((terminalStripCards(rows,[]).match(/data-terminal-key=/g)??[]).length,3);
const before=JSON.stringify(p);
const bridge=new WiringEditPlan(p,{kind:'bridge',from:{pageId:'p',componentId:c.id,pinId:'1.b'},to:{pageId:'p',componentId:c.id,pinId:'2.a'},bridgeType:'plug'}).apply(p);
const connected=terminalCableSnapshot(bridge);assert.notEqual(connected.bridges[0].fromKey,connected.bridges[0].toKey);
assert.deepEqual(connected.bridges[0].fromKey,rows[0].key);assert.deepEqual(connected.bridges[0].toKey,rows[1].key);
assert.equal(JSON.stringify(p),before);
const pe=fixture();setProjectSymbolLibrary(pe);const install=add(pe,'install','terminal_installation_l_n_pe',80,80);
assert.throws(()=>new WiringEditPlan(pe,{kind:'bridge',from:{pageId:'p',componentId:install.id,pinId:'2.a'},to:{pageId:'p',componentId:install.id,pinId:'3.b'},bridgeType:'wire'}),/wiringPotentialConflict/);
assert.equal(install.functionText,'');
const bad=structuredClone(c);bad.terminal!.levels!['2'].designation='LOW';assert(!validTerminalLevelSettings(bad,getSymbolForComponent(c,p)));
assert.throws(()=>new WiringEditPlan(p,{kind:'terminal',target:{pageId:'p',componentId:c.id},settings:bad.terminal!}),/wiringInvalid/);
const duplicate=structuredClone(p),extra=add(duplicate,'duplicate','terminal_single',560,80);extra.bmk='-X1:7';extra.terminal={strip:'-X1',number:'7',level:'MID',pinSides:{}};
assert.equal(inspectWiring(duplicate).filter(i=>i.code==='terminal_number_duplicate').length,2);
setArticleAssignment(c,[{articleNumber:'MULTI-3',manufacturer:'Synthetic',variant:'',quantity:1,role:'main'}]);
assert.equal(PartsListGenerator.generatePartsList(p).find(r=>r.articleNumber==='MULTI-3')!.quantity,1,'Three electrical functions are one article');
const shape=getSymbolForComponent(c,p)!;
assert(terminalFields(c,shape).includes('terminal-designation-2'));
setUiLanguage('en');assert(terminalFields(c,shape).includes('One physical device'));setUiLanguage('de');
const labels=terminalFunctionLabels(c,shape);assert.equal(labels.filter(l=>l.key.startsWith('level-text-')).length,2);
const shifted=terminalFunctionLabels({...c,pinLabelPosition:{offsetX:2,offsetY:3,rotation:90,fontSize:4}},shape)[0].position;
assert.deepEqual([shifted.x,shifted.y,shifted.rotation,shifted.fontSize],[labels[0].position.x+2,labels[0].position.y+3,90,4]);
assert(terminalFunctionLabels({...c,pinLabelPosition:{visible:false},functionTextPosition:{visible:false}},shape).every(l=>!l.position.visible));
const shapes=componentShapes(c,shape,p);assert(shapes.some(s=>s.text?.value==='MID'));
const texts:string[]=[];const pdf=new jsPDF();pdf.text=((value:string)=>{texts.push(value);return pdf;}) as typeof pdf.text;
(PdfExporter as any).renderComponents(pdf,p.pages[0],p,420,297,{colorMode:'monochrome'},new Map());
for(const value of ['LOW','MID','HIGH','Supply'])assert(texts.some(text=>text.replaceAll('\n','')===value));
setProjectSymbolLibrary(p);
const macro=MacroManager.createMacroFromComponents('Terminal','','',[c]);assert(macro.symbolLibrary?.[0].terminalDefinition);
const exported=MacroManager.exportMacro(macro),parsed=await MacroManager.parseMacroFile(new File([exported.blob],exported.filename));
assert(parsed.type==='ema');const dest=fixture();setProjectSymbolLibrary(dest);
const placed=MacroManager.instantiateWindowMacro(parsed,160,160,[],dest).components[0];
assert.deepEqual(placed.terminal,c.terminal);assert.deepEqual(terminalLevels(getSymbolForComponent(placed,dest)),terminalLevels(shape));
assert.deepEqual(TerminalDiagramGenerator.generateTerminalReport(JSON.parse(JSON.stringify(p))),TerminalDiagramGenerator.generateTerminalReport(p));
const malformed={...shape,terminalDefinition:{...shape.terminalDefinition!,levels:[{...shape.terminalDefinition!.levels[0],pinIds:['missing']}]}};
assert.deepEqual(terminalLevels(malformed),[]);
console.log('✓ Terminal functions: blank defaults; 3/4 common points; independent stock/L/N/PE levels; disconnects; rotated grid; level-specific targets/texts/keys/bridges; duplicate and N–PE guards; one article; editable bilingual fields; PDF/layout labels and portable macros');
