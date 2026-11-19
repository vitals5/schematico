import {
  electricalFields,
  validateElectricalData,
  type ArticleElectricalData,
  type ElectricalRatingKey,
} from "../model/ArticleElectrical";
import { escapeSvg as esc } from "../model/ImportedDrawing";
import { tr } from "../i18n";
/** Optional sourced ratings editor, shared by local and public article workflows. */
export class ArticleElectricalEditor {
  private draft: Partial<ArticleElectricalData>;
  constructor(
    private el: HTMLElement,
    initial?: ArticleElectricalData,
  ) {
    this.draft = structuredClone(initial ?? {});
    this.render();
  }
  private collect() {
    const kind = this.el.querySelector<HTMLSelectElement>(
      "[data-electrical-kind]",
    )!.value as ArticleElectricalData["kind"];
    if (!kind) {
      this.draft = {};
      return;
    }
    const next: Partial<ArticleElectricalData> = { version: 1, kind };
    for (const input of this.el.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("[data-electrical]")) {
      const key = input.dataset.electrical!;
      if (input.value.trim())
        (next as any)[key] =
          key in electricalFields
            ? Number(input.value)
            : key === "curve"
              ? this.parseCurve(input.value)
              : input.value;
    }
    this.draft = next;
  }
  private parseCurve(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  value() {
    this.collect();
    return this.draft.kind ? (this.draft as ArticleElectricalData) : undefined;
  }
  private render() {
    const kind = this.draft.kind;
    this.el.innerHTML = `<fieldset><legend>${esc(tr("Elektrische Kennwerte", "Electrical ratings"))}</legend><p>${esc(tr("Optionale, strukturierte Daten für die Stromkreisauslegung. Nur belegte Werte eintragen. Leere Felder bleiben unbekannt.", "Optional structured data for circuit design. Enter documented ratings only. Empty fields remain unknown."))}</p><label>${esc(tr("Artikelfunktion", "Part function"))}<select class="form-input" data-electrical-kind>${[
      ["", "—"],
      ["cable", tr("Leitung / Kabel", "Conductor / cable")],
      ["protection", tr("Schutzgerät", "Protective device")],
      ["load", tr("Verbraucher", "Load")],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${kind === v ? "selected" : ""}>${l}</option>`,
      )
      .join("")}</select></label>${
      kind
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">${Object.entries(
            electricalFields,
          )
            .filter(([, s]) => s.kinds.includes(kind))
            .map(
              ([key, s]) =>
                `<label>${esc(tr(s.de, s.en))}<input class="form-input" type="number" min="0" step="${s.integer ? "1" : "any"}" ${s.max ? `max="${s.max}"` : ""} data-electrical="${key}" value="${this.draft[key as ElectricalRatingKey] ?? ""}"></label>`,
            )
            .join(
              "",
            )}<label>${esc(tr("Stromart", "Current type"))}<select class="form-input" data-electrical="currentType">${[
            ["", "—"],
            ["ac", "AC"],
            ["dc", "DC"],
            ["ac_dc", "AC / DC"],
          ]
            .map(
              ([v, l]) =>
                `<option value="${v}" ${this.draft.currentType === v ? "selected" : ""}>${l}</option>`,
            )
            .join("")}</select></label>${
            kind === "cable"
              ? `<label>${esc(tr("Leitermaterial", "Conductor material"))}<select class="form-input" data-electrical="material">${[
                  ["", "—"],
                  ["copper", tr("Kupfer", "Copper")],
                  ["aluminium", tr("Aluminium", "Aluminum")],
                ]
                  .map(
                    ([v, l]) =>
                      `<option value="${v}" ${this.draft.material === v ? "selected" : ""}>${l}</option>`,
                  )
                  .join("")}</select></label>`
              : ""
          }${kind === "protection" ? `<label>${esc(tr("Kennlinienbezeichnung", "Characteristic designation"))}<input class="form-input" data-electrical="characteristic" maxlength="80" value="${esc(this.draft.characteristic ?? "")}"></label>` : ""}</div><label>${esc(tr("Datenblatt / Quelle (erforderlich)", "Data sheet / source (required)"))}<textarea class="form-input" data-electrical="source" maxlength="2000">${esc(this.draft.source ?? "")}</textarea></label><label>${esc(tr("Geltungs- und Verlegebedingungen (bei Iz0 oder Kennlinienpunkten erforderlich)", "Application / installation conditions (required for Iz0 or curve points)"))}<textarea class="form-input" data-electrical="conditions" maxlength="2000">${esc(this.draft.conditions ?? "")}</textarea></label>${kind === "protection" ? `<details><summary>${esc(tr("Hersteller-Kennlinienpunkte", "Manufacturer curve points"))}</summary><p>${esc(tr("Optional: JSON-Liste mit currentA, timeMinS, timeMaxS, nach Strom aufsteigend. Die Punkte werden dokumentiert; daraus wird kein automatischer Abschalt- oder Selektivitätsnachweis abgeleitet.", "Optional: JSON list with currentA, timeMinS, timeMaxS, sorted by increasing current. Points are recorded; they do not imply automatic disconnection or selectivity verification."))}</p><textarea class="form-input" data-electrical="curve" rows="5">${esc(this.draft.curve ? JSON.stringify(this.draft.curve, null, 2) : "")}</textarea></details>` : ""}`
        : ""
    }</fieldset>`;
    this.el.querySelector<HTMLSelectElement>(
      "[data-electrical-kind]",
    )!.onchange = (e) => {
      // Switching category intentionally drops incompatible ratings; preserve shared provenance.
      const kind = (e.target as HTMLSelectElement)
        .value as ArticleElectricalData["kind"];
      const source =
        this.el.querySelector<HTMLTextAreaElement>('[data-electrical="source"]')
          ?.value ?? this.draft.source;
      this.draft = kind ? { version: 1, kind, source } : {};
      this.render();
    };
  }
}
