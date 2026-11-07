import {getSymbolById} from './symbols';
import {MacroManager, type WindowMacro} from './MacroManager';
import type {ArticlePackageAssets} from './ArticlePackageAssets';
import { DOMParser } from '@xmldom/xmldom';
import { readProjectArchive } from '../packages/ProjectArchive';
import { validateCatalogArticle, catalogKey } from './CatalogRecord';
import type { CatalogArticle } from './ArticleTypes';
const LIMIT=20*1024*1024;
function xmlDocument(text:string) {
  if(text.length>LIMIT || /<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('manufacturerInvalid');
  let failed=false;
  const doc=new DOMParser({errorHandler:{warning:()=>{failed=true;},error:()=>{failed=true;},fatalError:()=>{failed=true;}}}).parseFromString(text.replace(/^\uFEFF/,''),'text/xml');
  if(failed || !doc.documentElement)throw new Error('manufacturerInvalid');
  return doc;
}
function localized(text:string,language:string) {
  const entries=[...text.matchAll(/(?:^|;)([a-z?]{2}_[a-z?]{2})@([^;]*)/gi)];
  return entries.find(e=>e[1].toLowerCase().startsWith(language.toLowerCase()))?.[2] ?? entries.find(e=>e[1].startsWith('en'))?.[2] ?? entries[0]?.[2] ?? text;
}
/** Structured article data only. Embedded proprietary symbol files are never guessed. */
export async function importArticlePackage(file:File,language='de'):Promise<{articles:CatalogArticle[];embeddedSymbols:number;assets:ArticlePackageAssets[]}> {
  if(file.size>LIMIT)throw new Error('manufacturerInvalid');
  const archive=await readProjectArchive(file), entries=Object.entries(archive.zip.files).filter(([,e])=>!e.dir);
  if(entries.length>10000 || [...archive.sizes.values()].some(n=>n>64*1024*1024) || [...archive.sizes.values()].reduce((a,b)=>a+b,0)>256*1024*1024)throw new Error('manufacturerInvalid');
  const articles:CatalogArticle[]=[];
  let total=0;
  async function text(entry:typeof entries[number][1]) {
    const size=archive.sizes.get(entry.name)??0;if(size>LIMIT || (total+=size)>LIMIT)throw new Error('manufacturerInvalid');
    const bytes=await entry.async('uint8array');if(bytes.byteLength>LIMIT)throw new Error('manufacturerInvalid');
    return new TextDecoder(bytes[0]===255&&bytes[1]===254?'utf-16le':'utf-8').decode(bytes).replace(/^\uFEFF/,'');
  }
  if(file.name.toLowerCase().endsWith('.wspak')) {
    const record=entries.find(([path])=>path.replace(/\\/g,'/').toLowerCase()==='data/part.json');
    if(!record)throw new Error('manufacturerInvalid');
    const data=JSON.parse(await text(record[1]));
    for(const item of Array.isArray(data)?data:[data]) {
      if(!item || typeof item.number!=='string' || typeof item.manufacturerName!=='string')throw new Error('manufacturerInvalid');
      const name=item.translateName??{}, description=item.translateDescription??{};
      const languageValue=(values:Record<string,unknown>)=>values[language==='de'?'De':'En']??values.En??values.De;
      const details=[languageValue(name),languageValue(description),item.typeName,
        ...['orderNumber','voltage','current','actuationVoltage','weight','externalDocuments'].map(k=>item[k]?`${k}: ${item[k]}`:''),
        ...['width','height','length'].map(k=>item.cabinet?.[k]!==undefined?`${k}: ${item.cabinet[k]} mm`:'')].filter(v=>typeof v==='string'&&v);
      articles.push(validateCatalogArticle({articleNumber:item.orderNumber||item.number,manufacturer:item.manufacturerName,variant:'',description:[`Type: ${item.number}`,...details].join('\n'),origin:'user',verification:'unverified'}));
    }
  } else {
    const docs=[];
    for(const [path,entry]of entries)if(/\.xml$/i.test(path))docs.push(xmlDocument(await text(entry)));
    const manufacturers=new Map<string,string>();
    for(const doc of docs)for(const a of Array.from(doc.getElementsByTagName('address'))) {
      const key=a.getAttribute('P_PART_ADDRESS_SHORTNAME'), name=a.getAttribute('P_PART_ADDRESS_LONGNAME')||a.getAttribute('P_PART_ADDRESS_NAME1');
      if(key&&name)manufacturers.set(key,name);
    }
    for(const doc of docs)for(const part of Array.from(doc.getElementsByTagName('part'))) {
      const attr=(key:string)=>part.getAttribute('P_ARTICLE_'+key)??'';
      if(!attr('PARTNR'))continue;
      const variants=Array.from(part.getElementsByTagName('variant'));
      for(const variant of variants.length?variants:[undefined])articles.push(validateCatalogArticle({
        articleNumber:attr('ORDERNR')||attr('PARTNR'),manufacturer:manufacturers.get(attr('MANUFACTURER'))??attr('MANUFACTURER'),
        variant:variant?.getAttribute('P_ARTICLE_VARIANT')??'',origin:'user',verification:'unverified',
        description:[...['DESCR1','DESCR2','DESCR3','NOTE'].map(k=>localized(attr(k),language)),`Source ID: ${attr('PARTNR')}`,
          ...['TYPENR','IDENTCODE','WIDTH','HEIGHT','DEPTH','WEIGHT'].map(k=>attr(k)?`${k}: ${attr(k)}`:'')].filter(Boolean).join('\n')
      }));
    }
  }
  if(!articles.length || articles.length>10000 || new Set(articles.map(catalogKey)).size!==articles.length)throw new Error('manufacturerInvalid');
  const sources:ArticlePackageAssets['sources']=[], macros:WindowMacro[]=[], diagnostics:string[]=[];
  let sourceBytes=0;
  for(const [path,entry]of entries)if(/\.(?:ema|ems|wslib)$/i.test(path)) {
    const data=await entry.async('uint8array');sourceBytes+=data.byteLength;
    if(sourceBytes>64*1024*1024)throw new Error('manufacturerInvalid');
    sources.push({path,data});
    if(/\.wslib$/i.test(path)){diagnostics.push(`${path}: Binäre Symbolbibliothek gesichert; noch nicht als editierbare Geometrie lesbar.`);continue;}
    if(/(?:^|[_/\\-])3d(?:[_/\\.-]|$)/i.test(path)){diagnostics.push(`${path}: 3D-Original gesichert; keine Umwandlung in ein 2D-Schaltzeichen.`);continue;}
    try {
      const parsed=await MacroManager.parseMacroFile(new File([new Uint8Array(data)],path),{allowHeuristic:false,allowMissingDependencies:false});
      const macro=MacroManager.forPlacement(parsed);
      if(!macro.components.length)throw new Error('Keine platzierbaren Elemente');
      const digest=await crypto.subtle.digest('SHA-256',new Uint8Array(data));
      macro.id='article-macro:'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');macro.name=path.split(/[\\/]/).pop()??path;
      macro.category='Artikelpakete';macro.isBuiltIn=false;
      macro.description='Importierte Originalgeometrie aus '+path;
      if(!macro.components.some(c=>(macro.symbolLibrary?.find(s=>s.id===c.symbolId)??getSymbolById(c.symbolId))?.pins.length)) {
        macro.description+=' · Grafik-/Montagemakro ohne elektrische Anschlüsse';
        diagnostics.push(`${path}: Lesbares Grafik-/Montagemakro ohne elektrische Anschlüsse.`);
      }
      diagnostics.push(...(macro.importDiagnostics??[]).map(message=>`${path}: ${message}`));
      if(!macros.some(m=>m.id===macro.id))macros.push(macro);
    }catch(error){diagnostics.push(`${path}: Original gesichert; Makro noch nicht lesbar (${error instanceof Error?error.message:String(error)}).`);}
  }
  return {articles,embeddedSymbols:sources.length,assets:articles.map(a=>({id:a.id,sources,macros,diagnostics}))};
}
