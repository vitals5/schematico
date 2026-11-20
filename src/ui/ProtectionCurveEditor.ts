import { escapeSvg as esc } from "../model/ImportedDrawing";
import { tr } from "../i18n";
/** Table editing retains incomplete values until catalogue validation on Save. */
export class ProtectionCurveEditor {
  private rows: { currentA?: number; timeMinS?: number; timeMaxS?: number }[] =
    [];
  private raw = "";
  private mode: "table" | "json" = "table";
  constructor(
    private el: HTMLElement,
    value?: unknown,
  ) {
    if (
      Array.isArray(value) &&
      value.length <= 256 &&
      value.every(
        (r) =>
          r &&
          typeof r === "object" &&
          !Array.isArray(r) &&
          Object.keys(r).every((k) =>
            ["currentA", "timeMinS", "timeMaxS"].includes(k),
          ) &&
          Object.values(r).every(
            (v) =>
              v === undefined || (typeof v === "number" && Number.isFinite(v)),
          ),
      )
    )
      this.rows = structuredClone(value);
    else if (value !== undefined) {
      this.raw = typeof value === "string" ? value : JSON.stringify(value);
      this.mode = "json";
    }
    this.render();
  }
  private collect() {
    if (this.mode === "json") {
      this.raw =
        this.el.querySelector<HTMLTextAreaElement>("[data-curve-json]")!.value;
      return;
    }
    this.rows = [
      ...this.el.querySelectorAll<HTMLElement>("[data-curve-row]"),
    ].map((row) =>
      Object.fromEntries(
        [...row.querySelectorAll<HTMLInputElement>("[data-curve-field]")].map(
          (i) => [
            i.dataset.curveField!,
            i.value === "" ? undefined : i.valueAsNumber,
          ],
        ),
      ),
    );
  }
  value(): unknown {
    this.collect();
    if (this.mode === "json") {
      if (!this.raw.trim()) return;
      try {
        return JSON.parse(this.raw);
      } catch {
        return this.raw;
      }
    }
    if (!this.rows.some((r) => Object.values(r).some((v) => v !== undefined)))
      return;
    return structuredClone(this.rows);
  }
  private changed() {
    this.el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  private render() {
    this.el.innerHTML = `<p>${esc(tr("Herstellerwerte in Ampere und Sekunden erfassen. Mindestens zwei Punkte, Strom streng aufsteigend und 0 < minimale Zeit ≤ maximale Zeit. Keine automatisch angenommene B-/C-/D-Kennlinie.", "Enter manufacturer values in amperes and seconds. At least two points, strictly increasing current and 0 < minimum time ≤ maximum time. No assumed B/C/D characteristic."))}</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0"><button type="button" class="btn" data-curve-mode>${esc(this.mode === "table" ? tr("JSON bearbeiten", "Edit JSON") : tr("Tabelle bearbeiten", "Edit table"))}</button>${this.mode === "table" ? `<button type="button" class="btn" data-curve-add>${esc(tr("+ Stützpunkt", "+ Data point"))}</button><button type="button" class="btn" data-curve-sort>${esc(tr("Nach Strom sortieren", "Sort by current"))}</button>` : ""}</div>${this.mode === "json" ? `<textarea class="form-input" rows="7" maxlength="100000" data-curve-json>${esc(this.raw)}</textarea><p data-curve-error role="alert"></p>` : `<div style="overflow:auto"><table style="width:100%;font-size:12px"><thead><tr><th>${esc(tr("Strom [A]", "Current [A]"))}</th><th>${esc(tr("Min. Zeit [s]", "Min. time [s]"))}</th><th>${esc(tr("Max. Zeit [s]", "Max. time [s]"))}</th><th></th></tr></thead><tbody>${this.rows.map((row, i) => `<tr data-curve-row>${(["currentA", "timeMinS", "timeMaxS"] as const).map((k) => `<td><input class="form-input" type="number" min="0" step="any" aria-label="${esc(k === "currentA" ? tr("Strom [A]", "Current [A]") : k === "timeMinS" ? tr("Minimale Zeit [s]", "Minimum time [s]") : tr("Maximale Zeit [s]", "Maximum time [s]"))}" data-curve-field="${k}" value="${esc(String(row[k] ?? ""))}"></td>`).join("")}<td><button type="button" class="btn" data-curve-remove="${i}" aria-label="${esc(tr("Stützpunkt entfernen", "Remove data point"))}">✕</button></td></tr>`).join("")}</tbody></table></div>`}`;
    this.el
      .querySelector("[data-curve-mode]")!
      .addEventListener("click", () => {
        this.collect();
        if (this.mode === "table") {
          this.raw = this.rows.length ? JSON.stringify(this.rows, null, 2) : "";
          this.mode = "json";
        } else {
          try {
            const value = this.raw.trim() ? JSON.parse(this.raw) : [];
            if (
              !Array.isArray(value) ||
              value.length > 256 ||
              value.some(
                (r) =>
                  !r ||
                  typeof r !== "object" ||
                  Array.isArray(r) ||
                  Object.keys(r).some(
                    (k) => !["currentA", "timeMinS", "timeMaxS"].includes(k),
                  ) ||
                  Object.values(r).some(
                    (v) => typeof v !== "number" || !Number.isFinite(v),
                  ),
              )
            )
              throw Error();
            this.rows = value;
            this.mode = "table";
          } catch {
            this.el.querySelector("[data-curve-error]")!.textContent = tr(
              "Zuerst eine gültige JSON-Liste eingeben.",
              "Enter a valid JSON list first.",
            );
            return;
          }
        }
        this.render();
        this.changed();
      });
    this.el.querySelector("[data-curve-add]")?.addEventListener("click", () => {
      this.collect();
      if (this.rows.length >= 256) return;
      this.rows.push({});
      this.render();
      this.el
        .querySelector<HTMLInputElement>("[data-curve-row]:last-child input")
        ?.focus();
      this.changed();
    });
    this.el
      .querySelector("[data-curve-sort]")
      ?.addEventListener("click", () => {
        this.collect();
        this.rows.sort(
          (a, b) => (a.currentA ?? Infinity) - (b.currentA ?? Infinity),
        );
        this.render();
        this.changed();
      });
    this.el.querySelectorAll<HTMLButtonElement>("[data-curve-remove]").forEach(
      (b) =>
        (b.onclick = () => {
          this.collect();
          this.rows.splice(Number(b.dataset.curveRemove), 1);
          this.render();
          this.changed();
        }),
    );
  }
}
