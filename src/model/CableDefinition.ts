import { CableDefinition, DrawingPrimitive, Page, Project, Wire } from './types';
import { getSymbolForComponent } from './symbols';
import { rotatedLocalPoint } from './SymbolGeometry';
import { wirePolyline, wirePinDirection } from './WireRouting';
import { gridForPage } from './DrawingGrid';
import { drawingToSvg, escapeSvg } from './ImportedDrawing';

export type CableCrossing = { x: number; y: number; t: number; wireIds: string[] };
/** Cable definitions collect conductors. They never become electrical endpoints. */
export function cableCrossings(cable: CableDefinition, page: Page, project: Project): CableCrossing[] {
  const result: CableCrossing[] = [];
  const dx=cable.end.x-cable.start.x,dy=cable.end.y-cable.start.y;
  const endpoint = (ep: Wire['from']) => {
    const c=page.components.find(c=>c.id===ep.componentId),s=c&&getSymbolForComponent(c,project),p=s?.pins.find(p=>p.id===ep.pinId);
    if(!c||!s||!p)return;
    const q=rotatedLocalPoint(p,s,c.rotation);return{x:c.x+q.x,y:c.y+q.y};
  };
  for(const wire of page.wires) {
    const from=endpoint(wire.from),to=endpoint(wire.to);if(!from||!to)continue;
    const points=wirePolyline(from,to,wire.waypoints,wirePinDirection(page,project,wire.from),wirePinDirection(page,project,wire.to),false,gridForPage(page));
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],ex=b.x-a.x,ey=b.y-a.y,det=dx*ey-dy*ex;
      if(Math.abs(det)<1e-8)continue; // parallel/overlapping ink is not a cable crossing
      const ax=a.x-cable.start.x,ay=a.y-cable.start.y;
      const t=(ax*ey-ay*ex)/det,u=(ax*dy-ay*dx)/det;
      if(t< -1e-7||t>1+1e-7||u< -1e-7||u>1+1e-7)continue;
      const found=result.find(p=>Math.abs(p.t-t)<1e-7);
      if(found){if(!found.wireIds.includes(wire.id))found.wireIds.push(wire.id);}
      else result.push({x:cable.start.x+t*dx,y:cable.start.y+t*dy,t,wireIds:[wire.id]});
    }
  }
  return result.sort((a,b)=>a.t-b.t);
}

/** Shared geometry and label positions for editor and vector PDF. */
export function cableDrawing(cable: CableDefinition, page: Page, project: Project): DrawingPrimitive[] {
  const units=project.drawingUnitsPerMm ?? 2,ink='#0000ff';
  const graphics: DrawingPrimitive[]=[{kind:'line',x1:cable.start.x,y1:cable.start.y,x2:cable.end.x,y2:cable.end.y,color:ink,width:.25*units}];
  const crosses=cableCrossings(cable,page,project);
  for(const point of crosses) {
    if(cable.markStyle!=='none') graphics.push({kind:'line',x1:point.x-.8*units,y1:point.y-.8*units,x2:point.x+.8*units,y2:point.y+.8*units,color:ink,width:.25*units});
    const core=cable.cores.find(c=>c.wireIds?.some(id=>point.wireIds.includes(id))) ?? cable.cores.find(c=>Math.abs(c.t-point.t)<1e-5);
    const text=core?.designation || core?.color;
    if(text && cable.showCoreLabels!==false) graphics.push({kind:'text',x:point.x+1.5*units,y:point.y-.657*units,size:cable.coreFontSize ?? 1.6146*units,text,color:'#ff0000'});
  }
  if(cable.showLabel!==false) {
    const size=cable.fontSize ?? 2.2356*units,bmkSize=cable.bmkFontSize ?? size;
    const x=cable.start.x+(cable.labelOffset?.x ?? -units),y=cable.start.y+(cable.labelOffset?.y ?? -.285*units);
    const specification=cable.crossSection ? `${cable.coreCount ? cable.coreCount+'x' : ''}${cable.crossSection} mm²` : cable.coreCount ? `${cable.coreCount} Adern` : '';
    const lines=[cable.bmk,cable.cableType,specification,cable.description ?? ''].filter(Boolean);
    let baseline=y-(lines.length-1)*size*1.2;
    lines.forEach((text,index)=>{graphics.push({kind:'text',x,y:baseline,size:index===0&&text===cable.bmk?bmkSize:size,text,color:ink,anchor:'end'});baseline+=size*1.2;});
  }
  return graphics;
}

export function cableSvg(cable: CableDefinition,page: Page,project: Project,selected=false): string {
  const color=selected?'#63b3ed':'#e2e8f0';
  return `<g id="${escapeSvg(cable.id)}" class="cable-definition ${selected?'selected':''}" data-cable-id="${escapeSvg(cable.id)}" color="${color}" style="cursor:pointer"><line x1="${cable.start.x}" y1="${cable.start.y}" x2="${cable.end.x}" y2="${cable.end.y}" stroke="transparent" stroke-width="12"/>${drawingToSvg(cableDrawing(cable,page,project),{color:'currentColor'})}</g>`;
}
