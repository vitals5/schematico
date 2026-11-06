import {
  deviceNavigator,
  DeviceNavigatorPlan,
  type PlannedDevice,
} from '../model/DeviceNavigator';
import { DeviceRegistry, addressKey } from '../model/DeviceRegistry';
import type { Project } from '../model/types';
import type { ComponentAddress } from '../model/ArticleTypes';
import { ArticleCatalogDialog, articleError } from './ArticleCatalogDialog';
import { bindArticleModalKeys, focusArticleModal } from './ArticleModal';
import { escapeSvg as esc } from '../model/ImportedDrawing';
import { t } from '../i18n';
export class DeviceNavigatorDialog {
  private el = document.createElement('div');
  private source: Project;
  private search = '';
  private onlyUnplaced = false;
  private page = 0;
  private edit?: PlannedDevice;
  private preview?: DeviceNavigatorPlan;
  private previewText = '';
  private error = '';
  private registry: DeviceRegistry;
  constructor(
    private getProject: () => Project,
    private onApply: (p: Project) => void,
    private onNavigate: (a: ComponentAddress) => void,
    private onArticles: (a: ComponentAddress[]) => void,
  ) {
    this.source = structuredClone(getProject());
    this.registry = new DeviceRegistry(this.source);
  }
  show() {
    this.el.id = 'deviceNavigatorDialog';
    this.el.className = 'modal-backdrop';
    this.el.style.cssText =
      'position:fixed;inset:0;z-index:4200;background:#000a;display:flex;align-items:center;justify-content:center;padding:16px';
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => this.el.remove());
    this.render();
  }
  private prepare(
    action: ConstructorParameters<typeof DeviceNavigatorPlan>[1],
    text: string,
  ) {
    try {
      this.preview = new DeviceNavigatorPlan(this.source, action);
      this.previewText = text;
      this.error = '';
    } catch (e) {
      this.preview = undefined;
      this.error = articleError(e);
    }
    this.render();
  }
  private render() {
    const rows = deviceNavigator(this.source, this.registry).filter(
        (r) =>
          (!this.onlyUnplaced ||
            r.state === 'unplaced' ||
            r.state === 'missing_placement') &&
          [r.designation, r.description, ...r.items.map((a) => a.articleNumber)]
            .join(' ')
            .toLowerCase()
            .includes(this.search.toLowerCase()),
      ),
      pages = Math.max(1, Math.ceil(rows.length / 50));
    this.page = Math.min(this.page, pages - 1);
    const shown = rows.slice(this.page * 50, this.page * 50 + 50);
    this.el.innerHTML = `<section role="dialog" aria-modal="true" style="background:#17202d;color:#eee;padding:20px;width:min(1150px,100%);max-height:92vh;overflow:auto;border:1px solid #526170;border-radius:8px"><h2>${t('deviceNavigator')}</h2><div role="alert" style="color:#fca5a5">${esc(this.error)}</div><div style="display:flex;gap:8px"><input class="form-input" data-search placeholder="${t('articlesSearch')}" value="${esc(this.search)}"><label><input type="checkbox" data-unplaced ${this.onlyUnplaced ? 'checked' : ''}> ${t('deviceUnplaced')}</label><button class="btn" data-new>${t('deviceNew')}</button></div><div style="max-height:35vh;overflow:auto"><table style="width:100%;text-align:left"><tr><th>BMK</th><th>${t('articlesDescription')}</th><th>${t('articlesItems')}</th><th>Status</th><th></th></tr>${shown.map((r, i) => `<tr><td>${esc(r.designation)}</td><td>${esc(r.description)}</td><td>${r.items.map((a) => `${esc(a.manufacturer)} ${esc(a.articleNumber)} [${esc(a.variant)}] × ${a.quantity ?? '?'} (${esc(a.role)})`).join('<br>')}</td><td>${t(('deviceState_' + r.state) as any)}</td><td>${r.main ? `<button class="btn" data-articles="${i}">${t('articlesEdit')}</button>${r.members.map((a, n) => `<button class="btn" data-go="${i}:${n}">${esc(this.registry.placement(a)?.page.pageNumber ?? '?')} · ${a.componentId === r.main.componentId ? t('articlesDeviceMain') : t('articlesNavigate')}</button>`).join('')}` : `<button class="btn" data-edit="${i}">${t('articlesEdit')}</button>`}</td></tr>`).join('')}</table></div><div style="display:flex;gap:10px"><button class="btn" data-prev ${this.page ? '' : 'disabled'}>←</button>${this.page + 1} / ${pages}<button class="btn" data-next ${this.page < pages - 1 ? '' : 'disabled'}>→</button></div>
 ${this.edit ? `<fieldset style="margin:10px 0"><legend>${t('deviceNew')}</legend>${(['plant', 'location', 'bmk', 'description'] as const).map((k, i) => `<label>${t((['deviceFacility', 'deviceLocation', 'labelBmk', 'articlesDescription'] as const)[i])}<input class="form-input" data-field="${k}" value="${esc(this.edit![k])}"></label>`).join('')}<table style="width:100%">${this.edit.items.map((a, i) => `<tr><td>${esc(a.articleNumber)}</td><td><input data-quantity="${i}" value="${a.quantity ?? '?'}"></td><td><button class="btn" data-remove="${i}">${t('articlesRemove')}</button></td></tr>`).join('')}</table><button class="btn" data-add>${t('articlesAddCatalog')}</button><button class="btn" data-save>${t('articlesPreview')}</button><button class="btn" data-delete>${t('deviceDelete')}</button><label>${t('deviceAllocate')}<select class="form-input" data-target>${this.source.pages.flatMap((p) => p.components.map((c) => `<option value="${esc(JSON.stringify([p.id, c.id]))}">${esc(p.pageNumber + ' · ' + c.bmk + ' · ' + c.functionText)}</option>`)).join('')}</select></label><button class="btn" data-allocate>${t('articlesPreview')}</button></fieldset>` : ''}
 ${this.preview ? `<fieldset><legend>${t('articlesPreview')}</legend><pre style="white-space:pre-wrap">${esc(this.previewText)}</pre></fieldset>` : ''}<footer style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn" data-close>${t('close')}</button><button class="btn" data-apply ${this.preview ? '' : 'disabled'}>${t('articlesApply')}</button></footer></section>`;
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
    this.el
      .querySelector<HTMLInputElement>('[data-unplaced]')
      ?.addEventListener('change', (e) => {
        this.onlyUnplaced = (e.target as HTMLInputElement).checked;
        this.page = 0;
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
        const [i, n] = b.dataset.go!.split(':').map(Number);
        this.onNavigate(shown[i].members[n]);
        this.el.remove();
      });
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-articles]'))
      b.addEventListener('click', () => {
        this.onArticles(shown[Number(b.dataset.articles)].members);
        this.el.remove();
      });
    this.el.querySelector('[data-new]')?.addEventListener('click', () => {
      this.edit = {
        id: crypto.randomUUID(),
        plant: '',
        location: '',
        bmk: '',
        description: '',
        items: [],
      };
      this.preview = undefined;
      this.render();
    });
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-edit]'))
      b.addEventListener('click', () => {
        this.edit = structuredClone(
          this.source.plannedDevices!.find(
            (d) => d.id === shown[Number(b.dataset.edit)].id,
          )!,
        );
        this.preview = undefined;
        this.render();
      });
    for (const input of this.el.querySelectorAll<HTMLInputElement>(
      '[data-field]',
    ))
      input.addEventListener('input', () => {
        (this.edit as any)[input.dataset.field!] = input.value;
        this.preview = undefined;
        this.el.querySelector<HTMLButtonElement>('[data-apply]')!.disabled =
          true;
      });
    for (const input of this.el.querySelectorAll<HTMLInputElement>(
      '[data-quantity]',
    ))
      input.addEventListener('input', () => {
        this.edit!.items[Number(input.dataset.quantity)].quantity =
          input.value === '?' ? undefined : Number(input.value);
        this.preview = undefined;
        this.el.querySelector<HTMLButtonElement>('[data-apply]')!.disabled =
          true;
      });
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-remove]'))
      b.addEventListener('click', () => {
        this.edit!.items.splice(Number(b.dataset.remove), 1);
        this.preview = undefined;
        this.render();
      });
    this.el.querySelector('[data-add]')?.addEventListener('click', () =>
      new ArticleCatalogDialog(this.source, (a) => {
        this.edit!.items.push({
          articleNumber: a.articleNumber,
          manufacturer: a.manufacturer,
          variant: a.variant,
          quantity: 1,
          role: this.edit!.items.length ? 'accessory' : 'main',
          snapshot: a,
        });
        this.preview = undefined;
        this.render();
      }).show(),
    );
    this.el.querySelector('[data-target]')?.addEventListener('change', () => {
      this.preview = undefined;
      this.el.querySelector<HTMLButtonElement>('[data-apply]')!.disabled = true;
    });
    this.el
      .querySelector('[data-save]')
      ?.addEventListener('click', () =>
        this.prepare(
          { kind: 'save', device: this.edit! },
          JSON.stringify(this.edit, null, 2),
        ),
      );
    this.el
      .querySelector('[data-delete]')
      ?.addEventListener('click', () =>
        this.prepare(
          { kind: 'delete', id: this.edit!.id },
          t('deviceDelete') + ' ' + this.edit!.bmk,
        ),
      );
    this.el.querySelector('[data-allocate]')?.addEventListener('click', () => {
      const selected = JSON.parse(
          this.el.querySelector<HTMLSelectElement>('[data-target]')!.value ||
            '[]',
        ),
        target = { pageId: selected[0], componentId: selected[1] },
        e = this.registry.placement(target);
      this.prepare(
        { kind: 'allocate', id: this.edit!.id, target, expected: this.edit },
        `${e?.component.bmk ?? '?'} → ${this.edit!.bmk}\n${JSON.stringify(this.edit!.items, null, 2)}`,
      );
    });
    this.el.querySelector('[data-apply]')?.addEventListener('click', () => {
      try {
        this.onApply(this.preview!.apply(this.getProject()));
        this.el.remove();
      } catch (e) {
        this.error = articleError(e);
        this.render();
      }
    });
    focusArticleModal(this.el);
  }
}
