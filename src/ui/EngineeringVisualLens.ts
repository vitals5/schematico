import {
  visualDrawingTargets,
  type DrawingAccess,
  type DrawingTarget,
} from "./EngineeringDrawing";
import { t } from "../i18n";
import {
  clampVisualScale,
  relatedVisualIds,
  visualMapLayout,
  type VisualRecord,
} from "./EngineeringVisualModel";
const surfaces: Record<string, string> = {
  manufacturingReportDialog:"[data-report-preview]",
  automationDialog: "[data-visual]",
  connectorNavigator: "[data-visual]",
  connectionNavigator: "[data-visual]",
  wiringDialog: "[data-tc-visual]",
  terminalStripDialog: ".ts-rail",
};
const instances = new WeakMap<HTMLElement, VisualLens>(),
  live = new Set<VisualLens>();
let cleanup: MutationObserver | undefined;
export function mountEngineeringVisualLens(
  root: HTMLElement,
  drawing?: DrawingAccess,
) {
  if (!surfaces[root.id]) return;
  let lens = instances.get(root);
  if (!lens) {
    lens = new VisualLens(root);
    instances.set(root, lens);
    live.add(lens);
    if (!cleanup) {
      cleanup = new MutationObserver(() => {
        for (const item of live)
          if (!item.root.isConnected) {
            item.destroy();
            live.delete(item);
          }
        if (!live.size) {
          cleanup?.disconnect();
          cleanup = undefined;
        }
      });
      cleanup.observe(document.body, { childList: true });
    }
  }
  lens.targetCacheReset();
  lens.drawing = drawing;
  lens.mount();
}
class VisualLens {
  drawing?: DrawingAccess;
  private targetCache?: {
    project: unknown;
    id: string;
    targets: DrawingTarget[];
  };
  private restoreDrawing?: () => void;
  private scale = 1;
  private trace = false;
  private problems = false;
  private pinned?: string;
  private hovered?: string;
  private frame = 0;
  private toolbar = document.createElement("nav");
  private events = new AbortController();
  private observer: MutationObserver;
  private resize: ResizeObserver;
  private entries: { element: Element; record: VisualRecord }[] = [];
  constructor(readonly root: HTMLElement) {
    this.toolbar.className = "eng-lens-toolbar";
    this.toolbar.dataset.lensToolbar = "";
    this.toolbar.setAttribute("aria-label", t("visualLens"));
    this.observer = new MutationObserver((records) => {
      if (
        records.some(
          (r) => !(r.target as Element).closest?.("[data-lens-toolbar]"),
        )
      )
        this.schedule();
    });
    this.observer.observe(root, { subtree: true, childList: true });
    this.resize = new ResizeObserver(() => this.schedule());
    this.resize.observe(root);
    const signal = this.events.signal;
    root.addEventListener(
      "pointerover",
      (e) => {
        const node = (e.target as Element).closest("[data-eng-id]");
        if (node && this.root.contains(node) && !node.closest("[hidden]")) {
          const id = (node as HTMLElement).dataset.engId;
          if (this.hovered !== id) {
            this.hovered = id;
            if (this.trace && !this.pinned) this.schedule();
          }
        }
      },
      { signal },
    );
    root.addEventListener(
      "pointerleave",
      () => {
        this.hovered = undefined;
        if (this.trace && !this.pinned) this.schedule();
      },
      { signal },
    );
    root.addEventListener(
      "focusin",
      (e) => {
        const node = (e.target as Element).closest<HTMLElement>(
          "[data-eng-id]",
        );
        if (node) {
          this.hovered = node.dataset.engId;
          if (this.trace && !this.pinned) this.schedule();
        }
      },
      { signal },
    );
    root.addEventListener(
      "click",
      (e) => {
        if ((e.target as Element).closest("[data-lens-toolbar]")) return;
        const node = (e.target as Element).closest<HTMLElement>(
          "[data-eng-id]",
        );
        if (node) this.pinned = node.dataset.engId;
        this.schedule();
      },
      { capture: true, signal },
    );
    root.addEventListener("scroll", () => this.schedule(), {
      capture: true,
      signal,
    });
  }
  targetCacheReset() {
    this.targetCache = undefined;
  }
  mount() {
    const header = this.root.querySelector(".eng-header");
    if (!header) return;
    header.after(this.toolbar);
    this.toolbar.innerHTML = `<strong>${t("visualLens")}</strong><button type="button" data-lens-out aria-label="${t("visualZoomOut")}">−</button><span data-lens-scale></span><button type="button" data-lens-in aria-label="${t("visualZoomIn")}">+</button><button type="button" data-lens-fit>${t("visualFit")}</button><button type="button" data-lens-reset>100%</button><button type="button" data-lens-trace aria-pressed="${this.trace}">${t("visualTrace")}</button><button type="button" data-lens-problems aria-pressed="${this.problems}">${t("visualFindings")}</button><button type="button" data-lens-next>${t("visualNextFinding")}</button><button type="button" data-lens-previous aria-label="${t("visualPrevious")}">‹</button><button type="button" data-lens-following aria-label="${t("visualFollowing")}">›</button><button type="button" data-lens-properties>${t("visualProperties")}</button><select data-lens-target aria-label="${t("visualDrawingTarget")}" hidden></select><button type="button" data-lens-drawing hidden>${t("visualDrawing")}</button><select data-lens-jump aria-label="${t("visualJump")}"></select><div class="eng-lens-map" data-lens-map aria-hidden="true"></div><span data-lens-context role="status"></span><button type="button" data-lens-clear aria-label="${t("visualClear")}">×</button>`;
    const q = <T extends HTMLElement = HTMLElement>(s: string) =>
      this.toolbar.querySelector<T>(s)!;
    const step = (offset: number) => {
      const ids = [...new Set(this.entries.map((e) => e.record.id))];
      if (!ids.length) return;
      const at = ids.indexOf(this.pinned ?? "");
      this.jump(
        ids[
          at < 0
            ? offset > 0
              ? 0
              : ids.length - 1
            : (at + offset + ids.length) % ids.length
        ],
      );
    };
    q("[data-lens-previous]").onclick = () => step(-1);
    q("[data-lens-following]").onclick = () => step(1);
    q("[data-lens-properties]").onclick = () => {
      const item = this.entries.find((e) => e.record.id === this.pinned);
      if (!item) return;
      const el = item.element.matches("button,g[role=button]")
        ? item.element
        : item.element.querySelector("[data-articles]");
      if (el && !el.matches(":disabled"))
        el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    };
    q("[data-lens-drawing]").onclick = () => {
      const target = this.targets().find(
        (t) =>
          JSON.stringify([t.pageId, t.componentId]) ===
          q<HTMLSelectElement>("[data-lens-target]").value,
      );
      if (target) this.peekDrawing(target);
    };
    q("[data-lens-in]").onclick = () => this.zoom(this.scale + 0.15);
    q("[data-lens-out]").onclick = () => this.zoom(this.scale - 0.15);
    q("[data-lens-reset]").onclick = () => this.zoom(1);
    q("[data-lens-fit]").onclick = () => this.fit();
    q("[data-lens-trace]").onclick = () => {
      this.trace = !this.trace;
      this.schedule();
    };
    q("[data-lens-problems]").onclick = () => {
      this.problems = !this.problems;
      this.schedule();
    };
    q("[data-lens-clear]").onclick = () => {
      this.pinned = undefined;
      this.hovered = undefined;
      this.schedule();
    };
    q<HTMLSelectElement>("[data-lens-jump]").onchange = (e) =>
      this.jump((e.target as HTMLSelectElement).value);
    q("[data-lens-next]").onclick = () => {
      const issues = [
        ...new Set(
          this.entries.filter((e) => e.record.issue).map((e) => e.record.id),
        ),
      ];
      if (issues.length)
        this.jump(
          issues[(issues.indexOf(this.pinned ?? "") + 1) % issues.length],
        );
    };
    q("[data-lens-map]").onclick = (e) => {
      const id = (e.target as Element)
        .closest("[data-map-id]")
        ?.getAttribute("data-map-id");
      if (id) this.jump(id);
    };
    this.schedule();
  }
  private targets() {
    if (!this.drawing || !this.pinned) return [];
    const project = this.drawing.project();
    if (
      this.targetCache?.project !== project ||
      this.targetCache.id !== this.pinned
    )
      this.targetCache = {
        project,
        id: this.pinned,
        targets:
          this.drawing.targets?.(this.pinned) ??
          visualDrawingTargets(project, this.pinned),
      };
    return this.targetCache.targets;
  }
  private peekDrawing(target: DrawingTarget) {
    if (!this.drawing || this.restoreDrawing) return;
    const live = visualDrawingTargets(
      this.drawing.project(),
      JSON.stringify([
        "terminal",
        JSON.stringify([target.pageId, target.componentId]),
      ]),
    );
    if (!live.length) return;
    const overlays = [
        ...document.querySelectorAll<HTMLElement>(".modal-backdrop"),
      ].filter((el) => !el.hidden),
      hidden = overlays.map((el) => ({ el, hidden: el.hidden })),
      focus = document.activeElement as HTMLElement | null,
      bar = document.createElement("div");
    bar.className = "eng-drawing-return";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", t("visualReturn"));
    const text = document.createElement("span");
    text.textContent = target.label;
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = t("visualReturn");
    bar.append(text, back);
    const restore = () => {
      for (const { el, hidden: before } of hidden) el.hidden = before;
      bar.remove();
      this.restoreDrawing = undefined;
      if (this.root.isConnected) {
        focus?.focus({ preventScroll: true });
        this.schedule();
      }
    };
    this.restoreDrawing = restore;
    back.onclick = restore;
    bar.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        restore();
      }
    };
    try {
      this.drawing.navigate(target.pageId, target.componentId);
      overlays.forEach((el) => (el.hidden = true));
      document.body.append(bar);
      back.focus();
    } catch {
      restore();
    }
  }
  private zoom(value: number) {
    this.scale = clampVisualScale(value);
    this.root.style.setProperty("--eng-visual-scale", String(this.scale));
    this.schedule();
  }
  private fit() {
    const all = this.entries.map((e) => e.element.getBoundingClientRect());
    if (!all.length) return;
    const surface = this.root.querySelector<HTMLElement>(
      surfaces[this.root.id],
    );
    if (!surface) return;
    const box = surface.getBoundingClientRect(),
      width =
        Math.max(...all.map((b) => b.right)) -
        Math.min(...all.map((b) => b.left));
    this.zoom(
      Math.min(
        1,
        (this.scale * Math.max(100, box.width - 12)) / Math.max(1, width),
      ),
    );
  }
  private jump(id: string) {
    const item = this.entries.find((e) => e.record.id === id);
    if (!item) return;
    this.pinned = id;
    item.element.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: "instant",
    });
    if (
      item.element instanceof HTMLElement ||
      item.element instanceof SVGElement
    )
      item.element.focus({ preventScroll: true });
    this.schedule();
  }
  private schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.root.isConnected) this.update();
    });
  }
  private update() {
    if (this.restoreDrawing) return;
    for (const el of this.root.querySelectorAll("[data-eng-surface]"))
      el.removeAttribute("data-eng-surface");
    const active = [
      ...this.root.querySelectorAll<HTMLElement>(surfaces[this.root.id]),
    ].filter((e) => e.getClientRects().length && !e.closest("[hidden]"));
    active.forEach((e) => e.setAttribute("data-eng-surface", ""));
    this.entries = [...this.root.querySelectorAll<HTMLElement>("[data-eng-id]")]
      .filter(
        (el) =>
          active.some((s) => s.contains(el)) &&
          el.getClientRects().length &&
          !el.closest("[hidden]"),
      )
      .map((element) => {
        const list = (value: string | undefined) => {
          try {
            const a = JSON.parse(value ?? "[]");
            return Array.isArray(a)
              ? a.filter((s: unknown) => typeof s === "string").slice(0, 512)
              : [];
          } catch {
            return [];
          }
        };
        return {
          element,
          record: {
            id: element.dataset.engId!,
            label: element.dataset.engLabel ?? "",
            neighbors: list(element.dataset.engNeighbors),
            groups: list(element.dataset.engGroups),
            issue: element.dataset.engIssue === "true",
          },
        };
      });
    const records = this.entries.map((e) => e.record),
      ids = new Set(records.map((r) => r.id));
    if (this.pinned && !ids.has(this.pinned)) this.pinned = undefined;
    if (this.hovered && !ids.has(this.hovered)) this.hovered = undefined;
    const origin = this.pinned ?? this.hovered,
      related = origin ? relatedVisualIds(records, origin) : new Set<string>();
    for (const { element, record: r } of this.entries) {
      element.classList.toggle(
        "eng-lens-origin",
        !!this.pinned && r.id === this.pinned,
      );
      element.classList.toggle(
        "eng-lens-related",
        this.trace && related.has(r.id),
      );
      element.classList.toggle(
        "eng-lens-dim",
        (this.trace && !!origin && !related.has(r.id)) ||
          (this.problems && !r.issue),
      );
      element.classList.toggle("eng-lens-problem", this.problems && r.issue);
    }
    const q = <T extends HTMLElement = HTMLElement>(s: string) =>
      this.toolbar.querySelector<T>(s)!;
    q("[data-lens-scale]").textContent = Math.round(this.scale * 100) + "%";
    q("[data-lens-trace]").setAttribute("aria-pressed", String(this.trace));
    q("[data-lens-problems]").setAttribute(
      "aria-pressed",
      String(this.problems),
    );
    const unique = [...new Map(records.map((r) => [r.id, r])).values()],
      issues = unique.filter((r) => r.issue);
    q<HTMLButtonElement>("[data-lens-next]").disabled = !issues.length;
    q<HTMLButtonElement>("[data-lens-fit]").disabled = !unique.length;
    q<HTMLButtonElement>("[data-lens-previous]").disabled = !unique.length;
    q<HTMLButtonElement>("[data-lens-following]").disabled = !unique.length;
    const entry = this.entries.find(
        (e) => e.record.id === this.pinned,
      )?.element,
      action = entry?.matches("button,g[role=button]")
        ? entry
        : entry?.querySelector("[data-articles]");
    q<HTMLButtonElement>("[data-lens-properties]").disabled =
      !action || action.matches(":disabled");
    const targets = this.targets(),
      picker = q<HTMLSelectElement>("[data-lens-target]"),
      signatureTargets = JSON.stringify(targets),
      oldTarget = picker.value;
    if (picker.dataset.signature !== signatureTargets) {
      picker.dataset.signature = signatureTargets;
      picker.replaceChildren(
        ...targets.map(
          (target) =>
            new Option(
              target.label,
              JSON.stringify([target.pageId, target.componentId]),
            ),
        ),
      );
      if (
        targets.some(
          (target) =>
            JSON.stringify([target.pageId, target.componentId]) === oldTarget,
        )
      )
        picker.value = oldTarget;
    }
    picker.hidden = targets.length < 2;
    q("[data-lens-drawing]").hidden = !targets.length;
    const select = q<HTMLSelectElement>("[data-lens-jump]"),
      old = select.value;
    const signature = JSON.stringify(
      unique.map((r) => [r.id, r.label, r.issue]),
    );
    if (select.dataset.signature !== signature) {
      select.dataset.signature = signature;
      select.replaceChildren(
        new Option(t("visualJump"), ""),
        ...unique.map(
          (r) =>
            new Option((r.issue ? "! " : "") + r.label.slice(0, 110), r.id),
        ),
      );
    }
    select.value = this.pinned ?? old;
    const chosen = unique.find((r) => r.id === origin),
      label =
        chosen?.label ??
        `${unique.length} ${t("visualObjects")} · ${issues.length} ${t("visualVisibleFindings")}`;
    q("[data-lens-context]").textContent =
      chosen && this.trace
        ? label +
          " · " +
          Math.max(0, related.size - 1) +
          " " +
          t("visualRelations")
        : label;
    q("[data-lens-context]").title = q("[data-lens-context]").textContent ?? "";
    const layout = visualMapLayout(
      this.entries.map((e) => {
        const b = e.element.getBoundingClientRect();
        return {
          id: e.record.id,
          x: b.left,
          y: b.top,
          width: b.width,
          height: b.height,
        };
      }),
    );
    const ns = "http://www.w3.org/2000/svg",
      svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 210 58");
    for (const box of layout.boxes) {
      const record = unique.find((r) => r.id === box.id)!,
        rect = document.createElementNS(ns, "rect");
      for (const [key, value] of Object.entries({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      }))
        rect.setAttribute(key, String(value));
      rect.setAttribute("rx", "1");
      rect.setAttribute("data-map-id", box.id);
      rect.classList.toggle("is-issue", record.issue);
      rect.classList.toggle("is-related", this.trace && related.has(box.id));
      rect.classList.toggle("is-origin", box.id === this.pinned);
      svg.append(rect);
    }
    if (active[0] && layout.boxes.length) {
      let clip = active[0].getBoundingClientRect(),
        left = clip.left,
        right = clip.right,
        top = clip.top,
        bottom = clip.bottom;
      for (
        let node: HTMLElement | null = active[0];
        node && node !== this.root;
        node = node.parentElement
      ) {
        const style = getComputedStyle(node),
          b = node.getBoundingClientRect();
        if (/auto|scroll|hidden/.test(style.overflowX)) {
          left = Math.max(left, b.left);
          right = Math.min(right, b.right);
        }
        if (/auto|scroll|hidden/.test(style.overflowY)) {
          top = Math.max(top, b.top);
          bottom = Math.min(bottom, b.bottom);
        }
      }
      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("class", "eng-map-window");
      for (const [key, value] of Object.entries({
        x: 4 + (left - layout.left) * layout.scale,
        y: 4 + (top - layout.top) * layout.scale,
        width: Math.max(1, (right - left) * layout.scale),
        height: Math.max(1, (bottom - top) * layout.scale),
      }))
        rect.setAttribute(key, String(value));
      svg.append(rect);
    }
    q("[data-lens-map]").replaceChildren(svg);
  }
  destroy() {
    this.restoreDrawing?.();
    this.events.abort();
    this.observer.disconnect();
    this.resize.disconnect();
    if (this.frame) cancelAnimationFrame(this.frame);
    this.root.style.removeProperty("--eng-visual-scale");
    this.toolbar.remove();
    instances.delete(this.root);
  }
}
