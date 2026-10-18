import assert from 'node:assert/strict';
import { EXTENDED_SYMBOL_DEFINITIONS as symbols } from './ExtendedSymbols';
import { ELEMENT_CATEGORIES, symbolMatchesQuery } from './SymbolCatalogue';
import { SYMBOL_DEFINITIONS, getSymbolById, getSymbolForComponent, setProjectSymbolLibrary } from './symbols';
import { snapSymbolPosition } from './DrawingGrid';
import { rotatedLocalPoint, scaleSymbolDefinition } from './SymbolGeometry';
import { MacroManager } from './MacroManager';
import { AutoconnectEngine } from './AutoconnectEngine';
import { nextDeviceTag } from './DeviceTag';
import { CadCanvas } from '../editor/CadCanvas';
import { PdfExporter } from '../export/PdfExporter';
import type { Project, Page, PlacedComponent } from './types';

// Independent coverage checklist from the requested component families.
const families = ['mcb','rcd','rcbo','afdd','mpcb','fuses','spd','power_breaker',
  'power_contactor','aux_relay','impulse_relay','installation_contactor','ssr','timer_relay','safety_relay','isolator',
  'feed_terminal','installation_terminal','pe_terminal','disconnect_terminal','fused_terminal','phase_busbar','distribution_block',
  'psu','transformer','ups','converter','current_transformer','energy_meter',
  'command','signal','limit_switch','proximity','process_sensor','plc','io','knx','network','interface',
  'vfd','softstarter','brake_resistor','line_filter','light_switch','socket','twilight','motion','time_switch',
  'rail','duct','climate','cabinet_accessory'];
assert.deepEqual([...new Set(symbols.map(s=>s.family))].sort(),families.sort());
assert.equal(new Set(SYMBOL_DEFINITIONS.map(s=>s.id)).size,SYMBOL_DEFINITIONS.length,'Stable IDs must never shadow an existing symbol');
for(const symbol of symbols){
  assert.match(symbol.id,/^catalog_[a-z0-9_]+$/);
  assert(ELEMENT_CATEGORIES.some(c=>c.id===symbol.category),`${symbol.name}: reachable category`);
  assert(symbol.svgContent && symbol.importedGraphics?.length,`${symbol.name}: same vectors in editor and PDF`);
  assert(!symbol.articleNumber&&!symbol.manufacturer,'Generic variants must not invent manufacturer articles');
  assert.equal(new Set(symbol.pins.map(p=>p.id)).size,symbol.pins.length);
  for(const pin of symbol.pins){
    assert(pin.x>=0&&pin.x<=symbol.width&&pin.y>=0&&pin.y<=symbol.height,`${symbol.id}: port inside bounds`);
    assert.equal(pin.direction==='top'?pin.y:pin.direction==='bottom'?pin.y-symbol.height:pin.direction==='left'?pin.x:pin.x-symbol.width,0,`${symbol.id}: outward-facing port`);
  }
  for(const unitsPerMm of [2,4])for(const rotation of [0,90,180,270] as const){
    const scaled=scaleSymbolDefinition(symbol,unitsPerMm),step=4*unitsPerMm;
    const origin={x:3,y:5};
    const pos=snapSymbolPosition({x:113,y:197},scaled,rotation,{spacing:step,origin},step);
    for(const pin of scaled.pins){
      const p=rotatedLocalPoint(pin,scaled,rotation);
      assert(Math.abs((pos.x+p.x-origin.x)/step-Math.round((pos.x+p.x-origin.x)/step))<1e-9,`${symbol.id}: X grid after ${rotation}°`);
      assert(Math.abs((pos.y+p.y-origin.y)/step-Math.round((pos.y+p.y-origin.y)/step))<1e-9,`${symbol.id}: Y grid after ${rotation}°`);
    }
  }
}
const family=(name:string)=>symbols.filter(s=>s.family===name);
for(const poles of ['1P','1P+N','3P','3P+N'])for(const curve of ['B','C','D','K','Z'])assert(family('mcb').some(s=>s.variantProperties?.Pole===poles&&s.variantProperties.Charakteristik===curve));
for(const poles of ['2P','4P'])for(const type of ['A','F','B','B+'])for(const current of ['10 mA','30 mA','100 mA','300 mA'])assert(family('rcd').some(s=>s.variantProperties?.Pole===poles&&s.variantProperties.Typ===type&&s.variantProperties.Auslösestrom===current));
assert.deepEqual(family('isolator').filter(s=>!s.id.includes('repair')).map(s=>s.pins.length),[6,8,10,12,14,16]);
for(const symbol of [...family('socket'),...family('cabinet_accessory').filter(s=>s.id.endsWith('service_socket'))])assert(symbol.pins.every(p=>p.direction==='top'),'Socket contacts have one connection side');
for(const symbol of [...family('rail'),...family('duct')])assert.equal(symbol.pins.length,0,'Mechanical parts have no invented electrical ports');
const copper=family('distribution_block').find(s=>s.id.endsWith('copper'))!;
assert.equal(copper.pins.filter(p=>p.direction==='top').length,3,'Cu system has separate phase inputs');
assert.equal(copper.pins.filter(p=>p.direction==='bottom').length,9);
const no=getSymbolById('catalog_command_push_no')!, nc=getSymbolById('catalog_command_push_nc')!;
assert.notDeepEqual(no.importedGraphics,nc.importedGraphics,'NO and NC must differ in their contact geometry');
assert.deepEqual(nc.pins.map(p=>p.name),['21','22']);
assert.equal(getSymbolById('catalog_light_switch_cross')!.pins.length,4);
assert.equal(getSymbolById('catalog_light_switch_series')!.pins.length,3);
for(const query of ['FI 4P B+ 300 mA','LS 3P+N Z','KNX Jalousie 4','TH35 7,5','NH 4a','CEE 63','USB RS485','PE Schraube','Schuetz AC-3','Hilfsschuetz','Positionsschalter','Naeherungsschalter optisch','IO-Modul'])
  assert(symbols.some(s=>symbolMatchesQuery(s,query)),`Search by technical properties and aliases: ${query}`);
assert(!symbolMatchesQuery(no,'definitely missing'));
assert.equal(symbols.filter(s=>symbolMatchesQuery(s,'LS 3P+N Z')).length,1,'A characteristic letter must not match inside Schutzschalter');
const socket=getSymbolById('catalog_socket_schuko')!;
for(const rotation of [0,90,180,270] as const){
  const anchor=(id:string,x:number,y:number):PlacedComponent=>({id,symbolId:socket.id,x,y,rotation,bmk:'',functionText:'',pins:{}});
  const a=anchor('a',160,160),b=anchor('b',160,320);
  assert.equal(AutoconnectEngine.findAutoconnectPairs([a,b]).length,0,'Equally oriented one-sided sockets cannot autoconnect through their backs');
}
const mcb=getSymbolById('catalog_mcb_1p_b')!;
const breaker:PlacedComponent={id:'breaker',symbolId:mcb.id,x:160,y:80,rotation:0,bmk:'',functionText:'',pins:{}};
const outlet:PlacedComponent={id:'outlet',symbolId:socket.id,x:160,y:240,rotation:0,bmk:'',functionText:'',pins:{}};
const pairs=AutoconnectEngine.findAutoconnectPairs([breaker,outlet]);
assert(pairs.some(pair=>pair.pin1.componentId==='breaker'&&pair.pin1.pinId==='2'&&pair.pin2.pinId==='L'),'Facing breaker output and socket input autoconnect');

const page={id:'page',pageNumber:'1',title:'Bibliothek',higherLevel:'',location:'',components:[],wires:[],grid:{spacing:8,origin:{x:0,y:0}},plotFrame:{width:1000,height:700}} as unknown as Page;
const project={id:'test',pages:[page]} as Project;setProjectSymbolLibrary(project);
const canvas:any=Object.assign(Object.create(CadCanvas.prototype),{project,activePage:page,ghostRotation:0,gridSize:8,gridResolution:'full',
  callbacks:{onSelectComponent:()=>{},onProjectModified:()=>{}},clearMultipleSelection:()=>{},notifyModified:()=>{},render:()=>{}});
canvas.activeSymbolToPlace='catalog_mcb_1p_b';const first:PlacedComponent=canvas.placeSymbolAt(100,100);
canvas.activeSymbolToPlace='catalog_rcd_4p_bplus_300';const second:PlacedComponent=canvas.placeSymbolAt(200,200);
assert.equal(first.bmk,'-F1');assert.equal(second.bmk,'-F2','Different protection variants share the BMK sequence');
assert.match(second.technicalCharacteristics!,/300 mA/);
assert.deepEqual(Object.keys(second.pins),getSymbolById(second.symbolId)!.pins.map(p=>p.id));
const other={...page,id:'other',components:[{...first,id:'other-f',bmk:'-F3'}]};project.pages.push(other);
assert.equal(nextDeviceTag(project,'-F'),'-F4','Other pages reserve their existing BMKs');
assert.equal(nextDeviceTag(project,''),'','Mechanical items keep an empty BMK');
project.pages.pop();
const saved=JSON.parse(JSON.stringify(project)) as Project;
assert.equal(getSymbolForComponent(saved.pages[0].components[1],saved)!.id,second.symbolId);
const macro=MacroManager.createMacroFromComponents('Library variants','','',page.components);
const exported=MacroManager.exportMacro(macro);
const parsed=await MacroManager.parseMacroFile(new File([exported.blob],exported.filename));
assert.equal(parsed.type,'ema');if(parsed.type!=='ema')throw new Error('Expected window macro');
const destination={...project,pages:[{...page,id:'destination',components:[]}],symbolLibrary:[]} as Project;
const placed=MacroManager.instantiateWindowMacro(parsed,320,320,[],destination);
assert.equal(placed.components.length,2);
assert.equal(getSymbolForComponent(placed.components[1],destination)!.pins.length,8);
assert.equal(placed.components[1].technicalCharacteristics,second.technicalCharacteristics);
// Exercise actual PDF rendering for every added symbol: no ID-specific fallback.
const moduleSymbol=getSymbolById('catalog_plc_compact')!;
const moduleComponent:PlacedComponent={id:'module',symbolId:moduleSymbol.id,bmk:'-A1',functionText:'SPS',x:160,y:160,rotation:90,pins:{}};
const modulePage={...page,components:[moduleComponent]};
const renderCanvas=Object.assign(Object.create(CadCanvas.prototype),{activePage:modulePage,project});
assert.match(renderCanvas.renderComponents(),/class="source-pin-label"/,'Built-in modules use library pin label anchors in the editor');
const pdf:any={},texts:string[]=[],lines:number[][]=[],pdfLabels:{text:string;x:number;y:number;angle:number}[]=[];
for(const name of ['setLineWidth','setLineDashPattern','setDrawColor','setTextColor','setFillColor','setFont','setFontSize','circle','rect','path','fillStroke','stroke'])pdf[name]=()=>{};
pdf.text=(value:string,x:number,y:number,options:any={})=>{texts.push(value);pdfLabels.push({text:value,x,y,angle:options.angle??0});};pdf.line=(...v:number[])=>lines.push(v);
const allPage={...page,components:symbols.map((s,i)=>({id:'all'+i,symbolId:s.id,bmk:'',functionText:'',pins:{},x:160,y:160,rotation:0 as const}))};
(PdfExporter as any).renderComponents(pdf,allPage,project,420,297,{colorMode:'color'},new Map());
assert(lines.length>symbols.length*2,'Every catalogue symbol reaches the PDF vector renderer');
assert(texts.includes('CPU')&&texts.includes('VFD')&&texts.includes('TH35'));
pdfLabels.length=0;
(PdfExporter as any).renderComponents(pdf,modulePage,project,420,297,{colorMode:'color'},new Map());
const supplyLabel=pdfLabels.find(p=>p.text==='L+')!;
assert(Math.abs(supplyLabel.x-123.48)<1e-8 && Math.abs(supplyLabel.y-216*297/700)<1e-8,'PDF and editor share module label anchors after rotation');
assert.equal(Math.abs(supplyLabel.angle),0,'Pin label text stays upright');
console.log(`✓ ${symbols.length} added symbols / ${families.length} families: coverage, directional ports, grid at all rotations and scales, search, editable placement, unique BMKs, JSON/macro round trip and PDF vectors`);
