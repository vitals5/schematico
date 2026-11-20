import type { Project } from "../model/types";
import { projectRevision } from "../layout/types";
import {
  savedRevisions,
  saveProjectRevision,
  readProjectRevision,
  releaseProjectRevision,
  removeProjectRevision,
  restoreProjectRevision,
  compareProjectRevisions,
  assertRevisionSource,
  type RevisionComparison,
} from "../model/ProjectRevisions";
import {
  revisionReportRows,
  revisionColumns,
  comparisonReportRows,
  engineeringReportCsv,
  engineeringPdfRows,
} from "../reports/EngineeringCalculations";
import { engineeringTablePdf } from "../export/EngineeringTablePdf";
import { escapeSvg as esc } from "../model/ImportedDrawing";
import { bindArticleModalKeys, focusArticleModal } from "./ArticleModal";
import {
  finishEngineeringDialog,
  formatEngineeringDate,
} from "./EngineeringDialog";
import { downloadArticleFile } from "./ArticleCatalogDialog";
import { revisionDrawing } from "./RevisionDrawing";
import "./ProjectEngineering.css";
import { tr } from "../i18n";

export class ProjectRevisionsDialog {
  private el = document.createElement("div");
  private source: Project;
  private baseline: string;
  private selected = "";
  private compareTo = "";
  private comparison?: RevisionComparison;
  private comparedBefore?: Project;
  private comparedAfter?: Project;
  private pageId = "";
  private filter = "";
  private offset = 0;
  private error = "";
  private busy = false;
  private pending = "";
  private closed = false;
  constructor(
    private getProject: () => Project,
    private onApply: (p: Project) => void,
    private onImpact?: (revisionId: string) => void,
  ) {
    this.source = structuredClone(getProject());
    this.baseline = projectRevision(this.source);
    this.selected = this.source.revisions?.at(-1)?.id ?? "";
  }
  show() {
    if (document.getElementById("projectRevisionsDialog")) return;
    this.el.id = "projectRevisionsDialog";
    this.el.className = "modal-backdrop";
    this.el.style.cssText =
      "position:fixed;inset:0;z-index:4200;display:flex;align-items:center;justify-content:center";
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => {
      if (!this.busy) this.close();
    });
    this.render();
  }
  private close() {
    this.closed = true;
    this.el.remove();
  }
  private async run(action: () => Promise<void> | void) {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    this.render();
    try {
      assertRevisionSource(this.getProject(), this.baseline);
      await action();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.busy = false;
      if (!this.closed) this.render();
    }
  }
  private apply(next: Project) {
    assertRevisionSource(this.getProject(), this.baseline);
    this.onApply(next);
    this.source = structuredClone(this.getProject());
    this.baseline = projectRevision(this.source);
    this.comparison = undefined;
    this.pending = "";
  }
  private render() {
    let records: ReturnType<typeof savedRevisions> = [];
    try {
      records = savedRevisions(this.source);
    } catch (e) {
      this.error = String(e);
    }
    const selected = records.find((r) => r.id === this.selected);
    const disabled = this.busy ? "disabled" : "";
    this.el.innerHTML = `<section role="dialog" aria-modal="true"><h2>${esc(tr("Projektstände & Freigaben", "Project Revisions & Approvals"))}</h2>
      <div class="pe-workspace"><aside class="pe-sidebar"><div class="pe-summary"><strong>${records.length}</strong> ${esc(tr("gespeicherte Stände", "saved revisions"))}<span>${esc(tr("Komprimiert in der Projektdatei · unveränderte Momentaufnahmen", "Compressed inside project file · immutable snapshots"))}</span></div>
      <div class="pe-revision-list">${
        [...records]
          .reverse()
          .map(
            (r) =>
              `<button class="pe-revision ${r.id === this.selected ? "is-active" : ""}" data-revision="${esc(r.id)}" ${disabled}><span class="pe-status ${r.status === "released" ? "pass" : ""}">${esc(r.status === "released" ? tr("✓ Freigegeben", "✓ Released") : tr("Gespeichert", "Saved"))}</span><strong>${esc(r.name)}</strong><span>${esc(r.author)} · ${formatEngineeringDate(r.created)}</span><small>${r.pages} ${esc(tr("Blätter", "sheets"))} · ${esc(r.reason)}</small></button>`,
          )
          .join("") || `<p>${esc(tr("Noch keine gespeicherten Stände.", "No saved revisions yet."))}</p>`
      }</div>
      <form data-save-form class="pe-card"><h3>${esc(tr("Aktuellen Arbeitsstand sichern", "Save Current Working State"))}</h3><label>${esc(tr("Name", "Name"))}<input class="form-input" data-name required maxlength="120" placeholder="${esc(tr("z. B. Entwurf 01", "e.g. Draft 01"))}"></label><label>${esc(tr("Bearbeiter", "Author"))}<input class="form-input" data-author required maxlength="120" value="${esc(this.source.author)}"></label><label>${esc(tr("Änderungsgrund", "Reason for Change"))}<textarea class="form-input" data-reason required maxlength="2000"></textarea></label><button class="btn btn-primary" ${disabled}>${esc(tr("Stand speichern", "Save Revision"))}</button></form></aside>
      <main class="pe-main">${
        selected
          ? `<div class="pe-card"><div class="pe-card-heading"><div><h3>${esc(selected.name)}</h3><p>${esc(selected.reason)}</p></div><span class="pe-status ${selected.status === "released" ? "pass" : ""}">${esc(selected.status === "released" ? tr("Freigegeben · schreibgeschützt", "Released · read-only") : tr("Gespeicherter Stand", "Saved Revision"))}</span></div><p>${esc(selected.author)} · ${formatEngineeringDate(selected.created)} · ${selected.pages} ${esc(tr("Blätter", "sheets"))}</p>${selected.approval ? `<p>${esc(tr("Freigabe:", "Approval:"))} ${esc(selected.approval.author)} · ${formatEngineeringDate(selected.approval.at)}<br>${esc(selected.approval.reason)}</p>` : ""}<details><summary>${esc(tr("Integritätsnachweis", "Integrity Proof"))}</summary><code class="pe-hash">SHA-256 ${selected.digest}</code><p>${esc(tr("Die Prüfsumme erkennt veränderte Nutzdaten. Die Freigabe ist eine dokumentierte Benutzerentscheidung, keine digitale Signatur.", "The checksum detects altered payload data. Approval is a documented user decision, not a cryptographic signature."))}</p></details><div class="pe-actions"><button class="btn" data-open ${disabled}>${esc(tr("Projektdatei dieses Stands", "Download Revision File"))}</button><button class="btn" data-restore ${disabled}>${esc(tr("Arbeitskopie daraus erstellen", "Create Working Copy"))}</button><button class="btn" data-release ${disabled} ${selected.status === "released" ? "disabled" : ""}>${esc(tr("Freigeben", "Release"))}</button><button class="btn" data-remove ${disabled} ${selected.status === "released" ? "disabled" : ""}>${esc(tr("Stand löschen", "Delete Revision"))}</button></div>${this.pending ? this.confirmationForm() : ""}</div>
      <div class="pe-card"><div class="pe-actions"><label>${esc(tr("Vergleichen mit", "Compare with"))}<select class="form-input" data-compare-to ${disabled}><option value="">${esc(tr("Aktuellem Arbeitsstand", "Current Working State"))}</option>${records
        .filter((r) => r.id !== selected.id)
        .map(
          (r) =>
            `<option value="${esc(r.id)}" ${r.id === this.compareTo ? "selected" : ""}>${esc(r.name)}</option>`,
        )
        .join(
          "",
        )}</select></label><button class="btn btn-primary" data-compare ${disabled}>${esc(tr("Vergleich berechnen", "Compute Comparison"))}</button></div><p>${esc(tr("Verglichen werden Objektidentitäten und gespeicherte Eigenschaften einschließlich Artikeln, Verbindungen und Projektierungsdaten.", "Compares object identities and stored properties including articles, connections, and engineering data."))}</p></div>
      <div data-comparison>${this.renderComparison()}</div>`
          : `<div class="pe-empty"><h3>${esc(tr("Ein nachvollziehbarer Projektverlauf", "Traceable Project History"))}</h3><p>${esc(tr("Speichere links den ersten Stand. Weitere Stände lassen sich feldgenau vergleichen und ausdrücklich freigeben.", "Save the first revision on the left. Additional revisions can be compared field-by-field and explicitly released."))}</p></div>`
      }</main></div>
      <p class="pe-error" role="alert">${esc(this.error)}</p><footer class="pe-actions"><span>${esc(this.busy ? tr("Projektstand wird geprüft …", "Validating project revision …") : tr("Stände bleiben bei Änderungen erhalten. Die Projektdatei regelmäßig speichern.", "Revisions are preserved across edits. Save the project file regularly."))}</span><button class="btn" data-register-pdf ${disabled}>${esc(tr("Revisionsliste PDF", "Revisions List PDF"))}</button><button class="btn" data-register-csv ${disabled}>CSV</button><button class="btn" data-reload ${disabled}>${esc(tr("Aktualisieren", "Refresh"))}</button><button class="btn" data-close ${disabled}>${esc(tr("Schließen", "Close"))}</button></footer></section>`;
    const q = <T extends HTMLElement = HTMLElement>(s: string) =>
      this.el.querySelector<T>(s)!;
    q("[data-close]").onclick = () => this.close();
    q("[data-reload]").onclick = () => {
      this.source = structuredClone(this.getProject());
      this.baseline = projectRevision(this.source);
      this.comparison = undefined;
      this.pending = "";
      this.error = "";
      this.render();
    };
    this.el.querySelectorAll<HTMLButtonElement>("[data-revision]").forEach(
      (b) =>
        (b.onclick = () => {
          this.selected = b.dataset.revision!;
          this.comparison = undefined;
          this.pending = "";
          this.error = "";
          this.offset = 0;
          this.render();
        }),
    );
    q<HTMLFormElement>("[data-save-form]").onsubmit = (e) => {
      e.preventDefault();
      const input = {
        name: q<HTMLInputElement>("[data-name]").value,
        author: q<HTMLInputElement>("[data-author]").value,
        reason: q<HTMLTextAreaElement>("[data-reason]").value,
      };
      void this.run(async () => {
        const next = await saveProjectRevision(this.source, input);
        this.apply(next);
        this.selected = next.revisions!.at(-1)!.id;
      });
    };
    q("[data-register-pdf]").onclick = () =>
      void this.run(() => {
        const rows = engineeringPdfRows(revisionReportRows(this.source));
        engineeringTablePdf(
          tr("Projektstände & Freigaben", "Project Revisions & Approvals"),
          revisionColumns,
          rows.map((r) => revisionColumns.map((_, i) => r.cells["c" + i])),
          this.source.name,
          this.source,
        ).save("schematico-revisionen.pdf");
      });
    q("[data-register-csv]").onclick = () =>
      void this.run(() =>
        downloadArticleFile(
          engineeringReportCsv(
            revisionColumns,
            revisionReportRows(this.source),
          ),
          "schematico-revisionen.csv",
          "text/csv;charset=utf-8",
        ),
      );
    if (selected) {
      q("[data-open]").onclick = () =>
        void this.run(async () => {
          const p = await readProjectRevision(selected);
          assertRevisionSource(this.getProject(), this.baseline);
          downloadArticleFile(
            JSON.stringify(p, null, 2),
            "schematico-projektstand.json",
            "application/json",
          );
        });
      for (const action of ["restore", "release", "remove"])
        q("[data-" + action + "]").onclick = () => {
          this.pending = action;
          this.render();
        };
      q<HTMLSelectElement>("[data-compare-to]").onchange = (e) => {
        this.compareTo = (e.target as HTMLSelectElement).value;
        this.comparison = undefined;
        this.render();
      };
      q("[data-compare]").onclick = () =>
        void this.run(async () => {
          const a = await readProjectRevision(selected),
            target = records.find((r) => r.id === this.compareTo),
            b = target ? await readProjectRevision(target) : this.source;
          assertRevisionSource(this.getProject(), this.baseline);
          this.comparison = compareProjectRevisions(
            a,
            b,
            selected.name,
            target?.name ?? tr("Aktueller Arbeitsstand", "Current Working State"),
          );
          this.comparedBefore = a;
          this.comparedAfter = b;
          this.pageId =
            this.comparison.changes.find((c) => c.pageId)?.pageId ??
            b.pages[0].id;
          this.offset = 0;
        });
      if(this.onImpact && !this.compareTo) {
        const button=document.createElement('button');button.className='btn';button.disabled=this.busy;
        button.textContent=tr('Änderungsfolgen bearbeiten','Review change impact');
        button.dataset.impact='';
        button.onclick=()=>void this.run(()=>{this.close();this.onImpact?.(selected.id);});
        q('[data-compare]').parentElement!.append(button);
      }
      q<HTMLFormElement>("[data-confirm-form]")?.addEventListener(
        "submit",
        (e) => {
          e.preventDefault();
          const author = q<HTMLInputElement>("[data-confirm-author]").value,
            reason = q<HTMLInputElement>("[data-confirm-reason]").value,
            action = this.pending;
          void this.run(async () =>
            this.apply(
              action === "restore"
                ? await restoreProjectRevision(
                    this.source,
                    selected.id,
                    author,
                    reason,
                  )
                : action === "release"
                  ? await releaseProjectRevision(
                      this.source,
                      selected.id,
                      author,
                      reason,
                    )
                  : removeProjectRevision(this.source, selected.id),
            ),
          );
        },
      );
      q("[data-cancel-action]")?.addEventListener("click", () => {
        this.pending = "";
        this.render();
      });
    }
    this.bindComparison();
    finishEngineeringDialog(this.el, {
      kind: "review",
      description: tr(
        "Projektstände sichern, Änderungen nachvollziehen und Freigaben dokumentieren",
        "Save project revisions, track changes, and document approvals",
      ),
      wide: true,
    });
    focusArticleModal(this.el);
  }
  private confirmationForm() {
    const label =
      this.pending === "restore"
        ? tr("Arbeitskopie erstellen", "Create Working Copy")
        : this.pending === "release"
          ? tr("Freigabe bestätigen", "Confirm Release")
          : tr("Gespeicherten Stand löschen", "Delete Saved Revision");
    return `<form data-confirm-form class="pe-confirm"><strong>${esc(label)}</strong><p>${esc(this.pending === "restore" ? tr("Der aktuelle Arbeitsstand wird vorher automatisch als eigener Sicherungsstand archiviert. Der gewählte Stand bleibt unverändert.", "The current working state is automatically archived as a backup revision first. The selected revision remains unchanged.") : this.pending === "release" ? tr("Dieser gespeicherte Stand wird gegen Löschen und weitere Freigabeänderungen geschützt. Spätere Projektänderungen erfolgen am Arbeitsstand.", "This saved revision is protected against deletion and further approval edits. Later project edits apply to the working copy.") : tr("Nur dieser nicht freigegebene Archivstand wird entfernt.", "Only this unreleased archive revision will be deleted."))}</p><label>${esc(tr("Bearbeiter", "Author"))}<input class="form-input" data-confirm-author required maxlength="120" value="${esc(this.source.author)}" ${this.busy ? "disabled" : ""}></label><label>${esc(tr("Grund", "Reason"))}<input class="form-input" data-confirm-reason required maxlength="2000" ${this.busy ? "disabled" : ""}></label><button class="btn btn-primary" ${this.busy ? "disabled" : ""}>${esc(label)}</button><button type="button" class="btn" data-cancel-action ${this.busy ? "disabled" : ""}>${esc(tr("Abbrechen", "Cancel"))}</button></form>`;
  }
  private renderComparison() {
    const report = this.comparison;
    if (!report || !this.comparedBefore || !this.comparedAfter) return "";
    const pages = [
      ...new Map(
        [...this.comparedBefore.pages, ...this.comparedAfter.pages].map((p) => [
          p.id,
          p,
        ]),
      ).values(),
    ];
    let drawing = "";
    try {
      drawing = `<div class="pe-drawings"><figure><figcaption>${esc(report.before)}</figcaption>${revisionDrawing(this.comparedBefore, this.pageId, report, "before")}</figure><figure><figcaption>${esc(report.after)}</figcaption>${revisionDrawing(this.comparedAfter, this.pageId, report, "after")}</figure></div>`;
    } catch {
      drawing = `<p>${esc(tr("Für dieses Blatt ist keine geometrische Vorschau verfügbar. Der vollständige Datenvergleich steht in der Liste und im Export.", "No geometric preview is available for this sheet. The complete data comparison is shown in the table and export."))}</p>`;
    }
    const changes = report.changes.filter(
      (c) =>
        !this.filter ||
        `${c.label} ${c.kind} ${c.pageNumber} ${c.fields.map((f) => f.path).join(" ")}`
          .toLocaleLowerCase()
          .includes(this.filter.toLocaleLowerCase()),
    );
    const value = (v: unknown) =>
      esc(
        (typeof v === "string" ? v : (JSON.stringify(v) ?? "—")).slice(0, 500),
      );
    return `<div class="pe-card"><div class="pe-metrics"><span class="pass">+ ${report.summary.added} ${esc(tr("hinzugefügt", "added"))}</span><span class="fail">− ${report.summary.removed} ${esc(tr("entfernt", "removed"))}</span><span class="changed">${report.summary.changed} ${esc(tr("geändert", "changed"))}</span></div><p>${esc(tr("Grün: hinzugefügt · Rot: entfernt · Gelb: geändert. Markierungen sind reine Vergleichsansichten.", "Green: added · Red: removed · Yellow: changed. Highlights are visual comparison aids only."))}</p><label>${esc(tr("Blatt", "Sheet"))}<select class="form-input" data-diff-page>${pages.map((p) => `<option value="${esc(p.id)}" ${p.id === this.pageId ? "selected" : ""}>${esc(p.pageNumber + " · " + p.title)}</option>`).join("")}</select></label>${drawing}<div class="pe-actions"><input class="form-input" data-diff-search placeholder="${esc(tr("Objekt, Blatt oder Feld suchen", "Search object, sheet, or field"))}" aria-label="${esc(tr("Änderungen suchen", "Search changes"))}" value="${esc(this.filter)}"><button class="btn" data-diff-json>${esc(tr("Vollständiger Vergleich JSON", "Full Comparison JSON"))}</button><button class="btn" data-diff-pdf>PDF</button><button class="btn" data-diff-prev ${this.offset === 0 ? "disabled" : ""}>‹</button><span>${changes.length ? this.offset + 1 : 0}–${Math.min(this.offset + 50, changes.length)} / ${changes.length}</span><button class="btn" data-diff-next ${this.offset + 50 >= changes.length ? "disabled" : ""}>›</button></div><div class="pe-table-scroll"><table class="pe-table"><thead><tr><th>${esc(tr("Blatt / Objekt", "Sheet / Object"))}</th><th>${esc(tr("Änderung", "Change"))}</th><th>${esc(tr("Vorher", "Before"))}</th><th>${esc(tr("Nachher", "After"))}</th></tr></thead><tbody>${
      changes
        .slice(this.offset, this.offset + 50)
        .map(
          (c) =>
            `<tr data-diff-row><td>${esc(c.pageNumber ?? tr("Projekt", "Project"))} · ${esc(c.kind)}<br><strong>${esc(c.label)}</strong><br>${esc(c.status)}</td><td>${c.fields
              .slice(0, 20)
              .map((f) => `<div>${esc(f.path)}</div>`)
              .join("")}</td><td>${c.fields
              .slice(0, 20)
              .map((f) => `<div>${value(f.before)}</div>`)
              .join("")}</td><td>${c.fields
              .slice(0, 20)
              .map((f) => `<div>${value(f.after)}</div>`)
              .join("")}</td></tr>`,
        )
        .join("") ||
      `<tr><td colspan="4">${esc(tr("Keine Änderungen für diesen Filter.", "No changes match this filter."))}</td></tr>`
    }</tbody></table></div><small>${esc(tr("Je Objekt werden bis zu 20 Felder und je Wert 500 Zeichen angezeigt. Der JSON-/PDF-Vergleich enthält sämtliche Änderungen.", "Up to 20 fields per object and 500 characters per value are displayed. The JSON/PDF comparison contains all changes."))}</small></div>`;
  }
  private bindComparison() {
    if (!this.comparison) return;
    const update = () => {
      this.el.querySelector("[data-comparison]")!.innerHTML =
        this.renderComparison();
      this.bindComparison();
    };
    this.el.querySelector<HTMLSelectElement>("[data-diff-page]")!.onchange = (
      e,
    ) => {
      this.pageId = (e.target as HTMLSelectElement).value;
      update();
    };
    this.el.querySelector<HTMLInputElement>("[data-diff-search]")!.onchange = (
      e,
    ) => {
      this.filter = (e.target as HTMLInputElement).value;
      this.offset = 0;
      update();
    };
    this.el.querySelector<HTMLButtonElement>("[data-diff-prev]")!.onclick =
      () => {
        this.offset = Math.max(0, this.offset - 50);
        update();
      };
    this.el.querySelector<HTMLButtonElement>("[data-diff-next]")!.onclick =
      () => {
        this.offset += 50;
        update();
      };
    this.el.querySelector<HTMLButtonElement>("[data-diff-json]")!.onclick =
      () =>
        void this.run(() =>
          downloadArticleFile(
            JSON.stringify(this.comparison, null, 2),
            "schematico-revisionsvergleich.json",
            "application/json",
          ),
        );
    this.el.querySelector<HTMLButtonElement>("[data-diff-pdf]")!.onclick = () =>
      void this.run(() => {
        const rows = engineeringPdfRows(comparisonReportRows(this.comparison!));
        engineeringTablePdf(
          tr("Revisionsvergleich", "Revision Comparison"),
          [
            tr("Blatt", "Sheet"),
            tr("Objekt", "Object"),
            tr("Änderung", "Change"),
            tr("Vorher", "Before"),
            tr("Nachher", "After"),
          ],
          rows.map((r) => [
            r.cells.c0,
            r.cells.c1,
            r.cells.c2,
            r.cells.c3,
            r.cells.c4,
          ]),
          this.source.name,
          this.source,
        ).save("schematico-revisionsvergleich.pdf");
      });
  }
}
