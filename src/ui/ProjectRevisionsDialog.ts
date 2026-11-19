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
    this.el.innerHTML = `<section role="dialog" aria-modal="true"><h2>Projektstände & Freigaben</h2>
      <div class="pe-workspace"><aside class="pe-sidebar"><div class="pe-summary"><strong>${records.length}</strong> gespeicherte Stände<span>Komprimiert in der Projektdatei · unveränderte Momentaufnahmen</span></div>
      <div class="pe-revision-list">${
        [...records]
          .reverse()
          .map(
            (r) =>
              `<button class="pe-revision ${r.id === this.selected ? "is-active" : ""}" data-revision="${esc(r.id)}" ${disabled}><span class="pe-status ${r.status === "released" ? "pass" : ""}">${r.status === "released" ? "✓ Freigegeben" : "Gespeichert"}</span><strong>${esc(r.name)}</strong><span>${esc(r.author)} · ${formatEngineeringDate(r.created)}</span><small>${r.pages} Blätter · ${esc(r.reason)}</small></button>`,
          )
          .join("") || "<p>Noch keine gespeicherten Stände.</p>"
      }</div>
      <form data-save-form class="pe-card"><h3>Aktuellen Arbeitsstand sichern</h3><label>Name<input class="form-input" data-name required maxlength="120" placeholder="z. B. Entwurf 01"></label><label>Bearbeiter<input class="form-input" data-author required maxlength="120" value="${esc(this.source.author)}"></label><label>Änderungsgrund<textarea class="form-input" data-reason required maxlength="2000"></textarea></label><button class="btn btn-primary" ${disabled}>Stand speichern</button></form></aside>
      <main class="pe-main">${
        selected
          ? `<div class="pe-card"><div class="pe-card-heading"><div><h3>${esc(selected.name)}</h3><p>${esc(selected.reason)}</p></div><span class="pe-status ${selected.status === "released" ? "pass" : ""}">${selected.status === "released" ? "Freigegeben · schreibgeschützt" : "Gespeicherter Stand"}</span></div><p>${esc(selected.author)} · ${formatEngineeringDate(selected.created)} · ${selected.pages} Blätter</p>${selected.approval ? `<p>Freigabe: ${esc(selected.approval.author)} · ${formatEngineeringDate(selected.approval.at)}<br>${esc(selected.approval.reason)}</p>` : ""}<details><summary>Integritätsnachweis</summary><code class="pe-hash">SHA-256 ${selected.digest}</code><p>Die Prüfsumme erkennt veränderte Nutzdaten. Die Freigabe ist eine dokumentierte Benutzerentscheidung, keine digitale Signatur.</p></details><div class="pe-actions"><button class="btn" data-open ${disabled}>Projektdatei dieses Stands</button><button class="btn" data-restore ${disabled}>Arbeitskopie daraus erstellen</button><button class="btn" data-release ${disabled} ${selected.status === "released" ? "disabled" : ""}>Freigeben</button><button class="btn" data-remove ${disabled} ${selected.status === "released" ? "disabled" : ""}>Stand löschen</button></div>${this.pending ? this.confirmationForm() : ""}</div>
      <div class="pe-card"><div class="pe-actions"><label>Vergleichen mit<select class="form-input" data-compare-to ${disabled}><option value="">Aktuellem Arbeitsstand</option>${records
        .filter((r) => r.id !== selected.id)
        .map(
          (r) =>
            `<option value="${esc(r.id)}" ${r.id === this.compareTo ? "selected" : ""}>${esc(r.name)}</option>`,
        )
        .join(
          "",
        )}</select></label><button class="btn btn-primary" data-compare ${disabled}>Vergleich berechnen</button></div><p>Verglichen werden Objektidentitäten und gespeicherte Eigenschaften einschließlich Artikeln, Verbindungen und Projektierungsdaten.</p></div>
      <div data-comparison>${this.renderComparison()}</div>`
          : '<div class="pe-empty"><h3>Ein nachvollziehbarer Projektverlauf</h3><p>Speichere links den ersten Stand. Weitere Stände lassen sich feldgenau vergleichen und ausdrücklich freigeben.</p></div>'
      }</main></div>
      <p class="pe-error" role="alert">${esc(this.error)}</p><footer class="pe-actions"><span>${this.busy ? "Projektstand wird geprüft …" : "Stände bleiben bei Änderungen erhalten. Die Projektdatei regelmäßig speichern."}</span><button class="btn" data-register-pdf ${disabled}>Revisionsliste PDF</button><button class="btn" data-register-csv ${disabled}>CSV</button><button class="btn" data-reload ${disabled}>Aktualisieren</button><button class="btn" data-close ${disabled}>Schließen</button></footer></section>`;
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
          "Projektstände & Freigaben",
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
            target?.name ?? "Aktueller Arbeitsstand",
          );
          this.comparedBefore = a;
          this.comparedAfter = b;
          this.pageId =
            this.comparison.changes.find((c) => c.pageId)?.pageId ??
            b.pages[0].id;
          this.offset = 0;
        });
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
      description:
        "Projektstände sichern, Änderungen nachvollziehen und Freigaben dokumentieren",
      wide: true,
    });
    focusArticleModal(this.el);
  }
  private confirmationForm() {
    const label =
      this.pending === "restore"
        ? "Arbeitskopie erstellen"
        : this.pending === "release"
          ? "Freigabe bestätigen"
          : "Gespeicherten Stand löschen";
    return `<form data-confirm-form class="pe-confirm"><strong>${label}</strong><p>${this.pending === "restore" ? "Der aktuelle Arbeitsstand wird vorher automatisch als eigener Sicherungsstand archiviert. Der gewählte Stand bleibt unverändert." : this.pending === "release" ? "Dieser gespeicherte Stand wird gegen Löschen und weitere Freigabeänderungen geschützt. Spätere Projektänderungen erfolgen am Arbeitsstand." : "Nur dieser nicht freigegebene Archivstand wird entfernt."}</p><label>Bearbeiter<input class="form-input" data-confirm-author required maxlength="120" value="${esc(this.source.author)}" ${this.busy ? "disabled" : ""}></label><label>Grund<input class="form-input" data-confirm-reason required maxlength="2000" ${this.busy ? "disabled" : ""}></label><button class="btn btn-primary" ${this.busy ? "disabled" : ""}>${label}</button><button type="button" class="btn" data-cancel-action ${this.busy ? "disabled" : ""}>Abbrechen</button></form>`;
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
      drawing =
        "<p>Für dieses Blatt ist keine geometrische Vorschau verfügbar. Der vollständige Datenvergleich steht in der Liste und im Export.</p>";
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
    return `<div class="pe-card"><div class="pe-metrics"><span class="pass">+ ${report.summary.added} hinzugefügt</span><span class="fail">− ${report.summary.removed} entfernt</span><span class="changed">${report.summary.changed} geändert</span></div><p>Grün: hinzugefügt · Rot: entfernt · Gelb: geändert. Markierungen sind reine Vergleichsansichten.</p><label>Blatt<select class="form-input" data-diff-page>${pages.map((p) => `<option value="${esc(p.id)}" ${p.id === this.pageId ? "selected" : ""}>${esc(p.pageNumber + " · " + p.title)}</option>`).join("")}</select></label>${drawing}<div class="pe-actions"><input class="form-input" data-diff-search placeholder="Objekt, Blatt oder Feld suchen" aria-label="Änderungen suchen" value="${esc(this.filter)}"><button class="btn" data-diff-json>Vollständiger Vergleich JSON</button><button class="btn" data-diff-pdf>PDF</button><button class="btn" data-diff-prev ${this.offset === 0 ? "disabled" : ""}>‹</button><span>${changes.length ? this.offset + 1 : 0}–${Math.min(this.offset + 50, changes.length)} / ${changes.length}</span><button class="btn" data-diff-next ${this.offset + 50 >= changes.length ? "disabled" : ""}>›</button></div><div class="pe-table-scroll"><table class="pe-table"><thead><tr><th>Blatt / Objekt</th><th>Änderung</th><th>Vorher</th><th>Nachher</th></tr></thead><tbody>${
      changes
        .slice(this.offset, this.offset + 50)
        .map(
          (c) =>
            `<tr data-diff-row><td>${esc(c.pageNumber ?? "Projekt")} · ${esc(c.kind)}<br><strong>${esc(c.label)}</strong><br>${esc(c.status)}</td><td>${c.fields
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
      '<tr><td colspan="4">Keine Änderungen für diesen Filter.</td></tr>'
    }</tbody></table></div><small>Je Objekt werden bis zu 20 Felder und je Wert 500 Zeichen angezeigt. Der JSON-/PDF-Vergleich enthält sämtliche Änderungen.</small></div>`;
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
          "Revisionsvergleich",
          ["Blatt", "Objekt", "Änderung", "Vorher", "Nachher"],
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
