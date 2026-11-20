import { protectionCoordination } from "../model/ProtectionCoordination";
import {
  CircuitArticlePicker,
  circuitRoleIcon,
  circuitPartSummary,
} from "./CircuitArticlePicker";
import {
  assessCircuitArticle,
  circuitRoleLabel,
  selectCircuitArticle,
} from "../model/CircuitArticleSelection";
import { ArticleCatalogDialog } from "./ArticleCatalogDialog";
import { compareCircuitArticles } from "../model/CircuitDesign";
import { circuitSchematicDraft } from "../model/CircuitSchematic";
import { previewLayout, applyLayout } from "../layout/service";
import { preferDraftAutoconnect } from "../layout/autoconnectDraft";
import { LayoutPreviewDialog } from "../layout/PreviewDialog";
import { effectiveArticles } from "../model/ArticleAssignments";
import { editorArticles } from "../model/EditorArticles";
import {
  dimensioningArticleCandidates,
  circuitArticleKey,
  captureCircuitArticle,
  adoptCircuitArticle,
  type CircuitArticleRole,
} from "../model/DimensioningArticles";
import type { AssignedArticle, ComponentAddress } from "../model/ArticleTypes";
import type { Project } from "../model/types";
import { projectRevision } from "../layout/types";
import {
  calculateDimensioning,
  newDimensioning,
  withDimensioning,
  dimensioningReferenceKey,
  dimensioningNumbers,
  dimensioningNumber as num,
  type CircuitDimensioning,
  type DimensioningReference,
  type NumericDimensioningKey,
} from "../model/ElectricalDimensioning";
import {
  dimensioningReportRows,
  dimensioningColumns,
  dimensioningStatus,
  engineeringReportCsv,
  engineeringPdfRows,
} from "../reports/EngineeringCalculations";
import { engineeringTablePdf } from "../export/EngineeringTablePdf";
import { escapeSvg as esc } from "../model/ImportedDrawing";
import { bindArticleModalKeys, focusArticleModal } from "./ArticleModal";
import { finishEngineeringDialog } from "./EngineeringDialog";
import { downloadArticleFile } from "./ArticleCatalogDialog";
import "./ProjectEngineering.css";
import { tr } from "../i18n";

export class ElectricalDimensioningDialog {
  private el = document.createElement("div");
  private source: Project;
  private baseline: string;
  private edit: CircuitDimensioning;
  private dirty = false;
  private error = "";
  private query = "";
  private confirmDelete = false;
  private selectedArticlesOnly = true;
  private wizardOpen = false;
  private designFilters: { cable?: string; protection?: string } = {};
  private comparisons?: ReturnType<typeof compareCircuitArticles>;
  private wizardBusy = false;
  private wizardAbort?: AbortController;
  private loadSymbol = "socket_schuko";
  constructor(
    private getProject: () => Project,
    private onApply: (p: Project) => void,
    initial?: CircuitDimensioning,
    private navigate?: (reference: DimensioningReference) => void,
    private manageArticle?: (address: ComponentAddress) => void,
  ) {
    this.source = structuredClone(getProject());
    this.baseline = projectRevision(this.source);
    const records = this.records();
    const linked = initial?.reference
      ? records.filter(
          (r) =>
            dimensioningReferenceKey(r.reference) ===
            dimensioningReferenceKey(initial.reference),
        )
      : [];
    this.edit = structuredClone(
      initial
        ? (records.find((r) => r.id === initial.id) ??
            (linked.length === 1 ? linked[0] : undefined) ??
            initial)
        : (records[0] ?? newDimensioning()),
    );
    if (linked.length > 1 && !records.some((r) => r.id === initial?.id))
      this.error = tr(
        "Mehrere Stromkreise besitzen diesen Planbezug. Gewünschte Berechnung links auswählen.",
        "Multiple circuits share this drawing reference. Select the desired calculation on the left.",
      );
    this.dirty = !!initial && !records.some((r) => r.id === this.edit.id);
    if (this.edit.system === "ac3") this.loadSymbol = "motor_3phase";
  }
  show() {
    if (document.getElementById("electricalDimensioningDialog")) return;
    this.el.id = "electricalDimensioningDialog";
    this.el.className = "modal-backdrop";
    this.el.style.cssText =
      "position:fixed;inset:0;z-index:4200;display:flex;align-items:center;justify-content:center";
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => this.close());
    this.render();
  }
  private close() {
    if (
      !this.dirty ||
      confirm(
        tr(
          "Nicht übernommene Berechnungseingaben verwerfen?",
          "Discard unsaved calculation inputs?",
        ),
      )
    ) {
      this.wizardAbort?.abort();
      this.el.remove();
    }
  }
  private stale() {
    if (projectRevision(this.getProject()) !== this.baseline)
      throw Error(
        tr(
          "Projekt wurde verändert. Bitte aktualisieren und offene Eingaben verwerfen.",
          "Project was modified. Please refresh and discard pending inputs.",
        ),
      );
  }
  private records() {
    const raw = this.source.dimensioning;
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) {
      this.error = tr(
        "Ungültiger Dimensionierungsbestand. Projektdatei prüfen.",
        "Invalid dimensioning records. Check project file.",
      );
      return [];
    }
    const records = raw.filter(
      (r) => r && typeof r.id === "string" && typeof r.name === "string",
    );
    if (records.length !== raw.length)
      this.error = tr(
        "Fehlerhafte Berechnungsdatensätze können nicht bearbeitet werden. Der gemeinsame Prüfbericht benennt die ungültigen Eingaben.",
        "Corrupted calculation records cannot be edited. The shared inspection report lists invalid entries.",
      );
    return records;
  }
  private field(key: NumericDimensioningKey) {
    const spec = dimensioningNumbers[key]!;
    return `<label>${esc(spec.label)}<input class="form-input" type="number" step="any" min="${spec.min}" ${spec.max !== undefined ? `max="${spec.max}"` : ""} data-number="${key}" value="${esc(String(this.edit[key] ?? ""))}" placeholder="${esc(tr("nicht erfasst", "not recorded"))}"></label>`;
  }
  private textField(key: keyof CircuitDimensioning, label: string) {
    return `<label>${esc(label)}<textarea class="form-input" data-text="${key}" maxlength="2000" placeholder="${esc(tr("z. B. Datenblatt, Tabelle, Verlegeart, belastete Adern, Temperatur …", "e.g. datasheet, table, installation method, loaded cores, temperature …"))}">${esc(String(this.edit[key] ?? ""))}</textarea></label>`;
  }
  private fields(keys: NumericDimensioningKey[]) {
    return `<div class="pe-fields">${keys.map((k) => this.field(k)).join("")}</div>`;
  }
  private optional(
    flag: keyof CircuitDimensioning,
    title: string,
    content: string,
  ) {
    return `<details class="pe-card" ${this.edit[flag] ? "open" : ""}><summary>${esc(title)}</summary><label class="pe-check"><input type="checkbox" data-flag="${flag}" ${this.edit[flag] ? "checked" : ""}>${esc(tr("Diesen Bereich prüfen", "Verify this section"))}</label>${content}</details>`;
  }
  private render() {
    const records = this.records();
    const matching = records.filter((r) =>
      r.name?.toLocaleLowerCase().includes(this.query.toLocaleLowerCase()),
    );
    const select = (
      key: keyof CircuitDimensioning,
      label: string,
      values: string[][],
    ) =>
      `<label>${esc(label)}<select class="form-input" data-select="${key}">${values.map(([v, l]) => `<option value="${v}" ${this.edit[key] === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
    this.el.innerHTML = `<section role="dialog" aria-modal="true"><h2>${esc(tr("Elektrische Dimensionierung", "Electrical Dimensioning"))}</h2><div class="pe-workspace"><aside class="pe-sidebar"><div class="pe-summary"><strong>${records.length}</strong> ${esc(tr("Stromkreise", "Circuits"))}<span>${esc(tr("Gespeicherte Eingaben · neu berechnete Ergebnisse", "Saved inputs · recalculated results"))}</span></div><div class="pe-actions"><button class="btn btn-primary" data-new>${esc(tr("+ Stromkreis", "+ Circuit"))}</button><button class="btn" data-wizard-open>${esc(tr("Stromkreis-Assistent", "Circuit assistant"))}</button><button type="button" class="btn" data-protection-open>${esc(tr("Schutzkoordination", "Protection coordination"))}</button><button class="btn" data-reload>${esc(tr("Aktualisieren", "Refresh"))}</button></div><input class="form-input" data-search aria-label="${esc(tr("Stromkreise suchen", "Search circuits"))}" placeholder="${esc(tr("Stromkreis suchen", "Search circuit"))}" value="${esc(this.query)}"><div class="pe-circuit-list">${
      matching
        .map((r) => {
          const status = calculateDimensioning(r, this.source).status;
          return `<button class="pe-revision ${r.id === this.edit.id ? "is-active" : ""}" data-circuit="${esc(r.id)}"><strong>${esc(r.name)}</strong><span class="pe-status ${status === "checked" ? "pass" : status === "failed" ? "fail" : "missing"}">${esc({ checked: tr("Beauftragte Prüfungen erfüllt", "Selected checks passed"), failed: tr("Grenzwert verletzt", "Limit exceeded"), incomplete: tr("Angaben fehlen", "Inputs incomplete") }[status])}</span></button>`;
        })
        .join("") ||
      `<p>${esc(tr("Keine gespeicherten Stromkreise.", "No saved circuits."))}</p>`
    }</div><div class="pe-card"><h3>${esc(tr("Berechnungsumfang", "Calculation Scope"))}</h3><p>${esc(tr("Stromkreise werden ausdrücklich erfasst. Reale Leitungslängen werden nicht aus Zeichnungsabständen berechnet.", "Circuits are recorded explicitly. Real cable lengths are not derived from drawing distances."))}</p><p>${esc(tr("Schutzprüfungen verwenden dokumentierte Eingaben und die angezeigten Formeln. Nicht beauftragte Bereiche bleiben als solche ausgewiesen.", "Protection checks use documented inputs and the shown formulas. Unselected sections remain marked accordingly."))}</p></div></aside>
      <main class="pe-main pe-dimensioning"><form data-dimensioning-form>${this.wizardOpen ? "" : this.articlePanel()}<div class="pe-card"><label>${esc(tr("Stromkreisname", "Circuit Name"))}<input class="form-input" data-text="name" maxlength="160" required value="${esc(this.edit.name)}"></label><div class="pe-fields">${select(
        "system",
        tr("System", "System"),
        [
          ["dc", tr("Gleichstrom (2 Leiter)", "DC (2 Conductors)")],
          ["ac1", tr("Wechselstrom (L + N)", "Single-Phase AC (L + N)")],
          ["ac3", tr("Drehstrom (symmetrisch)", "Three-Phase AC (balanced)")],
        ],
      )}${select("material", tr("Leitermaterial", "Conductor Material"), [
        ["copper", tr("Kupfer", "Copper")],
        ["aluminium", tr("Aluminium", "Aluminum")],
      ])}${select("loadMode", tr("Lastangabe", "Load Specification"), [
        ["current", tr("Betriebsstrom", "Operating Current")],
        [
          "power",
          tr(
            "Abgegebene Wirkleistung + Wirkungsgrad",
            "Output Active Power + Efficiency",
          ),
        ],
      ])}</div>${this.edit.reference ? `<div class="pe-reference">${esc(tr("Planbezug:", "Drawing ref:"))} ${esc(this.edit.reference.wireId)}${this.edit.reference.pageId ? " · " + esc(this.source.pages.find((p) => p.id === this.edit.reference!.pageId)?.pageNumber ?? "?") : ` · ${esc(tr("logisch", "logical"))}`}<button type="button" class="btn" data-jump>${esc(tr("Im Plan ansehen", "View in Drawing"))}</button><button type="button" class="btn" data-detach>${esc(tr("Bezug entfernen", "Remove Reference"))}</button><p>${esc(tr("Die Bezugslinie ist keine automatisch erkannte vollständige Stromkreisstrecke. Eingaben beziehen sich auf den gesamten hier beschriebenen Stromkreis.", "The referenced line is not an automatically detected full circuit route. Inputs apply to the entire circuit described here."))}</p><button type="button" class="btn" data-copy-length>${esc(tr("Gespeicherte reale Länge / Querschnitt ausdrücklich übernehmen", "Explicitly copy saved real length / cross-section"))}</button></div>` : ""}</div>
      <details open class="pe-card"><summary>${esc(tr("1 · Last, Leitung und Spannungsfall", "1 · Load, Cable & Voltage Drop"))}</summary>${this.fields(["voltageV", ...(this.edit.loadMode === "power" ? (["outputPowerW", "efficiency"] as const) : (["currentA"] as const)), "lengthM", "sectionMm2", "temperatureC", "resistance20OhmKm", ...(this.edit.system === "dc" ? [] : (["cosPhi", "reactanceOhmKm"] as const)), "maxDropPercent"])}${
        this.edit.system !== "dc"
          ? select("powerFactorKind", tr("Lastcharakter", "Load Character"), [
              ["lagging", tr("Induktiv / nacheilend", "Inductive / lagging")],
              ["leading", tr("Kapazitiv / voreilend", "Capacitive / leading")],
            ])
          : ""
      }${this.textField("inputSource", tr("Quelle / Beschreibung der Leitungs- und Lastdaten", "Source / Description of Cable & Load Data"))}<p>${esc(tr("Ohne R20-Eingabe: Planungswert ρ20 Cu 0,0175 bzw. Al 0,0282 Ω·mm²/m. Für einen Datenblattnachweis R20 ausdrücklich erfassen.", "Without R20 input: planning value ρ20 Cu 0.0175 or Al 0.0282 Ω·mm²/m. Enter R20 explicitly for datasheet verification."))}</p></details>
      ${this.wizardPanel()}
      ${this.optional("verifyAmpacity", tr("2 · Strombelastbarkeit und Überlastschutz", "2 · Current-Carrying Capacity & Overload Protection"), this.fields(["ampacityA", "temperatureFactor", "groupingFactor", "otherFactor", "protectiveCurrentA", "conventionalTripA"]) + this.textField("ampacitySource", tr("Quelle Iz0 / Verlegebedingungen", "Source Iz0 / Installation Conditions")) + this.textField("protectionSource", tr("Quelle der Schutzgerätekennwerte", "Source of Protective Device Ratings")))}
      ${this.optional(
        "verifyFault",
        tr(
          "3 · Fehlerstrom, Abschaltbedingung und Ausschaltvermögen",
          "3 · Fault Current, Disconnection & Breaking Capacity",
        ),
        select(
          "faultMode",
          tr("Fehlerstromverfahren", "Fault Current Method"),
          [
            [
              "direct",
              tr(
                "Vorhandene Netzberechnung / Messung",
                "Existing Network Calculation / Measurement",
              ),
            ],
            [
              "loop",
              tr(
                "Einpoliger Fehler aus vollständiger Fehlerschleife",
                "Single-Phase Fault from Complete Fault Loop",
              ),
            ],
          ],
        ) +
          this.fields(
            this.edit.faultMode === "loop"
              ? [
                  "phaseEarthVoltageV",
                  "loopMaxOhm",
                  "loopMinOhm",
                  "voltageFactorMin",
                  "voltageFactorMax",
                  "faultMaxA",
                ]
              : ["faultMinA", "faultMaxA"],
          ) +
          this.textField(
            "faultSource",
            tr(
              "Quelle der Fehlerstrom-/Schleifenangaben",
              "Source of Fault Current / Loop Data",
            ),
          ) +
          (this.edit.faultMode === "loop"
            ? this.textField(
                "faultMaximumSource",
                tr(
                  "Gesonderter Beleg Ik,max: maximaler Netzkurzschlussstrom über alle relevanten Fehlerfälle",
                  "Separate Ik,max proof: maximum short-circuit current across all relevant fault cases",
                ),
              )
            : "") +
          this.fields([
            "tripThresholdA",
            "requiredDisconnectS",
            "thresholdTimeS",
            "breakingCapacityA",
          ]) +
          `<p>${esc(tr("Ia und t(Ia) müssen zur relevanten Kennlinie, Spannung, Stromart und Abschaltbedingung passen. Schutzgerätequelle im Bereich 2 erfassen. Das Schleifenverfahren berechnet keinen dreipoligen Netzkurzschluss.", "Ia and t(Ia) must match the relevant trip curve, voltage, current type, and disconnection condition. Record protective device source in section 2. The loop method does not compute three-phase short circuits."))}</p>`,
      )}
      ${this.optional("verifyAdiabatic", tr("4 · Thermischer Kurzschlussschutz", "4 · Thermal Short-Circuit Protection"), this.fields(["adiabaticK", "letThroughA2s", "energyTimeS"]) + this.textField("energySource", tr("Nachweis von k und I²t für den relevanten Fehlerstrombereich", "Proof of k and I²t for the relevant fault current range")) + `<p>${esc(tr("Adiabatischer Vergleich für die ausdrücklich erfasste Kurzzeitbeanspruchung bis 5 s; keine Kabeltemperatur- oder Wärmeabfuhrsimulation.", "Adiabatic comparison for explicitly recorded short-time stress up to 5 s; no cable thermal or heat dissipation simulation."))}</p>`)}
      ${this.optional("verifySelectivity", tr("5 · Selektivität mit Herstellerbeleg", "5 · Selectivity with Manufacturer Proof"), this.textField("upstreamDevice", tr("Vorgeschaltetes Gerät / genauer Artikel", "Upstream Device / Exact Article")) + this.textField("downstreamDevice", tr("Nachgeschaltetes Gerät / genauer Artikel", "Downstream Device / Exact Article")) + this.fields(["selectivityLimitA"]) + this.textField("selectivitySource", tr("Herstellerbeleg: konkrete Paarung, Betriebsspannung und Selektivitätsgrenze", "Manufacturer Proof: specific pairing, operating voltage, and selectivity limit")) + `<p>${esc(tr("Für diesen Vergleich die Fehlerstromdaten im Bereich 3 erfassen. Es wird kein Selektivitätsnachweis aus Bemessungsstromverhältnissen abgeleitet.", "Record fault current data in section 3 for this comparison. Selectivity is not inferred from rated current ratios."))}</p>`)}
      <div class="pe-actions pe-sticky"><button class="btn btn-primary" data-apply>${esc(tr("Eingaben übernehmen", "Apply Inputs"))}</button><button type="button" class="btn" data-copy>${esc(tr("Als neuen Stromkreis kopieren", "Copy as New Circuit"))}</button><button type="button" class="btn" data-delete ${records.some((r) => r.id === this.edit.id) ? "" : "disabled"}>${esc(this.confirmDelete ? tr("Löschen bestätigen", "Confirm Delete") : tr("Stromkreis löschen", "Delete Circuit"))}</button><span data-dirty>${esc(this.dirty ? tr("Nicht übernommene Eingaben", "Unsaved inputs") : tr("Gespeicherter Stand", "Saved state"))}</span></div></form></main>
      <aside class="pe-results" data-results>${this.renderResults()}</aside></div><p class="pe-error" role="alert">${esc(this.error)}</p><footer><span>${esc(tr("Berechnung nach erfassten Eingaben; Prüfbereiche und Grundlagen sind im Bericht enthalten.", "Calculation based on recorded inputs; checked sections and basis are included in the report."))}</span><button class="btn" data-json>${esc(tr("Prüfbericht JSON", "Report JSON"))}</button><button class="btn" data-pdf>PDF</button><button class="btn" data-csv>CSV</button><button class="btn" data-close>${esc(tr("Schließen", "Close"))}</button></footer></section>`;
    const q = <T extends HTMLElement = HTMLElement>(s: string) =>
      this.el.querySelector<T>(s)!;
    const safe = (fn: () => void) => {
      try {
        fn();
        this.error = "";
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e);
      }
      q("[role=alert]").textContent = this.error;
    };
    q("[data-close]").onclick = () => this.close();
    const discard = () =>
      !this.dirty ||
      confirm(
        tr(
          "Nicht übernommene Berechnungseingaben verwerfen?",
          "Discard unsaved calculation inputs?",
        ),
      );
    q("[data-new]").onclick = () => {
      if (discard()) {
        this.edit = newDimensioning();
        this.dirty = true;
        this.confirmDelete = false;
        this.comparisons = undefined;
        this.render();
      }
    };
    q("[data-reload]").onclick = () => {
      if (discard()) {
        this.source = structuredClone(this.getProject());
        this.baseline = projectRevision(this.source);
        this.edit = structuredClone(
          this.source.dimensioning?.find((r) => r.id === this.edit.id) ??
            newDimensioning(),
        );
        this.dirty = false;
        this.error = "";
        this.render();
      }
    };
    q<HTMLInputElement>("[data-search]").onchange = (e) => {
      this.query = (e.target as HTMLInputElement).value;
      this.render();
    };
    this.el.querySelectorAll<HTMLButtonElement>("[data-circuit]").forEach(
      (b) =>
        (b.onclick = () => {
          if (discard()) {
            this.edit = structuredClone(
              records.find((r) => r.id === b.dataset.circuit)!,
            );
            this.dirty = false;
            this.confirmDelete = false;
            this.error = "";
            this.render();
          }
        }),
    );
    q<HTMLFormElement>("[data-dimensioning-form]").oninput = (event) => {
      if (
        (event.target as Element).matches(
          "[data-design-template],[data-design-filter],[data-design-selected]",
        )
      )
        return;
      this.collect();
      this.comparisons = undefined;
      this.el.querySelector("[data-design-comparisons]")?.replaceChildren();
      this.dirty = true;
      this.confirmDelete = false;
      q("[data-dirty]").textContent = tr(
        "Nicht übernommene Eingaben",
        "Unsaved inputs",
      );
      q("[data-results]").innerHTML = this.renderResults();
    };
    this.bindArticles(safe);
    this.el.querySelectorAll("[data-protection-open]").forEach((b) =>
      b.addEventListener("click", () => {
        void this.openProtectionCoordination();
      }),
    );
    this.bindWizard(safe);
    this.el.querySelectorAll<HTMLSelectElement>("[data-select]").forEach(
      (s) =>
        (s.onchange = () => {
          this.collect();
          if (s.dataset.select === "system")
            this.loadSymbol =
              this.edit.system === "ac3" ? "motor_3phase" : "socket_schuko";
          this.dirty = true;
          this.comparisons = undefined;
          this.render();
        }),
    );
    q<HTMLFormElement>("[data-dimensioning-form]").onsubmit = (e) => {
      e.preventDefault();
      safe(() => {
        this.stale();
        this.collect();
        this.onApply(withDimensioning(this.getProject(), this.edit));
        this.source = structuredClone(this.getProject());
        this.baseline = projectRevision(this.source);
        this.dirty = false;
        this.render();
      });
    };
    q("[data-copy]").onclick = () => {
      this.collect();
      this.edit = {
        ...structuredClone(this.edit),
        id: crypto.randomUUID(),
        name: this.edit.name.slice(0, 150) + " Kopie",
      };
      this.dirty = true;
      this.render();
    };
    q("[data-delete]").onclick = () =>
      safe(() => {
        if (!this.confirmDelete) {
          this.confirmDelete = true;
          this.render();
          return;
        }
        this.stale();
        this.onApply({
          ...this.getProject(),
          dimensioning: this.source.dimensioning!.filter(
            (r) => r.id !== this.edit.id,
          ),
        });
        this.source = structuredClone(this.getProject());
        this.baseline = projectRevision(this.source);
        this.edit = structuredClone(
          this.source.dimensioning?.[0] ?? newDimensioning(),
        );
        this.dirty = false;
        this.confirmDelete = false;
        this.comparisons = undefined;
        this.render();
      });
    q("[data-detach]")?.addEventListener("click", () => {
      delete this.edit.reference;
      this.dirty = true;
      this.render();
    });
    q("[data-jump]")?.addEventListener("click", () => {
      if (this.edit.reference && discard()) {
        this.navigate?.(this.edit.reference);
        this.el.remove();
      }
    });
    q("[data-copy-length]")?.addEventListener("click", () =>
      safe(() => {
        this.stale();
        const ref = this.edit.reference!,
          pages = this.source.pages.filter((p) => p.id === ref.pageId),
          matches = (
            ref.logical
              ? (this.source.logicalConnections ?? [])
              : pages.length === 1
                ? pages[0].wires
                : []
          ).filter((w) => w.id === ref.wireId);
        if (
          matches.length !== 1 ||
          JSON.stringify(matches[0].from) !== JSON.stringify(ref.from) ||
          JSON.stringify(matches[0].to) !== JSON.stringify(ref.to)
        )
          throw Error(
            tr(
              "Verbindungsbezug ist nicht mehr eindeutig.",
              "Connection reference is no longer unique.",
            ),
          );
        const wire = matches[0];
        let copied = false;
        if (
          wire.lengthMm !== undefined &&
          Number.isFinite(wire.lengthMm) &&
          wire.lengthMm >= 0
        ) {
          this.edit.lengthM = wire.lengthMm / 1000;
          copied = true;
        }
        const section = wire.crossSection
          ?.trim()
          .match(/^(\d+(?:[.,]\d+)?)\s*(?:mm[²2])?$/i);
        if (section && Number(section[1].replace(",", ".")) > 0) {
          this.edit.sectionMm2 = Number(section[1].replace(",", "."));
          copied = true;
        }
        if (!copied)
          throw Error(
            tr(
              "An dieser Verbindung sind keine eindeutigen realen Längen-/Querschnittswerte gespeichert. Bitte ausdrücklich erfassen.",
              "No unambiguous real length/cross-section values are saved on this connection. Please enter them explicitly.",
            ),
          );
        this.edit.reference!.importedValues = {
          lengthMm: wire.lengthMm,
          crossSection: wire.crossSection,
        };
        this.edit.inputSource = tr(
          `Aus Verbindung ${ref.wireId} ausdrücklich übernommen. Als vollständige einfache Stromkreisstrecke prüfen.`,
          `Explicitly copied from connection ${ref.wireId}. Verify as a complete single-circuit route.`,
        );
        this.dirty = true;
        this.render();
      }),
    );
    const exportProject = () => {
      this.stale();
      if (this.dirty)
        throw Error(
          tr(
            "Eingaben vor dem Export übernehmen.",
            "Apply inputs before exporting.",
          ),
        );
      return this.source;
    };
    q("[data-json]").onclick = () =>
      safe(() => {
        const p = exportProject();
        downloadArticleFile(
          JSON.stringify(
            {
              format: "schematico-dimensioning",
              schemaVersion: 1,
              projectId: p.id,
              projectName: p.name,
              inputs: p.dimensioning ?? [],
              protectionCoordination: (p.dimensioning ?? []).map((r) =>
                protectionCoordination(r, p),
              ),
              results: (p.dimensioning ?? []).map((r) =>
                calculateDimensioning(r, p),
              ),
            },
            null,
            2,
          ),
          "schematico-dimensionierung.json",
          "application/json",
        );
      });
    q("[data-csv]").onclick = () =>
      safe(() => {
        const p = exportProject();
        downloadArticleFile(
          engineeringReportCsv(dimensioningColumns, dimensioningReportRows(p)),
          "schematico-dimensionierung.csv",
          "text/csv;charset=utf-8",
        );
      });
    q("[data-pdf]").onclick = () =>
      safe(() => {
        const p = exportProject(),
          rows = engineeringPdfRows(dimensioningReportRows(p));
        engineeringTablePdf(
          tr("Elektrische Dimensionierung", "Electrical Dimensioning"),
          dimensioningColumns,
          rows.map((r) => dimensioningColumns.map((_, i) => r.cells["c" + i])),
          p.name,
          p,
        ).save("schematico-dimensionierung.pdf");
      });
    finishEngineeringDialog(this.el, {
      kind: "potential",
      description: tr(
        "Spannungsfall, Leiter- und Schutzgerätekoordination mit dokumentierten Eingaben",
        "Voltage drop, conductor, and protective device coordination with documented inputs",
      ),
      wide: true,
    });
    if (this.wizardBusy)
      this.el
        .querySelectorAll<HTMLInputElement>(
          "input,select,textarea,button:not([data-close])",
        )
        .forEach((e) => (e.disabled = true));
    focusArticleModal(this.el);
  }
  private collect() {
    this.el
      .querySelectorAll<HTMLTextAreaElement>("[data-article-source]")
      .forEach((e) => {
        const r = e.dataset.articleSource as CircuitArticleRole;
        if (this.edit.articles?.[r]) this.edit.articles[r]!.source = e.value;
      });
    this.el.querySelectorAll<HTMLInputElement>("[data-number]").forEach((e) => {
      const key = e.dataset.number as NumericDimensioningKey;
      if (e.value === "") delete this.edit[key];
      else (this.edit as any)[key] = e.valueAsNumber;
    });
    this.el.querySelectorAll<HTMLInputElement>("[data-text]").forEach((e) => {
      (this.edit as any)[e.dataset.text!] = e.value;
    });
    this.el
      .querySelectorAll<HTMLSelectElement>("[data-select]")
      .forEach((e) => {
        (this.edit as any)[e.dataset.select!] = e.value;
      });
    this.el.querySelectorAll<HTMLInputElement>("[data-flag]").forEach((e) => {
      (this.edit as any)[e.dataset.flag!] = e.checked;
    });
  }
  private articleOptions(): AssignedArticle[] {
    const catalogue = editorArticles().map(({ article }) => ({
      articleNumber: article.articleNumber,
      manufacturer: article.manufacturer,
      variant: article.variant,
      role: "main" as const,
      snapshot: article,
    }));
    return dimensioningArticleCandidates(this.source, [
      ...(this.source.dimensioning?.flatMap((r) =>
        Object.values(r.articles ?? {})
          .filter((s) => !!s)
          .map((s) => s!.article),
      ) ?? []),
      ...catalogue,
    ]);
  }
  private articlePanel() {
    const devices = this.source.pages.flatMap((p) =>
      p.components
        .filter((c) => c.bmk?.trim())
        .map((c) => ({
          pageId: p.id,
          componentId: c.id,
          label: p.pageNumber + " · " + c.bmk,
          component: c,
        })),
    );
    const card = (role: CircuitArticleRole) => {
      const selection = this.edit.articles?.[role],
        article = selection?.article,
        assessment = article && assessCircuitArticle(article, role, this.edit);
      const roleDevices = devices.filter((d) => {
        const main = effectiveArticles(d.component, this.source).find(
          (a) => a.role === "main",
        );
        return (
          selection?.device?.componentId === d.componentId ||
          !main?.snapshot?.electrical ||
          main.snapshot.electrical.kind ===
            (role === "upstream" ? "protection" : role)
        );
      });
      return `<article class="pe-part-card" data-part-card="${role}"><header><span class="pe-part-icon">${circuitRoleIcon(role)}</span><h4>${esc(circuitRoleLabel(role))}</h4>${role === "load" || role === "upstream" ? `<small>${esc(tr("optional", "optional"))}</small>` : ""}</header>${article ? `<div class="pe-part-identity"><small>${esc(article.manufacturer || tr("Ohne Hersteller", "No manufacturer"))}</small><strong>${esc(article.articleNumber)}</strong>${article.variant ? `<span>${esc(tr("Variante", "Variant"))}: ${esc(article.variant)}</span>` : ""}<p title="${esc(article.snapshot?.description ?? "")}">${esc(article.snapshot?.description ?? "")}</p></div><p class="pe-part-ratings">${esc(circuitPartSummary(article))}</p><span class="pe-status ${assessment?.status === "ready" ? "pass" : assessment?.status === "incompatible" ? "fail" : "missing"}">${esc(assessment?.status === "ready" ? tr("Grunddaten passen", "Basic data match") : assessment?.status === "incompatible" ? tr("Zuordnung prüfen", "Check assignment") : tr("Kennwerte ergänzen", "Add ratings"))}</span>${assessment && assessment.status !== "ready" ? `<p class="pe-part-hint">${esc([...assessment.conflicts, ...assessment.missing].slice(0, 2).join(" "))}</p>` : ""}` : `<p class="pe-part-empty">${esc(tr("Noch kein Artikel gewählt", "No part selected yet"))}</p>`}<div class="pe-actions"><button type="button" class="btn ${article ? "" : "btn-primary"}" data-article-choose="${role}">${esc(article ? tr("Artikel wechseln", "Change part") : tr("Artikel auswählen", "Choose part"))}</button>${article ? `<button type="button" class="btn" data-article-remove="${role}" aria-label="${esc(tr("Zuordnung entfernen", "Remove assignment"))}">✕</button>` : ""}</div>${role==='cable'?`<label>${esc(tr('Kabeldefinition (optional)','Cable definition (optional)'))}<select class="form-input" data-article-cable-target><option value="">${esc(tr('Kein Kabelbezug','No cable binding'))}</option>${this.source.pages.flatMap(page=>(page.cables??[]).filter(c=>c.article).map(c=>`<option value="${esc(JSON.stringify([page.id,c.id]))}" ${selection?.cable?.pageId===page.id&&selection.cable.cableId===c.id?'selected':''}>${esc(page.pageNumber+' · '+c.bmk+' · '+c.article!.articleNumber)}</option>`)).join('')}</select></label>${selection?.cable?`<button type="button" class="btn" data-article-cable-manage>${esc(tr('Kabelartikel und reale Länge bearbeiten','Edit cable part and real length'))}</button>`:''}`:''}${selection ? `<details class="pe-part-advanced"><summary>${esc(tr("Zuordnung und Kennwerte bearbeiten", "Edit binding and ratings"))}</summary><label>${esc(tr("Projektgerät (optional)", "Project device (optional)"))}<select class="form-input" data-article-device="${role}"><option value="">${esc(tr("Nur Auslegungsartikel / kein Planbezug", "Design part only / no drawing reference"))}</option>${roleDevices.map((d) => `<option value="${esc(JSON.stringify([d.pageId, d.componentId]))}" ${selection.device?.pageId === d.pageId && selection.device?.componentId === d.componentId ? "selected" : ""}>${esc(d.label)}</option>`).join("")}</select></label><label>${esc(tr("Datenblatt / Kennwertquelle", "Data sheet / rating source"))}<textarea class="form-input" data-article-source="${role}" maxlength="2000">${esc(selection.source ?? "")}</textarea></label><div class="pe-actions"><button type="button" class="btn" data-article-adopt="${role}" ${selection.parameters && selection.source ? "" : "disabled"}>${esc(tr("Gespeicherte Kennwerte übernehmen", "Adopt saved ratings"))}</button><button type="button" class="btn" data-article-capture="${role}">${esc(tr("Formularwerte an Artikel binden", "Attach form values to part"))}</button><button type="button" class="btn" data-article-edit="${role}">${esc(tr("Im Artikelkatalog bearbeiten", "Edit in parts catalogue"))}</button>${selection.device && this.manageArticle ? `<button type="button" class="btn" data-article-manage="${role}">${esc(tr("Artikel im Plan bearbeiten", "Edit part in drawing"))}</button>` : ""}</div><p class="pe-part-hint">${esc(tr("Katalogänderungen durch erneute Artikelauswahl übernehmen. Die Auswahl allein verändert keine Projektgeräte.", "Adopt catalogue changes by selecting the part again. Selecting a part alone does not change project devices."))}</p></details>` : `<details class="pe-part-advanced"><summary>${esc(tr("Vorhandenes Projektgerät zuordnen", "Link an existing project device"))}</summary><select class="form-input" aria-label="${esc(circuitRoleLabel(role))}" data-article-device="${role}"><option value="">—</option>${roleDevices.map((d) => `<option value="${esc(JSON.stringify([d.pageId, d.componentId]))}">${esc(d.label)}</option>`).join("")}</select></details>`}</article>`;
    };
    return `<section class="pe-card pe-part-section"><div class="pe-card-heading"><div><h3>${esc(tr("Artikel für diesen Stromkreis", "Parts for this circuit"))}</h3><p>${esc(tr("Getrennt auswählen. Kennwerte können direkt mit übernommen werden.", "Select each role separately. Ratings can be adopted with the part."))}</p></div></div><div class="pe-part-grid">${(["cable", "protection", "load"] as const).map(card).join("")}</div><details class="pe-part-upstream"><summary>${esc(tr("Vorgeschaltetes Schutzgerät und Selektivität (optional)", "Upstream protective device and selectivity (optional)"))}</summary>${card("upstream")}</details></section>`;
  }
  private chooseArticle(
    role: CircuitArticleRole,
    article: AssignedArticle | undefined,
    adopt = false,
  ) {
    this.stale();
    this.collect();
    let next = selectCircuitArticle(this.edit, role, article, false);
    if (article && !next.articles?.[role]?.parameters) {
      const known = this.records()
        .map((r) => r.articles?.[role])
        .find(
          (a) =>
            a &&
            circuitArticleKey(a.article) === circuitArticleKey(article) &&
            a.parameters &&
            a.source,
        );
      if (known)
        next.articles![role] = {
          ...next.articles![role]!,
          parameters: structuredClone(known.parameters),
          source: known.source,
        };
    }
    if (adopt) next = selectCircuitArticle(next, role, article, true);
    this.edit = next;
    this.dirty = true;
    this.comparisons = undefined;
    this.render();
    this.el
      .querySelector(`[data-part-card="${role}"]`)
      ?.scrollIntoView({ block: "nearest" });
    this.el
      .querySelector<HTMLButtonElement>(`[data-article-choose="${role}"]`)
      ?.focus({ preventScroll: true });
  }
  private openArticlePicker(role: CircuitArticleRole, after?: () => void) {
    this.collect();
    this.stale();
    const projectKeys = new Set(
      dimensioningArticleCandidates(this.source).map(circuitArticleKey),
    );
    new CircuitArticlePicker({
      role,
      record: structuredClone(this.edit),
      getProject: () => this.source,
      getItems: () => this.articleOptions(),
      projectKeys,
      selected: this.edit.articles?.[role]?.article,
      onChoose: (article, adopt) => {
        this.chooseArticle(role, article, adopt);
        after?.();
      },
    }).show();
  }
  private async openProtectionCoordination() {
    try {
      this.collect();
      this.stale();
      const { ProtectionCoordinationDialog } =
        await import("./ProtectionCoordinationDialog");
      new ProtectionCoordinationDialog(
        this.source,
        structuredClone(this.edit),
        (role) =>
          this.openArticlePicker(role, () => {
            void this.openProtectionCoordination();
          }),
        this.dirty || !this.records().some((r) => r.id === this.edit.id),
      ).show();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      this.el.querySelector("[role=alert]")!.textContent = this.error;
    }
  }
  private bindArticles(safe: (fn: () => void) => void) {
    this.el.querySelector<HTMLSelectElement>('[data-article-cable-target]')?.addEventListener('change',e=>safe(()=>{
      this.collect();const value=(e.target as HTMLSelectElement).value;
      if(!value){if(this.edit.articles?.cable)delete this.edit.articles.cable.cable;}
      else{const [pageId,cableId]=JSON.parse(value),c=this.source.pages.find(p=>p.id===pageId)?.cables?.find(c=>c.id===cableId);if(!c?.article)throw Error(tr('Kabelartikel fehlt.','Cable part is missing.'));const old=this.edit.articles?.cable?.cable;this.edit=selectCircuitArticle(this.edit,'cable',c.article,false);delete this.edit.articles!.cable!.device;this.edit.articles!.cable!.cable=old?.pageId===pageId&&old?.cableId===cableId?old:{pageId,cableId};}
      this.dirty=true;this.comparisons=undefined;this.render();
    }));
    this.el.querySelector('[data-article-cable-manage]')?.addEventListener('click',()=>safe(()=>{
      if(this.dirty)throw Error(tr('Berechnung zuerst übernehmen.','Apply the calculation first.'));this.stale();
      void import('./CableArticleDialog').then(({CableArticleDialog})=>new CableArticleDialog(this.getProject,p=>{this.onApply(p);this.el.remove();},this.edit.articles!.cable!.cable!).show());
    }));
    this.el
      .querySelectorAll<HTMLButtonElement>("[data-article-choose]")
      .forEach(
        (button) =>
          (button.onclick = () =>
            safe(() => {
              this.openArticlePicker(
                button.dataset.articleChoose as CircuitArticleRole,
              );
            })),
      );
    this.el
      .querySelectorAll<HTMLButtonElement>("[data-article-remove]")
      .forEach(
        (button) =>
          (button.onclick = () =>
            safe(() =>
              this.chooseArticle(
                button.dataset.articleRemove as CircuitArticleRole,
                undefined,
              ),
            )),
      );
    this.el.querySelectorAll<HTMLButtonElement>("[data-article-edit]").forEach(
      (button) =>
        (button.onclick = () =>
          safe(() => {
            this.collect();
            const a =
              this.edit.articles?.[
                button.dataset.articleEdit as CircuitArticleRole
              ]?.article;
            if (!a) return;
            new ArticleCatalogDialog(
              this.source,
              undefined,
              a.articleNumber,
              a.snapshot ?? {
                id: "",
                manufacturer: a.manufacturer,
                articleNumber: a.articleNumber,
                variant: a.variant,
                description: "",
                origin: "user",
                verification: "unverified",
              },
            ).show();
          })),
    );
    this.el
      .querySelectorAll<HTMLSelectElement>("[data-article-device]")
      .forEach(
        (el) =>
          (el.onchange = () =>
            safe(() => {
              this.collect();
              const role = el.dataset.articleDevice as CircuitArticleRole;
              if (!el.value) {
                if (this.edit.articles?.[role])
                  delete this.edit.articles[role]!.device;
              } else {
                const [pageId, componentId] = JSON.parse(el.value),
                  c = this.source.pages
                    .find((p) => p.id === pageId)
                    ?.components.find((c) => c.id === componentId),
                  article =
                    c &&
                    effectiveArticles(c, this.source).find(
                      (a) => a.role === "main",
                    );
                if (!article)
                  throw Error(
                    tr(
                      "Dieses Gerät hat keinen Hauptartikel. Zuerst im Artikelwerkzeug zuordnen.",
                      "This device has no main part. Assign it in the parts workbench first.",
                    ),
                  );
                this.edit = selectCircuitArticle(
                  this.edit,
                  role,
                  article,
                  false,
                );
                this.edit.articles![role]!.device = { pageId, componentId };
                delete this.edit.articles![role]!.cable;
              }
              this.dirty = true;
              this.comparisons = undefined;
              this.render();
            })),
      );
    for (const action of ["capture", "adopt"] as const)
      this.el
        .querySelectorAll<HTMLButtonElement>("[data-article-" + action + "]")
        .forEach(
          (el) =>
            (el.onclick = () =>
              safe(() => {
                this.collect();
                const role = el.getAttribute(
                  "data-article-" + action,
                ) as CircuitArticleRole;
                if (action === "capture")
                  this.edit = captureCircuitArticle(
                    this.edit,
                    role,
                    this.edit.articles?.[role]?.source ?? "",
                  );
                this.edit = adoptCircuitArticle(this.edit, role);
                this.dirty = true;
                this.comparisons = undefined;
                this.render();
              })),
        );
    this.el
      .querySelectorAll<HTMLButtonElement>("[data-article-manage]")
      .forEach(
        (el) =>
          (el.onclick = () =>
            safe(() => {
              if (this.dirty)
                throw Error(
                  tr(
                    "Berechnung zuerst übernehmen.",
                    "Apply the calculation first.",
                  ),
                );
              this.stale();
              this.manageArticle?.(
                this.edit.articles![
                  el.dataset.articleManage as CircuitArticleRole
                ]!.device!,
              );
              this.el.remove();
            })),
      );
  }
  private wizardPanel() {
    if (!this.wizardOpen) return "";
    const comparison = this.comparisons;
    return `<section class="pe-card pe-design-assistant" data-design-assistant><h3>${esc(tr("Stromkreis-Assistent", "Circuit assistant"))}</h3><ol class="pe-design-steps"><li>${esc(tr("Last erfassen", "Enter load"))}</li><li>${esc(tr("Artikel auswählen", "Choose parts"))}</li><li>${esc(tr("Auslegung vergleichen", "Compare design"))}</li><li>${esc(tr("Plan prüfen", "Review drawing"))}</li></ol><p>${esc(tr("Last, Länge und Verlegefaktoren bestimmen die Auslegung. Wähle konkrete Artikel oder lasse verfügbare Kombinationen vergleichen.", "Load, cable length and installation factors determine the design. Choose specific parts or compare available combinations."))}</p>${this.articlePanel()}<label class="pe-check"><input type="checkbox" data-design-selected ${this.selectedArticlesOnly ? "checked" : ""}>${esc(tr("Ausgewählte Leitung und Schutzgerät beim Vergleich festhalten", "Keep selected cable and protective device fixed during comparison"))}</label><details class="pe-design-alternatives"><summary>${esc(tr("Alternativen für den Vergleich eingrenzen", "Filter alternatives for comparison"))}</summary><div class="pe-fields">${(["cable", "protection"] as const).map((role) => `<label>${esc(role === "cable" ? tr("Leitung suchen", "Find cable") : tr("Schutzgerät suchen", "Find protective device"))}<input class="form-input" data-design-filter="${role}" ${this.selectedArticlesOnly && this.edit.articles?.[role] ? "disabled" : ""} value="${esc(this.designFilters[role] ?? "")}"></label>`).join("")}</div></details><button type="button" class="btn btn-primary" data-design-compare>${esc(tr("Auslegung prüfen und vergleichen", "Check and compare circuit design"))}</button><div data-design-comparisons>${
      comparison
        ? `<p>${comparison.total} ${esc(tr("Kombinationen berechnet; maximal 24 angezeigt, je höchstens 40 Leitungen / Schutzgeräte.", "combinations calculated; up to 24 shown, at most 40 cables / protective devices each."))} ${comparison.truncated ? esc(tr("Auswahl begrenzt – Suche eingrenzen.", "Selection limited – narrow the search.")) : ""}</p>${!comparison.total ? `<p>${esc(tr("Keine Kombination verfügbar. Benötigt werden mindestens ein Leitungsartikel und ein Schutzgeräteartikel mit strukturierten elektrischen Kennwerten.", "No combinations available. At least one cable and one protective device with structured electrical ratings are required."))}</p>` : ""}${comparison.candidates
            .map(
              (c, i) =>
                `<article class="pe-card pe-design-result"><div class="pe-design-pair">${(
                  ["cable", "protection"] as const
                )
                  .map((role) => {
                    const a = c.record.articles![role]!.article;
                    return `<div><small>${esc(circuitRoleLabel(role))}</small><strong>${esc(a.manufacturer + " · " + a.articleNumber)}</strong>${a.variant ? `<span>${esc(tr("Variante", "Variant"))}: ${esc(a.variant)}</span>` : ""}</div>`;
                  })
                  .join(
                    "",
                  )}</div><p>${esc(tr("Querschnitt", "Cross-section"))}: ${num(c.record.sectionMm2)} mm² · In: ${num(c.record.protectiveCurrentA)} A · ΔU: ${num(c.result.values.dropPercent)} %</p><span class="pe-status ${c.result.status === "failed" ? "fail" : c.result.status === "incomplete" || c.issues.length ? "missing" : "pass"}">${esc(c.result.status === "failed" ? tr("Grenzwert verletzt", "Limit exceeded") : c.result.status === "incomplete" || c.issues.length ? tr("Angaben fehlen / Kompatibilität prüfen", "Missing inputs / check compatibility") : tr("Beauftragte Rechenprüfungen erfüllt", "Requested calculation checks passed"))}</span><p>${esc(c.record.articles!.cable!.source ?? "")}</p><p>${esc(c.record.articles!.protection!.source ?? "")}</p>${[
                  ...c.issues,
                  ...c.result.checks
                    .filter(
                      (v) => v.status === "missing" || v.status === "fail",
                    )
                    .map((v) => v.label + ": " + v.message),
                ]
                  .slice(0, 12)
                  .map((m) => `<p>${esc(m)}</p>`)
                  .join(
                    "",
                  )}<button type="button" class="btn" data-design-pick="${i}">${esc(tr("Kennwerte und Bedingungen übernehmen", "Adopt ratings and conditions"))}</button></article>`,
            )
            .join("")}`
        : ""
    }</div><hr><label>${esc(tr("Verbrauchervorlage (bei Artikel gilt dessen hinterlegtes Symbol)", "Load template (a selected part uses its own symbol)"))}<select class="form-input" data-design-template>${[
      ["socket_schuko", tr("Steckdose, einphasig", "Socket, single-phase")],
      ["motor_1phase", tr("Motor, einphasig", "Motor, single-phase")],
      ["motor_3phase", tr("Motor, dreiphasig", "Motor, three-phase")],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${this.loadSymbol === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><p>${esc(tr("Neue Planseite mit Einspeise-Abbruchstellen, Schutzgerät und Verbraucher. L/N/PE bzw. L1/L2/L3/PE bleiben getrennt. Die ausgewählten Geräteartikel werden zugeordnet; der Kabelartikel bleibt im Auslegungsdatensatz. Eine vorhandene FI- oder vorgeschaltete Schutzeinrichtung wird nicht als geprüft vorausgesetzt.", "New drawing page with supply interruption points, protection and load. L/N/PE or L1/L2/L3/PE remain separate. Selected device parts are assigned; the cable part remains in the design record. An existing RCD or upstream protective device is not assumed to be verified."))}</p><button type="button" class="btn btn-primary" data-design-plan ${this.wizardBusy ? "disabled" : ""}>${esc(this.wizardBusy ? tr("Layout wird berechnet …", "Computing layout …") : tr("Neue Planseite als Autoconnect-Vorschau", "Preview new page with Autoconnect"))}</button></section>`;
  }
  private bindWizard(safe: (fn: () => void) => void) {
    this.el.querySelector<HTMLButtonElement>("[data-wizard-open]")!.onclick =
      () => {
        this.collect();
        this.wizardOpen = !this.wizardOpen;
        this.render();
        this.el
          .querySelector("[data-design-assistant]")
          ?.scrollIntoView({ block: "start" });
      };
    this.el
      .querySelector<HTMLSelectElement>("[data-design-template]")
      ?.addEventListener("change", (e) => {
        this.loadSymbol = (e.target as HTMLSelectElement).value;
      });
    this.el.querySelectorAll<HTMLInputElement>("[data-design-filter]").forEach(
      (el) =>
        (el.oninput = () => {
          this.designFilters[
            el.dataset.designFilter as "cable" | "protection"
          ] = el.value;
          this.comparisons = undefined;
          this.el.querySelector("[data-design-comparisons]")?.replaceChildren();
        }),
    );
    this.el
      .querySelector<HTMLInputElement>("[data-design-selected]")
      ?.addEventListener("change", (e) => {
        this.selectedArticlesOnly = (e.target as HTMLInputElement).checked;
        this.el
          .querySelectorAll<HTMLInputElement>("[data-design-filter]")
          .forEach(
            (f) =>
              (f.disabled =
                this.selectedArticlesOnly &&
                !!this.edit.articles?.[
                  f.dataset.designFilter as "cable" | "protection"
                ]),
          );
        this.comparisons = undefined;
        this.el.querySelector("[data-design-comparisons]")?.replaceChildren();
      });
    this.el
      .querySelector("[data-design-compare]")
      ?.addEventListener("click", () =>
        safe(() => {
          this.collect();
          this.stale();
          this.comparisons = compareCircuitArticles(
            this.edit,
            this.articleOptions(),
            24,
            this.source,
            {
              ...this.designFilters,
              selected: this.selectedArticlesOnly
                ? {
                    ...(this.edit.articles?.cable
                      ? {
                          cable: circuitArticleKey(
                            this.edit.articles.cable.article,
                          ),
                        }
                      : {}),
                    ...(this.edit.articles?.protection
                      ? {
                          protection: circuitArticleKey(
                            this.edit.articles.protection.article,
                          ),
                        }
                      : {}),
                  }
                : undefined,
            },
          );
          this.render();
          this.el
            .querySelector("[data-design-comparisons]")
            ?.scrollIntoView({ block: "start" });
        }),
      );
    this.el.querySelectorAll<HTMLElement>("[data-design-pick]").forEach(
      (b) =>
        (b.onclick = () =>
          safe(() => {
            this.stale();
            const c =
              this.comparisons?.candidates[Number(b.dataset.designPick)];
            if (!c)
              throw Error(
                tr("Vergleich neu berechnen.", "Recalculate comparison."),
              );
            this.edit = structuredClone(c.record);
            this.dirty = true;
            this.comparisons = undefined;
            this.render();
          })),
    );
    this.el
      .querySelector("[data-design-plan]")
      ?.addEventListener("click", () => {
        void this.proposeCircuit();
      });
  }
  private async proposeCircuit() {
    if (this.wizardBusy) return;

    try {
      this.collect();
      this.stale();
      if (document.getElementById("layoutPreviewModal"))
        throw Error(
          tr(
            "Zuerst die offene Layoutvorschau schließen.",
            "Close the existing layout preview first.",
          ),
        );
      const { draft, pageId, record } = circuitSchematicDraft(
        this.source,
        this.edit,
        this.loadSymbol,
      );
      this.wizardBusy = true;
      this.render();
      this.wizardAbort = new AbortController();
      const raw = await previewLayout(
        this.source,
        pageId,
        { constructionOnly: true, abortSignal: this.wizardAbort.signal },
        draft,
      );
      if (!this.el.isConnected) return;
      this.stale();
      const checked = preferDraftAutoconnect(this.source, draft, raw, true);
      new LayoutPreviewDialog({
        getProject: this.getProject,
        preview: checked.preview,
        draft: checked.draft,
        options: { constructionOnly: true },
        onApply: (candidate, proposed) => {
          const next = structuredClone(this.getProject());
          applyLayout(next, candidate, proposed);
          const saved = next.dimensioning?.find((r) => r.id === record.id);
          if (!saved)
            throw Error(
              tr(
                "Auslegungsdatensatz fehlt im Vorschlag.",
                "Design record missing from proposal.",
              ),
            );
          for (const selection of Object.values(saved.articles ?? {}))
            if (selection?.device) {
              const owners = next.pages.filter((p) =>
                p.components.some(
                  (c) => c.id === selection.device!.componentId,
                ),
              );
              if (owners.length !== 1)
                throw Error(
                  tr(
                    "Gerätezuordnung im Layout ist nicht eindeutig.",
                    "Device binding in layout is not unique.",
                  ),
                );
              selection.device.pageId = owners[0].id;
            }
          if (calculateDimensioning(saved, next).status !== "checked")
            throw Error(
              tr(
                "Auslegung und Layout stimmen nicht mehr überein.",
                "Design and layout no longer match.",
              ),
            );
          this.onApply(next);
          this.source = structuredClone(this.getProject());
          this.baseline = projectRevision(this.source);
          this.edit = structuredClone(
            this.source.dimensioning?.find((r) => r.id === record.id) ?? record,
          );
          this.dirty = false;
          this.comparisons = undefined;
          this.render();
        },
      }).show();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.wizardAbort = undefined;
      this.wizardBusy = false;
      if (this.el.isConnected) this.render();
    }
  }
  private renderResults() {
    const result = calculateDimensioning(this.edit, this.source),
      v = result.values;
    const status =
      result.status === "checked"
        ? tr("Beauftragte Prüfungen erfüllt", "Selected checks passed")
        : result.status === "failed"
          ? tr("Grenzwert verletzt", "Limit exceeded")
          : tr("Angaben fehlen", "Inputs incomplete");
    return `<h3>${esc(tr("Berechnungsvorschau", "Calculation Preview"))}</h3><span class="pe-status ${result.status === "checked" ? "pass" : result.status === "failed" ? "fail" : "missing"}" data-calc-status>${esc(status)}</span><svg class="pe-circuit" viewBox="0 0 360 100" role="img" aria-label="${esc(tr("Quelle, Schutzgerät, Leitung und Last", "Source, protective device, cable, and load"))}"><path d="M30 50H330" stroke="#75baff" stroke-width="2"/><circle cx="30" cy="50" r="16" fill="#1c2e43" stroke="#75baff"/><path d="M90 33h30v34H90zM220 38v24M230 38v24M240 38v24M310 33h34v34h-34z" fill="#1c2e43" stroke="#b6c8df"/><text x="30" y="84">${esc(tr("Quelle", "Source"))}</text><text x="105" y="84">${esc(tr("Schutz", "Protection"))}</text><text x="230" y="84">${esc(tr("Leitung", "Cable"))}</text><text x="327" y="84">${esc(tr("Last", "Load"))}</text></svg><div class="pe-calculated"><div><span>${esc(tr("Betriebsstrom", "Operating Current"))}</span><strong data-current>${num(v.currentA)} A</strong></div><div><span>${esc(tr("Spannungsfall", "Voltage Drop"))}</span><strong data-drop>${num(v.dropPercent)} %</strong><small>${num(v.dropV)} V</small></div><div><span>${esc(tr("Leitungsverlust", "Cable Loss"))}</span><strong>${num(v.lossW)} W</strong></div>${v.ampacityA === undefined ? "" : `<div><span>${esc(tr("Korrigiertes Iz", "Derated Iz"))}</span><strong>${num(v.ampacityA)} A</strong></div>`}${v.faultMinA === undefined ? "" : `<div><span>Ik,min / Ik,max</span><strong>${num(v.faultMinA)} / ${num(v.faultMaxA)} A</strong></div>`}</div>${result.checks.map((c) => `<article class="pe-result ${c.status}"><span class="pe-status ${c.status}">${dimensioningStatus[c.status]}</span><h4>${esc(c.label)}</h4><p>${esc(c.message)}</p>${c.formula ? `<code>${esc(c.formula)}</code>` : ""}</article>`).join("")}<details class="pe-card"><summary>${esc(tr("Formeln und Berechnungsgrundlagen", "Formulas & Calculation Basis"))}</summary><ul>${result.assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul><p>${esc(tr("Bei Leistungsangabe: Ib = Pab / (U · η · cosφ), Drehstrom zusätzlich / √3. DC: cosφ = 1. Kupfer α20 = 0,00393/K, Aluminium α20 = 0,00403/K.", "For power input: Ib = Pout / (U · η · cosφ), three-phase additionally / √3. DC: cosφ = 1. Copper α20 = 0.00393/K, Aluminum α20 = 0.00403/K."))}</p><p>${result.method}</p></details>`;
  }
}
