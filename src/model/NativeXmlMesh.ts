import { xmlChildren, xmlTag } from './NativeXmlSymbol';
import type { DrawingPrimitive } from './types';

type Vec = [number,number,number];
const invalid = ():never => {throw new Error('Ungültige oder nicht unterstützte gespeicherte 3D-Geometrie.');};
const vector=(value:string):Vec=>{
  const numbers=value.split('/').map(Number);
  if(numbers.length!==3||numbers.some(n=>!Number.isFinite(n)))return invalid();
  return numbers as Vec;
};
const cross=(a:Vec,b:Vec):Vec=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

/** Decode the typed, textual version-2 mesh profile into its actual
 * boundary loops. Other profiles fail explicitly; streams are never executed. */
export function meshBoundaryLoops(stream:string,meshTypeId=20):Vec[][] {
  const header=stream.match(/^#,1,1\{(\d+),2,16,1>\{[^{}]*\}\{[^{}]*\}\d+,/);
  if(!header||Number(header[1])!==meshTypeId)return invalid();
  const tokens=stream.slice(header[0].length).split(',');let cursor=0;
  const number=()=>{const value=Number(tokens[cursor++]);if(!Number.isFinite(value))return invalid();return value;};
  const count=(max=100000)=>{const value=number();if(!Number.isInteger(value)||value<0||value>max)return invalid();return value;};
  const vertexCount=count(),vertices=Array.from({length:vertexCount},()=>vector(tokens[cursor++]??''));
  const normalCount=count();for(let i=0;i<normalCount*3;i++)number();
  const faces=count(),loops:Vec[][]=[];
  for(let f=0;f<faces;f++){
    if(number()!==84)return invalid();number();number();if(tokens[cursor++]!=='*')return invalid();
    const triangles=count();
    for(let i=0;i<triangles*3;i++){
      const index=count();if(index>=vertexCount)return invalid();number();
    }
    const extra=count();for(let i=0;i<extra*6;i++)number();
    const boundaries=count();
    for(let b=0;b<boundaries;b++){
      number();const size=count(),loop:Vec[]=[];
      for(let i=0;i<size;i++){const index=count();if(index>=vertexCount)return invalid();loop.push(vertices[index]);}
      if(loop.length>1)loops.push(loop);
    }
  }
  if(!loops.length)return invalid();return loops;
}

/** World transforms follow explicit parent references, not XML nesting. */
export function projectedXmlMesh(node:Element,byId:ReadonlyMap<string,Element>,units:number):DrawingPrimitive[] {
  const mesh=byId.get(node.getAttribute('R9')??'');
  const stream=mesh&&xmlChildren(mesh).find(n=>xmlTag(n)==='Stream'&&n.getAttribute('Id')==='62491');
  if(!stream)return invalid();
  // Stream type numbers are local to the serialized class table, not universal
  // constants. Different releases assign different IDs to the same profile.
  const schema=node.ownerDocument?.documentElement.getAttribute('StreamSchema');
  let meshTypeId=20;
  if(schema){
    const entry=schema.split(';').map(part=>part.split(',').map(s=>s.trim())).find(fields=>fields[0]==='Mesh3dX@W3D');
    if(!entry||entry[2]!=='2'||!/^\d+$/.test(entry[3]))return invalid();
    meshTypeId=Number(entry[3]);
  }
  const chain:Element[]=[],seen=new Set<Element>();let current:Element|undefined=node;
  while(current){
    if(seen.has(current)||chain.length>=128)return invalid();seen.add(current);chain.push(current);
    const parent=current.getAttribute('R2481');current=parent?byId.get(parent):undefined;
    if(parent&&!current)return invalid();
  }
  const transforms=chain.map(n=>{
    const origin=vector(n.getAttribute('A2482')||'0/0/0'),x=vector(n.getAttribute('A2483')||'1/0/0'),y=vector(n.getAttribute('A2484')||'0/1/0');
    const z=cross(x,y);
    if(Math.abs(Math.hypot(...x)-1)>1e-6||Math.abs(Math.hypot(...y)-1)>1e-6||Math.abs(Math.hypot(...z)-1)>1e-6)return invalid();
    return {origin,x,y,z};
  });
  const project=(point:Vec)=>{
    let p=point;
    for(const {origin,x,y,z}of transforms)p=origin.map((o,i)=>o+x[i]*p[0]+y[i]*p[1]+z[i]*p[2])as Vec;
    return {x:p[0]*units,y:-p[1]*units};
  };
  const edges=new Map<string,DrawingPrimitive>();
  for(const loop of meshBoundaryLoops(stream.textContent??'',meshTypeId))for(let i=1;i<loop.length;i++){
    const a=project(loop[i-1]),b=project(loop[i]);if(Math.hypot(a.x-b.x,a.y-b.y)<1e-7)continue;
    const ends=[`${a.x.toFixed(6)},${a.y.toFixed(6)}`,`${b.x.toFixed(6)},${b.y.toFixed(6)}`].sort();
    edges.set(ends.join(':'),{kind:'line',x1:a.x,y1:a.y,x2:b.x,y2:b.y,color:'currentColor',width:.18*units});
  }
  return [...edges.values()];
}
