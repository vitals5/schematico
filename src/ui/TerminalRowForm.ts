import type { Project } from "../model/types";
import type { TerminalStripIdentity } from "../model/TerminalStripTypes";
import {
  TERMINAL_ROW_SYMBOL_IDS,
  nextTerminalRowTag,
  nextTerminalNumber,
} from "../model/TerminalRowCreation";
import { getSymbolById } from "../model/symbols";
import { escapeSvg as esc } from "../model/ImportedDrawing";
import { tr, getLocalizedSymbol } from "../i18n";
export interface TerminalRowFormState {
  mode: "new" | "append";
  identity: TerminalStripIdentity;
  symbolId: string;
  count: string;
  startNumber: string;
  pageId: string;
  empty: boolean;
}
export function defaultTerminalRowForm(
  p: Project,
  identity?: TerminalStripIdentity,
): TerminalRowFormState {
  const page = p.pages.find((page) => page.id === p.activePageId),
    plant = (page?.higherLevel ?? "").replace(/^=+/, ""),
    location = (page?.location ?? "").replace(/^\++/, "");
  return {
    mode: identity ? "append" : "new",
    identity: identity
      ? { ...identity }
      : { plant, location, strip: nextTerminalRowTag(p, plant, location) },
    symbolId: "terminal_single",
    count: identity ? "1" : "10",
    startNumber: String(identity ? nextTerminalNumber(p, identity) : 1),
    pageId: "",
    empty: false,
  };
}
export function terminalRowForm(p: Project, state: TerminalRowFormState) {
  const field = (
    key: string,
    label: string,
    value: string,
    type = "text",
    extra = "",
  ) =>
    `<label>${esc(label)}<input class="form-input" data-row-field="${key}" value="${esc(value)}" type="${type}" ${extra}></label>`;
  return `<div class="te-row-form"><span class="te-badge">${tr("1. Konfigurieren → 2. Prüfen → 3. Übernehmen", "1. Configure → 2. Review → 3. Apply")}</span><h2>${state.mode === "new" ? tr("Klemmenreihe anlegen", "Create terminal strip") : tr("Klemmen hinzufügen", "Add terminals") + " · " + esc(state.identity.strip)}</h2><p class="te-note">${tr("Legen Sie die Reihe hier an. Die Schaltzeichen werden automatisch aus der Bibliothek erzeugt und übersichtlich auf Planblättern platziert.", "Create the strip here. Library symbols are created and placed automatically on drawing sheets.")}</p>
 <section class="te-card"><h3>${tr("Welche Klemmenreihe?", "Which terminal strip?")}</h3>${field("strip", tr("Kennzeichen der Reihe", "Strip designation"), state.identity.strip, "text", state.mode === "append" ? "readonly" : 'maxlength="64"')}<small>${tr("Zum Beispiel -X1. Jede Reihe besitzt eigene Klemmennummern.", "For example -X1. Each strip has its own terminal numbers.")}</small><details><summary>${tr("Anlage und Einbauort", "Plant and location")}</summary><div class="te-fields">${field("plant", tr("Anlage", "Plant"), state.identity.plant, "text", state.mode === "append" ? "readonly" : 'maxlength="128"')}${field("location", tr("Einbauort", "Location"), state.identity.location, "text", state.mode === "append" ? "readonly" : 'maxlength="128"')}</div></details></section>
 ${state.mode === "new" ? `<label class="te-empty-option"><span><input type="checkbox" data-row-empty ${state.empty ? "checked" : ""}> ${tr("Zunächst nur eine leere Reihe anlegen", "Create an empty strip first")}</span><small>${tr("Klemmen können Sie später mit „Klemmen hinzufügen“ ergänzen.", "Add terminals later using “Add terminals”.")}</small></label>` : ""}
 <section class="te-card"><h3>${tr("Welche Klemmen?", "Which terminals?")}</h3><label>${tr("Klemmentyp", "Terminal type")}<select class="form-input" data-row-field="symbolId" ${state.empty ? "disabled" : ""}>${TERMINAL_ROW_SYMBOL_IDS.flatMap(
   (id) => {
     const s = getSymbolById(id, p);
     return s && !s.unresolved
       ? [
           `<option value="${esc(id)}" ${state.symbolId === id ? "selected" : ""}>${esc(getLocalizedSymbol(s).name)}</option>`,
         ]
       : [];
   },
 ).join(
   "",
 )}</select></label><div class="te-fields">${field("count", tr("Anzahl", "Quantity"), state.count, "number", `min="1" max="100" step="1" ${state.empty ? "disabled" : ""}`)}${field("startNumber", tr("Erste Klemmennummer", "First terminal number"), state.startNumber, "number", `min="1" max="999999" step="1" ${state.empty ? "disabled" : ""}`)}</div><p class="te-row-range" data-row-range></p></section>
 <section class="te-card"><h3>${tr("Wo werden die Schaltzeichen platziert?", "Where are symbols placed?")}</h3><label>${tr("Planblatt", "Drawing sheet")}<select class="form-input" data-row-field="pageId" ${state.empty ? "disabled" : ""}><option value="">${state.mode === "append" ? tr("Automatisch zur Reihe hinzufügen, bei Bedarf neue Blätter", "Add to the strip automatically, create sheets as needed") : tr("Neue Blätter automatisch anlegen", "Automatically create new sheets")}</option>${p.pages
   .filter((page) => page.pageType === "schematic" && !page.importedDrawing)
   .map(
     (page) =>
       `<option value="${esc(page.id)}" ${state.pageId === page.id ? "selected" : ""}>${esc(page.pageNumber + " · " + page.title)}</option>`,
   )
   .join(
     "",
   )}</select></label><p class="te-note">${tr("Neue Blätter werden bei Bedarf automatisch ergänzt. Bestehende Inhalte werden nicht verschoben. Die neuen Klemmen werden dabei nicht miteinander gebrückt.", "Additional new sheets are created as needed. Existing content stays in place. The new terminals are not bridged together.")}</p></section>
 <p class="te-note">${tr("Ihr Projekt ändert sich erst mit „Übernehmen“.", "Your project changes only when you choose Apply.")}</p></div>`;
}
export function readTerminalRowForm(
  root: HTMLElement,
  state: TerminalRowFormState,
) {
  const value = (name: string) =>
    root.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[data-row-field="${name}"]`,
    )!.value;
  state.identity = {
    strip: value("strip"),
    plant: value("plant"),
    location: value("location"),
  };
  state.count = value("count");
  state.startNumber = value("startNumber");
  state.symbolId = value("symbolId");
  state.pageId = value("pageId");
  state.empty =
    root.querySelector<HTMLInputElement>("[data-row-empty]")?.checked ?? false;
}
export function updateTerminalRowForm(
  root: HTMLElement,
  state: TerminalRowFormState,
) {
  for (const name of ["count", "startNumber", "symbolId", "pageId"])
    (
      root.querySelector(`[data-row-field="${name}"]`) as
        | HTMLInputElement
        | HTMLSelectElement
    ).disabled = state.empty;
  const n = Number(state.count),
    start = Number(state.startNumber);
  root.querySelector("[data-row-range]")!.textContent = state.empty
    ? tr(
        "Leere Reihe · noch keine Schaltzeichen",
        "Empty strip · no symbols yet",
      )
    : Number.isSafeInteger(n) &&
        n > 0 &&
        Number.isSafeInteger(start) &&
        start > 0
      ? `${n} × ${state.identity.strip}: ${start}${n > 1 ? " … " + (start + n - 1) : ""}`
      : tr(
          "Anzahl und erste Nummer eingeben.",
          "Enter quantity and first number.",
        );
}
