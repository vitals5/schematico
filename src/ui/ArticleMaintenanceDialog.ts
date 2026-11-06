import type { Project } from '../model/types';
import {
  articleUsageGroups,
  ArticleSnapshotPlan,
} from '../model/ArticleMaintenance';
import { ArticleCatalogDialog, articleError } from './ArticleCatalogDialog';
import { bindArticleModalKeys, focusArticleModal } from './ArticleModal';
import { escapeSvg as esc } from '../model/ImportedDrawing';
import { t } from '../i18n';

export class ArticleMaintenanceDialog {
  private el = document.createElement('div');
  private source: Project;
  private groups: ReturnType<typeof articleUsageGroups>;
  private key = '';
  private search = '';
  private page = 0;
  private preview?: ArticleSnapshotPlan;
  private confirm = false;
  private error = '';
  constructor(
    private getProject: () => Project,
    private onApply: (p: Project) => void,
  ) {
    this.source = structuredClone(getProject());
    this.groups = articleUsageGroups(this.source);
  }
  show() {
    if (document.getElementById('articleMaintenanceDialog')) return;
    this.el.id = 'articleMaintenanceDialog';
    this.el.className = 'modal-backdrop';
    this.el.style.cssText =
      'position:fixed;inset:0;z-index:4350;background:#000b;display:flex;align-items:center;justify-content:center;padding:16px';
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => this.el.remove());
    this.render();
  }
  private render() {
    const filtered = this.groups.filter((g) =>
      [g.articleNumber, g.manufacturer, g.variant]
        .join(' ')
        .toLocaleLowerCase()
        .includes(this.search.toLocaleLowerCase()),
    );
    const pages = Math.max(1, Math.ceil(filtered.length / 40));
    this.page = Math.min(this.page, pages - 1);
    const group = this.groups.find((g) => g.key === this.key);
    this.el.innerHTML = `<section role="dialog" aria-modal="true" style="background:#17202d;color:#eee;border:1px solid #526170;border-radius:8px;padding:20px;width:min(1150px,100%);max-height:92vh;overflow:auto"><style>#articleMaintenanceDialog td,#articleMaintenanceDialog th{padding:7px;border-bottom:1px solid #334155;vertical-align:top}#articleMaintenanceDialog table{width:100%;border-collapse:collapse;text-align:left;font-size:13px}</style><h2>${t('articleMaintenance')}</h2><p>${t('articleMaintenanceHint')}</p><div role="alert" style="color:#fca5a5">${esc(this.error)}</div><input class="form-input" data-search placeholder="${t('articlesSearch')}" value="${esc(this.search)}"><div style="max-height:36vh;overflow:auto"><table><tr><th></th><th>${t('articlesNumber')}</th><th>${t('articlesManufacturer')}</th><th>${t('articlesVariant')}</th><th>${t('articleMaintenanceUses')}</th><th>${t('articleMaintenanceMissing')}</th><th>${t('functionUnverified')}</th></tr>${filtered
      .slice(this.page * 40, this.page * 40 + 40)
      .map(
        (g) =>
          `<tr><td><input type="radio" name="articleGroup" data-key="${esc(g.key)}" ${g.key === this.key ? 'checked' : ''}></td><td>${esc(g.articleNumber)}</td><td>${esc(g.manufacturer)}</td><td>${esc(g.variant)}</td><td>${g.uses.length}</td><td>${g.missingFunctions}</td><td>${g.unverified}</td></tr>`,
      )
      .join(
        '',
      )}</table></div><div style="display:flex;gap:10px;margin:8px 0"><button class="btn" data-prev ${this.page ? '' : 'disabled'}>←</button>${this.page + 1} / ${pages}<button class="btn" data-next ${this.page < pages - 1 ? '' : 'disabled'}>→</button><button class="btn" data-catalog ${group ? '' : 'disabled'}>${t('articleMaintenanceChoose')}</button></div>${this.preview ? `<h3>${t('articlesPreview')} (${this.preview.changes.length})</h3><div style="max-height:25vh;overflow:auto"><table><tr><th>${t('reviewPage')}</th><th>BMK</th><th>${t('articlesBefore')}</th><th>${t('articlesAfter')}</th></tr>${this.preview.changes.map((c) => `<tr><td>${esc(c.pageNumber)}</td><td>${esc(c.bmk)} · #${c.position + 1}</td><td>${esc(JSON.stringify(c.before.snapshot?.functions ?? []))}</td><td>${esc(JSON.stringify(c.after.snapshot?.functions ?? []))}<br>${c.after.snapshot?.verification === 'user_checked' ? t('articlesChecked') : t('functionUnverified')}</td></tr>`).join('')}</table></div>${this.preview.requiresConfirmation ? `<label><input type="checkbox" data-confirm ${this.confirm ? 'checked' : ''}> ${t('articleMaintenanceConfirm')}</label>` : ''}` : ''}<footer style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button class="btn" data-close>${t('close')}</button><button class="btn" data-apply ${!this.preview?.changes.length || (this.preview.requiresConfirmation && !this.confirm) ? 'disabled' : ''}>${t('articlesApply')}</button></footer></section>`;
    this.el
      .querySelector('[data-close]')
      ?.addEventListener('click', () => this.el.remove());
    this.el
      .querySelector<HTMLInputElement>('[data-search]')
      ?.addEventListener('input', (e) => {
        this.search = (e.target as HTMLInputElement).value;
        this.page = 0;
        this.render();
        const input = this.el.querySelector<HTMLInputElement>('[data-search]')!;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      });
    for (const radio of this.el.querySelectorAll<HTMLInputElement>(
      '[data-key]',
    ))
      radio.addEventListener('change', () => {
        this.key = radio.dataset.key!;
        this.preview = undefined;
        this.confirm = false;
        this.error = '';
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
    this.el.querySelector('[data-catalog]')?.addEventListener('click', () =>
      new ArticleCatalogDialog(
        this.source,
        (article) => {
          try {
            this.preview = new ArticleSnapshotPlan(
              this.source,
              this.key,
              article,
            );
            this.error = this.preview.changes.length
              ? ''
              : t('articleMaintenanceUnchanged');
            this.confirm = false;
          } catch (e) {
            this.preview = undefined;
            this.error = articleError(e);
          }
          this.render();
        },
        group?.articleNumber,
      ).show(),
    );
    this.el
      .querySelector<HTMLInputElement>('[data-confirm]')
      ?.addEventListener('change', (e) => {
        this.confirm = (e.target as HTMLInputElement).checked;
        this.render();
      });
    this.el.querySelector('[data-apply]')?.addEventListener('click', () => {
      try {
        this.onApply(this.preview!.apply(this.getProject(), this.confirm));
        this.el.remove();
      } catch (e) {
        this.error = articleError(e);
        this.render();
      }
    });
    focusArticleModal(this.el);
  }
}
