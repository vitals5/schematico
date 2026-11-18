import type { Project } from "../model/types";
import { projectRevision } from "../layout/types";
import {
  manufacturingTemplates,
  defaultReportTemplate,
  validateReportTemplate,
  ReportTemplateEdit,
  manufacturingRows,
  selectReportRows,
  manufacturingCsv,
  encodeReportTemplate,
  decodeReportTemplate,
  type ReportTemplate,
  type ReportRow,
} from "../reports/ManufacturingReports";
import {
  layoutManufacturingReport,
  manufacturingReportPdf,
  type ReportLayout,
} from "../export/ManufacturingReportPdf";
import { visualMeta, visualKey } from "./EngineeringVisualModel";
import { finishEngineeringDialog } from "./EngineeringDialog";
import { bindArticleModalKeys, focusArticleModal } from "./ArticleModal";
import { downloadArticleFile, articleError } from "./ArticleCatalogDialog";
import { escapeSvg as esc } from "../model/ImportedDrawing";
import { t, type TranslationKey } from "../i18n";
export class ManufacturingReportDialog {
  private el = document.createElement("div");
  private source: Project;
  private template: ReportTemplate;
  private cache = new Map<string, ReportRow[]>();
  private rows: ReportRow[] = [];
  private preview?: ReportLayout;
  private page = 0;
  private search = "";
  private pageId = "";
  private selected = "";
  private dirty = true;
  private error = "";
  constructor(
    private getProject: () => Project,
    private onApply: (p: Project) => void,
    private navigate: (pageId: string, componentId: string) => void,
  ) {
    this.source = structuredClone(getProject());
    this.template = manufacturingTemplates(this.source).templates[0];
  }
  show() {
    if (document.getElementById("manufacturingReportDialog")) return;
    this.el.id = "manufacturingReportDialog";
    this.el.className = "modal-backdrop";
    this.el.style.cssText =
      "position:fixed;inset:0;z-index:4100;display:flex;align-items:center;justify-content:center";
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => this.el.remove());
    this.updatePreview();
  }
  private stale() {
    if (projectRevision(this.getProject()) !== projectRevision(this.source))
      throw Error("articlesProjectStale");
  }
  private invalidate() {
    this.dirty = true;
    this.el.querySelector("[data-report-status]")!.textContent =
      t("reportDirty");
    for (const el of this.el.querySelectorAll<HTMLButtonElement>(
      "[data-pdf],[data-csv]",
    ))
      el.disabled = true;
  }
  private updatePreview() {
    try {
      this.stale();
      this.template = validateReportTemplate(this.template);
      if (!this.cache.has(this.template.kind))
        this.cache.set(
          this.template.kind,
          manufacturingRows(this.source, this.template.kind),
        );
      const rows = selectReportRows(
          this.cache.get(this.template.kind)!,
          this.template,
          this.search,
          this.pageId,
        ),
        preview = layoutManufacturingReport(
          this.template,
          rows,
          this.source.name,
        );
      this.rows = rows;
      this.preview = preview;
      this.dirty = false;
      this.page = Math.min(this.page, preview.pages.length - 1);
      this.error = "";
    } catch (e) {
      this.error =
        e instanceof Error && e.message === "reportInvalid"
          ? t("reportInvalid")
          : articleError(e);
      this.dirty = true;
    }
    this.render();
  }
  private renderPage() {
    if (!this.preview) return `<p>${t("reportEmpty")}</p>`;
    const l = this.preview,
      fs = l.fontSize * 0.352778,
      fragments = l.pages[this.page];
    let y = 14;
    const text = (
      value: string,
      x: number,
      y: number,
      size = fs,
      bold = false,
    ) =>
      `<text x="${x}" y="${y}" font-size="${size}" ${bold ? 'font-weight="bold"' : ""}>${esc(value)}</text>`;
    let svg = "";
    for (const line of l.title) {
      svg += text(line, 12, y, (l.fontSize + 4) * 0.352778, true);
      y += (l.fontSize + 4) * 0.352778 * 1.25;
    }
    for (const line of l.caption) {
      svg += text(line, 12, y);
      y += l.lineHeight;
    }
    svg += `<rect x="12" y="${l.headingY - 3}" width="${l.width - 24}" height="${l.bodyY - l.headingY + 3}" fill="#e1eaf2"/>`;
    for (const c of l.columns)
      c.lines.forEach(
        (line, i) =>
          (svg += text(
            line,
            c.x + 1.5,
            l.headingY + i * l.lineHeight,
            fs,
            true,
          )),
      );
    fragments.forEach((r, index) => {
      const row = this.rows.find((row) => row.key === r.key)!;
      svg += `<g role="button" tabindex="0" data-report-row="${esc(r.key)}" ${visualMeta(visualKey("report", r.key), Object.values(row.cells).join(" · ").slice(0, 180))} aria-label="${esc(Object.values(row.cells).join(" · ").slice(0, 180))}"><rect x="12" y="${r.y}" width="${l.width - 24}" height="${r.height}" fill="${index % 2 === 0 ? "#f6f8fb" : "#fff"}"/>`;
      r.cells.forEach((lines, c) =>
        lines.forEach(
          (line, i) =>
            (svg += text(
              line,
              l.columns[c].x + 1.5,
              r.y + l.lineHeight + i * l.lineHeight,
            )),
        ),
      );
      svg += `<path d="M12 ${r.y + r.height} H${l.width - 12}" stroke="#bec9d3" stroke-width=".15"/></g>`;
    });
    svg += `<text x="${l.width - 12}" y="${l.height - 7}" text-anchor="end" font-size="${7 * 0.352778}">${this.page + 1} / ${l.pages.length} · ${l.rowCount}</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${l.width}mm" height="${l.height}mm" viewBox="0 0 ${l.width} ${l.height}" class="mr-sheet" style="font-family:Arial,Helvetica,sans-serif" role="group" aria-label="${t("reportPreview")}"><rect width="${l.width}" height="${l.height}" fill="white"/>${svg}</svg>`;
  }
  private render() {
    const saved = manufacturingTemplates(this.source),
      all = defaultReportTemplate(this.template.kind).columns,
      visible = new Map(this.template.columns.map((c) => [c.id, c])),
      ordered = [
        ...this.template.columns,
        ...all.filter((c) => !visible.has(c.id)),
      ];
    this.el.innerHTML = `<section role="dialog" aria-modal="true"><h2>${t("reportDesigner")}</h2><p class="mr-note">${t("reportSnapshot")}</p>${saved.invalid ? `<p role="status">${saved.invalid} ${t("reportInvalidStored")}</p>` : ""}<div class="mr-workspace"><aside class="mr-settings"><label>${t("reportTemplate")}<select class="form-input" data-template>${saved.templates.map((v) => `<option value="${esc(v.id)}" ${v.id === this.template.id ? "selected" : ""}>${esc(v.title)}</option>`).join("")}${!saved.templates.some((v) => v.id === this.template.id) ? `<option selected value="${esc(this.template.id)}">${esc(this.template.title)} *</option>` : ""}</select></label><div class="mr-actions"><button class="btn" data-copy>${t("reportCopy")}</button><button class="btn" data-import>${t("reportImport")}</button><button class="btn" data-export>${t("reportExport")}</button><input type="file" hidden data-file accept=".json,application/json"></div><label>${t("reportTitle")}<input class="form-input" data-title maxlength="120" value="${esc(this.template.title)}"></label><div class="mr-actions"><label>${t("reportPaper")}<select class="form-input" data-paper>${["a3", "a4"].map((v) => `<option ${v === this.template.paper ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>${t("reportOrientation")}<select class="form-input" data-orientation><option value="landscape" ${this.template.orientation === "landscape" ? "selected" : ""}>${t("reportLandscape")}</option><option value="portrait" ${this.template.orientation === "portrait" ? "selected" : ""}>${t("reportPortrait")}</option></select></label><label>${t("reportFont")}<input class="form-input" data-font type="number" min="6" max="12" step=".5" value="${this.template.fontSize}"></label></div><h3>${t("reportColumns")}</h3><p class="mr-note">${t("reportColumnHint")}</p>${ordered.map((c, i) => `<div class="mr-column"><input type="checkbox" data-column="${c.id}" aria-label="${esc(c.label)}" ${visible.has(c.id) ? "checked" : ""}><input class="form-input" data-label="${c.id}" maxlength="80" aria-label="${t("reportColumnName")}" value="${esc(c.label)}" ${visible.has(c.id) ? "" : "disabled"}><input class="form-input mr-weight" data-weight="${c.id}" type="number" min="1" max="20" value="${c.weight}" aria-label="${t("reportWeight")}" ${visible.has(c.id) ? "" : "disabled"}><button class="btn" data-up="${c.id}" aria-label="${t("reportUp")}" ${visible.has(c.id) && i > 0 ? "" : "disabled"}>↑</button><button class="btn" data-down="${c.id}" aria-label="${t("reportDown")}" ${visible.has(c.id) && i < this.template.columns.length - 1 ? "" : "disabled"}>↓</button></div>`).join("")}<label>${t("reportSort")}<select class="form-input" data-sort><option value="">${t("reportOriginalOrder")}</option>${all.map((c) => `<option value="${c.id}" ${c.id === this.template.sortBy ? "selected" : ""}>${esc(visible.get(c.id)?.label ?? c.label)}</option>`).join("")}</select></label><label><input type="checkbox" data-descending ${this.template.descending ? "checked" : ""}> ${t("reportDescending")}</label><button class="btn" data-save>${t("reportSave")}</button><button class="btn" data-delete ${Array.isArray(this.source.manufacturingReportTemplates) && this.source.manufacturingReportTemplates.some((v) => v?.id === this.template.id) ? "" : "disabled"}>${t("reportDelete")}</button><button class="btn" data-reload>${t("reportReload")}</button></aside><main class="mr-main"><div class="mr-actions"><input class="form-input" data-search aria-label="${t("reportSearch")}" placeholder="${t("reportSearch")}" value="${esc(this.search)}"><select class="form-input" data-page-filter aria-label="${t("reviewPage")}"><option value="">${t("reportAllPages")}</option>${this.source.pages.map((p) => `<option value="${esc(p.id)}" ${p.id === this.pageId ? "selected" : ""}>${esc(p.pageNumber + " · " + p.title)}</option>`).join("")}</select><button class="btn btn-primary" data-preview>${t("reportUpdatePreview")}</button></div><p data-report-status role="status">${this.dirty ? t("reportDirty") : this.rows.length + " " + t("reportRows")}</p><div class="mr-actions"><button class="btn" data-prev ${this.page === 0 ? "disabled" : ""}>‹</button><select class="form-input" data-preview-page aria-label="${t("page")}">${this.preview?.pages.map((_, i) => `<option value="${i}" ${this.page === i ? "selected" : ""}>${i + 1} / ${this.preview!.pages.length}</option>`).join("") ?? ""}</select><button class="btn" data-next ${!this.preview || this.page === this.preview.pages.length - 1 ? "disabled" : ""}>›</button><button class="btn" data-pdf ${this.dirty ? "disabled" : ""}>PDF</button><button class="btn" data-csv ${this.dirty ? "disabled" : ""}>CSV</button></div><div class="mr-paper-scroll"><div data-report-preview>${this.renderPage()}</div></div><div class="mr-selected">${this.selected ? `${t("reportSelected")}: ${esc(Object.values(this.rows.find((r) => r.key === this.selected)?.cells ?? {}).join(" · "))}` : t("reportNavigationHint")}</div></main></div><p role="alert">${esc(this.error)}</p><footer><span>${t("reportSaveHint")}</span><button class="btn" data-close>${t("close")}</button></footer></section>`;
    const q = <T extends HTMLElement = HTMLElement>(s: string) =>
      this.el.querySelector<T>(s)!;
    q("[data-close]").onclick = () => this.el.remove();
    q("[data-template]").onchange = (e) => {
      this.template = structuredClone(
        saved.templates.find(
          (v) => v.id === (e.target as HTMLSelectElement).value,
        ) ?? this.template,
      );
      this.page = 0;
      this.updatePreview();
    };
    const field = (selector: string, apply: (el: HTMLInputElement) => void) => {
      q<HTMLInputElement>(selector).oninput = (e) => {
        apply(e.target as HTMLInputElement);
        this.invalidate();
      };
    };
    field("[data-title]", (e) => (this.template.title = e.value));
    field("[data-font]", (e) => (this.template.fontSize = Number(e.value)));
    field(
      "[data-paper]",
      (e) => (this.template.paper = e.value as ReportTemplate["paper"]),
    );
    field(
      "[data-orientation]",
      (e) =>
        (this.template.orientation = e.value as ReportTemplate["orientation"]),
    );
    field("[data-sort]", (e) => (this.template.sortBy = e.value));
    field("[data-descending]", (e) => (this.template.descending = e.checked));
    field("[data-search]", (e) => (this.search = e.value));
    field("[data-page-filter]", (e) => (this.pageId = e.value));
    for (const el of this.el.querySelectorAll<HTMLInputElement>(
      "[data-label],[data-weight]",
    ))
      el.oninput = () => {
        const c = this.template.columns.find(
          (c) => c.id === (el.dataset.label ?? el.dataset.weight),
        );
        if (c) {
          el.hasAttribute("data-label")
            ? (c.label = el.value)
            : (c.weight = Number(el.value));
          this.invalidate();
        }
      };
    for (const el of this.el.querySelectorAll<HTMLInputElement>(
      "[data-column]",
    ))
      el.onchange = () => {
        if (el.checked)
          this.template.columns.push(
            structuredClone(all.find((c) => c.id === el.dataset.column)!),
          );
        else
          this.template.columns = this.template.columns.filter(
            (c) => c.id !== el.dataset.column,
          );
        this.dirty = true;
        this.render();
      };
    for (const el of this.el.querySelectorAll<HTMLButtonElement>(
      "[data-up],[data-down]",
    ))
      el.onclick = () => {
        const at = this.template.columns.findIndex(
            (c) => c.id === (el.dataset.up ?? el.dataset.down),
          ),
          to = at + (el.dataset.up ? -1 : 1);
        [this.template.columns[at], this.template.columns[to]] = [
          this.template.columns[to],
          this.template.columns[at],
        ];
        this.dirty = true;
        this.render();
      };
    q("[data-preview]").onclick = () => this.updatePreview();
    q("[data-prev]").onclick = () => {
      this.page--;
      this.render();
    };
    q("[data-next]").onclick = () => {
      this.page++;
      this.render();
    };
    q("[data-preview-page]").onchange = (e) => {
      this.page = Number((e.target as HTMLSelectElement).value);
      this.render();
    };
    const safe = (fn: () => void) => {
      try {
        fn();
        this.error = "";
      } catch (e) {
        this.error =
          e instanceof Error && e.message === "reportInvalid"
            ? t("reportInvalid")
            : articleError(e);
      }
      this.render();
    };
    q("[data-save]").onclick = () =>
      safe(() => {
        this.onApply(
          new ReportTemplateEdit(this.source, this.template).apply(
            this.getProject(),
          ),
        );
        this.source = structuredClone(this.getProject());
      });
    q("[data-delete]").onclick = () =>
      safe(() => {
        this.onApply(
          new ReportTemplateEdit(this.source, this.template, true).apply(
            this.getProject(),
          ),
        );
        this.source = structuredClone(this.getProject());
        this.template =
          manufacturingTemplates(this.source).templates.find(
            (v) => v.id === this.template.id,
          ) ?? defaultReportTemplate(this.template.kind);
        this.dirty = true;
      });
    q("[data-copy]").onclick = () => {
      this.template = {
        ...structuredClone(this.template),
        id: "report-" + crypto.randomUUID(),
        title: this.template.title.slice(0, 110) + " " + t("reportCopySuffix"),
      };
      this.dirty = true;
      this.render();
    };
    q("[data-reload]").onclick = () => {
      this.source = structuredClone(this.getProject());
      this.template =
        manufacturingTemplates(this.source).templates.find(
          (v) => v.id === this.template.id,
        ) ?? defaultReportTemplate(this.template.kind);
      this.cache.clear();
      this.selected = "";
      this.page = 0;
      this.updatePreview();
    };
    q("[data-export]").onclick = () =>
      safe(() =>
        downloadArticleFile(
          encodeReportTemplate(this.template),
          "schematico-report-template.json",
          "application/json",
        ),
      );
    q("[data-import]").onclick = () =>
      q<HTMLInputElement>("[data-file]").click();
    q<HTMLInputElement>("[data-file]").onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        if (file.size > 131072) throw Error("reportInvalid");
        this.template = decodeReportTemplate(await file.text());
        this.page = 0;
        this.updatePreview();
      } catch {
        this.error = t("reportInvalid");
        this.render();
      }
    };
    q("[data-pdf]").onclick = () =>
      safe(() => {
        this.stale();
        if (this.dirty || !this.preview) throw Error("reportInvalid");
        manufacturingReportPdf(this.preview).save(
          "schematico-" + this.template.kind + ".pdf",
        );
      });
    q("[data-csv]").onclick = () =>
      safe(() => {
        this.stale();
        if (this.dirty) throw Error("reportInvalid");
        downloadArticleFile(
          manufacturingCsv(this.rows, this.template),
          "schematico-" + this.template.kind + ".csv",
          "text/csv;charset=utf-8",
        );
      });
    q("[data-report-preview]").onclick = (e) => {
      const key = (e.target as Element).closest<HTMLElement>(
        "[data-report-row]",
      )?.dataset.reportRow;
      if (key) {
        this.selected = key;
        q(".mr-selected").textContent =
          t("reportSelected") +
          ": " +
          Object.values(this.rows.find((r) => r.key === key)?.cells ?? {}).join(
            " · ",
          );
      }
    };
    q("[data-report-preview]").onkeydown = (e) => {
      if (
        (e.key === "Enter" || e.key === " ") &&
        (e.target as Element).matches("g[role=button]")
      ) {
        e.preventDefault();
        (e.target as Element).dispatchEvent(
          new MouseEvent("click", { bubbles: true }),
        );
      }
    };
    finishEngineeringDialog(this.el, {
      kind: "wiring",
      description: t("reportSubtitle"),
      wide: true,
      drawing: {
        project: this.getProject,
        navigate: this.navigate,
        targets: (id) => {
          if (this.dirty) return [];
          const row = this.rows.find((r) => visualKey("report", r.key) === id);
          return row?.targets ?? [];
        },
      },
    });
    focusArticleModal(this.el);
  }
}
