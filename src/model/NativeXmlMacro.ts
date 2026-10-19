import { isNativeExchangeRoot } from './LegacyCompatibility';
import { pruneElementGroups } from './ElementGroups';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { MacroItem, WindowMacro, PageMacro } from './MacroManager';
import type { DrawingPrimitive, PlacedComponent, SymbolDefinition, Project, Wire, ElementGroup, Page } from './types';
import { drawingToSvg } from './ImportedDrawing';
import { nativeXmlSymbol, xmlChildren as children, xmlTag as tag, xmlPoint } from './NativeXmlSymbol';
import { AutoconnectEngine } from './AutoconnectEngine';
import { rotatedLocalPoint } from './SymbolGeometry';
import { graphicBounds as bounds, translateGraphics } from './NativeXmlGraphics';
import { nativeXmlText } from './NativeXmlText';
import { readXmlRecords } from './NativeXmlRecords';
import { readMacroVariables } from './NativeMacroVariables';
import { remapNativeMacroData } from './NativeMacroData';

export interface NativeXmlMacroOptions { allowMissing?: boolean }

/** Drawings, electrical references and nonprinting source configuration have
 * separate import paths. Unknown drawable types still fail explicitly. */
export function parseNativeXmlMacro(xml: string, filename: string, available: readonly SymbolDefinition[] = [],
  options: NativeXmlMacroOptions = {}): MacroItem {
  const invalid = () => { throw new Error('Die Makrodatei enthält ungültiges XML.'); };
  if (/<!DOCTYPE\b/i.test(xml)) invalid();
  const doc = new DOMParser({ errorHandler: invalid }).parseFromString(xml, 'application/xml');
  const root = doc.documentElement;
  if (!root || !isNativeExchangeRoot(tag(root))) invalid();
  const kind = root.getAttribute('Type');
  if (kind !== 'WindowMacro' && kind !== 'PageMacro' && kind !== 'ContourDefinition')
    throw new Error('Dieser XML-Makrotyp wird noch nicht unterstützt.');
  const variants = children(root).filter(n => tag(n) === 'MacroVariant');
  const variant = kind === 'ContourDefinition' ? root : variants.find(n => n.getAttribute('MacroFuncType') === '1' && n.getAttribute('VariantId') === '0')
    ?? variants.find(n => n.getAttribute('VariantId') === '0') ?? variants[0];
  if (!variant) throw new Error('Die Makrodatei enthält keine Variante.');
  const projection=kind==='WindowMacro'&&variant.getAttribute('MacroFuncType')==='10'&&!children(variant).some(n=>tag(n)==='O4');
  const pages = kind === 'ContourDefinition' ? [root] : projection?[variant]:children(variant).filter(n => tag(n) === 'O4');
  if (!pages.length) throw new Error('Das XML-Makro enthält keinen Zeichenbereich.');
  const units = 2, diagnostics: string[] = [], mappings = new Map<Element,string>();
  if(projection)diagnostics.push('3D-Makro als 2D-Draufsicht (XY-Kantenprojektion) importiert. Keine 3D-Bearbeitung oder elektrische Anschlüsse; die Quelldaten bleiben erhalten.');
  const name = root.getAttribute('Name') || filename.replace(/\.[^.]+$/, '');
  const description = nativeXmlText(variant.getAttribute('Description') || root.getAttribute('Description') || '');
  const nativeData: NonNullable<WindowMacro['nativeData']> = { kind, metadata: [], variables: [] };
  if(!projection){
    const serializer=new XMLSerializer();
    for(const node of children(variant).filter(n=>['O6','O14','O76'].includes(tag(n))))
      nativeData.metadata.push({id:node.getAttribute('A1')??'',type:tag(node),xml:serializer.serializeToString(node)});
  }
  const importPage = (page: Element, pageIndex: number): WindowMacro => {
    const records = readXmlRecords(root,page,units,diagnostics,options.allowMissing === true);
    nativeData.metadata.push(...records.metadata);
    const electrical = records.electrical.map(node => ({node,...nativeXmlSymbol(node,variant,available,units,
      {allowMissing:options.allowMissing,diagnostics})}));
    const entries = records.drawings;
    if (!entries.length && !electrical.length && !records.images.length && kind !== 'PageMacro')
      throw new Error('Die Makrodatei enthält keine unterstützten Grafikobjekte.');
    const all: DrawingPrimitive[] = [...entries.flatMap(e=>e.graphics),...records.images.map(image=>({
      kind:'rect' as const,x:image.x,y:image.y,width:image.width,height:image.height,color:'currentColor'})),
      ...electrical.map(({component:c,symbol:s}):DrawingPrimitive=>{
        const points=[{x:0,y:0},{x:s.width,y:0},{x:0,y:s.height},{x:s.width,y:s.height}].map(p=>rotatedLocalPoint(p,s,c.rotation));
        const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
        return {kind:'rect',x:c.x+x,y:c.y+y,width:Math.max(...points.map(p=>p.x))-x,
          height:Math.max(...points.map(p=>p.y))-y,color:'currentColor'};
      })];
    const total=all.length?bounds(all):{x:0,y:0,width:840,height:594};
    let reference = total as {x:number;y:number};
    if(variant.hasAttribute('ReferencePoint')){
      if(projection){
        const p=variant.getAttribute('ReferencePoint')!.split('/').map(Number);
        if(p.length!==3||p.some(n=>!Number.isFinite(n)))throw new Error('Ungültiger 3D-Bezugspunkt.');
        reference={x:p[0]*units,y:-p[1]*units};
      }else reference=xmlPoint(variant,'ReferencePoint',units);
    }
    const id=`user_xml_${crypto.randomUUID()}`;
    const symbolLibrary:SymbolDefinition[]=[],components:PlacedComponent[]=[];
    for (const [index,entry] of entries.entries()) {
      const box=bounds(entry.graphics),graphics=translateGraphics(entry.graphics,-box.x,-box.y);
      const text=graphics.length===1&&graphics[0].kind==='text'&&!(graphics[0].rotation??0)?graphics[0]:undefined;
      const immutableGraphics=text?[]:graphics;
      const symbol:SymbolDefinition={id:`macro:${id}:${index}`,name,category:'controls',standard:'DIN EN 60617',
        defaultBmkPrefix:'',defaultFunctionText:'',width:Math.max(1,box.width),height:Math.max(1,box.height),
        unitsPerMm:units,insertionPoint:{x:reference.x-box.x,y:reference.y-box.y},pins:[],
        importedGraphics:immutableGraphics,svgContent:drawingToSvg(immutableGraphics),description};
      symbolLibrary.push(symbol);
      const componentId=crypto.randomUUID();mappings.set(entry.node,componentId);
      for(const alias of entry.aliases??[])mappings.set(alias,componentId);
      components.push({id:componentId,symbolId:symbol.id,bmk:'',functionText:text?.text??'',
        ...(text?{functionTextPosition:{preset:'custom',offsetX:text.x-symbol.width/2,offsetY:text.y-symbol.height-12,
          fontSize:text.size,alignment:text.anchor??'start',visible:true}}:{}),
        x:box.x-total.x,y:box.y-total.y,rotation:0,pins:{}});
    }
    for(const {node,symbol,component}of electrical){
      mappings.set(node,component.id);if(!symbolLibrary.some(s=>s.id===symbol.id))symbolLibrary.push(symbol);
      component.x-=total.x;component.y-=total.y;components.push(component);
    }
    for(const image of records.images){image.x-=total.x;image.y-=total.y;}
    const context={drawingUnitsPerMm:units,symbolLibrary}as Project;
    const wires:Wire[]=AutoconnectEngine.findAutoconnectPairs(components,1e-6,.01,context).map(pair=>({
      id:crypto.randomUUID(),from:{componentId:pair.pin1.componentId,pinId:pair.pin1.pinId},
      to:{componentId:pair.pin2.componentId,pinId:pair.pin2.pinId},potential:'Signal',lineWidth:.25*units}));
    for(const wire of wires)for(const end of[wire.from,wire.to])components.find(c=>c.id===end.componentId)!.pins[end.pinId].wireIds!.push(wire.id);
    const groupIds=new Map(records.groups.map(n=>[n,'group_'+crypto.randomUUID()]));
    const groups:ElementGroup[]=records.groups.map(node=>({id:groupIds.get(node)!,members:children(node).flatMap<ElementGroup['members'][number]>(child=>{
      const groupId=groupIds.get(child),componentId=mappings.get(child),imageId=records.imageMappings.get(child);
      return groupId?[{kind:'group',id:groupId}]:componentId?[{kind:'component',id:componentId}]:imageId?[{kind:'image',id:imageId}]:[];
    })}));
    const groupPage={components,wires,groups,images:records.images}as Page;pruneElementGroups(groupPage);
    return {id,name:pages.length>1?`${name} · ${pageIndex+1}`:name,type:'ema',category:kind==='ContourDefinition'?'Importierte Konturen':'Importierte Grafikmakros',
      description,isBuiltIn:false,unitsPerMm:units,symbolLibrary,components,wires,images:records.images,groups:groupPage.groups,
      handlePoint:{x:reference.x-total.x,y:reference.y-total.y},width:Math.max(1,total.width),height:Math.max(1,total.height)};
  };
  const imported=pages.map(importPage);
  nativeData.variables=readMacroVariables(variant,mappings,pages);
  const importDiagnostics=[...new Set(diagnostics)];
  if(kind!=='PageMacro'&&imported.length===1)return {...imported[0],nativeData,importDiagnostics};
  const actualPages:Page[]=imported.map((m,index)=>{
    const properties=children(pages[index]).find(n=>tag(n)==='P11');
    return {id:'macro_page_'+crypto.randomUUID(),pageNumber:String(index+1),pageType:'schematic',
      title:nativeXmlText(properties?.getAttribute('P11011')??'')||m.name,higherLevel:'',location:'',components:m.components,wires:m.wires??[],
      images:m.images,groups:m.groups,importDiagnostics,plotFrame:{type:'DIN_A3_LANDSCAPE',width:Math.max(840,m.width+40),
        height:Math.max(594,m.height+40),columns:10,rows:['A','B','C','D','E','F'],titleBlock:{projectTitle:name,
          commission:'',company:'',author:'',date:'',revision:'',sheetNumber:String(index+1),totalSheets:String(imported.length)}}};
  });
  const library=new Map(imported.flatMap(m=>m.symbolLibrary??[]).map(s=>[s.id,s]));
  for(const variable of nativeData.variables)for(const binding of variable.bindings)if(binding.pageId!==undefined)
    binding.pageId=actualPages[Number(binding.pageId)]?.id??binding.pageId;
  for(const page of actualPages)page.nativeData=remapNativeMacroData(nativeData,new Map(page.components.map(c=>[c.id,c.id])),page.id,page.id);
  return {id:imported[0].id,name,type:'ems',category:'Importierte Seitenmakros',description,isBuiltIn:false,unitsPerMm:units,
    symbolLibrary:[...library.values()],page:actualPages[0],pages:actualPages,nativeData,importDiagnostics}as PageMacro;
}
