import {cadBounds,cadGeometry,readCadDxf,createCadSymbol,attachCadSymbol,MAX_CAD_BYTES,type CadDocument,type CadGeometry,type CadPin} from '../model/CadSymbolImport';
import type {SymbolDefinition} from '../model/types';
import type {CatalogArticle} from '../model/ArticleTypes';
import type {ArticlePackageAssets} from '../model/ArticlePackageAssets';
import {drawingToSvg,escapeSvg as esc} from '../model/ImportedDrawing';
import {openCadConverter} from './CadConverter';
import {bindArticleModalKeys,focusArticleModal} from './ArticleModal';
import {t,getCategoryLabel,type TranslationKey} from '../i18n';

type Row=CadPin&{enabled:boolean};
export class CadArticleSymbolDialog {
  private el=document.createElement('div');
  private restore=document.activeElement as HTMLElement|null;
  private abort=new AbortController();
  private doc?:CadDocument;
  private geometry?:CadGeometry;
  private dxf?:File;
  private original?:File;
  private block='';
  private unit=1;
  private unitConfirmed=false;
  private rows:Row[]=[];
  private name='';
  private prefix='U';
  private category:SymbolDefinition['category']='structure';
  private grid=8;
  private scaleMultiplier=1;
  private bmkText='';
  private confirmed=false;
  private noPins=false;
  private partial=true;
  private busy=false;
  private error='';
  private previewId=0;
  constructor(private article:CatalogArticle,private existing:ArticlePackageAssets|undefined,private onApply:(result:ReturnType<typeof attachCadSymbol>)=>void){}
  show(){
    this.el.className='modal-backdrop';this.el.id='cadArticleSymbolDialog';this.el.style.cssText='position:fixed;inset:0;z-index:4900;background:#000b;display:flex;align-items:center;justify-content:center;padding:12px';document.body.append(this.el);bindArticleModalKeys(this.el,()=>this.close());this.render();
    const existingDxf = this.existing?.sources?.find(s => s.path.toLowerCase().endsWith('.dxf'));
    if (existingDxf) {
      this.busy = true;
      this.render();
      void this.load(new File([existingDxf.data as unknown as BlobPart], existingDxf.path.split('/').pop()!))
        .catch(e => { this.error = this.message(e); })
        .finally(() => { this.busy = false; if (!this.abort.signal.aborted) this.render(); });
    }
  }
  private close(){this.abort.abort();this.previewId++;this.el.remove();if(this.restore?.isConnected)this.restore.focus();}
  private message(error:unknown){const key=error instanceof Error?error.message:String(error);return key.startsWith('cadUnsupported:')?t('cadUnsupported')+key.slice(15):t(key as TranslationKey);}
  private async load(dxf:File,original?:File){
    if(dxf.size>MAX_CAD_BYTES||original&&original.size>MAX_CAD_BYTES)throw new Error('cadTooLarge');
    const text=await dxf.text();if(this.abort.signal.aborted)return;
    this.doc=readCadDxf(text,dxf.name);this.dxf=dxf;this.original=original;
    this.name=dxf.name.replace(/\.dxf$/i,'');this.unit=this.doc.mmPerUnit??1;this.unitConfirmed=Boolean(this.doc.mmPerUnit);
    const candidateBlock = this.doc.blocks.find(b => b.id && b.name.toLowerCase().includes(this.name.toLowerCase()))
      ?? (this.doc.blocks.length === 2 ? this.doc.blocks[1] : this.doc.blocks.find(b => b.id && !b.name.startsWith('img_')));
    this.block = candidateBlock?.id ?? '';this.resetGeometry();this.render();
  }
  private resetGeometry(){
    this.geometry=undefined;this.rows=[];
    this.geometry=cadGeometry(this.doc!,this.block,this.unit);
    const existingPins = this.existing?.macros?.flatMap(m => m.symbolLibrary ?? []).find(s => s.id === this.article.symbolId)?.pins
      ?? this.article.symbol?.pins;
    const existingSymbol = this.existing?.macros?.flatMap(m => m.symbolLibrary ?? []).find(s => s.id === this.article.symbolId)
      ?? this.article.symbol;
    if (existingSymbol) {
      if (existingSymbol.name) this.name = existingSymbol.name;
      if (existingSymbol.category) this.category = existingSymbol.category;
      if (existingSymbol.defaultBmkPrefix) this.prefix = existingSymbol.defaultBmkPrefix.replace(/^-/, '');
      this.grid = 0;
    }
    const matchedExisting = new Set<unknown>();
    this.rows=this.geometry.candidates.map(p=>{
      const match = existingPins?.find(ep => !matchedExisting.has(ep) && ep.name.trim() && (ep.name.trim() === p.name.trim() || (Math.abs(ep.x - p.x) < 2 && Math.abs(ep.y - p.y) < 2)));
      if (match) {
        matchedExisting.add(match);
        return {...p, direction: match.direction ?? p.direction, name: match.name, enabled: true};
      }
      return {...p, enabled: false};
    });
    const bmk = this.geometry.texts.find(p=>/^-[A-Za-z]+$/.test(p.text))
      ?? this.geometry.texts.find(p=>/^-[A-Za-z]+\d*$/.test(p.text));
    this.bmkText=bmk?.id??'';
    if (!existingSymbol) {
      this.prefix=bmk?.text.replace(/^-|\d+$/g,'')??'U';
      this.category=this.prefix==='F'?'protection':this.prefix==='K'||this.prefix==='Q'?'relays':'structure';
    }
    this.confirmed=Boolean(existingPins?.length);this.noPins=false;this.partial=true;
  }
  private selected(){
    const seen=new Set<string>();
    return this.rows.filter(r=>r.enabled).map(({enabled,...p})=>{
      if(p.textId&&seen.has(p.textId))return {...p,textId:undefined};
      if(p.textId)seen.add(p.textId);
      return p;
    });
  }
  private options(){return {name:this.name,prefix:this.prefix,category:this.category,gridMm:this.grid||undefined,scaleMultiplier:this.scaleMultiplier,bmkTextId:this.bmkText||undefined,pins:this.selected(),confirmed:true};}
  private read(){
    const value=(key:string)=>this.el.querySelector<HTMLInputElement|HTMLSelectElement>('[data-'+key+']')?.value;
    this.name=value('name')??this.name;this.prefix=value('prefix')??this.prefix;this.grid=Number(value('grid')??this.grid);this.scaleMultiplier=Number(value('scale-multiplier')??this.scaleMultiplier)||1;this.bmkText=value('bmk')??this.bmkText;this.category=(value('category')??this.category) as SymbolDefinition['category'];
    this.confirmed=this.el.querySelector<HTMLInputElement>('[data-confirm]')?.checked??false;this.noPins=this.el.querySelector<HTMLInputElement>('[data-no-pins]')?.checked??false;this.partial=this.el.querySelector<HTMLInputElement>('[data-partial]')?.checked??false;
    for(const input of this.el.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-row]')){
      const row=this.rows[Number(input.dataset.row)],key=input.dataset.key!;
      if(key==='enabled')row.enabled=(input as HTMLInputElement).checked;
      else if(key==='x'||key==='y')row[key]=Number(input.value);
      else if(key==='name')row.name=input.value;
      else if(key==='direction')row.direction=input.value as Row['direction'];
      else if(key==='textId')row.textId=input.value||undefined;
    }
  }
  private async updatePreview(){
    if(!this.geometry)return;this.read();const id=++this.previewId,preview=this.el.querySelector('[data-preview]')!,note=this.el.querySelector('[data-preview-note]')!;
    try{
      let symbol: SymbolDefinition;
      let gridNotice = '';
      try {
        const res = await createCadSymbol(this.article,this.geometry,this.options());
        symbol = res.symbol;
      } catch (err) {
        if ((err as Error).message === 'cadGridInvalid') {
          gridNotice = ' (' + t('cadGridInvalid') + ')';
          const fallback = await createCadSymbol(this.article,this.geometry,{...this.options(),gridMm:undefined});
          symbol = fallback.symbol;
        } else {
          throw err;
        }
      }
      if(id!==this.previewId)return;
      const graphics=symbol.importedGraphics!,bounds=cadBounds(graphics),margin=6;
      preview.innerHTML=`<svg data-cad-svg viewBox="${bounds.minX-margin} ${bounds.minY-margin} ${bounds.maxX-bounds.minX+margin*2} ${bounds.maxY-bounds.minY+margin*2}" style="width:100%;height:290px;background:#101722;color:#e5e7eb">${drawingToSvg(graphics)}${symbol.pins.map(p=>`<circle cx="${p.x}" cy="${p.y}" r=".55" fill="#38bdf8"/><text x="${p.x+1}" y="${p.y-.8}" fill="#38bdf8" font-size="2">${esc(p.name)}</text>`).join('')}</svg>`;
      note.textContent=`${(symbol.width/2).toFixed(2)} × ${(symbol.height/2).toFixed(2)} mm · ${symbol.pins.length} ${t('cadPins')}${gridNotice}`;
      (note as HTMLElement).style.color = gridNotice ? '#f59e0b' : '';
    }catch(e){if(id===this.previewId){note.textContent=this.message(e);(note as HTMLElement).style.color='#fca5a5';preview.innerHTML='';}}
  }
  private render(){
    const g=this.geometry;
    this.el.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="cadTitle" style="width:min(1120px,100%);max-height:94vh;overflow:auto;padding:22px;background:#17202d;color:#eee;border:1px solid #526170;border-radius:10px"><h2 id="cadTitle">${t('cadTitle')}</h2><p><strong>${esc(this.article.manufacturer+' · '+this.article.articleNumber)}</strong></p><p>${t('cadHint')}</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" data-dwg ${this.busy?'disabled':''}>${t('cadChooseDwg')}</button><button class="btn" data-dxf ${this.busy?'disabled':''}>${t('cadChooseDxf')}</button><input type="file" data-file accept=".dxf" hidden></div><p role="alert" style="color:#fca5a5;white-space:pre-wrap">${esc(this.error)}</p>${this.busy?`<p role="status">${t('cadWaiting')}</p>`:''}
    ${this.doc?`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:18px"><div><label>${t('cadName')}<input class="form-input" data-name value="${esc(this.name)}"></label><label>${t('cadBlock')}<select class="form-input" data-block>${this.doc!.blocks.map(b=>`<option value="${esc(b.id)}" ${this.block===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label><label>${t('cadUnit')}<select class="form-input" data-unit>${!this.unitConfirmed?`<option value="" selected>${t('cadUnitRequired')}</option>`:''}${[[.001,'µm'],[1,'mm'],[10,'cm'],[1000,'m'],[25.4,'in'],[304.8,'ft']].map(([n,s])=>`<option value="${n}" ${this.unitConfirmed&&this.unit===n?'selected':''}>${s}</option>`).join('')}${this.unitConfirmed&&![.001,1,10,1000,25.4,304.8].includes(this.unit)?`<option selected value="${this.unit}">${esc(this.doc!.units)}</option>`:''}</select></label><label>${t('cadCategory')}<select class="form-input" data-category>${(['supply','protection','relays','controls','terminals','motors','sensors','automation','installation','structure'] as const).map(c=>`<option value="${c}" ${c===this.category?'selected':''}>${esc(getCategoryLabel(c))}</option>`).join('')}</select></label><label>${t('cadPrefix')}<input class="form-input" data-prefix value="${esc(this.prefix)}"></label><label>${t('cadBmkText')}<select class="form-input" data-bmk><option value="">${t('cadKeepText')}</option>${(g?.texts??[]).map(tx=>`<option value="${esc(tx.id)}" ${tx.id===this.bmkText?'selected':''}>${esc(tx.text)}</option>`).join('')}</select></label><label>${t('cadGrid')}<select class="form-input" data-grid>${[0,1,2,4,8,12,16,20,24,32].map(n=>`<option value="${n}" ${this.grid===n?'selected':''}>${n?n+' mm':t('cadOriginalScale')}</option>`).join('')}</select></label><label>${t('cadScaleFactor')}<select class="form-input" data-scale-multiplier>${[0.5,0.75,1,1.25,1.5,2,2.5,3,4,5,8,10].map(s=>`<option value="${s}" ${this.scaleMultiplier===s?'selected':''}>${s}×</option>`).join('')}</select></label><p style="font-size:12px">${t('cadGridHint')}</p></div><div><div data-preview></div><p data-preview-note role="status"></p></div></div>
    <h3>${t('cadPins')}</h3><p>${t('cadPinsHint')}</p>${g?.candidatesLimited?`<p>${t('cadCandidatesLimited')}</p>`:''}<div style="max-height:28vh;overflow:auto"><table style="width:100%;font-size:12px;text-align:left"><thead style="position:sticky;top:0;background:#17202d"><tr><th>${t('cadUse')}</th><th>${t('cadPinName')}</th><th>X mm</th><th>Y mm</th><th>${t('cadDirection')}</th><th>${t('cadPinText')}</th></tr></thead><tbody>${this.rows.map((r,i)=>`<tr><td><input type="checkbox" data-row="${i}" data-key="enabled" ${r.enabled?'checked':''}></td><td><input class="form-input" style="width:70px" data-row="${i}" data-key="name" value="${esc(r.name)}"></td>${(['x','y'] as const).map(a=>`<td><input type="number" step="any" class="form-input" style="width:92px" data-row="${i}" data-key="${a}" value="${r[a]}"></td>`).join('')}<td><select class="form-input" data-row="${i}" data-key="direction">${(['top','bottom','left','right'] as const).map(d=>`<option value="${d}" ${d===r.direction?'selected':''}>${t(('cadDir_'+d) as TranslationKey)}</option>`).join('')}</select></td><td><select class="form-input" data-row="${i}" data-key="textId"><option value="">${t('cadDefaultPinText')}</option>${(g?.texts??[]).map(tx=>`<option value="${esc(tx.id)}" ${tx.id===r.textId?'selected':''}>${esc(tx.text)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div><button class="btn" data-add>${t('cadAddPin')}</button><p><label><input type="checkbox" data-no-pins ${this.noPins?'checked':''}> ${t('cadNoPins')}</label></p>${this.doc!.warnings.length?`<p style="color:#fbbf24">${t('cadUnsupported')}: ${esc(this.doc!.warnings.join(', '))}</p><label><input type="checkbox" data-partial ${this.partial?'checked':''}> ${t('cadPartial')}</label>`:''}<p><label><input type="checkbox" data-confirm ${this.confirmed?'checked':''}> ${t('cadConfirm')}</label></p>`:''}
    <footer style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px"><button class="btn" data-close>${t('close')}</button>${g?`<button class="btn btn-primary" data-apply ${this.busy?'disabled':''}>${t('cadApply')}</button>`:''}</footer></section>`;
    this.el.querySelector('[data-close]')?.addEventListener('click',()=>this.close());
    this.el.querySelector('[data-dwg]')?.addEventListener('click',()=>{
      const request=openCadConverter(this.abort.signal);this.busy=true;this.error='';this.render();
      void request.then(({dxf,original})=>this.load(dxf,original)).catch(e=>{if(!this.abort.signal.aborted&&(e as Error).message!=='cadCancelled')this.error=this.message(e);}).finally(()=>{this.busy=false;if(!this.abort.signal.aborted)this.render();});
    });
    const file=this.el.querySelector<HTMLInputElement>('[data-file]')!;this.el.querySelector('[data-dxf]')?.addEventListener('click',()=>file.click());
    file.addEventListener('change',()=>{const f=file.files?.[0];if(!f||this.busy)return;this.busy=true;this.error='';this.render();void this.load(f).catch(e=>{this.error=this.message(e);}).finally(()=>{this.busy=false;if(!this.abort.signal.aborted)this.render();});});
    this.el.querySelector('[data-block]')?.addEventListener('change',e=>{try{this.read();this.block=(e.target as HTMLSelectElement).value;this.resetGeometry();this.error='';}catch(err){this.error=this.message(err);this.geometry=undefined;}this.render();});
    this.el.querySelector('[data-unit]')?.addEventListener('change',e=>{try{this.read();this.unit=Number((e.target as HTMLSelectElement).value);this.unitConfirmed=this.unit>0;this.resetGeometry();this.error='';}catch(err){this.error=this.message(err);this.geometry=undefined;}this.render();});
    this.el.querySelector('[data-add]')?.addEventListener('click',()=>{this.read();this.rows.push({enabled:false,name:'',direction:'top',x:0,y:0});this.render();});
    for(const input of this.el.querySelectorAll('input:not([type=file]),select:not([data-block]):not([data-unit])'))input.addEventListener('change',()=>void this.updatePreview());
    this.el.querySelector('[data-apply]')?.addEventListener('click',()=>void this.apply());
    void this.updatePreview();focusArticleModal(this.el);
  }
  private async apply(){
    if(this.busy)return;
    this.read();this.error='';
    try{
      if(!this.confirmed||!this.unitConfirmed||!this.rows.some(r=>r.enabled)&&!this.noPins||this.rows.some(r=>r.enabled)&&this.noPins)throw new Error('cadConfirmRequired');
      if(this.doc!.warnings.length&&!this.partial)throw new Error('cadPartialRequired');
      this.busy=true;
      let result;
      try {
        result=await createCadSymbol(this.article,this.geometry!,this.options());
      } catch (err) {
        if ((err as Error).message === 'cadGridInvalid') {
          result=await createCadSymbol(this.article,this.geometry!,{...this.options(),gridMm:undefined});
        } else {
          throw err;
        }
      }
      const sources=[{path:'CAD/'+this.dxf!.name,data:new Uint8Array(await this.dxf!.arrayBuffer())}];
      if(this.original)sources.unshift({path:'CAD/'+this.original.name,data:new Uint8Array(await this.original.arrayBuffer())});
      if(this.abort.signal.aborted)return;
      this.onApply(attachCadSymbol(this.article,this.existing,result.symbol,result.macro,sources));this.close();
    }catch(error){this.error=this.message(error);this.busy=false;this.render();}
  }
}
