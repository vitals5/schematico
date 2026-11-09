import {CadArticleSymbolDialog} from './CadArticleSymbolDialog';
import type {ArticlePackageAssets} from '../model/ArticlePackageAssets';
import { importArticlePackage } from '../model/ArticlePackageImport';
import { SymbolSelectionDialog } from './SymbolSelectionDialog';
import { getSymbolById } from '../model/symbols';
import {
  sharedCatalogState,
  refreshSharedCatalog,
  onSharedCatalogChange,
} from '../model/GitHubCatalog';
import { openCatalogPublication } from './CatalogPublicationDialog';
import {
  finishEngineeringDialog,
  formatCatalogSummary,
} from './EngineeringDialog';
import { manufacturerArticles } from '../model/ManufacturerImport';
import { TeamCatalogDialog } from './TeamCatalogDialog';
import { FunctionEditor } from './FunctionEditor';
import { bindArticleModalKeys, focusArticleModal } from './ArticleModal';
import type { CatalogArticle } from '../model/ArticleTypes';
import type { Project } from '../model/types';
import {
  ArticleCatalog,
  catalogKey,
  catalogRevision,
  starterArticles,
  availableCatalogArticles,
  projectArticles,
  planCatalogMerge,
  validateCatalogArticle,
  parseCatalogFile,
  catalogToJson,
  catalogToCsv,
} from '../model/ArticleCatalog';
import { escapeSvg as esc } from '../model/ImportedDrawing';
import { t, translations, getUiLanguage, getLocalizedSymbol, type TranslationKey } from '../i18n';
export const articleError = (e: unknown) => {
  const message = e instanceof Error ? e.message : (typeof e === 'object' && e !== null && 'message' in e) ? String((e as any).message) : String(e ?? '');
  const name = (typeof e === 'object' && e !== null && 'name' in e) ? String((e as any).name) : '';
  if (message.toLowerCase().includes('event handler') || name === 'AbortError' || name === 'InvalidStateError') {
    return t('articlesStorageUnavailable');
  }
  return message in translations.de ? t(message as TranslationKey) : message;
};
export const downloadArticleFile = (
  text: string,
  name: string,
  type: string,
) => {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export class ArticleCatalogDialog {
  private el = document.createElement('div');
  private store = new ArticleCatalog();
  private rows: CatalogArticle[] = [];
  private packageRows: ArticlePackageAssets[] = [];
  private deletedList: string[] = [];
  private search = '';
  private page = 0;
  private error = '';
  private importHint = '';
  private shared = sharedCatalogState();
  private candidateCache?: CatalogArticle[];
  private stopShared?: () => void;
  private message = '';
  private busy = false;
  private closed = false;
  private available = false;
  private editing?: CatalogArticle;
  private functionEditor?: FunctionEditor;
  private pending?: CatalogArticle[];
  private pendingAssets: ArticlePackageAssets[]=[];
  private deletion?: CatalogArticle;
  private replace = false;
  private expected = '';
  private restore = document.activeElement as HTMLElement | null;
  constructor(
    private project: Project,
    private onChoose?: (article: CatalogArticle) => void,
    initialSearch = '',
    initialArticle?: CatalogArticle,
    private initialPackages: File[] = [],
  ) {
    this.search = initialSearch;
    if (initialArticle) this.editing = structuredClone(initialArticle);
  }
  show() {
    if (document.getElementById('articleCatalogDialog')) return;
    this.el.id = 'articleCatalogDialog';
    this.el.className = 'modal-backdrop';
    this.el.style.cssText =
      'position:fixed;inset:0;background:#000b;display:flex;align-items:center;justify-content:center;padding:12px;z-index:4400';
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => {
      if (!this.busy) this.close();
    });
    this.stopShared = onSharedCatalogChange(() => {
      this.shared = sharedCatalogState();
      this.candidateCache = undefined;
      if (
        !this.busy &&
        !this.closed &&
        !document.getElementById('catalogPublicationDialog') &&
        !document.getElementById('catalogDesktopTransfer')
      )
        this.render();
    });
    this.render();
    void refreshSharedCatalog();
    void this.work(async () => {
      await this.reload();
      if(this.initialPackages.length) {
        if(this.initialPackages.length>20)throw new Error('manufacturerInvalid');
        const imported=[];
        for(const file of this.initialPackages)imported.push(await importArticlePackage(file,getUiLanguage()));
        this.prepare(imported.flatMap(r=>r.articles),this.packageHint(imported));
        this.pendingAssets=imported.flatMap(r=>r.assets);
      }
    });
  }
  private close() {
    this.closed = true;
    this.stopShared?.();
    this.el.remove();
    if (this.restore?.isConnected) this.restore.focus();
  }
  private async reload() {
    [this.rows,this.packageRows,this.deletedList] = await Promise.all([this.store.list(),this.store.packageAssets(),this.store.deletedIds()]);
    this.candidateCache = undefined;
    this.expected = catalogRevision(this.rows);
    this.available = true;
    this.pending = undefined;
    this.deletion = undefined;
  }
  private async work(fn: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.render();
    try {
      await fn();
    } catch (e) {
      this.error = articleError(e);
    } finally {
      this.busy = false;
      if (!this.closed) this.render();
    }
  }
  private candidates() {
    if (this.candidateCache) return this.candidateCache;
    return (this.candidateCache = availableCatalogArticles(this.shared.articles, this.rows, new Set(this.deletedList)));
  }
  private originLabel(article: CatalogArticle) {
    const local = this.rows.some((a) => a.id === article.id),
      shared = this.shared.articles.some((a) => a.id === article.id);
    return t(
      local
        ? shared
          ? 'githubCatalogLocalCopy'
          : 'githubCatalogLocal'
        : shared
          ? 'githubCatalogSource'
          : 'githubCatalogStarter',
    );
  }
  private sharedHas(article: CatalogArticle) {
    const key = catalogKey(article);
    return this.shared.articles.some((a) => a.id === key);
  }
  private openCadSymbol(article:CatalogArticle, pendingIndex?:number) {
    const incoming=this.pending ? structuredClone(this.pending) : undefined;
    const pendingAssets=structuredClone(this.pendingAssets);
    const key = catalogKey(article);
    const existing=this.pendingAssets.find(p=>p.id===article.id || p.id===key)??this.packageRows.find(p=>p.id===article.id || p.id===key);
    new CadArticleSymbolDialog(article,existing,result=>{
      if(this.closed)return;
      const rKey = catalogKey(result.article);
      const items=incoming?incoming.map((a,i)=>(pendingIndex!==undefined?i===pendingIndex:(a.id===article.id || catalogKey(a)===key))?result.article:a):[];
      if(!items.some(a=>a.id===result.article.id || catalogKey(a)===rKey))items.push(result.article);
      this.editing=result.article;
      this.prepare(items,t('cadLinked'));
      this.pendingAssets=[...pendingAssets.filter(p=>items.some(a=>a.id===p.id || catalogKey(a)===p.id)&&p.id!==result.asset.id),result.asset];
      this.render();
    }).show();
  }
  private packageHint(results:Awaited<ReturnType<typeof importArticlePackage>>[]) {
    const assets=results.flatMap(r=>r.assets), macros=new Set(assets.flatMap(a=>a.macros.map(m=>m.id)));
    return t('articlePackageHint',{count:macros.size})+'\n'+[...new Set(assets.flatMap(a=>a.diagnostics))].join('\n');
  }
  private prepare(items: CatalogArticle[], importHint = '') {
    planCatalogMerge(this.rows, items);
    this.pendingAssets = this.pendingAssets.filter(p => items.some(a => a.id === p.id));
    this.pending = structuredClone(items);
    this.importHint = importHint;
    this.deletion = undefined;
    this.replace = false;
    this.error = '';
    this.message = '';
    this.render();
  }
  private render() {
    const candidates = this.candidates().filter((a) =>
        [a.articleNumber, a.manufacturer, a.variant, a.description]
          .join(' ')
          .toLocaleLowerCase()
          .includes(this.search.toLocaleLowerCase()),
      ),
      pages = Math.max(1, Math.ceil(candidates.length / 50));
    this.page = Math.min(this.page, pages - 1);
    const merge = this.pending
      ? planCatalogMerge(this.rows, this.pending)
      : undefined;
    this.el.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="catalogTitle" style="width:min(1050px,100%);max-height:92vh;overflow:auto;padding:20px;background:#17202d;color:#eee;border:1px solid #526170;border-radius:8px"><h2 id="catalogTitle">${t('articlesCatalog')}</h2><p>${t('articlesCatalogHint')}</p><div role="alert" data-error style="color:#fca5a5">${esc(this.error)}</div><p>${esc(this.importHint)}</p><p role="status">${this.busy ? t('articlesLoading') : esc(this.message)}</p>
 <div class="eng-shared-catalog"><div><strong>${t('githubCatalogTitle')} · ${this.shared.articles.length} ${t('githubCatalogArticles')}</strong><span>${t(('githubCatalogState_' + this.shared.status) as any)}${!this.shared.submission ? ' · ' + t('githubCatalogNotConfigured') : ''}</span></div><button class="btn" data-shared-refresh>${t('articlesRefresh')}</button></div>
 <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" data-team>${t('teamCatalog')}</button><button class="btn" data-new>${t('articlesNew')}</button><button class="btn" data-import>${t('manufacturerImport')}</button><button class="btn" data-portal>${t('articlePortalOpen')}</button><input type="file" data-file accept=".csv,.json,.xml,.wspak,.edz" hidden><button class="btn" data-project>${t('articlesFromProject')}</button><button class="btn" data-json ${this.available ? '' : 'disabled'}>${t('articlesExportJson')}</button><button class="btn" data-csv ${this.available ? '' : 'disabled'}>${t('articlesExportCsv')}</button><button class="btn" data-refresh>${t('articlesRefresh')}</button>${this.deletedList.length ? `<button class="btn" data-reset-defaults>${t('articlesResetDefaults')}</button>` : ''}</div>
 <input data-search class="form-input" placeholder="${t('articlesSearch')}" value="${esc(this.search)}" style="margin:10px 0">
 <div style="max-height:27vh;overflow:auto"><table style="width:100%;text-align:left;font-size:12px"><thead><tr><th>${t('articlesManufacturer')}</th><th>${t('articlesNumber')}</th><th>${t('articlesDescription')}</th><th>${t('engineeringStatus')}</th><th>${t('plausColAction')}</th></tr></thead><tbody>${candidates
   .slice(this.page * 50, this.page * 50 + 50)
   .map(
     (a, i) =>
       `<tr><td>${esc(a.manufacturer)}</td><td>${esc(a.articleNumber)}${a.variant ? ' [' + esc(a.variant) + ']' : ''}<br><span class="eng-catalog-origin">${this.originLabel(a)}</span></td><td><span class="eng-ellipsis" title="${esc(a.description)}">${esc(a.description)}</span></td><td><span class="eng-catalog-origin" title="${t(a.verification === 'user_checked' ? 'articlesChecked' : 'articlesUnverified')}">${a.verification === 'user_checked' ? t('engineeringChecked') : t('articlesUnverified')}</span></td><td>${this.onChoose ? `<button class="btn" data-choose="${i}">${t('articlesChoose')}</button>` : ''}<button class="btn" data-edit="${i}">${t('articlesEdit')}</button>${this.packageRows.some(p=>p.id===a.id)?`<button class="btn" data-package-download="${i}">${t('articlePackageSources')}</button>`:''}<button class="btn" data-delete="${i}">${t('articlesDelete')}</button></td></tr>`,
   )
   .join(
     '',
   )}</tbody></table></div><div style="display:flex;gap:10px;align-items:center"><button class="btn" data-prev ${this.page ? '' : 'disabled'}>←</button> ${this.page + 1} / ${pages} <button class="btn" data-next ${this.page < pages - 1 ? '' : 'disabled'}>→</button></div>
 ${this.editing ? `<fieldset style="margin-top:12px"><legend>${t('articlesEdit')}</legend><div style="display:flex;gap:8px;flex-wrap:wrap">${(['articleNumber', 'manufacturer', 'variant', 'description'] as const).map((key, i) => `<label>${t((['articlesNumber', 'articlesManufacturer', 'articlesVariant', 'articlesDescription'] as const)[i])}<input class="form-input" data-field="${key}" value="${esc(this.editing![key])}"></label>`).join('')}</div><div class="article-symbol-field"><label>${t('articleSymbolDefault')}</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span data-article-symbol>${esc(this.editing.symbolId ? (getSymbolById(this.editing.symbolId,this.project) ? getLocalizedSymbol(getSymbolById(this.editing.symbolId,this.project)!).name : [...this.pendingAssets,...this.packageRows].flatMap(p=>p.macros).flatMap(m=>m.symbolLibrary??[]).find(s=>s.id===this.editing!.symbolId)?.name??this.editing.symbolId) : t('articleSymbolMissing'))}</span><button class="btn" data-link-symbol>${t('articleSymbolLink')}</button><button class="btn" data-cad-link>${t('cadTitle')}</button><button class="btn" data-clear-symbol ${this.editing.symbolId ? '' : 'disabled'}>${t('articleSymbolClear')}</button></div><p>${t('articleSymbolHint')}</p></div><div data-functions-editor></div><label><input type="checkbox" data-verified ${this.editing.verification === 'user_checked' ? 'checked' : ''}> ${t('articlesChecked')}</label><div class="nav-button-row"><button class="btn" data-save>${t('articlesSave')}</button><button class="btn eng-primary" data-publish ${this.shared.submission ? '' : 'disabled'}>${t('githubCatalogPublish')}</button></div><p>${t('githubCatalogNewOnly')}</p></fieldset>` : ''}
 ${merge ? `<fieldset data-preview><legend>${t('articlesPreview')}</legend>${this.pending?.map((a,i)=>`<button class="btn" data-cad-pending="${i}">${esc(a.manufacturer+' '+a.articleNumber)} · ${t('cadTitle')}</button>`).join('')}<p>${t('articlesMergeCounts', { added: merge.added.length, conflicts: merge.conflicts.length, unchanged: merge.unchanged.length })}</p><div style="max-height:20vh;overflow:auto"><table style="width:100%"><tr><th>${t('articlesBefore')}</th><th>${t('articlesAfter')}</th></tr>${[...merge.added, ...merge.conflicts].map((a) => `<tr><td style="white-space:pre-wrap">${esc(formatCatalogSummary(this.rows.find((r) => catalogKey(r) === catalogKey(a))))}</td><td style="white-space:pre-wrap">${esc(formatCatalogSummary(a))}</td></tr>`).join('')}</table></div>${merge.conflicts.length ? `<label><input type="checkbox" data-replace ${this.replace ? 'checked' : ''}> ${t('articlesReplace')}</label>` : ''}<button class="btn" data-commit ${!this.available || (merge.conflicts.length && !this.replace) ? 'disabled' : ''}>${t('articlesApply')}</button></fieldset>` : ''}
 ${this.deletion ? `<fieldset><legend>${t('articlesDelete')}</legend><p>${esc(this.deletion.manufacturer + ' ' + this.deletion.articleNumber + ' ' + this.deletion.variant)}</p><button class="btn" data-remove>${t('articlesApply')}</button></fieldset>` : ''}
 <footer style="text-align:right;margin-top:16px"><button class="btn" data-close>${t('close')}</button></footer></section>`;
    const slice = candidates.slice(this.page * 50, this.page * 50 + 50);
    this.el
      .querySelector('[data-close]')
      ?.addEventListener('click', () => this.close());
    this.el
      .querySelector('[data-refresh]')
      ?.addEventListener('click', () => void this.work(() => this.reload()));
    this.el
      .querySelector<HTMLInputElement>('[data-search]')
      ?.addEventListener('input', (e) => {
        const input = e.target as HTMLInputElement,
          pos = input.selectionStart;
        this.search = input.value;
        this.page = 0;
        this.render();
        const next = this.el.querySelector<HTMLInputElement>('[data-search]')!;
        next.focus();
        next.setSelectionRange(pos, pos);
      });
    this.el.querySelector('[data-shared-refresh]')?.addEventListener(
      'click',
      () =>
        void this.work(async () => {
          this.shared = await refreshSharedCatalog();
        }),
    );
    this.el.querySelector('[data-reset-defaults]')?.addEventListener('click', () => {
      void this.work(async () => {
        await this.store.resetDeleted();
        await this.reload();
        this.message = t('articlesResetDone');
      });
    });
    this.el.querySelector('[data-publish]')?.addEventListener('click', () => {
      try {
        const article = validateCatalogArticle(syncDraft());
        if (this.sharedHas(article)) throw new Error('githubCatalogConflict');
        void openCatalogPublication(article, () => {
          this.message = t('githubCatalogSubmitted');
          this.shared = sharedCatalogState();
          this.render();
          void refreshSharedCatalog();
        }).catch((error) => {
          this.error = articleError(error);
          this.render();
        });
      } catch (error) {
        this.error = articleError(error);
        this.render();
      }
    });
    this.el
      .querySelector('[data-team]')
      ?.addEventListener('click', () =>
        new TeamCatalogDialog(() => void this.work(() => this.reload())).show(),
      );
    this.el.querySelector('[data-new]')?.addEventListener('click', () => {
      this.editing = {
        id: '',
        articleNumber: '',
        manufacturer: '',
        variant: '',
        description: '',
        origin: 'user',
        verification: 'unverified',
      };
      this.render();
    });
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-edit]'))
      b.addEventListener('click', () => {
        this.editing = structuredClone(slice[Number(b.dataset.edit)]);
        this.render();
      });
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-choose]'))
      b.addEventListener('click', () => {
        this.onChoose?.(structuredClone(slice[Number(b.dataset.choose)]));
        this.close();
      });
    for(const b of this.el.querySelectorAll<HTMLElement>('[data-package-download]'))b.addEventListener('click',()=>void this.work(async()=>{
      const article=slice[Number(b.dataset.packageDownload)], asset=this.packageRows.find(p=>p.id===article.id);if(!asset)return;
      const {default:JSZip}=await import('jszip'),zip=new JSZip();
      zip.file('article.json',catalogToJson([article]));
      asset.macros.forEach((macro,i)=>zip.file(`macros/${i+1}-symbol.json`,JSON.stringify(macro,null,2)));
      asset.sources.forEach((source,i)=>zip.file(`${i+1}-${source.path.split(/[\\/]/).pop()||'source.bin'}`,source.data));
      const blob=await zip.generateAsync({type:'blob'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='schematico-article-sources.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }));
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-delete]'))
      b.addEventListener('click', () => {
        this.deletion = structuredClone(slice[Number(b.dataset.delete)]);
        this.pending = undefined;
        this.render();
      });
    this.el.querySelector('[data-prev]')?.addEventListener('click', () => {
      this.page--;
      this.render();
    });
    this.el.querySelector('[data-next]')?.addEventListener('click', () => {
      this.page++;
      this.render();
    });
    const functionsEl = this.el.querySelector<HTMLElement>(
      '[data-functions-editor]',
    );
    if (functionsEl)
      this.functionEditor = new FunctionEditor(
        functionsEl,
        this.editing?.functions,
      );
    const syncDraft = () => {
      const article = { ...this.editing! };
      for (const input of this.el.querySelectorAll<HTMLInputElement>(
        '[data-field]',
      ))
        (article as any)[input.dataset.field!] = input.value;
      article.functions = this.functionEditor?.value();
      article.origin = 'user';
      article.verification = this.el.querySelector<HTMLInputElement>(
        '[data-verified]',
      )?.checked
        ? 'user_checked'
        : 'unverified';
      this.editing = article;
      return article;
    };
    this.el.querySelector('[data-link-symbol]')?.addEventListener('click', () => {
      syncDraft();
      new SymbolSelectionDialog({onSelect: symbol => {
        this.editing!.symbolId = symbol.id;
        this.pending = undefined;
        this.render();
      }}, 'elements', {standardOnly:true,zIndex:4800}).show();
    });
    this.el.querySelector('[data-cad-link]')?.addEventListener('click',()=>{
      try{this.openCadSymbol(validateCatalogArticle(syncDraft()));}catch(e){this.error=articleError(e);this.render();}
    });
    for(const button of this.el.querySelectorAll<HTMLElement>('[data-cad-pending]'))button.addEventListener('click',()=>{
      const index=Number(button.dataset.cadPending),article=this.pending?.[index];if(article)this.openCadSymbol(article,index);
    });
    this.el.querySelector('[data-clear-symbol]')?.addEventListener('click', () => {
      syncDraft();
      delete this.editing!.symbolId;
      this.pending = undefined;
      this.render();
    });
    const invalidateEditor = () => {
      const article = syncDraft();
      this.pending = undefined;
      this.el.querySelector('[data-preview]')?.remove();
      const publish =
        this.el.querySelector<HTMLButtonElement>('[data-publish]');
      if (publish)
        publish.disabled =
          !this.shared.submission ||
          !article.articleNumber.trim() ||
          !article.manufacturer.trim() ||
          this.sharedHas(article);
    };
    const editor = functionsEl?.closest('fieldset');
    editor?.addEventListener('input', invalidateEditor);
    editor?.addEventListener('click', (event) => {
      if (
        (event.target as Element).closest(
          '[data-add-function],[data-remove-function]',
        )
      )
        invalidateEditor();
    });
    const publishButton =
      this.el.querySelector<HTMLButtonElement>('[data-publish]');
    if (publishButton && this.editing)
      publishButton.disabled =
        !this.shared.submission ||
        !this.editing.articleNumber.trim() ||
        !this.editing.manufacturer.trim() ||
        this.sharedHas(this.editing!);

    this.el.querySelector('[data-save]')?.addEventListener('click', () => {
      try {
        const a = { ...this.editing! };
        for (const input of this.el.querySelectorAll<HTMLInputElement>(
          '[data-field]',
        ))
          (a as any)[input.dataset.field!] = input.value;
        a.functions = this.functionEditor?.value();
        a.origin = 'user';
        a.verification = this.el.querySelector<HTMLInputElement>(
          '[data-verified]',
        )!.checked
          ? 'user_checked'
          : 'unverified';
        this.editing = a;
        this.prepare([validateCatalogArticle(a)]);
      } catch (e) {
        this.error = articleError(e);
        this.render();
      }
    });
    this.el.querySelector('[data-project]')?.addEventListener('click', () => {
      try {
        this.prepare(projectArticles(this.project));
      } catch (e) {
        this.error = articleError(e);
        this.render();
      }
    });
    this.el.querySelector('[data-portal]')?.addEventListener('click',()=> {
      const native=(window as any).electronAPI?.articles?.openPortal;
      if(native) void native().catch((error:unknown)=>{this.error=articleError(error);this.render();});
      else window.open('https://www.wscaduniverse.com/','_blank','noopener,noreferrer');
    });
    const file = this.el.querySelector<HTMLInputElement>('[data-file]')!;
    this.el
      .querySelector('[data-import]')
      ?.addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      if (f)
        void this.work(async () => {
          if (f.size > 20 * 1024 * 1024)
            throw new Error('articlesCatalogInvalid');
          if (/\.(wspak|edz)$/i.test(f.name)) {
            const result=await importArticlePackage(f,getUiLanguage());
            this.prepare(result.articles,this.packageHint([result]));
            this.pendingAssets=result.assets;
            return;
          }
          const text = await f.text();
          if (f.name.toLowerCase().endsWith('.xml')) {
            const imported = manufacturerArticles(text);
            this.prepare(
              imported.articles,
              t('manufacturerHint', {
                count: imported.withoutFunctions.length,
              }),
            );
          } else {
            this.prepare(
              parseCatalogFile(
                text,
                f.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json',
              ),
            );
          }
        });
    });
    this.el
      .querySelector('[data-json]')
      ?.addEventListener('click', () =>
        downloadArticleFile(
          catalogToJson(this.candidates()),
          'schematico-articles.json',
          'application/json',
        ),
      );
    this.el
      .querySelector('[data-csv]')
      ?.addEventListener('click', () =>
        downloadArticleFile(
          catalogToCsv(this.candidates()),
          'schematico-articles.csv',
          'text/csv;charset=utf-8',
        ),
      );
    this.el
      .querySelector<HTMLInputElement>('[data-replace]')
      ?.addEventListener('change', (e) => {
        this.replace = (e.target as HTMLInputElement).checked;
        this.render();
      });
    this.el.querySelector('[data-commit]')?.addEventListener(
      'click',
      () =>
        void this.work(async () => {
          await this.store.merge(this.pending!, this.replace, this.expected, this.pendingAssets);
          await this.reload();
          this.editing = undefined;
          this.message = t('articlesStored');
        }),
    );
    this.el.querySelector('[data-remove]')?.addEventListener(
      'click',
      () =>
        void this.work(async () => {
          const targetId = this.deletion!.id;
          this.deletion = undefined;
          await this.store.remove(targetId, this.expected, true);
          await this.reload();
          this.message = t('articlesStored');
        }),
    );
    if (this.busy)
      for (const input of this.el.querySelectorAll<
        | HTMLInputElement
        | HTMLButtonElement
        | HTMLSelectElement
        | HTMLTextAreaElement
      >('button,input,select,textarea'))
        input.disabled = true;
    finishEngineeringDialog(this.el, {
      kind: 'catalog',
      description: t('engineeringCatalogHint'),
      wide: true,
    });
    focusArticleModal(this.el);
  }
}
