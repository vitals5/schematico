import { DrawingPrimitive, Page, Project } from './types';
import { drawingToSvg, escapeSvg } from './ImportedDrawing';

export type FrameText = { id: string; x: number; y: number; size: number; anchor: 'start' | 'middle' | 'end';
  text?: string; property?: number; index?: number };
export type PlotFrameTemplate = { id: string; name: string; width: number; height: number;
  graphics: DrawingPrimitive[]; texts: FrameText[]; diagnostics?: string[]; properties?: Record<string, string> };

/** Default A3 frame uses the same full-width footer as the reference norm sheet. */
export function defaultPlotFrame(): PlotFrameTemplate {
  const graphics: DrawingPrimitive[] = [{ kind: 'rect', x: 0, y: 0, width: 420, height: 297, color: 'currentColor', lineWidth: .35 }];
  const line = (x1: number, y1: number, x2: number, y2: number) => graphics.push({ kind: 'line', x1, y1: 297-y1, x2, y2: 297-y2, width: .25, color: 'currentColor' });
  line(0,16,420,16); line(0,292,420,292);
  for (let i=1;i<10;i++) line(i*42,292,i*42,297);
  for (const x of [20,40,60,72,100,184,230,300,370,400]) line(x,0,x,16);
  for (const y of [4,8,12]) { line(0,y,100,y); line(400,y,420,y); }
  const texts: FrameText[] = [];
  const add = (id: string, x: number, y: number, text?: string, property?: number, anchor: FrameText['anchor']='start') => texts.push({ id,x,y:297-y,size:1.8*1.242,...(text === undefined ? {} : {text}),...(property === undefined ? {} : {property}),anchor });
  for (let i=0;i<10;i++) texts.push({id:`column-${i}`,x:21+42*i,y:3.6,size:1.5*1.242,anchor:'middle',text:String(i)});
  add('date-label',61,13,'Datum'); add('date',73,13,undefined,11024); add('author-label',61,9,'Bearb.'); add('author',73,9,undefined,11022);
  add('approved',61,5,'Gepr.'); add('original',61,1,'Urspr.'); add('description',101,5,undefined,10011);
  add('company',185,12,undefined,10015); add('page-title',231,12,undefined,11011);
  add('structure-sign',371,13,'='); add('structure',374,13,undefined,1001);
  add('location-sign',371,9,'+'); texts.push({id:'location',x:374,y:288,size:1.8*1.242,anchor:'start',property:1001,index:2});
  add('sheet-label',401,5,'Blatt'); add('sheet',419,5,undefined,11000,'end');
  add('ordinal-label',401,1,'Seite'); add('ordinal',413,1,undefined,25020,'end'); add('slash',414,1,'/'); add('total',415,1,undefined,10300);
  add('change',1,1,'Änderung'); add('change-date',21,1,'Datum'); add('change-name',41,1,'Name'); add('replacement',101,1,'Ersatz von'); add('replaced',143,1,'Ersetzt durch');
  return { id:'default-a3',name:'A3 Normblatt',width:420,height:297,graphics,texts };
}

export function frameTextValue(text: FrameText, page: Page, project: Project, template: PlotFrameTemplate): string {
  if (text.text !== undefined) return text.text;
  const tb=page.plotFrame.titleBlock, index=project.pages.findIndex(p=>p.id===page.id);
  const neighbor = (target?: Page) => !target ? '' : target.higherLevel !== page.higherLevel || target.location !== page.location ? `${target.higherLevel}${target.location}/${target.pageNumber}` : target.pageNumber;
  const values: Record<number,string> = { 10011: project.description || tb.projectTitle,10015:tb.company || project.company,
    11011:page.title,11022:tb.author || project.author,11024:tb.date,11000:page.pageNumber,
    25020:String(index+1),10300:String(project.pages.length),11041:neighbor(project.pages[index-1]),11040:neighbor(project.pages[index+1]) };
  if (text.property===19005) return String(Math.floor(text.x/template.width*10));
  if (text.property===1001) return ((text.index===2 || text.index===20134) ? page.location : page.higherLevel).replace(/^[=+]+/,'');
  return values[text.property ?? 0] ?? template.properties?.[String(text.property)] ?? '';
}

export function frameTextCell(text: FrameText, template: PlotFrameTemplate) {
  const vertical: {x:number;top:number;bottom:number}[]=[{x:0,top:0,bottom:template.height},{x:template.width,top:0,bottom:template.height}];
  const horizontal: {y:number;left:number;right:number}[]=[{y:0,left:0,right:template.width},{y:template.height,left:0,right:template.width}];
  for(const g of template.graphics) {
    if(g.kind==='line') {
      if(Math.abs(g.x1-g.x2)<1e-6) vertical.push({x:g.x1,top:Math.min(g.y1,g.y2),bottom:Math.max(g.y1,g.y2)});
      if(Math.abs(g.y1-g.y2)<1e-6) horizontal.push({y:g.y1,left:Math.min(g.x1,g.x2),right:Math.max(g.x1,g.x2)});
    }
  }
  const xs=vertical.filter(v=>text.y>=v.top-1e-6 && text.y<=v.bottom+1e-6).map(v=>v.x);
  const ys=horizontal.filter(v=>text.x>=v.left-1e-6 && text.x<=v.right+1e-6).map(v=>v.y);
  const left=Math.max(0,...xs.filter(x=>x<text.x-1e-5)),right=Math.min(template.width,...xs.filter(x=>x>text.x+1e-5));
  const top=Math.max(0,...ys.filter(y=>y<text.y-1e-5)),bottom=Math.min(template.height,...ys.filter(y=>y>text.y+1e-5));
  return {x:left+.3,y:top+.3,width:Math.max(.1,right-left-.6),height:Math.max(.1,bottom-top-.6)};
}

export function fitFrameText(value: string, text: FrameText, cell: ReturnType<typeof frameTextCell>) {
  const available = text.anchor==='start' ? cell.x+cell.width-text.x : text.anchor==='end' ? text.x-cell.x : 2*Math.min(text.x-cell.x,cell.x+cell.width-text.x);
  // Conservative character metrics; a per-cell clip is the final hard bound in
  // both renderers. Ordinary source text keeps its exact native baseline/size.
  const width=(s:string,size:number)=>[...s].reduce((n,c)=>n+(/[MW@%]/.test(c)?.9:/[ilI., :/]/.test(c)?.3:.62)*size,0);
  let size=text.size; const maxWidth=Math.max(.2,available);
  if(width(value,size)<=maxWidth && !value.includes('\n')) return {size,lines:[value],x:text.x,y:text.y};
  const maxLines=Math.max(1,Math.min(4,Math.floor(cell.height/(size*1.2))));
  const lines:string[]=[];
  for(const word of value.split(/\s+/)) {
    if(!word)continue;
    let remainder=word;
    if(lines.length && width(lines.at(-1)!+' '+word,size)<=maxWidth) {lines[lines.length-1]+=' '+word;continue;}
    while(remainder) {
      let take=remainder.length;while(take>1 && width(remainder.slice(0,take),size)>maxWidth)take--;
      lines.push(remainder.slice(0,take));remainder=remainder.slice(take);
    }
  }
  if(lines.length>maxLines) {
    size=Math.max(text.size*.65,Math.min(text.size,maxWidth/Math.max(width(value,1),.1)));
    if(width(value,size)<=maxWidth) return {size,lines:[value],x:text.x,y:text.y};
    lines.length=maxLines; let last=lines.at(-1) ?? '';
    while(last.length && width(last+'…',size)>maxWidth)last=last.slice(0,-1);
    lines[lines.length-1]=last+'…';
  }
  return {size,lines,x:text.x,y:Math.min(text.y,Math.max(cell.y+size,text.y-(lines.length-1)*size*1.2))};
}

export function plotFrameSvg(page: Page, project: Project): string {
  const t=project.plotFrameTemplate ?? defaultPlotFrame();
  return `<g id="titleBlock" class="native-plot-frame" color="#8fae65" transform="scale(${page.plotFrame.width/t.width},${page.plotFrame.height/t.height})">${drawingToSvg(t.graphics,{color:'currentColor'})}${t.texts.map(text=>{
    const value=frameTextValue(text,page,project,t); if(!value)return '';
    const cell=frameTextCell(text,t),fit=fitFrameText(value,text,cell),id='frame-clip-'+text.id;
    return `<defs><clipPath id="${id}"><rect x="${cell.x}" y="${cell.y}" width="${cell.width}" height="${cell.height}"/></clipPath></defs><g clip-path="url(#${id})"><text class="frame-text" data-field="${text.property ?? ''}" x="${fit.x}" y="${fit.y}" font-size="${fit.size}" fill="currentColor" font-family="Tahoma,Arial,sans-serif" text-anchor="${text.anchor}">${fit.lines.map((line,i)=>`<tspan x="${fit.x}" dy="${i?fit.size*1.2:0}">${escapeSvg(line)}</tspan>`).join('')}</text></g>`;
  }).join('')}</g>`;
}
