import type {ElkNode} from 'elkjs/lib/elk-api';
/** Two measured spacings: preserve pair interiors, use larger gaps between
 * independent units only if that does not need extra rows or exceed the budget. */
export function packCircuitUnits(id:string,units:ElkNode[][],width:number,height:number,inside:number,outside:number):ElkNode|undefined{
 const fits=(p:{node:ElkNode})=>p.node.width!<=width+1e-6&&p.node.height!<=height+1e-6;
 const pack=(space:number)=>{
  const groups=units.flatMap(u=>u.reduce((n,b)=>n+b.width!,0)+inside*(u.length-1)<=width?[u]:u.map(b=>[b]));
  const children:ElkNode[]=[];let x=0,y=0,rowHeight=0,usedWidth=0,rows=1;
  for(const u of groups){
   const span=u.reduce((n,b)=>n+b.width!,0)+inside*(u.length-1);
   if(x&&x+span>width){x=0;y+=rowHeight+space;rowHeight=0;rows++;}
   for(const [i,b]of u.entries()){
    if(i)x+=inside;
    children.push(...b.children!.map(c=>({...c,x:c.x!+x,y:c.y!+y})));
    usedWidth=Math.max(usedWidth,x+b.width!);rowHeight=Math.max(rowHeight,b.height!);x+=b.width!;
   }
   x+=space;
  }
  return {node:{id,children,width:usedWidth,height:y+rowHeight},rows};
 };
 if(!units.length||units.some(u=>!u.length||u.some(b=>!b.children||!Number.isFinite(b.width)||!Number.isFinite(b.height))))return;
 const compact=pack(inside),spacious=pack(Math.max(inside,outside));
 if(fits(spacious)&&(spacious.rows<=compact.rows||!fits(compact)))return spacious.node;
 if(fits(compact))return compact.node;
}
