import { finishEngineeringDialog } from './EngineeringDialog';
import type { Project } from '../model/types';
import {
  PotentialIndex,
  PotentialPlan,
  type PotentialDefinition,
  type PotentialAction,
} from '../model/PotentialDefinitions';
import { ProjectIndex } from '../model/ProjectIndex';
import { bindArticleModalKeys, focusArticleModal } from './ArticleModal';
import { articleError } from './ArticleCatalogDialog';
import { escapeSvg as esc } from '../model/ImportedDrawing';
import { t } from '../i18n';
export class PotentialDialog {
  private el = document.createElement('div');
  private source: Project;
  private index: ProjectIndex;
  private edit?: PotentialDefinition;
  private preview?: PotentialPlan;
  private action?: PotentialAction;
  private replace = false;
  private mode: 'fill' | 'replace' = 'fill';
  private query = '';
  private error = '';
  constructor(
    private getProject: () => Project,
    private onApply: (p: Project) => void,
    id?: string,
  ) {
    this.source = structuredClone(getProject());
    this.index = new ProjectIndex(this.source);
    this.edit = structuredClone(
      this.source.potentialDefinitions?.find((d) => d.id === id),
    );
  }
  show() {
    if (document.getElementById('potentialDialog')) return;
    this.el.id = 'potentialDialog';
    this.el.className = 'modal-backdrop';
    this.el.style.cssText =
      'position:fixed;inset:0;z-index:4300;background:#000a;display:flex;align-items:center;justify-content:center;padding:16px';
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => this.el.remove());
    this.render();
  }
  private invalidate() {
    this.preview = undefined;
    this.replace = false;
  }
  private prepare(action: PotentialAction) {
    try {
      this.preview = new PotentialPlan(this.source, action);
      this.action = action;
      this.replace = false;
      this.error = '';
    } catch (e) {
      this.preview = undefined;
      this.error = articleError(e);
    }
    this.render();
  }
  private render() {
    const profiles = this.source.potentialDefinitions ?? [],
      ports = this.index.components
        .flatMap((e) =>
          this.index.pinsFor(e).map((p) => ({
            value: JSON.stringify([e.page.id, e.component.id, p.id]),
            label: `${e.page.pageNumber} · ${e.tag}:${p.label}`,
            anchor: {
              pageId: e.page.id,
              componentId: e.component.id,
              pinId: p.id,
            },
          })),
        )
        .filter((p) =>
          p.label.toLocaleLowerCase().includes(this.query.toLocaleLowerCase()),
        )
        .slice(0, 200),
      needsReplace = this.preview?.changes.some(
        (c) => c.replaces && !c.skipped,
      );
    const field = (
      key: 'name' | 'plant' | 'location' | 'color' | 'crossSection',
      label: string,
    ) =>
      `<label class="potential-field">${label}<input class="form-input" data-field="${key}" value="${esc(this.edit?.[key] ?? '')}"></label>`;
    this.el.innerHTML = `<style>#potentialDialog h2{margin:0 0 8px}#potentialDialog p{margin:8px 0 12px;line-height:1.4}#potentialDialog table{border-collapse:collapse;font-size:13px}#potentialDialog td,#potentialDialog th{padding:8px;vertical-align:top;border-bottom:1px solid #334155}#potentialDialog th{color:#a7c4df}#potentialDialog select{background:#101923;color:#eee;border:1px solid #526170;border-radius:4px;padding:5px;max-width:100%}#potentialDialog fieldset{border:1px solid #526170;border-radius:5px;padding:12px;margin:12px 0}#potentialDialog small{display:block;margin-top:5px;color:#b4c5d6}#potentialDialog .potential-field{display:flex;flex-direction:column;gap:4px;flex:1;min-width:170px}</style><section role="dialog" aria-modal="true" style="background:#17202d;color:#eee;border:1px solid #526170;border-radius:8px;padding:20px;width:min(1150px,100%);max-height:94vh;overflow:auto"><h2>${t('potentialTitle')}</h2><p>${t('potentialIntro')}</p><div role="alert" style="color:#fca5a5">${esc(this.error)}</div><div style="display:flex;gap:8px"><select class="form-input" data-definition><option value="">—</option>${profiles.map((d) => `<option value="${esc(d.id)}" ${this.edit?.id === d.id ? 'selected' : ''}>${esc(d.name + ' · ' + d.plant + ' · ' + d.location)}</option>`).join('')}</select><button class="btn" data-new>${t('potentialNew')}</button></div>
 ${
   this.edit
     ? `<fieldset style="margin:10px 0"><div style="display:flex;gap:8px;flex-wrap:wrap">${field('name', t('potentialName'))}${field('plant', t('potentialFacility'))}${field('location', t('potentialLocation'))}${field('color', t('wiringColor'))}${field('crossSection', t('wiringCrossSection'))}</div><h3>${t('potentialAnchors')}</h3><input class="form-input" data-search placeholder="${t('articlesSearch')}" value="${esc(this.query)}"><div style="display:flex;gap:8px"><select class="form-input" data-anchor>${ports.map((p, i) => `<option value="${i}">${esc(p.label)}</option>`).join('')}</select><button class="btn" data-add>${t('articlesAdd')}</button></div><ul>${this.edit.anchors
         .map((a, i) => {
           const e =
               this.index.component(a.componentId, a.pageId) ??
               this.index.component(a.componentId),
             p = e && this.index.pin(e, a.pinId);
           return `<li>${esc((e?.page.pageNumber ?? a.pageId) + ' · ' + (e?.tag ?? a.componentId) + ':' + (p?.label ?? a.pinId))} <button class="btn" data-remove="${i}">${t('articlesRemove')}</button></li>`;
         })
         .join(
           '',
         )}</ul><button class="btn" data-save>${t('potentialSave')}</button><button class="btn" data-delete>${t('potentialDelete')}</button><hr><select data-mode><option value="fill" ${this.mode === 'fill' ? 'selected' : ''}>${t('potentialFill')}</option><option value="replace" ${this.mode === 'replace' ? 'selected' : ''}>${t('potentialReplace')}</option></select><button class="btn" data-propagate>${t('potentialPropagate')}</button></fieldset>`
     : ''
 }
 ${this.preview ? `<fieldset data-preview><legend>${t('articlesPreview')}</legend>${this.action?.kind === 'save' ? `<p>${esc(this.edit?.name ?? '')} · ${esc(this.edit?.color ?? '')} · ${esc(this.edit?.crossSection ?? '')} · ${this.edit?.anchors.length ?? 0} ${t('potentialAnchors')}</p>` : this.action?.kind === 'delete' ? `<p>${t('potentialDelete')}: ${esc(this.edit?.name ?? '')}</p>` : ''}<h3>${t('potentialAffected')} (${this.preview.changes.length})</h3><div style="max-height:30vh;overflow:auto"><table style="width:100%;text-align:left"><tr><th>${t('reviewPage')}</th><th>${t('wiringWireIds')}</th><th>${t('articlesDescription')}</th><th>${t('articlesBefore')}</th><th>${t('articlesAfter')}</th><th>Status</th></tr>${this.preview.changes.map((c) => `<tr><td>${esc(this.source.pages.find((p) => p.id === c.pageId)?.pageNumber ?? '')}</td><td>${esc(c.wireId)}</td><td>${t(c.field === 'potential' ? 'potentialName' : c.field === 'color' ? 'wiringColor' : 'wiringCrossSection')}</td><td>${esc(c.before ?? '—')}</td><td>${esc(c.after)}</td><td>${c.skipped ? t('potentialSkipped') : ''}</td></tr>`).join('')}</table></div><ul>${this.preview.findings.map((i) => `<li>${esc(t(i.code))} · ${esc(i.details)}</li>`).join('')}</ul>${needsReplace ? `<label><input type="checkbox" data-confirm ${this.replace ? 'checked' : ''}> ${t('repairOverwriteConfirm')}</label>` : ''}</fieldset>` : ''}
 <footer style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button class="btn" data-close>${t('close')}</button><button class="btn" data-apply ${!this.preview || (needsReplace && !this.replace) ? 'disabled' : ''}>${t('articlesApply')}</button></footer></section>`;
    this.el
      .querySelector('[data-close]')
      ?.addEventListener('click', () => this.el.remove());
    this.el.querySelector('[data-new]')?.addEventListener('click', () => {
      this.edit = {
        id: crypto.randomUUID(),
        name: '',
        plant: '',
        location: '',
        color: '',
        crossSection: '',
        anchors: [],
      };
      this.invalidate();
      this.render();
    });
    this.el
      .querySelector<HTMLSelectElement>('[data-definition]')
      ?.addEventListener('change', (e) => {
        this.edit = structuredClone(
          profiles.find((d) => d.id === (e.target as HTMLSelectElement).value),
        );
        this.invalidate();
        this.render();
      });
    for (const input of this.el.querySelectorAll<HTMLInputElement>(
      '[data-field]',
    ))
      input.addEventListener('input', () => {
        (this.edit as any)[input.dataset.field!] = input.value;
        this.invalidate();
        this.el.querySelector<HTMLButtonElement>('[data-apply]')!.disabled =
          true;
        this.el.querySelector('[data-preview]')?.remove();
      });
    this.el
      .querySelector<HTMLInputElement>('[data-search]')
      ?.addEventListener('input', (e) => {
        this.query = (e.target as HTMLInputElement).value;
        this.render();
        const input = this.el.querySelector<HTMLInputElement>('[data-search]')!;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      });
    this.el.querySelector('[data-add]')?.addEventListener('click', () => {
      const selected =
        ports[
          Number(
            this.el.querySelector<HTMLSelectElement>('[data-anchor]')!.value,
          )
        ];
      if (
        selected &&
        !this.edit!.anchors.some(
          (a) =>
            a.componentId === selected.anchor.componentId &&
            a.pinId === selected.anchor.pinId,
        )
      ) {
        this.edit!.anchors.push(selected.anchor);
        this.invalidate();
        this.render();
      }
    });
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-remove]'))
      b.addEventListener('click', () => {
        this.edit!.anchors.splice(Number(b.dataset.remove), 1);
        this.invalidate();
        this.render();
      });
    this.el
      .querySelector('[data-save]')
      ?.addEventListener('click', () =>
        this.prepare({ kind: 'save', definition: this.edit! }),
      );
    this.el
      .querySelector('[data-delete]')
      ?.addEventListener('click', () =>
        this.prepare({ kind: 'delete', id: this.edit!.id }),
      );
    this.el
      .querySelector<HTMLSelectElement>('[data-mode]')
      ?.addEventListener('change', (e) => {
        this.mode = (e.target as HTMLSelectElement).value as 'fill' | 'replace';
        this.invalidate();
        this.render();
      });
    this.el.querySelector('[data-propagate]')?.addEventListener('click', () => {
      if (
        JSON.stringify(this.edit) !==
        JSON.stringify(profiles.find((p) => p.id === this.edit!.id))
      ) {
        this.error = t('potentialSaveFirst');
        this.render();
        return;
      }
      this.prepare({ kind: 'propagate', id: this.edit!.id, mode: this.mode });
    });
    this.el
      .querySelector<HTMLInputElement>('[data-confirm]')
      ?.addEventListener('change', (e) => {
        this.replace = (e.target as HTMLInputElement).checked;
        this.render();
      });
    this.el.querySelector('[data-apply]')?.addEventListener('click', () => {
      try {
        this.onApply(this.preview!.apply(this.getProject(), this.replace));
        this.el.remove();
      } catch (e) {
        this.error = articleError(e);
        this.render();
      }
    });
    finishEngineeringDialog(this.el, { kind: 'potential', description: t('engineeringPotentialHint'), wide: false });
    focusArticleModal(this.el);
  }
}
