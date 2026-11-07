import { finishEngineeringDialog } from './EngineeringDialog';
import type { Project } from '../model/types';
import type { ComponentAddress } from '../model/ArticleTypes';
import { ArticleFunctionPlan } from '../model/ArticleFunctions';
import { addressKey } from '../model/DeviceRegistry';
import { bindArticleModalKeys, focusArticleModal } from './ArticleModal';
import { articleError } from './ArticleCatalogDialog';
import { escapeSvg as esc } from '../model/ImportedDrawing';
import { t } from '../i18n';
export class ArticleFunctionDialog {
  private el = document.createElement('div');
  private plan: ArticleFunctionPlan;
  private pageLabels: Map<string, string>;
  private choices = new Map<string, string>();
  private sameFunction = new Map<string, ComponentAddress>();
  private confirmType = false;
  private replace = false;
  private error = '';
  private page = 0;
  constructor(
    private getProject: () => Project,
    private onApply: (p: Project) => void,
    targets: ComponentAddress[],
  ) {
    const project = getProject();
    this.plan = new ArticleFunctionPlan(project, targets);
    this.pageLabels = new Map(project.pages.map((p) => [p.id, p.pageNumber]));
    for (const row of this.plan.rows)
      if (row.sameFunctionAs)
        this.sameFunction.set(addressKey(row.address), row.sameFunctionAs);
  }
  show() {
    this.el.id = 'articleFunctionDialog';
    this.el.className = 'modal-backdrop';
    this.el.style.cssText =
      'position:fixed;inset:0;z-index:4500;background:#000b;display:flex;align-items:center;justify-content:center;padding:16px';
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => this.el.remove());
    this.render();
  }
  private render() {
    const rows = this.plan.rows,
      pages = Math.max(1, Math.ceil(rows.length / 40)),
      selected = rows.filter((r) => this.choices.has(addressKey(r.address))),
      needsType = selected.some(
        (r) =>
          r.candidates.find(
            (c) => c.id === this.choices.get(addressKey(r.address)),
          )?.needsTypeConfirmation,
      ),
      needsReplace = selected.some(
        (r) =>
          r.current && r.current !== this.choices.get(addressKey(r.address)),
      );
    this.el.innerHTML = `<style>#articleFunctionDialog h2{margin:0 0 8px}#articleFunctionDialog p{margin:8px 0 12px;line-height:1.4}#articleFunctionDialog table{border-collapse:collapse;font-size:13px}#articleFunctionDialog td,#articleFunctionDialog th{padding:8px;vertical-align:top;border-bottom:1px solid #334155}#articleFunctionDialog th{color:#a7c4df}#articleFunctionDialog select{background:#101923;color:#eee;border:1px solid #526170;border-radius:4px;padding:5px;max-width:100%}#articleFunctionDialog fieldset{border:1px solid #526170;border-radius:5px;padding:12px;margin:12px 0}#articleFunctionDialog small{display:block;margin-top:5px;color:#b4c5d6}#articleFunctionDialog .potential-field{display:flex;flex-direction:column;gap:4px;flex:1;min-width:170px}</style><section role="dialog" aria-modal="true" style="background:#17202d;color:#eee;border:1px solid #526170;border-radius:8px;padding:20px;width:min(1100px,100%);max-height:92vh;overflow:auto"><h2>${t('functionSuggestions')}</h2><p>${t('functionSuggestionHint')}</p><div role="alert" style="color:#fca5a5">${esc(this.error)}</div><div style="max-height:55vh;overflow:auto"><table style="width:100%;text-align:left"><tr><th>BMK</th><th>${t('articlesNumber')}</th><th>${t('articlesBefore')}</th><th>${t('articlesAfter')}</th><th>${t('functionSameAs')}</th></tr>${rows
      .slice(this.page * 40, this.page * 40 + 40)
      .map(
        (r, i) =>
          `<tr><td>${esc(r.bmk)} · ${esc(this.pageLabels.get(r.address.pageId) ?? r.address.pageId)}</td><td>${esc(r.article)}</td><td>${esc(r.actualType ?? '?')} · ${esc(r.actualPins.join(', '))}<br>${esc(r.current ?? '—')}</td><td>${r.candidates.length ? `<select data-choice="${i + this.page * 40}"><option value="">—</option>${r.candidates.map((c) => `<option value="${esc(c.id)}" ${this.choices.get(addressKey(r.address)) === c.id ? 'selected' : ''}>${esc(c.id + ' · ' + c.type + ' · ' + c.pins.join(', '))}</option>`).join('')}</select>${r.candidates.some((c) => c.unverified) ? `<small>${t('functionUnverified')}</small>` : ''}` : t('functionNoData')}</td><td>${r.devicePeers.length ? `<select data-same-function="${i + this.page * 40}"><option value="">${t('functionSeparate')}</option>${r.devicePeers.map((peer) => `<option value="${esc(addressKey(peer.address))}" ${this.sameFunction.get(addressKey(r.address)) && addressKey(this.sameFunction.get(addressKey(r.address))!) === addressKey(peer.address) ? 'selected' : ''}>${esc(peer.pageNumber + ' · ' + peer.bmk + ' · ' + peer.address.componentId)}</option>`).join('')}</select>` : '—'}</td></tr>`,
      )
      .join(
        '',
      )}</table></div><div style="display:flex;gap:10px"><button class="btn" data-prev ${this.page ? '' : 'disabled'}>←</button>${this.page + 1} / ${pages}<button class="btn" data-next ${this.page < pages - 1 ? '' : 'disabled'}>→</button></div>${needsType ? `<label style="display:block"><input type="checkbox" data-type ${this.confirmType ? 'checked' : ''}> ${t('functionConfirmType')}</label>` : ''}${needsReplace ? `<label style="display:block"><input type="checkbox" data-replace ${this.replace ? 'checked' : ''}> ${t('repairOverwriteConfirm')}</label>` : ''}<footer style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button class="btn" data-close>${t('close')}</button><button class="btn" data-apply ${!selected.length || (needsType && !this.confirmType) || (needsReplace && !this.replace) ? 'disabled' : ''}>${t('articlesApply')}</button></footer></section>`;
    for (const input of this.el.querySelectorAll<HTMLSelectElement>(
      '[data-choice]',
    ))
      input.addEventListener('change', () => {
        this.error = '';
        const key = addressKey(rows[Number(input.dataset.choice)].address);
        input.value
          ? this.choices.set(key, input.value)
          : this.choices.delete(key);
        this.render();
      });
    for (const input of this.el.querySelectorAll<HTMLSelectElement>(
      '[data-same-function]',
    ))
      input.addEventListener('change', () => {
        const row = rows[Number(input.dataset.sameFunction)],
          key = addressKey(row.address),
          peer = row.devicePeers.find(
            (p) => addressKey(p.address) === input.value,
          );
        if (peer) this.sameFunction.set(key, peer.address);
        else this.sameFunction.delete(key);
        this.error = '';
        this.render();
      });
    for (const [attr, key] of [
      ['type', 'confirmType'],
      ['replace', 'replace'],
    ] as const)
      this.el
        .querySelector<HTMLInputElement>('[data-' + attr + ']')
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
        const choices = rows
          .filter((r) => this.choices.has(addressKey(r.address)))
          .map((r) => ({
            address: r.address,
            functionId: this.choices.get(addressKey(r.address))!,
            sameFunctionAs: this.sameFunction.get(addressKey(r.address)),
          }));
        this.onApply(
          this.plan.apply(
            this.getProject(),
            choices,
            this.confirmType,
            this.replace,
          ),
        );
        this.el.remove();
      } catch (e) {
        this.error = articleError(e);
        this.render();
      }
    });
    finishEngineeringDialog(this.el, { kind: 'review', description: t('engineeringFunctionsHint'), wide: false });
    focusArticleModal(this.el);
  }
}
