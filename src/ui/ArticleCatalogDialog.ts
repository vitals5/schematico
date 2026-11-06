import { bindArticleModalKeys, focusArticleModal } from './ArticleModal';
import type { CatalogArticle } from '../model/ArticleTypes';
import type { Project } from '../model/types';
import {
  ArticleCatalog,
  catalogKey,
  catalogRevision,
  starterArticles,
  projectArticles,
  planCatalogMerge,
  validateCatalogArticle,
  parseCatalogFile,
  catalogToJson,
  catalogToCsv,
} from '../model/ArticleCatalog';
import { escapeSvg as esc } from '../model/ImportedDrawing';
import { t, translations, type TranslationKey } from '../i18n';
export const articleError = (e: unknown) => {
  const message = e instanceof Error ? e.message : String(e);
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
  private search = '';
  private page = 0;
  private error = '';
  private message = '';
  private busy = false;
  private closed = false;
  private available = false;
  private editing?: CatalogArticle;
  private pending?: CatalogArticle[];
  private deletion?: CatalogArticle;
  private replace = false;
  private expected = '';
  private restore = document.activeElement as HTMLElement | null;
  constructor(
    private project: Project,
    private onChoose?: (article: CatalogArticle) => void,
  ) {}
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
    this.render();
    void this.work(() => this.reload());
  }
  private close() {
    this.closed = true;
    this.el.remove();
    if (this.restore?.isConnected) this.restore.focus();
  }
  private async reload() {
    this.rows = await this.store.list();
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
    const map = new Map(starterArticles().map((a) => [catalogKey(a), a]));
    for (const a of this.rows) map.set(catalogKey(a), a);
    return [...map.values()];
  }
  private prepare(items: CatalogArticle[]) {
    planCatalogMerge(this.rows, items);
    this.pending = structuredClone(items);
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
    this.el.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="catalogTitle" style="width:min(1050px,100%);max-height:92vh;overflow:auto;padding:20px;background:#17202d;color:#eee;border:1px solid #526170;border-radius:8px"><h2 id="catalogTitle">${t('articlesCatalog')}</h2><p>${t('articlesCatalogHint')}</p><div role="alert" data-error style="color:#fca5a5">${esc(this.error)}</div><p role="status">${this.busy ? t('articlesLoading') : esc(this.message)}</p>
 <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" data-new>${t('articlesNew')}</button><button class="btn" data-import>${t('articlesImport')}</button><input type="file" data-file accept=".csv,.json" hidden><button class="btn" data-project>${t('articlesFromProject')}</button><button class="btn" data-json ${this.available ? '' : 'disabled'}>${t('articlesExportJson')}</button><button class="btn" data-csv ${this.available ? '' : 'disabled'}>${t('articlesExportCsv')}</button><button class="btn" data-refresh>${t('articlesRefresh')}</button></div>
 <input data-search class="form-input" placeholder="${t('articlesSearch')}" value="${esc(this.search)}" style="margin:10px 0">
 <div style="max-height:27vh;overflow:auto"><table style="width:100%;text-align:left;font-size:12px"><tbody>${candidates
   .slice(this.page * 50, this.page * 50 + 50)
   .map(
     (a, i) =>
       `<tr><td>${esc(a.manufacturer)}</td><td>${esc(a.articleNumber)} [${esc(a.variant)}]</td><td>${esc(a.description)}</td><td>${a.verification === 'user_checked' ? t('articlesChecked') : t('articlesUnverified')}</td><td>${this.onChoose ? `<button class="btn" data-choose="${i}">${t('articlesChoose')}</button>` : ''}<button class="btn" data-edit="${i}">${t('articlesEdit')}</button>${this.rows.some((r) => r.id === a.id) ? `<button class="btn" data-delete="${i}">${t('articlesDelete')}</button>` : ''}</td></tr>`,
   )
   .join(
     '',
   )}</tbody></table></div><div style="display:flex;gap:10px;align-items:center"><button class="btn" data-prev ${this.page ? '' : 'disabled'}>←</button> ${this.page + 1} / ${pages} <button class="btn" data-next ${this.page < pages - 1 ? '' : 'disabled'}>→</button></div>
 ${this.editing ? `<fieldset style="margin-top:12px"><legend>${t('articlesEdit')}</legend><div style="display:flex;gap:8px;flex-wrap:wrap">${(['articleNumber', 'manufacturer', 'variant', 'description'] as const).map((key, i) => `<label>${t((['articlesNumber', 'articlesManufacturer', 'articlesVariant', 'articlesDescription'] as const)[i])}<input class="form-input" data-field="${key}" value="${esc(this.editing![key])}"></label>`).join('')}</div><label>${t('articlesFunctions')}<textarea class="form-input" data-functions rows="3" placeholder='[{"id":"coil","type":"relay_coil","pins":["A1","A2"]}]'>${esc(this.editing.functions ? JSON.stringify(this.editing.functions, null, 2) : '')}</textarea></label><label><input type="checkbox" data-verified ${this.editing.verification === 'user_checked' ? 'checked' : ''}> ${t('articlesChecked')}</label><button class="btn" data-save>${t('articlesSave')}</button></fieldset>` : ''}
 ${merge ? `<fieldset data-preview><legend>${t('articlesPreview')}</legend><p>${t('articlesMergeCounts', { added: merge.added.length, conflicts: merge.conflicts.length, unchanged: merge.unchanged.length })}</p><div style="max-height:20vh;overflow:auto"><table style="width:100%"><tr><th>${t('articlesBefore')}</th><th>${t('articlesAfter')}</th></tr>${[...merge.added, ...merge.conflicts].map((a) => `<tr><td style="white-space:pre-wrap">${esc(JSON.stringify(this.rows.find((r) => catalogKey(r) === catalogKey(a)) ?? null, null, 2))}</td><td style="white-space:pre-wrap">${esc(JSON.stringify(a, null, 2))}</td></tr>`).join('')}</table></div>${merge.conflicts.length ? `<label><input type="checkbox" data-replace ${this.replace ? 'checked' : ''}> ${t('articlesReplace')}</label>` : ''}<button class="btn" data-commit ${!this.available || (merge.conflicts.length && !this.replace) ? 'disabled' : ''}>${t('articlesApply')}</button></fieldset>` : ''}
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
    this.el.querySelector('[data-save]')?.addEventListener('click', () => {
      try {
        const a = { ...this.editing! };
        for (const input of this.el.querySelectorAll<HTMLInputElement>(
          '[data-field]',
        ))
          (a as any)[input.dataset.field!] = input.value;
        const raw =
          this.el.querySelector<HTMLTextAreaElement>('[data-functions]')!.value;
        a.functions = raw.trim() ? JSON.parse(raw) : undefined;
        a.origin = 'user';
        a.verification = this.el.querySelector<HTMLInputElement>(
          '[data-verified]',
        )!.checked
          ? 'user_checked'
          : 'unverified';
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
          this.prepare(
            parseCatalogFile(
              await f.text(),
              f.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json',
            ),
          );
        });
    });
    this.el
      .querySelector('[data-json]')
      ?.addEventListener('click', () =>
        downloadArticleFile(
          catalogToJson(this.rows),
          'schematico-articles.json',
          'application/json',
        ),
      );
    this.el
      .querySelector('[data-csv]')
      ?.addEventListener('click', () =>
        downloadArticleFile(
          catalogToCsv(this.rows),
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
          await this.store.merge(this.pending!, this.replace, this.expected);
          await this.reload();
          this.editing = undefined;
          this.message = t('articlesStored');
        }),
    );
    this.el.querySelector('[data-remove]')?.addEventListener(
      'click',
      () =>
        void this.work(async () => {
          await this.store.remove(this.deletion!.id, this.expected);
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
    focusArticleModal(this.el);
  }
}
