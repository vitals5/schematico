import DxfParser, {type IDxf, type IEntity} from 'dxf-parser';
import type {DrawingPrimitive, PinDefinition, SymbolDefinition} from './types';
import type {CatalogArticle} from './ArticleTypes';
import type {ArticlePackageAssets} from './ArticlePackageAssets';
import type {WindowMacro} from './MacroManager';
import {drawingToSvg, arcPoints} from './ImportedDrawing';

export const MAX_CAD_BYTES = 20 * 1024 * 1024;
type Point = {x:number;y:number};
type Matrix = [number,number,number,number,number,number];
type Entity = IEntity & Record<string, any>;
export interface CadDocument {name:string; data:IDxf; mmPerUnit?:number; units:string; blocks:{id:string;name:string}[]; warnings:string[]}
export interface CadGeometry {
  graphics:{id:string;drawing:DrawingPrimitive}[];
  texts:{id:string;text:string;x:number;y:number}[];
  candidates:{x:number;y:number;direction:PinDefinition['direction'];name:string;textId?:string}[];
  bounds:{minX:number;minY:number;maxX:number;maxY:number};
  candidatesLimited?:boolean;
}
export interface CadPin extends Point {name:string;direction:PinDefinition['direction'];textId?:string}
export interface CadSymbolOptions {name:string;prefix:string;category?:SymbolDefinition['category'];gridMm?:number;scaleMultiplier?:number;bmkTextId?:string;pins:CadPin[];confirmed:boolean}
const units:Record<number,[string,number]> = {1:['in',25.4],2:['ft',304.8],4:['mm',1],5:['cm',10],6:['m',1000],7:['km',1e6],8:['µin',.0000254],9:['mil',.0254],10:['yd',914.4],13:['µm',.001],14:['dm',100],15:['dam',10000],16:['hm',100000]};
const finite=(n:unknown):number=>{if(typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1e9)throw new Error('cadInvalid');return n;};
const point=(p:any):Point=>({x:finite(p?.x),y:finite(p?.y)});
const multiply=(m:Matrix,n:Matrix):Matrix=>[m[0]*n[0]+m[2]*n[1],m[1]*n[0]+m[3]*n[1],m[0]*n[2]+m[2]*n[3],m[1]*n[2]+m[3]*n[3],m[0]*n[4]+m[2]*n[5]+m[4],m[1]*n[4]+m[3]*n[5]+m[5]];
const transform=(p:Point,m:Matrix):Point=>({x:finite(m[0]*p.x+m[2]*p.y+m[4]),y:finite(m[1]*p.x+m[3]*p.y+m[5])});
const textValue=(s:string)=>s.replace(/\\U\+([\dA-F]{4})/gi,(_,v)=>String.fromCharCode(parseInt(v,16))).replace(/\\P/g,'\n').replace(/%%d/gi,'°').replace(/%%p/gi,'±').replace(/%%c/gi,'⌀');

/** Decode exchange geometry only. Electrical pins are always a separate, explicit decision. */
export function readCadDxf(text:string,name:string):CadDocument {
  if(text.length>MAX_CAD_BYTES||text.startsWith('AutoCAD Binary DXF'))throw new Error('cadInvalid');
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/), kinds=new Set<string>();
  let section='', nextSection=false;
  for(let i=0;i+1<lines.length;i+=2){const code=Number(lines[i].trim()),value=lines[i+1].trim();
    if(!Number.isInteger(code))throw new Error('cadInvalid');
    if(code===0&&value==='SECTION')nextSection=true;
    else if(nextSection&&code===2){section=value;nextSection=false;}
    else if(code===0&&value==='ENDSEC')section='';
    else if(code===0&&(section==='ENTITIES'||section==='BLOCKS'))kinds.add(value);
  }
  let data:IDxf|null;try{data=new DxfParser().parseSync(text);}catch{throw new Error('cadInvalid');}
  if(!data?.entities||!data.blocks)throw new Error('cadInvalid');
  const recognized=new Set(['LINE','LWPOLYLINE','POLYLINE','VERTEX','SEQEND','CIRCLE','ARC','ELLIPSE','TEXT','MTEXT','ATTDEF','INSERT','SOLID','TRACE','POINT','VIEWPORT','BLOCK','ENDBLK','ENDSEC']);
  const unknown=[...kinds].filter(k=>!recognized.has(k));
  const unit=units[Number(data.header?.$INSUNITS)];
  return {name,data,mmPerUnit:unit?.[1],units:unit?.[0]??'',blocks:[{id:'',name:'Model'},...Object.entries(data.blocks).filter(([n])=>!n.startsWith('*')).map(([id])=>({id,name:id.replace(/[a-f0-9]{8}_x002D_.*/i,'').replace(/_x([0-9a-f]{4})_/gi,(_,h)=>String.fromCharCode(parseInt(h,16)))}))],warnings:unknown.length?[unknown.join(', ')]:[]};
}

export function cadBounds(graphics:DrawingPrimitive[]) {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const points={push:(...items:Point[])=>{for(const p of items){finite(p.x);finite(p.y);minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}}};
  for(const g of graphics){
    if(g.kind==='line')points.push({x:g.x1,y:g.y1},{x:g.x2,y:g.y2});
    else if(g.kind==='polygon')points.push(...g.points);
    else if(g.kind==='arc')points.push(...arcPoints(g));
    else if(g.kind==='circle')points.push({x:g.x-g.radius,y:g.y-g.radius},{x:g.x+g.radius,y:g.y+g.radius});
    else if(g.kind==='rect')points.push({x:g.x,y:g.y},{x:g.x+g.width,y:g.y+g.height});
    else {const width=g.text.split('\n').reduce((n,s)=>Math.max(n,s.length),0)*g.size*.65, x=g.anchor==='end'?-width:g.anchor==='middle'?-width/2:0;
      const a=(g.rotation??0)*Math.PI/180;for(const p of [{x,y:-g.size},{x:x+width,y:-g.size},{x,y:g.size*.3},{x:x+width,y:g.size*.3}])points.push({x:g.x+p.x*Math.cos(a)-p.y*Math.sin(a),y:g.y+p.x*Math.sin(a)+p.y*Math.cos(a)});
    }
  }
  if(!Number.isFinite(minX))throw new Error('cadEmpty');
  return {minX,minY,maxX,maxY};
}

/** Flatten nested blocks with their base points, rotation, scale and insert arrays. Output is mm, Y down. */
export function cadGeometry(doc:CadDocument,blockId='',mmPerUnit=doc.mmPerUnit??1):CadGeometry {
  if(!(mmPerUnit>0&&mmPerUnit<=1e6))throw new Error('cadInvalid');
  const graphics:CadGeometry['graphics']=[], texts:CadGeometry['texts']=[], ends:Point[]=[];let visited=0;
  const add=(id:string,drawing:DrawingPrimitive)=>{if(graphics.length>=50000)throw new Error('cadTooLarge');graphics.push({id,drawing});};
  const line=(id:string,a:Point,b:Point,m:Matrix)=>{a=transform(a,m);b=transform(b,m);add(id,{kind:'line',x1:a.x,y1:a.y,x2:b.x,y2:b.y,color:'currentColor',width:.15});};
  const curve=(id:string,c:Point,a:Point,ratio:number,start:number,sweep:number,m:Matrix)=>{
    const u=transform(c,m), x={x:m[0]*a.x+m[2]*a.y,y:m[1]*a.x+m[3]*a.y}, y={x:(-m[0]*a.y+m[2]*a.x)*ratio,y:(-m[1]*a.y+m[3]*a.x)*ratio};
    const rx=Math.hypot(x.x,x.y),ry=Math.hypot(y.x,y.y);if(!rx||!ry)throw new Error('cadInvalid');
    const at=(t:number)=>({x:u.x+x.x*Math.cos(t)+y.x*Math.sin(t),y:u.y+x.y*Math.cos(t)+y.y*Math.sin(t)});
    if(sweep<2*Math.PI-1e-8)ends.push(at(start),at(start+sweep));
    if(Math.abs(rx-ry)<1e-7&&Math.abs(x.x*y.x+x.y*y.y)<1e-7){
      if(sweep>=2*Math.PI-1e-8)add(id,{kind:'circle',x:u.x,y:u.y,radius:rx,color:'currentColor',width:.15});
      else {const p=at(start), angle=Math.atan2(p.y-u.y,p.x-u.x)*180/Math.PI,ccw=x.x*y.y-x.y*y.x<0;add(id,{kind:'arc',x:u.x,y:u.y,radius:rx,startAngle:angle,endAngle:angle+(ccw?-1:1)*sweep*180/Math.PI,counterClockwise:ccw,color:'currentColor',width:.15});}
    }else{const count=Math.max(4,Math.ceil(sweep/(Math.PI/90)));for(let i=0;i<count;i++){const p=at(start+sweep*i/count),q=at(start+sweep*(i+1)/count);add(id+':'+i,{kind:'line',x1:p.x,y1:p.y,x2:q.x,y2:q.y,color:'currentColor',width:.15});}}
  };
  const visit=(entities:IEntity[],m:Matrix,stack:string[],path:string)=>{
    for(const [index,raw]of entities.entries()){
      const e=raw as Entity,id=path+'/'+(e.handle??index);
      if(++visited>50000)throw new Error('cadTooLarge');
      const layer=doc.data.tables?.layer?.layers?.[e.layer];
      if(e.visible===false||layer?.visible===false||layer?.frozen||e.type==='VIEWPORT')continue;
      const normal=e.extrusionDirection;
      if(normal&&(Math.abs(normal.x??0)>1e-8||Math.abs(normal.y??0)>1e-8||normal.z!==undefined&&normal.z!==0&&normal.z!==1)||Math.abs(e.extrusionDirectionX??0)>1e-8||Math.abs(e.extrusionDirectionY??0)>1e-8||e.extrusionDirectionZ===-1)throw new Error('cadNonPlanar');
      if(e.type==='INSERT'){
        const block=doc.data.blocks[e.name];if(!block||stack.includes(e.name)||stack.length>=16)throw new Error('cadBlockInvalid');
        const p=point(e.position),base=point(block.position??{x:0,y:0}),a=(e.rotation??0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),sx=finite(e.xScale??1),sy=finite(e.yScale??1);
        const rows=Math.max(1,e.rowCount??1),cols=Math.max(1,e.columnCount??1);if(!Number.isInteger(rows)||!Number.isInteger(cols)||rows*cols>1000)throw new Error('cadTooLarge');
        for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
          const dx=col*(e.columnSpacing??0),dy=row*(e.rowSpacing??0);
          const local:Matrix=[c*sx,s*sx,-s*sy,c*sy,p.x+c*dx-s*dy-c*sx*base.x+s*sy*base.y,p.y+s*dx+c*dy-s*sx*base.x-c*sy*base.y];
          visit(block.entities??[],multiply(m,local),[...stack,e.name],id+':'+row+':'+col);
        }
      }else if(e.type==='LINE'||e.type==='LWPOLYLINE'||e.type==='POLYLINE'){
        if(e.is3dPolyline||e.isPolyfaceMesh||e.is3dPolygonMesh)throw new Error('cadNonPlanar');
        const vertices=e.vertices as (Point&{bulge?:number})[];if(!Array.isArray(vertices)||vertices.length<2)throw new Error('cadInvalid');
        if(vertices.some(v=>Math.abs(((v as any).z??0)-((vertices[0] as any).z??0))>1e-8))throw new Error('cadNonPlanar');
        const count=vertices.length-(e.shape?0:1);
        for(let i=0;i<count;i++){
          const a=point(vertices[i]),b=point(vertices[(i+1)%vertices.length]),bulge=vertices[i].bulge??0;
          if(Math.abs(bulge)>1e-10){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(!len)continue;const factor=(1-bulge*bulge)/(4*bulge),c={x:(a.x+b.x)/2-dy*factor,y:(a.y+b.y)/2+dx*factor},r=Math.hypot(a.x-c.x,a.y-c.y),s=Math.atan2(a.y-c.y,a.x-c.x),sweep=4*Math.atan(bulge);curve(id+':'+i,c,{x:r,y:0},1,sweep<0?s+sweep:s,Math.abs(sweep),m);}
          else line(id+':'+i,a,b,m);
        }
        if(!e.shape){ends.push(transform(point(vertices[0]),m),transform(point(vertices.at(-1)),m));}
      }else if(e.type==='CIRCLE'||e.type==='ARC'){
        const c=point(e.center),r=finite(e.radius);if(r<=0)throw new Error('cadInvalid');let sweep=e.type==='CIRCLE'?2*Math.PI:(e.endAngle-e.startAngle+2*Math.PI)%(2*Math.PI);if(!sweep)sweep=2*Math.PI;
        curve(id,c,{x:r,y:0},1,e.type==='CIRCLE'?0:e.startAngle,sweep,m);
      }else if(e.type==='ELLIPSE'){
        let sweep=(e.endAngle-e.startAngle+2*Math.PI)%(2*Math.PI);if(!sweep)sweep=2*Math.PI;
        curve(id,point(e.center),point(e.majorAxisEndPoint),finite(e.axisRatio),finite(e.startAngle),sweep,m);
      }else if(['TEXT','MTEXT','ATTDEF'].includes(e.type)){
        if(e.invisible)continue;
        const mx=Math.hypot(m[0],m[1]),my=Math.hypot(m[2],m[3]);
        if(Math.abs(mx-my)>1e-7||Math.abs(m[0]*m[2]+m[1]*m[3])>1e-7||Math.abs((e.xScale??e.scale??1)-1)>1e-8||e.obliqueAngle||e.backwards||e.mirrored||(e.generationFlag??0)!==0)throw new Error('cadTextUnsupported');
        const h=e.halign??e.horizontalJustification??0,v=e.valign??e.verticalJustification??0;
        if(h>2&&h!==4||v>3||e.type==='MTEXT'&&((e.attachmentPoint??1)<1||(e.attachmentPoint??1)>9))throw new Error('cadTextUnsupported');
        const isMText=e.type==='MTEXT',attach=isMText?(e.attachmentPoint??1):0;
        const anchor=isMText?([2,5,8].includes(attach)?'middle':[3,6,9].includes(attach)?'end':'start'):(h===2?'end':(h===1||h===4)?'middle':'start');
        const height=finite(e.textHeight??e.height??1);
        const position=point(isMText?{x:e.position?.x??0,y:(e.position?.y??0)+([1,2,3].includes(attach)?-height*.75:[4,5,6].includes(attach)?-height*.25:height*.2)}:(h||v)&&e.endPoint?{x:e.endPoint.x,y:e.startPoint?.y??e.endPoint.y}:e.startPoint);
        const p=transform(position,m);
        const angle=(e.rotation??0)*Math.PI/180,dir={x:m[0]*Math.cos(angle)+m[2]*Math.sin(angle),y:m[1]*Math.cos(angle)+m[3]*Math.sin(angle)};
        const text=textValue(String(e.text??''));if(text.length>10000||/\\[A-Za-z].*;/.test(text))throw new Error('cadTextUnsupported');
        add(id,{kind:'text',...p,text,size:height*Math.hypot(m[2],m[3]),rotation:Math.atan2(dir.y,dir.x)*180/Math.PI,anchor,color:'currentColor'});texts.push({id,text,...p});
      }else if(e.type==='SOLID'||e.type==='TRACE'){
        const points=(e.points??e.vertices??[]).map((p:Point)=>transform(point(p),m));if(points.length<3)throw new Error('cadInvalid');
        add(id,{kind:'polygon',points,color:'currentColor',fill:'currentColor',width:.15});
      }else if(e.type!=='POINT'&&!doc.warnings.some(w=>w.split(', ').includes(e.type)))throw new Error('cadUnsupported: '+e.type);
    }
  };
  const selected=blockId?doc.data.blocks[blockId]:undefined;if(blockId&&!selected)throw new Error('cadBlockInvalid');
  visit(selected?.entities??doc.data.entities.filter(e=>!e.inPaperSpace),[mmPerUnit,0,0,-mmPerUnit,0,0],blockId?[blockId]:[],'cad');
  const bounds=cadBounds(graphics.map(g=>g.drawing)),body=cadBounds(graphics.filter(g=>g.drawing.kind!=='text').map(g=>g.drawing));
  const counts=new Map<string,{p:Point;n:number}>();
  for(const p of ends){const key=p.x.toFixed(5)+','+p.y.toFixed(5),entry=counts.get(key);if(entry)entry.n++;else counts.set(key,{p,n:1});}
  const candidates=[...counts.values()].filter(v=>v.n===1).map(({p})=>{
    const direction=([['top',Math.abs(p.y-body.minY)],['bottom',Math.abs(p.y-body.maxY)],['left',Math.abs(p.x-body.minX)],['right',Math.abs(p.x-body.maxX)]] as [PinDefinition['direction'],number][]).sort((a,b)=>a[1]-b[1])[0][0];
    const isBoundary=Math.abs(p.y-body.minY)<1e-3||Math.abs(p.y-body.maxY)<1e-3||Math.abs(p.x-body.minX)<1e-3||Math.abs(p.x-body.maxX)<1e-3;
    const label=texts.filter(t=>/^(?:[+-]?[A-Za-z0-9]+(?:\/[A-Za-z0-9]+)?|[+-])$/.test(t.text)).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
    const near=label&&Math.hypot(label.x-p.x,label.y-p.y)<5*mmPerUnit;
    return {...p,direction,isBoundary,name:near?label.text:'',textId:near?label.id:undefined};
  }).sort((a,b)=>(b.isBoundary?1:0)-(a.isBoundary?1:0)||a.y-b.y||a.x-b.x);
  return {graphics,texts,candidates:candidates.slice(0,256),candidatesLimited:candidates.length>256,bounds};
}

export async function createCadSymbol(article:CatalogArticle,geometry:CadGeometry,options:CadSymbolOptions):Promise<{symbol:SymbolDefinition;macro:WindowMacro}> {
  if(!options.confirmed||!options.name.trim()||!options.prefix.trim()||options.pins.length>256||options.gridMm!==undefined&&(!Number.isFinite(options.gridMm)||options.gridMm<=0||options.gridMm>1000))throw new Error('cadConfirmRequired');
  const usedTexts=options.pins.map(p=>p.textId).filter(Boolean);
  const bmkTextId=options.bmkTextId&&!usedTexts.includes(options.bmkTextId)?options.bmkTextId:undefined;
  if(new Set(usedTexts).size!==usedTexts.length)throw new Error('cadTextDuplicate');
  for(const pin of options.pins)if(!pin.name.trim()||!['top','bottom','left','right'].includes(pin.direction)){throw new Error('cadPinInvalid');}else{finite(pin.x);finite(pin.y);}
  let scale = options.scaleMultiplier ?? 1;
  if(options.gridMm){
    const distances:number[]=[];for(let i=0;i<options.pins.length;i++)for(let j=i+1;j<options.pins.length;j++)for(const axis of ['x','y'] as const){const d=Math.abs(options.pins[i][axis]-options.pins[j][axis]);if(d>1e-5)distances.push(d);}
    const mult = options.scaleMultiplier ?? 1;
    if(distances.length)scale=(options.gridMm/Math.min(...distances))*mult;
    const first=options.pins[0];if(first&&options.pins.some(p=>['x','y'].some(axis=>{const v=((p[axis as 'x'|'y']-first[axis as 'x'|'y'])*scale)/(options.gridMm!*mult);return Math.abs(v-Math.round(v))>1e-5;})))throw new Error('cadGridInvalid');
  }
  const kept=geometry.graphics.filter(g=>g.id!==bmkTextId&&!usedTexts.includes(g.id));
  const bounds=cadBounds(kept.map(g=>g.drawing)),offset={x:-bounds.minX,y:-bounds.minY};
  const at=(p:Point)=>({x:(p.x+offset.x)*scale*2,y:(p.y+offset.y)*scale*2});
  const drawings=kept.map(({drawing:g}):DrawingPrimitive=>{
    const factor=scale*2;
    if(g.kind==='line'){const p=at({x:g.x1,y:g.y1}),q=at({x:g.x2,y:g.y2});return {...g,x1:p.x,y1:p.y,x2:q.x,y2:q.y,width:(g.width??.15)*factor};}
    if(g.kind==='polygon')return {...g,points:g.points.map(at),width:(g.width??.15)*factor};
    const p=at(g);if(g.kind==='arc'||g.kind==='circle')return {...g,...p,radius:g.radius*factor,width:(g.width??.15)*factor};
    if(g.kind==='text')return {...g,...p,size:g.size*factor};
    return {...g,...p,width:g.width*factor,height:g.height*factor,lineWidth:(g.lineWidth??.15)*factor};
  });
  const pins:PinDefinition[]=options.pins.map((p,i)=>{const text=geometry.graphics.find(t=>t.id===p.textId)?.drawing;return {id:'p'+(i+1),name:p.name.trim(),...at(p),direction:p.direction,electricalRole:'unknown',...(text?.kind==='text'?{labelPosition:{...at(text),fontSize:text.size*scale*2,alignment:text.anchor??'start',rotation:((Math.round((text.rotation??0)/90)*90)%360+360)%360 as 0|90|180|270}}:{})};});
  const width=Math.max(1,(bounds.maxX-bounds.minX)*scale*2),height=Math.max(1,(bounds.maxY-bounds.minY)*scale*2);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({articleId:article.id,options,drawings,pins})))),b=>b.toString(16).padStart(2,'0')).join('');
  const symbol:SymbolDefinition={id:'cad-symbol:'+hash,name:options.name.trim(),category:options.category??'structure',standard:'CAD',defaultBmkPrefix:options.prefix.trim().startsWith('-')?options.prefix.trim():'-'+options.prefix.trim(),defaultFunctionText:'',width,height,pins,unitsPerMm:2,insertionPoint:pins[0]?{x:pins[0].x,y:pins[0].y}:{x:0,y:0},importedGraphics:drawings,svgContent:drawingToSvg(drawings),description:'CAD · '+article.manufacturer+' '+article.articleNumber,manufacturer:article.manufacturer,articleNumber:article.articleNumber};
  const macro:WindowMacro={id:'cad-macro:'+hash,name:symbol.name,type:'ema',category:'Artikelpakete',description:symbol.description,width,height,unitsPerMm:2,handlePoint:symbol.insertionPoint,symbolLibrary:[symbol],components:[{id:'cad-component:'+hash,symbolId:symbol.id,x:0,y:0,rotation:0,bmk:symbol.defaultBmkPrefix+'1',functionText:'',pins:Object.fromEntries(pins.map(p=>[p.id,{customLabel:p.name}]))}]};
  return {symbol,macro};
}

export function attachCadSymbol(article:CatalogArticle,existing:ArticlePackageAssets|undefined,symbol:SymbolDefinition,macro:WindowMacro,sources:ArticlePackageAssets['sources']):{article:CatalogArticle;asset:ArticlePackageAssets} {
  const all=[...(existing?.sources??[])];
  for(const source of sources)if(!all.some(s=>s.path===source.path&&s.data.length===source.data.length&&s.data.every((v,i)=>v===source.data[i])))all.push(source);
  if(all.reduce((n,s)=>n+s.data.length,0)>64*1024*1024)throw new Error('cadTooLarge');
  return {article:{...article,symbolId:symbol.id,symbol},asset:{id:article.id,sources:all,macros:[...(existing?.macros??[]).filter(m=>m.id!==macro.id),macro],diagnostics:[...(existing?.diagnostics??[]),'CAD: '+symbol.name+' · '+symbol.pins.length+' user-confirmed pins']}};
}
