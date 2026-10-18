import { FrameText, PlotFrameTemplate, fitFrameText } from './PlotFrame';
import { drawingToSvg, escapeSvg } from './ImportedDrawing';
import { Page, PageImage, Project } from './types';
import { isBundledSupplierLogo } from './PresentationNaming';

export type CoverPageTemplate = PlotFrameTemplate & { images?: PageImage[] };
export type CoverPageData = { values?: Record<string,string>; logo?: PageImage | null };
const labels: Record<number,string> = {
  10000:'Projektname',10011:'Projektbeschreibung',10013:'Projektnummer',10014:'Kommission',10015:'Hersteller / Firma',
  10021:'Erstellt am',10022:'Bearbeiter (Kürzel)',10023:'Bearbeitet am',10025:'Projektverantwortlicher',10030:'Fabrikat',
  10031:'Typ',10032:'Installationsort',10033:'Teilebesonderheit',10100:'Firma / Kunde',10300:'Anzahl der Seiten',
  10901:'Pfad',11015:'Formular',10235:'Anschrift',10237:'Postleitzahl',10238:'Ort',10240:'Telefon'
};
export const coverFieldKey = (text:FrameText) => `${text.property}:${text.index ?? 0}`;

/** F26 layout in physical millimetres; values remain project/page data. */
export function defaultCoverPageTemplate():CoverPageTemplate {
  const color='currentColor',graphics:CoverPageTemplate['graphics']=[];
  const fill=(x:number,y:number,width:number,height:number)=>graphics.push({kind:'polygon',points:[{x,y},{x:x+width,y},{x:x+width,y:y+height},{x,y:y+height}],color,fill:color,width:0});
  for(const y of [19.5,67.5,263.5])fill(8,y,404,3);
  fill(408,101,2,142);fill(20,241,390,2);
  graphics.push({kind:'rect',x:12,y:93,width:396,height:148,color,lineWidth:.25});
  for(const y of [141,217])graphics.push({kind:'line',x1:12,y1:y,x2:408,y2:y,color,width:.25});
  const texts:FrameText[]=[];
  const add=(id:string,x:number,y:number,text?:string,property?:number,size=3.5*1.242,anchor:FrameText['anchor']='start',index?:number)=>texts.push({id,x,y,size,anchor,...(text!==undefined?{text}:{}),...(property!==undefined?{property}:{}),...(index!==undefined?{index}:{})});
  add('form',408,17,undefined,11015,2.5*1.242,'end');add('company',116,33,undefined,10015,5*1.242);
  for(const [property,y] of [[10235,49.5],[10237,56],[10238,56],[10240,62.5]])add(`header-${property}`,property===10238?138:property===10240?133.5:116,y,undefined,property);
  add('telephone-label',116,62.5,'Tel.');
  for(const [property,y] of [[10100,105],[10011,115],[10013,125],[10014,135]]){
    add(`label-${property}`,20,y,labels[property],undefined,5*1.242);add(`field-${property}`,116,y,undefined,property,5*1.242);
  }
  for(const [property,y] of [[10015,149],[10901,165],[10000,173],[10030,181],[10031,189],[10032,197],[10025,205],[10033,213]]){
    add(`label-${property}`,20,y,labels[property]);add(`field-${property}`,116,y,undefined,property,3.5*1.242,'start',property===10901?1:undefined);
  }
  add('created-label',20,226.727,'Erstellt am');add('created',76,226.727,undefined,10021);
  add('modified-label',20,234.727,'Bearbeitet am');add('modified',76,234.727,undefined,10023);
  add('author-label',140.6,234.727,'von (Kürzel)');add('author',168,234.727,undefined,10022);
  add('count-label',350.5,234.727,'Anzahl der Seiten');add('count',400,234.727,undefined,10300,3.5*1.242,'end');
  return {id:'default-f26',name:'F26_001',width:420,height:297,graphics,texts};
}
export const coverPageTemplate = (project:Project) => project.coverPageTemplate ?? defaultCoverPageTemplate();
const dateText = (value:string) => /^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10).split('-').reverse().join('.'):value;
export function coverFieldValue(text:FrameText,page:Page,project:Project,template=coverPageTemplate(project)):string {
  if(text.text!==undefined)return text.text;
  const key=coverFieldKey(text);
  if(text.property===10300)return String(project.pages.length);
  if(text.property===11015)return template.name;
  if(page.coverPage?.values && Object.hasOwn(page.coverPage.values,key))return page.coverPage.values[key];
  const live:Record<number,string>={10000:project.name,10011:project.description,10015:project.company};
  if(text.property!==undefined && live[text.property]!==undefined)return live[text.property];
  const source=template.properties?.[key] ?? template.properties?.[String(text.property)];
  if(source!==undefined)return source;
  const defaults:Record<number,string>={10021:dateText(project.created ?? ''),10023:dateText(project.modified ?? ''),10022:project.author};
  return defaults[text.property ?? 0] ?? '';
}
export function coverPageFields(page:Page,project:Project) {
  const t=coverPageTemplate(project),seen=new Set<string>();
  return t.texts.filter(text=>text.property!==undefined).filter(text=>{const key=coverFieldKey(text);if(seen.has(key))return false;seen.add(key);return true;})
    .map(text=>({key:coverFieldKey(text),label:labels[text.property!] ?? `Formularfeld ${text.property}`,value:coverFieldValue(text,page,project,t),readOnly:[10300,11015].includes(text.property!)}));
}
/** Bound each caption/value to its own row and next horizontal field. */
export function coverTextCell(text:FrameText,template:CoverPageTemplate) {
  const neighbors=template.texts.filter(t=>t.id!==text.id && Math.abs(t.y-text.y)<Math.max(.5,text.size*.3));
  const right=Math.min(template.width-8,...neighbors.filter(t=>t.x>text.x+.2).map(t=>t.x-2));
  const left=Math.max(8,...neighbors.filter(t=>t.x<text.x-.2).map(t=>t.x+2));
  const rows=template.texts.filter(t=>t.y>text.y+.5).map(t=>t.y-text.y);
  const spacing=Math.min(12,...rows);
  const height=Math.max(text.size*1.2,spacing-.5);
  return {x:text.anchor==='end'?left:text.anchor==='middle'?Math.max(left,text.x-(right-text.x)):text.x,
    y:text.y-text.size,width:Math.max(.2,text.anchor==='end'?text.x-left:right-(text.anchor==='middle'?Math.max(left,text.x-(right-text.x)):text.x)),height};
}
export function coverPageTextRuns(page:Page,project:Project) {
  const template=coverPageTemplate(project);
  return template.texts.map(text=>{const value=coverFieldValue(text,page,project,template),cell=coverTextCell(text,template);
    return {text,value,cell,fit:fitFrameText(value,text,cell)};});
}
export function coverPageLogo(page:Page,project:Project):PageImage|undefined {
  const logo=page.coverPage?.logo===null?undefined:page.coverPage?.logo ?? coverPageTemplate(project).images?.[0];
  return logo && !isBundledSupplierLogo(logo)?logo:undefined;
}
export function coverPageSvg(page:Page,project:Project):string {
  if(page.pageType!=='cover')return '';
  const t=coverPageTemplate(project),logo=coverPageLogo(page,project);
  const texts=coverPageTextRuns(page,project).map(({text,value,cell,fit})=>{
    if(!value)return '';
    const id=`cover-clip-${text.id}`;
    return `<defs><clipPath id="${escapeSvg(id)}"><rect x="${cell.x}" y="${cell.y}" width="${cell.width}" height="${cell.height}"/></clipPath></defs><g clip-path="url(#${escapeSvg(id)})"><text class="cover-text" data-cover-field="${text.property===undefined?'':coverFieldKey(text)}" x="${fit.x}" y="${fit.y}" font-size="${fit.size}" fill="currentColor" font-family="Tahoma,Arial,sans-serif" text-anchor="${text.anchor}"><title>${escapeSvg(value)}</title>${fit.lines.map((line,i)=>`<tspan x="${fit.x}" dy="${i?fit.size*1.2:0}">${escapeSvg(line)}</tspan>`).join('')}</text></g>`;
  }).join('');
  return `<g id="coverPageLayer" class="native-cover-page" color="#8fae65" transform="scale(${page.plotFrame.width/t.width},${page.plotFrame.height/t.height})">${drawingToSvg(t.graphics,{color:'currentColor'})}${logo?`<image class="cover-logo" href="${escapeSvg(logo.dataUrl)}" x="${logo.x}" y="${logo.y}" width="${logo.width}" height="${logo.height}" preserveAspectRatio="xMidYMid meet"/>`:''}${texts}</g>`;
}
export function createCoverPage(project:Project):Page {
  const existing=project.pages.filter(p=>p.pageType==='cover'),first=project.pages[0],t=coverPageTemplate(project);
  const higherLevel=existing[0]?.higherLevel ?? '=CA1',location=existing[0]?.location ?? '+EAA';
  let number=1;while(project.pages.some(p=>p.higherLevel===higherLevel&&p.location===location&&p.pageNumber===String(number)))number++;
  return {id:'cover_'+crypto.randomUUID(),pageNumber:String(number),pageType:'cover',title:'Titelblatt',higherLevel,location,
    components:[],wires:[],coverPage:{values:{}},plotFrame:{type:'DIN_A3_LANDSCAPE',width:first?.plotFrame.width ?? 1000,
      height:(first?.plotFrame.width ?? 1000)*t.height/t.width,columns:10,rows:['A','B','C','D','E','F'],titleBlock:{
        projectTitle:project.name,commission:'',company:project.company,author:project.author,date:dateText(project.created ?? ''),revision:'',sheetNumber:String(number),totalSheets:String(project.pages.length+1)}}};
}
