import {
  deviceNavigator,
  DeviceNavigatorPlan,
  type PlannedDevice,
} from '../model/DeviceNavigator';
import {
  DeviceRegistry,
  addressKey,
  designationContext,
} from '../model/DeviceRegistry';
import type { Project } from '../model/types';
import type { ComponentAddress, AssignedArticle } from '../model/ArticleTypes';
import { ArticleCatalogDialog, articleError } from './ArticleCatalogDialog';
import { bindArticleModalKeys, focusArticleModal } from './ArticleModal';
import {
  finishEngineeringDialog,
  engineeringIcon as icon,
} from './EngineeringDialog';
import { escapeSvg as esc } from '../model/ImportedDrawing';
import { t } from '../i18n';

type NavigatorRow = ReturnType<typeof deviceNavigator>[number];
type NavigatorFilter = 'all' | 'verified' | 'placement' | 'unplaced';
export class DeviceNavigatorDialog {
  private el = document.createElement('div');
  private source: Project;
  private search = '';
  private filter: NavigatorFilter = 'all';
  private page = 0;
  private selectedId = '';
  private target = '';
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
    if (document.getElementById('deviceNavigatorDialog')) return;
    this.el.id = 'deviceNavigatorDialog';
    this.el.className = 'modal-backdrop';
    this.el.style.cssText =
      'position:fixed;inset:0;z-index:4200;display:flex;align-items:center;justify-content:center';
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => this.el.remove());
    this.render();
  }
  private invalidate() {
    this.preview = undefined;
    this.el.querySelector('[data-device-preview]')?.remove();
    const apply = this.el.querySelector<HTMLButtonElement>('[data-apply]');
    if (apply) apply.disabled = true;
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
  private select(row: NavigatorRow) {
    this.selectedId = row.id;
    this.edit = structuredClone(
      this.source.plannedDevices?.find((d) => d.id === row.id),
    );
    this.target = '';
    this.preview = undefined;
    this.error = '';
    this.render();
    [...this.el.querySelectorAll<HTMLElement>('[data-device-row]')]
      .find((el) => el.dataset.deviceId === row.id)
      ?.focus({ preventScroll: true });
  }
  private designation(row: NavigatorRow) {
    const placed = row.main && this.registry.placement(row.main),
      planned = this.source.plannedDevices?.find((d) => d.id === row.id);
    const [plant, location, bmk] = placed
      ? JSON.parse(designationContext(placed.page, placed.component))
      : [
          planned?.plant ?? '',
          planned?.location ?? '',
          planned?.bmk ?? row.designation,
        ];
    return `${plant ? '=' + plant : ''}${location ? '+' + location : ''}${bmk}`;
  }
  private itemText(items: AssignedArticle[]) {
    return items
      .map(
        (a) =>
          `${a.manufacturer} ${a.articleNumber}${a.variant ? ' · ' + a.variant : ''} × ${a.quantity ?? '?'} · ${t(a.role === 'main' ? 'articlesMain' : 'articlesAccessory')}`,
      )
      .join('\n');
  }
  private plannedText(device: PlannedDevice) {
    return `${device.plant ? '=' + device.plant : ''}${device.location ? '+' + device.location : ''}${device.bmk}\n${device.description}\n\n${this.itemText(device.items)}`;
  }
  private status(row: NavigatorRow) {
    return `<span class="nav-status nav-status--${esc(row.state)}"><span></span>${t(('deviceState_' + row.state) as any)}</span>`;
  }
  private render() {
    const all = deviceNavigator(this.source, this.registry),
      matches = (row: NavigatorRow) =>
        this.filter === 'all' ||
        (this.filter === 'unplaced'
          ? ['unplaced', 'missing_placement'].includes(row.state)
          : row.state === this.filter);
    const rows = all.filter(
      (r) =>
        matches(r) &&
        [
          this.designation(r),
          r.description,
          ...r.items.map((a) => a.articleNumber),
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(this.search.toLocaleLowerCase()),
    );
    const pages = Math.max(1, Math.ceil(rows.length / 50));
    this.page = Math.min(this.page, pages - 1);
    const shown = rows.slice(this.page * 50, this.page * 50 + 50),
      selected = all.find((r) => r.id === this.selectedId);
    const filters: { key: NavigatorFilter; label: string; count: number }[] = [
      { key: 'all', label: t('engineeringAllEntries'), count: all.length },
      {
        key: 'verified',
        label: t('engineeringVerified'),
        count: all.filter((r) => r.state === 'verified').length,
      },
      {
        key: 'placement',
        label: t('engineeringPlacements'),
        count: all.filter((r) => r.state === 'placement').length,
      },
      {
        key: 'unplaced',
        label: t('engineeringPlanned'),
        count: all.filter((r) =>
          ['unplaced', 'missing_placement'].includes(r.state),
        ).length,
      },
    ];
    const field = (
      key: 'plant' | 'location' | 'bmk' | 'description',
      label: string,
    ) =>
      `<label class="eng-field ${key === 'description' ? 'nav-field-wide' : ''}">${label}<input class="form-input" data-field="${key}" value="${esc(this.edit![key])}"></label>`;
    let detail = '';
    if (this.edit) {
      const exists = this.source.plannedDevices?.some(
        (d) => d.id === this.edit!.id,
      );
      detail = `<div class="nav-detail-heading"><span class="eng-eyebrow">${t('engineeringPlanned')}</span><h3>${esc(this.edit.bmk || t('deviceNew'))}</h3><p>${t('engineeringPlanningHint')}</p></div><div class="nav-form-grid">${field('plant', t('deviceFacility'))}${field('location', t('deviceLocation'))}${field('bmk', t('labelBmk'))}${field('description', t('articlesDescription'))}</div><div class="nav-section-title">${t('articlesItems')}<span>${this.edit.items.length}</span></div>${this.edit.items.length ? `<table class="nav-item-table"><thead><tr><th>${t('articlesNumber')}</th><th>${t('articlesQuantity')}</th><th></th></tr></thead><tbody>${this.edit.items.map((a, i) => `<tr><td><strong>${esc(a.articleNumber)}</strong><small>${esc(a.manufacturer)} · ${t(a.role === 'main' ? 'articlesMain' : 'articlesAccessory')}</small></td><td><input data-quantity="${i}" aria-label="${esc(t('articlesQuantity') + ' ' + a.articleNumber)}" value="${a.quantity ?? '?'}"></td><td><button class="btn eng-danger nav-icon-button" data-remove="${i}" title="${t('articlesRemove')}" aria-label="${t('articlesRemove')}">${icon('trash')}</button></td></tr>`).join('')}</tbody></table>` : `<p class="nav-muted">${t('articlesUnassigned')}</p>`}<div class="nav-button-row"><button class="btn" data-add>${icon('plus')}${t('articlesAddCatalog')}</button><button class="btn" data-save>${t('engineeringCheckDraft')}</button></div><div class="nav-section-title">${t('deviceAllocate')}</div><label class="eng-field">${t('engineeringTarget')}<select class="form-input" data-target><option value="">${t('engineeringSelectTarget')}</option>${this.source.pages
        .flatMap((p) =>
          p.components.map((c) => {
            const value = JSON.stringify([p.id, c.id]);
            return `<option value="${esc(value)}" ${value === this.target ? 'selected' : ''}>${esc(p.pageNumber + ' · ' + c.bmk + ' · ' + c.functionText)}</option>`;
          }),
        )
        .join(
          '',
        )}</select></label><button class="btn nav-full" data-allocate ${this.target ? '' : 'disabled'}>${icon('link')}${t('engineeringCheckAssignment')}</button>${exists ? `<button class="btn eng-danger nav-delete" data-delete>${icon('trash')}${t('deviceDelete')}</button>` : ''}`;
    } else if (selected) {
      const placed = selected.main && this.registry.placement(selected.main),
        scope = placed
          ? JSON.parse(designationContext(placed.page, placed.component))
          : ['', '', ''];
      detail = `<div class="nav-detail-heading"><span class="eng-eyebrow">${t('engineeringDetails')}</span><h3 class="eng-mono">${esc(this.designation(selected))}</h3>${this.status(selected)}<p class="nav-description">${esc(selected.description || '—')}</p></div><dl class="nav-facts"><div><dt>${t('deviceFacility')}</dt><dd>${esc(scope[0] ? '=' + scope[0] : '—')}</dd></div><div><dt>${t('deviceLocation')}</dt><dd>${esc(scope[1] ? '+' + scope[1] : '—')}</dd></div><div><dt>${t('engineeringRepresentations')}</dt><dd>${selected.members.length}</dd></div><div><dt>${t('engineeringArticlePositions')}</dt><dd>${selected.items.length}</dd></div></dl><div class="nav-section-title">${t('articlesItems')}</div>${selected.items.length ? selected.items.map((a) => `<div class="nav-article"><div><strong>${esc(a.articleNumber)}</strong><span>${esc(a.manufacturer)}${a.variant ? ' · ' + esc(a.variant) : ''}</span><small>${t(a.role === 'main' ? 'articlesMain' : 'articlesAccessory')}</small></div><b class="eng-mono">× ${a.quantity ?? '?'}</b></div>`).join('') : `<p class="nav-muted">${t('articlesUnassigned')}</p>`}<button class="btn nav-full" data-detail-articles>${icon('articles')}${t('articlesEdit')}</button><div class="nav-section-title">${t('engineeringRepresentations')}</div>${selected.members
        .map((a, n) => {
          const e = this.registry.placement(a),
            main = selected.main && addressKey(a) === addressKey(selected.main);
          return `<button class="nav-placement" data-go="${n}"><span class="nav-sheet">${esc(e?.page.pageNumber ?? '?')}</span><span><strong>${esc(e?.page.title ?? '—')}</strong><small>${main ? t('articlesDeviceMain') : t('articleRole_auxiliary')}</small></span>${icon('chevron')}</button>`;
        })
        .join('')}`;
    } else
      detail = `<div class="nav-empty-detail"><div>${icon('device')}</div><h3>${t('engineeringSelectDevice')}</h3><p>${t('engineeringSelectDeviceHint')}</p></div>`;
    this.el.innerHTML = `<section role="dialog" aria-modal="true"><h2>${t('deviceNavigator')}</h2><div class="nav-layout"><aside class="nav-sidebar"><span class="eng-eyebrow">${t('engineeringProjectInventory')}</span><nav aria-label="${t('deviceNavigator')}">${filters.map((f) => `<button data-filter="${f.key}" class="nav-filter ${f.key === this.filter ? 'is-active' : ''}" aria-pressed="${f.key === this.filter}"><span>${f.label}</span><b>${f.count}</b></button>`).join('')}</nav><div class="nav-sidebar-note">${icon('review')}<p>${t('engineeringNavigatorNote')}</p></div></aside><main class="nav-main"><div class="nav-toolbar"><label class="nav-search">${icon('search')}<input data-search type="search" placeholder="${t('engineeringDeviceSearch')}" aria-label="${t('engineeringDeviceSearch')}" value="${esc(this.search)}"></label><button class="btn eng-primary" data-new>${icon('plus')}${t('deviceNew')}</button></div><div role="alert">${esc(this.error)}</div><div class="nav-workspace"><div class="nav-list"><table class="nav-table"><thead><tr><th>BMK</th><th>${t('articlesDescription')}</th><th class="nav-col-article">${t('articlesNumber')}</th><th>${t('engineeringStatus')}</th><th></th></tr></thead><tbody>${shown.map((r, i) => `<tr data-device-row="${i}" data-device-id="${esc(r.id)}" tabindex="0" aria-selected="${r.id === this.selectedId}" class="${r.id === this.selectedId ? 'is-selected' : ''}"><td class="eng-mono nav-designation">${esc(this.designation(r) || '—')}</td><td><span class="nav-truncate">${esc(r.description || '—')}</span><small>${r.members.length ? (r.members.length === 1 ? t('engineeringViewOne') : t('engineeringViewCount', { count: r.members.length })) : t('engineeringNotPlaced')}</small></td><td class="nav-col-article">${esc(r.items[0]?.articleNumber ?? '—')}${r.items.length > 1 ? `<small>+${r.items.length - 1} ${t('articlesAccessory')}</small>` : ''}</td><td>${this.status(r)}</td><td>${icon('chevron')}</td></tr>`).join('') || `<tr><td colspan="5"><div class="nav-list-empty">${icon('search')}<h3>${t('engineeringNoEntries')}</h3><p>${t('engineeringAdjustFilter')}</p></div></td></tr>`}</tbody></table></div><aside class="nav-detail" aria-label="${t('engineeringDetails')}">${detail}${this.preview ? `<div class="nav-preview" data-device-preview><span>${icon('check')}${t('articlesPreview')}</span><pre>${esc(this.previewText)}</pre></div>` : ''}</aside></div><div class="nav-pagination"><span>${t('engineeringResultRange', { from: rows.length ? this.page * 50 + 1 : 0, to: Math.min((this.page + 1) * 50, rows.length), count: rows.length })}</span><div><button class="btn" data-prev ${this.page ? '' : 'disabled'}>←</button><span>${this.page + 1} / ${pages}</span><button class="btn" data-next ${this.page < pages - 1 ? '' : 'disabled'}>→</button></div></div></main></div><footer><span>${t('engineeringApplyHint')}</span><button class="btn" data-close>${t('close')}</button><button class="btn" data-apply ${this.preview ? '' : 'disabled'}>${t('articlesApply')}</button></footer></section>`;
    this.el
      .querySelector('[data-close]')
      ?.addEventListener('click', () => this.el.remove());
    this.el
      .querySelector<HTMLInputElement>('[data-search]')
      ?.addEventListener('input', (e) => {
        const value = e.target as HTMLInputElement;
        this.search = value.value;
        this.page = 0;
        this.render();
        const input = this.el.querySelector<HTMLInputElement>('[data-search]')!;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      });
    for (const button of this.el.querySelectorAll<HTMLButtonElement>(
      '[data-filter]',
    ))
      button.addEventListener('click', () => {
        this.filter = button.dataset.filter as NavigatorFilter;
        this.page = 0;
        this.render();
      });
    for (const row of this.el.querySelectorAll<HTMLElement>(
      '[data-device-row]',
    )) {
      row.addEventListener('click', () =>
        this.select(shown[Number(row.dataset.deviceRow)]),
      );
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.select(shown[Number(row.dataset.deviceRow)]);
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const index = Math.min(
            shown.length - 1,
            Math.max(
              0,
              Number(row.dataset.deviceRow) + (e.key === 'ArrowDown' ? 1 : -1),
            ),
          );
          this.select(shown[index]);
          this.el
            .querySelector<HTMLElement>(`[data-device-row="${index}"]`)
            ?.focus();
        }
      });
    }
    for (const button of this.el.querySelectorAll<HTMLElement>('[data-go]'))
      button.addEventListener('click', () => {
        this.onNavigate(selected!.members[Number(button.dataset.go)]);
        this.el.remove();
      });
    this.el
      .querySelector('[data-detail-articles]')
      ?.addEventListener('click', () => {
        this.onArticles(selected!.members);
        this.el.remove();
      });
    this.el.querySelector('[data-prev]')?.addEventListener('click', () => {
      this.page--;
      this.render();
    });
    this.el.querySelector('[data-next]')?.addEventListener('click', () => {
      this.page++;
      this.render();
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
      this.selectedId = this.edit.id;
      this.target = '';
      this.preview = undefined;
      this.error = '';
      this.render();
      this.el.querySelector<HTMLInputElement>('[data-field="bmk"]')?.focus();
    });
    for (const input of this.el.querySelectorAll<HTMLInputElement>(
      '[data-field]',
    ))
      input.addEventListener('input', () => {
        (this.edit as any)[input.dataset.field!] = input.value;
        this.invalidate();
      });
    for (const input of this.el.querySelectorAll<HTMLInputElement>(
      '[data-quantity]',
    ))
      input.addEventListener('input', () => {
        this.edit!.items[Number(input.dataset.quantity)].quantity =
          input.value === '?' ? undefined : Number(input.value);
        this.invalidate();
      });
    for (const button of this.el.querySelectorAll<HTMLElement>('[data-remove]'))
      button.addEventListener('click', () => {
        this.edit!.items.splice(Number(button.dataset.remove), 1);
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
    this.el
      .querySelector<HTMLSelectElement>('[data-target]')
      ?.addEventListener('change', (e) => {
        this.target = (e.target as HTMLSelectElement).value;
        this.invalidate();
        this.el.querySelector<HTMLButtonElement>('[data-allocate]')!.disabled =
          !this.target;
      });
    this.el
      .querySelector('[data-save]')
      ?.addEventListener('click', () =>
        this.prepare(
          { kind: 'save', device: this.edit! },
          this.plannedText(this.edit!),
        ),
      );
    this.el
      .querySelector('[data-delete]')
      ?.addEventListener('click', () =>
        this.prepare(
          { kind: 'delete', id: this.edit!.id },
          t('deviceDelete') + '\n' + this.plannedText(this.edit!),
        ),
      );
    this.el.querySelector('[data-allocate]')?.addEventListener('click', () => {
      if (!this.target) return;
      const [pageId, componentId] = JSON.parse(this.target),
        target = { pageId, componentId },
        e = this.registry.placement(target);
      this.prepare(
        { kind: 'allocate', id: this.edit!.id, target, expected: this.edit },
        `${e?.component.bmk ?? '?'} → ${this.edit!.bmk}\n${this.itemText(this.edit!.items)}`,
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
    finishEngineeringDialog(this.el, {
      kind: 'device',
      description: t('engineeringNavigatorHint'),
      wide: true,
    });
    focusArticleModal(this.el);
  }
}
