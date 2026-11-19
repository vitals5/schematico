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

export class ElectricalDimensioningDialog {
  private el = document.createElement("div");
  private source: Project;
  private baseline: string;
  private edit: CircuitDimensioning;
  private dirty = false;
  private error = "";
  private query = "";
  private confirmDelete = false;
  constructor(
    private getProject: () => Project,
    private onApply: (p: Project) => void,
    initial?: CircuitDimensioning,
    private navigate?: (reference: DimensioningReference) => void,
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
      this.error =
        "Mehrere Stromkreise besitzen diesen Planbezug. Gewünschte Berechnung links auswählen.";
    this.dirty = !!initial && !records.some((r) => r.id === this.edit.id);
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
      confirm("Nicht übernommene Berechnungseingaben verwerfen?")
    )
      this.el.remove();
  }
  private stale() {
    if (projectRevision(this.getProject()) !== this.baseline)
      throw Error(
        "Projekt wurde verändert. Bitte aktualisieren und offene Eingaben verwerfen.",
      );
  }
  private records() {
    const raw = this.source.dimensioning;
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) {
      this.error = "Ungültiger Dimensionierungsbestand. Projektdatei prüfen.";
      return [];
    }
    const records = raw.filter(
      (r) => r && typeof r.id === "string" && typeof r.name === "string",
    );
    if (records.length !== raw.length)
      this.error =
        "Fehlerhafte Berechnungsdatensätze können nicht bearbeitet werden. Der gemeinsame Prüfbericht benennt die ungültigen Eingaben.";
    return records;
  }
  private field(key: NumericDimensioningKey) {
    const spec = dimensioningNumbers[key]!;
    return `<label>${esc(spec.label)}<input class="form-input" type="number" step="any" min="${spec.min}" ${spec.max !== undefined ? `max="${spec.max}"` : ""} data-number="${key}" value="${esc(String(this.edit[key] ?? ""))}" placeholder="nicht erfasst"></label>`;
  }
  private textField(key: keyof CircuitDimensioning, label: string) {
    return `<label>${label}<textarea class="form-input" data-text="${key}" maxlength="2000" placeholder="z. B. Datenblatt, Tabelle, Verlegeart, belastete Adern, Temperatur …">${esc(String(this.edit[key] ?? ""))}</textarea></label>`;
  }
  private fields(keys: NumericDimensioningKey[]) {
    return `<div class="pe-fields">${keys.map((k) => this.field(k)).join("")}</div>`;
  }
  private optional(
    flag: keyof CircuitDimensioning,
    title: string,
    content: string,
  ) {
    return `<details class="pe-card" ${this.edit[flag] ? "open" : ""}><summary>${title}</summary><label class="pe-check"><input type="checkbox" data-flag="${flag}" ${this.edit[flag] ? "checked" : ""}>Diesen Bereich prüfen</label>${content}</details>`;
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
      `<label>${label}<select class="form-input" data-select="${key}">${values.map(([v, l]) => `<option value="${v}" ${this.edit[key] === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
    this.el.innerHTML = `<section role="dialog" aria-modal="true"><h2>Elektrische Dimensionierung</h2><div class="pe-workspace"><aside class="pe-sidebar"><div class="pe-summary"><strong>${records.length}</strong> Stromkreise<span>Gespeicherte Eingaben · neu berechnete Ergebnisse</span></div><div class="pe-actions"><button class="btn btn-primary" data-new>+ Stromkreis</button><button class="btn" data-reload>Aktualisieren</button></div><input class="form-input" data-search aria-label="Stromkreise suchen" placeholder="Stromkreis suchen" value="${esc(this.query)}"><div class="pe-circuit-list">${
      matching
        .map((r) => {
          const status = calculateDimensioning(r, this.source).status;
          return `<button class="pe-revision ${r.id === this.edit.id ? "is-active" : ""}" data-circuit="${esc(r.id)}"><strong>${esc(r.name)}</strong><span class="pe-status ${status === "checked" ? "pass" : status === "failed" ? "fail" : "missing"}">${{ checked: "Beauftragte Prüfungen erfüllt", failed: "Grenzwert verletzt", incomplete: "Angaben fehlen" }[status]}</span></button>`;
        })
        .join("") || "<p>Keine gespeicherten Stromkreise.</p>"
    }</div><div class="pe-card"><h3>Berechnungsumfang</h3><p>Stromkreise werden ausdrücklich erfasst. Reale Leitungslängen werden nicht aus Zeichnungsabständen berechnet.</p><p>Schutzprüfungen verwenden dokumentierte Eingaben und die angezeigten Formeln. Nicht beauftragte Bereiche bleiben als solche ausgewiesen.</p></div></aside>
      <main class="pe-main pe-dimensioning"><form data-dimensioning-form><div class="pe-card"><label>Stromkreisname<input class="form-input" data-text="name" maxlength="160" required value="${esc(this.edit.name)}"></label><div class="pe-fields">${select(
        "system",
        "System",
        [
          ["dc", "Gleichstrom (2 Leiter)"],
          ["ac1", "Wechselstrom (L + N)"],
          ["ac3", "Drehstrom (symmetrisch)"],
        ],
      )}${select("material", "Leitermaterial", [
        ["copper", "Kupfer"],
        ["aluminium", "Aluminium"],
      ])}${select("loadMode", "Lastangabe", [
        ["current", "Betriebsstrom"],
        ["power", "Abgegebene Wirkleistung + Wirkungsgrad"],
      ])}</div>${this.edit.reference ? `<div class="pe-reference">Planbezug: ${esc(this.edit.reference.wireId)}${this.edit.reference.pageId ? " · " + esc(this.source.pages.find((p) => p.id === this.edit.reference!.pageId)?.pageNumber ?? "?") : " · logisch"}<button type="button" class="btn" data-jump>Im Plan ansehen</button><button type="button" class="btn" data-detach>Bezug entfernen</button><p>Die Bezugslinie ist keine automatisch erkannte vollständige Stromkreisstrecke. Eingaben beziehen sich auf den gesamten hier beschriebenen Stromkreis.</p><button type="button" class="btn" data-copy-length>Gespeicherte reale Länge / Querschnitt ausdrücklich übernehmen</button></div>` : ""}</div>
      <details open class="pe-card"><summary>1 · Last, Leitung und Spannungsfall</summary>${this.fields(["voltageV", ...(this.edit.loadMode === "power" ? (["outputPowerW", "efficiency"] as const) : (["currentA"] as const)), "lengthM", "sectionMm2", "temperatureC", "resistance20OhmKm", ...(this.edit.system === "dc" ? [] : (["cosPhi", "reactanceOhmKm"] as const)), "maxDropPercent"])}${
        this.edit.system !== "dc"
          ? select("powerFactorKind", "Lastcharakter", [
              ["lagging", "Induktiv / nacheilend"],
              ["leading", "Kapazitiv / voreilend"],
            ])
          : ""
      }${this.textField("inputSource", "Quelle / Beschreibung der Leitungs- und Lastdaten")}<p>Ohne R20-Eingabe: Planungswert ρ20 Cu 0,0175 bzw. Al 0,0282 Ω·mm²/m. Für einen Datenblattnachweis R20 ausdrücklich erfassen.</p></details>
      ${this.optional("verifyAmpacity", "2 · Strombelastbarkeit und Überlastschutz", this.fields(["ampacityA", "temperatureFactor", "groupingFactor", "otherFactor", "protectiveCurrentA", "conventionalTripA"]) + this.textField("ampacitySource", "Quelle Iz0 / Verlegebedingungen") + this.textField("protectionSource", "Quelle der Schutzgerätekennwerte"))}
      ${this.optional(
        "verifyFault",
        "3 · Fehlerstrom, Abschaltbedingung und Ausschaltvermögen",
        select("faultMode", "Fehlerstromverfahren", [
          ["direct", "Vorhandene Netzberechnung / Messung"],
          ["loop", "Einpoliger Fehler aus vollständiger Fehlerschleife"],
        ]) +
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
            "Quelle der Fehlerstrom-/Schleifenangaben",
          ) +
          (this.edit.faultMode === "loop"
            ? this.textField(
                "faultMaximumSource",
                "Gesonderter Beleg Ik,max: maximaler Netzkurzschlussstrom über alle relevanten Fehlerfälle",
              )
            : "") +
          this.fields([
            "tripThresholdA",
            "requiredDisconnectS",
            "thresholdTimeS",
            "breakingCapacityA",
          ]) +
          "<p>Ia und t(Ia) müssen zur relevanten Kennlinie, Spannung, Stromart und Abschaltbedingung passen. Schutzgerätequelle im Bereich 2 erfassen. Das Schleifenverfahren berechnet keinen dreipoligen Netzkurzschluss.</p>",
      )}
      ${this.optional("verifyAdiabatic", "4 · Thermischer Kurzschlussschutz", this.fields(["adiabaticK", "letThroughA2s", "energyTimeS"]) + this.textField("energySource", "Nachweis von k und I²t für den relevanten Fehlerstrombereich") + "<p>Adiabatischer Vergleich für die ausdrücklich erfasste Kurzzeitbeanspruchung bis 5 s; keine Kabeltemperatur- oder Wärmeabfuhrsimulation.</p>")}
      ${this.optional("verifySelectivity", "5 · Selektivität mit Herstellerbeleg", this.textField("upstreamDevice", "Vorgeschaltetes Gerät / genauer Artikel") + this.textField("downstreamDevice", "Nachgeschaltetes Gerät / genauer Artikel") + this.fields(["selectivityLimitA"]) + this.textField("selectivitySource", "Herstellerbeleg: konkrete Paarung, Betriebsspannung und Selektivitätsgrenze") + "<p>Für diesen Vergleich die Fehlerstromdaten im Bereich 3 erfassen. Es wird kein Selektivitätsnachweis aus Bemessungsstromverhältnissen abgeleitet.</p>")}
      <div class="pe-actions pe-sticky"><button class="btn btn-primary" data-apply>Eingaben übernehmen</button><button type="button" class="btn" data-copy>Als neuen Stromkreis kopieren</button><button type="button" class="btn" data-delete ${records.some((r) => r.id === this.edit.id) ? "" : "disabled"}>${this.confirmDelete ? "Löschen bestätigen" : "Stromkreis löschen"}</button><span data-dirty>${this.dirty ? "Nicht übernommene Eingaben" : "Gespeicherter Stand"}</span></div></form></main>
      <aside class="pe-results" data-results>${this.renderResults()}</aside></div><p class="pe-error" role="alert">${esc(this.error)}</p><footer><span>Berechnung nach erfassten Eingaben; Prüfbereiche und Grundlagen sind im Bericht enthalten.</span><button class="btn" data-json>Prüfbericht JSON</button><button class="btn" data-pdf>PDF</button><button class="btn" data-csv>CSV</button><button class="btn" data-close>Schließen</button></footer></section>`;
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
      confirm("Nicht übernommene Berechnungseingaben verwerfen?");
    q("[data-new]").onclick = () => {
      if (discard()) {
        this.edit = newDimensioning();
        this.dirty = true;
        this.confirmDelete = false;
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
    q<HTMLFormElement>("[data-dimensioning-form]").oninput = () => {
      this.collect();
      this.dirty = true;
      this.confirmDelete = false;
      q("[data-dirty]").textContent = "Nicht übernommene Eingaben";
      q("[data-results]").innerHTML = this.renderResults();
    };
    this.el.querySelectorAll<HTMLSelectElement>("[data-select]").forEach(
      (s) =>
        (s.onchange = () => {
          this.collect();
          this.dirty = true;
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
          throw Error("Verbindungsbezug ist nicht mehr eindeutig.");
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
            "An dieser Verbindung sind keine eindeutigen realen Längen-/Querschnittswerte gespeichert. Bitte ausdrücklich erfassen.",
          );
        this.edit.reference!.importedValues = {
          lengthMm: wire.lengthMm,
          crossSection: wire.crossSection,
        };
        this.edit.inputSource = `Aus Verbindung ${ref.wireId} ausdrücklich übernommen. Als vollständige einfache Stromkreisstrecke prüfen.`;
        this.dirty = true;
        this.render();
      }),
    );
    const exportProject = () => {
      this.stale();
      if (this.dirty) throw Error("Eingaben vor dem Export übernehmen.");
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
          "Elektrische Dimensionierung",
          dimensioningColumns,
          rows.map((r) => dimensioningColumns.map((_, i) => r.cells["c" + i])),
          p.name,
          p,
        ).save("schematico-dimensionierung.pdf");
      });
    finishEngineeringDialog(this.el, {
      kind: "potential",
      description:
        "Spannungsfall, Leiter- und Schutzgerätekoordination mit dokumentierten Eingaben",
      wide: true,
    });
    focusArticleModal(this.el);
  }
  private collect() {
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
  private renderResults() {
    const result = calculateDimensioning(this.edit, this.source),
      v = result.values;
    const status =
      result.status === "checked"
        ? "Beauftragte Prüfungen erfüllt"
        : result.status === "failed"
          ? "Grenzwert verletzt"
          : "Angaben fehlen";
    return `<h3>Berechnungsvorschau</h3><span class="pe-status ${result.status === "checked" ? "pass" : result.status === "failed" ? "fail" : "missing"}" data-calc-status>${status}</span><svg class="pe-circuit" viewBox="0 0 360 100" role="img" aria-label="Quelle, Schutzgerät, Leitung und Last"><path d="M30 50H330" stroke="#75baff" stroke-width="2"/><circle cx="30" cy="50" r="16" fill="#1c2e43" stroke="#75baff"/><path d="M90 33h30v34H90zM220 38v24M230 38v24M240 38v24M310 33h34v34h-34z" fill="#1c2e43" stroke="#b6c8df"/><text x="30" y="84">Quelle</text><text x="105" y="84">Schutz</text><text x="230" y="84">Leitung</text><text x="327" y="84">Last</text></svg><div class="pe-calculated"><div><span>Betriebsstrom</span><strong data-current>${num(v.currentA)} A</strong></div><div><span>Spannungsfall</span><strong data-drop>${num(v.dropPercent)} %</strong><small>${num(v.dropV)} V</small></div><div><span>Leitungsverlust</span><strong>${num(v.lossW)} W</strong></div>${v.ampacityA === undefined ? "" : `<div><span>Korrigiertes Iz</span><strong>${num(v.ampacityA)} A</strong></div>`}${v.faultMinA === undefined ? "" : `<div><span>Ik,min / Ik,max</span><strong>${num(v.faultMinA)} / ${num(v.faultMaxA)} A</strong></div>`}</div>${result.checks.map((c) => `<article class="pe-result ${c.status}"><span class="pe-status ${c.status}">${dimensioningStatus[c.status]}</span><h4>${esc(c.label)}</h4><p>${esc(c.message)}</p>${c.formula ? `<code>${esc(c.formula)}</code>` : ""}</article>`).join("")}<details class="pe-card"><summary>Formeln und Berechnungsgrundlagen</summary><ul>${result.assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul><p>Bei Leistungsangabe: Ib = Pab / (U · η · cosφ), Drehstrom zusätzlich / √3. DC: cosφ = 1. Kupfer α20 = 0,00393/K, Aluminium α20 = 0,00403/K.</p><p>${result.method}</p></details>`;
  }
}
