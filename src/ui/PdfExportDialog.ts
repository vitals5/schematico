import type { Project } from "../model/types";
import { PdfExporter, type PdfExportOptions } from "../export/PdfExporter";
import {
  projectPdfChoices,
  type ProjectPdfChoice,
} from "../export/ProjectPdfSections";
import { escapeSvg as esc } from "../model/ImportedDrawing";
import { t, translations, type TranslationKey } from "../i18n";
import { finishEngineeringDialog } from "./EngineeringDialog";
import { bindArticleModalKeys, focusArticleModal } from "./ArticleModal";

export class PdfExportDialog {
  private project: Project;
  private modalOverlay?: HTMLDivElement;
  private choices: ProjectPdfChoice[];
  constructor(
    project: Project,
    private activePageId: string,
  ) {
    this.project = structuredClone(project);
    this.choices = projectPdfChoices(this.project);
  }
  show() {
    if (document.getElementById("pdfExportDialog")) return;
    const root = (this.modalOverlay = document.createElement("div"));
    root.id = "pdfExportDialog";
    root.className = "modal-backdrop";
    root.style.cssText =
      "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center";
    const group = (kind: ProjectPdfChoice["kind"], title: string) => {
      const list = this.choices.filter((c) => c.kind === kind);
      if (!list.length) return "";
      return `<fieldset><legend>${esc(title)}</legend>${list.map((c) => `<label class="pdf-section"><input type="checkbox" data-pdf-section="${esc(c.id)}" ${c.problem ? "disabled" : "checked"}><span><strong>${esc(c.title)}</strong><small>${esc(c.detail.replace("portrait", t("pdfPortrait")).replace("landscape", t("pdfLandscape")))}${c.kind === "cabinet" ? " " + t("pdfObjects") : ""}${c.problem ? " · " + esc(t(c.problem as TranslationKey)) : ""}</small></span></label>`).join("")}</fieldset>`;
    };
    root.innerHTML = `<section role="dialog" aria-modal="true"><h2>${t("pdfProjectTitle")}</h2><p class="pdf-hint">${t("pdfSnapshotHint")}</p><div class="pdf-export-columns"><div><fieldset><legend>${t("pdfDrawings")}</legend><label><input type="checkbox" id="chkPdfDrawings" checked> ${t("pdfIncludeDrawings")}</label><label><input type="radio" name="pdfPageRange" value="all" checked> ${t("pdfAllPages", { count: this.project.pages.length })}</label><label><input type="radio" name="pdfPageRange" value="current"> ${t("pdfCurrentPage")}</label><label>${t("pdfPaper")}<select class="form-input" id="pdfFormatSelect"><option value="a3">A3 · 420 × 297 mm</option><option value="a4">A4 · 297 × 210 mm</option></select></label><label><input type="radio" name="pdfColorMode" value="color" checked> ${t("pdfColor")}</label><label><input type="radio" name="pdfColorMode" value="monochrome"> ${t("pdfMonochrome")}</label><label><input type="checkbox" id="chkPlotFrame" checked> ${t("pdfPlotFrame")}</label></fieldset><fieldset><legend>${t("pdfNavigation")}</legend><label><input type="checkbox" id="chkInteractiveLinks" checked> ${t("pdfLinks")}</label><label><input type="checkbox" id="chkBookmarks" checked> ${t("pdfBookmarks")}</label></fieldset><fieldset><legend>${t("pdfAdditionalLists")}</legend><label><input type="checkbox" id="chkPartsList" checked> ${t("pdfBom")}</label><label><input type="checkbox" id="chkTerminalDiagram"> ${t("pdfLegacyTerminals")}</label></fieldset></div><div><div class="pdf-section-actions"><strong>${t("pdfSavedSections")}</strong><button class="btn" data-pdf-all>${t("pdfSelectAll")}</button><button class="btn" data-pdf-none>${t("pdfSelectNone")}</button></div><p class="pdf-hint">${t("pdfSectionsHint")}</p>${group("cabinet", t("pdfCabinets"))}${group("report", t("pdfReports"))}${group("automation", t("pdfAutomation"))}${group("dimensioning", t("pdfDimensioning"))}${group("revisions", t("pdfRevisions"))}${this.choices
      .filter((c) => c.kind === "invalid")
      .map(
        (c) =>
          `<p role="status" class="pdf-warning">${esc(t(c.problem as TranslationKey))} (${esc(c.detail)}) · ${t("pdfInvalidNotIncluded")}</p>`,
      )
      .join(
        "",
      )}</div></div><p id="pdfExportStatus" role="status"></p><p data-pdf-error role="alert"></p><footer><button class="btn" id="btnPdfCancel">${t("pdfCancel")}</button><button class="btn btn-primary eng-primary" id="btnPdfDoExport">${t("pdfDoExport")}</button></footer></section>`;
    document.body.append(root);
    bindArticleModalKeys(root, () => this.close());
    root.querySelector<HTMLButtonElement>("#btnPdfCancel")!.onclick = () =>
      this.close();
    root.querySelector<HTMLButtonElement>("#btnPdfDoExport")!.onclick = () =>
      void this.executeExport();
    for (const [selector, checked] of [
      ["[data-pdf-all]", true],
      ["[data-pdf-none]", false],
    ] as const)
      root.querySelector<HTMLButtonElement>(selector)!.onclick = () =>
        root
          .querySelectorAll<HTMLInputElement>(
            "[data-pdf-section]:not(:disabled)",
          )
          .forEach((c) => (c.checked = checked));
    root.querySelector<HTMLInputElement>("#chkPdfDrawings")!.onchange = (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      root
        .querySelectorAll<HTMLInputElement>('[name="pdfPageRange"]')
        .forEach((c) => (c.disabled = !checked));
    };
    finishEngineeringDialog(root, {
      kind: "wiring",
      description: t("pdfProjectSubtitle"),
      wide: true,
      closeSelector: "#btnPdfCancel",
    });
    focusArticleModal(root);
  }
  private async executeExport() {
    const root = this.modalOverlay;
    if (!root?.isConnected) return;
    const check = (id: string) =>
      root.querySelector<HTMLInputElement>("#" + id)?.checked ?? false;
    const options: PdfExportOptions = {
      paperFormat: root.querySelector<HTMLSelectElement>("#pdfFormatSelect")!
        .value as "a3" | "a4",
      colorMode: root.querySelector<HTMLInputElement>(
        '[name="pdfColorMode"]:checked',
      )!.value as "color" | "monochrome",
      pageRange: root.querySelector<HTMLInputElement>(
        '[name="pdfPageRange"]:checked',
      )!.value as "all" | "current",
      currentPageId: this.activePageId,
      includeDrawings: check("chkPdfDrawings"),
      interactiveCrossReferences: check("chkInteractiveLinks"),
      includeBookmarks: check("chkBookmarks"),
      includeTerminalDiagram: check("chkTerminalDiagram"),
      includePartsList: check("chkPartsList"),
      plotFrame: check("chkPlotFrame"),
      additionalSections: [
        ...root.querySelectorAll<HTMLInputElement>(
          "[data-pdf-section]:checked",
        ),
      ].map((c) => c.dataset.pdfSection!),
    };
    const button = root.querySelector<HTMLButtonElement>("#btnPdfDoExport")!,
      status = root.querySelector<HTMLElement>("#pdfExportStatus")!,
      error = root.querySelector<HTMLElement>("[data-pdf-error]")!;
    button.disabled = true;
    status.textContent = t("pdfGenerating");
    error.textContent = "";
    root.setAttribute("aria-busy", "true");
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (!root.isConnected) return;
      const blob = await PdfExporter.exportToPdf(this.project, options);
      if (!root.isConnected) return;
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download =
        this.project.name.replace(/[^a-zA-Z0-9_\-]/g, "_") +
        "_Dokumentation.pdf";
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.close();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e),
        code = message.split(":")[0];
      error.textContent =
        code === "pdfCabinetInvalid"
          ? t("pdfCabinetInvalid", { name: message.slice(code.length + 1) })
          : Object.hasOwn(translations.de, code)
            ? t(code as TranslationKey)
            : message;
      status.textContent = "";
    } finally {
      button.disabled = false;
      root.removeAttribute("aria-busy");
    }
  }
  private close() {
    this.modalOverlay?.remove();
    this.modalOverlay = undefined;
  }
}
