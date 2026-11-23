import type { Project, Page, PlacedComponent } from "./types";
import type { ComponentAddress } from "./ArticleTypes";
import {
  getSymbolById,
  getSymbolForComponent,
  getDrawingUnitsPerMm,
} from "./symbols";
import { terminalLevels } from "./TerminalFunctions";
import {
  terminalIdentity,
  terminalStripKey,
  terminalStripBindings,
  type TerminalStripIdentity,
} from "./TerminalStripTypes";
import { TerminalStripEditPlan } from "./TerminalStrips";
import { isTerminalComponent } from "./ComponentSemantics";
import { terminalSettings } from "./WiringManagement";
import { projectRevision } from "../layout/types";
import {
  horizontalRowPitch,
  horizontalTerminalRow,
  terminalRowSymbolId,
  terminalRowPairKeys,
  sameTerminalRowPairs,
} from "./TerminalRowLayout";
import { gridForPage } from "./DrawingGrid";

/** Explicitly supported standard functions; source project masters with these
 * IDs are still resolved through the normal project library. */
export const TERMINAL_ROW_SYMBOL_IDS = [
  "terminal_single",
  "terminal_pe",
  "terminal_feed_3",
  "terminal_feed_4",
  "terminal_double",
  "terminal_triple",
  "terminal_installation_l_n_pe",
  "terminal_installation_l_l_pe",
  "terminal_installation_l_n_pe_disconnect",
  "catalog_disconnect_terminal_knife",
  "catalog_fused_terminal_ohne_led",
] as const;
export interface TerminalRowCreation {
  mode: "new" | "append";
  identity: TerminalStripIdentity;
  symbolId: string;
  count: number;
  startNumber: number;
  pageId?: string; // absent: automatically create the necessary schematic sheets
  title: string;
}
export function normaliseTerminalRowIdentity(
  identity: TerminalStripIdentity,
): TerminalStripIdentity {
  const strip = identity.strip.trim();
  return {
    plant: identity.plant.trim().replace(/^=+/, ""),
    location: identity.location.trim().replace(/^\++/, ""),
    strip: strip.startsWith("-") ? strip : "-" + strip,
  };
}
export function terminalRowIdentities(p: Project) {
  const identities = new Map(
    (p.terminalStrips ?? []).map((s) => [
      terminalStripKey(s),
      { plant: s.plant, location: s.location, strip: s.strip },
    ]),
  );
  for (const page of p.pages)
    for (const c of page.components)
      if (isTerminalComponent(p, c, getSymbolForComponent(c, p))) {
        const id = terminalIdentity(page, c);
        identities.set(terminalStripKey(id), id);
      }
  return [...identities.values()];
}
export function nextTerminalRowTag(p: Project, plant = "", location = "") {
  const used = new Set(
    terminalRowIdentities(p)
      .filter(
        (i) =>
          i.plant === plant.replace(/^=+/, "") &&
          i.location === location.replace(/^\++/, ""),
      )
      .map((i) => i.strip),
  );
  let n = 1;
  while (used.has("-X" + n)) n++;
  return "-X" + n;
}
export function nextTerminalNumber(
  p: Project,
  identity: TerminalStripIdentity,
) {
  let n = 0;
  for (const page of p.pages)
    for (const c of page.components)
      if (
        isTerminalComponent(p, c, getSymbolForComponent(c, p)) &&
        terminalStripKey(terminalIdentity(page, c)) ===
          terminalStripKey(identity)
      ) {
        const value = terminalSettings(c).number;
        if (/^\d+$/.test(value) && Number(value) < 999999)
          n = Math.max(n, Number(value));
      }
  return n + 1;
}

function newSheet(
  p: Project,
  identity: TerminalStripIdentity,
  title: string,
): Page {
  const u = getDrawingUnitsPerMm(p),
    source = p.pages.find((page) => page.pageType === "schematic"),
    used = new Set(p.pages.map((page) => page.pageNumber));
  let number = 1;
  while (used.has(String(number))) number++;
  const plotFrame = source
    ? structuredClone(source.plotFrame)
    : {
        type: "DIN_A3_LANDSCAPE" as const,
        width: 420 * u,
        height: 297 * u,
        columns: 10,
        rows: ["A", "B", "C", "D", "E", "F"],
        titleBlock: {
          projectTitle: p.name,
          commission: "",
          company: p.company,
          author: p.author,
          date: "",
          revision: "",
          sheetNumber: "",
          totalSheets: "",
        },
      };
  plotFrame.titleBlock = {
    ...plotFrame.titleBlock,
    sheetNumber: String(number),
    totalSheets: String(p.pages.length + 1),
  };
  return {
    id: "page_" + crypto.randomUUID(),
    pageNumber: String(number),
    pageType: "schematic",
    title,
    higherLevel: identity.plant ? "=" + identity.plant : "",
    location: identity.location ? "+" + identity.location : "",
    components: [],
    wires: [],
    grid: source
      ? structuredClone(gridForPage(source, 4 * u))
      : { spacing: 4 * u, origin: { x: 0, y: 0 } },
    plotFrame,
  };
}
/** Creates normal editable library elements and physical strip positions. The
 * operation is isolated and all-or-nothing, including automatic extra sheets.
 * Creation is not a request to bridge any of the new or existing terminals. */
export class TerminalRowCreationPlan {
  private base: string;
  private result: Project;
  readonly members: ComponentAddress[] = [];
  readonly newPageIds: string[] = [];
  readonly identity: TerminalStripIdentity;
  constructor(
    project: Project,
    readonly options: TerminalRowCreation,
  ) {
    this.base = projectRevision(project);
    const p = structuredClone(project),
      identity = (this.identity = normaliseTerminalRowIdentity(
        options.identity,
      )),
      scope = terminalStripKey(identity);
    if (
      !/^-X[\p{L}\p{N}_.-]*$/u.test(identity.strip) ||
      identity.strip.length > 64 ||
      identity.plant.length > 128 ||
      identity.location.length > 128 ||
      /[\r\n]/.test(identity.plant + identity.location)
    )
      throw new Error("terminalRowIdentityInvalid");
    if (
      !["new", "append"].includes(options.mode) ||
      !Number.isSafeInteger(options.count) ||
      options.count < 0 ||
      options.count > 100 ||
      (options.mode === "append" && options.count === 0) ||
      !Number.isSafeInteger(options.startNumber) ||
      options.startNumber < 1 ||
      options.startNumber > 999999 ||
      options.startNumber + options.count > 1000000
    )
      throw new Error("terminalRowCountInvalid");
    const exists = terminalRowIdentities(p).some(
      (i) => terminalStripKey(i) === scope,
    );
    if (options.mode === "new" && exists) throw new Error("terminalRowExists");
    if (options.mode === "append" && !exists)
      throw new Error("terminalStripScopeInvalid");
    const used = new Set(
      p.pages.flatMap((page) =>
        page.components
          .filter(
            (c) =>
              isTerminalComponent(p, c, getSymbolForComponent(c, p)) &&
              terminalStripKey(terminalIdentity(page, c)) === scope,
          )
          .map((c) => terminalSettings(c).number),
      ),
    );
    for (
      let n = options.startNumber;
      n < options.startNumber + options.count;
      n++
    )
      if (used.has(String(n))) throw new Error("terminalRowNumberUsed");
    const symbol = getSymbolById(terminalRowSymbolId(options.symbolId), p);
    if (
      !TERMINAL_ROW_SYMBOL_IDS.includes(
        options.symbolId as (typeof TERMINAL_ROW_SYMBOL_IDS)[number],
      ) ||
      !symbol ||
      symbol.unresolved ||
      !terminalLevels(symbol).length
    )
      throw new Error("terminalDistributionUnsupported");
    if (options.pageId) {
      const pages = p.pages.filter((page) => page.id === options.pageId);
      if (
        pages.length !== 1 ||
        pages[0].pageType !== "schematic" ||
        pages[0].importedDrawing
      )
        throw new Error("terminalRowPageInvalid");
    }
    const components: PlacedComponent[] = Array.from(
      { length: options.count },
      (_, i) => ({
        id: "terminal_" + crypto.randomUUID(),
        symbolId: symbol.id,
        bmk: identity.strip + ":" + (options.startNumber + i),
        functionText: "",
        x: 0,
        y: 0,
        rotation: 0,
        pins: {},
        higherLevelFunction: identity.plant ? "=" + identity.plant : "",
        mountingLocation: identity.location ? "+" + identity.location : "",
        terminal: {
          strip: identity.strip,
          number: String(options.startNumber + i),
          level: "",
          sortingKey: String(options.startNumber + i),
          pinSides: {},
        },
      }),
    );
    const pitch = horizontalRowPitch(components, p),
      originalPairs = new Map<string, Set<string>>();
    let page = options.pageId
      ? p.pages.find((page) => page.id === options.pageId)
      : options.mode === "append"
        ? [...p.pages]
            .reverse()
            .find(
              (page) =>
                page.pageType === "schematic" &&
                !page.importedDrawing &&
                page.components.some(
                  (c) =>
                    isTerminalComponent(p, c, getSymbolForComponent(c, p)) &&
                    terminalStripKey(terminalIdentity(page, c)) === scope,
                ),
            )
        : undefined;
    let run: ReturnType<typeof horizontalTerminalRow> | undefined;
    const prepare = (target: Page) => {
      originalPairs.set(target.id, terminalRowPairKeys(target, p));
      run = horizontalTerminalRow(target, p, identity, pitch);
    };
    if (page) prepare(page);
    for (const c of components) {
      let placed = false;
      for (let attempt = 0; attempt < 2 && !placed; attempt++) {
        if (!page) {
          page = newSheet(p, identity, options.title || identity.strip);
          p.pages.push(page);
          this.newPageIds.push(page.id);
          prepare(page);
        }
        placed = run!.place(c, symbol);
        if (placed) this.members.push({ pageId: page.id, componentId: c.id });
        else {
          if (options.pageId || !page.components.length)
            throw new Error("terminalRowCapacity");
          page = undefined;
        }
      }
      if (!placed) throw new Error("terminalRowCapacity");
    }
    for (const [pageId, before] of originalPairs)
      if (
        !sameTerminalRowPairs(
          before,
          terminalRowPairKeys(p.pages.find((page) => page.id === pageId)!, p),
        )
      )
        throw new Error("terminalDistributionTopology");
    let strip = p.terminalStrips?.find((s) => terminalStripKey(s) === scope);
    if (!strip) {
      if (components.length) {
        const configured = new TerminalStripEditPlan(p, {
          kind: "initialize",
          identity,
        }).apply(p);
        p.terminalStrips = configured.terminalStrips;
        if (configured.physicalDevices === undefined) delete p.physicalDevices;
        else p.physicalDevices = configured.physicalDevices;
        strip = p.terminalStrips!.find((s) => terminalStripKey(s) === scope)!;
      } else {
        strip = { ...identity, id: crypto.randomUUID(), positions: [] };
        (p.terminalStrips ??= []).push(strip);
      }
    } else
      for (const target of this.members)
        strip.positions.push({
          id: crypto.randomUUID(),
          kind: "terminal",
          members: [target],
        });
    if (terminalStripBindings(p).issues.some((i) => i.stripId === strip!.id))
      throw new Error("terminalStripRepairFirst");
    if (this.newPageIds.length)
      for (const page of p.pages)
        page.plotFrame.titleBlock.totalSheets = String(p.pages.length);
    this.result = p;
  }
  preview() {
    return structuredClone(this.result);
  }
  apply(project: Project) {
    if (projectRevision(project) !== this.base)
      throw new Error("articlesProjectStale");
    const p = structuredClone(this.result);
    p.activePageId = project.activePageId;
    p.modified = new Date().toISOString();
    return p;
  }
}
