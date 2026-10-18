import { EodRecord, nativeText } from './EodReader';
import type { NativeLayerStyle } from './NativeLayers';
import { NATIVE_SCALE } from './NativeSymbolLibrary';
import type { TextFormatConfig } from '../model/types';

/** Literal page text exists in both ordinary and special-text records.
 * Decimal 53 is a property placeholder and must not enter this branch. */
export function nativePageText(record:EodRecord,layers:ReadonlyMap<number,NativeLayerStyle>) {
  if(![0x1e,0x53].includes(record.type))return;
  const position=record.point(0xec55),text=nativeText(record.string(0xec5f));
  if(!position||!text||text==='~')return;
  const layer=layers.get(record.number(0xebfb) ?? -1);
  const nominal=record.double(0xee21) ?? layer?.fontSize ?? 2.5;
  if(!Number.isFinite(nominal)||nominal<=0)return;
  const fontSize=nominal*NATIVE_SCALE*1.242,format=record.number(0xee26,1) ?? 10;
  const anchor:TextFormatConfig['alignment']=[6,12].includes(format)?'end':[5,8,11].includes(format)?'middle':'start';
  const width=Math.max(1,...text.split(/\r?\n/).map(s=>s.length))*fontSize*.6;
  const height=fontSize*Math.max(1,text.split(/\r?\n/).length)*1.2;
  const baselineOffset=[4,6].includes(format)?nominal*.49342857*NATIVE_SCALE:0;
  const origin={x:anchor==='end'?width:anchor==='middle'?width/2:0,y:fontSize-baselineOffset};
  const explicitAngle=record.double(0xee22);
  const angle=explicitAngle===-16002?layer?.angle ?? 0:explicitAngle ?? layer?.angle ?? 0;
  const rotation=((Math.round(angle*180/Math.PI/90)*90)%360+360)%360 as 0|90|180|270;
  const config:TextFormatConfig={preset:'custom',offsetX:origin.x-width/2,offsetY:fontSize-height-12,
    fontSize,alignment:anchor,rotation,visible:true,...(layer?.fontColor?{fontColor:layer.fontColor}:{})};
  return {text,position,fontSize,width,height,origin,config};
}
