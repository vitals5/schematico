import assert from 'node:assert/strict';
import { createCoverPage, defaultCoverPageTemplate, coverFieldValue, coverPageFields, coverPageSvg, coverPageTextRuns, coverPageLogo } from './CoverPage';
import { Project, Page } from './types';
import { ProjectHistory } from './ProjectHistory';
import { PdfExporter } from '../export/PdfExporter';

const project={id:'test',name:'Haus',description:'Einfamilienhaus',company:'Hersteller',author:'AB',created:'2026-05-14',modified:'2026-09-18',pages:[],activePageId:''} as unknown as Project;
const page=createCoverPage(project);project.pages.push(page);project.activePageId=page.id;
assert.equal(page.pageType,'cover');assert(Math.abs(page.plotFrame.height/page.plotFrame.width-297/420)<1e-12);
const template=defaultCoverPageTemplate();project.coverPageTemplate={...template,properties:{'10100:0':'Customer','10013:0':'PN123','10023:0':'18.09.2026','10300:0':'45'}};
const fields=coverPageFields(page,project);
assert.equal(new Set(fields.map(f=>f.key)).size,fields.length,'Repeated fields are edited once');
assert.equal(fields.find(f=>f.key==='10021:0')!.value,'14.05.2026');
assert.equal(fields.find(f=>f.key==='10300:0')!.value,'1','Source sheet-count cache must not replace the current page count');
const history=new ProjectHistory();history.reset(project);
page.coverPage={values:{'10100:0':'Edited <customer> & Partner','10013:0':'','10015:0':'Other company','10300:0':'999'}};
history.record(project);
const svg=coverPageSvg(page,project);
assert.match(svg,/Edited &lt;customer&gt; &amp; Partner/);assert(!svg.includes('Customer'));
assert.equal(coverPageTextRuns(page,project).filter(t=>t.value==='Other company').length,2,'Company header and manufacturer share their binding');
assert.equal(coverPageFields(page,project).find(f=>f.key==='10300:0')!.value,'1');
assert.equal(coverPageFields(page,project).find(f=>f.key==='10013:0')!.value,'');
assert.equal(coverPageSvg({...page,pageType:'schematic'},project),'');
const restored=history.undo()!;assert.equal(coverPageFields(restored.pages[0],restored).find(f=>f.key==='10100:0')!.value,'Customer');
assert.equal(coverPageLogo(page,project),undefined);
project.coverPageTemplate.images=[{id:'logo',dataUrl:'data:image/png;base64,AAAA',x:64,y:24,width:29,height:40}];
assert.equal(coverPageLogo(page,project)?.id,'logo');
page.coverPage.logo=null;assert.equal(coverPageLogo(page,project),undefined);
delete page.coverPage.logo;
assert.match(coverPageSvg(page,project),/class="cover-logo"/);
const roundtrip=JSON.parse(JSON.stringify(project));
assert.equal(coverPageSvg(roundtrip.pages[0],roundtrip),coverPageSvg(page,project),'Data and shared resources survive project JSON');
delete project.coverPageTemplate.images;
const next=createCoverPage(project);assert.equal(next.pageNumber,'2');assert.equal(project.pages.length,1,'Factory does not edit the project');
project.pages.push(next);assert.equal(coverPageFields(page,project).find(f=>f.key==='10300:0')!.value,'2');
page.coverPage.values!['10011:0']='Very long description with word wrapping and <escaped> characters '.repeat(40);
for(const {fit,cell} of coverPageTextRuns(page,project)){
  assert(fit.y-fit.size>=cell.y-1e-7);
  assert(fit.y+(fit.lines.length-1)*fit.size*1.2<=cell.y+cell.height+1e-7,'Text stays inside its row');
}
const pdf=await PdfExporter.exportToPdf(project,{paperFormat:'a3',colorMode:'color',pageRange:'current',currentPageId:page.id,
  interactiveCrossReferences:false,includeBookmarks:false,includeTerminalDiagram:false,includePartsList:false,plotFrame:true});
const bytes=await pdf.arrayBuffer();assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'%PDF');
const printed:string[]=[];
const mock:any={text:(value:string)=>printed.push(value)};
for(const name of ['setDrawColor','setTextColor','setLineWidth','setLineDashPattern','setFillColor','line','rect','path','fillStroke','stroke','saveGraphicsState','clip','discardPath','setFont','setFontSize','restoreGraphicsState'])mock[name]=()=>{};
(PdfExporter as any).renderCoverPage(mock,page,project,420,297,'color');
assert.equal(printed.filter(value=>value==='Other company').length,2,'Editable cover values are exported as vector text');
console.log('✓ Cover creation, source bindings, empty overrides, live page count, logo override, bounded text, undo and JSON/PDF');
