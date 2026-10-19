import type { DrawingPrimitive } from './types';
import { xmlPoint } from './NativeXmlSymbol';

type Point={x:number;y:number};
/** Cubic source control points are flattened with a physical 0.01 mm error
 * bound. The same resulting vectors are used in the editor, preview and PDF. */
export function nativeXmlSpline(node:Element,units:number,width:number):DrawingPrimitive[] {
  const values=(node.getAttribute('A621')??'').split(';').filter(Boolean);
  const bulges=node.getAttribute('A622');
  if(values.length!==4||bulges&&(!/^0;0;0;0;?$/.test(bulges))||['A623','A624'].some(key=>node.hasAttribute(key)&&node.getAttribute(key)!=='0'))
    throw new Error('Nicht unterstützte Spline-Struktur im Makro.');
  const points=values.map(value=>{const p=node.cloneNode(false)as Element;p.setAttribute('point',value);return xmlPoint(p,'point',units);});
  const middle=(a:Point,b:Point):Point=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const distance=(p:Point,a:Point,b:Point)=>{
    const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy;
    const t=length2?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length2)):0;
    return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
  };
  const lines:DrawingPrimitive[]=[];
  const split=(a:Point,b:Point,c:Point,d:Point,depth:number):void=>{
    if(Math.max(distance(b,a,d),distance(c,a,d))<=.01*units){
      lines.push({kind:'line',x1:a.x,y1:a.y,x2:d.x,y2:d.y,color:'currentColor',width});return;
    }
    if(depth>=16)throw new Error('Die Spline ist für den unterstützten Genauigkeitsbereich zu komplex.');
    const ab=middle(a,b),bc=middle(b,c),cd=middle(c,d),abc=middle(ab,bc),bcd=middle(bc,cd),center=middle(abc,bcd);
    split(a,ab,abc,center,depth+1);split(center,bcd,cd,d,depth+1);
  };
  split(points[0],points[1],points[2],points[3],0);return lines;
}
