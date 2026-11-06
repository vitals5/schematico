import {ArticleFunctionDialog} from './ArticleFunctionDialog';
import { ProjectIndex } from '../model/ProjectIndex';
import { articleDataContext } from '../model/ArticleDataAnalysis';
import { bindArticleModalKeys, focusArticleModal } from './ArticleModal';
import type { AssignedArticle, ComponentAddress } from '../model/ArticleTypes';
import type { Project } from '../model/types';
import {
  DeviceRegistry,
  addressKey,
  componentAddress,
  designationContext,
} from '../model/DeviceRegistry';
import { effectiveArticles } from '../model/ArticleAssignments';
import { ArticleEditPlan, type ArticleEdit } from '../model/ArticleEdit';
import { projectRevision } from '../layout/types';
import { ArticleCatalogDialog, articleError } from './ArticleCatalogDialog';
import { importedArticleFields } from './ImportedArticleFields';
import { escapeSvg as esc } from '../model/ImportedDrawing';
import { t, type TranslationKey } from '../i18n';
export class ArticleWorkbenchDialog {
  private el = document.createElement('div');
  private snapshot: Project;
  private base: string;
  private registry: DeviceRegistry;
  private articleStates = new Map<string, string>();
  private selected = new Set<string>();
  private items: AssignedArticle[] = [];
  private page = 0;
  private search = '';
  private missing = false;
  private selectionOnly = false;
  private main = '';
  private functionId = '';
  private functionType = '';
  private error = '';
  private preview?: ArticleEditPlan;
  private previewKind?: ArticleEdit['kind'];
  private confirmed = false;
  private restore = document.activeElement as HTMLElement | null;
  constructor(
    private getProject: () => Project,
    private onApply: (project: Project) => void,
    initial: ComponentAddress[] = [],
    private onNavigate?: (address: ComponentAddress) => void,
  ) {
    this.snapshot = structuredClone(getProject());
    this.base = projectRevision(this.snapshot);
    const index = new ProjectIndex(this.snapshot);
    this.registry = index.devices;
    for (const entry of index.components)
      this.articleStates.set(
        addressKey(componentAddress(entry.page, entry.component)),
        articleDataContext(entry, index).state,
      );
    for (const a of initial)
      if (this.registry.placement(a)) this.selected.add(addressKey(a));
    if (this.selected.size === 1)
      this.items = effectiveArticles(
        this.registry.placement(this.addresses()[0])!.component,
        this.snapshot,
      );
  }
  show() {
    if (document.getElementById('articleWorkbenchDialog')) return;
    this.el.id = 'articleWorkbenchDialog';
    this.el.className = 'modal-backdrop';
    this.el.style.cssText =
      'position:fixed;inset:0;z-index:4200;background:#000a;display:flex;align-items:center;justify-content:center;padding:12px';
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => this.close());
    this.render();
    this.el.querySelector<HTMLInputElement>('[data-search]')?.focus();
  }
  private close() {
    this.el.remove();
    if (this.restore?.isConnected) this.restore.focus();
  }
  private addresses() {
    return this.snapshot.pages
      .flatMap((p) => p.components.map((c) => componentAddress(p, c)))
      .filter((a) => this.selected.has(addressKey(a)));
  }
  private invalidate() {
    this.preview = undefined;
    this.confirmed = false;
  }
  private rows() {
    return this.snapshot.pages.flatMap((page) =>
      page.components.map((c) => ({
        page,
        c,
        address: componentAddress(page, c),
      })),
    );
  }
  private visible() {
    return this.rows().filter(
      (e) =>
        (!this.selectionOnly || this.selected.has(addressKey(e.address))) &&
        (!this.missing ||
          !['assigned', 'inherited', 'not_applicable'].includes(
            this.articleStates.get(addressKey(e.address)) ?? '',
          )) &&
        [
          e.c.bmk,
          e.page.pageNumber,
          e.page.title,
          ...JSON.parse(designationContext(e.page, e.c)),
          ...effectiveArticles(e.c, this.snapshot).flatMap((a) => [
            a.articleNumber,
            a.manufacturer,
          ]),
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(this.search.toLocaleLowerCase()),
    );
  }
  private prepare(edit: ArticleEdit) {
    try {
      if (projectRevision(this.getProject()) !== this.base)
        throw new Error('articlesProjectStale');
      this.preview = new ArticleEditPlan(this.snapshot, edit);
      this.previewKind = edit.kind;
      this.confirmed = false;
      this.error = '';
    } catch (e) {
      this.preview = undefined;
      this.error = articleError(e);
    }
    this.render();
  }
  private load(source = false) {
    try {
      const addresses = this.addresses();
      if (addresses.length !== 1) throw new Error('articlesOneRequired');
      const c = structuredClone(
        this.registry.placement(addresses[0])!.component,
      );
      if (source) {
        delete c.articleAssignment;
        c.articleNumber = c.articleImport?.observedArticleNumber;
        c.manufacturer = c.articleReferences?.find(
          (r) => r.articleNumber === c.articleNumber,
        )?.manufacturer;
      }
      this.items = effectiveArticles(c, this.snapshot);
      this.functionId = c.articleFunctionId ?? '';
      this.functionType = c.articleFunctionType ?? '';
      this.invalidate();
      this.error = '';
    } catch (e) {
      this.error = articleError(e);
    }
    this.render();
  }
  private render() {
    const deviceOpen = this.el.querySelector<HTMLDetailsElement>(
      '[data-device-details]',
    )?.open;
    const rows = this.visible(),
      pages = Math.max(1, Math.ceil(rows.length / 50));
    this.page = Math.min(this.page, pages - 1);
    const visible = rows.slice(this.page * 50, this.page * 50 + 50),
      addresses = this.addresses(),
      single =
        addresses.length === 1
          ? this.registry.placement(addresses[0])
          : undefined;
    const changeText = (items: AssignedArticle[]) =>
      items
        .map(
          (a) =>
            `${a.manufacturer} ${a.articleNumber} [${a.variant}] × ${a.quantity ?? '?'} (${t(a.role === 'main' ? 'articlesMain' : 'articlesAccessory')})`,
        )
        .join('\n') || '—';
    const replaces =
      this.previewKind === 'link' ||
      this.preview?.changes.some(
        (c) =>
          c.before.length &&
          JSON.stringify(c.before) !== JSON.stringify(c.after),
      );
    const compatible = (status: string) =>
      t(
        status === 'compatible'
          ? 'articlesCompatible'
          : status === 'incompatible'
            ? 'articlesIncompatible'
            : status === 'unassigned'
              ? 'articlesUnassigned'
              : 'articlesSpecificationUnknown',
      );
    this.el.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="articleWorkbenchTitle" style="width:min(1250px,100%);max-height:94vh;overflow:auto;background:#17202d;color:#eee;padding:18px;border:1px solid #526170;border-radius:8px"><style>#articleWorkbenchDialog td,#articleWorkbenchDialog th{padding:5px 7px;vertical-align:top}#articleWorkbenchDialog fieldset{border:1px solid #526170;border-radius:5px;padding:10px}#articleWorkbenchDialog summary{cursor:pointer}#articleWorkbenchDialog p{margin:8px 0}</style><h2 id="articleWorkbenchTitle">${t('articlesManage')}</h2><div role="alert" data-error style="color:#fca5a5">${esc(this.error)}</div><div style="display:flex;gap:8px;flex-wrap:wrap"><input data-search class="form-input" style="flex:1;min-width:180px" placeholder="${t('articlesSearch')}" value="${esc(this.search)}"><label><input type="checkbox" data-missing ${this.missing ? 'checked' : ''}> ${t('articlesMissingOnly')}</label><label><input type="checkbox" data-selected-only ${this.selectionOnly ? 'checked' : ''}> ${t('articlesSelectionOnly')}</label><button class="btn" data-all>${t('articlesSelectVisible')}</button><button class="btn" data-clear>${t('articlesClearSelection')}</button><span>${t('articlesSelected', { count: this.selected.size })}</span><button class="btn" data-functions>${t('functionSuggestions')}</button><button class="btn" data-catalog>${t('articlesCatalog')}</button></div>
 <div style="max-height:23vh;overflow:auto;margin:8px 0"><table style="width:100%;text-align:left;font-size:12px"><thead><tr><th></th><th>BMK</th><th>${t('reviewPage')}</th><th>${t('articlesItems')}</th><th>${t('articlesDeviceMain')}</th><th></th></tr></thead><tbody>${visible
   .map((e, i) => {
     const d = this.registry.forComponent(e.address);
     return `<tr style="border-top:1px solid #526170"><td><input type="checkbox" data-target="${i}" aria-label="${esc(e.c.bmk || e.c.id)}" ${this.selected.has(addressKey(e.address)) ? 'checked' : ''}></td><td>${esc(JSON.parse(designationContext(e.page, e.c)).join(' '))}</td><td>${esc(e.page.pageNumber + ' · ' + e.page.title)}</td><td style="white-space:pre-wrap">${esc(changeText(effectiveArticles(e.c, this.snapshot)))}</td><td>${d ? esc(this.registry.placement(d.main)?.component.bmk ?? d.id) : '—'}</td><td>${this.onNavigate ? `<button class="btn" data-go="${i}">${t('articlesNavigate')}</button>` : ''}</td></tr>`;
   })
   .join(
     '',
   )}</tbody></table></div><div style="display:flex;gap:10px;align-items:center"><button class="btn" data-prev ${this.page ? '' : 'disabled'}>←</button> ${this.page + 1} / ${pages} <button class="btn" data-next ${this.page < pages - 1 ? '' : 'disabled'}>→</button></div>
 <fieldset style="margin:12px 0"><legend>${t('articlesItems')}</legend><p style="font-size:12px">${t('articlesItemHint')}</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-load-current>${t('articlesLoadCurrent')}</button><button class="btn" data-load-source>${t('articlesLoadSource')}</button><button class="btn" data-add>${t('articlesAdd')}</button><button class="btn" data-add-catalog>${t('articlesAddCatalog')}</button></div>
 <div style="max-height:22vh;overflow:auto"><table style="width:100%;text-align:left"><tr>${['articlesNumber', 'articlesManufacturer', 'articlesVariant', 'articlesQuantity', 'articlesRole'].map((k) => `<th>${t(k as any)}</th>`).join('')}<th></th></tr>${this.items.map((a, i) => `<tr>${(['articleNumber', 'manufacturer', 'variant'] as const).map((k) => `<td><input class="form-input" data-item="${i}" data-key="${k}" value="${esc(a[k])}"></td>`).join('')}<td><input class="form-input" style="width:85px" data-item="${i}" data-key="quantity" value="${a.quantity ?? '?'}"></td><td><select data-item="${i}" data-key="role"><option value="main" ${a.role === 'main' ? 'selected' : ''}>${t('articlesMain')}</option><option value="accessory" ${a.role === 'accessory' ? 'selected' : ''}>${t('articlesAccessory')}</option></select></td><td><button class="btn" data-remove="${i}">${t('articlesRemove')}</button></td></tr>`).join('')}</table></div><button class="btn" data-preview>${t('articlesPreview')}</button></fieldset>
 ${single ? `<details><summary>${t('articlesSourceEvidence')}</summary>${importedArticleFields(single.component)}</details>` : ''}
 <details data-device-details ${deviceOpen ? 'open' : ''} style="margin:10px 0"><summary>${t('articlesDevice')}</summary><p>${t('articlesDeviceHint')}</p><label>${t('articlesDeviceMain')}<select data-main>${addresses.map((a) => `<option value="${esc(addressKey(a))}" ${this.main === addressKey(a) ? 'selected' : ''}>${esc(this.registry.placement(a)!.component.bmk + ' · ' + this.registry.placement(a)!.page.pageNumber + ' · ' + a.componentId)}</option>`).join('')}</select></label><button class="btn" data-link>${t('articlesDeviceLink')}</button><button class="btn" data-unlink>${t('articlesDeviceUnlink')}</button><ul>${this.registry.issues.map((i) => `<li>${esc(i.deviceId)}: ${esc(i.code)}</li>`).join('')}</ul><p>${t('articlesFunctionHelp')}</p><label>${t('articlesFunctionId')}<input class="form-input" data-function-id value="${esc(this.functionId)}"></label><label>${t('articlesFunctionType')}<input class="form-input" data-function-type value="${esc(this.functionType)}"></label><button class="btn" data-map>${t('articlesMapFunction')}</button></details>
 ${this.preview ? `<fieldset data-preview-result><legend>${t('articlesPreview')}</legend><p>${t(this.previewKind === 'link' ? 'articlesDeviceLink' : this.previewKind === 'unlink' ? 'articlesDeviceUnlink' : this.previewKind === 'function' ? 'articlesMapFunction' : 'articlesItems')}</p><div style="max-height:25vh;overflow:auto"><table style="width:100%;text-align:left"><tr><th>BMK</th><th>${t('articlesBefore')}</th><th>${t('articlesAfter')}</th><th>Status</th></tr>${this.preview.changes.map((c) => `<tr><td>${esc(this.registry.placement(c.address)?.component.bmk ?? c.address.componentId)}</td><td style="white-space:pre-wrap">${esc(changeText(c.before))}</td><td style="white-space:pre-wrap">${esc(changeText(c.after))}</td><td>${compatible(c.compatibility.status)}<ul>${c.compatibility.issues.map((i) => `<li>${esc(t(('articlesIssue_' + i.code) as TranslationKey))} · ${esc(i.componentId)} ${esc(i.expected ?? '')} → ${esc(i.actual ?? '')}</li>`).join('')}</ul></td></tr>`).join('')}</table></div>${replaces ? `<label><input type="checkbox" data-confirm ${this.confirmed ? 'checked' : ''}> ${t(this.previewKind === 'link' ? 'articlesConfirmIdentity' : 'articlesReplace')}</label>` : ''}</fieldset>` : ''}
 <footer style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px"><button class="btn" data-close>${t('close')}</button><button class="btn" data-apply ${!this.preview || (replaces && !this.confirmed) ? 'disabled' : ''}>${t('articlesApply')}</button></footer></section>`;
    this.el
      .querySelector('[data-close]')
      ?.addEventListener('click', () => this.close());
    this.el
      .querySelector('[data-catalog]')
      ?.addEventListener('click', () =>
        new ArticleCatalogDialog(this.snapshot).show(),
      );
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
    for (const [attr, key] of [
      ['data-missing', 'missing'],
      ['data-selected-only', 'selectionOnly'],
    ] as const)
      this.el
        .querySelector<HTMLInputElement>('[' + attr + ']')
        ?.addEventListener('change', (e) => {
          this[key] = (e.target as HTMLInputElement).checked;
          this.page = 0;
          this.render();
        });
    for (const input of this.el.querySelectorAll<HTMLInputElement>(
      '[data-target]',
    ))
      input.addEventListener('change', () => {
        const key = addressKey(visible[Number(input.dataset.target)].address);
        input.checked ? this.selected.add(key) : this.selected.delete(key);
        this.invalidate();
        this.render();
      });
    this.el.querySelector('[data-all]')?.addEventListener('click', () => {
      visible.forEach((e) => this.selected.add(addressKey(e.address)));
      this.invalidate();
      this.render();
    });
    this.el.querySelector('[data-clear]')?.addEventListener('click', () => {
      this.selected.clear();
      this.invalidate();
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
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-go]'))
      b.addEventListener('click', () => {
        this.onNavigate?.(visible[Number(b.dataset.go)].address);
        this.close();
      });
    this.el
      .querySelector('[data-load-current]')
      ?.addEventListener('click', () => this.load());
    this.el
      .querySelector('[data-load-source]')
      ?.addEventListener('click', () => this.load(true));
    this.el.querySelector('[data-add]')?.addEventListener('click', () => {
      this.items.push({
        articleNumber: '',
        manufacturer: '',
        variant: '',
        quantity: 1,
        role: this.items.length ? 'accessory' : 'main',
      });
      this.invalidate();
      this.render();
    });
    this.el.querySelector('[data-add-catalog]')?.addEventListener('click', () =>
      new ArticleCatalogDialog(this.snapshot, (a) => {
        this.items.push({
          articleNumber: a.articleNumber,
          manufacturer: a.manufacturer,
          variant: a.variant,
          quantity: 1,
          role: this.items.length ? 'accessory' : 'main',
          snapshot: structuredClone(a),
        });
        this.invalidate();
        this.render();
      }).show(),
    );
    for (const input of this.el.querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >('[data-item]'))
      input.addEventListener('input', () => {
        const item = this.items[Number(input.dataset.item)],
          key = input.dataset.key!;
        (item as any)[key] =
          key === 'quantity'
            ? input.value.trim() === '?' || !input.value.trim()
              ? undefined
              : Number(input.value)
            : input.value;
        this.invalidate();
        const button = this.el.querySelector<HTMLButtonElement>('[data-apply]');
        if (button) button.disabled = true;
        this.el.querySelector('[data-preview-result]')?.remove();
      });
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-remove]'))
      b.addEventListener('click', () => {
        this.items.splice(Number(b.dataset.remove), 1);
        this.invalidate();
        this.render();
      });
    this.el.querySelector('[data-preview]')?.addEventListener('click', () =>
      this.prepare({
        kind: 'assign',
        targets: this.addresses(),
        items: this.items,
      }),
    );
    this.el
      .querySelector<HTMLSelectElement>('[data-main]')
      ?.addEventListener('change', (e) => {
        this.main = (e.target as HTMLSelectElement).value;
        this.invalidate();
        this.render();
      });
    this.el.querySelector('[data-link]')?.addEventListener('click', () => {
      const value =
        this.el.querySelector<HTMLSelectElement>('[data-main]')!.value;
      this.prepare({
        kind: 'link',
        targets: this.addresses(),
        main: JSON.parse(value || 'null')
          ? { pageId: JSON.parse(value)[0], componentId: JSON.parse(value)[1] }
          : { pageId: '', componentId: '' },
      });
    });
    this.el.querySelector('[data-unlink]')?.addEventListener('click', () =>
      this.prepare({
        kind: 'unlink',
        deviceIds: (this.snapshot.physicalDevices ?? [])
          .filter((d) =>
            d.members.some((a) => this.selected.has(addressKey(a))),
          )
          .map((d) => d.id),
      }),
    );
    for (const [attr, key] of [
      ['data-function-id', 'functionId'],
      ['data-function-type', 'functionType'],
    ] as const)
      this.el
        .querySelector<HTMLInputElement>('[' + attr + ']')
        ?.addEventListener('input', (e) => {
          this[key] = (e.target as HTMLInputElement).value;
          this.invalidate();
          this.el.querySelector<HTMLButtonElement>('[data-apply]')!.disabled =
            true;
          this.el.querySelector('[data-preview-result]')?.remove();
        });
    this.el.querySelector('[data-map]')?.addEventListener('click', () =>
      this.prepare({
        kind: 'function',
        targets: this.addresses(),
        functionId: this.functionId,
        functionType: this.functionType,
      }),
    );
    this.el
      .querySelector<HTMLInputElement>('[data-confirm]')
      ?.addEventListener('change', (e) => {
        this.confirmed = (e.target as HTMLInputElement).checked;
        this.render();
      });
    this.el.querySelector('[data-apply]')?.addEventListener('click', () => {
      try {
        if (!this.preview || (replaces && !this.confirmed))
          throw new Error('articlesPreviewRequired');
        const next = this.preview.apply(this.getProject());
        this.onApply(next);
        this.close();
      } catch (e) {
        this.error = articleError(e);
        this.render();
      }
    });
    this.el.querySelector('[data-functions]')?.addEventListener('click',()=>{try{new ArticleFunctionDialog(this.getProject,p=>{this.onApply(p);this.el.remove();},this.addresses()).show();}catch(e){this.error=articleError(e);this.render();}});
    focusArticleModal(this.el);
  }
}
