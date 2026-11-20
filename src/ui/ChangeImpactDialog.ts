import type { Project } from "../model/types";
import type { ComponentAddress } from "../model/ArticleTypes";
import {
  analyzeChangeImpact,
  assertImpactSource,
  impactCheckLabel,
  impactStatusLabel,
  impactProposalPreview,
  applyImpactProposals,
  reviewChangeImpacts,
  type ChangeImpactReport,
  type ImpactStatus,
  type ImpactRow,
} from "../model/ChangeImpact";
import {
  savedRevisions,
  readProjectRevision,
  compareProjectRevisions,
} from "../model/ProjectRevisions";
import { projectRevision } from "../layout/types";
import { engineeringTablePdf } from "../export/EngineeringTablePdf";
import {
  engineeringReportCsv,
  engineeringPdfRows,
} from "../reports/EngineeringCalculations";
import type { ReportRow } from "../reports/ManufacturingReports";
import { escapeSvg as esc } from "../model/ImportedDrawing";
import { bindArticleModalKeys, focusArticleModal } from "./ArticleModal";
import {
  finishEngineeringDialog,
  formatEngineeringDate,
} from "./EngineeringDialog";
import { downloadArticleFile } from "./ArticleCatalogDialog";
import { tr } from "../i18n";
import "./ProjectEngineering.css";
import "./ChangeImpactDialog.css";

export interface ImpactNavigation {
  circuit: (id: string) => void;
  articles: (addresses: ComponentAddress[]) => void;
  wiring: () => void;
  revisions: () => void;
}
export class ChangeImpactDialog {
  private el = document.createElement("div");
  private source: Project;
  private report?: ChangeImpactReport;
  private selected: string;
  private busy = false;
  private closed = false;
  private error = "";
  private filter = "all";
  private search = "";
  private selectedRows = new Set<string>();
  private selectedProposals = new Set<string>();
  private preview?: ReturnType<typeof impactProposalPreview>;
  private confirmLength = false;
  private author = "";
  private reason = "";
  private status: ImpactStatus = "in_progress";
  constructor(
    private getProject: () => Project,
    private onApply: (p: Project) => void,
    private navigation: ImpactNavigation,
    initialBaselineId?: string,
  ) {
    this.source = structuredClone(getProject());
    const records = this.records();
    this.selected =
      initialBaselineId ??
      [...records].reverse().find((r) => r.status === "released")?.id ??
      records.at(-1)?.id ??
      "";
    this.author = this.source.author;
  }
  private records() {
    try {
      return savedRevisions(this.source);
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      return [];
    }
  }
  show() {
    if (document.getElementById("changeImpactDialog")) return;
    this.el.id = "changeImpactDialog";
    this.el.className = "modal-backdrop";
    this.el.style.cssText =
      "position:fixed;inset:0;z-index:4200;display:flex;align-items:center;justify-content:center";
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => {
      if (!this.busy) this.close();
    });
    this.render();
    if (this.selected) void this.analyze();
  }
  private close() {
    this.closed = true;
    this.el.remove();
  }
  private jump(action: () => void) {
    if (this.busy) return;
    try {
      if (this.report) assertImpactSource(this.getProject(), this.report);
      this.close();
      action();
    } catch (e) {
      this.error = String(e);
      this.render();
    }
  }
  private async run(action: () => void | Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    this.render();
    try {
      await action();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.busy = false;
      if (!this.closed) this.render();
    }
  }
  private async analyze() {
    await this.run(async () => {
      this.source = structuredClone(this.getProject());
      const sourceRevision = projectRevision(this.source),
        revision = savedRevisions(this.source).find(
          (r) => r.id === this.selected,
        );
      this.report = undefined;
      this.preview = undefined;
      this.selectedRows.clear();
      this.selectedProposals.clear();
      this.confirmLength = false;
      if (!revision)
        throw Error(
          tr("Referenzstand auswählen.", "Select a reference revision."),
        );
      const before = await readProjectRevision(revision);
      const report = await analyzeChangeImpact(before, this.source, revision);
      if (projectRevision(this.getProject()) !== sourceRevision)
        throw Error(
          tr(
            "Der Arbeitsstand hat sich geändert. Analyse neu berechnen.",
            "The working state has changed. Refresh the analysis.",
          ),
        );
      this.report = report;
    });
  }
  private async apply(next: Project) {
    assertImpactSource(this.getProject(), this.report!);
    this.onApply(next);
    // Refresh from the actual resulting project, preserving the immutable baseline.
    this.source = structuredClone(this.getProject());
    const baseline = savedRevisions(this.source).find(
      (r) => r.id === this.selected,
    )!;
    this.report = await analyzeChangeImpact(
      await readProjectRevision(baseline),
      this.source,
      baseline,
    );
    assertImpactSource(this.getProject(), this.report);
    this.preview = undefined;
    this.selectedRows.clear();
    this.selectedProposals.clear();
  }
  private columns() {
    return [
      tr("Aufgabe / Objekt", "Task / object"),
      tr("Status", "Status"),
      tr("Änderungsursache", "Cause"),
      tr("Erneut prüfen / ausgeben", "Review / regenerate"),
      tr("Bearbeiter / Begründung", "Author / reason"),
    ];
  }
  private exportRows(): ReportRow[] {
    const r = this.report!;
    return [
      {
        key: "context",
        pages: [],
        targets: [],
        cells: {
          c0: tr("Referenz / Arbeitsstand", "Reference / working state"),
          c1: r.baseline.name,
          c2: `${r.baseline.status} · ${r.baseline.created}\nSHA-256 ${r.baseline.digest}`,
          c3: `${r.generatedAt}\nSHA-256 ${r.workingDigest}`,
          c4: tr(
            "Nachverfolgung ist keine elektrische Freigabe.",
            "Task tracking is not electrical approval.",
          ),
        },
      },
      ...r.rows.map((row) => ({
        key: row.key,
        pages: [],
        targets: [],
        cells: {
          c0: row.label,
          c1: impactStatusLabel(row.decision?.status ?? "open"),
          c2: row.causes
            .map(
              (c) =>
                `${c.change.pageNumber ?? ""} ${c.change.label} · ${c.reason}`,
            )
            .join("\n"),
          c3: [...row.checks.map(impactCheckLabel), ...row.documents].join(
            "\n",
          ),
          c4: row.decision
            ? `${row.decision.author} · ${row.decision.at}\n${row.decision.reason}`
            : "",
        },
      })),
    ];
  }
  private renderRow(row: ImpactRow, index: number) {
    const status = row.decision?.status ?? "open";
    return `<article class="ci-task pe-card"><div class="pe-card-heading"><label class="ci-row-title"><input type="checkbox" data-task="${index}" ${this.selectedRows.has(row.key) ? "checked" : ""} ${this.busy ? "disabled" : ""}><strong>${esc(row.label)}</strong></label><span class="pe-status ${status === "reviewed" ? "pass" : ""}">${esc(impactStatusLabel(status))}</span></div>
    <p class="ci-kind">${esc(row.kind === "circuit" ? tr("Stromkreis · Nachweise neu bewerten", "Circuit · reassess verification") : row.kind === "unassigned" ? tr("Zuordnung / Auswirkung manuell prüfen", "Review assignment / impact manually") : tr("Dokumentationsänderung", "Documentation change"))}</p>
    <div class="ci-checks">${row.checks.map((c) => `<span>${esc(impactCheckLabel(c))}</span>`).join("")}${row.documents.map((d) => `<span>${esc(d)}</span>`).join("")}</div>
    <details><summary>${row.causes.length} ${esc(tr("Änderungsursachen anzeigen", "show change causes"))}</summary>${row.causes
      .slice(0, 40)
      .map(
        (c) =>
          `<p><strong>${esc(c.change.pageNumber ?? "")} ${esc(c.change.label)}</strong> · ${esc(c.change.status)}<br><small>${esc(c.reason)}</small></p>`,
      )
      .join(
        "",
      )}${row.causes.length > 40 ? `<p>${esc(tr("Vollständige Ursachen im JSON-Export.", "Full causes in the JSON export."))}</p>` : ""}</details>
    ${row.decision ? `<p class="ci-decision">${esc(row.decision.author)} · ${formatEngineeringDate(row.decision.at)}<br>${esc(row.decision.reason)}</p>` : ""}
    <div class="pe-actions">${row.circuitId && this.source.dimensioning?.some((r) => r.id === row.circuitId) ? `<button class="btn" data-circuit="${index}">${esc(tr("Dimensionierung öffnen", "Open dimensioning"))}</button>` : ""}${row.addresses.length ? `<button class="btn" data-articles="${index}">${esc(tr("Artikel bearbeiten", "Edit parts"))}</button>` : ""}${row.checks.includes("connections") ? `<button class="btn" data-wiring>${esc(tr("Verbindungen prüfen", "Review connections"))}</button>` : ""}</div></article>`;
  }
  private render() {
    const scrollMain = this.el.querySelector(".pe-main")?.scrollTop ?? 0;
    const scrollSide = this.el.querySelector(".pe-sidebar")?.scrollTop ?? 0;
    const proposalsOpen =
      this.el.querySelector<HTMLDetailsElement>(".ci-proposals")?.open;
    const records = this.records(),
      r = this.report,
      d = this.busy ? "disabled" : "";
    const rows = (r?.rows ?? []).filter(
      (row) =>
        (this.filter === "all" || this.filter === "open"
          ? this.filter !== "open" || row.decision?.status !== "reviewed"
          : row.kind === this.filter) &&
        (!this.search ||
          [row.label, ...row.causes.map((c) => c.change.label)]
            .join(" ")
            .toLocaleLowerCase()
            .includes(this.search.toLocaleLowerCase())),
    );
    this.el.innerHTML = `<section role="dialog" aria-modal="true"><h2>${esc(tr("Änderungsfolgen", "Change impact"))}</h2><div class="pe-workspace"><aside class="pe-sidebar">
      <div class="pe-card"><label>${esc(tr("Referenzstand", "Reference revision"))}<select class="form-input" data-baseline ${d}><option value="">${esc(tr("Stand auswählen", "Select revision"))}</option>${[
        ...records,
      ]
        .reverse()
        .map(
          (b) =>
            `<option value="${esc(b.id)}" ${b.id === this.selected ? "selected" : ""}>${esc(b.name)} · ${esc(b.status === "released" ? tr("freigegeben", "released") : tr("gespeichert", "saved"))}</option>`,
        )
        .join(
          "",
        )}</select></label><button class="btn btn-primary" data-refresh ${d} ${!this.selected ? "disabled" : ""}>${esc(tr("Analyse aktualisieren", "Refresh analysis"))}</button><button class="btn" data-revisions ${d}>${esc(tr("Projektstände & Freigaben", "Project revisions & approvals"))}</button></div>
      ${
        r
          ? `<div class="ci-stats"><div><strong>${r.rows.filter((row) => row.kind === "circuit").length}</strong><span>${esc(tr("Stromkreise", "Circuits"))}</span></div><div><strong>${r.rows.filter((row) => row.kind === "unassigned").length}</strong><span>${esc(tr("Zuordnung prüfen", "Check assignment"))}</span></div><div><strong>${r.rows.filter((row) => row.decision?.status !== "reviewed").length}</strong><span>${esc(tr("Offene Aufgaben", "Open tasks"))}</span></div></div><label>${esc(tr("Ansicht", "View"))}<select class="form-input" data-filter><option value="all">${esc(tr("Alle Aufgaben", "All tasks"))}</option><option value="open">${esc(tr("Noch nicht nachgeprüft", "Not yet reviewed"))}</option><option value="circuit">${esc(tr("Stromkreise", "Circuits"))}</option><option value="unassigned">${esc(tr("Zuordnung prüfen", "Check assignment"))}</option><option value="documents">${esc(tr("Unterlagen", "Documents"))}</option></select></label><input class="form-input" data-search aria-label="${esc(tr("Aufgaben suchen", "Search tasks"))}" placeholder="${esc(tr("Objekt / Stromkreis suchen", "Find object / circuit"))}" value="${esc(this.search)}">
      <form class="pe-card" data-review><h3>${esc(tr("Auswahl nachverfolgen", "Track selected tasks"))}</h3><p>${this.selectedRows.size} ${esc(tr("ausgewählt", "selected"))}</p><select class="form-input" data-status ${d}>${(["open", "in_progress", "reviewed"] as const).map((s) => `<option value="${s}" ${s === this.status ? "selected" : ""}>${esc(impactStatusLabel(s))}</option>`).join("")}</select><label>${esc(tr("Bearbeiter", "Author"))}<input class="form-input" data-author required maxlength="120" value="${esc(this.author)}" ${d}></label><label>${esc(tr("Begründung / Prüfvermerk", "Reason / review note"))}<textarea class="form-input" data-reason required maxlength="2000" ${d}>${esc(this.reason)}</textarea></label><button class="btn" ${d} ${!this.selectedRows.size ? "disabled" : ""}>${esc(tr("Status speichern", "Save status"))}</button><small>${esc(tr("Nachverfolgung ersetzt keine elektrische Prüfung oder Freigabe. Neue relevante Änderungen öffnen die Aufgabe erneut.", "Task tracking does not replace electrical verification or approval. New relevant changes reopen the task."))}</small></form>`
          : ""
      }
      </aside><main class="pe-main">${
        r
          ? `<div class="pe-card ci-baseline"><h3>${esc(r.baseline.name)} → ${esc(tr("Aktueller Arbeitsstand", "Current working state"))}</h3><p>${esc(r.baseline.status === "released" && r.workingChanged ? tr("Der Arbeitsstand weicht vom freigegebenen Stand ab. Dessen Freigabe bleibt unverändert; ein neuer Stand muss gesondert freigegeben werden.", "The working state differs from the released revision. Its approval remains unchanged; a new revision requires separate approval.") : r.workingChanged ? tr("Änderungen gegenüber dem gespeicherten Referenzstand.", "Changes compared with the saved reference revision.") : tr("Keine inhaltlichen Änderungen gegenüber dem Referenzstand.", "No content changes compared with the reference revision."))}</p><small>${esc(tr("Betroffene Prüffamilien sind Hinweise zur Nachprüfung. Optionale Nachweise werden nicht automatisch aktiviert. Exportierte Dateien müssen erneut ausgegeben werden.", "Affected check families indicate review scope. Optional checks are not automatically enabled. Exported files need to be regenerated."))}</small></div>
      ${r.diagnostics.length ? `<div class="pe-card pe-error">${r.diagnostics.map((t) => `<p>${esc(t)}</p>`).join("")}</div>` : ""}
      ${r.proposals.length ? `<details class="pe-card ci-proposals"><summary>${r.proposals.length} ${esc(tr("konkrete Übernahmevorschläge", "concrete adoption proposals"))}</summary><p>${esc(tr("Nur die Berechnungszuordnung wird angepasst. Kennwerte stammen aus dem zugeordneten Artikel; fehlende Angaben bleiben offen.", "Only calculation associations are updated. Ratings come from the assigned part; missing data remains unresolved."))}</p>${r.proposals.map((p, i) => `<label class="ci-proposal"><input type="checkbox" data-proposal="${i}" ${this.selectedProposals.has(p.id) ? "checked" : ""} ${d}><span><strong>${esc(p.label)}</strong><br>${esc(p.article ? [p.article.manufacturer, p.article.articleNumber, p.article.variant].filter(Boolean).join(" · ") : JSON.stringify(p.values))}<small>${esc(p.note)}</small></span></label>`).join("")}<label class="ci-proposal"><input type="checkbox" data-full-length ${this.confirmLength ? "checked" : ""} ${d}>${esc(tr("Ausgewählte Bezugsverbindungen repräsentieren die jeweilige vollständige Stromkreis-Leitungslänge.", "Selected reference connections represent the respective full circuit conductor length."))}</label><div class="pe-actions"><button class="btn" data-preview ${d} ${!this.selectedProposals.size ? "disabled" : ""}>${esc(tr("Änderungen vorschauen", "Preview changes"))}</button></div>${this.renderPreview()}</details>` : ""}
      <div class="pe-actions"><button class="btn" data-select-visible ${d}>${esc(tr("Sichtbare auswählen", "Select visible"))}</button><button class="btn" data-clear ${d}>${esc(tr("Auswahl aufheben", "Clear selection"))}</button><span>${rows.length} / ${r.rows.length}</span></div>
      ${
        rows
          .slice(0, 100)
          .map((row) => this.renderRow(row, r.rows.indexOf(row)))
          .join("") ||
        `<div class="pe-empty">${esc(tr("Keine Aufgaben in dieser Ansicht.", "No tasks in this view."))}</div>`
      }${rows.length > 100 ? `<p>${esc(tr("Ansicht auf 100 Aufgaben begrenzt. Bitte Suche oder Filter verwenden; Exporte enthalten alle Aufgaben.", "View limited to 100 tasks. Use search or filters; exports contain all tasks."))}</p>` : ""}`
          : `<div class="pe-empty"><h3>${esc(tr("Änderungen nachvollziehbar abarbeiten", "Work through changes with traceable evidence"))}</h3><p>${esc(records.length ? tr("Referenzstand auswählen und Analyse starten.", "Select a reference revision and start the analysis.") : tr("Zuerst unter Projektstände & Freigaben einen Referenzstand speichern. Danach lassen sich Änderungen am Arbeitsstand auswerten.", "First save a reference revision under Project revisions & approvals. Later changes to the working state can then be analyzed."))}</p></div>`
      }</main></div>
      <p class="pe-error" role="alert">${esc(this.error)}</p><footer class="pe-actions"><span>${esc(this.busy ? tr("Analyse wird berechnet …", "Computing analysis …") : tr("Analyse erfolgt auf Anforderung · Korrekturen mit Vorschau und Rückgängig", "Analysis on request · corrections with preview and undo"))}</span>${r ? `<button class="btn" data-json ${d}>JSON</button><button class="btn" data-csv ${d}>CSV</button><button class="btn" data-pdf ${d}>PDF</button>` : ""}<button class="btn" data-close ${d}>${esc(tr("Schließen", "Close"))}</button></footer></section>`;
    const q = <T extends HTMLElement = HTMLElement>(s: string) =>
      this.el.querySelector<T>(s)!;
    q("[data-close]").onclick = () => this.close();
    q("[data-revisions]").onclick = () => this.jump(this.navigation.revisions);
    q("[data-refresh]").onclick = () => void this.analyze();
    q<HTMLSelectElement>("[data-baseline]").onchange = (e) => {
      this.selected = (e.target as HTMLSelectElement).value;
      this.report = undefined;
      void this.analyze();
    };
    if (r) {
      q<HTMLSelectElement>("[data-filter]").value = this.filter;
      q<HTMLSelectElement>("[data-filter]").onchange = (e) => {
        this.filter = (e.target as HTMLSelectElement).value;
        this.render();
      };
      q<HTMLInputElement>("[data-search]").onchange = (e) => {
        this.search = (e.target as HTMLInputElement).value;
        this.render();
      };
      this.el.querySelectorAll<HTMLInputElement>("[data-task]").forEach(
        (b) =>
          (b.onchange = () => {
            const key = r.rows[Number(b.dataset.task)].key;
            b.checked
              ? this.selectedRows.add(key)
              : this.selectedRows.delete(key);
            this.render();
          }),
      );
      q("[data-select-visible]").onclick = () => {
        rows.slice(0, 100).forEach((row) => this.selectedRows.add(row.key));
        this.render();
      };
      q("[data-clear]").onclick = () => {
        this.selectedRows.clear();
        this.render();
      };
      q<HTMLInputElement>("[data-author]").oninput = (e) =>
        (this.author = (e.target as HTMLInputElement).value);
      q<HTMLTextAreaElement>("[data-reason]").oninput = (e) =>
        (this.reason = (e.target as HTMLTextAreaElement).value);
      q<HTMLSelectElement>("[data-status]").onchange = (e) =>
        (this.status = (e.target as HTMLSelectElement).value as ImpactStatus);
      q<HTMLFormElement>("[data-review]").onsubmit = (e) => {
        e.preventDefault();
        void this.run(() =>
          this.apply(
            reviewChangeImpacts(
              this.getProject(),
              r,
              [...this.selectedRows],
              this.status,
              this.author,
              this.reason,
            ),
          ),
        );
      };
      this.el
        .querySelectorAll<HTMLElement>("[data-circuit]")
        .forEach(
          (b) =>
            (b.onclick = () =>
              this.jump(() =>
                this.navigation.circuit(
                  r.rows[Number(b.dataset.circuit)].circuitId!,
                ),
              )),
        );
      this.el
        .querySelectorAll<HTMLElement>("[data-articles]")
        .forEach(
          (b) =>
            (b.onclick = () =>
              this.jump(() =>
                this.navigation.articles(
                  r.rows[Number(b.dataset.articles)].addresses,
                ),
              )),
        );
      this.el
        .querySelectorAll<HTMLElement>("[data-wiring]")
        .forEach((b) => (b.onclick = () => this.jump(this.navigation.wiring)));
      this.el.querySelectorAll<HTMLInputElement>("[data-proposal]").forEach(
        (b) =>
          (b.onchange = () => {
            const id = r.proposals[Number(b.dataset.proposal)].id;
            b.checked
              ? this.selectedProposals.add(id)
              : this.selectedProposals.delete(id);
            this.preview = undefined;
            this.render();
            this.el.querySelector<HTMLDetailsElement>(".ci-proposals")!.open =
              true;
          }),
      );
      q<HTMLInputElement>("[data-full-length]")?.addEventListener(
        "change",
        (e) => {
          this.confirmLength = (e.target as HTMLInputElement).checked;
          this.preview = undefined;
          this.render();
          this.el.querySelector<HTMLDetailsElement>(".ci-proposals")!.open =
            true;
        },
      );
      q("[data-preview]")?.addEventListener(
        "click",
        () =>
          void this.run(() => {
            this.preview = impactProposalPreview(
              this.getProject(),
              r,
              [...this.selectedProposals],
              this.confirmLength,
            );
          }),
      );
      q("[data-apply-proposals]")?.addEventListener(
        "click",
        () =>
          void this.run(() =>
            this.apply(
              applyImpactProposals(
                this.getProject(),
                r,
                [...this.selectedProposals],
                this.confirmLength,
              ),
            ),
          ),
      );
      q("[data-json]").onclick = () =>
        void this.run(() => {
          assertImpactSource(this.getProject(), r);
          downloadArticleFile(
            JSON.stringify(r, null, 2),
            "schematico-aenderungsfolgen.json",
            "application/json",
          );
        });
      q("[data-csv]").onclick = () =>
        void this.run(() => {
          assertImpactSource(this.getProject(), r);
          downloadArticleFile(
            engineeringReportCsv(this.columns(), this.exportRows()),
            "schematico-aenderungsfolgen.csv",
            "text/csv;charset=utf-8",
          );
        });
      q("[data-pdf]").onclick = () =>
        void this.run(() => {
          assertImpactSource(this.getProject(), r);
          const columns = this.columns();
          engineeringTablePdf(
            `${tr("Änderungsfolgen", "Change impact")} · ${r.baseline.name} -> ${tr("Arbeitsstand", "Working state")}`,
            columns,
            engineeringPdfRows(this.exportRows()).map((row) =>
              columns.map((_, i) => row.cells["c" + i]),
            ),
            this.source.name,
            this.source,
          ).save("schematico-aenderungsfolgen.pdf");
        });
    }
    const proposalDetails =
      this.el.querySelector<HTMLDetailsElement>(".ci-proposals");
    if (proposalDetails && (this.preview || proposalsOpen))
      proposalDetails.open = true;
    finishEngineeringDialog(this.el, {
      kind: "review",
      description: tr(
        "Änderungen zuordnen, Nachweise prüfen und Unterlagen nachführen",
        "Assign changes, review verification, and update documents",
      ),
      wide: true,
    });
    focusArticleModal(this.el);
    this.el.querySelector(".pe-main")!.scrollTop = scrollMain;
    this.el.querySelector(".pe-sidebar")!.scrollTop = scrollSide;
  }
  private renderPreview() {
    if (!this.preview) return "";
    return `<div class="ci-preview"><h3>${esc(tr("Konkrete Änderungsvorschau", "Exact change preview"))}</h3>${this.preview
      .map((p) => {
        const changes = compareProjectRevisions(
          { ...this.source, dimensioning: [p.before] },
          { ...this.source, dimensioning: [p.after] },
        );
        return `<h4>${esc(p.name)}</h4><div class="pe-table-scroll"><table class="pe-table"><thead><tr><th>${esc(tr("Feld", "Field"))}</th><th>${esc(tr("Vorher", "Before"))}</th><th>${esc(tr("Nachher", "After"))}</th></tr></thead><tbody>${changes.changes
          .flatMap((c) => c.fields)
          .map(
            (f) =>
              `<tr><td>${esc(f.path)}</td><td>${esc(JSON.stringify(f.before) ?? "—")}</td><td>${esc(JSON.stringify(f.after) ?? "—")}</td></tr>`,
          )
          .join(
            "",
          )}</tbody></table></div><p>${esc(tr("Berechnung nach Übernahme", "Calculation after adoption"))}: ${esc(p.result.status)} · ${p.result.checks
          .filter((c) => c.status === "missing" || c.status === "fail")
          .map((c) => esc(c.label))
          .join(", ")}</p>`;
      })
      .join(
        "",
      )}<button class="btn btn-primary" data-apply-proposals ${this.busy ? "disabled" : ""}>${esc(tr("Angezeigte Änderungen gemeinsam übernehmen", "Apply displayed changes together"))}</button><p>${esc(tr("Ein rückgängig machbarer Schritt. Aufgaben werden dadurch nicht als nachgeprüft markiert.", "One undoable step. Tasks are not marked reviewed by applying changes."))}</p></div>`;
  }
}
