import "./TerminalEditor.css";
import {
  defaultTerminalRowForm,
  terminalRowForm,
  readTerminalRowForm,
  updateTerminalRowForm,
  type TerminalRowFormState,
} from "./TerminalRowForm";
import type { Project } from "../model/types";
import type {
  AssignedArticle,
  ComponentAddress,
  CatalogArticle,
} from "../model/ArticleTypes";
import { TerminalEditorSession } from "../model/TerminalEditorSession";
import {
  terminalEditorSnapshot,
  terminalEditorChanges,
  type TerminalEditorRow,
  type TerminalEditorStrip,
  type TerminalEditorSnapshot,
} from "./TerminalEditorModel";
import {
  terminalAddressKey,
  terminalStripKey,
  terminalIdentity,
  type TerminalStripIdentity,
} from "../model/TerminalStripTypes";
import { terminalSettings } from "../model/WiringManagement";
import { terminalLevelValues } from "../model/TerminalFunctions";
import { terminalFields, collectTerminalFields } from "./TerminalFields";
import {
  componentInsertionPoint,
  symbolInsertionPoint,
} from "../model/SymbolGeometry";
import { effectiveArticles } from "../model/ArticleAssignments";
import { articleFunctions } from "../model/ArticleFunctions";
import { articleCompatibility } from "../model/ArticleCompatibility";
import { PartsListGenerator, partQuantityLabel } from "../reports/PartsList";
import {
  ArticleCatalogDialog,
  articleError,
  downloadArticleFile,
} from "./ArticleCatalogDialog";
import { bindArticleModalKeys, focusArticleModal } from "./ArticleModal";
import { escapeSvg as esc } from "../model/ImportedDrawing";
import { tr, t, getLocalizedSymbol, type TranslationKey } from "../i18n";

export type TerminalEditorTab =
  | "function"
  | "device"
  | "article"
  | "bridges"
  | "checks";
interface Initial {
  createRow?: boolean;
  target?: ComponentAddress;
  identity?: TerminalStripIdentity;
  tab?: TerminalEditorTab;
}
const key = (a: ComponentAddress) => terminalAddressKey(a);
const addressFromKey = (value: string): ComponentAddress => {
  const [pageId, componentId] = JSON.parse(value);
  return { pageId, componentId };
};
const field = (id: string, label: string, value: string, type = "text") =>
  `<label>${esc(label)}<input class="form-input" data-field="${id}" type="${type}" value="${esc(value)}"></label>`;

/** A single terminal workspace: strip navigator → physical order → selected
 * function. Every tab edits the same isolated session, never another dialog. */
export class TerminalEditorDialog {
  private el = document.createElement("div");
  private session: TerminalEditorSession;
  private snapshot: TerminalEditorSnapshot;
  private baseline: TerminalEditorSnapshot;
  private baselineProject: Project;
  private stripKey = "";
  private selected = "";
  private selectedAccessory = "";
  private accessorySnapshot?: CatalogArticle;
  private checked = new Set<string>();
  private tab: TerminalEditorTab = "function";
  private search = "";
  private offset = 0;
  private error = "";
  private formDirty = false;
  private dirtyControls = new Set<Element>();
  private review = false;
  private closing = false;
  private creation?: TerminalRowFormState;
  constructor(
    private getProject: () => Project,
    private onApply: (p: Project) => void,
    initial: Initial = {},
    private navigate?: (a: ComponentAddress) => void,
    private onClose?: () => void,
  ) {
    this.session = new TerminalEditorSession(getProject());
    this.baselineProject = this.session.baseline;
    this.snapshot = terminalEditorSnapshot(this.session.project);
    this.baseline = this.snapshot;
    this.tab = initial.tab ?? "function";
    if (initial.target) {
      this.selected = key(initial.target);
      this.stripKey =
        this.snapshot.strips.find((s) =>
          s.rows.some((r) => r.key === this.selected),
        )?.key ?? "";
    }
    if (!this.stripKey && initial.identity)
      this.stripKey = terminalStripKey(initial.identity);
    this.normaliseSelection();
    if (initial.createRow) {
      this.creation = defaultTerminalRowForm(this.session.project);
      this.creation.count = "1";
      this.formDirty = true;
    }
  }
  show() {
    if (document.getElementById("terminalEditorDialog")) return;
    this.el.id = "terminalEditorDialog";
    this.el.className = "modal-backdrop";
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => this.requestClose());
    this.el.addEventListener("keydown", (e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z" &&
        !this.formDirty
      ) {
        e.preventDefault();
        this.undo(e.shiftKey);
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "y" &&
        !this.formDirty
      ) {
        e.preventDefault();
        this.undo(true);
      }
    });
    this.render();
  }
  private beginCreation(append = false) {
    if (!this.canLeave()) return;
    this.creation = defaultTerminalRowForm(
      this.session.project,
      append ? this.strip()?.identity : undefined,
    );
    this.formDirty = true;
    this.error = "";
    this.render();
  }
  private createRow() {
    if (!this.creation) return;
    readTerminalRowForm(this.el, this.creation);
    const form = this.creation;
    try {
      const created = this.session.createRow({
        mode: form.mode,
        identity: form.identity,
        symbolId: form.symbolId,
        count: form.empty ? 0 : form.count.trim() ? Number(form.count) : NaN,
        startNumber: form.startNumber.trim() ? Number(form.startNumber) : NaN,
        pageId: form.empty ? undefined : form.pageId || undefined,
        title: tr("Klemmenreihe", "Terminal strip") + " " + form.identity.strip,
      });
      this.snapshot = terminalEditorSnapshot(this.session.project);
      this.stripKey = terminalStripKey(created.identity);
      this.selected = created.members[0] ? key(created.members[0]) : "";
      this.selectedAccessory = "";
      this.creation = undefined;
      this.formDirty = false;
      this.checked.clear();
      this.search = "";
      this.offset = 0;
      this.review = true;
      this.error = "";
      this.normaliseSelection();
      this.render();
    } catch (e) {
      this.message(e);
    }
  }
  private strip() {
    return this.snapshot.strips.find((s) => s.key === this.stripKey);
  }
  private row() {
    return this.strip()?.rows.find((r) => r.key === this.selected);
  }
  private normaliseSelection() {
    if (!this.strip()) this.stripKey = this.snapshot.strips[0]?.key ?? "";
    const rows = this.strip()?.rows ?? [];
    if (!rows.some((r) => r.key === this.selected))
      this.selected = rows[0]?.key ?? "";
    const valid = new Set(rows.map((r) => r.key));
    this.checked = new Set([...this.checked].filter((k) => valid.has(k)));
  }
  private message(e: unknown) {
    this.error = typeof e === "string" ? e : articleError(e);
    const node = this.el.querySelector("[data-editor-error]");
    if (node) node.textContent = this.error;
  }
  private canLeave() {
    if (!this.formDirty) return true;
    if (this.creation) {
      this.message(
        tr(
          "Die Reihe zuerst anlegen oder den Assistenten mit „Abbrechen“ verlassen.",
          "Create the strip first or leave the assistant with Cancel.",
        ),
      );
      return false;
    }
    this.message(
      tr(
        "Bitte die Eingaben zuerst vormerken oder mit „Eingaben zurücksetzen“ verwerfen.",
        "Stage your edits first, or discard them with “Reset fields”.",
      ),
    );
    return false;
  }
  private canStage(selector: string) {
    const button = this.el.querySelector(selector),
      scope =
        button?.closest(".te-card") ?? this.el.querySelector(".te-details");
    if ([...this.dirtyControls].every((c) => scope?.contains(c))) return true;
    return this.canLeave();
  }
  private change(action: (s: TerminalEditorSession) => void) {
    try {
      action(this.session);
      this.snapshot = terminalEditorSnapshot(this.session.project);
      this.normaliseSelection();
      this.formDirty = false;
      this.dirtyControls.clear();
      this.error = "";
      this.review = false;
      this.render();
      return true;
    } catch (e) {
      this.message(e);
      return false;
    }
  }
  private undo(redo = false) {
    if (!this.canLeave()) return;
    this.change((s) => (redo ? s.redo() : s.undo()));
  }
  private ensureStrip(
    s: TerminalEditorSession,
    identity: TerminalStripIdentity,
  ) {
    if (
      !s.project.terminalStrips?.some(
        (config) => terminalStripKey(config) === terminalStripKey(identity),
      )
    )
      s.strip({ kind: "initialize", identity });
    return s.project.terminalStrips!.find(
      (config) => terminalStripKey(config) === terminalStripKey(identity),
    )!;
  }
  private position(
    s: TerminalEditorSession,
    address: ComponentAddress,
    identity: TerminalStripIdentity,
  ) {
    const strip = this.ensureStrip(s, identity),
      pos = strip.positions.find(
        (p) =>
          p.kind === "terminal" &&
          p.members.some((a) => key(a) === key(address)),
      );
    if (!pos) throw new Error("terminalStripMemberMissing");
    return { strip, pos };
  }
  private select(row: TerminalEditorRow) {
    if (!this.canLeave()) return;
    this.selected = row.key;
    this.selectedAccessory = "";
    this.accessorySnapshot = undefined;
    this.render();
  }
  private requestClose() {
    if (this.formDirty || this.session.changed) {
      this.closing = true;
      this.renderFooter();
      return;
    }
    this.close();
  }
  private close() {
    this.el.remove();
    this.onClose?.();
  }
  private commit() {
    if (!this.canLeave()) return;
    try {
      const next = this.session.apply(this.getProject()),
        target = this.row();
      if (
        target &&
        !this.baselineProject.pages.some((page) =>
          page.components.some((c) => c.id === target.address.componentId),
        )
      )
        next.activePageId = target.address.pageId;
      this.onApply(next);
      this.session = new TerminalEditorSession(this.getProject());
      this.baselineProject = this.session.baseline;
      this.snapshot = terminalEditorSnapshot(this.session.project);
      this.baseline = this.snapshot;
      this.normaliseSelection();
      this.error = "";
      this.review = false;
      this.closing = false;
      this.render();
    } catch (e) {
      this.message(e);
    }
  }
  private render() {
    this.dirtyControls.clear();
    this.accessorySnapshot = undefined;
    const strip = this.strip(),
      row = this.row(),
      accessory = strip?.configuration?.positions.find(
        (p) => p.id === this.selectedAccessory && p.kind === "accessory",
      ),
      tabs: [TerminalEditorTab, string][] = [
        ["function", tr("Funktion", "Function")],
        ["device", tr("Aufbau", "Assembly")],
        ["article", tr("Artikel", "Parts")],
        ["bridges", tr("Brücken", "Bridges")],
        ["checks", tr("Prüfung", "Checks")],
      ];
    this.el.innerHTML = `<section class="te-shell ${this.creation ? "is-creating" : ""}" role="dialog" aria-modal="true" aria-label="${tr("Klemmeneditor", "Terminal editor")}"><header class="te-header"><div><h2>${tr("Klemmeneditor", "Terminal editor")}</h2><p>${tr("Klemmenleiste wählen · Klemme auswählen · Eigenschaften bearbeiten · Änderungen prüfen", "Choose a strip · Select a terminal · Edit properties · Review changes")}</p></div><button class="btn" data-close aria-label="${t("close")}">✕</button></header><div class="te-body"><nav class="te-nav" aria-label="${tr("Klemmenleisten", "Terminal strips")}"><button class="te-create-button" data-create-row>＋ ${tr("Klemmenreihe anlegen", "Create terminal strip")}</button>${this.snapshot.strips.map((s) => `<button data-strip-key="${esc(s.key)}" aria-current="${s.key === this.stripKey}"><strong>${esc(s.identity.strip || "—")}</strong><small>${esc([s.identity.plant && "=" + s.identity.plant, s.identity.location && "+" + s.identity.location].filter(Boolean).join(" ") || tr("Ohne Strukturkennzeichen", "No structure designation"))}</small><small>${s.rows.length} ${tr("Platzierungen", "placements")}${s.issues ? " · ! " + s.issues : ""}</small></button>`).join("") || `<p class="te-note">${tr("Noch keine Klemmenreihe vorhanden. Legen Sie hier Ihre erste Reihe an.", "No terminal strip yet. Create your first strip here.")}</p>`}</nav><main class="te-center"><div data-create-panel ${this.creation ? "" : "hidden"}>${this.creation ? terminalRowForm(this.session.project, this.creation) : ""}</div><div class="te-toolbar"><strong>${esc(strip?.identity.strip ?? "—")}</strong>${strip ? `<button class="btn btn-primary" data-add-terminals>＋ ${tr("Klemmen hinzufügen", "Add terminals")}</button>` : ""}<input class="form-input" data-search placeholder="${tr("Nummer, Text, Artikel oder Blatt suchen…", "Search number, text, part or sheet…")}" aria-label="${t("wiringSearch")}" value="${esc(this.search)}"><button class="btn" data-export>${tr("Leiste als CSV", "Strip as CSV")}</button></div><div class="te-note">${tr("Die Reihenfolge zeigt den physischen Aufbau. Etagen einer Geräteposition gehören zu einem Gehäuse.", "Order represents physical assembly. Levels at one device position share a housing.")}</div><div class="te-rail" data-rail aria-label="${tr("Klemmenaufbau", "Terminal assembly")}"></div><div class="te-grid" data-grid></div><div class="te-actions"><span data-count class="te-note"></span><span style="flex:1"></span><button class="btn" data-prev>${t("reviewPrevious")}</button><button class="btn" data-next>${t("reviewNext")}</button></div></main><aside class="te-inspector"><div class="te-context"><strong>${esc(accessory?.kind === "accessory" ? accessory.description : row?.entry.component.bmk || tr("Klemme auswählen", "Select a terminal"))}</strong><p class="te-note">${accessory ? tr("Zubehörposition · ohne elektrische Funktion", "Accessory position · no electrical function") : row ? esc((row.positionNumber ? tr("Geräteposition", "Device position") + " " + row.positionNumber + " · " : "") + (row.main ? tr("Hauptklemme / Artikelträger", "Main terminal / article owner") : tr("Nebenfunktion", "Secondary function")) + " · " + t("page") + " " + row.entry.page.pageNumber) : tr("Wählen Sie eine Zeile oder eine Klemme in der grafischen Aufbauleiste.", "Select a row or a terminal in the assembly rail.")}</p>${row && !accessory && this.navigate ? `<button class="btn" data-navigate>${tr("Im Schaltplan anzeigen", "Show in schematic")}</button>` : ""}</div><div class="te-tabs" role="tablist" aria-label="${tr("Klemmeneinstellungen", "Terminal settings")}">${tabs.map(([id, label]) => `<button role="tab" data-tab="${id}" ${accessory && id !== "device" ? "disabled" : ""} aria-selected="${this.tab === id}" aria-controls="te-details" id="te-tab-${id}">${label}</button>`).join("")}</div><div class="te-details" id="te-details" role="tabpanel" aria-labelledby="te-tab-${this.tab}">${this.details(strip, row)}</div></aside></div><div role="alert" data-editor-error>${esc(this.error)}</div><div class="te-preview" data-preview hidden></div><footer></footer></section>`;
    this.el.querySelector(".terminal-fields [data-terminal-error]")?.remove();
    for (const input of this.el.querySelectorAll<HTMLInputElement>(
      "[data-terminal-field=number],[data-terminal-field=level],[data-terminal-field=levelDesignation]",
    ))
      input.readOnly = false;
    this.renderRows();
    if (this.creation) updateTerminalRowForm(this.el, this.creation);
    this.renderFooter();
    this.bind();
    if (this.review && !this.creation) this.renderReview();
    focusArticleModal(this.el);
  }
  private renderRows() {
    const strip = this.strip(),
      words = this.search.toLocaleLowerCase().split(/\s+/).filter(Boolean),
      rows = (strip?.rows ?? []).filter((r) =>
        words.every((w) =>
          [
            r.entry.component.bmk,
            r.entry.component.functionText,
            r.article,
            r.levelText,
            r.entry.page.pageNumber,
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(w),
        ),
      );
    this.offset = Math.min(
      this.offset,
      Math.max(0, Math.floor((rows.length - 1) / 100) * 100),
    );
    const shown = rows.slice(this.offset, this.offset + 100);
    const positions = strip?.configuration?.positions ?? [],
      rail = positions.length
        ? positions.map((p, i) => ({
            id: p.id,
            label:
              p.kind === "accessory"
                ? p.description
                : p.members
                    .map((a) =>
                      this.snapshot.index.component(a.componentId, a.pageId)
                        ? terminalSettings(
                            this.snapshot.index.component(
                              a.componentId,
                              a.pageId,
                            )!.component,
                          ).number
                        : "?",
                    )
                    .filter((n, j, all) => all.indexOf(n) === j)
                    .join("/"),
            number: i + 1,
            rows:
              p.kind === "terminal"
                ? strip!.rows.filter((r) => r.position?.id === p.id)
                : [],
          }))
        : rows.map((r, i) => ({
            id: r.key,
            label: terminalSettings(r.entry.component).number || "?",
            number: i + 1,
            rows: [r],
          }));
    this.el.querySelector("[data-rail]")!.innerHTML =
      rail
        .slice(0, 100)
        .map(
          (p) =>
            `<button class="${p.rows.some((r) => r.key === this.selected) || this.selectedAccessory === p.id ? "is-selected" : ""}" data-rail-position="${esc(p.id)}"><small>${p.number}</small><strong>${esc(p.label || "?")}</strong><small>${p.rows.length > 1 ? p.rows.length + " " + tr("Etagen / Teile", "levels / parts") : p.rows[0]?.levelText || tr("Zubehör", "Accessory")}</small></button>`,
        )
        .join("") +
      (rail.length > 100
        ? `<span class="te-note">${tr("Weitere Positionen in der Tabelle", "More positions in the table")}</span>`
        : "");
    this.el.querySelector("[data-grid]")!.innerHTML =
      `<table><thead><tr><th aria-label="${tr("Auswahl", "Selection")}">✓</th>${[tr("Position", "Position"), tr("Klemme / Etage", "Terminal / level"), tr("Funktion", "Function"), tr("Ziele innen / außen", "Internal / external targets"), tr("Artikel", "Part"), t("page")].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${shown.map((r, i) => `<tr tabindex="0" data-address="${esc(r.key)}" aria-selected="${this.selected === r.key}" class="${this.selected === r.key ? "is-active " : ""}${i === 0 || r.position?.id !== shown[i - 1].position?.id ? "te-position-start" : ""}"><td><input type="checkbox" data-check="${esc(r.key)}" aria-label="${esc(r.entry.component.bmk)} ${tr("für Mehrstockklemme markieren", "mark for multi-level assembly")}" ${this.checked.has(r.key) ? "checked" : ""}></td><td>${r.positionNumber ?? "—"}</td><td><strong>${esc(terminalSettings(r.entry.component).number || "?")}</strong><small>${esc(r.levelText)}</small><span class="te-badge ${r.main ? "is-main" : ""}">${r.main ? tr("Haupt", "Main") : tr("Neben", "Secondary")}</span>${r.entry.component.terminal?.functionId ? `<span class="te-badge">${tr("Teilklemme", "Partial")}</span>` : ""}</td><td>${esc(r.entry.symbol ? getLocalizedSymbol(r.entry.symbol).name : "?")}<small>${esc(r.entry.component.functionText)}</small>${r.issues.length ? `<span class="te-badge">! ${r.issues.length}</span>` : ""}</td><td><small>${esc([...new Set(r.reports.map((v) => v.internalTarget))].join(" · "))}</small><small>${esc([...new Set(r.reports.map((v) => v.externalTarget))].join(" · "))}</small></td><td>${esc(r.article || "—")}</td><td>${esc(r.entry.page.pageNumber)}</td></tr>`).join("") || `<tr><td colspan="7" class="te-note">${!strip ? `<h3>${tr("Ihre erste Klemmenreihe", "Your first terminal strip")}</h3><p>${tr("Wählen Sie Kennzeichen, Klemmentyp und Anzahl. Die Nummerierung und Platzierung erledigt der Assistent.", "Choose a designation, terminal type and quantity. The assistant handles numbering and placement.")}</p><button class="btn btn-primary" data-create-row>${tr("Klemmenreihe anlegen", "Create terminal strip")}</button>` : !strip.rows.length ? `<h3>${tr("Diese Klemmenreihe ist noch leer", "This terminal strip is empty")}</h3><button class="btn btn-primary" data-add-terminals>${tr("Klemmen hinzufügen", "Add terminals")}</button>` : tr("Keine passenden Klemmen. Suchfilter löschen oder eine andere Leiste wählen.", "No matching terminals. Clear the filter or choose another strip.")}</td></tr>`}</tbody></table>`;
    this.el.querySelector("[data-count]")!.textContent =
      `${rows.length ? this.offset + 1 : 0}–${Math.min(this.offset + 100, rows.length)} / ${rows.length} · ${this.checked.size} ${tr("für Mehrstockklemme markiert", "marked for multi-level assembly")}`;
    (this.el.querySelector("[data-prev]") as HTMLButtonElement).disabled =
      this.offset === 0;
    (this.el.querySelector("[data-next]") as HTMLButtonElement).disabled =
      this.offset + 100 >= rows.length;
  }
  private details(
    strip?: TerminalEditorStrip,
    row?: TerminalEditorRow,
  ): string {
    if (!strip)
      return `<p class="te-note">${tr("Der Editor verwaltet bereits platzierte Klemmen, deren Artikel und logische Verbindungen.", "The editor manages placed terminals, their parts and logical connections.")}</p>`;
    if (this.tab === "checks")
      return `<h3>${tr("Hinweise für diese Klemmenleiste", "Findings for this strip")}</h3>${strip.rows.flatMap((r) => r.issues.map((i) => `<div class="te-card"><strong>${esc(r.entry.component.bmk)}</strong><p>${esc(t(i.code))}</p><small>${esc(i.details)}</small><button class="btn" data-pick="${esc(r.key)}">${tr("Klemme auswählen", "Select terminal")}</button></div>`)).join("") || `<p class="te-note">${tr("Keine Klemmenhinweise in diesem Prüfumfang. Das ersetzt keine vollständige elektrische Prüfung.", "No terminal findings within this check scope. This does not replace a complete electrical inspection.")}</p>`}`;
    if (this.tab === "bridges") return this.bridges(strip, row);
    const accessory = strip.configuration?.positions.find(
      (p) => p.id === this.selectedAccessory && p.kind === "accessory",
    );
    if (accessory?.kind === "accessory")
      return `<h3>${tr("Zubehörposition", "Accessory position")}</h3>${this.accessoryForm(accessory.article, accessory.description)}<button class="btn" data-remove-accessory>${tr("Zubehörposition entfernen", "Remove accessory position")}</button>`;
    if (!row)
      return `<p class="te-note">${tr("Wählen Sie eine Klemme aus der Tabelle.", "Select a terminal in the table.")}</p>${this.tab === "device" ? this.accessoryForm() : ""}`;
    const c = row.entry.component,
      symbol = row.entry.symbol;
    if (this.tab === "function")
      return `<p class="te-note">${tr("Die Funktionsdefinition des Symbols bestimmt die Anschlusslogik. Bezeichnungen und Anschlussseiten ändern Sie hier.", "The symbol function definition determines its connection logic. Edit designations and connection sides here.")}</p>${c.terminal?.functionId ? `<p class="te-note">${tr("Nummer und Etage gelten für alle Teilplatzierungen dieser logischen Klemme.", "Number and level apply to all partial placements of this logical terminal.")}</p>` : ""}${symbol ? terminalFields(c, symbol) : ""}${field("function-text", tr("Funktionstext", "Function text"), c.functionText)}<div class="te-card">${row.reports.map((r) => `<div class="te-port"><div><strong>${esc(r.levelDesignation ?? r.terminalNumber)}</strong><small>${tr("Innen", "Internal")}: ${esc(r.internalTarget)}<br>${tr("Außen", "External")}: ${esc(r.externalTarget)}</small></div></div>`).join("")}</div><div class="te-actions"><button class="btn btn-primary" data-stage-function>${tr("Änderung vormerken", "Stage change")}</button><button class="btn" data-reset-fields>${tr("Eingaben zurücksetzen", "Reset fields")}</button></div>`;
    if (this.tab === "device") return this.assembly(strip, row);
    return this.articles(row);
  }
  private assembly(strip: TerminalEditorStrip, row: TerminalEditorRow) {
    const c = row.entry.component,
      levels = terminalLevelValues(c, row.entry.symbol),
      device = this.snapshot.index.devices.forComponent(row.address),
      members = device?.members ?? [row.address],
      selected = strip.rows.filter((r) => this.checked.has(r.key)),
      position = row.position;
    const sorted = members
        .map((a) => this.snapshot.index.component(a.componentId, a.pageId)!)
        .filter(Boolean)
        .sort((a, b) =>
          new Intl.Collator("en", { numeric: true }).compare(
            a.component.terminal?.level ?? "",
            b.component.terminal?.level ?? "",
          ),
        ),
      lo = sorted[0]?.component.terminal?.level,
      hi = sorted.at(-1)?.component.terminal?.level;
    const mainCandidates = members.filter((a) => {
      const level = this.snapshot.index.component(a.componentId, a.pageId)
        ?.component.terminal?.level;
      return level === lo || level === hi;
    });
    const symbol = row.entry.symbol,
      anchor = symbol ? symbolInsertionPoint(symbol) : { x: 0, y: 0 },
      scale = c.scale ?? 1,
      point = symbol
        ? componentInsertionPoint(c, {
            ...symbol,
            width: symbol.width * scale,
            height: symbol.height * scale,
            insertionPoint: { x: anchor.x * scale, y: anchor.y * scale },
          })
        : { x: c.x, y: c.y };
    return `<section class="te-card"><h3>${tr("Geräteposition und Reihenfolge", "Device position and order")}</h3><p class="te-note">${tr("Ein Gehäuse kann mehrere Etagen besitzen. Die Artikel werden an der Hauptklemme geführt.", "One housing may have multiple levels. Parts belong to the main terminal.")}</p><button class="btn" data-align-row>${tr("Auf diesem Blatt horizontal anordnen","Arrange horizontally on this sheet")}</button><div class="te-actions"><button class="btn" data-order="up">← ${tr("Früher", "Earlier")}</button><button class="btn" data-order="down">${tr("Später", "Later")} →</button><button class="btn" data-sort>${tr("Nach Sortierkennung", "By sorting key")}</button></div>${
      device
        ? `<label>${tr("Hauptklemme / Artikelträger", "Main terminal / article owner")}<select class="form-input" data-main-target>${mainCandidates
            .map((a) => {
              const e = this.snapshot.index.component(a.componentId, a.pageId)!;
              return `<option value="${esc(key(a))}" ${key(a) === key(device.main) ? "selected" : ""}>${esc(e.component.bmk + " · " + (e.component.terminal?.levelDesignation || e.component.terminal?.level || "0") + " · " + t("page") + " " + e.page.pageNumber)}</option>`;
            })
            .join(
              "",
            )}</select></label><button class="btn" data-main>${tr("Hauptklemme vormerken", "Stage main terminal")}</button>`
        : ""
    }</section>
  <section class="te-card"><h3>${tr("Etagen und Teilplatzierungen", "Levels and partial placements")}</h3><p class="te-note">${tr("Aufteilen erhält die Anschlusspositionen und Leitungswege. Die Funktionen können danach unabhängig platziert werden.", "Splitting preserves pin positions and wire paths. Functions can then be placed independently.")}</p><label>${tr("Hauptetage", "Main level")}<select class="form-input" data-split-main>${levels
    .filter((_, i) => i === 0 || i === levels.length - 1)
    .map((l) => `<option value="${esc(l.id)}">${esc(l.designation)}</option>`)
    .join(
      "",
    )}</select></label><div class="te-actions"><button class="btn" data-split-levels ${device || levels.length < 2 ? "disabled" : ""}>${tr("Etagen aufteilen", "Split levels")}</button><button class="btn" data-split-parts ${device || levels.length !== 1 || (row.entry.symbol?.pins.length ?? 0) < 2 || !["feed_through", "pe"].includes(row.entry.symbol?.terminalDefinition?.kind ?? "") ? "disabled" : ""}>${tr("Teilklemmen erstellen", "Create partial terminals")}</button></div>${
    device
      ? members
          .map((a) => {
            const e = this.snapshot.index.component(a.componentId, a.pageId)!;
            return `<p class="te-port"><span>${esc(e.component.terminal?.levelDesignation || e.component.terminal?.level || "0")} · ${t("page")} ${esc(e.page.pageNumber)}${key(a) === key(device.main) ? " · " + tr("Haupt", "Main") : ""}</span><button class="btn" data-pick="${esc(key(a))}">${tr("Auswählen", "Select")}</button></p>`;
          })
          .join("")
      : ""
  }</section>
  <section class="te-card"><h3>${tr("Mehrstockklemme zusammenfassen", "Assemble multi-level terminal")}</h3><p class="te-note">${tr("Markieren Sie die gewünschten Positionen in der Tabelle und vergeben Sie je Funktion eine eindeutige Etage.", "Check the required positions in the table, then assign a unique level to each function.")}</p>${selected.map((r, i) => `<label>${esc(r.entry.component.bmk)}<input class="form-input" data-group-level="${esc(r.key)}" value="${esc(r.entry.component.terminal?.level || String(i + 1))}"></label>`).join("")}<div class="te-actions"><button class="btn" data-group ${selected.length < 2 ? "disabled" : ""}>${tr("Zusammenfassen vormerken", "Stage assembly")}</button><button class="btn" data-ungroup ${position?.kind === "terminal" && position.members.length > 1 && !c.terminal?.functionId ? "" : "disabled"}>${tr("Etagen trennen", "Separate levels")}</button></div></section>
  <details class="te-card"><summary>${tr("Platzierung auf anderes Blatt verschieben", "Move placement to another sheet")}</summary><p class="te-note">${t("terminalDistributionConnected")}</p><label>${t("page")}<select class="form-input" data-target-page>${this.session.project.pages
    .filter((p) => p.pageType === "schematic")
    .map(
      (p) =>
        `<option value="${esc(p.id)}" ${p.id === row.entry.page.id ? "selected" : ""}>${esc(p.pageNumber + " · " + p.title)}</option>`,
    )
    .join(
      "",
    )}</select></label><div class="te-fields">${field("target-x", "X", String(point.x), "number")}${field("target-y", "Y", String(point.y), "number")}</div><button class="btn" data-move>${tr("Verschieben vormerken", "Stage move")}</button></details>
  <details class="te-card"><summary>${tr("Zubehör hinzufügen", "Add accessory")}</summary>${this.accessoryForm()}</details>
  <details class="te-card"><summary>${tr("Erweiterte Verwaltung", "Advanced management")}</summary><p class="te-note">${t("terminalStripResetHint")}</p><button class="btn" data-reset-strip ${strip.configuration ? "" : "disabled"}>${tr("Bestückung zurücksetzen", "Reset assembly")}</button></details>`;
  }
  private accessoryForm(article?: AssignedArticle, description = "") {
    return `<div data-accessory-form>${field("accessory-description", tr("Bezeichnung", "Description"), description)}<div class="te-fields">${field("accessory-number", tr("Artikelnummer", "Part number"), article?.articleNumber ?? "")}${field("accessory-manufacturer", tr("Hersteller", "Manufacturer"), article?.manufacturer ?? "")}${field("accessory-variant", tr("Variante", "Variant"), article?.variant ?? "")}${field("accessory-quantity", tr("Stückzahl", "Quantity"), String(article?.quantity ?? 1), "number")}</div><button class="btn" data-accessory-catalog>${tr("Aus Artikelkatalog", "Choose from catalogue")}</button><button class="btn" data-stage-accessory>${tr("Zubehör vormerken", "Stage accessory")}</button><button class="btn" data-reset-fields>${tr("Eingaben zurücksetzen", "Reset fields")}</button></div>`;
  }
  private articles(row: TerminalEditorRow) {
    const owner = this.snapshot.index.devices.owner(row.address),
      items = owner
        ? effectiveArticles(owner.component, this.session.project)
        : [],
      targets = this.snapshot.index.devices.forComponent(row.address)
        ?.members ?? [row.address],
      compat = articleCompatibility(
        this.session.project,
        row.address,
        this.snapshot.index.devices,
      ),
      allFunctions = articleFunctions(this.session.project, targets),
      seen = new Set<string>(),
      functions = allFunctions.filter((f) => {
        const id =
          this.snapshot.index.component(f.address.componentId, f.address.pageId)
            ?.component.terminal?.functionId ?? key(f.address);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    return `<p class="te-note">${tr("Die Artikel gehören zur gesamten Geräteposition. Nebenfunktionen verwenden die Zuordnung der Hauptklemme.", "Parts belong to the entire device position. Secondary functions use the main terminal assignment.")}</p><div class="te-card"><strong>${esc(owner?.component.bmk ?? row.entry.component.bmk)}</strong>${items.map((a, i) => `<p><strong>${esc(a.articleNumber)}</strong> · ${esc(a.manufacturer)}<br><small>${esc(a.variant)} · ${a.quantity ?? "?"} × · ${a.role === "main" ? tr("Hauptartikel", "Main part") : tr("Zubehör", "Accessory")}</small><label>${tr("Stückzahl", "Quantity")}<input class="form-input" data-article-quantity="${i}" type="number" min="0" step="any" value="${a.quantity ?? ""}"></label><button class="btn" data-remove-article="${i}">${tr("Entfernen", "Remove")}</button></p>`).join("") || `<p class="te-note">${tr("Noch kein Artikel zugeordnet.", "No part assigned yet.")}</p>`}<button class="btn" data-stage-quantities ${items.length ? "" : "disabled"}>${tr("Mengen vormerken", "Stage quantities")}</button><button class="btn" data-reset-fields>${tr("Eingaben zurücksetzen", "Reset fields")}</button><div class="te-actions"><button class="btn btn-primary" data-catalog>${tr("Hauptartikel wählen", "Choose main part")}</button><button class="btn" data-catalog-accessory>${tr("Zubehör wählen", "Choose accessory")}</button></div></div><details class="te-card"><summary>${tr("Artikelnummer manuell eingeben", "Enter part number manually")}</summary><div class="te-fields">${field("article-number", tr("Artikelnummer", "Part number"), "")}${field("article-manufacturer", tr("Hersteller", "Manufacturer"), "")}${field("article-variant", tr("Variante", "Variant"), "")}${field("article-quantity", tr("Stückzahl", "Quantity"), "1", "number")}</div><button class="btn" data-manual-article>${tr("Hauptartikel vormerken", "Stage main part")}</button><button class="btn" data-reset-fields>${tr("Eingaben zurücksetzen", "Reset fields")}</button></details><section class="te-card"><h3>${tr("Funktionszuordnung", "Function allocation")}</h3><p class="te-note">${tr("Die Prüfung vergleicht Anschlussbild und Funktionsschablonen des Artikels. Unbekannte Daten bleiben ungeprüft.", "The check compares the connection pattern and part function templates. Unknown data remains unverified.")}</p><p>${compat.status === "compatible" ? tr("Anschlussbild passt zu den hinterlegten Daten.", "Connection pattern matches the recorded data.") : tr("Zuordnung prüfen", "Review allocation") + " · " + compat.issues.map((i) => esc(t(("articlesIssue_" + i.code) as TranslationKey))).join(", ")}</p>${functions.map((f) => `<label>${esc(f.bmk + " · " + f.actualPins.join(", "))}<select class="form-input" data-function-choice="${esc(key(f.address))}"><option value="">${tr("Nicht zugeordnet", "Unassigned")}</option>${f.candidates.map((c) => `<option value="${esc(c.id)}" ${f.current === c.id ? "selected" : ""}>${esc(c.id + " · " + c.pins.join(", "))}</option>`).join("")}</select></label>`).join("")}<label><span><input type="checkbox" data-confirm-function-type> ${tr("Abweichenden Funktionstyp ausdrücklich bestätigen", "Explicitly confirm a different function type")}</span></label><label><span><input type="checkbox" data-confirm-function-replace> ${tr("Vorhandene Funktionszuordnung ersetzen", "Replace existing function allocation")}</span></label><button class="btn" data-stage-functions>${tr("Funktionszuordnung vormerken", "Stage function allocation")}</button><button class="btn" data-reset-fields>${tr("Eingaben zurücksetzen", "Reset fields")}</button></section>`;
  }
  private bridges(strip: TerminalEditorStrip, row?: TerminalEditorRow) {
    const pins = strip.rows.flatMap((r) =>
        this.snapshot.index.pinsFor(r.entry).map((p) => ({
          value: JSON.stringify({ ...r.address, pinId: p.id }),
          label:
            r.entry.component.bmk +
            ":" +
            p.label +
            " · " +
            t("page") +
            " " +
            r.entry.page.pageNumber,
        })),
      ),
      ids = new Set(strip.rows.map((r) => r.address.componentId));
    const label = (ep: { componentId: string; pinId: string }) => {
      const e = this.snapshot.index.componentsById.get(ep.componentId);
      return e?.length === 1
        ? e[0].component.bmk +
            ":" +
            (this.snapshot.index.pin(e[0], ep.pinId)?.label ?? ep.pinId)
        : "? " + ep.componentId + ":" + ep.pinId;
    };
    return `<p class="te-note">${tr("Brücken verbinden konkrete Klemmstellen elektrisch. Unterschiedliche Etagen bleiben ohne Brücke getrennt. Eine N–PE-Brücke wird zurückgewiesen.", "Bridges electrically connect specific terminal points. Different levels remain separate without a bridge. An N–PE bridge is rejected.")}</p><section class="te-card"><h3>${tr("Brücke hinzufügen", "Add bridge")}</h3>${["from", "to"].map((side, i) => `<label>${i ? tr("Nach", "To") : tr("Von", "From")}<select class="form-input" data-bridge-${side}>${pins.map((p, j) => `<option value="${esc(p.value)}" ${i === 0 ? (JSON.parse(p.value).componentId === row?.address.componentId && j === pins.findIndex((p) => JSON.parse(p.value).componentId === row?.address.componentId) ? "selected" : "") : j === 1 ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select></label>`).join("")}<label>${tr("Brückentyp", "Bridge type")}<select class="form-input" data-bridge-type><option value="plug">${t("wiringPlug")}</option><option value="wire">${t("wiringWireBridge")}</option></select></label><button class="btn btn-primary" data-stage-bridge ${pins.length < 2 ? "disabled" : ""}>${tr("Brücke vormerken", "Stage bridge")}</button><button class="btn" data-reset-fields>${tr("Eingaben zurücksetzen", "Reset fields")}</button></section>${(
      this.session.project.logicalConnections ?? []
    )
      .filter(
        (w) =>
          w.terminalBridge &&
          (ids.has(w.from.componentId) || ids.has(w.to.componentId)),
      )
      .map(
        (w) =>
          `<section class="te-card"><strong>${esc(label(w.from))} ━ ${esc(label(w.to))}</strong><p class="te-note">${t(w.terminalBridge === "plug" ? "wiringPlug" : "wiringWireBridge")}</p><button class="btn" data-remove-bridge="${esc(w.id)}">${tr("Entfernung vormerken", "Stage removal")}</button></section>`,
      )
      .join("")}`;
  }
  private renderFooter() {
    const footer = this.el.querySelector("footer")!;
    if (this.creation && !this.closing) {
      footer.innerHTML = `<span class="te-note">${tr("Zuerst die Reihe konfigurieren, dann prüfen und übernehmen.", "Configure the strip, then review and apply.")}</span><div class="te-actions"><button class="btn" data-cancel-row>${tr("Abbrechen", "Cancel")}</button><button class="btn btn-primary" data-stage-row>${this.creation.mode === "new" ? tr("Reihe anlegen und prüfen", "Create strip and review") : tr("Klemmen hinzufügen und prüfen", "Add terminals and review")}</button></div>`;
      footer
        .querySelector("[data-stage-row]")!
        .addEventListener("click", () => this.createRow());
      footer
        .querySelector("[data-cancel-row]")!
        .addEventListener("click", () => {
          this.creation = undefined;
          this.formDirty = false;
          this.dirtyControls.clear();
          this.error = "";
          this.render();
        });
      return;
    }

    footer.innerHTML = this.closing
      ? `<strong>${tr("Nicht übernommene Änderungen verwerfen?", "Discard unapplied changes?")}</strong><div class="te-actions"><button class="btn" data-keep>${tr("Weiter bearbeiten", "Keep editing")}</button><button class="btn" data-discard-close>${tr("Verwerfen und schließen", "Discard and close")}</button></div>`
      : `<span class="te-note" data-draft-status>${this.formDirty ? tr("Eingaben noch nicht vorgemerkt", "Fields not yet staged") : this.session.changed ? tr("Entwurf geändert · Projekt noch unverändert", "Draft changed · project unchanged") : tr("Projekt unverändert · Änderungen werden erst nach der Prüfung übernommen", "Project unchanged · changes are applied only after review")}</span><div class="te-actions"><button class="btn" data-undo ${this.session.canUndo && !this.formDirty ? "" : "disabled"} title="Strg+Z">↶</button><button class="btn" data-redo ${this.session.canRedo && !this.formDirty ? "" : "disabled"}>↷</button><button class="btn" data-reset-draft ${this.session.changed ? "" : "disabled"}>${tr("Entwurf verwerfen", "Discard draft")}</button><button class="btn" data-review ${this.session.changed ? "" : "disabled"}>${tr("Änderungen prüfen", "Review changes")}</button><button class="btn btn-primary" data-apply ${this.session.changed && this.review && !this.formDirty ? "" : "disabled"}>${t("articlesApply")}</button></div>`;
    footer.querySelector("[data-keep]")?.addEventListener("click", () => {
      this.closing = false;
      this.renderFooter();
    });
    footer
      .querySelector("[data-discard-close]")
      ?.addEventListener("click", () => this.close());
    footer
      .querySelector("[data-undo]")
      ?.addEventListener("click", () => this.undo());
    footer
      .querySelector("[data-redo]")
      ?.addEventListener("click", () => this.undo(true));
    footer
      .querySelector("[data-reset-draft]")
      ?.addEventListener("click", () => {
        if (this.canLeave()) this.change((s) => s.reset());
      });
    footer.querySelector("[data-review]")?.addEventListener("click", () => {
      if (this.canLeave()) {
        this.review = true;
        this.renderReview();
        this.renderFooter();
      }
    });
    footer
      .querySelector("[data-apply]")
      ?.addEventListener("click", () => this.commit());
  }
  private renderReview() {
    const root = this.el.querySelector<HTMLElement>("[data-preview]")!;
    root.hidden = false;
    const before = PartsListGenerator.generatePartsList(this.baselineProject),
      after = PartsListGenerator.generatePartsList(this.session.project),
      k = (a: (typeof before)[number]) =>
        JSON.stringify([a.manufacturer, a.articleNumber, a.variant]),
      a = new Map(before.map((v) => [k(v), v])),
      b = new Map(after.map((v) => [k(v), v]));
    const changes = [...new Set([...a.keys(), ...b.keys()])].flatMap((id) => {
      const old = a.get(id),
        next = b.get(id);
      return old && next && partQuantityLabel(old) === partQuantityLabel(next)
        ? []
        : [{ old, next }];
    });
    const edits = terminalEditorChanges(this.baseline, this.snapshot);
    root.innerHTML = `<strong>${tr("Vorschau · Noch nicht im Projekt übernommen", "Preview · not yet applied to project")}</strong><p class="te-note">${tr("Prüfen Sie Aufbau, Etagen, Artikel und Brücken in den Ansichten oben. „Übernehmen“ speichert den gesamten Entwurf als einen rückgängig machbaren Schritt.", "Review assembly, levels, parts and bridges in the views above. Apply saves the whole draft as one undoable step.")}</p><table><thead><tr><th>${tr("Geänderte Funktionen", "Changed functions")} (${edits.length})</th><th>${tr("Vorher", "Before")}</th><th>${tr("Nachher", "After")}</th></tr></thead><tbody>${edits
      .slice(0, 80)
      .map(
        (e) =>
          `<tr><td>${esc(e.label)}</td><td>${esc(e.before)}</td><td>${esc(e.after)}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table><table><thead><tr><th>${tr("Geänderte Artikelmengen", "Changed part quantities")}</th><th>${tr("Vorher", "Before")}</th><th>${tr("Nachher", "After")}</th></tr></thead><tbody>${
      changes
        .slice(0, 80)
        .map(
          (v) =>
            `<tr><td>${esc((v.next ?? v.old)!.articleNumber)}</td><td>${v.old ? esc(partQuantityLabel(v.old)) : "—"}</td><td>${v.next ? esc(partQuantityLabel(v.next)) : "—"}</td></tr>`,
        )
        .join("") ||
      `<tr><td colspan="3">${tr("Artikelmengen unverändert", "Part quantities unchanged")}</td></tr>`
    }</tbody></table>`;
    root.scrollIntoView({ block: "nearest" });
  }
  private bind() {
    const on = (selector: string, action: (e: Event) => void) =>
      this.el
        .querySelectorAll<HTMLElement>(selector)
        .forEach((node) => node.addEventListener("click", action));
    const value = (id: string) =>
      this.el.querySelector<HTMLInputElement>(`[data-field="${id}"]`)!.value;
    on(".te-nav [data-create-row]", () => this.beginCreation());
    on(".te-toolbar [data-add-terminals]", () => this.beginCreation(true));
    this.el
      .querySelector("[data-create-panel]")
      ?.addEventListener("input", () => {
        if (this.creation) {
          readTerminalRowForm(this.el, this.creation);
          updateTerminalRowForm(this.el, this.creation);
          this.renderFooter();
        }
      });
    on("[data-close]", () => this.requestClose());
    on("[data-navigate]", () => {
      if (!this.canLeave()) return;
      if (this.session.changed) {
        this.message(
          tr(
            "Bitte den Entwurf zuerst prüfen und übernehmen, bevor Sie zur Zeichnung wechseln.",
            "Review and apply the draft before navigating to the drawing.",
          ),
        );
        return;
      }
      const row = this.row();
      if (row) {
        this.close();
        this.navigate?.(row.address);
      }
    });
    on("[data-reset-fields]", () => {
      this.formDirty = false;
      this.dirtyControls.clear();
      this.error = "";
      this.render();
    });
    on("[data-strip-key]", (e) => {
      if (!this.canLeave()) return;
      this.stripKey = (e.currentTarget as HTMLElement).dataset.stripKey!;
      this.checked.clear();
      this.offset = 0;
      this.selectedAccessory = "";
      this.normaliseSelection();
      this.render();
    });
    on("[data-tab]", (e) => {
      if (!this.canLeave()) return;
      this.tab = (e.currentTarget as HTMLElement).dataset
        .tab as TerminalEditorTab;
      this.render();
    });
    this.el.querySelector(".te-tabs")!.addEventListener("keydown", (e) => {
      const event = e as KeyboardEvent;
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      const buttons = [
          ...this.el.querySelectorAll<HTMLButtonElement>(
            ".te-tabs button:not(:disabled)",
          ),
        ],
        at = buttons.findIndex((b) => b.dataset.tab === this.tab),
        next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? buttons.length - 1
              : (at + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) %
                buttons.length,
        id = buttons[next]?.dataset.tab;
      buttons[next]?.click();
      if (id)
        this.el.querySelector<HTMLButtonElement>(`[data-tab="${id}"]`)?.focus();
    });
    this.el.querySelector("[data-search]")!.addEventListener("input", (e) => {
      this.search = (e.target as HTMLInputElement).value;
      this.offset = 0;
      this.renderRows();
    });
    on("[data-prev]", () => {
      this.offset = Math.max(0, this.offset - 100);
      this.renderRows();
    });
    on("[data-next]", () => {
      this.offset += 100;
      this.renderRows();
    });
    this.el.querySelector("[data-grid]")!.addEventListener("click", (e) => {
      if ((e.target as Element).closest("[data-create-row]")) {
        this.beginCreation();
        return;
      }
      if ((e.target as Element).closest("[data-add-terminals]")) {
        this.beginCreation(true);
        return;
      }
      const check = (e.target as Element).closest<HTMLInputElement>(
        "[data-check]",
      );
      if (check) {
        if (!this.canLeave()) {
          check.checked = !check.checked;
          return;
        }
        const row = this.strip()?.rows.find(
            (r) => r.key === check.dataset.check,
          ),
          related =
            row?.position?.kind === "terminal"
              ? row.position.members.map(key)
              : [check.dataset.check!];
        for (const id of related)
          check.checked ? this.checked.add(id) : this.checked.delete(id);
        this.tab = "device";
        this.render();
        return;
      }
      const node = (e.target as Element).closest<HTMLElement>("[data-address]");
      const row = this.strip()?.rows.find(
        (r) => r.key === node?.dataset.address,
      );
      if (row) this.select(row);
    });
    this.el.querySelector("[data-grid]")!.addEventListener("keydown", (e) => {
      if ((e.target as Element).closest("input,button,select,textarea")) return;
      const event = e as KeyboardEvent,
        node = (e.target as Element).closest<HTMLElement>("[data-address]");
      if (node && ["Enter", " "].includes(event.key)) {
        event.preventDefault();
        const row = this.strip()?.rows.find(
          (r) => r.key === node.dataset.address,
        );
        if (row) this.select(row);
      }
    });
    this.el.querySelector("[data-rail]")!.addEventListener("click", (e) => {
      const node = (e.target as Element).closest<HTMLElement>(
        "[data-rail-position]",
      );
      if (!node || !this.canLeave()) return;
      const id = node.dataset.railPosition,
        row = this.strip()?.rows.find(
          (r) => r.position?.id === id || r.key === id,
        );
      if (row) this.select(row);
      else {
        this.selectedAccessory = id!;
        this.tab = "device";
        this.render();
      }
    });
    on("[data-pick]", (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.pick!,
        row = this.snapshot.strips
          .flatMap((s) => s.rows)
          .find((r) => r.key === id);
      if (row && this.canLeave()) {
        this.stripKey = row.stripKey;
        this.select(row);
      }
    });
    const strip = this.strip(),
      row = this.row();
    on("[data-stage-function]", () => {
      if (!row?.entry.symbol || !this.canStage("[data-stage-function]")) return;
      try {
        const settings = collectTerminalFields(
          this.el,
          row.entry.component,
          row.entry.symbol,
        );
        if (settings)
          this.change((s) =>
            s.wiring(
              { kind: "terminal", target: row.address, settings },
              value("function-text"),
            ),
          );
      } catch (e) {
        this.message(e);
      }
    });
    on("[data-split-levels],[data-split-parts]", (e) => {
      if (!row || !this.canStage("[data-split-levels]")) return;
      const mode = (e.currentTarget as HTMLElement).hasAttribute(
        "data-split-levels",
      )
        ? "levels"
        : "parts";
      this.change((s) =>
        s.distribution({
          kind: "split",
          target: row.address,
          mode,
          mainLevel: (
            this.el.querySelector("[data-split-main]") as HTMLSelectElement
          ).value,
        }),
      );
    });
    on('[data-align-row]',()=>{if(!row||!strip||!this.canLeave())return;if(this.change(s=>s.alignRow(row.address.pageId,strip.identity))){this.review=true;this.renderReview();this.renderFooter();}});
    on("[data-main]", () => {
      if (!row || !strip || !this.canStage("[data-main]")) return;
      const target = addressFromKey(
        (this.el.querySelector("[data-main-target]") as HTMLSelectElement)
          .value,
      );
      this.change((s) =>
        s.transaction((temp) => {
          const { strip: config, pos } = this.position(
            temp,
            row.address,
            strip.identity,
          );
          temp.strip({
            kind: "main",
            stripId: config.id,
            positionId: pos.id,
            target,
          });
        }),
      );
    });
    on("[data-order]", (e) => {
      if (!row || !strip || !this.canLeave()) return;
      this.change((s) =>
        s.transaction((temp) => {
          const { strip: config, pos } = this.position(
              temp,
              row.address,
              strip.identity,
            ),
            at = config.positions.indexOf(pos),
            up = (e.currentTarget as HTMLElement).dataset.order === "up";
          if ((up && at === 0) || (!up && at === config.positions.length - 1))
            return;
          temp.strip({
            kind: "move",
            stripId: config.id,
            positionId: pos.id,
            beforeId: config.positions[at + (up ? -1 : 2)]?.id,
          });
        }),
      );
    });
    on("[data-sort]", () => {
      if (strip && this.canLeave())
        this.change((s) =>
          s.transaction((temp) => {
            const config = this.ensureStrip(temp, strip.identity);
            temp.strip({ kind: "sort", stripId: config.id });
          }),
        );
    });
    on("[data-group]", () => {
      if (!strip || !this.canStage("[data-group]")) return;
      const chosen = strip.rows.filter((r) => this.checked.has(r.key)),
        levels = chosen.map((r) => ({
          target: r.address,
          level: (
            this.el.querySelector(
              `[data-group-level="${CSS.escape(r.key)}"]`,
            ) as HTMLInputElement
          ).value,
        }));
      this.change((s) =>
        s.transaction((temp) => {
          const config = this.ensureStrip(temp, strip.identity),
            positions = config.positions.filter(
              (p) =>
                p.kind === "terminal" &&
                p.members.some((a) => this.checked.has(key(a))),
            );
          temp.strip({
            kind: "group",
            stripId: config.id,
            positionIds: positions.map((p) => p.id),
            levels,
          });
        }),
      );
    });
    on("[data-ungroup]", () => {
      if (strip && row && this.canLeave())
        this.change((s) =>
          s.transaction((temp) => {
            const { strip: config, pos } = this.position(
              temp,
              row.address,
              strip.identity,
            );
            temp.strip({
              kind: "ungroup",
              stripId: config.id,
              positionId: pos.id,
            });
          }),
        );
    });
    on("[data-reset-strip]", () => {
      if (strip?.configuration && this.canLeave())
        this.change((s) =>
          s.strip({ kind: "reset", stripId: strip.configuration!.id }),
        );
    });
    on("[data-move]", () => {
      if (!row || !this.canStage("[data-move]")) return;
      const pageId = (
        this.el.querySelector("[data-target-page]") as HTMLSelectElement
      ).value;
      if (
        this.change((s) =>
          s.distribution({
            kind: "move",
            target: row.address,
            pageId,
            x: Number(value("target-x")),
            y: Number(value("target-y")),
          }),
        )
      ) {
        this.selected = key({ pageId, componentId: row.address.componentId });
        this.normaliseSelection();
        this.render();
      }
    });
    on("[data-stage-bridge]", () => {
      if (!this.canStage("[data-stage-bridge]")) return;
      this.change((s) =>
        s.wiring({
          kind: "bridge",
          from: JSON.parse(
            (this.el.querySelector("[data-bridge-from]") as HTMLSelectElement)
              .value,
          ),
          to: JSON.parse(
            (this.el.querySelector("[data-bridge-to]") as HTMLSelectElement)
              .value,
          ),
          bridgeType: (
            this.el.querySelector("[data-bridge-type]") as HTMLSelectElement
          ).value as "wire" | "plug",
        }),
      );
    });
    on("[data-remove-bridge]", (e) => {
      if (this.canLeave())
        this.change((s) =>
          s.wiring({
            kind: "remove_bridge",
            id: (e.currentTarget as HTMLElement).dataset.removeBridge!,
          }),
        );
    });
    const targets = row
      ? (this.snapshot.index.devices.forComponent(row.address)?.members ?? [
          row.address,
        ])
      : [];
    const items = () =>
      row
        ? effectiveArticles(
            this.snapshot.index.devices.owner(row.address)!.component,
            this.session.project,
          )
        : [];
    const assign = (article: AssignedArticle) =>
      this.change((s) =>
        s.article({
          kind: "assign",
          targets,
          items: [
            ...items().filter(
              (a) => article.role === "accessory" || a.role !== "main",
            ),
            article,
          ],
        }),
      );
    on("[data-catalog],[data-catalog-accessory]", (e) => {
      if (!row || !this.canLeave()) return;
      const accessory = (e.currentTarget as HTMLElement).hasAttribute(
        "data-catalog-accessory",
      );
      new ArticleCatalogDialog(this.session.project, (a) =>
        assign({
          articleNumber: a.articleNumber,
          manufacturer: a.manufacturer,
          variant: a.variant,
          quantity: 1,
          role: accessory ? "accessory" : "main",
          snapshot: structuredClone(a),
        }),
      ).show();
    });
    on("[data-manual-article]", () => {
      if (!this.canStage("[data-manual-article]")) return;
      assign({
        articleNumber: value("article-number"),
        manufacturer: value("article-manufacturer"),
        variant: value("article-variant"),
        quantity: Number(value("article-quantity")),
        role: "main",
      });
    });
    on("[data-remove-article]", (e) => {
      if (this.canLeave())
        this.change((s) =>
          s.article({
            kind: "assign",
            targets,
            items: items().filter(
              (_, i) =>
                i !==
                Number((e.currentTarget as HTMLElement).dataset.removeArticle),
            ),
          }),
        );
    });
    on("[data-stage-quantities]", () => {
      if (!this.canStage("[data-stage-quantities]")) return;
      this.change((s) =>
        s.article({
          kind: "assign",
          targets,
          items: items().map((a, i) => {
            const input = this.el.querySelector<HTMLInputElement>(
              `[data-article-quantity="${i}"]`,
            )!;
            const next = { ...a };
            if (input.value.trim()) next.quantity = Number(input.value);
            else delete next.quantity;
            return next;
          }),
        }),
      );
    });
    on("[data-stage-functions]", () => {
      if (!this.canStage("[data-stage-functions]")) return;
      const choices = [
        ...this.el.querySelectorAll<HTMLSelectElement>(
          "[data-function-choice]",
        ),
      ]
        .filter((input) => input.value)
        .map((input) => ({
          address: addressFromKey(input.dataset.functionChoice!),
          functionId: input.value,
        }));
      this.change((s) =>
        s.functions(
          targets,
          choices,
          (
            this.el.querySelector(
              "[data-confirm-function-type]",
            ) as HTMLInputElement
          ).checked,
          (
            this.el.querySelector(
              "[data-confirm-function-replace]",
            ) as HTMLInputElement
          ).checked,
        ),
      );
    });
    on("[data-accessory-catalog]", () => {
      new ArticleCatalogDialog(this.session.project, (a) => {
        this.accessorySnapshot = structuredClone(a);
        for (const [id, v] of [
          ["accessory-number", a.articleNumber],
          ["accessory-manufacturer", a.manufacturer],
          ["accessory-variant", a.variant],
          ["accessory-description", a.description],
        ])
          (
            this.el.querySelector(`[data-field="${id}"]`) as HTMLInputElement
          ).value = v;
        this.formDirty = true;
        this.dirtyControls.add(
          this.el.querySelector("[data-field=accessory-number]")!,
        );
        this.renderFooter();
      }).show();
    });
    on("[data-stage-accessory]", () => {
      if (strip && this.canStage("[data-stage-accessory]"))
        this.change((s) =>
          s.transaction((temp) => {
            const config = this.ensureStrip(temp, strip.identity);
            temp.strip({
              kind: "accessory",
              stripId: config.id,
              positionId: this.selectedAccessory || undefined,
              description: value("accessory-description"),
              article: {
                articleNumber: value("accessory-number"),
                manufacturer: value("accessory-manufacturer"),
                variant: value("accessory-variant"),
                quantity: Number(value("accessory-quantity")),
                role: "accessory",
                snapshot:
                  this.accessorySnapshot ??
                  (
                    strip.configuration?.positions.find(
                      (p) =>
                        p.id === this.selectedAccessory &&
                        p.kind === "accessory",
                    ) as
                      | import("../model/TerminalStripTypes").TerminalAccessoryPosition
                      | undefined
                  )?.article.snapshot,
              },
            });
          }),
        );
    });
    on("[data-remove-accessory]", () => {
      if (strip?.configuration && this.canLeave())
        this.change((s) =>
          s.strip({
            kind: "remove_accessory",
            stripId: strip.configuration!.id,
            positionId: this.selectedAccessory,
          }),
        );
    });
    this.el.querySelector(".te-details")!.addEventListener("input", (e) => {
      this.dirtyControls.add(e.target as Element);
      this.formDirty = true;
      this.review = false;
      this.el.querySelector<HTMLElement>("[data-preview]")!.hidden = true;
      this.renderFooter();
    });
    on("[data-export]", () => {
      const quote = (v: unknown) => {
        const text = String(v ?? "");
        return (
          '"' +
          (/^[=+@\-\t\r]/.test(text) ? "'" : "") +
          text.replaceAll('"', '""') +
          '"'
        );
      };
      const rows: unknown[][] = [
        [
          "strip",
          "position",
          "terminal",
          "level",
          "role",
          "article",
          "page",
          "internal",
          "external",
        ],
        ...(strip?.rows ?? []).map((r) => [
          strip!.identity.strip,
          r.positionNumber,
          terminalSettings(r.entry.component).number,
          r.levelText,
          r.main ? "main" : "secondary",
          r.article,
          r.entry.page.pageNumber,
          r.reports.map((v) => v.internalTarget).join(" | "),
          r.reports.map((v) => v.externalTarget).join(" | "),
          r.main
            ? effectiveArticles(
                this.snapshot.index.devices.owner(r.address)!.component,
                this.session.project,
              )
                .map((a) => a.quantity ?? "?")
                .join(" | ")
            : "",
          effectiveArticles(
            this.snapshot.index.devices.owner(r.address)!.component,
            this.session.project,
          )
            .map((a) => a.manufacturer)
            .join(" | "),
          effectiveArticles(
            this.snapshot.index.devices.owner(r.address)!.component,
            this.session.project,
          )
            .map((a) => a.variant)
            .join(" | "),
        ]),
      ];
      for (const [i, pos] of (strip?.configuration?.positions ?? []).entries())
        if (pos.kind === "accessory")
          rows.push([
            strip!.identity.strip,
            i + 1,
            "",
            pos.description,
            "accessory",
            pos.article.articleNumber,
            "",
            "",
            "",
            pos.article.quantity ?? "",
            pos.article.manufacturer,
            pos.article.variant,
          ]);
      rows[0].push("quantity", "manufacturer", "variant");
      downloadArticleFile(
        "\uFEFF" + rows.map((r) => r.map(quote).join(";")).join("\r\n"),
        "schematico-terminal-editor.csv",
        "text/csv;charset=utf-8",
      );
    });
  }
}
