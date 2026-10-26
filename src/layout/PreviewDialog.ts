import { boxDrawing } from '../model/DeviceBox';
import { cableDrawing } from '../model/CableDefinition';
import type { Project } from '../model/types';
import { getDrawingUnitsPerMm, getSymbolForComponent } from '../model/symbols';
import { drawingToSvg, escapeSvg, uprightSymbolSvg } from '../model/ImportedDrawing';
import { snapshotPage } from './geometry';
import { previewLayout } from './service';
import { clone, type LayoutPreview, type LayoutOptions, type LayoutCandidate } from './types';
export class LayoutPreviewDialog {
  private el = document.createElement('div');
  private preview: LayoutPreview;
  private options: LayoutOptions;
  private selected = 0;
  private original = false;
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
    this.preview = config.preview;
    this.options = config.options ?? {};
  }
  show() {
    document.getElementById('layoutPreviewModal')?.remove();
    this.el.id = 'layoutPreviewModal';
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
        '<section role="dialog" style="background:#151a23;padding:24px;color:white">Die Seite existiert nicht mehr. <button data-close>Schließen</button></section>';
      this.el.querySelector('[data-close]')?.addEventListener('click', () => this.close());
      return;
    }
    const candidate = this.preview.candidates[this.selected],
      metrics = candidate?.report.metrics;
    this.el.innerHTML = `<section role="dialog" aria-modal="true" aria-label="Layoutvorschau" style="width:min(1450px,96vw);height:92vh;background:var(--bg-primary,#151a23);color:var(--text-primary,#eee);display:flex;flex-direction:column;border:1px solid #526170;border-radius:8px;padding:16px;gap:10px">
 <style>#layoutPreviewModal table{width:100%;border-collapse:collapse;margin:10px 0}#layoutPreviewModal th,#layoutPreviewModal td{padding:4px 6px;text-align:right;border-bottom:1px solid #334155}#layoutPreviewModal td:first-child{text-align:left}#layoutPreviewModal input[type=checkbox]{margin-right:6px}#layoutPreviewModal footer>div{display:flex;gap:8px}</style><header style="display:flex;justify-content:space-between"><strong>Layoutvorschau · ${escapeSvg(page.title)}</strong><div><button class="btn" data-export>Entwurf exportieren</button> <button class="btn" data-close>Schließen</button></div></header>
 <div>Noch nicht übernommen. Symbole, Schriftgrößen und elektrische Verbindungen bleiben erhalten.</div>
 <div style="display:flex;gap:12px;flex:1;min-height:0;flex-wrap:wrap;overflow:auto"><div style="flex:3;min-width:300px;display:flex;flex-direction:column;min-height:200px"><div style="display:flex;gap:8px"><button class="btn" data-original ${candidate ? '' : 'disabled'}>${this.original ? 'Vorschau zeigen' : 'Vorher zeigen'}</button><select class="form-select" data-candidate aria-label="Layoutvariante" ${candidate ? '' : 'disabled'}>${this.preview.candidates.map((c, i) => `<option value="${i}" ${i === this.selected ? 'selected' : ''}>${c.profile === 'readability' ? 'Lesbarkeit' : c.profile === 'compact' ? 'Kompakt' : 'Wenig Veränderung'}</option>`).join('')}</select></div><div data-drawing style="flex:1;min-height:0;background:#10151f;margin-top:8px"></div></div>
 <div style="flex:1;min-width:240px;overflow:auto;font-size:12px"><p>${candidate ? 'Geprüfter Kandidat · 0 unzulässige Kollisionen' : 'Kein gültiger Kandidat'}</p>${metrics ? `<table><tr><th></th><th>Vorher</th><th>Vorschau</th></tr>${(['bodyOverlaps', 'textOverlaps', 'wireObstacles', 'overflows', 'crossings', 'bends', 'length', 'displacement'] as const).map((k) => `<tr><td>${{ bodyOverlaps: 'Körperkollisionen', textOverlaps: 'Textkollisionen', wireObstacles: 'Leitungshindernisse', overflows: 'Blattüberschreitungen', crossings: 'Kreuzungen', bends: 'Knicke', length: 'Leitungslänge (mm)', displacement: 'Verschiebung (mm)' }[k]}</td><td>${Math.round(this.preview.before.metrics[k])}</td><td>${Math.round(metrics[k])}</td></tr>`).join('')}</table>` : ''}
 <p>Fixierte Objekte</p><div style="max-height:190px;overflow:auto">${[...page.components.map((c) => ({ id: c.id, name: c.bmk || c.functionText || c.id })), ...(page.groups ?? []).map((g) => ({ id: g.id, name: g.name || g.id }))].map((o) => `<label style="display:block"><input type="checkbox" data-lock="${escapeSvg(o.id)}" ${(this.options.lockedIds ?? page.layoutConstraints?.lockedIds ?? []).includes(o.id) ? 'checked' : ''}> ${escapeSvg(o.name)}</label>`).join('')}</div>
 <p><label><input type="checkbox" data-selection ${this.options.selectedIds ? 'checked' : ''} ${this.config.selection?.length ? '' : 'disabled'}> Nur aktuelle Auswahl</label></p><button class="btn" data-recompute>Neu berechnen</button>
 ${this.preview.issues
   .slice(0, 60)
   .map(
     (i) =>
       `<p style="color:${i.severity === 'error' ? '#fc8181' : '#f6ad55'}">${escapeSvg(i.type)}: ${escapeSvg(i.message)}<br>${i.objectIds.map(escapeSvg).join(', ')}</p>`,
   )
   .join(
     '',
   )}${this.preview.issues.length > 60 ? `<p>${this.preview.issues.length - 60} weitere Meldungen.</p>` : ''}
 ${this.preview.splitSuggestion ? `<p>${escapeSvg(this.preview.splitSuggestion.message)}</p><ul>${this.preview.splitSuggestion.groups.map((g) => `<li>${g.map((id) => escapeSvg(page.components.find((c) => c.id === id)?.bmk || id)).join(', ')}</li>`).join('')}</ul>${this.preview.splitSuggestion.sheets?.map((sheet, i) => `<p><strong>Vorschlag Blatt ${i + 1}</strong>: ${sheet.componentIds.map((id) => escapeSvg(page.components.find((c) => c.id === id)?.bmk || id)).join(', ')}${sheet.oversized ? ' — Gruppe muss weiter unterteilt werden.' : ''}</p>`).join('') ?? ''}${this.preview.splitSuggestion.crossSheetConnections?.map((w) => `<p>Verweis ${escapeSvg(w.referenceName)}: Blatt ${w.fromSheet} → ${w.toSheet}, ${escapeSvg(w.potential)}</p>`).join('') ?? ''}` : ''}</div></div>
 <footer style="display:flex;justify-content:space-between;align-items:center"><span data-status style="color:#f6ad55">${escapeSvg(this.status)}</span><div><button class="btn" data-close>Abbrechen</button> <button class="btn btn-primary" data-apply ${candidate && !this.dirty ? '' : 'disabled'}>Übernehmen</button></div></footer></section>`;
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
      this.render();
    });
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
    this.el.querySelectorAll<HTMLInputElement>('[data-lock], [data-selection]').forEach((input) =>
      input.addEventListener('change', () => {
        this.options = {
          ...this.options,
          lockedIds: Array.from(
            this.el.querySelectorAll<HTMLInputElement>('[data-lock]:checked'),
          ).map((e) => e.dataset.lock!),
          selectedIds: this.el.querySelector<HTMLInputElement>('[data-selection]')?.checked
            ? this.config.selection
            : undefined,
        };
        this.dirty = true;
        this.status = 'Fixierungen geändert. Bitte neu berechnen.';
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
        this.status = '';
        this.dirty = false;
        this.selected = 0;
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
        note.textContent =
          'Kein vollständiges Layout berechnet. Gezeigt wird der unveränderte Blattbestand; unplatzierte Entwurfsobjekte werden nicht als fertige Zeichnung dargestellt.';
        drawing.prepend(note);
      }
    } else this.draw(project, candidate.page);
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
      `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:100%;color:#d6dfec" xmlns="http://www.w3.org/2000/svg"><rect x="${snapshot.area.x}" y="${snapshot.area.y}" width="${snapshot.area.width}" height="${snapshot.area.height}" fill="none" stroke="#536370" stroke-width=".4"/>${images}${frames}${wires}${vectors}${texts}${annotations}${cables}${errors
        .flatMap((i) => i.bounds ?? [])
        .slice(0, 80)
        .map(
          (b) =>
            `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="#f5656525" stroke="#f56565" stroke-width=".3"/>`,
        )
        .join('')}</svg>`;
  }
}
