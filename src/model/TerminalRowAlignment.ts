import type { Project } from "./types";
import type { TerminalStripIdentity } from "./TerminalStripTypes";
import { terminalIdentity, terminalStripKey } from "./TerminalStripTypes";
import { getSymbolForComponent } from "./symbols";
import { isTerminalComponent } from "./ComponentSemantics";
import { terminalSettings } from "./WiringManagement";
import { terminalDrawingGroup } from "./TerminalStrips";
import {
  horizontalRowPitch,
  horizontalTerminalRow,
  terminalRowSymbolId,
  terminalRowPairKeys,
  sameTerminalRowPairs,
} from "./TerminalRowLayout";
import { projectRevision } from "../layout/types";
import { sameConductorTopology } from "./ElectricalNetService";

/** Explicit repair for previously generated/unwired placements. Existing wires
 * and group-owned items are never silently rerouted or broken apart. */
export class TerminalRowAlignmentPlan {
  private base: string;
  private result: Project;
  constructor(
    project: Project,
    pageId: string,
    identity: TerminalStripIdentity,
  ) {
    this.base = projectRevision(project);
    const p = structuredClone(project),
      page = p.pages.find((page) => page.id === pageId),
      scope = terminalStripKey(identity);
    if (!page || page.pageType !== "schematic" || page.importedDrawing)
      throw new Error("terminalRowPageInvalid");
    const members = page.components.filter(
        (c) =>
          isTerminalComponent(p, c, getSymbolForComponent(c, p)) &&
          terminalStripKey(terminalIdentity(page, c)) === scope,
      ),
      ids = new Set(members.map((c) => c.id));
    if (!members.length) throw new Error("terminalStripMemberMissing");
    if (
      members.some(
        (c) =>
          c.rotation !== 0 ||
          (c.scale && c.scale !== 1) ||
          terminalDrawingGroup(p, { pageId, componentId: c.id }),
      ) ||
      [
        ...p.pages.flatMap((page) => page.wires),
        ...(p.logicalConnections ?? []),
      ].some((w) => ids.has(w.from.componentId) || ids.has(w.to.componentId))
    )
      throw new Error("terminalRowAlignmentConnected");
    const before = terminalRowPairKeys(page, p),
      strip = p.terminalStrips?.find((s) => terminalStripKey(s) === scope),
      order = new Map(
        strip?.positions.flatMap((pos, i) =>
          pos.kind === "terminal"
            ? pos.members.map((a) => [a.componentId, i] as const)
            : [],
        ) ?? [],
      ),
      collator = new Intl.Collator("en", { numeric: true });
    members.sort(
      (a, b) =>
        (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity) ||
        collator.compare(
          terminalSettings(a).number,
          terminalSettings(b).number,
        ),
    );
    for (const c of members) {
      c.terminal = terminalSettings(c);
      if (!c.importedSymbol && !c.source)
        c.symbolId = terminalRowSymbolId(c.symbolId);
    }
    page.components = page.components.filter((c) => !ids.has(c.id));
    const run = horizontalTerminalRow(
      page,
      p,
      identity,
      horizontalRowPitch(members, p),
    );
    for (const c of members) {
      const symbol = getSymbolForComponent(c, p);
      if (!symbol || !run.place(c, symbol))
        throw new Error("terminalRowCapacity");
    }
    if (
      !sameTerminalRowPairs(before, terminalRowPairKeys(page, p)) ||
      !sameConductorTopology(project, p)
    )
      throw new Error("terminalDistributionTopology");
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
