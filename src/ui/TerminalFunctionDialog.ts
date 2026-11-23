import type {ComponentAddress} from '../model/ArticleTypes';
import type {Project} from '../model/types';
import {TerminalDistributionPlan,type TerminalDistributionEdit} from '../model/TerminalDistribution';
import {TerminalStripEditPlan,type TerminalStripEdit} from '../model/TerminalStrips';
import {ProjectIndex} from '../model/ProjectIndex';
import {terminalLevelValues} from '../model/TerminalFunctions';
import {terminalSettings} from '../model/WiringManagement';
import {terminalAddressKey} from '../model/TerminalStripTypes';
import {getSymbolForComponent} from '../model/symbols';
import {componentInsertionPoint,symbolInsertionPoint} from '../model/SymbolGeometry';
import {PartsListGenerator} from '../reports/PartsList';
import {drawingToSvg,escapeSvg as esc} from '../model/ImportedDrawing';
import {articleError} from './ArticleCatalogDialog';
import {bindArticleModalKeys,focusArticleModal} from './ArticleModal';
import {tr,t,getLocalizedSymbol} from '../i18n';

/** Read-only source + checked transaction preview, shared by properties and the
 * terminal workbench. Electrical grouping is separate from graphic grouping. */
export class TerminalFunctionDialog {
 private el=document.createElement('div');private source:Project;
 private pending?:TerminalDistributionPlan|TerminalStripEditPlan;private error='';
 constructor(private getProject:()=>Project,private onApply:(p:Project)=>void,private target:ComponentAddress,
   private navigate?:(a:ComponentAddress)=>void,private openWorkbench?:(a:ComponentAddress)=>void,private onClose?:()=>void){this.source=structuredClone(getProject());}
 show(){if(document.getElementById('terminalFunctionDialog'))return;this.el.id='terminalFunctionDialog';this.el.className='modal-backdrop';
   this.el.style.cssText='position:fixed;inset:0;z-index:4300;background:#0009;display:flex;align-items:center;justify-content:center;padding:12px';
   document.body.append(this.el);bindArticleModalKeys(this.el,()=>this.close());this.render();}
 private close(){this.el.remove();this.onClose?.();}
 private prepare(edit:TerminalDistributionEdit|TerminalStripEdit){try{
   this.pending=edit.kind==='split'||edit.kind==='move'&&'target'in edit?new TerminalDistributionPlan(this.source,edit as TerminalDistributionEdit):new TerminalStripEditPlan(this.source,edit as TerminalStripEdit);
   this.error='';this.render();
 }catch(e){this.pending=undefined;this.error=articleError(e);this.render();}}
 private render(){
  const p=this.pending?.preview()??this.source,index=new ProjectIndex(p);
  const address=this.pending instanceof TerminalDistributionPlan&&this.pending.edit.kind==='move'?this.pending.members[0]:this.target;
  const e=index.component(address.componentId,address.pageId),symbol=e?.symbol;
  if(!e||!symbol){this.error=t('terminalStripMemberMissing');this.el.innerHTML=`<section role="dialog" style="background:var(--bg-panel,#17202d);padding:20px"><p role="alert">${esc(this.error)}</p><button class="btn" data-close>${t('close')}</button></section>`;this.el.querySelector('[data-close]')?.addEventListener('click',()=>this.close());return;}
  const scale=e.component.scale??1,anchor=symbolInsertionPoint(symbol),scaled={...symbol,width:symbol.width*scale,height:symbol.height*scale,insertionPoint:{x:anchor.x*scale,y:anchor.y*scale}};
  const settings=terminalSettings(e.component),levels=terminalLevelValues(e.component,symbol),owner=index.devices.forComponent(address),
    strip=owner?.terminalPositionId?p.terminalStrips?.find(s=>s.positions.some(pos=>pos.id===owner.terminalPositionId)):undefined,
    position=strip?.positions.find(pos=>pos.id===owner?.terminalPositionId),
    members=owner?.members??[address],freeze=!!this.pending,ready=!!settings.strip.trim()&&!!settings.number.trim(),
    point=componentInsertionPoint(e.component,scaled),before=this.pending?PartsListGenerator.generatePartsList(this.source):[],after=this.pending?PartsListGenerator.generatePartsList(p):[];
  const bomKey=(a:typeof before[number])=>JSON.stringify([a.manufacturer,a.articleNumber,a.variant]);
  const beforeMap=new Map(before.map(a=>[bomKey(a),a])),afterMap=new Map(after.map(a=>[bomKey(a),a]));
  const currentArticle=(index.devices.owner(address)?.component??e.component).articleNumber;
  const bomKeys=[...new Set([...beforeMap.keys(),...afterMap.keys()])].filter(key=>{const a=beforeMap.get(key),b=afterMap.get(key);return a?.quantity!==b?.quantity||a?.articleNumber===currentArticle||b?.articleNumber===currentArticle;}).slice(0,64);
  const disabled=(condition=false)=>freeze||condition?'disabled':'';
  const list=members.flatMap(a=>{const member=index.component(a.componentId,a.pageId);return member?[{a,e:member}]:[];});
  const sorted=[...list].sort((a,b)=>new Intl.Collator('en',{numeric:true}).compare(a.e.component.terminal?.level??'',b.e.component.terminal?.level??'')),low=sorted[0]?.e.component.terminal?.level,high=sorted.at(-1)?.e.component.terminal?.level;
  const mainOptions=list.filter(row=>row.e.component.terminal?.level===low||row.e.component.terminal?.level===high);
  this.el.innerHTML=`<section role="dialog" aria-modal="true" aria-label="${tr('Klemmenfunktionen verwalten','Manage terminal functions')}" style="width:min(1000px,100%);max-height:94vh;overflow:auto;background:var(--bg-panel,#17202d);color:var(--text-primary,#eee);padding:20px;border:1px solid #526170;border-radius:8px">
   <header style="display:flex;justify-content:space-between;gap:16px"><div><h2>${tr('Klemmenfunktionen verwalten','Manage terminal functions')} · ${esc(e.component.bmk)}</h2><p>${esc(getLocalizedSymbol(symbol).name)}</p></div><button class="btn" data-close>${t('close')}</button></header>
   <p>${tr('Eine physische Klemme kann mehrere getrennt platzierte Funktionen besitzen. Die Gerätezuordnung verbindet keine unterschiedlichen Etagen elektrisch.','One physical terminal can have separately placed functions. Device ownership does not electrically connect different levels.')}</p>
   <div role="alert" style="color:#fca5a5">${esc(this.error)}</div>
   ${owner?`<section style="border:1px solid #526170;padding:12px;margin:12px 0"><strong>${terminalAddressKey(owner.main)===terminalAddressKey(address)?tr('Hauptklemme','Main terminal'):tr('Nebenklemme / Teilklemme','Secondary / partial terminal')}</strong> · ${tr('Geräteposition','Device position')} ${strip&&position?strip.positions.indexOf(position)+1:'—'} · ${members.length} ${tr('Platzierungen','placements')}
     <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px"><label>${tr('Hauptklemme','Main terminal')} <select class="form-input" data-main-target ${disabled()}>${mainOptions.map(row=>`<option value="${esc(JSON.stringify(row.a))}" ${terminalAddressKey(row.a)===terminalAddressKey(owner.main)?'selected':''}>${esc(row.e.component.bmk)} · ${tr('Etage','Level')} ${esc(row.e.component.terminal?.level||'0')} · ${t('page')} ${esc(row.e.page.pageNumber)} · ${esc(row.e.symbol?.pins.map(p=>p.name).join(', ')??'')}</option>`).join('')}</select></label><button class="btn" data-main ${disabled(members.length<2||!strip||!position)}>${tr('Hauptklemme festlegen','Set main terminal')}</button></div></section>`:''}
   <section style="border:1px solid #526170;padding:12px;margin:12px 0"><h3>${tr('Darstellung aufteilen','Split representation')}</h3>
    ${!ready?`<p>${t('terminalDistributionNumberRequired')}</p>`:''}
    <p>${tr('Vorhandene Anschlusspunkte und Netze bleiben erhalten. Die Vorschau verändert das Projekt noch nicht.','Existing pin positions and nets are preserved. The preview does not change the project.')}</p>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label>${tr('Hauptetage','Main level')} <select class="form-input" data-split-main ${disabled()}>
     ${levels.filter((_,i)=>i===0||i===levels.length-1).map(level=>`<option value="${esc(level.id)}" ${level.id===symbol.terminalDefinition?.mainLevel?'selected':''}>${esc(level.designation)}</option>`).join('')}</select></label>
     <button class="btn" data-split-levels ${disabled(!ready||!!owner||levels.length<2)}>${tr('Etagen getrennt platzieren','Place levels separately')}</button>
     <button class="btn" data-split-parts ${disabled(!ready||!!owner||levels.length!==1||symbol.pins.length<2||!['feed_through','pe'].includes(symbol.terminalDefinition?.kind??''))}>${tr('Teilklemmen erstellen','Create partial terminals')}</button></div>
   </section>
   <section style="border:1px solid #526170;padding:12px;margin:12px 0"><h3>${tr('Platzierung auf ein Blatt verschieben','Move placement to a sheet')}</h3><p>${t('terminalDistributionConnected')}</p>
    <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap"><label>${t('page')}<select class="form-input" data-target-page ${disabled()}>${p.pages.filter(page=>page.pageType==='schematic').map(page=>`<option value="${esc(page.id)}" ${page.id===e.page.id?'selected':''}>${esc(page.pageNumber+' · '+page.title)}</option>`).join('')}</select></label>
     <label>X<input class="form-input" type="number" step="any" data-target-x value="${point.x}" ${disabled()}></label><label>Y<input class="form-input" type="number" step="any" data-target-y value="${point.y}" ${disabled()}></label><button class="btn" data-move ${disabled(!e.component.terminal)}>${tr('Verschieben – Vorschau','Move – preview')}</button></div>
   </section>
   <h3>${tr('Zugeordnete Funktionen','Assigned functions')}</h3><div style="display:flex;gap:10px;flex-wrap:wrap">${list.map(row=>`<article style="border:1px solid #526170;padding:10px;max-width:220px"><strong>${esc(row.e.component.bmk)}</strong><p>${tr('Etage','Level')} ${esc(row.e.component.terminal?.level??'—')} · ${esc(row.e.component.terminal?.levelDesignation??'')}</p><small>${owner&&terminalAddressKey(row.a)===terminalAddressKey(owner.main)?tr('Hauptklemme · Artikelträger','Main terminal · article owner'):owner?tr('Nebenfunktion','Secondary function'):tr('Eigenständige Funktion','Standalone function')}</small><p>${t('page')} ${esc(row.e.page.pageNumber)}</p><svg width="110" height="90" viewBox="-8 -8 ${(row.e.symbol?.width??20)+16} ${(row.e.symbol?.height??20)+16}" style="color:var(--text-primary,#eee)">${row.e.symbol?.importedGraphics?drawingToSvg(row.e.symbol.importedGraphics):row.e.symbol?.svgContent??''}</svg><p><button class="btn" data-navigate="${esc(JSON.stringify(row.a))}" ${disabled(!this.navigate)}>${tr('Im Schaltplan anzeigen','Show in schematic')}</button></p></article>`).join('')}</div>
   ${freeze?`<section data-preview style="border:1px solid #63b3ed;padding:12px;margin:12px 0"><h3>${t('articlesPreview')}</h3><p>${tr('Geprüfte Zuordnung. Artikelmengen vor / nach der Änderung:','Validated assignment. Article quantities before / after the change:')}</p><table><thead><tr><th>${tr('Artikel','Article')}</th><th>${tr('Vorher','Before')}</th><th>${tr('Nachher','After')}</th></tr></thead><tbody>${bomKeys.map(key=>{const a=beforeMap.get(key),b=afterMap.get(key);return `<tr><td>${esc((b??a)!.articleNumber+' · '+(b??a)!.manufacturer)}</td><td>${a?.quantity??'—'}</td><td>${b?.quantity??'—'}</td></tr>`;}).join('')}</tbody></table></section>`:''}
   <footer style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn" data-workbench ${disabled(!this.openWorkbench)}>${tr('Klemmenleiste bearbeiten','Edit terminal strip')}</button><button class="btn" data-discard ${this.pending?'':'disabled'}>${tr('Verwerfen','Discard')}</button><button class="btn btn-primary" data-apply ${this.pending?'':'disabled'}>${t('articlesApply')}</button></footer>
  </section>`;
  const q=<T extends HTMLElement=HTMLElement>(selector:string)=>this.el.querySelector<T>(selector)!;
  q('[data-close]').onclick=()=>this.close();q('[data-workbench]').onclick=()=>{this.close();this.openWorkbench?.(this.target);};
  q('[data-split-levels]').onclick=()=>this.prepare({kind:'split',target:this.target,mode:'levels',mainLevel:q<HTMLSelectElement>('[data-split-main]').value});
  q('[data-split-parts]').onclick=()=>this.prepare({kind:'split',target:this.target,mode:'parts'});
  q('[data-move]').onclick=()=>this.prepare({kind:'move',target:this.target,pageId:q<HTMLSelectElement>('[data-target-page]').value,x:Number(q<HTMLInputElement>('[data-target-x]').value),y:Number(q<HTMLInputElement>('[data-target-y]').value)});
  q('[data-main]')?.addEventListener('click',()=>{if(strip&&position)this.prepare({kind:'main',stripId:strip.id,positionId:position.id,target:JSON.parse(q<HTMLSelectElement>('[data-main-target]').value)});});
  q('[data-discard]').onclick=()=>{this.pending=undefined;this.render();};
  q('[data-apply]').onclick=()=>{if(!this.pending)return;try{const next=this.pending.apply(this.getProject());if(this.pending instanceof TerminalDistributionPlan&&this.pending.edit.kind==='move')this.target=this.pending.members[0];this.onApply(next);this.source=structuredClone(this.getProject());this.pending=undefined;this.error='';this.render();}catch(e){this.error=articleError(e);this.render();}};
  for(const b of this.el.querySelectorAll<HTMLButtonElement>('[data-navigate]'))b.onclick=()=>{const a=JSON.parse(b.dataset.navigate!);this.close();this.navigate?.(a);};
  focusArticleModal(this.el);
 }
}
