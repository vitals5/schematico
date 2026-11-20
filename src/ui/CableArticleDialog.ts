import type { Project } from "../model/types";
import type { AssignedArticle } from "../model/ArticleTypes";
import {
  uniqueCable,
  cablePartData,
  cablePartLabel,
  assessCablePart,
  type CableAddress,
} from "../model/CableArticles";
import { CableArticleEditPlan } from "../model/CableArticleEditPlan";
import {
  dimensioningArticleCandidates,
  circuitArticleKey,
} from "../model/DimensioningArticles";
import { newDimensioning } from "../model/ElectricalDimensioning";
import { editorArticles } from "../model/EditorArticles";
import { PartsListGenerator, partQuantityLabel } from "../reports/PartsList";
import { compareProjectRevisions } from "../model/ProjectRevisions";
import { escapeSvg as esc } from "../model/ImportedDrawing";
import { tr, t } from "../i18n";
import {
  CircuitArticlePicker,
  circuitPartSummary,
} from "./CircuitArticlePicker";
import { bindArticleModalKeys, focusArticleModal } from "./ArticleModal";
import { finishEngineeringDialog } from "./EngineeringDialog";
import "./ProjectEngineering.css";

export class CableArticleDialog {
  private el = document.createElement("div");
  private restore = document.activeElement as HTMLElement | null;
  private source: Project;
  private article?: AssignedArticle;
  private length = "";
  private circuits = new Set<string>();
  private search = "";
  private adoptSpecification = false;
  private adoptCircuitValues = false;
  private confirmFullLength = false;
  private preview?: CableArticleEditPlan;
  private error = "";
  constructor(
    private getProject: () => Project,
    private onApply: (p: Project) => void,
    private address: CableAddress,
  ) {
    this.source = structuredClone(getProject());
    const c = uniqueCable(this.source, address);
    if (!c)
      throw Error(tr("Kabel ist nicht eindeutig.", "Cable is not unique."));
    this.article = c.article && structuredClone(c.article);
    this.length = c.lengthM === undefined ? "" : String(c.lengthM);
    for (const r of this.source.dimensioning ?? [])
      if (
        r.articles?.cable?.cable?.pageId === address.pageId &&
        r.articles.cable.cable.cableId === address.cableId
      )
        this.circuits.add(r.id);
  }
  show() {
    if (document.getElementById("cableArticleDialog")) return;
    this.el.id = "cableArticleDialog";
    this.el.className = "modal-backdrop";
    this.el.style.cssText =
      "position:fixed;inset:0;z-index:4300;display:flex;align-items:center;justify-content:center";
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => this.close());
    this.render();
  }
  private close() {
    this.el.remove();
    if (this.restore?.isConnected) this.restore.focus();
  }
  private invalidate() {
    this.preview = undefined;
    this.el.querySelector("[data-ca-preview]")?.remove();
    const apply = this.el.querySelector<HTMLButtonElement>("[data-ca-apply]");
    if (apply) apply.disabled = true;
  }
  private choose() {
    const items = () =>
      dimensioningArticleCandidates(
        this.source,
        editorArticles().map(({ article }) => ({
          manufacturer: article.manufacturer,
          articleNumber: article.articleNumber,
          variant: article.variant,
          role: "main",
          quantity: 1,
          snapshot: article,
        })),
      );
    new CircuitArticlePicker({
      role: "cable",
      record: newDimensioning("Cable"),
      getProject: this.getProject,
      getItems: items,
      projectKeys: new Set(
        dimensioningArticleCandidates(this.source).map(circuitArticleKey),
      ),
      selected: this.article,
      assess: assessCablePart,
      contextLabel: tr(
        "Kabelverwaltung · Artikelauswahl",
        "Cable management · part selection",
      ),
      onChoose: (article, adopt) => {
        this.article = structuredClone(article);
        this.adoptSpecification = adopt;
        this.preview = undefined;
        this.error = "";
        this.render();
      },
    }).show();
  }
  private prepare() {
    try {
      const raw = this.length.trim();
      if (raw && !/^\d+(?:[.,]\d+)?$/.test(raw))
        throw Error(
          tr(
            "Kabellänge als Zahl in Metern eingeben.",
            "Enter cable length as a number in metres.",
          ),
        );
      this.preview = new CableArticleEditPlan(this.source, this.address, {
        article: this.article,
        lengthM: raw ? Number(raw.replace(",", ".")) : undefined,
        circuitIds: [...this.circuits],
        adoptSpecification: this.adoptSpecification,
        adoptCircuitValues: this.adoptCircuitValues,
        confirmFullLength: this.confirmFullLength,
      });
      this.error = "";
    } catch (e) {
      this.preview = undefined;
      this.error = e instanceof Error ? e.message : String(e);
    }
    this.render();
  }
  private render() {
    const cable = uniqueCable(this.source, this.address)!;
    const rows = (this.source.dimensioning ?? []).filter(
      (r) =>
        !this.search ||
        `${r.name} ${r.id}`
          .toLocaleLowerCase()
          .includes(this.search.toLocaleLowerCase()),
    );
    let data;
    try {
      data = cablePartData(this.article);
    } catch {}
    this.el.innerHTML = `<section role="dialog" aria-modal="true"><h2>${esc(tr("Kabelartikel & Stromkreisbezug", "Cable part & circuit binding"))} · ${esc(cable.bmk)}</h2><div class="pe-workspace"><aside class="pe-sidebar">
      <div class="pe-card"><h3>${esc(tr("Reales Kabel", "Physical cable"))}</h3><p>${esc(cable.cableType || "—")} · ${cable.coreCount ?? "?"} × ${esc(cable.crossSection || "?")} mm²</p><label>${esc(tr("Reale Kabellänge [m]", "Real cable length [m]"))}<input class="form-input" data-ca-length inputmode="decimal" value="${esc(this.length)}" placeholder="${esc(tr("unbekannt", "unknown"))}"></label><small>${esc(tr("Eine Länge pro physischem Kabel. Keine Summe der Adern und keine Länge aus der Zeichnung. Ohne Angabe bleibt die Bestellmenge unbekannt.", "One length per physical cable. Neither a sum of core lengths nor a length inferred from the drawing. Purchasing quantity remains unknown without this value."))}</small></div>
      <div class="pe-card"><h3>${esc(tr("Nennangaben", "Nominal data"))}</h3><label><input type="checkbox" data-ca-spec ${this.adoptSpecification ? "checked" : ""}>${esc(tr("Aderzahl und Querschnitt des Artikels übernehmen", "Adopt the part’s core count and cross-section"))}</label><p>${esc(tr("Vorhandene Adern, Reserven und Zuordnungen werden nicht entfernt oder neu verdrahtet.", "Existing cores, reserves and assignments are neither removed nor rewired."))}</p></div>
      <div class="pe-card"><h3>${esc(tr("Berechnungswerte", "Calculation values"))}</h3><label><input type="checkbox" data-ca-values ${this.adoptCircuitValues ? "checked" : ""}>${esc(tr("Dokumentierte Kabelkennwerte und reale Länge in ausgewählte Berechnungen übernehmen", "Adopt documented cable ratings and real length into selected calculations"))}</label><label><input type="checkbox" data-ca-full ${this.confirmFullLength ? "checked" : ""}>${esc(tr("Kabellänge entspricht der vollständigen Leitungslänge jedes ausgewählten Stromkreises", "Cable length equals the full conductor length of each selected circuit"))}</label></div>
      </aside><main class="pe-main"><div class="pe-card"><div class="pe-card-heading"><div><h3>${esc(cablePartLabel(this.article))}</h3><p>${esc(this.article?.snapshot?.description ?? tr("Noch kein Artikel zugeordnet", "No part assigned yet"))}</p></div><button class="btn btn-primary" data-ca-pick>${esc(tr("Kabelartikel auswählen", "Select cable part"))}</button></div><p>${esc(this.article ? circuitPartSummary(this.article) : "")}</p>${data ? `<p>${esc(data.source)}${data.conditions ? " · " + esc(data.conditions) : ""}</p>` : ""}<button class="btn" data-ca-remove ${!this.article ? "disabled" : ""}>${esc(tr("Artikelzuordnung entfernen", "Remove part assignment"))}</button></div>
      <div class="pe-card"><h3>${esc(tr("Verknüpfte Stromkreise", "Linked circuits"))}</h3><p>${esc(tr("Nur ausdrücklich ausgewählte Berechnungen erhalten den Kabelbezug. Abgewählte bisherige Bezüge werden gelöst; gespeicherte Rechenwerte bleiben erhalten.", "Only explicitly selected calculations receive the cable binding. Deselected previous bindings are detached; saved calculation values are preserved."))}</p><input class="form-input" data-ca-search value="${esc(this.search)}" aria-label="${esc(tr("Stromkreis suchen", "Search circuits"))}" placeholder="${esc(tr("Stromkreis suchen", "Search circuits"))}"><div style="max-height:230px;overflow:auto">${
        rows
          .slice(0, 100)
          .map((r) => {
            const old = r.articles?.cable;
            return `<label style="display:flex;flex-direction:row;align-items:start"><input type="checkbox" data-ca-circuit="${esc(r.id)}" ${this.circuits.has(r.id) ? "checked" : ""}><span><strong>${esc(r.name)}</strong><br><small>${esc(cablePartLabel(old?.article))}${old?.device ? " · " + esc(tr("bisher Gerätebezug", "currently bound to device")) : old?.cable ? " · " + esc(old.cable.cableId) : ""}</small></span></label>`;
          })
          .join("") ||
        `<p>${esc(tr("Zuerst unter Auswerten → Elektrische Dimensionierung einen Stromkreis anlegen.", "First create a circuit under Reports → Electrical dimensioning."))}</p>`
      }</div>${rows.length > 100 ? `<p>${esc(tr("100 Treffer angezeigt; Suche eingrenzen.", "100 matches displayed; narrow the search."))}</p>` : ""}</div>${this.preview ? this.previewMarkup() : ""}</main></div><p class="pe-error" role="alert">${esc(this.error)}</p><footer class="pe-actions"><span>${esc(tr("Übernahme als ein Rückgängig-Schritt", "Adoption as one undoable step"))}</span><button class="btn" data-ca-close>${esc(tr("Abbrechen", "Cancel"))}</button><button class="btn" data-ca-preview-button>${esc(tr("Änderungen vorschauen", "Preview changes"))}</button><button class="btn btn-primary" data-ca-apply ${!this.preview ? "disabled" : ""}>${esc(tr("Angezeigte Änderungen übernehmen", "Apply displayed changes"))}</button></footer></section>`;
    const q = <T extends HTMLElement = HTMLElement>(s: string) =>
      this.el.querySelector<T>(s)!;
    q("[data-ca-close]").onclick = () => this.close();
    q("[data-ca-pick]").onclick = () => this.choose();
    q("[data-ca-remove]").onclick = () => {
      this.article = undefined;
      this.adoptSpecification = false;
      this.adoptCircuitValues = false;
      this.circuits.clear();
      this.preview = undefined;
      this.error = "";
      this.render();
    };
    q<HTMLInputElement>("[data-ca-length]").oninput = (e) => {
      this.length = (e.target as HTMLInputElement).value;
      this.invalidate();
    };
    q<HTMLInputElement>("[data-ca-search]").onchange = (e) => {
      this.search = (e.target as HTMLInputElement).value;
      this.render();
    };
    for (const [attr, key] of [
      ["spec", "adoptSpecification"],
      ["values", "adoptCircuitValues"],
      ["full", "confirmFullLength"],
    ] as const)
      q<HTMLInputElement>("[data-ca-" + attr + "]").onchange = (e) => {
        this[key] = (e.target as HTMLInputElement).checked;
        this.invalidate();
      };
    this.el.querySelectorAll<HTMLInputElement>("[data-ca-circuit]").forEach(
      (b) =>
        (b.onchange = () => {
          b.checked
            ? this.circuits.add(b.dataset.caCircuit!)
            : this.circuits.delete(b.dataset.caCircuit!);
          this.invalidate();
        }),
    );
    q("[data-ca-preview-button]").onclick = () => this.prepare();
    q("[data-ca-apply]").onclick = () => {
      try {
        this.onApply(this.preview!.apply(this.getProject()));
        this.close();
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e);
        this.preview = undefined;
        this.render();
      }
    };
    finishEngineeringDialog(this.el, {
      kind: "wiring",
      description: tr(
        "Ein Kabelartikel, nachvollziehbare Meterware und eindeutige Berechnungsbezüge",
        "One cable part, traceable purchasing length and explicit calculation bindings",
      ),
      wide: true,
    });
    focusArticleModal(this.el);
  }
  private previewMarkup() {
    const plan = this.preview!,
      next = plan.apply(this.source);
    const bom = PartsListGenerator.generatePartsList(next).filter(
      (p) => p.unit === "m",
    );
    const diff = compareProjectRevisions(this.source, next);
    return `<div class="pe-card" data-ca-preview><h3>${esc(tr("Konkrete Änderungsvorschau", "Exact change preview"))}</h3><p>${esc(cablePartLabel(plan.before.article))} → ${esc(cablePartLabel(plan.after.article))}</p><p>${esc(tr("Reale Länge", "Real length"))}: ${plan.before.lengthM ?? "?"} m → ${plan.after.lengthM ?? "?"} m · ${plan.before.coreCount ?? "?"} × ${esc(plan.before.crossSection)} → ${plan.after.coreCount ?? "?"} × ${esc(plan.after.crossSection)}</p><h4>${esc(tr("Meterware in der Stückliste", "Cable lengths in the parts list"))}</h4>${bom.map((p) => `<p>${esc(p.manufacturer + " · " + p.articleNumber + (p.variant ? " [" + p.variant + "]" : ""))}: <strong>${esc(partQuantityLabel(p))}</strong> · ${esc(p.bmkList.join(", "))}</p>`).join("") || "—"}<ul>${plan.findings.map((i) => `<li>${esc(t(i.code))} ${esc(i.details ?? "")}</li>`).join("")}</ul>${plan.calculations
      .map(
        (c) =>
          `<h4>${esc(c.after.name)} · ${esc(c.result.status === "checked" ? tr("Berechnet", "Calculated") : c.result.status === "failed" ? tr("Grenzwert verletzt", "Limit exceeded") : tr("Angaben fehlen", "Incomplete"))}</h4><p>${esc(c.before.articles?.cable?.cable?.cableId ?? "—")} → ${esc(c.after.articles?.cable?.cable?.cableId ?? "—")} · ${c.before.lengthM ?? "?"} m → ${c.after.lengthM ?? "?"} m</p><ul>${c.result.checks
            .filter((ch) => ch.status === "missing" || ch.status === "fail")
            .map((ch) => `<li>${esc(ch.label)}: ${esc(ch.message)}</li>`)
            .join("")}</ul>`,
      )
      .join(
        "",
      )}<details><summary>${esc(tr("Alle geänderten Felder anzeigen", "Show all changed fields"))}</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(JSON.stringify(diff.changes, null, 2))}</pre></details></div>`;
  }
}
