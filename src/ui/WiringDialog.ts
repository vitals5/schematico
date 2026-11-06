import type { Project } from '../model/types';
import { ProjectIndex } from '../model/ProjectIndex';
import {
  WiringEditPlan,
  terminalSettings,
  cableSchedule,
  type WiringEdit,
} from '../model/WiringManagement';
import { TerminalDiagramGenerator } from '../reports/TerminalDiagram';
import { bindArticleModalKeys, focusArticleModal } from './ArticleModal';
import { articleError, downloadArticleFile } from './ArticleCatalogDialog';
import { escapeSvg as esc } from '../model/ImportedDrawing';
import { t } from '../i18n';
const csv = (rows: unknown[][]) =>
  rows
    .map((row) =>
      row
        .map((v) => '"' + String(v ?? '').replaceAll('"', '""') + '"')
        .join(';'),
    )
    .join('\r\n');
export class WiringDialog {
  private el = document.createElement('div');
  private source: Project;
  private index: ProjectIndex;
  private terminal = '';
  private cable = '';
  private core = '';
  private preview?: WiringEditPlan;
  private summary = '';
  private error = '';
  private draft?: WiringEdit;
  constructor(
    private getProject: () => Project,
    private onApply: (p: Project) => void,
    initial?: {
      pageId: string;
      componentId?: string;
      cableId?: string;
      coreId?: string;
    },
  ) {
    this.source = structuredClone(getProject());
    this.index = new ProjectIndex(this.source);
    if (initial?.componentId)
      this.terminal = JSON.stringify([initial.pageId, initial.componentId]);
    if (initial?.cableId)
      this.cable = JSON.stringify([initial.pageId, initial.cableId]);
    if (initial?.coreId) this.core = initial.coreId;
  }
  show() {
    if (document.getElementById('wiringDialog')) return;
    this.el.id = 'wiringDialog';
    this.el.className = 'modal-backdrop';
    this.el.style.cssText =
      'position:fixed;inset:0;z-index:4200;background:#000a;display:flex;align-items:center;justify-content:center;padding:12px';
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => this.el.remove());
    this.render();
  }
  private prepare(edit: WiringEdit) {
    this.draft = structuredClone(edit);
    try {
      this.preview = new WiringEditPlan(this.source, edit);
      this.summary = this.describe(edit);
      this.error = '';
    } catch (e) {
      this.preview = undefined;
      this.error = articleError(e);
    }
    this.render();
  }
  private describe(edit: WiringEdit) {
    if (edit.kind === 'bridge') {
      const a = this.index.component(edit.from.componentId, edit.from.pageId),
        b = this.index.component(edit.to.componentId, edit.to.pageId);
      return `${t('wiringBridge')}: ${a?.component.bmk}:${edit.from.pinId} → ${b?.component.bmk}:${edit.to.pinId} (${t(edit.bridgeType === 'plug' ? 'wiringPlug' : 'wiringWireBridge')})`;
    }
    if (edit.kind === 'remove_bridge') {
      const w = this.source.logicalConnections?.find((w) => w.id === edit.id);
      return `${t('wiringBridgeRemove')}: ${w?.from.componentId}:${w?.from.pinId} → ${w?.to.componentId}:${w?.to.pinId}`;
    }
    if (edit.kind === 'terminal') {
      const before = this.index.component(
        edit.target.componentId,
        edit.target.pageId,
      )?.component;
      return (
        `${before?.bmk} → ${edit.settings.strip}:${edit.settings.number}${edit.settings.level ? '/' + edit.settings.level : ''}\n` +
        Object.entries(edit.settings.pinSides)
          .map(
            ([id, side]) =>
              `${id}: ${t(side === 'internal' ? 'wiringInternal' : 'wiringExternal')}`,
          )
          .join('\n')
      );
    }
    const c = this.source.pages
      .find((p) => p.id === edit.pageId)
      ?.cables?.find((c) => c.id === edit.cableId);
    if (edit.kind === 'reserves')
      return `${c?.bmk}: ${c?.cores.length} → ${c?.coreCount ?? '?'} · ${t('wiringReserve')}`;
    if (edit.kind === 'cable')
      return `${c?.bmk} / ${c?.cableType} / ${c?.coreCount ?? '?'} / ${c?.crossSection} → ${edit.bmk} / ${edit.cableType} / ${edit.coreCount ?? '?'} / ${edit.crossSection}`;
    const core = c?.cores.find((c) => c.id === edit.coreId);
    return `${c?.bmk}: ${core?.designation ?? '?'} (${core?.color ?? ''}, ${core?.crossSection ?? c?.crossSection}, ${core?.reserve ? t('wiringReserve') : (core?.wireIds?.join(', ') ?? '—')}) → ${edit.designation} (${edit.color}, ${edit.crossSection}, ${edit.reserve ? t('wiringReserve') : edit.wireIds.join(', ') || '—'})`;
  }
  private render() {
    const terminals = this.index.components.filter(
        (e) => e.symbol?.category === 'terminals',
      ),
      terminalOptions = terminals.map((e) => ({
        value: JSON.stringify([e.page.id, e.component.id]),
        e,
      })),
      selected = terminalOptions.find((e) => e.value === this.terminal)?.e,
      settings = selected
        ? this.draft?.kind === 'terminal' &&
          this.draft.target.componentId === selected.component.id &&
          this.draft.target.pageId === selected.page.id
          ? this.draft.settings
          : terminalSettings(selected.component)
        : undefined,
      cables = this.source.pages.flatMap((page) =>
        (page.cables ?? []).map((c) => ({
          page,
          c,
          value: JSON.stringify([page.id, c.id]),
        })),
      ),
      selectedCable = cables.find((c) => c.value === this.cable),
      baseCore = selectedCable?.c.cores.find((c) => c.id === this.core),
      selectedCore = baseCore
        ? this.draft?.kind === 'core' && this.draft.coreId === baseCore.id
          ? { ...baseCore, ...this.draft }
          : baseCore
        : undefined,
      report = TerminalDiagramGenerator.generateTerminalReport(this.source),
      endpoints = terminals.flatMap((e) =>
        this.index
          .pinsFor(e)
          .map((p) => ({
            value: JSON.stringify([e.page.id, e.component.id, p.id]),
            label: `${e.page.pageNumber} · ${e.component.bmk}:${p.label}`,
          })),
      );
    const field = (id: string, label: string, value: string) =>
      `<label>${esc(label)}<input class="form-input" data-${id} value="${esc(value)}"></label>`;
    this.el.innerHTML = `<section role="dialog" aria-modal="true" style="width:min(1200px,100%);max-height:94vh;overflow:auto;background:#17202d;color:#eee;padding:20px;border:1px solid #526170;border-radius:8px"><h2>${t('wiringManage')}</h2><div role="alert" style="color:#fca5a5">${esc(this.error)}</div><fieldset><legend>${t('wiringTerminals')}</legend><select class="form-input" data-terminal><option value="">—</option>${terminalOptions.map((o) => `<option value="${esc(o.value)}" ${o.value === this.terminal ? 'selected' : ''}>${esc(o.e.page.pageNumber + ' · ' + o.e.component.bmk + ' · ' + o.e.component.functionText)}</option>`).join('')}</select>
 ${
   selected && settings
     ? `${field('strip', t('wiringStrip'), settings.strip)}${field('number', t('wiringNumber'), settings.number)}${field('level', t('wiringLevel'), settings.level)}<div style="display:flex;gap:8px;flex-wrap:wrap">${this.index
         .pinsFor(selected)
         .map(
           (p) =>
             `<label>${esc(p.label)}<select data-side="${esc(p.id)}"><option value="internal" ${(settings.pinSides[p.id] ?? (p.id === '1' ? 'internal' : 'external')) === 'internal' ? 'selected' : ''}>${t('wiringInternal')}</option><option value="external" ${(settings.pinSides[p.id] ?? (p.id === '1' ? 'internal' : 'external')) === 'external' ? 'selected' : ''}>${t('wiringExternal')}</option></select></label>`,
         )
         .join(
           '',
         )}</div><button class="btn" data-save-terminal>${t('articlesPreview')}</button>`
     : ''
 }
 <details><summary>${t('wiringTerminals')}</summary><table style="width:100%;text-align:left"><tr><th>BMK</th><th>${t('wiringNumber')}</th><th>${t('wiringInternal')}</th><th>${t('wiringExternal')}</th></tr>${[...report].flatMap(([strip, rows]) => rows.map((r) => `<tr><td>${esc(strip)}</td><td>${esc(r.terminalNumber)}</td><td>${esc(r.internalTarget)}</td><td>${esc(r.externalTarget)}</td></tr>`)).join('')}</table></details>
 <details><summary>${t('wiringBridge')}</summary><div style="display:flex;gap:8px;flex-wrap:wrap">${['from', 'to'].map((k) => `<select class="form-input" data-bridge-${k}>${endpoints.map((p) => `<option value="${esc(p.value)}">${esc(p.label)}</option>`).join('')}</select>`).join('')}<select data-bridge-type><option value="plug">${t('wiringPlug')}</option><option value="wire">${t('wiringWireBridge')}</option></select><button class="btn" data-bridge>${t('articlesPreview')}</button></div>${(
   this.source.logicalConnections ?? []
 )
   .filter((w) => w.terminalBridge)
   .map(
     (w) =>
       `<div>${esc(w.from.componentId + ':' + w.from.pinId + ' → ' + w.to.componentId + ':' + w.to.pinId)} <button class="btn" data-remove-bridge="${esc(w.id)}">${t('wiringBridgeRemove')}</button></div>`,
   )
   .join('')}</details></fieldset>
 <fieldset style="margin-top:12px"><legend>${t('wiringCables')}</legend><select class="form-input" data-cable><option value="">—</option>${cables.map((o) => `<option value="${esc(o.value)}" ${o.value === this.cable ? 'selected' : ''}>${esc(o.page.pageNumber + ' · ' + o.c.bmk + ' · ' + o.c.cableType)}</option>`).join('')}</select>${selectedCable ? `${field('cable-bmk', 'BMK', selectedCable.c.bmk)}${field('cable-type', t('articlesDescription'), selectedCable.c.cableType)}${field('cable-section', t('wiringCrossSection'), selectedCable.c.crossSection)}${field('count', t('wiringCoreCount'), selectedCable.c.coreCount === undefined ? '' : String(selectedCable.c.coreCount))}<button class="btn" data-save-cable>${t('articlesPreview')}</button><button class="btn" data-reserves>${t('wiringReserves')}</button><select class="form-input" data-core><option value="">—</option>${selectedCable.c.cores.map((c) => `<option value="${esc(c.id)}" ${this.core === c.id ? 'selected' : ''}>${esc((c.designation ?? '?') + ' · ' + (c.color ?? '') + (c.reserve ? ' · ' + t('wiringReserve') : ''))}</option>`).join('')}</select>` : ''}
 ${selectedCore ? `${field('designation', t('articlesDescription'), selectedCore.designation ?? '')}${field('color', t('wiringColor'), selectedCore.color ?? '')}${field('section', t('wiringCrossSection'), selectedCore.crossSection ?? selectedCable!.c.crossSection)}<label><input type="checkbox" data-reserve ${selectedCore.reserve ? 'checked' : ''}> ${t('wiringReserve')}</label><label>${t('wiringWireIds')}<select class="form-input" multiple size="5" data-wires>${selectedCable!.page.wires.map((w) => `<option value="${esc(w.id)}" ${selectedCore.wireIds?.includes(w.id) ? 'selected' : ''}>${esc(w.id + ' · ' + w.from.componentId + ':' + w.from.pinId + ' → ' + w.to.componentId + ':' + w.to.pinId)}</option>`).join('')}</select></label><button class="btn" data-save-core>${t('articlesPreview')}</button>` : ''}</fieldset>
 <p>${t('wiringExportHint')}</p><button class="btn" data-export>${t('wiringExport')}</button>${this.preview ? `<fieldset data-preview><legend>${t('articlesPreview')}</legend><pre style="white-space:pre-wrap">${esc(this.summary)}</pre><ul>${this.preview.findings.map((i) => `<li>${esc(t(i.code as any))} · ${esc(i.componentId ?? i.cableId ?? '')} · ${esc(i.coreId ?? '')} · ${esc(i.details)}</li>`).join('')}</ul></fieldset>` : ''}<footer style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn" data-close>${t('close')}</button><button class="btn" data-apply ${this.preview ? '' : 'disabled'}>${t('articlesApply')}</button></footer></section>`;
    if (
      this.draft?.kind === 'cable' &&
      selectedCable?.c.id === this.draft.cableId
    ) {
      for (const [key, value] of Object.entries({
        'cable-bmk': this.draft.bmk,
        'cable-type': this.draft.cableType,
        'cable-section': this.draft.crossSection,
        count: this.draft.coreCount ?? '',
      })) {
        const input = this.el.querySelector<HTMLInputElement>(
          '[data-' + key + ']',
        );
        if (input) input.value = String(value);
      }
    }
    if (this.draft?.kind === 'bridge') {
      for (const [key, point] of Object.entries({
        from: this.draft.from,
        to: this.draft.to,
      })) {
        const select = this.el.querySelector<HTMLSelectElement>(
          '[data-bridge-' + key + ']',
        );
        if (select)
          select.value = JSON.stringify([
            point.pageId,
            point.componentId,
            point.pinId,
          ]);
      }
      this.el.querySelector<HTMLSelectElement>('[data-bridge-type]')!.value =
        this.draft.bridgeType;
    }
    const input = (k: string) =>
      this.el.querySelector<HTMLInputElement>('[data-' + k + ']')!.value;
    this.el
      .querySelector('[data-close]')
      ?.addEventListener('click', () => this.el.remove());
    for (const [attr, key] of [
      ['terminal', 'terminal'],
      ['cable', 'cable'],
      ['core', 'core'],
    ] as const)
      this.el
        .querySelector<HTMLSelectElement>('[data-' + attr + ']')
        ?.addEventListener('change', (e) => {
          this[key] = (e.target as HTMLSelectElement).value;
          if (key === 'cable') this.core = '';
          this.preview = undefined;
          this.draft = undefined;
          this.render();
        });
    this.el
      .querySelector('[data-save-terminal]')
      ?.addEventListener('click', () =>
        this.prepare({
          kind: 'terminal',
          target: {
            pageId: selected!.page.id,
            componentId: selected!.component.id,
          },
          settings: {
            strip: input('strip'),
            number: input('number'),
            level: input('level'),
            pinSides: Object.fromEntries(
              [
                ...this.el.querySelectorAll<HTMLSelectElement>('[data-side]'),
              ].map((s) => [
                s.dataset.side!,
                s.value as 'internal' | 'external',
              ]),
            ),
          },
        }),
      );
    this.el
      .querySelector('[data-save-cable]')
      ?.addEventListener('click', () =>
        this.prepare({
          kind: 'cable',
          pageId: selectedCable!.page.id,
          cableId: selectedCable!.c.id,
          bmk: input('cable-bmk'),
          cableType: input('cable-type'),
          crossSection: input('cable-section'),
          coreCount: input('count').trim() ? Number(input('count')) : undefined,
        }),
      );
    this.el
      .querySelector('[data-reserves]')
      ?.addEventListener('click', () =>
        this.prepare({
          kind: 'reserves',
          pageId: selectedCable!.page.id,
          cableId: selectedCable!.c.id,
        }),
      );
    this.el
      .querySelector('[data-save-core]')
      ?.addEventListener('click', () =>
        this.prepare({
          kind: 'core',
          pageId: selectedCable!.page.id,
          cableId: selectedCable!.c.id,
          coreId: selectedCore!.id,
          designation: input('designation'),
          color: input('color'),
          crossSection: input('section'),
          reserve:
            this.el.querySelector<HTMLInputElement>('[data-reserve]')!.checked,
          wireIds: [
            ...this.el.querySelector<HTMLSelectElement>('[data-wires]')!
              .selectedOptions,
          ].map((o) => o.value),
        }),
      );
    this.el.querySelector('[data-bridge]')?.addEventListener('click', () => {
      const parse = (k: string) => {
        const a = JSON.parse(
          this.el.querySelector<HTMLSelectElement>('[data-bridge-' + k + ']')!
            .value || '[]',
        );
        return { pageId: a[0], componentId: a[1], pinId: a[2] };
      };
      this.prepare({
        kind: 'bridge',
        from: parse('from'),
        to: parse('to'),
        bridgeType: this.el.querySelector<HTMLSelectElement>(
          '[data-bridge-type]',
        )!.value as 'plug' | 'wire',
      });
    });
    for (const b of this.el.querySelectorAll<HTMLElement>(
      '[data-remove-bridge]',
    ))
      b.addEventListener('click', () =>
        this.prepare({ kind: 'remove_bridge', id: b.dataset.removeBridge! }),
      );
    this.el.querySelector('[data-export]')?.addEventListener('click', () => {
      const terminals = [...report].flatMap(([strip, rows]) =>
        rows.map((r) => [
          strip,
          r.terminalNumber,
          r.internalTarget,
          r.externalTarget,
          r.functionText,
          r.wireColor,
          r.crossSection,
          r.pageId,
        ]),
      );
      downloadArticleFile(
        csv([
          [
            'strip',
            'number/level',
            'internal',
            'external',
            'description',
            'color',
            'crossSection',
            'pageId',
          ],
          ...terminals,
        ]),
        'schematico-terminals.csv',
        'text/csv;charset=utf-8',
      );
      downloadArticleFile(
        csv([
          [
            'page',
            'cable',
            'type',
            'core',
            'color',
            'crossSection',
            'reserve',
            'targets',
          ],
          ...cableSchedule(this.source).map((r) => [
            r.pageNumber,
            r.bmk,
            r.type,
            r.designation,
            r.color,
            r.crossSection,
            r.reserve,
            r.targets.join(', '),
          ]),
        ]),
        'schematico-cables.csv',
        'text/csv;charset=utf-8',
      );
      downloadArticleFile(
        csv([
          ['id', 'type', 'source', 'target'],
          ...(this.source.logicalConnections ?? [])
            .filter((w) => w.terminalBridge)
            .map((w) => [
              w.id,
              w.terminalBridge,
              w.from.componentId + ':' + w.from.pinId,
              w.to.componentId + ':' + w.to.pinId,
            ]),
        ]),
        'schematico-bridges.csv',
        'text/csv;charset=utf-8',
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
    for (const c of this.el.querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >('input,select'))
      if (
        !c.hasAttribute('data-terminal') &&
        !c.hasAttribute('data-cable') &&
        !c.hasAttribute('data-core')
      )
        c.addEventListener('input', () => {
          this.preview = undefined;
          this.el.querySelector<HTMLButtonElement>('[data-apply]')!.disabled =
            true;
          this.el.querySelector('[data-preview]')?.remove();
        });
    focusArticleModal(this.el);
  }
}
