import { XMLSerializer } from '@xmldom/xmldom';
import { rotateDrawing } from './ImportedDrawing';
import { nativeXmlGraphics } from './NativeXmlGraphics';
import { xmlChildren as children, xmlTag as tag, xmlPoint } from './NativeXmlSymbol';
import { nativeXmlText } from './NativeXmlText';
import type { DrawingPrimitive, PageImage } from './types';
import type { NativeMacroData } from './NativeMacroData';
import { embeddedXmlImages } from './NativeXmlAssets';
import { projectedXmlMesh } from './NativeXmlMesh';
import { affineXmlGraphics, type XmlAffine } from './NativeXmlAffine';

export const xmlSymbolTypes = new Set(['O17','O42','O59','O70','O88','O93','O130','O231','O234','O241']);
const graphicTypes = new Set(['O30','O31','O32','O34','O44','O52','O83','O89','O122']);
const metadataTypes = new Set(['O6','O37','O76','O98','O106','O161','O212','O217','O218','O219']);
type Transform = { x: number; y: number; angle: number; scale: number; affine?:XmlAffine };
const identity: Transform = { x: 0, y: 0, angle: 0, scale: 1 };
export interface XmlDrawing { node: Element; aliases?: Element[]; graphics: DrawingPrimitive[] }

function transformed(graphics: DrawingPrimitive[], t: Transform, units=2): DrawingPrimitive[] {
  if(t.affine)return affineXmlGraphics(graphics,t.affine,units);
  const scaled = graphics.map(g => {
    if (g.kind === 'polygon') return { ...g, points: g.points.map(p => ({ x: p.x*t.scale, y: p.y*t.scale })),
      ...(g.width !== undefined ? {width:g.width*t.scale}: {}) };
    const result = { ...g } as Record<string, unknown>;
    for (const key of ['x','y','x1','y1','x2','y2','width','height','radius','lineWidth','size'])
      if (typeof result[key] === 'number') result[key] = (result[key] as number)*t.scale;
    if (g.kind === 'text') result.rotation = (g.rotation ?? 0) + t.angle;
    return result as unknown as DrawingPrimitive;
  });
  return rotateDrawing(scaled,t.angle,0,0).map(g => g.kind === 'line'
    ? {...g,x1:g.x1+t.x,y1:g.y1+t.y,x2:g.x2+t.x,y2:g.y2+t.y}
    : g.kind === 'polygon' ? {...g,points:g.points.map(p=>({x:p.x+t.x,y:p.y+t.y}))}
    : {...g,x:g.x+t.x,y:g.y+t.y});
}

function placement(node: Element, units: number, parent = identity, field = 'S40x1201'): Transform {
  const placementNode = children(node).find(n=>tag(n)===field);
  if (!placementNode) return parent;
  const local = xmlPoint(placementNode,'A762',units), m = children(placementNode).find(n=>tag(n)==='S39x761');
  const a = Number(m?.getAttribute('A751') ?? 1), b = Number(m?.getAttribute('A752') ?? 0);
  const c = Number(m?.getAttribute('A753') ?? 0), d = Number(m?.getAttribute('A754') ?? 1);
  if (![a,b,c,d].every(Number.isFinite) || Math.abs(a*d-b*c)<1e-12)
    throw new Error('Ungültige Transformation der gespeicherten Grafik.');
  const r=parent.angle*Math.PI/180;
  const p=parent.affine??{a:parent.scale*Math.cos(r),b:parent.scale*Math.sin(r),c:-parent.scale*Math.sin(r),d:parent.scale*Math.cos(r),x:parent.x,y:parent.y};
  const result:XmlAffine={a:p.a*a-p.c*b,b:p.b*a-p.d*b,c:-p.a*c+p.c*d,d:-p.b*c+p.d*d,
    x:p.x+p.a*local.x+p.c*local.y,y:p.y+p.b*local.x+p.d*local.y};
  if(!Object.values(result).every(Number.isFinite))throw new Error('Ungültige Transformation der gespeicherten Grafik.');
  if(Math.abs(result.c+result.b)<1e-6&&Math.abs(result.d-result.a)<1e-6)
    return {x:result.x,y:result.y,angle:Math.atan2(result.b,result.a)*180/Math.PI,scale:Math.hypot(result.a,result.b)};
  return {x:result.x,y:result.y,angle:0,scale:1,affine:result};
}

function dimension(node: Element, units: number): DrawingPrimitive[] {
  const a=xmlPoint(node,'A1761',units),b=xmlPoint(node,'A1764',units);
  const c=xmlPoint(node,'A1767',units),d=xmlPoint(node,'A1768',units),label=xmlPoint(node,'A1769',units);
  const color='currentColor',width=.18*units;
  const line=(p:typeof a,q:typeof a):DrawingPrimitive=>({kind:'line',x1:p.x,y1:p.y,x2:q.x,y2:q.y,color,width});
  const dx=d.x-c.x,dy=d.y-c.y,len=Math.hypot(dx,dy);
  const arrows:DrawingPrimitive[]=[];
  if(len>1e-9)for(const [p,sign]of [[c,1],[d,-1]]as const){
    const ux=dx/len*sign,uy=dy/len*sign,size=Math.min(2*units,len/4);
    arrows.push({kind:'polygon',points:[p,{x:p.x+ux*size-uy*size/3,y:p.y+uy*size+ux*size/3},
      {x:p.x+ux*size+uy*size/3,y:p.y+uy*size-ux*size/3}],color,fill:color,width});
  }
  return [line(a,c),line(b,d),line(c,d),...arrows,{kind:'text',...label,
    text:nativeXmlText(node.getAttribute('A1770')??''),size:2.5*1.242*units,color}];
}

/** Cached graphical children are real exported geometry; do not execute streams. */
export function readXmlRecords(root: Element, page: Element, units: number, diagnostics: string[], allowMissing: boolean) {
  const drawings:XmlDrawing[]=[],electrical:Element[]=[],images:PageImage[]=[],groups:Element[]=[];
  const imageMappings=new Map<Element,string>();
  const metadata:NativeMacroData['metadata']=[],serializer=new XMLSerializer();
  const resolveImage=embeddedXmlImages(root,page);
  const all=[root,...Array.from(root.getElementsByTagName('*'))];
  const byId=new Map(all.filter(n=>n.hasAttribute('A1')).map(n=>[n.getAttribute('A1')!,n]));
  const owners=new Map(all.filter(n=>n.hasAttribute('R9')).map(n=>[n.getAttribute('R9')!,n]));
  const retain=(node:Element)=>{
    const copy=node.cloneNode(true)as Element;
    for(const child of children(copy))if(/^O\d+$/.test(tag(child)))copy.removeChild(child);
    metadata.push({id:node.getAttribute('A1')??'',type:tag(node),xml:serializer.serializeToString(copy)});
  };
  const visit=(node:Element,t:Transform=identity):void=>{
    const kind=tag(node);
    if(kind==='ExternalFile'||kind==='ESymLib')return;
    if(kind==='O174'||kind==='O176'||kind==='O180'||kind==='O187'){
      drawings.push({node,graphics:projectedXmlMesh(node,byId,units)});retain(node);
      for(const child of children(node).filter(n=>/^O\d+$/.test(tag(n))))visit(child,t);return;
    }
    if(kind==='O170'||kind==='O229'||kind==='O14'){
      retain(node);for(const child of children(node).filter(n=>/^O\d+$/.test(tag(n))))visit(child,t);return;
    }
    if (/^P\d+$/.test(kind)) return;
    if (kind==='O26'||kind==='O132'||kind==='O200'||kind==='O169'){
      groups.push(node);for(const child of children(node).filter(n=>/^O\d+$/.test(tag(n))))visit(child,t);return;
    }
    if(kind==='O3'){
      retain(node);const local=placement(node,units,t,'S40x21');
      for(const child of children(node)){
        if(/^O\d+$/.test(tag(child)))visit(child,local);
        else if(/^S(?:30|31|32|34|44|52|83|89)x/.test(tag(child))){
          const copy=child.ownerDocument!.createElement('O'+tag(child).match(/^S(\d+)/)![1]);
          for(const attr of Array.from(child.attributes))copy.setAttribute(attr.name,attr.value);
          for(const nested of children(child))copy.appendChild(nested.cloneNode(true));
          drawings.push({node:child,graphics:transformed(nativeXmlGraphics(copy,units),local,units)});
        }
      }return;
    }
    if(xmlSymbolTypes.has(kind)){electrical.push(node);return;}
    if(graphicTypes.has(kind)){
      drawings.push({node,graphics:transformed(nativeXmlGraphics(node,units),t,units)});
      if(kind==='O44'||kind==='O122')retain(node);
      if(kind==='O122')diagnostics.push('Dokumentverweis als bearbeitbare Beschriftung übernommen; die externe Zieldatei ist nicht Bestandteil der Zeichnung.');
      return;
    }
    if(metadataTypes.has(kind)){retain(node);return;}
    if(kind==='O97'){drawings.push({node,graphics:transformed(dimension(node,units),t,units)});retain(node);return;}
    if(kind==='O91'){
      const a=xmlPoint(node,'A1651',units),b=xmlPoint(node,'A1652',units),sourcePath=node.getAttribute('A1671')??'';
      const actual=resolveImage(sourcePath);
      if(!actual&&!allowMissing)throw new Error(`Bilddatei fehlt im Makropaket: ${sourcePath}`);
      if(!actual)diagnostics.push(`Bilddatei fehlt: ${sourcePath}. Der Bildbereich bleibt ersetzbar erhalten.`);
      const svg='<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90"><rect x="1" y="1" width="158" height="88" fill="#171b24" stroke="#f6ad55" stroke-dasharray="4 3"/><text x="80" y="49" font-family="Arial" font-size="14" fill="#f6ad55" text-anchor="middle">Bild fehlt</text></svg>';
      images.push({id:crypto.randomUUID(),sourcePath,missing:!actual,caption:sourcePath,
        dataUrl:actual??'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg),x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),
        width:Math.max(1,Math.abs(a.x-b.x)),height:Math.max(1,Math.abs(a.y-b.y))});imageMappings.set(node,images.at(-1)!.id);retain(node);return;
    }
    if(kind==='O144'||kind==='O191'){retain(node);return;}
    if(kind==='O190'){
      retain(node);for(const child of children(node).filter(n=>/^O\d+$/.test(tag(n))))visit(child,t);return;
    }
    if(kind==='O5'){
      const owner=owners.get(node.getAttribute('A1')??'')??byId.get(node.getAttribute('A65')??'');
      const local=owner?placement(owner,units,t):t;
      const graphics:DrawingPrimitive[]=[];
      for(const child of children(node)){
        if(!/^S(?:30|31|32|34|44|52|83|89)x/.test(tag(child)))continue;
        const copy=child.ownerDocument!.createElement('O'+tag(child).match(/^S(\d+)/)![1]);
        for(const attr of Array.from(child.attributes))copy.setAttribute(attr.name,attr.value);
        for(const nested of children(child))copy.appendChild(nested.cloneNode(true));
        graphics.push(...nativeXmlGraphics(copy,units));
      }
      if(graphics.length)drawings.push({node,aliases:owner?[owner]:[],graphics:transformed(graphics,local,units)});
      else if(children(node).some(n=>tag(n)==='Stream'))diagnostics.push('Eine gespeicherte Ansicht enthält nur Binärdaten; diese sind als Quelldaten erhalten.');
      retain(node);return;
    }
    throw new Error(`Das XML-Makro enthält einen noch nicht unterstützten Objekttyp (${kind}).`);
  };
  for(const node of children(page))visit(node);
  return {drawings:drawings.filter(d=>d.graphics.length),electrical,images,groups,metadata,imageMappings};
}
