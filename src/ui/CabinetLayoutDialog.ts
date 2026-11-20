import { mountEngineeringVisualLens } from "./EngineeringVisualLens";
import {
  createMeterCabinet,
  meterCabinetHeights,
  meterCabinetFields,
  meterFieldLabel,
  type MeterFieldKind,
} from "../model/MeterCabinetTemplates";
import { visualDrawingTargets } from "./EngineeringDrawing";
import type { Project } from "../model/types";
import {
  findCabinetPlacement,
  insertCabinetStandard,
  CabinetLayoutEdit,
  cabinetCandidates,
  cabinetLayouts,
  cabinetBounds,
  inspectCabinet,
  moveCabinetItem,
  railCapacity,
  type CabinetLayout,
  type CabinetItem,
} from "../model/CabinetLayout";
import {
  cabinetStandard,
  cabinetStandardLibrary,
  cabinetLibraryCategories,
  findCabinetStandards,
  type CabinetLibraryCategory,
} from "../model/CabinetLibrary";
import { cabinetLibraryPreview } from "./CabinetDeviceFace";
import { getUiLanguage } from "../i18n";
import { cabinetSvg, cabinetPdf } from "./CabinetDrawing";
import { finishEngineeringDialog } from "./EngineeringDialog";
import { bindArticleModalKeys, focusArticleModal } from "./ArticleModal";
import { articleError, downloadArticleFile } from "./ArticleCatalogDialog";
import { escapeSvg as esc } from "../model/ImportedDrawing";
import { t, tr, type TranslationKey } from "../i18n";
export class CabinetLayoutDialog {
  private el = document.createElement("div");
  private workspaceClose?: () => void;
  private workspaceSave?: (saveAs: boolean) => void;
  private workspaceChanged?: () => void;
  get statusLabel() {
    return `${this.layout.name} · ${this.layout.widthMm} × ${this.layout.heightMm} mm · ${this.layout.items.length} ${tr("Objekte", "objects")} · ${tr("Raster", "Grid")} ${this.layout.gridMm} mm`;
  }
  get hasUndo() {
    return this.past.length > 0;
  }
  get hasRedo() {
    return this.future.length > 0;
  }
  get selectedLayoutId() {
    return this.layout.id;
  }
  get embedded() {
    return !!this.workspaceClose;
  }
  get dirty() {
    const saved = cabinetLayouts(this.source).find(
      (l) => l.id === this.layout.id,
    );
    return saved
      ? JSON.stringify(saved) !== JSON.stringify(this.layout)
      : this.past.length > 0 || this.layout.items.length > 0;
  }
  mount(
    host: HTMLElement,
    onClose: () => void,
    onSave?: (saveAs: boolean) => void,
    onChanged?: () => void,
  ) {
    this.workspaceClose = onClose;
    this.workspaceSave = onSave;
    this.workspaceChanged = onChanged;
    this.show(host);
  }
  closeWorkspace(force = false): boolean {
    if (
      !force &&
      this.dirty &&
      !confirm(
        tr(
          "Nicht übernommene Aufbauänderungen verwerfen?",
          "Discard unapplied cabinet changes?",
        ),
      )
    )
      return false;
    this.el.remove();
    this.workspaceClose?.();
    return true;
  }
  commitPending(): boolean {
    if (!this.dirty) return true;
    try {
      this.onApply(
        new CabinetLayoutEdit(this.source, this.layout).apply(
          this.getProject(),
        ),
      );
      this.source = structuredClone(this.getProject());
      this.past = [];
      this.future = [];
      this.render();
      return true;
    } catch (e) {
      this.error = articleError(e);
      this.render();
      return false;
    }
  }
  syncProject() {
    if (this.dirty) return;
    const id = this.layout.id;
    this.source = structuredClone(this.getProject());
    this.candidates = cabinetCandidates(this.source);
    this.past = [];
    this.future = [];
    this.layout = structuredClone(
      cabinetLayouts(this.source).find((l) => l.id === id) ??
        cabinetLayouts(this.source)[0] ??
        this.fresh(),
    );
    this.render();
  }
  undoWorkspace(redo = false) {
    if ((redo ? this.future : this.past).length) {
      this.history(redo);
      return true;
    }
    return false;
  }

  private source: Project;
  private layout: CabinetLayout;
  private candidates: ReturnType<typeof cabinetCandidates>;
  private checked?: {
    layout: CabinetLayout;
    source: Project;
    issues: ReturnType<typeof inspectCabinet>;
  };
  private plateExpanded = false;
  private templateExpanded = false;
  private templateHeight = 1100;
  private templateFields: MeterFieldKind[] = ["meter", "distribution"];
  private panel: "project" | "standard" = "project";
  private librarySearch = "";
  private libraryCategory: CabinetLibraryCategory | "" = "";
  private libraryOffset = 0;
  private standardId = "rcd-4p";
  private standardRail?: string;
  private quantity = 1;
  private renderedLayoutId?: string;
  private selected = "";
  private candidate = "";
  private search = "";
  private offset = 0;
  private width = "";
  private height = "";
  private manual = false;
  private error = "";
  private past: CabinetLayout[] = [];
  private future: CabinetLayout[] = [];
  constructor(
    private getProject: () => Project,
    private onApply: (p: Project) => void,
    private navigate: (p: string, c: string) => void,
    selectedLayoutId?: string,
  ) {
    this.source = structuredClone(getProject());
    this.candidates = cabinetCandidates(this.source);
    if (!this.candidates.length) this.panel = "standard";
    this.layout = structuredClone(
      cabinetLayouts(this.source).find((l) => l.id === selectedLayoutId) ??
        cabinetLayouts(this.source)[0] ??
        this.fresh(),
    );
  }
  private fresh(): CabinetLayout {
    return {
      schemaVersion: 1,
      id: crypto.randomUUID(),
      name: t("cabinetDefault"),
      widthMm: 600,
      heightMm: 800,
      marginMm: 10,
      gridMm: 5,
      items: [],
    };
  }
  show(host?: HTMLElement) {
    if (document.getElementById("cabinetLayoutDialog")) return;
    this.el.id = "cabinetLayoutDialog";
    this.el.className = host ? "cabinet-workspace" : "modal-backdrop";
    this.el.style.cssText =
      "position:fixed;inset:0;z-index:4100;display:flex;align-items:center;justify-content:center";
    if (host) {
      this.el.removeAttribute("style");
      host.append(this.el);
    } else document.body.append(this.el);
    if (!host) bindArticleModalKeys(this.el, () => this.el.remove());
    this.el.addEventListener("keydown", (e) => {
      if (
        this.embedded &&
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "s"
      ) {
        e.preventDefault();
        e.stopPropagation();
        this.workspaceSave?.(e.shiftKey);
        return;
      }
      if (
        this.embedded &&
        (e.ctrlKey || e.metaKey) &&
        ["o", "p"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        e.stopPropagation();
        document
          .getElementById(
            e.key.toLowerCase() === "o" ? "btnOpenProject" : "btnExportPdf",
          )
          ?.click();
        return;
      }
      if (this.embedded) e.stopPropagation();
      if ((e.target as Element).matches("input,textarea,select")) return;
      if (
        this.embedded &&
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "y"
      ) {
        e.preventDefault();
        this.history(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        this.history(e.shiftKey);
        return;
      }
      if (
        (e.key === "Enter" || e.key === " ") &&
        (e.target as Element).matches("g[data-cabinet-item]")
      ) {
        e.preventDefault();
        (e.target as Element).dispatchEvent(
          new MouseEvent("click", { bubbles: true }),
        );
        return;
      }
      if ((e.target as Element).closest(".cb-svg") && this.selected) {
        if (e.key === "Delete") {
          e.preventDefault();
          this.removeItem();
        } else if (
          ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
        ) {
          e.preventDefault();
          const i = this.layout.items.find((i) => i.id === this.selected)!;
          this.change(
            moveCabinetItem(
              this.layout,
              i.id,
              i.x +
                (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0) *
                  this.layout.gridMm,
              i.y +
                (e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0) *
                  this.layout.gridMm,
            ),
          );
          this.focusItem();
        }
      }
    });
    this.render();
  }
  private focusItem() {
    [...this.el.querySelectorAll<SVGElement>("[data-cabinet-item]")]
      .find((n) => n.dataset.cabinetItem === this.selected)
      ?.focus({ preventScroll: true });
  }
  private change(next: CabinetLayout) {
    if (JSON.stringify(next) !== JSON.stringify(this.layout)) {
      this.past.push(structuredClone(this.layout));
      if (this.past.length > 50) this.past.shift();
      this.future = [];
      this.layout = next;
    }
    this.error = "";
    this.render();
  }
  private history(redo = false) {
    const from = redo ? this.future : this.past,
      to = redo ? this.past : this.future,
      next = from.pop();
    if (next) {
      to.push(structuredClone(this.layout));
      this.layout = next;
      this.render();
    }
  }
  private removeItem() {
    const l = structuredClone(this.layout),
      id = this.selected;
    l.items = l.items.filter((i) => i.id !== id);
    for (const i of l.items) if (i.railId === id) delete i.railId;
    this.selected = "";
    this.change(l);
  }
  private render() {
    const l = this.layout;
    const view =
      this.renderedLayoutId === l.id
        ? [
            ".eng-body",
            ".cb-tools",
            ".cb-main",
            ".cb-properties",
            ".cb-canvas",
          ].map((selector) => {
            const node = this.el.querySelector<HTMLElement>(selector);
            return {
              selector,
              left: node?.scrollLeft ?? 0,
              top: node?.scrollTop ?? 0,
            };
          })
        : [];
    this.renderedLayoutId = l.id;
    if (this.checked?.layout !== l || this.checked?.source !== this.source)
      this.checked = {
        layout: l,
        source: this.source,
        issues: inspectCabinet(this.source, l),
      };
    const issues = this.checked.issues,
      errors = issues.filter((i) => i.severity === "error"),
      item = l.items.find((i) => i.id === this.selected),
      entry = this.candidates.find((c) => c.identity === this.candidate),
      labels = new Map(
        l.items.map((i) => [
          i.id,
          i.kind === "device"
            ? (this.candidates.find(
                (c) =>
                  c.main.pageId === i.source?.pageId &&
                  c.main.componentId === i.source?.componentId,
              )?.designation ?? i.label)
            : i.label,
        ]),
      ),
      placed = new Set(
        [
          ...cabinetLayouts(this.source)
            .filter((b) => b.id !== l.id)
            .flatMap((b) => b.items),
          ...l.items,
        ]
          .filter((i) => i.source)
          .map((i) =>
            JSON.stringify([i.source!.pageId, i.source!.componentId]),
          ),
      ),
      filtered = this.candidates.filter((c) =>
        (
          c.designation +
          " " +
          c.description +
          " " +
          c.items.map((i) => i.articleNumber).join(" ")
        )
          .toLocaleLowerCase()
          .includes(this.search.toLocaleLowerCase()),
      );
    this.offset = Math.min(
      this.offset,
      Math.max(0, Math.floor((filtered.length - 1) / 30) * 30),
    );
    const rails = l.items.filter((i) => i.kind === "rail" && i.rotation === 0),
      area =
        (l.items
          .filter((i) => i.kind === "device" || i.kind === "standard")
          .reduce((n, i) => n + i.widthMm * i.heightMm, 0) /
          (l.widthMm * l.heightMm)) *
        100;
    this.el.innerHTML = `<section role="dialog" aria-modal="true"><h2>${t("cabinetTitle")}</h2><p class="cb-note">${t("cabinetHint")}</p>${(Array.isArray(this.source.cabinetLayouts) ? this.source.cabinetLayouts.length : this.source.cabinetLayouts === undefined ? 0 : 1) > cabinetLayouts(this.source).length ? `<p role="status">${t("cabinetInvalidRecords")}</p>` : ""}<div class="cb-actions"><label>${t("cabinetBoard")}<select class="form-input" data-layout>${cabinetLayouts(
      this.source,
    )
      .map(
        (b) =>
          `<option value="${esc(b.id)}" ${b.id === l.id ? "selected" : ""}>${esc(b.name)}</option>`,
      )
      .join(
        "",
      )}${!cabinetLayouts(this.source).some((b) => b.id === l.id) ? `<option selected value="${esc(l.id)}">${esc(l.name)} *</option>` : ""}</select></label><button class="btn" data-new>${t("cabinetNew")}</button><button class="btn" data-meter-open>${tr("Zählerschrankvorlagen", "Meter cabinet templates")}</button><button class="btn" data-reload>${t("cabinetReload")}</button><button class="btn" data-undo ${this.past.length ? "" : "disabled"}>${t("cabinetUndo")}</button><button class="btn" data-redo ${this.future.length ? "" : "disabled"}>${t("cabinetRedo")}</button><button class="btn" data-pdf ${errors.length ? "disabled" : ""}>PDF</button><button class="btn" data-svg ${errors.length ? "disabled" : ""}>SVG</button></div><div class="cb-layout"><aside class="cb-tools">${this.meterTemplatePanel()}<details class="cb-board-settings" data-board-settings ${this.plateExpanded ? "open" : ""}><summary>${t("cabinetBoard")} · ${l.widthMm} × ${l.heightMm} mm</summary><label>${t("cabinetName")}<input class="form-input" data-board="name" value="${esc(l.name)}" maxlength="120"></label><div class="cb-fields">${[
      ["widthMm", t("cabinetWidth")],
      ["heightMm", t("cabinetHeight")],
      ["marginMm", t("cabinetMargin")],
      ["gridMm", t("cabinetGrid")],
    ]
      .map(
        ([k, label]) =>
          `<label>${label}<input class="form-input" type="number" data-board="${k}" value="${l[k as "widthMm"]}" min="0" max="10000"></label>`,
      )
      .join(
        "",
      )}</div><button class="btn" data-board-apply>${t("cabinetPropertiesApply")}</button></details><div class="cb-actions"><button class="btn" data-add-rail>${t("cabinetAddRail")}</button><button class="btn" data-add-duct>${t("cabinetAddDuct")}</button></div><div class="cb-library-tabs" role="group" aria-label="${t("cabinetLibrarySources")}"><button class="btn" data-library-tab="project" aria-pressed="${this.panel === "project"}">${t("cabinetDevices")}</button><button class="btn" data-library-tab="standard" aria-pressed="${this.panel === "standard"}">${t("cabinetLibrary")} (${cabinetStandardLibrary.length})</button></div>${
      this.panel === "standard"
        ? this.libraryPanel(rails)
        : `<input class="form-input" data-search aria-label="${t("cabinetSearch")}" placeholder="${t("cabinetSearch")}" value="${esc(this.search)}"><div class="cb-candidates">${filtered
            .slice(this.offset, this.offset + 30)
            .map(
              (c) =>
                `<button class="cb-candidate" data-candidate="${esc(c.identity)}" aria-pressed="${c.identity === this.candidate}" ${placed.has(JSON.stringify([c.main.pageId, c.main.componentId])) ? "disabled" : ""}><strong>${esc(c.designation)}</strong><small>${esc(c.items.map((a) => a.articleNumber).join(" / ") || c.description)} · ${c.dimensions ? c.dimensions.widthMm + " × " + c.dimensions.heightMm + " mm" : t("cabinetNoDimensions")}</small></button>`,
            )
            .join(
              "",
            )}</div><div class="cb-actions"><button class="btn" data-prev ${this.offset ? "" : "disabled"}>‹</button><span>${filtered.length ? this.offset + 1 : 0}–${Math.min(filtered.length, this.offset + 30)} / ${filtered.length}</span><button class="btn" data-next ${this.offset + 30 >= filtered.length ? "disabled" : ""}>›</button></div>${entry ? `<p>${esc(entry.designation)} · ${t(this.manual ? "cabinetManualSize" : "cabinetSizeFromArticle")}</p><div class="cb-fields"><label>${t("cabinetWidth")}<input class="form-input" data-size="width" type="number" min=".1" value="${esc(this.width)}"></label><label>${t("cabinetHeight")}<input class="form-input" data-size="height" type="number" min=".1" value="${esc(this.height)}"></label></div><label>${t("cabinetRail")}<select class="form-input" data-new-rail><option value="">${t("cabinetFree")}</option>${rails.map((r) => `<option value="${esc(r.id)}">${esc(r.label)}</option>`).join("")}</select></label><button class="btn" data-place ${Number(this.width) > 0 && Number(this.height) > 0 && !placed.has(JSON.stringify([entry.main.pageId, entry.main.componentId])) ? "" : "disabled"}>${t("cabinetPlace")}</button>` : ""}`
    }</aside><main class="cb-main"><div class="cb-metrics"><span>${l.widthMm} × ${l.heightMm} mm</span><span>${Number.isFinite(area) ? area.toFixed(1) : "—"} % ${t("cabinetDeviceArea")}</span><span>${errors.length} ${t("cabinetErrors")} · ${issues.length - errors.length} ${t("wiringHints")}</span></div>${l.items.some((i) => i.kind === "standard") ? `<p class="cb-note cb-standard-origin">${t("cabinetStandardOnly")}</p>` : ""}<div class="cb-canvas"><div data-cabinet-surface data-eng-surface>${cabinetSvg(l, labels, this.selected, issues)}</div></div><p data-coordinates data-lens-transient>${t("cabinetDragHint")}</p>${rails
      .map((r) => {
        const capacity = railCapacity(l, r.id)!;
        return `<span class="cb-capacity">${esc(r.label)} · ${capacity.used.toFixed(1)} / ${r.widthMm} mm · ${capacity.free.toFixed(1)} mm ${t("cabinetRemaining")}</span>`;
      })
      .join(
        "",
      )}<details class="cb-issues" ${issues.length ? "open" : ""}><summary>${t("cabinetChecks")} (${issues.length})</summary>${issues.map((i, n) => `<button class="btn" data-issue="${n}">${esc(t(i.code as TranslationKey))} · ${esc(i.ids.map((id) => labels.get(id) || id).join(" / "))}</button>`).join("")}</details></main><aside class="cb-properties"><h3>${t("cabinetProperties")}</h3>${
      item
        ? `<strong>${esc(labels.get(item.id) || item.label)}</strong><label>${t("cabinetName")}<input class="form-input" data-item="label" value="${esc(item.kind === "device" ? labels.get(item.id) || item.label : item.label)}" ${item.kind === "device" ? "disabled" : ""} maxlength="160"></label><div class="cb-fields">${[
            ["x", "X [mm]"],
            ["y", "Y [mm]"],
            ["widthMm", t("cabinetWidth")],
            ["heightMm", t("cabinetHeight")],
            ["clearanceMm", t("cabinetClearance")],
          ]
            .map(
              ([key, label]) =>
                `<label>${label}<input class="form-input" type="number" data-item="${key}" step=".1" value="${item[key as "x"]}"></label>`,
            )
            .join(
              "",
            )}</div><label>${t("cabinetRotation")}<select class="form-input" data-item="rotation"><option value="0" ${!item.rotation ? "selected" : ""}>0°</option><option value="90" ${item.rotation ? "selected" : ""}>90°</option></select></label>${item.kind === "device" || (item.kind === "standard" && cabinetStandard(item.standardId)?.railMount) ? `<label>${t("cabinetRail")}<select class="form-input" data-item="railId"><option value="">${t("cabinetFree")}</option>${rails.map((r) => `<option value="${esc(r.id)}" ${r.id === item.railId ? "selected" : ""}>${esc(r.label)}</option>`).join("")}</select></label>` : ""}${item.kind === "device" ? `<label>${t("cabinetLibraryFace")}<select class="form-input" data-item="standardId"><option value="">${t("cabinetLibraryNoFace")}</option>${cabinetStandardLibrary.map((d) => `<option value="${d.id}" ${item.standardId === d.id ? "selected" : ""}>${esc(d.name[getUiLanguage()])}</option>`).join("")}</select></label><p class="cb-note">${t("cabinetLibraryFaceHint")}</p><label><input type="checkbox" data-manual ${item.sizeOrigin === "manual" ? "checked" : ""}> ${t("cabinetManualSize")}</label><button class="btn" data-article-size>${t("cabinetTakeSize")}</button>` : ""}${item.kind === "standard" ? `<p class="cb-note">${esc(cabinetStandard(item.standardId)?.name[getUiLanguage()] ?? "")} · ${t(item.sizeOrigin === "manual" ? "cabinetManualSize" : "cabinetStandardSize")}</p><button class="btn" data-standard-reset>${t("cabinetStandardReset")}</button>` : ""}<div class="cb-actions"><button class="btn" data-item-apply>${t("cabinetPropertiesApply")}</button><button class="btn" data-remove>${t("cabinetRemove")}</button></div>`
        : `<p>${t("cabinetSelect")}</p>`
    }</aside></div><p role="alert">${esc(this.error)}</p><footer><span>${t("cabinetDraftHint")}</span><button class="btn" data-close>${t("cabinetCancel")}</button><button class="btn" data-delete-board ${cabinetLayouts(this.source).some((b) => b.id === l.id) ? "" : "disabled"}>${t("cabinetDeleteBoard")}</button><button class="btn btn-primary" data-apply ${errors.length ? "disabled" : ""}>${t("cabinetApply")}</button></footer></section>`;
    const q = <T extends HTMLElement = HTMLElement>(s: string) =>
      this.el.querySelector<T>(s)!;
    const safe = (fn: () => void) => {
      try {
        fn();
        this.error = "";
      } catch (e) {
        this.error =
          e instanceof Error && e.message === "cabinetInvalid"
            ? t("cabinetInvalid")
            : articleError(e);
      }
      this.render();
    };
    q<HTMLDetailsElement>("[data-board-settings]").ontoggle = (e) => {
      this.plateExpanded = (e.target as HTMLDetailsElement).open;
    };
    this.bindLibrary();
    this.el
      .querySelector("[data-meter-open]")!
      .addEventListener("click", () => {
        this.templateExpanded = true;
        this.render();
        this.el
          .querySelector("[data-meter-template]")
          ?.scrollIntoView({ block: "nearest" });
      });
    const template = this.el.querySelector<HTMLDetailsElement>(
      "[data-meter-template]",
    );
    if (template)
      template.ontoggle = () => {
        this.templateExpanded = template.open;
      };
    this.el.querySelector<HTMLSelectElement>("[data-meter-height]")!.onchange =
      (e) => {
        this.templateHeight = Number((e.target as HTMLSelectElement).value);
        this.render();
      };
    this.el.querySelector<HTMLSelectElement>("[data-meter-fields]")!.onchange =
      (e) => {
        const count = Number((e.target as HTMLSelectElement).value);
        this.templateFields = Array.from(
          { length: count },
          (_, i) => this.templateFields[i] ?? "distribution",
        );
        this.render();
      };
    this.el.querySelectorAll<HTMLSelectElement>("[data-meter-kind]").forEach(
      (select) =>
        (select.onchange = () => {
          this.templateFields[Number(select.dataset.meterKind)] =
            select.value as MeterFieldKind;
          this.render();
        }),
    );
    this.el
      .querySelector("[data-meter-create]")!
      .addEventListener("click", () =>
        safe(() => {
          this.selected = "";
          this.change(
            createMeterCabinet({
              heightMm: this.templateHeight,
              fields: this.templateFields,
            }),
          );
        }),
      );
    this.el
      .querySelector("[data-meter-remove-guides]")
      ?.addEventListener("click", () => {
        const next = structuredClone(l);
        delete next.sections;
        this.change(next);
      });

    q("[data-close]").onclick = () =>
      this.embedded ? this.closeWorkspace() : this.el.remove();
    if (this.embedded)
      q("[data-close]").textContent = tr("Zum Schaltplan", "Back to drawing");
    q("[data-new]").onclick = () => {
      if (
        this.dirty &&
        !confirm(
          tr(
            "Nicht übernommene Aufbauänderungen verwerfen?",
            "Discard unapplied cabinet changes?",
          ),
        )
      )
        return;
      this.layout = this.fresh();
      this.past = [];
      this.future = [];
      this.selected = "";
      this.render();
    };
    q("[data-layout]").onchange = (e) => {
      if (
        this.dirty &&
        !confirm(
          tr(
            "Nicht übernommene Aufbauänderungen verwerfen?",
            "Discard unapplied cabinet changes?",
          ),
        )
      ) {
        this.render();
        return;
      }
      const found = cabinetLayouts(this.source).find(
        (b) => b.id === (e.target as HTMLSelectElement).value,
      );
      if (found) {
        this.layout = structuredClone(found);
        this.selected = "";
        this.past = [];
        this.future = [];
        this.render();
      }
    };
    q("[data-reload]").onclick = () => {
      this.source = structuredClone(this.getProject());
      this.candidates = cabinetCandidates(this.source);
      this.layout = structuredClone(
        cabinetLayouts(this.source).find((b) => b.id === l.id) ?? this.fresh(),
      );
      this.selected = "";
      this.past = [];
      this.future = [];
      this.error = "";
      this.render();
    };
    q("[data-undo]").onclick = () => this.history();
    q("[data-redo]").onclick = () => this.history(true);
    q("[data-apply]").onclick = () =>
      safe(() => {
        this.onApply(
          new CabinetLayoutEdit(this.source, l).apply(this.getProject()),
        );
        this.source = structuredClone(this.getProject());
        this.past = [];
        this.future = [];
      });
    q("[data-delete-board]").onclick = () =>
      safe(() => {
        this.onApply(
          new CabinetLayoutEdit(this.source, l, true).apply(this.getProject()),
        );
        this.source = structuredClone(this.getProject());
        this.layout = structuredClone(
          cabinetLayouts(this.source)[0] ?? this.fresh(),
        );
        this.selected = "";
        this.past = [];
        this.future = [];
      });
    q("[data-board-apply]").onclick = () => {
      const next = structuredClone(l);
      for (const field of this.el.querySelectorAll<HTMLInputElement>(
        "[data-board]",
      ))
        (next as any)[field.dataset.board!] =
          field.dataset.board === "name" ? field.value : Number(field.value);
      this.change(next);
    };
    const structure = (kind: "rail" | "duct") => {
      const next = structuredClone(l),
        count = l.items.filter((i) => i.kind === kind).length,
        id = crypto.randomUUID();
      next.items.push({
        id,
        kind,
        label:
          t(kind === "rail" ? "cabinetRail" : "cabinetDuct") +
          " " +
          (count + 1),
        x: kind === "rail" ? 60 : 10 + count * 50,
        y: kind === "rail" ? 150 + count * 150 : 10,
        widthMm: kind === "rail" ? Math.max(50, l.widthMm - 120) : 40,
        heightMm: kind === "rail" ? 35 : Math.max(50, l.heightMm - 20),
        rotation: 0,
        clearanceMm: 0,
      });
      this.selected = id;
      this.change(next);
    };
    q("[data-add-rail]").onclick = () => structure("rail");
    q("[data-add-duct]").onclick = () => structure("duct");
    q<HTMLInputElement>("[data-search]")?.addEventListener("input", (e) => {
      const input = e.target as HTMLInputElement,
        at = input.selectionStart;
      this.search = input.value;
      this.offset = 0;
      this.render();
      q<HTMLInputElement>("[data-search]").focus();
      q<HTMLInputElement>("[data-search]").setSelectionRange(at, at);
    });
    q("[data-prev]")?.addEventListener("click", () => {
      this.offset = Math.max(0, this.offset - 30);
      this.render();
    });
    q("[data-next]")?.addEventListener("click", () => {
      this.offset += 30;
      this.render();
    });
    for (const button of this.el.querySelectorAll<HTMLButtonElement>(
      "[data-candidate]",
    ))
      button.onclick = () => {
        this.candidate = button.dataset.candidate!;
        const e = this.candidates.find((c) => c.identity === this.candidate)!;
        this.width = e.dimensions ? String(e.dimensions.widthMm) : "";
        this.height = e.dimensions ? String(e.dimensions.heightMm) : "";
        this.manual = !e.dimensions;
        this.render();
      };
    for (const input of this.el.querySelectorAll<HTMLInputElement>(
      "[data-size]",
    ))
      input.oninput = () => {
        input.dataset.size === "width"
          ? (this.width = input.value)
          : (this.height = input.value);
        this.manual = true;
        q<HTMLButtonElement>("[data-place]").disabled = !(
          Number(this.width) > 0 && Number(this.height) > 0
        );
      };
    q("[data-place]")?.addEventListener("click", () => {
      if (
        !entry ||
        placed.has(JSON.stringify([entry.main.pageId, entry.main.componentId]))
      )
        return;
      const next = structuredClone(l),
        rail = next.items.find(
          (i) => i.id === q<HTMLSelectElement>("[data-new-rail]").value,
        ),
        id = crypto.randomUUID(),
        w = Number(this.width),
        h = Number(this.height),
        position = findCabinetPlacement(l, w, h, rail?.id);
      if (!position) {
        this.error = t("cabinetNoSpace");
        this.render();
        return;
      }
      next.items.push({
        id,
        kind: "device",
        label: entry.designation,
        x: position.x,
        y: position.y,
        widthMm: w,
        heightMm: h,
        clearanceMm: 0,
        rotation: 0,
        ...(rail ? { railId: rail.id } : {}),
        source: structuredClone(entry.main),
        physicalDeviceId: entry.state === "verified" ? entry.id : undefined,
        articleKey: entry.articleKey,
        sizeOrigin: this.manual ? "manual" : "article",
      });
      this.selected = id;
      this.change(next);
    });
    q("[data-item-apply]")?.addEventListener("click", () => {
      const next = structuredClone(l),
        i = next.items.find((i) => i.id === this.selected)!;
      for (const field of this.el.querySelectorAll<HTMLInputElement>(
        "[data-item]",
      ))
        if (!field.disabled)
          (i as any)[field.dataset.item!] = [
            "label",
            "railId",
            "standardId",
          ].includes(field.dataset.item!)
            ? field.value
            : Number(field.value);
      if (i.kind === "rail")
        for (const child of next.items)
          if (
            (child.kind === "device" || child.kind === "standard") &&
            child.railId === i.id
          ) {
            child.x += i.x - item!.x;
            child.y += i.y - item!.y + (i.heightMm - item!.heightMm) / 2;
          }
      if (!i.railId) delete i.railId;
      if (!i.standardId) delete i.standardId;
      if (
        i.widthMm !== item!.widthMm ||
        i.heightMm !== item!.heightMm ||
        this.el.querySelector<HTMLInputElement>("[data-manual]")?.checked
      ) {
        i.sizeOrigin = "manual";
        i.articleKey =
          i.kind === "device"
            ? this.candidates.find(
                (c) =>
                  c.main.pageId === i.source?.pageId &&
                  c.main.componentId === i.source?.componentId,
              )?.articleKey
            : undefined;
      }
      this.change(moveCabinetItem(next, i.id, i.x, i.y));
    });
    q("[data-standard-reset]")?.addEventListener("click", () => {
      const d = cabinetStandard(item?.standardId);
      if (!d) return;
      const next = structuredClone(l),
        i = next.items.find((i) => i.id === item!.id)!;
      i.widthMm = d.widthMm;
      i.heightMm = d.heightMm;
      i.sizeOrigin = "standard";
      this.change(moveCabinetItem(next, i.id, i.x, i.y));
    });
    q("[data-remove]")?.addEventListener("click", () => this.removeItem());
    q("[data-article-size]")?.addEventListener("click", () => {
      const e = this.candidates.find(
        (c) =>
          c.main.pageId === item?.source?.pageId &&
          c.main.componentId === item?.source?.componentId,
      );
      if (!e?.dimensions) {
        this.error = t("cabinetNoDimensions");
        this.render();
        return;
      }
      const next = structuredClone(l),
        i = next.items.find((i) => i.id === item!.id)!;
      i.widthMm = e.dimensions.widthMm;
      i.heightMm = e.dimensions.heightMm;
      i.articleKey = e.articleKey;
      i.sizeOrigin = "article";
      this.change(moveCabinetItem(next, i.id, i.x, i.y));
    });
    for (const button of this.el.querySelectorAll<HTMLButtonElement>(
      "[data-issue]",
    ))
      button.onclick = () => {
        this.selected = issues[Number(button.dataset.issue)].ids[0] ?? "";
        this.render();
        this.focusItem();
      };
    q("[data-pdf]").onclick = () =>
      safe(() => {
        new CabinetLayoutEdit(this.source, l).apply(this.getProject());
        cabinetPdf(l, labels, this.source.name, this.source).save(
          "schematico-cabinet.pdf",
        );
      });
    q("[data-svg]").onclick = () =>
      safe(() => {
        new CabinetLayoutEdit(this.source, l).apply(this.getProject());
        downloadArticleFile(
          cabinetSvg(l, labels, "", [], false),
          "schematico-cabinet.svg",
          "image/svg+xml",
        );
      });
    this.bindDrag();
    if (!this.embedded)
      finishEngineeringDialog(this.el, {
        kind: "cabinet",
        description: t("cabinetSubtitle"),
        wide: true,
        drawing: {
          project: this.getProject,
          navigate: this.navigate,
          targets: (id) => {
            const i = l.items.find(
              (i) => JSON.stringify(["cabinet", l.id, i.id]) === id,
            );
            return i?.source
              ? visualDrawingTargets(
                  this.getProject(),
                  JSON.stringify([
                    "terminal",
                    JSON.stringify([i.source.pageId, i.source.componentId]),
                  ]),
                )
              : [];
          },
        },
      });
    for (const { selector, left, top } of view) {
      const node = this.el.querySelector<HTMLElement>(selector);
      if (node) {
        node.scrollLeft = left;
        node.scrollTop = top;
      }
    }
    if (!this.embedded) focusArticleModal(this.el);
    else {
      const heading = this.el.querySelector("h2")!;
      const back = document.createElement("button");
      back.className = "btn";
      back.dataset.workspaceDrawing = "";
      back.textContent = tr(
        "← Schaltplan / Grundriss",
        "← Drawing / floor plan",
      );
      back.onclick = () => this.closeWorkspace();
      heading.append(" ", back);
      const section = this.el.querySelector<HTMLElement>("section")!;
      section.setAttribute("role", "region");
      section.removeAttribute("aria-modal");
      section.setAttribute("aria-label", t("cabinetTitle"));
      section.tabIndex = -1;
      mountEngineeringVisualLens(this.el, {
        project: this.getProject,
        navigate: this.navigate,
        targets: (id) => {
          const item = l.items.find(
            (i) => JSON.stringify(["cabinet", l.id, i.id]) === id,
          );
          return item?.source
            ? visualDrawingTargets(
                this.getProject(),
                JSON.stringify([
                  "terminal",
                  JSON.stringify([item.source.pageId, item.source.componentId]),
                ]),
              )
            : [];
        },
      });
      this.workspaceChanged?.();
    }
  }
  private meterTemplatePanel() {
    const width = this.templateFields.length * 250 + 50;
    return `<details class="cb-board-settings cb-meter-template" data-meter-template ${this.templateExpanded ? "open" : ""}><summary>${tr("Zählerschrankvorlagen", "Meter cabinet templates")}</summary><p class="cb-note">${tr("Herstellerunabhängige Planungsmaße · 250-mm-Felder · TH35-Schienen mit 12 TE", "Generic planning dimensions · 250-mm fields · TH35 rails with 12 modules")}</p><div class="cb-fields"><label>${tr("Felder", "Fields")}<select class="form-input" data-meter-fields>${meterCabinetFields.map((n) => `<option value="${n}" ${n === this.templateFields.length ? "selected" : ""}>${n}</option>`).join("")}</select></label><label>${tr("Höhe", "Height")}<select class="form-input" data-meter-height>${meterCabinetHeights.map((h) => `<option value="${h}" ${h === this.templateHeight ? "selected" : ""}>${h} mm</option>`).join("")}</select></label></div>${this.templateFields.map((kind, i) => `<label>${tr("Feld", "Field")} ${i + 1}<select class="form-input" data-meter-kind="${i}">${(["meter", "distribution", "reserve"] as const).map((value) => `<option value="${value}" ${kind === value ? "selected" : ""}>${meterFieldLabel(value)}</option>`).join("")}</select></label>`).join("")}<p class="cb-note">${width} × ${this.templateHeight} mm</p><button class="btn btn-primary" data-meter-create>${tr("Als neuen Aufbau einfügen", "Insert as new cabinet layout")}</button><p class="cb-note">${tr("Zählerbereiche bleiben für Zähler frei. Bestehende Aufbauten bleiben erhalten.", "Meter spaces remain free for meters. Existing layouts are preserved.")}</p></details>${this.layout.sections?.length ? `<button class="btn" data-meter-remove-guides>${tr("Feldeinteilung entfernen", "Remove field guides")}</button>` : ""}`;
  }
  private libraryPanel(rails: CabinetItem[]) {
    const list = findCabinetStandards(this.librarySearch, this.libraryCategory),
      d = cabinetStandard(this.standardId)!;
    this.libraryOffset = Math.min(
      this.libraryOffset,
      Math.max(0, Math.floor((list.length - 1) / 30) * 30),
    );
    const rail =
      this.standardRail === undefined
        ? (rails[0]?.id ?? "")
        : this.standardRail;
    return `<p class="cb-note">${t("cabinetLibraryHint")}</p><label>${t("cabinetLibraryCategory")}<select class="form-input" data-library-category><option value="">${t("cabinetLibraryAll")}</option>${cabinetLibraryCategories.map((c) => `<option value="${c}" ${c === this.libraryCategory ? "selected" : ""}>${t(("cabinetCategory_" + c) as TranslationKey)}</option>`).join("")}</select></label><input class="form-input" data-library-search aria-label="${t("cabinetLibrarySearch")}" placeholder="${t("cabinetLibrarySearch")}" value="${esc(this.librarySearch)}"><div class="cb-candidates cb-library-list">${
      list
        .slice(this.libraryOffset, this.libraryOffset + 30)
        .map(
          (d) =>
            `<button class="cb-candidate cb-library-card" data-standard="${d.id}" aria-pressed="${d.id === this.standardId}"><span class="cb-library-icon">${cabinetLibraryPreview(d)}</span><span><strong>${esc(d.name[getUiLanguage()])}</strong><small>${d.widthMm} × ${d.heightMm} mm${d.modules ? ` · ${d.modules} ${t("cabinetModules")}` : ""}</small></span></button>`,
        )
        .join("") || `<p>${t("cabinetLibraryEmpty")}</p>`
    }</div><div class="cb-actions"><button class="btn" data-library-prev ${this.libraryOffset ? "" : "disabled"}>‹</button><span>${list.length ? this.libraryOffset + 1 : 0}–${Math.min(list.length, this.libraryOffset + 30)} / ${list.length}</span><button class="btn" data-library-next ${this.libraryOffset + 30 >= list.length ? "disabled" : ""}>›</button></div><div class="cb-library-choice"><div class="cb-library-preview">${cabinetLibraryPreview(d)}</div><strong>${esc(d.name[getUiLanguage()])}</strong><p>${d.widthMm} × ${d.heightMm} mm${d.modules ? ` · ${d.modules} ${t("cabinetModules")}` : ""}</p><p class="cb-note">${t("cabinetStandardSize")}</p><label>${t("cabinetRail")}<select class="form-input" data-standard-rail ${d.railMount ? "" : "disabled"}><option value="">${t("cabinetFree")}</option>${d.railMount ? rails.map((r) => `<option value="${esc(r.id)}" ${r.id === rail ? "selected" : ""}>${esc(r.label)}</option>`).join("") : ""}</select></label><label>${t("cabinetLibraryQuantity")}<input class="form-input" type="number" min="1" max="24" step="1" data-standard-quantity value="${this.quantity}"></label><button class="btn btn-primary" data-standard-place ${Number.isInteger(this.quantity) && this.quantity >= 1 && this.quantity <= 24 ? "" : "disabled"}>${t("cabinetLibraryPlace")}</button></div>`;
  }
  private bindLibrary() {
    for (const b of this.el.querySelectorAll<HTMLButtonElement>(
      "[data-library-tab]",
    ))
      b.onclick = () => {
        this.panel = b.dataset.libraryTab as "project" | "standard";
        this.render();
      };
    const category = this.el.querySelector<HTMLSelectElement>(
      "[data-library-category]",
    );
    if (category)
      category.onchange = () => {
        this.libraryCategory = category.value as CabinetLibraryCategory | "";
        this.libraryOffset = 0;
        this.render();
      };
    const search = this.el.querySelector<HTMLInputElement>(
      "[data-library-search]",
    );
    if (search)
      search.oninput = () => {
        const at = search.selectionStart;
        this.librarySearch = search.value;
        this.libraryOffset = 0;
        this.render();
        const input = this.el.querySelector<HTMLInputElement>(
          "[data-library-search]",
        )!;
        input.focus();
        input.setSelectionRange(at, at);
      };
    for (const b of this.el.querySelectorAll<HTMLButtonElement>(
      "[data-standard]",
    ))
      b.onclick = () => {
        this.standardId = b.dataset.standard!;
        this.render();
      };
    const previous = this.el.querySelector<HTMLButtonElement>(
        "[data-library-prev]",
      ),
      next = this.el.querySelector<HTMLButtonElement>("[data-library-next]");
    if (previous)
      previous.onclick = () => {
        this.libraryOffset = Math.max(0, this.libraryOffset - 30);
        this.render();
      };
    if (next)
      next.onclick = () => {
        this.libraryOffset += 30;
        this.render();
      };
    const rail = this.el.querySelector<HTMLSelectElement>(
      "[data-standard-rail]",
    );
    if (rail)
      rail.onchange = () => {
        this.standardRail = rail.value;
      };
    const quantity = this.el.querySelector<HTMLInputElement>(
        "[data-standard-quantity]",
      ),
      place = this.el.querySelector<HTMLButtonElement>("[data-standard-place]");
    if (quantity && place)
      quantity.oninput = () => {
        this.quantity = Number(quantity.value);
        place.disabled =
          !Number.isInteger(this.quantity) ||
          this.quantity < 1 ||
          this.quantity > 24;
      };
    if (place)
      place.onclick = () => {
        try {
          const next = insertCabinetStandard(
            this.layout,
            this.standardId,
            rail?.disabled ? undefined : rail?.value || undefined,
            this.quantity,
          );
          this.selected = next.items.at(-1)!.id;
          this.change(next);
        } catch (e) {
          this.error = t(
            (e instanceof Error &&
            ["cabinetNoSpace", "cabinetRailInvalid"].includes(e.message)
              ? e.message
              : "cabinetInvalid") as TranslationKey,
          );
          this.render();
        }
      };
  }
  private bindDrag() {
    const svg = this.el.querySelector<SVGSVGElement>(".cb-svg")!;
    const itemById = new Map(this.layout.items.map((i) => [i.id, i])),
      nodes = [...this.el.querySelectorAll<SVGElement>("[data-cabinet-item]")];
    let pan: { pointer: number; x: number; y: number } | undefined;
    const panBy = (dx: number, dy: number) => {
      // Keep blank-sheet panning while the SVG owns touch gestures. Consume the
      // movement in the canvas first, then in its scrollable workspace ancestors.
      for (
        let node = svg.parentElement;
        node && node !== this.el;
        node = node.parentElement
      ) {
        const style = getComputedStyle(node),
          left = node.scrollLeft,
          top = node.scrollTop;
        if (/auto|scroll/.test(style.overflowX)) node.scrollLeft += dx;
        if (/auto|scroll/.test(style.overflowY)) node.scrollTop += dy;
        dx -= node.scrollLeft - left;
        dy -= node.scrollTop - top;
      }
    };
    let drag:
      | {
          id: string;
          pointer: number;
          x: number;
          y: number;
          startX: number;
          startY: number;
        }
      | undefined;
    const point = (e: PointerEvent) => {
      const matrix = svg.getScreenCTM();
      return matrix
        ? new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse())
        : new DOMPoint();
    };
    svg.onclick = (e) => {
      const node = (e.target as Element).closest<SVGElement>(
        "[data-cabinet-item]",
      );
      if (node && this.selected !== node.dataset.cabinetItem) {
        this.selected = node.dataset.cabinetItem!;
        this.render();
        this.focusItem();
      }
    };
    svg.onpointerdown = (e) => {
      if (drag || pan || !e.isPrimary || (e.button !== 0 && e.button !== 1))
        return;
      const g = (e.target as Element).closest<SVGElement>(
        "[data-cabinet-item]",
      );
      if (!g || e.button === 1) {
        e.preventDefault();
        pan = { pointer: e.pointerId, x: e.clientX, y: e.clientY };
        svg.classList.add("is-panning");
        svg.setPointerCapture(e.pointerId);
        return;
      }
      e.preventDefault();
      this.selected = g.dataset.cabinetItem!;
      const i = this.layout.items.find((i) => i.id === this.selected)!,
        p = point(e);
      drag = {
        id: i.id,
        pointer: e.pointerId,
        x: p.x,
        y: p.y,
        startX: i.x,
        startY: i.y,
      };
      svg.classList.add("is-dragging");
      svg.setPointerCapture(e.pointerId);
    };
    svg.onpointermove = (e) => {
      if (pan?.pointer === e.pointerId) {
        e.preventDefault();
        panBy(pan.x - e.clientX, pan.y - e.clientY);
        pan.x = e.clientX;
        pan.y = e.clientY;
        return;
      }
      if (!drag || e.pointerId !== drag.pointer) return;
      const p = point(e),
        i = itemById.get(drag!.id)!,
        snap = (n: number) =>
          Math.round(n / this.layout.gridMm) * this.layout.gridMm,
        dx = snap(drag.startX + p.x - drag.x) - drag.startX,
        dy =
          (i.kind === "device" || i.kind === "standard") && i.railId
            ? 0
            : snap(drag.startY + p.y - drag.y) - drag.startY;
      for (const node of nodes) {
        const child = itemById.get(node.dataset.cabinetItem!);
        if (child?.id === i.id || (i.kind === "rail" && child?.railId === i.id))
          node.setAttribute("transform", `translate(${dx} ${dy})`);
      }
      this.el.querySelector("[data-coordinates]")!.textContent =
        `X ${(drag.startX + dx).toFixed(1)} mm · Y ${(drag.startY + dy).toFixed(1)} mm`;
    };
    svg.onpointerup = (e) => {
      if (pan?.pointer === e.pointerId) {
        pan = undefined;
        svg.classList.remove("is-panning");
        if (svg.hasPointerCapture(e.pointerId))
          svg.releasePointerCapture(e.pointerId);
        return;
      }
      if (!drag || e.pointerId !== drag.pointer) return;
      const p = point(e),
        d = drag;
      drag = undefined;
      svg.classList.remove("is-dragging");
      if (svg.hasPointerCapture(e.pointerId))
        svg.releasePointerCapture(e.pointerId);
      if (Math.abs(p.x - d.x) + Math.abs(p.y - d.y) > 0.1)
        this.change(
          moveCabinetItem(
            this.layout,
            d.id,
            d.startX + p.x - d.x,
            d.startY + p.y - d.y,
          ),
        );
      else this.render();
      this.focusItem();
    };
    const cancel = (e: PointerEvent) => {
      if (pan?.pointer === e.pointerId) {
        pan = undefined;
        svg.classList.remove("is-panning");
      }
      if (drag?.pointer === e.pointerId) {
        drag = undefined;
        svg.classList.remove("is-dragging");
        this.render();
        this.focusItem();
      }
    };
    svg.onpointercancel = cancel;
    svg.onlostpointercapture = cancel;
  }
}
