import type { Project } from "../model/types";
import type { ComponentAddress } from "../model/ArticleTypes";
import {
  InspectionRepairSession,
  repairUnits,
} from "../model/InspectionRepair";
import { effectiveArticles } from "../model/ArticleAssignments";
import { escapeSvg as esc } from "../model/ImportedDrawing";
import { t, type TranslationKey } from "../i18n";
import { finishEngineeringDialog } from "./EngineeringDialog";
import { bindArticleModalKeys, focusArticleModal } from "./ArticleModal";
import { ArticleWorkbenchDialog } from "./ArticleWorkbenchDialog";
import { ArticleFunctionDialog } from "./ArticleFunctionDialog";
import { articleError, downloadArticleFile } from "./ArticleCatalogDialog";
export class InspectionRepairDialog {
  private view?: {
    project: Project;
    report: ReturnType<InspectionRepairSession["report"]>;
    comparison: ReturnType<InspectionRepairSession["comparison"]>;
    units: ReturnType<typeof repairUnits>;
    modified: ComponentAddress[];
  };
  private el = document.createElement("div");
  private session: InspectionRepairSession;
  private selected = "";
  private search = "";
  private offset = 0;
  private error = "";
  private reviewed = false;
  constructor(
    private getProject: () => Project,
    private onApply: (project: Project) => void,
    private addresses: ComponentAddress[],
    private onClose: () => void,
  ) {
    this.session = new InspectionRepairSession(getProject());
  }
  show() {
    if (document.getElementById("inspectionRepairDialog")) return;
    this.el.id = "inspectionRepairDialog";
    this.el.className = "modal-backdrop";
    this.el.style.cssText =
      "position:fixed;inset:0;z-index:4100;display:flex;align-items:center;justify-content:center";
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => this.close());
    this.render();
  }
  private close() {
    this.el.remove();
    this.onClose();
  }
  private stage = (project: Project) => {
    this.session.stage(project);
    this.view = undefined;
    this.reviewed = false;
    this.error = "";
    this.render();
  };
  private render() {
    if (!this.view) {
      const project = this.session.project(),
        report = this.session.report();
      this.view = {
        project,
        report,
        comparison: this.session.comparison(),
        units: repairUnits(project, this.addresses, report),
        modified: this.session.modifiedPlacements(),
      };
    }
    const { project, report, comparison, units, modified } = this.view,
      filtered = units.filter((u) =>
        [u.label, ...u.members.map((m) => m.componentId)]
          .join(" ")
          .toLocaleLowerCase()
          .includes(this.search.toLocaleLowerCase()),
      );
    if (!units.some((u) => u.id === this.selected))
      this.selected = units[0]?.id ?? "";
    const unit = units.find((u) => u.id === this.selected);
    this.offset = Math.min(
      this.offset,
      Math.max(0, Math.floor((filtered.length - 1) / 30) * 30),
    );
    const explain = (finding: (typeof report.messages)[number]) => {
      const issues = finding.cause.details.issues;
      return (Array.isArray(issues) ? issues : [])
        .flatMap((i) =>
          i && typeof i === "object" && typeof i.code === "string"
            ? [
                `<li>${esc(t(("articlesIssue_" + i.code) as TranslationKey))} · ${esc(String(i.expected ?? ""))} → ${esc(String(i.actual ?? ""))}</li>`,
              ]
            : [],
        )
        .join("");
    };
    const changeText = (finding: (typeof report.messages)[number]) =>
      finding.severity +
      " · " +
      finding.message +
      (finding.articleData
        ? " · " +
          t(("articleState_" + finding.articleData.state) as TranslationKey)
        : "");
    const changeById = new Map(
      comparison.changedDetails.map((pair) => [pair.after.id, pair]),
    );
    const findings = (name: string, items: typeof report.messages) =>
      `<details class="ir-findings"><summary>${esc(name)} (${items.length})</summary>${items
        .slice(0, 100)
        .map(
          (f) =>
            `<p><strong>${esc(f.severity)} · ${esc(f.ruleId)}</strong> · ${esc(f.bmk || f.componentId || "")} · ${esc(f.pageNumber)}<br>${esc(f.message)}<ul>${explain(f)}</ul>${changeById.has(f.id) ? `<small>${t("articlesBefore")}: ${esc(changeText(changeById.get(f.id)!.before))}<ul>${explain(changeById.get(f.id)!.before)}</ul><br>${t("articlesAfter")}: ${esc(changeText(f))}</small>` : ""}</p>`,
        )
        .join(
          "",
        )}${items.length > 100 ? `<p>${t("correctionExportFull")}</p>` : ""}</details>`;
    this.el.innerHTML = `<section role="dialog" aria-modal="true"><h2>${t("correctionTitle")}</h2><p class="ir-note">${t("correctionDraftHint")}</p><div class="ir-kpis">${[
      [t("correctionRemoved"), comparison.removed.length],
      [t("correctionRemaining"), comparison.remaining.length],
      [t("correctionChanged"), comparison.changed.length],
      [t("correctionAdded"), comparison.added.length],
    ]
      .map(
        ([label, count]) =>
          `<div><strong>${count}</strong><span>${esc(String(label))}</span></div>`,
      )
      .join(
        "",
      )}</div><div class="ir-layout"><nav aria-label="${t("correctionDevices")}"><input class="form-input" data-search aria-label="${t("correctionSearch")}" placeholder="${t("correctionSearch")}" value="${esc(this.search)}"><p>${filtered.length} ${t("correctionDevices")}</p>${filtered
      .slice(this.offset, this.offset + 30)
      .map(
        (u) =>
          `<button class="ir-unit" data-unit="${esc(u.id)}" aria-pressed="${u.id === this.selected}"><strong>${esc(u.label)}</strong><small>${u.members.length} ${t("correctionPlacements")} · ${u.findings.length} ${t("wiringHints")}</small></button>`,
      )
      .join(
        "",
      )}<div class="ir-actions"><button class="btn" data-prev ${!this.offset ? "disabled" : ""}>‹</button><span>${filtered.length ? this.offset + 1 : 0}–${Math.min(this.offset + 30, filtered.length)}</span><button class="btn" data-next ${this.offset + 30 >= filtered.length ? "disabled" : ""}>›</button></div></nav><main>${
      unit
        ? `<h3>${esc(unit.label)}</h3><p>${t(unit.confirmed ? "correctionConfirmed" : "correctionPlacementOnly")}</p><div class="ir-members">${unit.members
            .map((a) => {
              const page = project.pages.find((p) => p.id === a.pageId)!,
                component = page.components.find(
                  (c) => c.id === a.componentId,
                )!;
              return `<div><strong>${esc(component.bmk || component.id)} · ${t("page")} ${esc(page.pageNumber)}</strong><span>${esc(component.functionText || "")}</span><small>${esc(
                effectiveArticles(component, project)
                  .map((i) => i.manufacturer + " " + i.articleNumber)
                  .join(" / ") || t("terminalStripNoArticle"),
              )}</small></div>`;
            })
            .join(
              "",
            )}</div><div class="ir-actions"><button class="btn" data-articles>${t("correctionArticles")}</button><button class="btn" data-functions>${t("correctionFunctions")}</button></div>${findings(t("correctionDeviceFindings"), unit.findings)}`
        : `<p>${t("correctionNoTargets")}</p>`
    }<h3>${t("correctionImpact")}</h3><p>${modified.length} ${t("correctionModified")}</p><details class="ir-findings"><summary>${t("correctionModified")} (${modified.length})</summary>${modified
      .slice(0, 100)
      .map((a) => {
        const page = project.pages.find((p) => p.id === a.pageId),
          c = page?.components.find((c) => c.id === a.componentId);
        return `<p>${esc(c?.bmk || a.componentId)} · ${t("page")} ${esc(page?.pageNumber || a.pageId)} · ${esc(a.componentId)}</p>`;
      })
      .join(
        "",
      )}</details>${findings(t("correctionAdded"), comparison.added)}${findings(t("correctionChanged"), comparison.changed)}${findings(t("correctionRemoved"), comparison.removed)}<p class="ir-note">${t("correctionNotCertification")}</p><div class="ir-actions"><button class="btn" data-export>${t("correctionExport")}</button><button class="btn" data-reload>${t("correctionReload")}</button><button class="btn" data-reset ${this.session.changed ? "" : "disabled"}>${t("correctionReset")}</button></div>${this.session.changed ? `<label><input type="checkbox" data-reviewed ${this.reviewed ? "checked" : ""}> ${t("correctionReviewed")}</label>` : ""}</main></div><p role="alert">${esc(this.error)}</p><footer><span>${t("correctionFinalHint")}</span><button class="btn" data-close>${t("correctionCancel")}</button><button class="btn btn-primary" data-apply ${this.session.changed && this.reviewed ? "" : "disabled"}>${t("correctionApply")}</button></footer></section>`;
    const q = <T extends HTMLElement = HTMLElement>(s: string) =>
      this.el.querySelector<T>(s)!;
    q("[data-close]").onclick = () => this.close();
    q("[data-apply]").onclick = () => {
      try {
        if (!this.reviewed) return;
        this.onApply(this.session.apply(this.getProject()));
        this.close();
      } catch (e) {
        this.error = articleError(e);
        this.render();
      }
    };
    q("[data-reviewed]")?.addEventListener("change", (e) => {
      this.reviewed = (e.target as HTMLInputElement).checked;
      q<HTMLButtonElement>("[data-apply]").disabled = !this.reviewed;
    });
    q("[data-reload]").onclick = () => {
      this.session = new InspectionRepairSession(this.getProject());
      this.view = undefined;
      this.reviewed = false;
      this.error = "";
      this.render();
    };
    q("[data-reset]").onclick = () => {
      this.session.reset();
      this.view = undefined;
      this.reviewed = false;
      this.error = "";
      this.render();
    };
    q("[data-export]").onclick = () =>
      downloadArticleFile(
        JSON.stringify(
          {
            schema: "schematico-inspection-repair",
            version: 1,
            applied: false,
            changed: this.session.changed,
            modifiedPlacements: this.session.modifiedPlacements(),
            comparison,
            report,
          },
          null,
          2,
        ),
        "schematico-korrekturvorschau.json",
        "application/json",
      );
    q<HTMLInputElement>("[data-search]").oninput = (e) => {
      const input = e.target as HTMLInputElement,
        caret = input.selectionStart;
      this.search = input.value;
      this.offset = 0;
      this.render();
      q<HTMLInputElement>("[data-search]").focus();
      q<HTMLInputElement>("[data-search]").setSelectionRange(caret, caret);
    };
    q("[data-prev]").onclick = () => {
      this.offset = Math.max(0, this.offset - 30);
      this.render();
    };
    q("[data-next]").onclick = () => {
      this.offset += 30;
      this.render();
    };
    for (const button of this.el.querySelectorAll<HTMLButtonElement>(
      "[data-unit]",
    ))
      button.onclick = () => {
        this.selected = button.dataset.unit!;
        this.render();
      };
    const edit = (functions = false) => {
      if (!unit) return;
      try {
        if (functions)
          new ArticleFunctionDialog(
            () => this.session.project(),
            this.stage,
            unit.members,
          ).show();
        else
          new ArticleWorkbenchDialog(
            () => this.session.project(),
            this.stage,
            unit.members,
          ).show();
      } catch (e) {
        this.error = articleError(e);
        this.render();
      }
    };
    q("[data-articles]")?.addEventListener("click", () => edit());
    q("[data-functions]")?.addEventListener("click", () => edit(true));
    finishEngineeringDialog(this.el, {
      kind: "inspection",
      description: t("correctionSubtitle"),
      wide: true,
    });
    focusArticleModal(this.el);
  }
}
