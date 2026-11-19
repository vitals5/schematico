import { preferDraftAutoconnect } from './autoconnectDraft';
import { projectWithPages } from './multipage';
import { boxDrawing } from '../model/DeviceBox';
import { cableDrawing } from '../model/CableDefinition';
import type { Project } from '../model/types';
import { getDrawingUnitsPerMm, getSymbolForComponent } from '../model/symbols';
import { drawingToSvg, escapeSvg, uprightSymbolSvg } from '../model/ImportedDrawing';
import { snapshotPage } from './geometry';
import { previewLayout } from './service';
import { clone, type LayoutPreview, type LayoutOptions, type LayoutCandidate } from './types';
import { tr } from '../i18n';
export class LayoutPreviewDialog {
  private el = document.createElement('div');
  private preview: LayoutPreview;
  private options: LayoutOptions;
  private selected = 0;
  private sheet = 0;
  private original = false;
  private zoom = 1;
  private closed = false;
  private status = '';
  private dirty = false;
  constructor(
    private config: {
      getProject: () => Project;
      preview: LayoutPreview;
      draft?: Project;
      options?: LayoutOptions;
      selection?: string[];
      onApply: (candidate: LayoutCandidate, draft?: Project) => void;
    },
  ) {
    const checked=preferDraftAutoconnect(config.getProject(),config.draft??config.getProject(),config.preview,true);
    config.draft=checked.draft;
    this.preview = checked.preview;
    this.options = {...config.options,constructionOnly:true};
  }
  show() {
    const project = this.config.draft ?? this.config.getProject();
    const page = project.pages.find((p) => p.id === this.preview.pageId);
    const hasDraftComponents = Boolean(
      (page?.components.length ?? 0) > 0 ||
        this.preview.candidates.some((c) => (c.multiPage?.pages ?? [c.page]).some((p) => p.components.length > 0)),
    );
    document.getElementById('layoutPreviewModal')?.remove();
    this.el.id = 'layoutPreviewModal';
    this.el.dataset.hasDraftComponents = hasDraftComponents ? 'true' : 'false';
    this.el.className = 'modal-overlay';
    this.el.style.cssText =
      'position:fixed;inset:0;background:#000a;z-index:10000;display:flex;align-items:center;justify-content:center';
    this.el.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') this.close();
    });
    document.body.append(this.el);
    this.render();
  }
  private close() {
    this.closed = true;
    this.el.remove();
  }
  private render() {
    const project = this.config.draft ?? this.config.getProject(),
      pageId = this.preview.pageId,
      page = project.pages.find((p) => p.id === pageId);
    if (!page) {
      this.el.innerHTML =
        `<section role="dialog" style="background:#151a23;padding:24px;color:white">${escapeSvg(tr('Die Seite existiert nicht mehr.', 'The sheet no longer exists.'))} <button data-close>${escapeSvg(tr('Schließen', 'Close'))}</button></section>`;
      this.el.querySelector('[data-close]')?.addEventListener('click', () => this.close());
      return;
    }
    const candidate = this.preview.candidates[this.selected],
      metrics = candidate?.report.metrics;
    const sheets = candidate?.multiPage?.pages ?? (candidate ? [candidate.page] : []);
    this.sheet = Math.max(0, Math.min(this.sheet, sheets.length - 1));
    const visiblePage = this.original ? page : sheets[this.sheet] ?? page;
    const wires = sheets.flatMap(p=>p.wires);
    const autoconnect = wires.filter(w=>w.isAutoconnect).length;
    const preparation=this.preview.preparation;
    const preparationNotice=preparation && ['applied','rejected','disabled'].includes(preparation.status) ? `<p data-preparation style="padding:8px;border-left:3px solid ${preparation.status==='applied'?'#22c55e':'#eab308'}"><strong>${escapeSvg(preparation.status==='applied'?tr('Konstruktionsmuster angewendet','Construction pattern applied'):preparation.status==='disabled'?tr('Konstruktionsmuster deaktiviert','Construction pattern disabled'):tr('Verteilungsmuster nicht angewendet','Distribution pattern not applied'))}</strong><br>${escapeSvg(preparation.message)}${preparation.status==='rejected'?escapeSvg(tr(' Allgemeines Layoutverfahren als Alternative.', ' General layout solver used as fallback.')):''}</p>`:'';
    const construction=this.preview.connectionConstruction;
    const connectionNotice=construction ? `<p data-connection-construction><strong>${escapeSvg(tr('Autoconnect-Konstruktion', 'Autoconnect Construction'))}</strong><br>${construction.addedSymbols?`${construction.addedSymbols} ${escapeSvg(tr('Bibliotheks-Verbindungselemente ergänzt. ', 'library connection elements added. '))}`:''}${construction.routed?`${construction.routed} ${escapeSvg(tr('Abschnitte benötigen weiterhin einen gerouteten Weg.', 'segments still require a routed wire.'))}`:escapeSvg(tr('Alle Abschnitte werden von Autoconnect erkannt.', 'All segments are recognized by Autoconnect.'))}</p>${construction.issues.length?`<details><summary>${escapeSvg(tr('Verbleibende Verbindungswege', 'Remaining Connection Routes'))}</summary>${construction.issues.slice(0,10).map(i=>`<p>${escapeSvg(i.message)}</p>`).join('')}</details>`:''}`:'';
    this.el.innerHTML = `<section role="dialog" aria-modal="true" aria-label="${escapeSvg(tr('Layoutvorschau', 'Layout Preview'))}" style="width:min(1450px,96vw);height:92vh;background:var(--bg-primary,#151a23);color:var(--text-primary,#eee);display:flex;flex-direction:column;border:1px solid #526170;border-radius:8px;padding:16px;gap:10px">
 <style>#layoutPreviewModal table{width:100%;border-collapse:collapse;margin:10px 0}#layoutPreviewModal th,#layoutPreviewModal td{padding:4px 6px;text-align:right;border-bottom:1px solid #334155}#layoutPreviewModal td:first-child{text-align:left}#layoutPreviewModal input[type=checkbox]{margin-right:6px}#layoutPreviewModal footer>div{display:flex;gap:8px}</style><header style="display:flex;justify-content:space-between"><strong>${escapeSvg(tr('Layoutvorschau', 'Layout Preview'))} · ${escapeSvg(page.title)}</strong><div><button class="btn" data-export>${escapeSvg(tr('Entwurf exportieren', 'Export Draft'))}</button> <button class="btn" data-close>${escapeSvg(tr('Schließen', 'Close'))}</button></div></header>
 <div>${candidate?.multiPage ? `${escapeSvg(tr('Mehrseitenvorschlag:', 'Multi-sheet proposal:'))} ${candidate.multiPage.pages.length} ${escapeSvg(tr('Blätter', 'sheets'))}, ${candidate.multiPage.links.length} ${escapeSvg(tr('Verweispaare. Neue Blätter werden erst mit Übernehmen angelegt.', 'cross-reference pairs. New sheets are only created on Apply.'))}` : escapeSvg(tr('Noch nicht übernommen. Symbole, Schriftgrößen und elektrische Verbindungen bleiben erhalten.', 'Not applied yet. Symbols, font sizes, and electrical connections remain preserved.'))}</div>
 <div style="display:flex;gap:12px;flex:1;min-height:0;flex-wrap:wrap;overflow:auto"><div style="flex:3;min-width:300px;display:flex;flex-direction:column;min-height:200px"><div style="display:flex;gap:8px"><button class="btn" data-original ${candidate ? '' : 'disabled'}>${escapeSvg(this.original ? tr('Vorschau zeigen', 'Show Preview') : tr('Vorher zeigen', 'Show Before'))}</button><select class="form-select" data-candidate aria-label="${escapeSvg(tr('Layoutvariante', 'Layout Variant'))}" ${candidate ? '' : 'disabled'}>${this.preview.candidates.map((c, i) => `<option value="${i}" ${i === this.selected ? 'selected' : ''}>${escapeSvg(c.multiPage ? `${c.multiPage.pages.length} ${tr('Blätter', 'Sheets')}` : c.profile === 'structured' ? tr('Geordnete Strompfade', 'Structured Current Paths') : c.profile === 'lanes' ? tr('Strompfade', 'Current Paths') : c.profile === 'readability' ? tr('Lesbarkeit', 'Readability') : c.profile === 'compact' ? tr('Kompakt', 'Compact') : tr('Wenig Veränderung', 'Minimal Change'))}</option>`).join('')}</select></div>
 ${sheets.length > 1 ? `<nav aria-label="${escapeSvg(tr('Vorschaublätter', 'Preview Sheets'))}" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:8px"><button class="btn" data-sheet-prev aria-label="${escapeSvg(tr('Vorheriges Vorschaublatt', 'Previous preview sheet'))}" ${this.sheet === 0 ? 'disabled' : ''}>◀</button><label style="flex:1;min-width:150px">${escapeSvg(tr('Vorschaublatt', 'Preview Sheet'))} <select class="form-select" data-sheet aria-label="${escapeSvg(tr('Vorschaublatt', 'Preview Sheet'))}" style="width:100%">${sheets.map((p, i) => `<option value="${i}" ${i === this.sheet ? 'selected' : ''}>${i + 1} / ${sheets.length} · ${escapeSvg(tr('Blatt', 'Sheet'))} ${escapeSvg(p.pageNumber)} · ${escapeSvg(p.title)}</option>`).join('')}</select></label><button class="btn" data-sheet-next aria-label="${escapeSvg(tr('Nächstes Vorschaublatt', 'Next preview sheet'))}" ${this.sheet === sheets.length - 1 ? 'disabled' : ''}>▶</button></nav>` : ''}
 <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:8px"><span data-sheet-caption style="flex:1">${escapeSvg(this.original ? tr('Originalblatt', 'Original Sheet') : tr('Vorschau', 'Preview'))} · ${escapeSvg(tr('Blatt', 'Sheet'))} ${escapeSvg(visiblePage.pageNumber)} · ${escapeSvg(visiblePage.title)}</span><button class="btn" data-zoom-out aria-label="${escapeSvg(tr('Vorschau verkleinern', 'Zoom out preview'))}" ${this.zoom <= 1 ? 'disabled' : ''}>−</button><output data-zoom>${Math.round(this.zoom * 100)} %</output><button class="btn" data-zoom-in aria-label="${escapeSvg(tr('Vorschau vergrößern', 'Zoom in preview'))}" ${this.zoom >= 4 ? 'disabled' : ''}>+</button><button class="btn" data-zoom-fit>${escapeSvg(tr('Ganzes Blatt', 'Fit Sheet'))}</button></div>
 <div data-viewport tabindex="0" aria-label="${escapeSvg(tr('Blattansicht; vergrößerte Vorschau mit Scrollleisten verschieben', 'Sheet view; pan zoomed preview with scrollbars'))}" style="position:relative;flex:1;min-height:180px;overflow:auto;background:#10151f;margin-top:8px"><div data-drawing style="position:absolute;inset:0 auto auto 0;width:${this.zoom * 100}%;height:${this.zoom * 100}%;min-height:100%"></div></div></div>
 <div style="flex:1;min-width:240px;overflow:auto;font-size:12px"><p>${escapeSvg(candidate ? tr('Geprüfter Kandidat · 0 unzulässige Kollisionen', 'Validated candidate · 0 illegal collisions') : tr('Kein gültiger Kandidat', 'No valid candidate'))}</p>${candidate ? `<p>${escapeSvg(tr('Verbindungen:', 'Connections:'))} ${autoconnect} Autoconnect · ${wires.length-autoconnect} ${escapeSvg(tr('geroutet (gesamter Vorschlag)', 'routed (entire proposal)'))}</p>` : ''}${metrics ? `<table><tr><th></th><th>${escapeSvg(tr('Vorher', 'Before'))}</th><th>${escapeSvg(tr('Vorschau', 'Preview'))}</th></tr>${(['bodyOverlaps', 'textOverlaps', 'wireObstacles', 'overflows', 'crossings', 'bends', 'length', 'displacement'] as const).map((k) => `<tr><td>${escapeSvg({ bodyOverlaps: tr('Körperkollisionen', 'Body Collisions'), textOverlaps: tr('Textkollisionen', 'Text Collisions'), wireObstacles: tr('Leitungshindernisse', 'Wire Obstacles'), overflows: tr('Blattüberschreitungen', 'Sheet Overflows'), crossings: tr('Kreuzungen', 'Crossings'), bends: tr('Knicke', 'Bends'), length: tr('Leitungslänge (mm)', 'Wire Length (mm)'), displacement: tr('Verschiebung (mm)', 'Displacement (mm)') }[k])}</td><td>${Math.round(this.preview.before.metrics[k])}</td><td>${Math.round(metrics[k])}</td></tr>`).join('')}</table>` : ''}
 ${preparationNotice}${connectionNotice}<p>${escapeSvg(tr('Fixierte Objekte', 'Pinned Objects'))}</p><div style="max-height:190px;overflow:auto">${[...page.components.map((c) => ({ id: c.id, name: c.bmk || c.functionText || c.id })), ...(page.groups ?? []).map((g) => ({ id: g.id, name: g.name || g.id }))].map((o) => `<label style="display:block"><input type="checkbox" data-lock="${escapeSvg(o.id)}" ${(this.options.lockedIds ?? page.layoutConstraints?.lockedIds ?? []).includes(o.id) ? 'checked' : ''}> ${escapeSvg(o.name)}</label>`).join('')}</div>
 <p><label><input type="checkbox" data-multi ${this.options.multiPage !== false ? 'checked' : ''}> ${escapeSvg(tr('Bei Platzmangel mehrere Blätter erstellen', 'Split across multiple sheets if needed'))}</label></p><p><label><input type="checkbox" data-selection ${this.options.selectedIds ? 'checked' : ''} ${this.config.selection?.length ? '' : 'disabled'}> ${escapeSvg(tr('Nur aktuelle Auswahl', 'Current selection only'))}</label></p><button class="btn" data-recompute>${escapeSvg(tr('Neu berechnen', 'Recompute'))}</button>
 ${this.preview.issues
   .slice(0, 60)
   .map(
     (i) =>
       `<p style="color:${i.severity === 'error' ? '#fc8181' : '#f6ad55'}">${escapeSvg(i.type)}: ${escapeSvg(i.message)}<br>${i.objectIds.map(escapeSvg).join(', ')}</p>`,
   )
   .join(
     '',
   )}${this.preview.issues.length > 60 ? `<p>${this.preview.issues.length - 60} ${escapeSvg(tr('weitere Meldungen.', 'more messages.'))}</p>` : ''}
 ${this.preview.splitSuggestion ? `<p>${escapeSvg(this.preview.splitSuggestion.message)}</p><ul>${this.preview.splitSuggestion.groups.map((g) => `<li>${g.map((id) => escapeSvg(page.components.find((c) => c.id === id)?.bmk || id)).join(', ')}</li>`).join('')}</ul>${this.preview.splitSuggestion.sheets?.map((sheet, i) => `<p><strong>${escapeSvg(tr('Vorschlag Blatt', 'Suggested Sheet'))} ${i + 1}</strong>: ${sheet.componentIds.map((id) => escapeSvg(page.components.find((c) => c.id === id)?.bmk || id)).join(', ')}${sheet.oversized ? escapeSvg(tr(' — Gruppe muss weiter unterteilt werden.', ' — group must be split further.')) : ''}</p>`).join('') ?? ''}${this.preview.splitSuggestion.crossSheetConnections?.map((w) => `<p>${escapeSvg(tr('Verweis', 'Reference'))} ${escapeSvg(w.referenceName)}: ${escapeSvg(tr('Blatt', 'Sheet'))} ${w.fromSheet} → ${w.toSheet}, ${escapeSvg(w.potential)}</p>`).join('') ?? ''}` : ''}</div></div>
 <footer style="display:flex;justify-content:space-between;align-items:center"><span data-status style="color:#f6ad55">${escapeSvg(this.status)}</span><div><button class="btn" data-close>${escapeSvg(tr('Abbrechen', 'Cancel'))}</button> <button class="btn btn-primary" data-apply ${candidate && !this.dirty ? '' : 'disabled'}>${escapeSvg(tr('Übernehmen', 'Apply'))}</button></div></footer></section>`;
    this.el.querySelector('[data-export]')?.addEventListener('click', () => {
      const blob = new Blob(
        [
          JSON.stringify(
            {
              ...clone(this.config.draft ?? this.config.getProject()),
              layoutDiagnostic: {
                pageId: this.preview.pageId,
                options: this.options,
                issues: this.preview.issues,
                connectionConstruction: this.preview.connectionConstruction,
              },
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      );
      const url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = 'schematico-layout-diagnose.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    this.el
      .querySelectorAll('[data-close]')
      .forEach((e) => e.addEventListener('click', () => this.close()));
    this.el.querySelector('[data-original]')?.addEventListener('click', () => {
      this.original = !this.original;
      this.render();
    });
    this.el.querySelector('[data-candidate]')?.addEventListener('change', (e) => {
      this.selected = Number((e.target as HTMLSelectElement).value);
      this.original = false;
      this.sheet = 0;
      this.zoom = 1;
      this.render();
    });
    const showSheet = (index: number) => {
      this.sheet = index;
      this.original = false;
      this.render();
    };
    this.el.querySelector('[data-sheet]')?.addEventListener('change', (e) =>
      showSheet(Number((e.target as HTMLSelectElement).value)),
    );
    this.el.querySelector('[data-sheet-prev]')?.addEventListener('click', () => showSheet(this.sheet - 1));
    this.el.querySelector('[data-sheet-next]')?.addEventListener('click', () => showSheet(this.sheet + 1));
    const setZoom = (value: number) => {
      this.zoom = Math.max(1, Math.min(4, value));
      this.render();
    };
    this.el.querySelector('[data-zoom-out]')?.addEventListener('click', () => setZoom(this.zoom - 0.5));
    this.el.querySelector('[data-zoom-in]')?.addEventListener('click', () => setZoom(this.zoom + 0.5));
    this.el.querySelector('[data-zoom-fit]')?.addEventListener('click', () => setZoom(1));
    this.el.querySelector('[data-apply]')?.addEventListener('click', () => {
      if (!candidate || this.dirty) return;
      try {
        this.config.onApply(candidate, this.config.draft);
        this.close();
      } catch (e) {
        this.status = e instanceof Error ? e.message : String(e);
        this.render();
      }
    });
    this.el.querySelectorAll<HTMLInputElement>('[data-lock], [data-selection], [data-multi]').forEach((input) =>
      input.addEventListener('change', () => {
        this.options = {
          ...this.options,
          multiPage: this.el.querySelector<HTMLInputElement>('[data-multi]')?.checked !== false,
          lockedIds: Array.from(
            this.el.querySelectorAll<HTMLInputElement>('[data-lock]:checked'),
          ).map((e) => e.dataset.lock!),
          selectedIds: this.el.querySelector<HTMLInputElement>('[data-selection]')?.checked
            ? this.config.selection
            : undefined,
        };
        this.dirty = true;
        this.status = tr('Layoutoptionen geändert. Bitte neu berechnen.', 'Layout options changed. Please recompute.');
        this.render();
      }),
    );
    this.el.querySelector('[data-recompute]')?.addEventListener('click', async () => {
      const button = this.el.querySelector<HTMLButtonElement>('[data-recompute]')!;
      button.disabled = true;
      const locks = Array.from(
        this.el.querySelectorAll<HTMLInputElement>('[data-lock]:checked'),
      ).map((e) => e.dataset.lock!);
      this.options = {
        ...this.options,
        lockedIds: locks,
        multiPage: this.el.querySelector<HTMLInputElement>('[data-multi]')?.checked !== false,
        selectedIds: this.el.querySelector<HTMLInputElement>('[data-selection]')?.checked
          ? this.config.selection
          : undefined,
      };
      try {
        this.preview = await previewLayout(
          this.config.getProject(),
          pageId,
          this.options,
          this.config.draft,
        );
        {
          const prepared=preferDraftAutoconnect(this.config.getProject(),this.config.draft??this.config.getProject(),this.preview,true);
          this.config.draft=prepared.draft;this.preview=prepared.preview;
        }
        this.status = '';
        this.dirty = false;
        this.selected = 0;
        this.sheet = 0;
        this.original = false;
        this.zoom = 1;
      } catch (e) {
        this.status = e instanceof Error ? e.message : String(e);
      }
      if (!this.closed) this.render();
    });
    const originalProject = this.config.getProject(),
      originalPage = originalProject.pages.find((p) => p.id === pageId);
    if (this.original || !candidate) {
      if (originalPage) this.draw(originalProject, originalPage);
      if (!candidate && this.config.draft) {
        const drawing = this.el.querySelector('[data-drawing]')!;
        const note = document.createElement('p');
        note.textContent = tr(
          'Kein vollständiges Layout berechnet. Gezeigt wird der unveränderte Blattbestand; unplatzierte Entwurfsobjekte werden nicht als fertige Zeichnung dargestellt.',
          'No complete layout calculated. Showing unchanged sheet contents; unplaced draft objects are not rendered as a finished drawing.',
        );
        drawing.prepend(note);
      }
    } else this.draw(candidate.multiPage ? projectWithPages(project, candidate.pageId, candidate.multiPage) : project, candidate.multiPage?.pages[this.sheet] ?? candidate.page);
  }
  private draw(project: Project, page: Project['pages'][number]) {
    const copy = clone(project);
    copy.pages[copy.pages.findIndex((p) => p.id === page.id)] = page;
    const snapshot = snapshotPage(page, copy),
      u = getDrawingUnitsPerMm(copy),
      w = page.plotFrame.width / u,
      h = page.plotFrame.height / u;
    const vectors = page.components
      .map((c) => {
        const sym = getSymbolForComponent(c, copy);
        if (!sym) return '';
        return `<g transform="scale(${1 / u})"><g transform="translate(${c.x},${c.y}) rotate(${c.rotation},${sym.width / 2},${sym.height / 2})">${sym.importedGraphics ? drawingToSvg(sym.importedGraphics, { color: 'currentColor', componentRotation: c.rotation }) : uprightSymbolSvg(sym.svgContent, c.rotation)}</g></g>`;
      })
      .join('');
    const texts = [
      ...snapshot.nodes.flatMap((n) => n.shapes),
      ...snapshot.frames.flatMap((f) => f.shapes ?? []),
    ]
      .filter(
        (s) =>
          s.text &&
          !page.boxes?.some((b) => b.id === s.owner) &&
          !page.cables?.some((c) => c.id === s.owner),
      )
      .map((s) => {
        const t = s.text!;
        return `<text transform="translate(${t.anchor.x},${t.anchor.y}) rotate(${t.rotation})" font-family="${escapeSvg(t.font)}" font-size="${t.size}" font-weight="${t.weight}" text-anchor="${t.align}" fill="#d6dfec">${t.value
          .split('\n')
          .map((line, i) => `<tspan x="0" dy="${i ? t.size * 1.2 : 0}">${escapeSvg(line)}</tspan>`)
          .join('')}</text>`;
      })
      .join('');
    const wires = snapshot.edges
      .map(
        (e) =>
          `<polyline points="${e.points.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${e.potential === 'PE' ? '#68d391' : '#cad4df'}" stroke-width=".3"/>`,
      )
      .join('');
    const annotations = (page.texts ?? [])
      .map(
        (t) =>
          `<text x="${t.x / u}" y="${t.y / u}" font-size="${(t.fontSize ?? 10) / u}" fill="#ccd6e1">${escapeSvg(t.text)}</text>`,
      )
      .join('');
    const frames = (page.boxes ?? [])
      .map((b) => `<g transform="scale(${1 / u})">${drawingToSvg(boxDrawing(b))}</g>`)
      .join('');
    const images = (page.images ?? [])
      .map(
        (i) =>
          `<image x="${i.x / u}" y="${i.y / u}" width="${i.width / u}" height="${i.height / u}" href="${escapeSvg(i.dataUrl)}"/>`,
      )
      .join('');
    const cables = (page.cables ?? [])
      .map((c) => `<g transform="scale(${1 / u})">${drawingToSvg(cableDrawing(c, page, copy))}</g>`)
      .join('');

    const errors = this.original ? this.preview.before.issues : this.preview.issues;
    this.el.querySelector('[data-drawing]')!.innerHTML =
      `<svg viewBox="0 0 ${w} ${h}" style="display:block;width:100%;height:100%;color:#d6dfec" xmlns="http://www.w3.org/2000/svg"><rect x="${snapshot.area.x}" y="${snapshot.area.y}" width="${snapshot.area.width}" height="${snapshot.area.height}" fill="none" stroke="#536370" stroke-width=".4"/>${images}${frames}${wires}${vectors}${texts}${annotations}${cables}${errors
        .flatMap((i) => i.bounds ?? [])
        .slice(0, 80)
        .map(
          (b) =>
            `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="#f5656525" stroke="#f56565" stroke-width=".3"/>`,
        )
        .join('')}</svg>`;
  }
}
