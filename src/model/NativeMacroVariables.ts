import type { MacroVariable } from './NativeMacroData';
import type { MacroItem } from './MacroManager';
import type { PlacedComponent } from './types';
import { xmlChildren as children, xmlTag as tag } from './NativeXmlSymbol';
import { nativeXmlText } from './NativeXmlText';

export function readMacroVariables(root: Element, mappings: Map<Element,string>, pages: Element[]): MacroVariable[] {
  const variables=new Map<string,MacroVariable>();
  const byId=new Map(Array.from(root.getElementsByTagName('*')).filter(n=>n.hasAttribute('A1')).map(n=>[n.getAttribute('A1'),n]));
  for(const placeholder of Array.from(root.getElementsByTagName('O106'))){
    for(const target of children(placeholder).filter(n=>tag(n)==='S109x1895')){
      const node=byId.get(target.getAttribute('R1906')),componentId=node&&mappings.get(node);
      const pageIndex=node?pages.indexOf(node):-1;
      if(!componentId&&pageIndex<0)continue;
      for(const assignment of children(target).filter(n=>tag(n)==='S115x1904')){
        const template=nativeXmlText(assignment.getAttribute('A1913')??''),property=Number(assignment.getAttribute('A1911'));
        if(!Number.isInteger(property))continue;
        const actual=node?.getAttribute('A511')??(property===20010?'-'+[20013,20014,20015].map(p=>children(node!).find(n=>tag(n)==='P144')?.getAttribute('P'+p)??'').join('')
          :children(node!).find(n=>n.hasAttribute('P'+property))?.getAttribute('P'+property)??'');
        for(const match of template.matchAll(/<([^<>]+)>/g)){
          const name=match[1],existing=variables.get(name),variable=existing??{name,value:'',bindings:[]};
          if(!existing){
            const value=nativeXmlText(actual),parts=template.split(`<${name}>`);
            if(parts.length===2&&value.startsWith(parts[0])&&value.endsWith(parts[1]))variable.value=value.slice(parts[0].length,parts[1]?value.length-parts[1].length:undefined);
          }
          variable.bindings.push({...componentId?{componentId}:{pageId:String(pageIndex)},property,template});
          variables.set(name,variable);
        }
      }
    }
  }
  return [...variables.values()];
}

const fieldMap:Record<number,keyof PlacedComponent>={20010:'bmk',20011:'functionText',19201:'functionText',20025:'additionalText',
  20027:'technicalCharacteristics',20030:'deviceTag',20100:'articleNumber',20001:'higherLevelFunction',20002:'mountingLocation',1700:'functionText'};

/** Configure a copy before placing; the external library remains unchanged. */
export function macroWithVariables<T extends MacroItem>(macro:T,values:Record<string,string>):T {
  const copy=structuredClone(macro),data=copy.nativeData;
  if(!data)return copy;
  const pages=copy.type==='ema'?[]:copy.pages??[copy.page];
  const components=copy.type==='ema'?copy.components:pages.flatMap(p=>p.components);
  const allValues=Object.fromEntries(data.variables.map(v=>[v.name,values[v.name]??v.value]));
  const applied=new Set<string>();
  for(const variable of data.variables){
    variable.value=allValues[variable.name];
    for(const binding of variable.bindings){
      if(![...binding.template.matchAll(/<([^<>]+)>/g)].some(m=>m[1] in values))continue;
      const key=`${binding.componentId??binding.pageId}:${binding.property}:${binding.template}`;
      if(applied.has(key))continue;applied.add(key);
      const value=binding.template.replace(/<([^<>]+)>/g,(_,name)=>allValues[name]??'');
      if(binding.componentId){
        const c=components.find(c=>c.id===binding.componentId);if(!c)continue;
        (c.nativeProperties??={})['P'+binding.property]=value;
        const field=fieldMap[binding.property];
        if(field)(c as unknown as Record<string,unknown>)[field]=value;
        else if([20013,20014,20015].includes(binding.property)){
          c.bmk='-'+[20013,20014,20015].map(p=>nativeXmlText(c.nativeProperties?.['P'+p]??'')).join('');
        }
      }else if(binding.pageId!==undefined){
        const page=pages.find(p=>p.id===binding.pageId)??pages[Number(binding.pageId)];
        if(page&&binding.property===11011)page.title=value;
      }
    }
  }
  if(copy.type==='ems'&&copy.pages?.length)copy.page=copy.pages[0];
  return copy;
}
