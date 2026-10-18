import { Page, Project } from './types';
import { ElementSelection } from './ElementSelection';
import { getDrawingUnitsPerMm, getSymbolForComponent } from './symbols';
import { computeBmkPosition, computeFunctionTextPosition, computeAdditionalTextPosition, computeTechnicalDataPosition, setComponentLabelText } from './LabelLayout';
export type SharedProperty = 'bmkFontSize'|'functionFontSize'|'additionalFontSize'|'technicalFontSize'|'crossRefFontSize'|'pinFontSize'|'functionText'|'additionalText'|'deviceTag'|'technicalCharacteristics'|'cableType'|'crossSection'|'boxLineStyle'|'boxLineWidth'|'boxFontSize';
export type SelectionPatch = Partial<Record<SharedProperty,string|number>>;
export function sharedPropertyValue(page:Page,project:Project,s:ElementSelection,key:SharedProperty):string|number|undefined {
  const units=getDrawingUnitsPerMm(project),values:(string|number)[]=[];
  for(const c of page.components.filter(c=>s.componentIds.includes(c.id))){
    const sym=getSymbolForComponent(c,project);if(!sym)continue;
    if(key==='boxLineStyle'&&c.deviceBox)values.push(c.deviceBox.lineStyle);
    else if(key==='boxLineWidth'&&c.deviceBox)values.push(c.deviceBox.lineWidth/units);
    else if(key==='bmkFontSize')values.push((c.bmkPosition?.fontSize ?? (sym.id==='terminal_single'?7.5:computeBmkPosition(c,sym).fontSize))/units);
    else if(key==='functionFontSize')values.push(computeFunctionTextPosition(c,sym).fontSize/units);
    else if(key==='additionalFontSize')values.push(computeAdditionalTextPosition(c,sym).fontSize/units);
    else if(key==='technicalFontSize')values.push(computeTechnicalDataPosition(c,sym).fontSize/units);
    else if(key==='crossRefFontSize')values.push((c.crossRefFontSize ?? 8)/units);
    else if(key==='pinFontSize')values.push((c.pinLabelFontSize ?? Object.values(c.pins).find(p=>p.labelPosition)?.labelPosition?.fontSize ?? sym.pins.find(p=>p.labelPosition)?.labelPosition?.fontSize ?? (sym.id==='terminal_single'?7.5:6.5))/units);
    else if(key==='functionText'||key==='additionalText'||key==='deviceTag'||key==='technicalCharacteristics')values.push(c[key] ?? '');
  }
  for(const c of (page.cables ?? []).filter(c=>s.cableIds.includes(c.id))){
    if(key==='bmkFontSize')values.push((c.bmkFontSize ?? c.fontSize ?? 2.2356*units)/units);
    else if(key==='functionFontSize')values.push((c.fontSize ?? 2.2356*units)/units);
    else if(key==='pinFontSize')values.push((c.coreFontSize ?? 1.6146*units)/units);
    else if(key==='cableType'||key==='crossSection')values.push(c[key]);
  }
  for(const box of (page.boxes??[]).filter(c=>s.boxIds?.includes(c.id))){
    if(key==='boxFontSize')values.push((box.fontSize??11)/units);
    else if(key==='boxLineWidth')values.push((box.lineWidth??1.2)/units);
    else if(key==='boxLineStyle')values.push(box.lineStyle??(box.kind==='device'?'solid':'dashed'));
  }
  return values.length && values.every(v=>typeof v==='number'&&typeof values[0]==='number'?Math.abs(v-values[0])<1e-7:v===values[0])?values[0]:undefined;
}
/** Only explicitly edited properties are applied; all other per-instance
 * label positions, visibility, angles and values remain independent. */
export function applySelectionProperties(page:Page,project:Project,s:ElementSelection,patch:SelectionPatch):boolean {
  const keys=Object.keys(patch) as SharedProperty[],units=getDrawingUnitsPerMm(project);
  for(const key of keys){const value=patch[key];if(key==='boxLineStyle'){if(value!=='solid'&&value!=='dashed')throw new Error('Ungültige Linienart.');}else if(key==='boxLineWidth'){if(typeof value!=='number'||!Number.isFinite(value)||value<.05||value>5)throw new Error('Linienbreite muss zwischen 0,05 und 5 mm liegen.');}else if(key.endsWith('FontSize')){if(typeof value!=='number'||!Number.isFinite(value)||value<.1||value>20)throw new Error('Schriftgröße muss zwischen 0,1 und 20 mm liegen.');}else if(typeof value!=='string')throw new Error('Ungültiger Eigenschaftswert.');}
  let changed=false;
  for(const c of page.components.filter(c=>s.componentIds.includes(c.id)))for(const key of keys){
    const value=patch[key]!;
    if(key==='boxLineStyle'&&c.deviceBox){if(c.deviceBox.lineStyle!==value){c.deviceBox.lineStyle=value as 'solid'|'dashed';changed=true;}}
    else if(key==='boxLineWidth'&&c.deviceBox){if(c.deviceBox.lineWidth!==Number(value)*units){c.deviceBox.lineWidth=Number(value)*units;changed=true;}}
    else if(key==='bmkFontSize'||key==='functionFontSize'||key==='additionalFontSize'||key==='technicalFontSize'){
      const property=key==='bmkFontSize'?'bmkPosition':key==='functionFontSize'?'functionTextPosition':key==='additionalFontSize'?'additionalTextPosition':'technicalDataPosition';
      if(c[property]?.fontSize!==Number(value)*units){c[property]={...c[property],fontSize:Number(value)*units};changed=true;}
    }else if(key==='crossRefFontSize'||key==='pinFontSize'){
      const property=key==='pinFontSize'?'pinLabelFontSize':'crossRefFontSize';if(c[property]!==Number(value)*units){c[property]=Number(value)*units;changed=true;}
    }else if(key==='functionText'||key==='additionalText'||key==='deviceTag'||key==='technicalCharacteristics'){if(setComponentLabelText(c,key,String(value)))changed=true;}
  }
  for(const c of (page.cables ?? []).filter(c=>s.cableIds.includes(c.id)))for(const key of keys){
    const value=patch[key]!;
    if(key==='bmkFontSize'||key==='functionFontSize'||key==='pinFontSize'){
      const property=key==='bmkFontSize'?'bmkFontSize':key==='functionFontSize'?'fontSize':'coreFontSize';
      if(c[property]!==Number(value)*units){c[property]=Number(value)*units;changed=true;}
    }else if(key==='cableType'||key==='crossSection'){if(c[key]!==value){c[key]=String(value);changed=true;}}
  }
  for(const box of (page.boxes??[]).filter(c=>s.boxIds?.includes(c.id)))for(const key of keys){
    const value=patch[key]!;
    if(key==='boxFontSize'||key==='boxLineWidth'){
      const property=key==='boxFontSize'?'fontSize':'lineWidth';if(box[property]!==Number(value)*units){box[property]=Number(value)*units;changed=true;}
    }else if(key==='boxLineStyle'&&box.lineStyle!==value){box.lineStyle=value as 'solid'|'dashed';changed=true;}
  }
  return changed;
}
