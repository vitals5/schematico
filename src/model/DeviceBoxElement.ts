import { rotatedLocalPoint } from './SymbolGeometry';
import type { DrawingPrimitive, PageBox, PlacedComponent, SymbolDefinition } from './types';
import { drawingToSvg } from './ImportedDrawing';

export interface DeviceBoxGeometry {
  width:number;
  height:number;
  lineStyle:'solid'|'dashed';
  lineWidth:number;
  color?:string;
  /** Preserve a source dash pattern without inventing a source style code. */
  dash?:number[];
}
export const DEVICE_BOX_SYMBOL:SymbolDefinition={id:'device_box',name:'Gerätekasten',category:'structure',standard:'DIN EN 60617',
  deviceBox:true,defaultBmkPrefix:'-A',defaultFunctionText:'',width:96,height:64,unitsPerMm:2,insertionPoint:{x:0,y:0},pins:[],
  description:'Bearbeitbarer Gerätekasten mit gemeinsamen Element- und Beschriftungseigenschaften',
  importedGraphics:[{kind:'rect',x:0,y:0,width:96,height:64,color:'currentColor',lineWidth:1.2}],
  svgContent:'<rect x="0" y="0" width="96" height="64" fill="none" stroke="currentColor"/>'};

export function isDeviceBoxDefinition(symbol?:SymbolDefinition):boolean {
  return !!symbol && !symbol.pins.length && (!!symbol.deviceBox || symbol.source?.library==='SPECIAL' && [0,1].includes(symbol.source.number));
}
export function geometryFromSymbol(symbol:SymbolDefinition):DeviceBoxGeometry {
  const rectangle=symbol.importedGraphics?.find(g=>g.kind==='rect');
  return {width:symbol.width,height:symbol.height,lineStyle:rectangle?.dash?.length?'dashed':'solid',lineWidth:rectangle?.lineWidth??.6*(symbol.unitsPerMm??2),
    ...(rectangle?.dash?{dash:[...rectangle.dash]}:{}),...(rectangle?.color&&rectangle.color!=='currentColor'?{color:rectangle.color}:{})};
}
const cache=new WeakMap<PlacedComponent,{base:SymbolDefinition;key:string;definition:SymbolDefinition}>();
/** A placement's variable frame dimensions never mutate the shared master definition. */
export function deviceBoxDefinition(component:PlacedComponent,base:SymbolDefinition):SymbolDefinition {
  if(!component.deviceBox)return base;
  const g=component.deviceBox,original=geometryFromSymbol(base);
  if(base.deviceBox && g.width===original.width && g.height===original.height && g.lineWidth===original.lineWidth && g.lineStyle===original.lineStyle && g.color===original.color && JSON.stringify(g.dash??[])===JSON.stringify(original.dash??[]))return base;
  const key=JSON.stringify(g),cached=cache.get(component);
  if(cached?.base===base&&cached.key===key)return cached.definition;
  const graphics:DrawingPrimitive[]=[{kind:'rect',x:0,y:0,width:g.width,height:g.height,color:g.color??'currentColor',lineWidth:g.lineWidth,
    ...(g.lineStyle==='dashed'?{dash:g.dash??[2*(base.unitsPerMm??2),1.5*(base.unitsPerMm??2)]}:{})}];
  const definition:SymbolDefinition={...base,deviceBox:true,category:'structure',name:'Gerätekasten',width:g.width,height:g.height,
    importedGraphics:graphics,svgContent:drawingToSvg(graphics)};
  cache.set(component,{base,key,definition});return definition;
}
export function componentFromBox(box:PageBox,units:number):PlacedComponent {
  const font=box.fontSize!==undefined?{fontSize:box.fontSize}:{};
  return {id:box.id,symbolId:DEVICE_BOX_SYMBOL.id,x:box.x,y:box.y,rotation:0,pins:{},bmk:box.bmk??'',functionText:box.label??'',
    additionalText:[box.description,box.subLabel].filter(Boolean).join('\n'),
    deviceBox:{width:box.width,height:box.height,lineStyle:box.lineStyle??'solid',lineWidth:box.lineWidth??.6*units,...(box.color?{color:box.color}:{})},
    bmkPosition:{...font},functionTextPosition:{...font},additionalTextPosition:{...font}};
}
export function newDeviceBox(id:string,bmk:string,x:number,y:number,width:number,height:number,units:number):PlacedComponent {
  return {id,symbolId:DEVICE_BOX_SYMBOL.id,bmk,x,y,rotation:0,pins:{},functionText:'',deviceBox:{width,height,lineStyle:'solid',lineWidth:.6*units}};
}

export function resizeDeviceBox(component:PlacedComponent,width:number,height:number):void {
  const box=component.deviceBox;if(!box)return;
  const oldCorner=rotatedLocalPoint({x:0,y:0},{width:box.width,height:box.height} as SymbolDefinition,component.rotation);
  const newCorner=rotatedLocalPoint({x:0,y:0},{width,height} as SymbolDefinition,component.rotation);
  component.x+=oldCorner.x-newCorner.x;component.y+=oldCorner.y-newCorner.y;
  const dx=width-box.width,dy=height-box.height;
  for(const key of ['bmkPosition','functionTextPosition','technicalDataPosition','additionalTextPosition','crossRefPosition'] as const){
    const cfg=component[key];if(cfg?.preset!=='custom')continue;
    component[key]={...cfg,offsetX:(cfg.offsetX??0)-dx/2,offsetY:(cfg.offsetY??0)-(key==='bmkPosition'?0:dy)};
  }
  box.width=width;box.height=height;
}
