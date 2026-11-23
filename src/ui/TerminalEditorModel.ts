import { tr } from "../i18n";
import type { Project } from "../model/types";
import type { ComponentAddress } from "../model/ArticleTypes";
import { ProjectIndex, type IndexedComponent } from "../model/ProjectIndex";
import { isTerminalComponent } from "../model/ComponentSemantics";
import {
  terminalIdentity,
  terminalStripKey,
  terminalAddressKey,
  terminalStripBindings,
  type TerminalStripIdentity,
  type TerminalStripConfiguration,
  type TerminalStripPosition,
} from "../model/TerminalStripTypes";
import {
  terminalSettings,
  inspectWiring,
  type WiringFinding,
} from "../model/WiringManagement";
import { terminalLevelValues } from "../model/TerminalFunctions";
import {
  TerminalDiagramGenerator,
  type TerminalEntry,
} from "../reports/TerminalDiagram";
import { effectiveArticles } from "../model/ArticleAssignments";

export interface TerminalEditorRow {
  key: string;
  address: ComponentAddress;
  entry: IndexedComponent;
  position?: TerminalStripPosition;
  positionNumber?: number;
  stripKey: string;
  main: boolean;
  owner?: ComponentAddress;
  levelText: string;
  article: string;
  reports: TerminalEntry[];
  issues: WiringFinding[];
}
export interface TerminalEditorStrip {
  key: string;
  identity: TerminalStripIdentity;
  configuration?: TerminalStripConfiguration;
  rows: TerminalEditorRow[];
  issues: number;
}
export function terminalEditorSnapshot(project: Project) {
  const index = new ProjectIndex(project),
    bindings = terminalStripBindings(project),
    strips = new Map<string, TerminalEditorStrip>();
  const ensure = (identity: TerminalStripIdentity) => {
    const key = terminalStripKey(identity);
    let strip = strips.get(key);
    if (!strip) {
      strip = {
        key,
        identity,
        configuration: project.terminalStrips?.find(
          (s) => terminalStripKey(s) === key,
        ),
        rows: [],
        issues: 0,
      };
      strips.set(key, strip);
    }
    return strip;
  };
  for (const config of project.terminalStrips ?? []) ensure(config);
  const positionByMember = new Map<
    string,
    { position: TerminalStripPosition; number: number }
  >();
  for (const strip of project.terminalStrips ?? [])
    strip.positions.forEach((position, i) => {
      if (position.kind === "terminal")
        for (const a of position.members)
          positionByMember.set(terminalAddressKey(a), {
            position,
            number: i + 1,
          });
    });
  const reports = new Map<string, TerminalEntry[]>();
  for (const entries of TerminalDiagramGenerator.generateTerminalReport(
    project,
  ).values())
    for (const report of entries)
      for (const a of report.representations ?? [
        { pageId: report.pageId ?? "", componentId: report.componentId ?? "" },
      ]) {
        const key = terminalAddressKey(a);
        reports.set(key, [...(reports.get(key) ?? []), report]);
      }
  const issues = inspectWiring(project, index),
    byComponent = new Map<string, WiringFinding[]>();
  for (const issue of issues)
    if (issue.componentId) {
      const key = terminalAddressKey({
        pageId: issue.pageId,
        componentId: issue.componentId,
      });
      byComponent.set(key, [...(byComponent.get(key) ?? []), issue]);
    }
  for (const entry of index.components) {
    if (!isTerminalComponent(project, entry.component, entry.symbol)) continue;
    const address = { pageId: entry.page.id, componentId: entry.component.id },
      key = terminalAddressKey(address),
      strip = ensure(terminalIdentity(entry.page, entry.component)),
      device = index.devices.forComponent(address),
      owner = index.devices.owner(address),
      pos = positionByMember.get(key),
      levels = terminalLevelValues(entry.component, entry.symbol),
      settings = terminalSettings(entry.component);
    strip.rows.push({
      key,
      address,
      entry,
      stripKey: strip.key,
      position: pos?.position,
      positionNumber: pos?.number,
      main: !device || terminalAddressKey(device.main) === key,
      owner: device?.main,
      levelText:
        levels.length > 1
          ? levels.map((l) => l.designation).join(" / ")
          : settings.levelDesignation || settings.level || "—",
      article: owner
        ? effectiveArticles(owner.component, project)
            .map((a) => a.articleNumber)
            .join(", ")
        : "",
      reports: reports.get(key) ?? [],
      issues: byComponent.get(key) ?? [],
    });
  }
  const compare = new Intl.Collator("en", { numeric: true }).compare;
  for (const strip of strips.values()) {
    strip.rows.sort(
      (a, b) =>
        (a.positionNumber ?? Infinity) - (b.positionNumber ?? Infinity) ||
        compare(
          a.entry.component.terminal?.sortingKey ?? "",
          b.entry.component.terminal?.sortingKey ?? "",
        ) ||
        compare(
          terminalSettings(a.entry.component).number,
          terminalSettings(b.entry.component).number,
        ) ||
        compare(a.levelText, b.levelText),
    );
    strip.issues = strip.rows.reduce((sum, row) => sum + row.issues.length, 0);
  }
  return {
    index,
    bindings,
    strips: [...strips.values()].sort((a, b) => compare(a.key, b.key)),
    issues,
  };
}
export type TerminalEditorSnapshot = ReturnType<typeof terminalEditorSnapshot>;

/** Human-readable review rows; electrical/ownership validation remains in the
 * model plans. Bound rendering separately so large imported strips stay usable. */
export function terminalEditorChanges(
  before: TerminalEditorSnapshot,
  after: TerminalEditorSnapshot,
) {
  const collect = (s: TerminalEditorSnapshot) =>
      new Map(
        s.strips.flatMap((strip) =>
          strip.rows.map((row) => [row.entry.component.id, row] as const),
        ),
      ),
    a = collect(before),
    b = collect(after);
  const changes: { label: string; before: string; after: string }[] = [];
  const values = (r: TerminalEditorRow) => {
    const c = r.entry.component,
      v = terminalSettings(c);
    return [
      c.bmk,
      r.levelText,
      c.functionText,
      v.sortingKey ?? "",
      String(r.positionNumber ?? "—"),
      r.main ? tr("Haupt", "Main") : tr("Neben", "Secondary"),
      r.article,
      r.entry.page.pageNumber,
      Object.entries(v.levels ?? {})
        .map(
          ([id, l]) => id + ": " + l.designation + " " + (l.functionText ?? ""),
        )
        .join(" / "),
      Object.entries(v.pinSides)
        .map(
          ([id, side]) =>
            id +
            ": " +
            (side === "internal"
              ? tr("innen", "internal")
              : tr("außen", "external")),
        )
        .join(", "),
    ];
  };
  const labels = [
    tr("Bezeichnung", "Designation"),
    tr("Etage", "Level"),
    tr("Funktionstext", "Function text"),
    tr("Sortierkennung", "Sorting key"),
    tr("Geräteposition", "Device position"),
    tr("Haupt-/Nebenfunktion", "Main/secondary function"),
    tr("Artikel", "Parts"),
    tr("Blatt", "Sheet"),
    tr("Etagenbeschriftung", "Level labels"),
    tr("Anschlussseiten", "Connection sides"),
  ];
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const old = a.get(id),
      next = b.get(id);
    if (!old || !next) {
      changes.push({
        label: (next ?? old)!.entry.component.bmk,
        before: old ? values(old).slice(0, 2).join(" · ") : "—",
        after: next ? values(next).slice(0, 2).join(" · ") : "—",
      });
      continue;
    }
    const x = values(old),
      y = values(next);
    x.forEach((value, i) => {
      if (value !== y[i])
        changes.push({
          label: next.entry.component.bmk + " · " + labels[i],
          before: value || "—",
          after: y[i] || "—",
        });
    });
  }
  const links = (s: TerminalEditorSnapshot) =>
    new Map(
      (s.index.project.logicalConnections ?? [])
        .filter((w) => w.terminalBridge)
        .map((w) => {
          const endpoint = (ep: typeof w.from) => {
            const owners = s.index.componentsById.get(ep.componentId),
              e = owners?.length === 1 ? owners[0] : undefined;
            return (
              (e?.component.bmk ?? "?") +
              ":" +
              (e ? (s.index.pin(e, ep.pinId)?.label ?? ep.pinId) : ep.pinId)
            );
          };
          return [
            w.id,
            endpoint(w.from) +
              " → " +
              endpoint(w.to) +
              " · " +
              (w.terminalBridge === "plug"
                ? tr("Steckbrücke", "Plug bridge")
                : tr("Drahtbrücke", "Wire bridge")),
          ];
        }),
    );
  const x = links(before),
    y = links(after);
  for (const id of new Set([...x.keys(), ...y.keys()]))
    if (x.get(id) !== y.get(id))
      changes.push({
        label: tr("Brücke", "Bridge"),
        before: x.get(id) ?? "—",
        after: y.get(id) ?? "—",
      });
  const accessories = (s: TerminalEditorSnapshot) =>
    new Map(
      s.strips.flatMap((strip) =>
        (strip.configuration?.positions ?? []).flatMap((p, i) =>
          p.kind === "accessory"
            ? [
                [
                  p.id,
                  [
                    strip.identity.strip,
                    "#" + (i + 1),
                    p.description,
                    p.article.articleNumber,
                    String(p.article.quantity ?? "?"),
                  ].join(" · "),
                ],
              ]
            : [],
        ),
      ),
    );
  const c = accessories(before),
    d = accessories(after);
  for (const id of new Set([...c.keys(), ...d.keys()]))
    if (c.get(id) !== d.get(id))
      changes.push({
        label: tr("Zubehörposition", "Accessory position"),
        before: c.get(id) ?? "—",
        after: d.get(id) ?? "—",
      });
  return changes;
}
