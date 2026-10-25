import { Page, Project, TextFormatConfig } from './types';
import { ElementSelection, selectionCount } from './ElementSelection';
import { getDrawingUnitsPerMm, getSymbolForComponent } from './symbols';
import { computeBmkPosition, computeFunctionTextPosition, computeAdditionalTextPosition, computeTechnicalDataPosition, setComponentLabelText } from './LabelLayout';
import { resizeDeviceBox } from './DeviceBoxElement';
import { isInterruptionSymbol } from './ConnectionSymbols';

export type SharedProperty =
  | 'bmk'
  | 'deviceTag'
  | 'functionText'
  | 'additionalText'
  | 'technicalCharacteristics'
  | 'higherLevel'
  | 'location'
  | 'manufacturer'
  | 'articleNumber'
  | 'bmkFontSize'
  | 'functionFontSize'
  | 'additionalFontSize'
  | 'technicalFontSize'
  | 'crossRefFontSize'
  | 'pinFontSize'
  | 'boxFontSize'
  | 'bmkVisible'
  | 'fnVisible'
  | 'techVisible'
  | 'additionalVisible'
  | 'crossRefVisible'
  | 'pinVisible'
  | 'bmkPreset'
  | 'fnPreset'
  | 'techPreset'
  | 'additionalPreset'
  | 'crossRefPreset'
  | 'pinPreset'
  | 'posX'
  | 'posY'
  | 'width'
  | 'height'
  | 'rotation'
  | 'compShowLabels'
  | 'compScale'
  | 'boxLineStyle'
  | 'boxLineWidth'
  | 'boxColor'
  | 'cableType'
  | 'coreCount'
  | 'cableDescription'
  | 'cableMarkStyle'
  | 'crossSection'
  | 'wirePotential'
  | 'wireColor'
  | 'wireNumber'
  | 'textContent'
  | 'textFontSize'
  | 'textFontWeight'
  | 'textFontStyle'
  | 'textAlign'
  | 'textFontColor';

export type SelectionPatch = Partial<Record<SharedProperty, string | number>>;

const COMPONENT_ALWAYS_PROPS = new Set<SharedProperty>([
  'bmk', 'deviceTag', 'functionText', 'additionalText', 'technicalCharacteristics',
  'higherLevel', 'location', 'manufacturer', 'articleNumber',
  'bmkFontSize', 'functionFontSize', 'additionalFontSize', 'technicalFontSize', 'crossRefFontSize', 'pinFontSize',
  'bmkVisible', 'fnVisible', 'techVisible', 'additionalVisible', 'crossRefVisible', 'pinVisible',
  'bmkPreset', 'fnPreset', 'techPreset', 'additionalPreset', 'crossRefPreset', 'pinPreset',
  'posX', 'posY', 'rotation', 'compShowLabels', 'compScale',
]);
const COMPONENT_DEVICE_BOX_PROPS = new Set<SharedProperty>(['boxLineStyle', 'boxLineWidth', 'width', 'height']);
const CABLE_PROPS = new Set<SharedProperty>([
  'bmk', 'cableType', 'coreCount', 'crossSection', 'cableDescription',
  'bmkFontSize', 'functionFontSize', 'pinFontSize', 'bmkVisible', 'pinVisible', 'cableMarkStyle',
]);
const BOX_PROPS = new Set<SharedProperty>([
  'bmk', 'functionText', 'additionalText', 'deviceTag',
  'posX', 'posY', 'width', 'height', 'boxFontSize', 'boxLineWidth', 'boxLineStyle', 'boxColor',
]);
const IMAGE_PROPS = new Set<SharedProperty>(['functionText', 'posX', 'posY', 'width', 'height']);
const WIRE_PROPS = new Set<SharedProperty>(['wirePotential', 'crossSection', 'wireColor', 'wireNumber']);
const TEXT_PROPS = new Set<SharedProperty>([
  'textContent', 'textFontSize', 'textFontWeight', 'textFontStyle', 'textAlign', 'textFontColor',
  'posX', 'posY', 'rotation',
]);

/**
 * Returns true if `key` exists on ALL selected elements in `s`.
 */
export function propertyExistsOnAllSelected(page: Page, s: ElementSelection, key: SharedProperty): boolean {
  if (selectionCount(s) === 0) return false;
  const comps = page.components.filter(c => s.componentIds.includes(c.id));
  const cables = (page.cables ?? []).filter(c => s.cableIds.includes(c.id));
  const boxes = (page.boxes ?? []).filter(c => s.boxIds?.includes(c.id));
  const images = (page.images ?? []).filter(c => s.imageIds?.includes(c.id));
  const wires = page.wires.filter(c => s.wireIds?.includes(c.id));
  const texts = (page.texts ?? []).filter(c => s.textIds?.includes(c.id));
  if (comps.length + cables.length + boxes.length + images.length + wires.length + texts.length === 0) return false;

  if (comps.length > 0) {
    if (COMPONENT_DEVICE_BOX_PROPS.has(key)) {
      if (!comps.every(c => !!c.deviceBox)) return false;
    } else if (!COMPONENT_ALWAYS_PROPS.has(key)) {
      return false;
    }
  }
  if (cables.length > 0 && !CABLE_PROPS.has(key)) return false;
  if (boxes.length > 0 && !BOX_PROPS.has(key)) return false;
  if (images.length > 0 && !IMAGE_PROPS.has(key)) return false;
  if (wires.length > 0 && !WIRE_PROPS.has(key)) return false;
  if (texts.length > 0 && !TEXT_PROPS.has(key)) return false;
  return true;
}

export function sharedPropertyValue(page:Page,project:Project,s:ElementSelection,key:SharedProperty):string|number|undefined {
  const units=getDrawingUnitsPerMm(project),values:(string|number)[]=[];
  for(const c of page.components.filter(c=>s.componentIds.includes(c.id))){
    const sym=getSymbolForComponent(c,project);if(!sym)continue;
    if(key==='boxLineStyle'&&c.deviceBox)values.push(c.deviceBox.lineStyle);
    else if(key==='boxLineWidth'&&c.deviceBox)values.push(c.deviceBox.lineWidth/units);
    else if(key==='width'&&c.deviceBox)values.push(c.deviceBox.width/units);
    else if(key==='height'&&c.deviceBox)values.push(c.deviceBox.height/units);
    else if(key==='bmkFontSize')values.push((c.bmkPosition?.fontSize ?? (sym.id==='terminal_single'?7.5:computeBmkPosition(c,sym).fontSize))/units);
    else if(key==='functionFontSize')values.push(computeFunctionTextPosition(c,sym).fontSize/units);
    else if(key==='additionalFontSize')values.push(computeAdditionalTextPosition(c,sym).fontSize/units);
    else if(key==='technicalFontSize')values.push(computeTechnicalDataPosition(c,sym).fontSize/units);
    else if(key==='crossRefFontSize')values.push((c.crossRefFontSize ?? 8)/units);
    else if(key==='pinFontSize')values.push((c.pinLabelFontSize ?? Object.values(c.pins).find(p=>p.labelPosition)?.labelPosition?.fontSize ?? sym.pins.find(p=>p.labelPosition)?.labelPosition?.fontSize ?? (sym.id==='terminal_single'?7.5:6.5))/units);
    else if(key==='bmk')values.push(c.bmk ?? '');
    else if(key==='functionText'||key==='additionalText'||key==='deviceTag'||key==='technicalCharacteristics')values.push(c[key] ?? '');
    else if(key==='higherLevel')values.push(c.higherLevelFunction ?? '');
    else if(key==='location')values.push(c.mountingLocation ?? '');
    else if(key==='manufacturer')values.push(c.manufacturer ?? '');
    else if(key==='articleNumber')values.push(c.articleNumber ?? '');
    else if(key==='bmkVisible')values.push(String(c.bmkPosition?.visible !== false));
    else if(key==='fnVisible')values.push(String(c.functionTextPosition?.visible !== false));
    else if(key==='techVisible')values.push(String(c.technicalDataPosition?.visible !== false));
    else if(key==='additionalVisible')values.push(String(c.additionalTextPosition?.visible !== false));
    else if(key==='crossRefVisible')values.push(String(c.crossRefPosition?.visible !== false));
    else if(key==='pinVisible')values.push(String(c.pinLabelPosition?.visible !== false));
    else if(key==='bmkPreset')values.push(c.bmkPosition?.preset ?? 'auto');
    else if(key==='fnPreset')values.push(c.functionTextPosition?.preset ?? 'auto');
    else if(key==='techPreset')values.push(c.technicalDataPosition?.preset ?? 'auto');
    else if(key==='additionalPreset')values.push(c.additionalTextPosition?.preset ?? 'auto');
    else if(key==='crossRefPreset')values.push(c.crossRefPosition?.preset ?? 'auto');
    else if(key==='pinPreset')values.push(c.pinLabelPosition?.preset ?? 'auto');
    else if(key==='posX')values.push(c.x/units);
    else if(key==='posY')values.push(c.y/units);
    else if(key==='rotation')values.push(c.rotation ?? 0);
    else if(key==='compShowLabels')values.push(String(!!c.showLabels));
    else if(key==='compScale')values.push(c.scale ? String(c.scale) : 'inherit');
  }
  for(const c of (page.cables ?? []).filter(c=>s.cableIds.includes(c.id))){
    if(key==='bmk')values.push(c.bmk ?? '');
    else if(key==='bmkFontSize')values.push((c.bmkFontSize ?? c.fontSize ?? 2.2356*units)/units);
    else if(key==='functionFontSize')values.push((c.fontSize ?? 2.2356*units)/units);
    else if(key==='pinFontSize')values.push((c.coreFontSize ?? 1.6146*units)/units);
    else if(key==='cableType'||key==='crossSection')values.push(c[key] ?? '');
    else if(key==='coreCount')values.push(c.coreCount ?? c.cores?.length ?? 3);
    else if(key==='cableDescription')values.push(c.description ?? '');
    else if(key==='bmkVisible')values.push(String(c.showLabel !== false));
    else if(key==='pinVisible')values.push(String(c.showCoreLabels !== false));
    else if(key==='cableMarkStyle')values.push(c.markStyle ?? 'slash');
  }
  for(const box of (page.boxes??[]).filter(c=>s.boxIds?.includes(c.id))){
    if(key==='bmk')values.push(box.bmk ?? '');
    else if(key==='functionText')values.push(box.label ?? '');
    else if(key==='additionalText')values.push(box.description ?? '');
    else if(key==='deviceTag')values.push(box.subLabel ?? '');
    else if(key==='posX')values.push(box.x/units);
    else if(key==='posY')values.push(box.y/units);
    else if(key==='width')values.push(box.width/units);
    else if(key==='height')values.push(box.height/units);
    else if(key==='boxFontSize')values.push((box.fontSize??11)/units);
    else if(key==='boxLineWidth')values.push((box.lineWidth??1.2)/units);
    else if(key==='boxLineStyle')values.push(box.lineStyle??(box.kind==='device'?'solid':'dashed'));
    else if(key==='boxColor')values.push(box.color ?? '');
  }
  for(const img of (page.images??[]).filter(c=>s.imageIds?.includes(c.id))){
    if(key==='functionText')values.push(img.caption ?? '');
    else if(key==='posX')values.push(img.x/units);
    else if(key==='posY')values.push(img.y/units);
    else if(key==='width')values.push(img.width/units);
    else if(key==='height')values.push(img.height/units);
  }
  for(const w of page.wires.filter(c=>s.wireIds?.includes(c.id))){
    if(key==='wirePotential')values.push(w.potential ?? '');
    else if(key==='crossSection')values.push(w.crossSection ?? '1.5mm²');
    else if(key==='wireColor')values.push(w.color ?? 'BK');
    else if(key==='wireNumber')values.push(w.wireNumber ?? '');
  }
  for(const t of (page.texts??[]).filter(c=>s.textIds?.includes(c.id))){
    if(key==='textContent')values.push(t.text ?? '');
    else if(key==='textFontSize')values.push(t.fontSize ?? 9);
    else if(key==='textFontWeight')values.push(t.fontWeight ?? 'normal');
    else if(key==='textFontStyle')values.push(t.fontStyle ?? 'normal');
    else if(key==='textAlign')values.push(t.align === 'center' || t.align === 'middle' ? 'center' : t.align === 'end' || t.align === 'right' ? 'end' : 'start');
    else if(key==='textFontColor')values.push(t.fontColor ?? '#cbd5e0');
    else if(key==='posX')values.push(t.x/units);
    else if(key==='posY')values.push(t.y/units);
    else if(key==='rotation')values.push(t.rotation ?? 0);
  }
  return values.length && values.every(v=>typeof v==='number'&&typeof values[0]==='number'?Math.abs(v-values[0])<1e-7:v===values[0])?values[0]:undefined;
}

/** Only explicitly edited properties are applied; all other per-instance
 * label positions, visibility, angles and values remain independent. */
export function applySelectionProperties(page:Page,project:Project,s:ElementSelection,patch:SelectionPatch):boolean {
  const keys=Object.keys(patch) as SharedProperty[],units=getDrawingUnitsPerMm(project);
  for(const key of keys){
    const value=patch[key];
    if(key==='boxLineStyle'){if(value!=='solid'&&value!=='dashed')throw new Error('Ungültige Linienart.');}
    else if(key==='boxLineWidth'){if(typeof value!=='number'||!Number.isFinite(value)||value<.05||value>5)throw new Error('Linienbreite muss zwischen 0,05 und 5 mm liegen.');}
    else if(key==='textFontSize'){if(typeof value!=='number'||!Number.isFinite(value)||value<1||value>200)throw new Error('Schriftgröße muss zwischen 1 und 200 liegen.');}
    else if(key.endsWith('FontSize')){if(typeof value!=='number'||!Number.isFinite(value)||value<.1||value>20)throw new Error('Schriftgröße muss zwischen 0,1 und 20 mm liegen.');}
    else if(key==='posX'||key==='posY'){if(typeof value!=='number'||!Number.isFinite(value))throw new Error('Ungültige Koordinate.');}
    else if(key==='width'||key==='height'){if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new Error('Abmessung muss größer als 0 sein.');}
    else if(key==='rotation'){if(typeof value!=='number'||!Number.isFinite(value))throw new Error('Ungültiger Drehwinkel.');}
    else if(key==='coreCount'){if(typeof value!=='number'||!Number.isInteger(value)||value<1||value>999)throw new Error('Ungültige Aderanzahl.');}
    else if(typeof value!=='string')throw new Error('Ungültiger Eigenschaftswert.');
  }
  let changed=false;
  for(const c of page.components.filter(c=>s.componentIds.includes(c.id)))for(const key of keys){
    const value=patch[key]!;
    if(key==='boxLineStyle'&&c.deviceBox){if(c.deviceBox.lineStyle!==value){c.deviceBox.lineStyle=value as 'solid'|'dashed';changed=true;}}
    else if(key==='boxLineWidth'&&c.deviceBox){if(c.deviceBox.lineWidth!==Number(value)*units){c.deviceBox.lineWidth=Number(value)*units;changed=true;}}
    else if((key==='width'||key==='height')&&c.deviceBox){
      const nextW=key==='width'?Number(value)*units:c.deviceBox.width;
      const nextH=key==='height'?Number(value)*units:c.deviceBox.height;
      if(c.deviceBox.width!==nextW||c.deviceBox.height!==nextH){resizeDeviceBox(c,nextW,nextH);changed=true;}
    }
    else if(key==='bmkFontSize'||key==='functionFontSize'||key==='additionalFontSize'||key==='technicalFontSize'){
      const property=key==='bmkFontSize'?'bmkPosition':key==='functionFontSize'?'functionTextPosition':key==='additionalFontSize'?'additionalTextPosition':'technicalDataPosition';
      if(c[property]?.fontSize!==Number(value)*units){c[property]={...c[property],fontSize:Number(value)*units};changed=true;}
    }else if(key==='crossRefFontSize'||key==='pinFontSize'){
      const property=key==='pinFontSize'?'pinLabelFontSize':'crossRefFontSize';if(c[property]!==Number(value)*units){c[property]=Number(value)*units;changed=true;}
    }else if(key==='bmk'){
      const next=String(value).trim();
      if(c.bmk!==next){
        c.bmk=next;
        const sym=getSymbolForComponent(c,project);
        if(sym&&isInterruptionSymbol(sym))c.functionText=c.bmk;
        changed=true;
      }
    }else if(key==='functionText'||key==='additionalText'||key==='deviceTag'||key==='technicalCharacteristics'){
      if(setComponentLabelText(c,key,String(value)))changed=true;
    }else if(key==='higherLevel'){
      if((c.higherLevelFunction??'')!==String(value)){c.higherLevelFunction=String(value);changed=true;}
    }else if(key==='location'){
      if((c.mountingLocation??'')!==String(value)){c.mountingLocation=String(value);changed=true;}
    }else if(key==='manufacturer'){
      if((c.manufacturer??'')!==String(value)){c.manufacturer=String(value);changed=true;}
    }else if(key==='articleNumber'){
      if((c.articleNumber??'')!==String(value)){c.articleNumber=String(value);changed=true;}
    }else if(key==='bmkVisible'||key==='fnVisible'||key==='techVisible'||key==='additionalVisible'||key==='crossRefVisible'||key==='pinVisible'){
      const propKey=key==='bmkVisible'?'bmkPosition':key==='fnVisible'?'functionTextPosition':key==='techVisible'?'technicalDataPosition':key==='additionalVisible'?'additionalTextPosition':key==='crossRefVisible'?'crossRefPosition':'pinLabelPosition';
      const vis=value==='true';
      if((c[propKey]?.visible!==false)!==vis){
        c[propKey]={...c[propKey],visible:vis,visibilityExplicit:true};
        changed=true;
      }
    }else if(key==='bmkPreset'||key==='fnPreset'||key==='techPreset'||key==='additionalPreset'||key==='crossRefPreset'||key==='pinPreset'){
      const propKey=key==='bmkPreset'?'bmkPosition':key==='fnPreset'?'functionTextPosition':key==='techPreset'?'technicalDataPosition':key==='additionalPreset'?'additionalTextPosition':key==='crossRefPreset'?'crossRefPosition':'pinLabelPosition';
      const preset=value as TextFormatConfig['preset'];
      if((c[propKey]?.preset??'auto')!==preset){
        c[propKey]={...c[propKey],preset,...(preset==='auto'?{alignment:key==='crossRefPreset'||key==='pinPreset'?'start':'end'}:{})};
        changed=true;
      }
    }else if(key==='posX'){
      const nx=Number(value)*units;if(c.x!==nx){c.x=nx;changed=true;}
    }else if(key==='posY'){
      const ny=Number(value)*units;if(c.y!==ny){c.y=ny;changed=true;}
    }else if(key==='rotation'){
      const rot=((Number(value)%360)+360)%360 as 0|90|180|270;
      if(c.rotation!==rot){c.rotation=rot;changed=true;}
    }else if(key==='compShowLabels'){
      const show=value==='true';if(!!c.showLabels!==show){c.showLabels=show;changed=true;}
    }else if(key==='compScale'){
      if(value==='inherit'){if(c.scale!==undefined){delete c.scale;changed=true;}}
      else{const sc=parseFloat(String(value));if(!isNaN(sc)&&c.scale!==sc){c.scale=sc;changed=true;}}
    }
  }
  for(const c of (page.cables ?? []).filter(c=>s.cableIds.includes(c.id)))for(const key of keys){
    const value=patch[key]!;
    if(key==='bmkFontSize'||key==='functionFontSize'||key==='pinFontSize'){
      const property=key==='bmkFontSize'?'bmkFontSize':key==='functionFontSize'?'fontSize':'coreFontSize';
      if(c[property]!==Number(value)*units){c[property]=Number(value)*units;changed=true;}
    }else if(key==='bmk'){if(c.bmk!==String(value)){c.bmk=String(value);changed=true;}}
    else if(key==='cableType'||key==='crossSection'){if(c[key]!==value){c[key]=String(value);changed=true;}}
    else if(key==='coreCount'){if(c.coreCount!==Number(value)){c.coreCount=Number(value);changed=true;}}
    else if(key==='cableDescription'){if((c.description??'')!==String(value)){c.description=String(value);changed=true;}}
    else if(key==='bmkVisible'){const vis=value==='true';if((c.showLabel!==false)!==vis){c.showLabel=vis;changed=true;}}
    else if(key==='pinVisible'){const vis=value==='true';if((c.showCoreLabels!==false)!==vis){c.showCoreLabels=vis;changed=true;}}
    else if(key==='cableMarkStyle'){const st=value as 'slash'|'none';if((c.markStyle??'slash')!==st){c.markStyle=st;changed=true;}}
  }
  for(const box of (page.boxes??[]).filter(c=>s.boxIds?.includes(c.id)))for(const key of keys){
    const value=patch[key]!;
    if(key==='boxFontSize'||key==='boxLineWidth'){
      const property=key==='boxFontSize'?'fontSize':'lineWidth';if(box[property]!==Number(value)*units){box[property]=Number(value)*units;changed=true;}
    }else if(key==='boxLineStyle'&&box.lineStyle!==value){box.lineStyle=value as 'solid'|'dashed';changed=true;}
    else if(key==='bmk'){if((box.bmk??'')!==String(value)){box.bmk=String(value);changed=true;}}
    else if(key==='functionText'){if((box.label??'')!==String(value)){box.label=String(value);changed=true;}}
    else if(key==='additionalText'){if((box.description??'')!==String(value)){box.description=String(value);changed=true;}}
    else if(key==='deviceTag'){if((box.subLabel??'')!==String(value)){box.subLabel=String(value);changed=true;}}
    else if(key==='posX'){const nx=Number(value)*units;if(box.x!==nx){box.x=nx;changed=true;}}
    else if(key==='posY'){const ny=Number(value)*units;if(box.y!==ny){box.y=ny;changed=true;}}
    else if(key==='width'){const nw=Number(value)*units;if(box.width!==nw){box.width=nw;changed=true;}}
    else if(key==='height'){const nh=Number(value)*units;if(box.height!==nh){box.height=nh;changed=true;}}
    else if(key==='boxColor'){
      if(value===''){if(box.color!==undefined){delete box.color;changed=true;}}
      else if(box.color!==String(value)){box.color=String(value);changed=true;}
    }
  }
  for(const img of (page.images??[]).filter(c=>s.imageIds?.includes(c.id)))for(const key of keys){
    const value=patch[key]!;
    if(key==='functionText'){if((img.caption??'')!==String(value)){img.caption=String(value);changed=true;}}
    else if(key==='posX'){const nx=Number(value)*units;if(img.x!==nx){img.x=nx;changed=true;}}
    else if(key==='posY'){const ny=Number(value)*units;if(img.y!==ny){img.y=ny;changed=true;}}
    else if(key==='width'){const nw=Number(value)*units;if(img.width!==nw){const ratio=img.width/Math.max(1e-6,img.height);img.width=nw;if(!('height' in patch))img.height=nw/ratio;changed=true;}}
    else if(key==='height'){const nh=Number(value)*units;if(img.height!==nh){const ratio=img.width/Math.max(1e-6,img.height);img.height=nh;if(!('width' in patch))img.width=nh*ratio;changed=true;}}
  }
  for(const w of page.wires.filter(c=>s.wireIds?.includes(c.id)))for(const key of keys){
    const value=patch[key]!;
    if(key==='wirePotential'){if(w.potential!==String(value)){w.potential=String(value);changed=true;}}
    else if(key==='crossSection'){if((w.crossSection??'')!==String(value)){w.crossSection=String(value);changed=true;}}
    else if(key==='wireColor'){if((w.color??'')!==String(value)){w.color=String(value);changed=true;}}
    else if(key==='wireNumber'){if((w.wireNumber??'')!==String(value)){w.wireNumber=String(value);changed=true;}}
  }
  for(const t of (page.texts??[]).filter(c=>s.textIds?.includes(c.id)))for(const key of keys){
    const value=patch[key]!;
    if(key==='textContent'){if(t.text!==String(value)){t.text=String(value);changed=true;}}
    else if(key==='textFontSize'){if((t.fontSize??9)!==Number(value)){t.fontSize=Number(value);changed=true;}}
    else if(key==='textFontWeight'){const fw=value as 'normal'|'bold';if((t.fontWeight??'normal')!==fw){t.fontWeight=fw;changed=true;}}
    else if(key==='textFontStyle'){const fs=value as 'normal'|'italic';if((t.fontStyle??'normal')!==fs){t.fontStyle=fs;changed=true;}}
    else if(key==='textAlign'){const al=value as 'start'|'center'|'end';if((t.align??'start')!==al){t.align=al;changed=true;}}
    else if(key==='textFontColor'){if((t.fontColor??'#cbd5e0')!==String(value)){t.fontColor=String(value);changed=true;}}
    else if(key==='posX'){const nx=Number(value)*units;if(t.x!==nx){t.x=nx;changed=true;}}
    else if(key==='posY'){const ny=Number(value)*units;if(t.y!==ny){t.y=ny;changed=true;}}
    else if(key==='rotation'){const rot=Number(value);if((t.rotation??0)!==rot){t.rotation=rot;changed=true;}}
  }
  return changed;
}
