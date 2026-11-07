import { finishEngineeringDialog } from './EngineeringDialog';
import { projectRevision } from '../layout/types';
import { importedArticleFields } from './ImportedArticleFields';
import type { Project } from '../model/types';
import {
  ArticleSyncPlan,
  isArticleSyncSelectable,
  type ArticleSyncRow,
  type ArticleSyncStatus,
} from '../model/ArticleSync';
import { PackageHandler } from '../packages/PackageHandler';
import { escapeSvg as esc } from '../model/ImportedDrawing';
import { t, type TranslationKey } from '../i18n';
const statusKeys: Record<ArticleSyncStatus, TranslationKey> = {
  fill: 'articleSyncFill',
  enrich: 'articleSyncEnrich',
  evidence: 'articleSyncEvidence',
  unchanged: 'articleSyncUnchanged',
  conflict: 'articleSyncConflict',
  ambiguous: 'articleSyncAmbiguous',
  missing_source: 'articleSyncMissingSource',
  missing_identity: 'articleSyncMissingIdentity',
  different_source: 'articleSyncDifferentSource',
  source_unread: 'articleSyncSourceUnread',
  identity_conflict: 'articleSyncIdentityConflict',
  excluded: 'articleSyncExcluded',
};
const reasonKeys: Record<string, TranslationKey> = {
  symbol: 'articleSyncReasonSymbol',
  plant: 'articleSyncReasonPlant',
  location: 'articleSyncReasonLocation',
  designation: 'articleSyncReasonDesignation',
  manual_assignment: 'articleSyncReasonManual',
  article_number: 'articleSyncReasonNumber',
  manufacturer: 'articleSyncReasonManufacturer',
  reference_list: 'articleSyncReasonReferences',
};
const conflicts = (r: ArticleSyncRow) =>
  ['conflict', 'ambiguous', 'identity_conflict'].includes(r.status);
const errors: TranslationKey[] = [
  'articleSyncInvalidSource',
  'articleSyncStale',
  'articleSyncSelection',
  'articleSyncConfirmRequired',
  'articleSyncNoProject',
];
export class ArticleSyncDialog {
  private el = document.createElement('div');
  private plan?: ArticleSyncPlan;
  private source?: Project;
  private selected = new Set<string>();
  private confirmed = false;
  private filter = 'eligible';
  private page = 0;
  private busy = false;
  private closed = false;
  private error = '';
  private restore = document.activeElement as HTMLElement | null;
  constructor(
    private getProject: () => Project,
    private onApply: (project: Project) => void,
  ) {}
  show() {
    if (document.getElementById('articleSyncDialog')) return;
    this.el.id = 'articleSyncDialog';
    this.el.className = 'modal-backdrop';
    this.el.style.cssText =
      'position:fixed;inset:0;z-index:4000;background:#0009;display:flex;align-items:center;justify-content:center;padding:16px';
    document.body.append(this.el);
    this.el.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape' && !this.busy) this.close();
      if (e.key === 'Tab') {
        const all = [
          ...this.el.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),summary',
          ),
        ].filter((e) => e.getClientRects().length);
        if (e.shiftKey && document.activeElement === all[0]) {
          e.preventDefault();
          all.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === all.at(-1)) {
          e.preventDefault();
          all[0]?.focus();
        }
      }
    });
    this.render();
    this.el.querySelector<HTMLButtonElement>('[data-load]')?.focus();
  }
  private close() {
    this.closed = true;
    this.el.remove();
    if (this.restore?.isConnected) this.restore.focus();
  }
  private visible() {
    return (this.plan?.rows ?? []).filter(
      (r) =>
        this.filter === 'all' ||
        (this.filter === 'eligible' && isArticleSyncSelectable(r)) ||
        (this.filter === 'conflicts' && conflicts(r)) ||
        (this.filter === 'skipped' &&
          !isArticleSyncSelectable(r) &&
          !conflicts(r)),
    );
  }
  private async work(action: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.render();
    try {
      await action();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.error = errors.includes(message as TranslationKey)
        ? t(message as TranslationKey)
        : message;
    } finally {
      this.busy = false;
      if (!this.closed) {
        this.render();
        this.el.querySelector<HTMLElement>('[data-error]')?.focus();
      }
    }
  }
  private async compare() {
    this.plan = await ArticleSyncPlan.create(this.getProject(), this.source!);
    this.selected = new Set(
      this.plan.rows.filter(isArticleSyncSelectable).map((r) => r.id),
    );
    this.confirmed = false;
    this.page = 0;
  }
  private render() {
    const focused = document.activeElement as HTMLElement | null,
      focusRow = focused?.dataset.row,
      focusControl =
        focused && this.el.contains(focused)
          ? [
              'filter',
              'all',
              'clear',
              'prev',
              'next',
              'confirm',
              'load',
              'compare',
            ].find((k) => focused.hasAttribute('data-' + k))
          : undefined;
    const rows = this.visible(),
      pages = Math.max(1, Math.ceil(rows.length / 50));
    this.page = Math.min(this.page, pages - 1);
    const eligible =
        this.plan?.rows.filter(isArticleSyncSelectable).length ?? 0,
      problemCount = this.plan?.rows.filter(conflicts).length ?? 0;
    const needsConfirmation = this.plan?.rows.some(
      (r) => this.selected.has(r.id) && r.needsSourceConfirmation,
    );
    const value = (v: ArticleSyncRow['current']) =>
      `${esc(v.number || '—')}<br><small>${esc(v.manufacturer ?? '')}</small>${v.items.length ? importedArticleFields({ articleReferences: v.items }) : `<small>${t('articleSyncRefs', { count: 0 })}</small>`}`;
    this.el.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="articleSyncTitle" style="width:min(1100px,100%);max-height:92vh;overflow:auto;background:var(--bg-primary,#17202d);color:var(--text-primary,#eee);border:1px solid #526170;border-radius:8px;padding:20px">
   <h2 id="articleSyncTitle">${t('menuSyncArticles')}</h2><p>${t('articleSyncHint')}</p>
   <div style="display:flex;gap:8px"><button class="btn" data-load>${t('articleSyncLoad')}</button>${this.source ? `<button class="btn" data-compare>${t('articleSyncCompare')}</button>` : ''}</div><input type="file" multiple data-file hidden>
   <p role="status">${this.busy ? t('articleSyncLoading') : this.plan ? `${t('articleSyncSource')}: ${esc(this.plan.sourceName)}<br><small style="overflow-wrap:anywhere">SHA-256: ${esc(this.plan.sourceDigest)}</small>` : t('articleSyncEmpty')}</p>
   <div role="alert" tabindex="-1" data-error style="color:#fca5a5">${esc(this.error)}</div>
   ${
     this.plan
       ? `<p>${t('articleSyncCounts', { total: this.plan.rows.length, eligible, conflicts: problemCount })}</p>
   <div style="display:flex;gap:8px;flex-wrap:wrap"><select data-filter aria-label="${t('articleSyncAll')}">${(['eligible', 'conflicts', 'skipped', 'all'] as const).map((f, i) => `<option value="${f}" ${this.filter === f ? 'selected' : ''}>${t((['articleSyncEligible', 'articleSyncConflicts', 'articleSyncSkipped', 'articleSyncAll'] as const)[i])}</option>`).join('')}</select><button class="btn" data-all>${t('articleSyncSelectAll')}</button><button class="btn" data-clear>${t('articleSyncClear')}</button><span data-count>${t('articleSyncSelected', { count: this.selected.size })}</span></div>
   <div style="overflow:auto;margin-top:12px;max-height:42vh"><table style="width:100%;border-collapse:collapse;text-align:left"><thead><tr><th></th><th>BMK / ${t('articleSyncSource')}</th><th>${t('articleSyncCurrent')}</th><th>${t('articleSyncSource')}</th><th>Status</th></tr></thead><tbody>${
     rows
       .slice(this.page * 50, this.page * 50 + 50)
       .map(
         (r) =>
           `<tr style="border-top:1px solid #526170"><td><input type="checkbox" data-row="${esc(r.id)}" aria-label="${esc(r.bmk || r.componentId)}" ${this.selected.has(r.id) ? 'checked' : ''} ${isArticleSyncSelectable(r) ? '' : 'disabled'}></td><td>${esc(r.bmk || r.componentId)}<br><small>${esc(r.pageNumber)}</small></td><td>${value(r.current)}</td><td>${value(r.incoming)}</td><td>${t(statusKeys[r.status])}${r.reasons.length ? `<br><small>${r.reasons.map((x) => esc(reasonKeys[x] ? t(reasonKeys[x]) : x)).join(', ')}</small>` : ''}</td></tr>`,
       )
       .join('') || `<tr><td colspan="5">${t('articleSyncNoRows')}</td></tr>`
   }</tbody></table></div>
   <div style="display:flex;gap:12px;margin:12px 0"><button class="btn" data-prev ${this.page ? '' : 'disabled'}>←</button><span>${t('articleSyncPage', { current: this.page + 1, total: pages })}</span><button class="btn" data-next ${this.page < pages - 1 ? '' : 'disabled'}>→</button></div>
   ${needsConfirmation ? `<label style="display:flex;gap:10px;margin:12px 0"><input type="checkbox" data-confirm ${this.confirmed ? 'checked' : ''}><span>${t('articleSyncConfirm')}</span></label>` : ''}`
       : ''
   }
   <footer style="display:flex;gap:12px;justify-content:flex-end;margin-top:16px"><button class="btn" data-close>${t('close')}</button><button class="btn" data-apply ${!this.plan || !this.selected.size || (needsConfirmation && !this.confirmed) ? 'disabled' : ''}>${t('articleSyncApply')}</button></footer></section>`;
    this.el
      .querySelector('[data-close]')
      ?.addEventListener('click', () => this.close());
    const file = this.el.querySelector<HTMLInputElement>('[data-file]')!;
    this.el
      .querySelector('[data-load]')
      ?.addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const files = [...(file.files ?? [])];
      if (files.length)
        void this.work(async () => {
          this.plan = undefined;
          this.source = undefined;
          this.selected.clear();
          const result = await PackageHandler.inspectFiles(files);
          if (!result.extractedProject) throw new Error('articleSyncNoProject');
          this.source = result.extractedProject;
          this.plan = undefined;
          this.selected.clear();
          await this.compare();
        });
    });
    this.el
      .querySelector('[data-compare]')
      ?.addEventListener('click', () => void this.work(() => this.compare()));
    this.el
      .querySelector<HTMLSelectElement>('[data-filter]')
      ?.addEventListener('change', (e) => {
        this.filter = (e.target as HTMLSelectElement).value;
        this.page = 0;
        this.render();
      });
    this.el.querySelector('[data-all]')?.addEventListener('click', () => {
      this.visible()
        .filter(isArticleSyncSelectable)
        .forEach((r) => this.selected.add(r.id));
      this.render();
    });
    this.el.querySelector('[data-clear]')?.addEventListener('click', () => {
      this.selected.clear();
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
    for (const input of this.el.querySelectorAll<HTMLInputElement>(
      '[data-row]',
    ))
      input.addEventListener('change', () => {
        input.checked
          ? this.selected.add(input.dataset.row!)
          : this.selected.delete(input.dataset.row!);
        this.render();
      });
    this.el
      .querySelector<HTMLInputElement>('[data-confirm]')
      ?.addEventListener('change', (e) => {
        this.confirmed = (e.target as HTMLInputElement).checked;
        this.render();
        this.el.querySelector<HTMLButtonElement>('[data-apply]')?.focus();
      });
    this.el.querySelector('[data-apply]')?.addEventListener(
      'click',
      () =>
        void this.work(async () => {
          const current = this.getProject(),
            revision = projectRevision(current);
          const next = await this.plan!.apply(
            current,
            [...this.selected],
            this.confirmed,
          );
          if (this.closed) return;
          if (
            this.getProject() !== current ||
            projectRevision(current) !== revision
          )
            throw new Error('articleSyncStale');
          next.activePageId = current.activePageId;
          this.onApply(next);
          this.close();
        }),
    );
    if (!this.busy) {
      const control = focusRow
        ? [...this.el.querySelectorAll<HTMLInputElement>('[data-row]')].find(
            (i) => i.dataset.row === focusRow,
          )
        : focusControl
          ? this.el.querySelector<HTMLElement>('[data-' + focusControl + ']')
          : undefined;
      control?.focus();
    }
    if (this.busy)
      for (const control of this.el.querySelectorAll<
        HTMLInputElement | HTMLButtonElement | HTMLSelectElement
      >('button,input,select'))
        control.disabled = true;
    finishEngineeringDialog(this.el, {kind:'review',description:t('engineeringSyncHint'),wide:true});
  }
}
