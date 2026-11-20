import type { AssignedArticle } from "../model/ArticleTypes";
import type { Project } from "../model/types";
import type { CircuitDimensioning } from "../model/ElectricalDimensioning";
import {
  circuitArticleKey,
  catalogCircuitArticle,
  type CircuitArticleRole,
} from "../model/DimensioningArticles";
import {
  circuitArticleRows,
  filterCircuitArticleRows,
  circuitRoleLabel,
  type CircuitArticleFilters,
  type CircuitArticleAssessment,
} from "../model/CircuitArticleSelection";
import {
  electricalFields,
  validateElectricalData,
  type ElectricalRatingKey,
} from "../model/ArticleElectrical";
import {
  onEditorArticlesChange,
  refreshEditorArticles,
} from "../model/EditorArticles";
import { getSymbolById } from "../model/symbols";
import { escapeSvg as esc } from "../model/ImportedDrawing";
import { tr, getLocalizedSymbol } from "../i18n";
import { bindArticleModalKeys } from "./ArticleModal";
import { ArticleCatalogDialog, articleError } from "./ArticleCatalogDialog";
import "./CircuitArticlePicker.css";
export const circuitRoleIcon = (role: CircuitArticleRole) =>
  `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2">${role === "cable" ? '<path d="M7 14h34M7 24h34M7 34h34M17 8v32"/>' : role === "load" ? '<circle cx="24" cy="25" r="13"/><path d="M24 3v9M24 38v7M18 25h12M24 19v12"/>' : '<path d="M24 3v13m0 16v13M24 16l12 15M19 17h-4v13h4"/>'}</svg>`;
const number = (value: number) => Number(value.toPrecision(6)).toLocaleString();
export function circuitPartSummary(article: AssignedArticle) {
  const raw = article.snapshot?.electrical;
  if (!raw)
    return tr("Noch keine elektrischen Kennwerte", "No electrical ratings yet");
  let d;
  try {
    d = validateElectricalData(raw);
  } catch {
    return tr("Elektrische Kennwerte prüfen", "Check electrical ratings");
  }
  const values = [
    d.characteristic,
    d.protectiveCurrentA !== undefined
      ? `${number(d.protectiveCurrentA)} A`
      : undefined,
    d.poles !== undefined
      ? `${d.poles} ${d.poles === 1 ? tr("Pol", "pole") : tr("Pole", "poles")}`
      : undefined,
    d.sectionMm2 !== undefined ? `${number(d.sectionMm2)} mm²` : undefined,
    d.cores !== undefined ? `${d.cores} ${tr("Adern", "cores")}` : undefined,
    d.currentA !== undefined ? `${number(d.currentA)} A` : undefined,
    d.outputPowerW !== undefined ? `${number(d.outputPowerW)} W` : undefined,
    d.ratedVoltageV !== undefined ? `${number(d.ratedVoltageV)} V` : undefined,
    d.currentType?.replace("ac_dc", "AC / DC").toUpperCase(),
  ];
  return (
    values.filter(Boolean).join(" · ") ||
    tr("Kennwerte unvollständig", "Ratings incomplete")
  );
}
export class CircuitArticlePicker {
  private el = document.createElement("div");
  private articles: AssignedArticle[] = [];
  private filters: CircuitArticleFilters = {};
  private rows: ReturnType<typeof circuitArticleRows> = [];
  private assessed: ReturnType<typeof circuitArticleRows> = [];
  private page = 0;
  private key = "";
  private stop?: () => void;
  private restore = document.activeElement as HTMLElement | null;
  private error = "";
  constructor(
    private config: {
      role: CircuitArticleRole;
      record: CircuitDimensioning;
      getProject: () => Project;
      getItems: () => AssignedArticle[];
      projectKeys: ReadonlySet<string>;
      onChoose: (article: AssignedArticle, adopt: boolean) => void;
      selected?: AssignedArticle;
      assess?: (article:AssignedArticle)=>CircuitArticleAssessment;
      contextLabel?: string;
    },
  ) {
    this.key = config.selected ? circuitArticleKey(config.selected) : "";
  }
  show() {
    if (document.getElementById("circuitArticlePicker")) return;
    this.el.id = "circuitArticlePicker";
    this.el.className = "modal-backdrop circuit-part-picker";
    this.el.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="circuitPartPickerTitle"><header><div class="cpp-title-icon">${circuitRoleIcon(this.config.role)}</div><div><small>${esc(tr("Stromkreis-Assistent · Artikelauswahl", "Circuit assistant · part selection"))}</small><h2 id="circuitPartPickerTitle">${esc(circuitRoleLabel(this.config.role))}</h2></div><button type="button" class="btn" data-cpp-close aria-label="${esc(tr("Schließen", "Close"))}">✕</button></header><div class="cpp-filters"><label class="cpp-search">${esc(tr("Suchen", "Search"))}<input class="form-input" data-cpp-search placeholder="${esc(tr("Hersteller, Artikelnummer, Variante, Beschreibung …", "Manufacturer, part number, variant, description …"))}"></label><label>${esc(tr("Hersteller", "Manufacturer"))}<select class="form-input" data-cpp-manufacturer></select></label><div class="cpp-checks"><label><input type="checkbox" data-cpp-filter="projectOnly">${esc(tr("Im Projekt verwendet", "Used in project"))}</label><label><input type="checkbox" data-cpp-filter="withRatingsOnly">${esc(tr("Mit Kennwerten", "With ratings"))}</label><label><input type="checkbox" data-cpp-filter="includeIncompatible">${esc(tr("Auch abweichende Artikel zeigen", "Include incompatible parts"))}</label></div></div><div class="cpp-content"><div class="cpp-results"><p data-cpp-count role="status" aria-live="polite"></p><div class="cpp-list" data-cpp-list></div><nav aria-label="${esc(tr("Ergebnisseiten", "Result pages"))}"><button type="button" class="btn" data-cpp-prev>←</button><span data-cpp-page></span><button type="button" class="btn" data-cpp-next>→</button></nav></div><aside class="cpp-detail" data-cpp-detail></aside></div><p class="cpp-error" role="alert" data-cpp-error></p><footer><span>${esc(tr("Grunddatenvergleich; Verlegebedingungen und Stromkreisberechnung bleiben zu prüfen.", "Basic data comparison; installation conditions and circuit calculation still require checking."))}</span><button type="button" class="btn" data-cpp-close>${esc(tr("Abbrechen", "Cancel"))}</button><button type="button" class="btn" data-cpp-choose>${esc(tr("Nur Artikel auswählen", "Select part only"))}</button><button type="button" class="btn btn-primary" data-cpp-adopt>${esc(tr("Artikel und Kennwerte übernehmen", "Adopt part and ratings"))}</button></footer></section>`;
    document.body.append(this.el);
    if(this.config.contextLabel)this.el.querySelector('header small')!.textContent=this.config.contextLabel;
    bindArticleModalKeys(this.el, () => this.close());
    this.el
      .querySelectorAll("[data-cpp-close]")
      .forEach((b) => b.addEventListener("click", () => this.close()));
    this.el.querySelector<HTMLInputElement>("[data-cpp-search]")!.oninput = (
      e,
    ) => {
      this.filters.query = (e.target as HTMLInputElement).value;
      this.page = 0;
      this.update();
    };
    this.el.querySelector<HTMLSelectElement>(
      "[data-cpp-manufacturer]",
    )!.onchange = (e) => {
      this.filters.manufacturer =
        (e.target as HTMLSelectElement).value === "*"
          ? undefined
          : (e.target as HTMLSelectElement).value;
      this.page = 0;
      this.update();
    };
    this.el.querySelectorAll<HTMLInputElement>("[data-cpp-filter]").forEach(
      (el) =>
        (el.onchange = () => {
          (this.filters as any)[el.dataset.cppFilter!] = el.checked;
          this.page = 0;
          this.update();
        }),
    );
    this.el.querySelector<HTMLButtonElement>("[data-cpp-prev]")!.onclick =
      () => {
        this.page--;
        this.update();
      };
    this.el.querySelector<HTMLButtonElement>("[data-cpp-next]")!.onclick =
      () => {
        this.page++;
        this.update();
      };
    for (const action of ["choose", "adopt"])
      this.el.querySelector<HTMLButtonElement>(
        "[data-cpp-" + action + "]",
      )!.onclick = () => {
        const row = this.rows.find(
          (r) => circuitArticleKey(r.article) === this.key,
        );
        if (!row || row.assessment.status === "incompatible") return;
        try {
          this.config.onChoose(row.article, action === "adopt");
          this.close();
        } catch (e) {
          this.error = articleError(e);
          this.el.querySelector("[data-cpp-error]")!.textContent = this.error;
        }
      };
    this.stop = onEditorArticlesChange(() => this.refresh());
    this.refresh();
    void refreshEditorArticles().catch(() => {});
    this.el.querySelector<HTMLInputElement>("[data-cpp-search]")!.focus();
  }
  private close() {
    this.stop?.();
    this.el.remove();
    if (this.restore?.isConnected) this.restore.focus();
  }
  private refresh() {
    if (!this.el.isConnected) return;
    this.articles = this.config.getItems();
    if (
      this.config.selected &&
      !this.articles.some(
        (a) =>
          circuitArticleKey(a) === circuitArticleKey(this.config.selected!),
      )
    )
      this.articles.push(this.config.selected);
    const manufacturers = [
      ...new Set(
        this.articles
          .filter(
            (a) =>
              !a.snapshot?.electrical ||
              a.snapshot.electrical.kind ===
                (this.config.role === "upstream"
                  ? "protection"
                  : this.config.role),
          )
          .map((a) => a.manufacturer),
      ),
    ].sort((a, b) => a.localeCompare(b));
    this.el.querySelector<HTMLSelectElement>(
      "[data-cpp-manufacturer]",
    )!.innerHTML =
      `<option value="*">${esc(tr("Alle Hersteller", "All manufacturers"))}</option>` +
      manufacturers
        .map(
          (m) =>
            `<option value="${esc(m)}" ${this.filters.manufacturer === m ? "selected" : ""}>${esc(m || tr("Ohne Hersteller", "No manufacturer"))}</option>`,
        )
        .join("");
    this.assessed = circuitArticleRows(
      this.articles,
      this.config.role,
      this.config.record,
      this.config.projectKeys,
    );
    if(this.config.assess)this.assessed=this.assessed.map(row=>({...row,assessment:this.config.assess!(row.article)})).sort((a,b)=>({ready:0,missing:1,incompatible:2})[a.assessment.status]-({ready:0,missing:1,incompatible:2})[b.assessment.status]||a.article.articleNumber.localeCompare(b.article.articleNumber));
    this.update();
  }
  private update() {
    this.rows = filterCircuitArticleRows(this.assessed, this.filters);
    const pages = Math.max(1, Math.ceil(this.rows.length / 30));
    this.page = Math.max(0, Math.min(this.page, pages - 1));
    const visible = this.rows.slice(this.page * 30, this.page * 30 + 30);
    if (!visible.some((r) => circuitArticleKey(r.article) === this.key))
      this.key = visible[0] ? circuitArticleKey(visible[0].article) : "";
    this.el.querySelector("[data-cpp-count]")!.textContent =
      `${this.rows.length} ${tr("Treffer", "matches")} · ${tr("Artikel ohne Kennwerte bleiben zur manuellen Bearbeitung auswählbar.", "Parts without ratings remain available for manual editing.")}`;
    this.el.querySelector("[data-cpp-list]")!.innerHTML =
      visible
        .map(
          ({ article: a, assessment: s, inProject }) =>
            `<button type="button" class="cpp-row ${this.key === circuitArticleKey(a) ? "is-active" : ""}" data-cpp-key="${esc(circuitArticleKey(a))}" aria-pressed="${this.key === circuitArticleKey(a)}"><span class="cpp-part-identity"><small>${esc(a.manufacturer || tr("Ohne Hersteller", "No manufacturer"))}</small><strong>${esc(a.articleNumber)}</strong>${a.variant ? `<span>${esc(tr("Variante", "Variant"))}: ${esc(a.variant)}</span>` : ""}</span><span class="cpp-description">${esc(a.snapshot?.description || tr("Keine Beschreibung", "No description"))}</span><span class="cpp-rating">${esc(circuitPartSummary(a))}</span><span class="cpp-badges"><span class="cpp-badge ${s.status}">${esc(this.statusLabel(s.status))}</span>${inProject ? `<span class="cpp-badge">${esc(tr("Im Projekt", "In project"))}</span>` : ""}</span></button>`,
        )
        .join("") ||
      `<div class="cpp-empty"><strong>${esc(tr("Keine passenden Treffer", "No matching results"))}</strong><p>${esc(tr("Suchtext oder Filter ändern. Elektrische Kennwerte lassen sich im Artikelkatalog ergänzen.", "Change the search or filters. Add electrical ratings in the parts catalogue."))}</p><button type="button" class="btn" data-cpp-reset>${esc(tr("Filter zurücksetzen", "Reset filters"))}</button></div>`;
    this.el
      .querySelectorAll<HTMLButtonElement>("[data-cpp-key]")
      .forEach((b) => {
        b.onclick = () => {
          this.key = b.dataset.cppKey!;
          this.highlight();
        };
        b.onkeydown = (e) => {
          if (!["ArrowDown", "ArrowUp"].includes(e.key)) return;
          e.preventDefault();
          const buttons = [
              ...this.el.querySelectorAll<HTMLButtonElement>("[data-cpp-key]"),
            ],
            at = buttons.indexOf(b),
            next =
              buttons[
                Math.max(
                  0,
                  Math.min(
                    buttons.length - 1,
                    at + (e.key === "ArrowDown" ? 1 : -1),
                  ),
                )
              ];
          next?.click();
          next?.focus();
        };
      });
    this.el
      .querySelector<HTMLButtonElement>("[data-cpp-reset]")
      ?.addEventListener("click", () => {
        this.filters = {};
        this.el.querySelector<HTMLInputElement>("[data-cpp-search]")!.value =
          "";
        this.el.querySelector<HTMLSelectElement>(
          "[data-cpp-manufacturer]",
        )!.value = "*";
        this.el
          .querySelectorAll<HTMLInputElement>("[data-cpp-filter]")
          .forEach((i) => (i.checked = false));
        this.page = 0;
        this.update();
      });
    this.el.querySelector("[data-cpp-page]")!.textContent =
      `${this.page + 1} / ${pages}`;
    this.el.querySelector<HTMLButtonElement>("[data-cpp-prev]")!.disabled =
      this.page === 0;
    this.el.querySelector<HTMLButtonElement>("[data-cpp-next]")!.disabled =
      this.page === pages - 1;
    this.detail();
  }
  private statusLabel(s: string) {
    return s === "ready"
      ? tr("Grunddaten passen", "Basic data match")
      : s === "missing"
        ? tr("Kennwerte ergänzen", "Add ratings")
        : tr("Abweichende Daten", "Incompatible data");
  }
  private highlight() {
    for (const b of this.el.querySelectorAll<HTMLElement>("[data-cpp-key]")) {
      const active = b.dataset.cppKey === this.key;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    }
    this.detail();
  }
  private detail() {
    const row = this.rows.find(
        (r) => circuitArticleKey(r.article) === this.key,
      ),
      a = row?.article,
      s = row?.assessment,
      d = s?.data;
    const profile = a && s?.data && catalogCircuitArticle(a, this.config.role);
    this.el.querySelector<HTMLButtonElement>("[data-cpp-choose]")!.disabled =
      !a || s?.status === "incompatible";
    this.el.querySelector<HTMLButtonElement>("[data-cpp-adopt]")!.disabled =
      !profile ||
      s?.status === "incompatible" ||
      (this.config.role !== "upstream" &&
        !Object.keys(profile.parameters ?? {}).length);
    this.el.querySelector("[data-cpp-detail]")!.innerHTML = !a
      ? `<p>${esc(tr("Wähle einen Artikel aus der Liste.", "Select a part from the list."))}</p>`
      : `<div class="cpp-detail-icon">${circuitRoleIcon(this.config.role)}</div><small>${esc(a.manufacturer)}</small><h3>${esc(a.articleNumber)}</h3>${a.variant ? `<p>${esc(tr("Variante", "Variant"))}: ${esc(a.variant)}</p>` : ""}<p>${esc(a.snapshot?.description ?? "")}</p><span class="cpp-badge ${s!.status}">${esc(this.statusLabel(s!.status))}</span>${[...s!.conflicts, ...s!.missing].map((m) => `<p class="cpp-notice">${esc(m)}</p>`).join("")}<dl>${
          d
            ? Object.entries(electricalFields)
                .filter(([k]) => d[k as ElectricalRatingKey] !== undefined)
                .map(
                  ([k, f]) =>
                    `<div><dt>${esc(tr(f.de, f.en))}</dt><dd>${number(d[k as ElectricalRatingKey]!)}</dd></div>`,
                )
                .join("")
            : ""
        }</dl>${d ? `<h4>${esc(tr("Quelle und Geltungsbedingungen", "Source and conditions"))}</h4><p>${esc(d.source)}</p><p>${esc(d.conditions ?? "")}</p>` : ""}${d?.curve?.length ? `<p>${esc(tr("Kennlinie", "Curve"))}: ${esc(d.curveKind === "overcurrent" ? tr("Überstrom", "Overcurrent") : d.curveKind === "residual" ? tr("Differenzstrom", "Residual current") : tr("Art nicht festgelegt", "Type not specified"))} · ${d.curve.length} ${esc(tr("Stützpunkte", "points"))}</p>` : ""}<p>${esc(tr("Plansymbol", "Drawing symbol"))}: ${esc(a.snapshot?.symbolId ? (getSymbolById(a.snapshot.symbolId, this.config.getProject()) ? getLocalizedSymbol(getSymbolById(a.snapshot.symbolId, this.config.getProject())!).name : a.snapshot.symbolId) : tr("Nicht zugeordnet", "Not assigned"))}</p><button type="button" class="btn" data-cpp-edit>${esc(tr("Artikel / Kennwerte bearbeiten", "Edit part / ratings"))}</button>`;
    this.el.querySelector("[data-cpp-edit]")?.addEventListener("click", () => {
      if (!a) return;
      const snapshot = a.snapshot ?? {
        id: "",
        manufacturer: a.manufacturer,
        articleNumber: a.articleNumber,
        variant: a.variant,
        description: "",
        origin: "user" as const,
        verification: "unverified" as const,
      };
      new ArticleCatalogDialog(
        this.config.getProject(),
        undefined,
        a.articleNumber,
        snapshot,
      ).show();
    });
  }
}
