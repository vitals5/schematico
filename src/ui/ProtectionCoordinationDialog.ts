import type { Project } from "../model/types";
import type { CircuitDimensioning } from "../model/ElectricalDimensioning";
import {
  protectionCoordination,
  protectionSamplesAt,
} from "../model/ProtectionCoordination";
import { drawingToSvg, escapeSvg as esc } from "../model/ImportedDrawing";
import {
  protectionCoordinationDrawing,
  protectionNumber,
  protectionColors,
} from "./ProtectionCoordinationDrawing";
import {
  protectionReportRows,
  protectionReportColumns,
  protectionRoleLabel,
} from "../reports/ProtectionCoordinationReport";
import { engineeringReportCsv } from "../reports/EngineeringCalculations";
import { protectionCoordinationPdf } from "../export/ProtectionCoordinationPdf";
import { downloadArticleFile } from "./ArticleCatalogDialog";
import { bindArticleModalKeys } from "./ArticleModal";
import { tr } from "../i18n";
import "./ProtectionCoordination.css";
export class ProtectionCoordinationDialog {
  private el = document.createElement("div");
  private data: ReturnType<typeof protectionCoordination>;
  private current?: number;
  private zoom = 1;
  private restore = document.activeElement as HTMLElement | null;
  constructor(
    private project: Project,
    record: CircuitDimensioning,
    private choose: (role: "protection" | "upstream") => void,
    draft = false,
  ) {
    this.data = protectionCoordination(record, project);
    this.data.inputState = draft ? "draft" : "saved";
  }
  show() {
    if (document.getElementById("protectionCoordinationDialog")) return;
    this.el.id = "protectionCoordinationDialog";
    this.el.className = "protection-coordination modal-backdrop";
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => this.close());
    this.el.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="protectionCoordinationTitle"><header><div><small>${esc(this.data.name)} · ${esc(this.data.inputState === "draft" ? tr("Vorschau · nicht gespeicherte Eingaben", "Preview · unsaved inputs") : tr("Gespeicherte Eingaben", "Saved inputs"))}</small><h2 id="protectionCoordinationTitle">${esc(tr("Schutzkoordination · Überstrom", "Protection coordination · overcurrent"))}</h2></div><button type="button" class="btn" data-protection-close aria-label="${esc(tr("Schließen", "Close"))}">✕</button></header><div class="pc-body"><main><div class="pc-legend">${(
      ["protection", "upstream"] as const
    )
      .map((role) => {
        const c = this.data.curves.find((c) => c.role === role);
        return `<div style="--curve-color:${protectionColors[role]}"><strong>${esc(protectionRoleLabel(role))}</strong><span>${esc(c?.label ?? tr("Keine verwendbare Überstromkennlinie", "No usable overcurrent curve"))}</span><button type="button" class="btn" data-protection-choose="${role}">${esc(tr("Artikel / Kennwerte auswählen", "Select part / ratings"))}</button></div>`;
      })
      .join(
        "",
      )}</div><p>${esc(tr("Beide Grenzen sind Herstellerstützpunkte: durchgezogen bzw. lang gestrichelt = maximale Zeit, kurz gepunktet = minimale Zeit. Verbindungslinien dienen nur dem Ablesen.", "Both limits are manufacturer points: solid or long-dashed = maximum time, short-dotted = minimum time. Connecting lines are visual aids only."))}</p><div class="pc-tools"><span>${esc(tr("Diagrammansicht", "Chart view"))}</span><button type="button" class="btn" data-protection-zoom="out" aria-label="${esc(tr("Verkleinern", "Zoom out"))}">−</button><span data-protection-zoom-level>100 %</span><button type="button" class="btn" data-protection-zoom="in" aria-label="${esc(tr("Vergrößern", "Zoom in"))}">+</button><button type="button" class="btn" data-protection-zoom="fit">${esc(tr("Ganzes Diagramm", "Fit chart"))}</button></div><div class="pc-chart" data-protection-chart></div><label class="pc-current">${esc(tr("Stromwert ansehen", "Inspect current value"))}<select class="form-input" data-protection-current><option value="">${esc(tr("Stromwert wählen", "Choose current"))}</option>${[
      ...new Set([
        ...this.data.sampleCurrents,
        ...this.data.markers
          .filter((m) => m.axis === "current")
          .map((m) => m.value),
      ]),
    ]
      .sort((a, b) => a - b)
      .map((i) => `<option value="${i}">${protectionNumber(i)} A</option>`)
      .join(
        "",
      )}</select></label><div class="pc-readout" data-protection-readout aria-live="polite"></div><p class="pc-scope">${esc(tr("Kein rechnerisches Interpolieren oder Extrapolieren. Die Grafik erzeugt keinen Abschalt-, Selektivitäts- oder Backup-Nachweis.", "No numerical interpolation or extrapolation. The chart does not establish disconnection, selectivity or backup protection."))}</p></main><aside><h3>${esc(tr("Quellen und Bedingungen", "Sources and conditions"))}</h3>${this.data.curves.map((c) => `<article><strong style="color:${protectionColors[c.role]}">${esc(protectionRoleLabel(c.role))}</strong><p>${esc(c.label)}</p><p>${c.points.length} ${esc(tr("Herstellerstützpunkte", "manufacturer points"))}</p><p>${esc(c.source)}</p><p>${esc(c.conditions)}</p></article>`).join("")}${this.data.markers.length ? `<h3>${esc(tr("Markierungen aus der Berechnung", "Calculation markers"))}</h3>${this.data.markers.map((m) => `<article><strong>${esc(m.label)}</strong><p>${protectionNumber(m.value)} ${m.axis === "current" ? "A" : "s"}</p><small>${esc(m.source)}</small></article>`).join("")}` : ""}${this.data.selectivity ? `<h3>${esc(tr("Eingegebener Paarbeleg", "Entered pair proof"))}</h3><article><p>${esc(this.data.selectivity.upstream)} → ${esc(this.data.selectivity.downstream)}</p><p>${protectionNumber(this.data.selectivity.limitA)} A</p><p>${esc(this.data.selectivity.source)}</p></article>` : ""}${this.data.issues.length ? `<h3>${esc(tr("Zu klären", "Needs review"))}</h3>${this.data.issues.map((m) => `<p class="pc-issue">${esc(m)}</p>`).join("")}` : ""}</aside></div><p class="pc-error" role="alert"></p><footer><span>${esc(tr("Ansicht verändert weder Projekt noch elektrische Nachweise. PDF enthält Diagramm, Quellen und alle dargestellten Herstellerstützpunkte.", "Viewing does not change the project or electrical evidence. PDF includes the chart, sources and all displayed manufacturer points."))}</span><button type="button" class="btn" data-protection-json>JSON</button><button type="button" class="btn" data-protection-csv>CSV</button><button type="button" class="btn btn-primary" data-protection-pdf>PDF</button><button type="button" class="btn" data-protection-close>${esc(tr("Schließen", "Close"))}</button></footer></section>`;
    this.el
      .querySelectorAll("[data-protection-close]")
      .forEach((b) => b.addEventListener("click", () => this.close()));
    this.el
      .querySelectorAll<HTMLButtonElement>("[data-protection-choose]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            this.close();
            this.choose(
              b.dataset.protectionChoose as "protection" | "upstream",
            );
          }),
      );
    this.el
      .querySelectorAll<HTMLButtonElement>("[data-protection-zoom]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            const action = b.dataset.protectionZoom;
            this.zoom =
              action === "fit"
                ? 1
                : Math.max(
                    1,
                    Math.min(3, this.zoom + (action === "in" ? 0.5 : -0.5)),
                  );
            this.draw();
          }),
      );
    this.el.querySelector<HTMLSelectElement>(
      "[data-protection-current]",
    )!.onchange = (e) => {
      const value = (e.target as HTMLSelectElement).value;
      this.current = value ? Number(value) : undefined;
      this.draw();
    };
    const safe = (fn: () => void) => {
      try {
        fn();
        this.el.querySelector("[role=alert]")!.textContent = "";
      } catch (e) {
        this.el.querySelector("[role=alert]")!.textContent =
          e instanceof Error ? e.message : String(e);
      }
    };
    this.el
      .querySelector("[data-protection-json]")!
      .addEventListener("click", () =>
        safe(() =>
          downloadArticleFile(
            JSON.stringify(this.data, null, 2),
            "schematico-schutzkoordination.json",
            "application/json",
          ),
        ),
      );
    this.el
      .querySelector("[data-protection-csv]")!
      .addEventListener("click", () =>
        safe(() =>
          downloadArticleFile(
            engineeringReportCsv(
              protectionReportColumns(),
              protectionReportRows(this.data),
            ),
            "schematico-schutzkoordination.csv",
            "text/csv;charset=utf-8",
          ),
        ),
      );
    this.el
      .querySelector("[data-protection-pdf]")!
      .addEventListener("click", () =>
        safe(() =>
          protectionCoordinationPdf(this.data, this.project).save(
            "schematico-schutzkoordination.pdf",
          ),
        ),
      );
    this.draw();
    this.el.querySelector<HTMLElement>("[data-protection-close]")?.focus();
  }
  private close() {
    this.el.remove();
    if (this.restore?.isConnected) this.restore.focus();
  }
  private draw() {
    const target = this.el.querySelector("[data-protection-chart]")!;
    target.classList.toggle("is-zoomed", this.zoom > 1);
    this.el.querySelector("[data-protection-zoom-level]")!.textContent =
      String(this.zoom * 100) + " %";
    if (!this.data.curves.length)
      target.innerHTML = `<div class="pc-empty">${esc(tr("Zuerst Schutzgeräte mit ausdrücklich zugeordneten Überstromstützpunkten auswählen. Kennlinienpunkte und Kennlinienart lassen sich im Artikelkatalog bearbeiten.", "Select protective devices with explicitly classified overcurrent points first. Edit curve points and curve type in the parts catalogue."))}</div>`;
    else {
      const drawing = protectionCoordinationDrawing(this.data, 900, 560);
      target.innerHTML = `<svg style="width:${100 * this.zoom}%;max-width:none" viewBox="0 0 900 560" role="img" aria-label="${esc(tr("Logarithmischer Zeit-Strom-Vergleich dokumentierter Herstellerpunkte", "Logarithmic time-current comparison of documented manufacturer points"))}">${drawingToSvg(drawing.graphics)}<line data-protection-cursor x1="${this.current ? drawing.x(this.current) : 0}" x2="${this.current ? drawing.x(this.current) : 0}" y1="${drawing.area.top}" y2="${drawing.area.bottom}" stroke="#283c56" stroke-width="1.5" stroke-dasharray="2,3" style="display:${this.current ? "" : "none"}"/>${drawing.points.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="12" fill="transparent" data-protection-point="${p.currentA}" aria-label="${esc(protectionRoleLabel(p.role) + " " + protectionNumber(p.currentA) + " A")}"><title>${esc(protectionRoleLabel(p.role) + " " + protectionNumber(p.currentA) + " A")}</title></circle>`).join("")}</svg>`;
      target
        .querySelectorAll<SVGElement>("[data-protection-point]")
        .forEach((p) => {
          const inspect = () => {
            this.current = Number(p.dataset.protectionPoint);
            this.el.querySelector<HTMLSelectElement>(
              "[data-protection-current]",
            )!.value = String(this.current);
            const cursor = target.querySelector("[data-protection-cursor]")!;
            cursor.setAttribute("x1", String(drawing.x(this.current)));
            cursor.setAttribute("x2", String(drawing.x(this.current)));
            cursor.setAttribute("style", "");
            this.readout();
          };
          p.addEventListener("pointerenter", inspect);
          p.addEventListener("click", inspect);
          p.addEventListener("focus", inspect);
          p.addEventListener("keydown", (e) => {
            if (
              (e as KeyboardEvent).key === "Enter" ||
              (e as KeyboardEvent).key === " "
            ) {
              e.preventDefault();
              inspect();
            }
          });
        });
    }
    this.readout();
  }
  private readout() {
    this.el.querySelector("[data-protection-readout]")!.innerHTML =
      this.current === undefined
        ? `<p>${esc(tr("Stützpunkt im Diagramm oder in der Liste wählen. Es werden nur exakt hinterlegte Werte angezeigt.", "Choose a point in the chart or list. Only exact recorded values are displayed."))}</p>`
        : protectionSamplesAt(this.data, this.current)
            .map(
              (r) =>
                `<article><strong>${esc(protectionRoleLabel(r.role))}</strong><p>${protectionNumber(this.current!)} A</p><span>${r.point ? protectionNumber(r.point.timeMinS) + " .. " + protectionNumber(r.point.timeMaxS) + " s" : esc(tr("Kein Herstellerstützpunkt bei diesem Strom.", "No manufacturer point at this current."))}</span></article>`,
            )
            .join("");
  }
}
