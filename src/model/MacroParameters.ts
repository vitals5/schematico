import type {MacroItem} from './MacroManager';
import type {MacroVariable} from './NativeMacroData';
import {macroWithVariables} from './NativeMacroVariables';
export interface MacroValueSet {id:string;name:string;values:Record<string,string>}
export interface MacroConfiguration {parameters:MacroVariable[];valueSets:MacroValueSet[]}
export const macroParameterFields:Record<number,string>={20010:'BMK',20011:'Funktionstext',20025:'Zusatztext',20027:'Technische Daten',20030:'Gerätebezeichnung',20001:'Anlage',20002:'Ort',11011:'Blatttitel'};
export const macroParameters=(m:MacroItem)=>[...(m.nativeData?.variables??[]),...(m.configuration?.parameters??[])];
export const macroComponents=(m:MacroItem)=>m.type==='ema'?m.components:(m.pages??[m.page]).flatMap(p=>p.components);
export const macroPages=(m:MacroItem)=>m.type==='ems'?m.pages??[m.page]:[];
export function validateMacroConfiguration(m:MacroItem):void{
  const parameters=macroParameters(m),names=new Set<string>(),bindings=new Map<string,string>();
  for(const p of parameters){
    if(!p.name.trim()||p.name!==p.name.trim()||p.name.length>80||/[<>]/.test(p.name)||['__proto__','constructor','prototype'].includes(p.name)||names.has(p.name))throw new Error('Parameternamen müssen ausgefüllt und eindeutig sein und dürfen keine spitzen Klammern enthalten.');
    names.add(p.name);if(typeof p.value!=='string')throw new Error('Parameterwerte müssen Text sein.');
  }
  for(const p of m.nativeData?.variables??[])for(const b of p.bindings)bindings.set(JSON.stringify([b.componentId??null,b.pageId??null,b.property]),b.template);
  for(const p of m.configuration?.parameters??[]){if(!p.bindings.length)throw new Error(`Parameter ${p.name} benötigt mindestens eine Bindung.`);
    for(const b of p.bindings){if(!macroParameterFields[b.property])throw new Error('Nicht unterstützte Parametereigenschaft.');
      if(b.componentId){if(b.property===11011||macroComponents(m).filter(c=>c.id===b.componentId).length!==1)throw new Error('Parameterelement ist nicht eindeutig vorhanden.');}
      else if(b.pageId===undefined||b.property!==11011||macroPages(m).filter(p=>p.id===b.pageId).length!==1)throw new Error('Parameterblatt ist nicht eindeutig vorhanden.');
      const tokens=[...b.template.matchAll(/<([^<>]+)>/g)].map(v=>v[1]);if(!tokens.includes(p.name)||tokens.some(name=>!names.has(name)))throw new Error('Die Vorlage muss den Parameter enthalten; alle Platzhalter müssen definiert sein.');
      const key=JSON.stringify([b.componentId??null,b.pageId??null,b.property]),previous=bindings.get(key);if(previous!==undefined&&previous!==b.template)throw new Error('Widersprüchliche Vorlagen für dieselbe Eigenschaft.');bindings.set(key,b.template);
    }
  }
  const ids=new Set<string>(),labels=new Set<string>();for(const s of m.configuration?.valueSets??[]){
    if(!s.id||ids.has(s.id)||!s.name.trim()||labels.has(s.name.trim()))throw new Error('Wertesätze benötigen eindeutige Kennungen und Namen.');ids.add(s.id);labels.add(s.name.trim());
    for(const [name,value]of Object.entries(s.values))if(!names.has(name)||typeof value!=='string')throw new Error('Wertesatz verweist auf unbekannte Parameter oder ungültige Werte.');
  }
}
/** Configure detached text/structure properties. Geometry and wiring stay intact. */
export function configureMacroValues<T extends MacroItem>(m:T,values:Record<string,string>={},setId?:string):T{
  validateMacroConfiguration(m);const parameters=macroParameters(m),known=new Set(parameters.map(p=>p.name)),set=setId?m.configuration?.valueSets.find(s=>s.id===setId):undefined;
  if(setId&&!set)throw new Error('Wertesatz nicht vorhanden.');
  for(const [name,value]of Object.entries(values))if(!known.has(name)||typeof value!=='string')throw new Error('Unbekannter Parameter oder ungültiger Wert.');
  const all=Object.fromEntries(parameters.map(p=>[p.name,values[p.name]??set?.values[p.name]??p.value]));
  const working=structuredClone(m);working.nativeData={kind:m.type==='ema'?'WindowMacro':'PageMacro',metadata:m.nativeData?.metadata??[],variables:structuredClone(parameters)};
  const custom=new Set(m.configuration?.parameters.map(p=>p.name)??[]);
  const changed=Object.fromEntries(parameters.filter(p=>custom.has(p.name)||all[p.name]!==p.value).map(p=>[p.name,all[p.name]]));
  const result=macroWithVariables(working,changed);
  result.nativeData=m.nativeData?{...structuredClone(m.nativeData),variables:result.nativeData!.variables.slice(0,m.nativeData.variables.length)}:undefined;
  if(result.configuration)for(const p of result.configuration.parameters)p.value=all[p.name];
  return result;
}
export function upsertMacroValueSet<T extends MacroItem>(m:T,name:string,values:Record<string,string>,id?:string):T{
  if(!macroParameters(m).length)throw new Error('Zuerst mindestens einen Parameter anlegen.');
  const result=structuredClone(m);result.configuration??={parameters:[],valueSets:[]};const at=id?result.configuration.valueSets.findIndex(v=>v.id===id):-1;
  if(id&&at<0)throw new Error('Wertesatz nicht vorhanden.');const s={id:id??crypto.randomUUID(),name:name.trim(),values:{...values}};
  if(at<0)result.configuration.valueSets.push(s);else result.configuration.valueSets[at]=s;validateMacroConfiguration(result);return result;
}
