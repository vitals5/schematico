import type { Project } from '../model/types';
import { CableRepairPlan } from '../model/CableRepairs';
import { bindArticleModalKeys, focusArticleModal } from './ArticleModal';
import { articleError } from './ArticleCatalogDialog';
import { escapeSvg as esc } from '../model/ImportedDrawing';
import { t, type TranslationKey } from '../i18n';
export class CableRepairDialog {
  private el = document.createElement('div');
  private plan: CableRepairPlan;
  private pageLabels: Map<string, string>;
  private selected = new Set<string>();
  private reserve = false;
  private count = false;
  private overwrite = false;
  private error = '';
  private page = 0;
  constructor(
    private getProject: () => Project,
    private onApply: (p: Project) => void,
  ) {
    const project = getProject();
    this.plan = new CableRepairPlan(project);
    this.pageLabels = new Map(project.pages.map((p) => [p.id, p.pageNumber]));
  }
  show() {
    if (document.getElementById('cableRepairDialog')) return;
    this.el.id = 'cableRepairDialog';
    this.el.className = 'modal-backdrop';
    this.el.style.cssText =
      'position:fixed;inset:0;z-index:4500;background:#000b;display:flex;align-items:center;justify-content:center;padding:16px';
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => this.el.remove());
    this.render();
  }
  private render() {
    const rows = this.plan.rows,
      pages = Math.max(1, Math.ceil(rows.length / 40));
    const chosen = rows.filter((r) => this.selected.has(r.id)),
      needsReserve = chosen.some((r) => r.requiresReserve),
      needsCount = chosen.some((r) => r.requiresCount),
      needsOverwrite = chosen.some((r) => r.requiresOverwrite);
    this.el.innerHTML = `<style>#cableRepairDialog h2{margin:0 0 8px}#cableRepairDialog p{margin:8px 0 12px;line-height:1.4}#cableRepairDialog table{border-collapse:collapse;font-size:13px}#cableRepairDialog td,#cableRepairDialog th{padding:8px;vertical-align:top;border-bottom:1px solid #334155}#cableRepairDialog th{color:#a7c4df}#cableRepairDialog select{background:#101923;color:#eee;border:1px solid #526170;border-radius:4px;padding:5px;max-width:100%}#cableRepairDialog fieldset{border:1px solid #526170;border-radius:5px;padding:12px;margin:12px 0}#cableRepairDialog small{display:block;margin-top:5px;color:#b4c5d6}#cableRepairDialog .potential-field{display:flex;flex-direction:column;gap:4px;flex:1;min-width:170px}</style><section role="dialog" aria-modal="true" style="background:#17202d;color:#eee;border:1px solid #526170;border-radius:8px;padding:20px;width:min(1200px,100%);max-height:92vh;overflow:auto"><h2>${t('repairTitle')}</h2><p>${t('repairIntro')}</p><div role="alert" style="color:#fca5a5">${esc(this.error)}</div><p>${t('articlesSelected', { count: this.selected.size })} / ${rows.length}</p><div style="max-height:55vh;overflow:auto"><table style="width:100%;text-align:left"><tr><th></th><th>${t('reviewPage')}</th><th>BMK</th><th>${t('articlesDescription')}</th><th>${t('articlesBefore')}</th><th>${t('articlesAfter')}</th><th>${t('articleSyncSource')}</th></tr>${rows
      .slice(this.page * 40, this.page * 40 + 40)
      .map(
        (r, i) =>
          `<tr><td><input type="checkbox" data-row="${i + this.page * 40}" ${this.selected.has(r.id) ? 'checked' : ''}></td><td>${esc(this.pageLabels.get(r.pageId) ?? r.pageId)}</td><td>${esc(r.bmk)} · ${esc(r.label)}</td><td>${t(('repair_' + r.kind) as TranslationKey)}</td><td style="white-space:pre-wrap">${esc(JSON.stringify(r.evidence.before) ?? '—')}</td><td style="white-space:pre-wrap">${esc(JSON.stringify(r.evidence.after))}</td><td>${t(('repair_evidence_' + r.evidence.method) as TranslationKey)}${r.evidence.distance !== undefined ? ' · Δ ' + r.evidence.distance.toFixed(3) : ''}<small style="display:block;overflow-wrap:anywhere">${esc(JSON.stringify(r.evidence.endpoints ? { source: r.evidence.source, endpoints: r.evidence.endpoints } : (r.evidence.source ?? '')))}</small></td></tr>`,
      )
      .join(
        '',
      )}</table></div><div style="display:flex;gap:10px"><button class="btn" data-prev ${this.page ? '' : 'disabled'}>←</button>${this.page + 1} / ${pages}<button class="btn" data-next ${this.page < pages - 1 ? '' : 'disabled'}>→</button></div>${needsReserve ? `<label style="display:block"><input type="checkbox" data-reserve ${this.reserve ? 'checked' : ''}> ${t('repairReserveConfirm')}</label>` : ''}${needsCount ? `<label style="display:block"><input type="checkbox" data-count ${this.count ? 'checked' : ''}> ${t('repairCountConfirm')}</label>` : ''}${needsOverwrite ? `<label style="display:block"><input type="checkbox" data-overwrite ${this.overwrite ? 'checked' : ''}> ${t('repairOverwriteConfirm')}</label>` : ''}<footer style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button class="btn" data-close>${t('close')}</button><button class="btn" data-apply ${!chosen.length || (needsReserve && !this.reserve) || (needsCount && !this.count) || (needsOverwrite && !this.overwrite) ? 'disabled' : ''}>${t('articlesApply')}</button></footer></section>`;
    for (const input of this.el.querySelectorAll<HTMLInputElement>(
      '[data-row]',
    ))
      input.addEventListener('change', () => {
        this.error = '';
        const row = rows[Number(input.dataset.row)];
        input.checked
          ? this.selected.add(row.id)
          : this.selected.delete(row.id);
        this.render();
      });
    for (const key of ['reserve', 'count', 'overwrite'] as const)
      this.el
        .querySelector<HTMLInputElement>('[data-' + key + ']')
        ?.addEventListener('change', (e) => {
          this.error = '';
          this[key] = (e.target as HTMLInputElement).checked;
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
    this.el
      .querySelector('[data-close]')
      ?.addEventListener('click', () => this.el.remove());
    this.el.querySelector('[data-apply]')?.addEventListener('click', () => {
      try {
        this.onApply(
          this.plan.apply(this.getProject(), [...this.selected], {
            reserve: this.reserve,
            count: this.count,
            overwrite: this.overwrite,
          }),
        );
        this.el.remove();
      } catch (e) {
        this.error = articleError(e);
        this.render();
      }
    });
    focusArticleModal(this.el);
  }
}
