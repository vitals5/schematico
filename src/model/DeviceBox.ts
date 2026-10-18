import type { DrawingPrimitive, PageBox } from './types';
import { drawingToSvg, escapeSvg } from './ImportedDrawing';

/** Existing imported frames keep their dashed style; device frames are solid by default. */
export function boxDrawing(box:PageBox):DrawingPrimitive[] {
  const color=box.color ?? (box.kind==='device'?'currentColor':'#4299e1');
  const graphics:DrawingPrimitive[]=[{kind:'rect',x:box.x,y:box.y,width:box.width,height:box.height,color,
    lineWidth:box.lineWidth ?? 1.2,...((box.lineStyle ?? (box.kind==='device'?'solid':'dashed'))==='dashed'?{dash:[4,3]}:{})}];
  let baseline=box.y+(box.kind==='device'?6:3);
  for(const [value,defaultSize]of [[box.bmk,11],[box.label,11],[box.description,8.5],[box.subLabel,8.5]] as const){
    if(!value)continue;
    const size=box.fontSize ?? defaultSize;
    const available=Math.max(0,box.width-12);
    const glyphWidth=(char:string)=>size*(/[MW@%]/.test(char)?1.1:/[A-ZÄÖÜmw]/.test(char)?.9:.7);
    for(const paragraph of value.split(/\r?\n/)){
      let rest=paragraph;
      do{
        let cut=0,width=0;
        while(cut<rest.length && width+glyphWidth(rest[cut])<=available){width+=glyphWidth(rest[cut]);cut++;}
        if(cut===0)break;
        if(cut<rest.length){const space=rest.lastIndexOf(' ',cut);if(space>0)cut=space;}
        const row=rest.slice(0,cut);rest=rest.slice(cut).trimStart();baseline+=size;
        if(baseline<=box.y+box.height-4)graphics.push({kind:'text',x:box.x+6,y:baseline,text:row,size,color,anchor:'start'});
        baseline+=size*.3;
      }while(rest.length);
    }
  }
  return graphics;
}

export function boxSvg(box:PageBox,selected:boolean):string {
  return `<g id="${escapeSvg(box.id)}" data-box-id="${escapeSvg(box.id)}" class="device-box structure-box ${selected?'selected':''}" color="#e2e8f0" style="cursor:move">
    <rect class="box-hit-target" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="none" stroke="transparent" stroke-width="12" vector-effect="non-scaling-stroke" pointer-events="stroke"/>
    <g pointer-events="none">${drawingToSvg(boxDrawing(box))}</g>
    <rect class="box-selection-rect" x="${box.x-3}" y="${box.y-3}" width="${box.width+6}" height="${box.height+6}" fill="none" stroke="#63b3ed" stroke-width="1" stroke-dasharray="5 3" vector-effect="non-scaling-stroke" pointer-events="none" visibility="${selected?'visible':'hidden'}"/>
    <rect class="box-resize-handle" data-box-resize="${escapeSvg(box.id)}" x="${box.x+box.width-4}" y="${box.y+box.height-4}" width="8" height="8" fill="#63b3ed" style="cursor:nwse-resize" visibility="${selected?'visible':'hidden'}"/>
  </g>`;
}
