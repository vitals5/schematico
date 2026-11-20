import { ProtectionCurveEditor } from "./ProtectionCurveEditor";
import {
  electricalFields,
  type ArticleElectricalData,
  type ElectricalRatingKey,
} from "../model/ArticleElectrical";
import { escapeSvg as esc } from "../model/ImportedDrawing";
import { tr } from "../i18n";
/** Optional sourced ratings editor, shared by local and public article workflows. */
export class ArticleElectricalEditor {
  private draft: Partial<ArticleElectricalData>;
  private curveEditor?: ProtectionCurveEditor;
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
          key in electricalFields ? Number(input.value) : input.value;
    }
    const curve = this.curveEditor?.value();
    if (curve !== undefined) (next as any).curve = curve;
    this.draft = next;
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
          }${kind === "protection" ? `<label>${esc(tr("Kennlinienbezeichnung", "Characteristic designation"))}<input class="form-input" data-electrical="characteristic" maxlength="80" value="${esc(this.draft.characteristic ?? "")}"></label>` : ""}</div><label>${esc(tr("Datenblatt / Quelle (erforderlich)", "Data sheet / source (required)"))}<textarea class="form-input" data-electrical="source" maxlength="2000">${esc(this.draft.source ?? "")}</textarea></label><label>${esc(tr("Geltungs- und Verlegebedingungen (bei Iz0 oder Kennlinienpunkten erforderlich)", "Application / installation conditions (required for Iz0 or curve points)"))}<textarea class="form-input" data-electrical="conditions" maxlength="2000">${esc(this.draft.conditions ?? "")}</textarea></label>${
            kind === "protection"
              ? `<label>${esc(tr("Kennlinienart", "Curve type"))}<select class="form-input" data-electrical="curveKind">${[
                  ["", tr("Nicht festgelegt", "Not specified")],
                  [
                    "overcurrent",
                    tr(
                      "Überstrom · Leiterstrom [A]",
                      "Overcurrent · line current [A]",
                    ),
                  ],
                  [
                    "residual",
                    tr("Differenzstrom [A]", "Residual current [A]"),
                  ],
                ]
                  .map(
                    ([v, l]) =>
                      `<option value="${v}" ${this.draft.curveKind === v ? "selected" : ""}>${esc(l)}</option>`,
                  )
                  .join(
                    "",
                  )}</select></label><details><summary>${esc(tr("Hersteller-Kennlinienpunkte", "Manufacturer curve points"))}</summary><div data-curve-editor></div></details>`
              : ""
          }`
        : ""
    }</fieldset>`;
    const curveEl = this.el.querySelector<HTMLElement>("[data-curve-editor]");
    this.curveEditor = curveEl
      ? new ProtectionCurveEditor(curveEl, this.draft.curve)
      : undefined;
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
