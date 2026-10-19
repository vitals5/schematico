import type { DrawingPrimitive } from './types';

export interface XmlAffine { a:number;b:number;c:number;d:number;x:number;y:number }
export const affinePoint=(t:XmlAffine,p:{x:number;y:number})=>({x:t.a*p.x+t.c*p.y+t.x,y:t.b*p.x+t.d*p.y+t.y});

/** Bake cached 2D vector placement into portable library geometry. */
export function affineXmlGraphics(graphics:DrawingPrimitive[],t:XmlAffine,units:number):DrawingPrimitive[] {
  const widthScale=Math.sqrt(Math.abs(t.a*t.d-t.b*t.c)),maxScale=Math.hypot(t.a,t.b,t.c,t.d);
  return graphics.flatMap<DrawingPrimitive>(g=>{
    const width=g.kind==='rect'?g.lineWidth:'width'in g?g.width:undefined;
    const stroke=width===undefined?{}:{width:width*widthScale};
    if(g.kind==='line'){
      const a=affinePoint(t,{x:g.x1,y:g.y1}),b=affinePoint(t,{x:g.x2,y:g.y2});
      return [{...g,x1:a.x,y1:a.y,x2:b.x,y2:b.y,...stroke,...(g.dash?{dash:g.dash.map(n=>n*widthScale)}:{})}];
    }
    if(g.kind==='polygon')return [{...g,points:g.points.map(p=>affinePoint(t,p)),...stroke}];
    if(g.kind==='rect')return [{kind:'polygon',points:[g,{x:g.x+g.width,y:g.y},{x:g.x+g.width,y:g.y+g.height},{x:g.x,y:g.y+g.height}].map(p=>affinePoint(t,p)),color:g.color,...(g.lineWidth===undefined?{}:{width:g.lineWidth*widthScale})}];
    if(g.kind==='text')throw new Error('Nicht proportionale Skalierung gespeicherter Texte wird noch nicht unterstützt.');
    const start=g.kind==='circle'?0:g.startAngle*Math.PI/180;
    let sweep=Math.PI*2;
    if(g.kind==='arc'){
      const raw=(g.endAngle-g.startAngle)*Math.PI/180,turn=2*Math.PI;
      sweep=g.counterClockwise?-(((-raw%turn)+turn)%turn):((raw%turn)+turn)%turn;
      if(Math.abs(raw)>=turn&&Math.abs(sweep)<1e-9)sweep=g.counterClockwise?-turn:turn;
    }
    const maxStep=2*Math.acos(Math.max(-1,1-.01*units/Math.max(1e-12,g.radius*maxScale)));
    const steps=Math.max(1,Math.ceil(Math.abs(sweep)/Math.max(1e-5,maxStep)));
    if(steps>65536)throw new Error('Gespeicherte Kurve überschreitet den unterstützten Genauigkeitsbereich.');
    const points=Array.from({length:steps+1},(_,i)=>affinePoint(t,{x:g.x+g.radius*Math.cos(start+sweep*i/steps),y:g.y+g.radius*Math.sin(start+sweep*i/steps)}));
    if(g.kind==='circle')return [{kind:'polygon',points,color:g.color,...stroke,...(g.fill?{fill:g.fill}:{})}];
    return points.slice(1).map((b,i)=>({kind:'line',x1:points[i].x,y1:points[i].y,x2:b.x,y2:b.y,color:g.color,...stroke}));
  });
}
