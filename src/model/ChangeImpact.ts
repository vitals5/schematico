import type { Project, PlacedComponent, Wire, CableDefinition } from "./types";
import type { AssignedArticle, ComponentAddress } from "./ArticleTypes";
import type {
  CircuitDimensioning,
  DimensioningReference,
} from "./ElectricalDimensioning";
import {
  calculateDimensioning,
  withDimensioning,
} from "./ElectricalDimensioning";
import {
  compareProjectRevisions,
  stableProjectJson,
  type RevisionChange,
  type SavedProjectRevision,
} from "./ProjectRevisions";
import { projectRevision } from "../layout/types";
import { sha256 } from "./SourceIdentity";
import { DeviceRegistry, addressKey } from "./DeviceRegistry";
import {
  effectiveArticles,
  invalidArticleAssignment,
} from "./ArticleAssignments";
import {
  circuitArticleKey,
  catalogCircuitArticle,
  type CircuitArticleRole,
} from "./DimensioningArticles";
import {
  assessCircuitArticle,
  selectCircuitArticle,
  circuitRoleLabel,
} from "./CircuitArticleSelection";
import { getSymbolForComponent } from "./symbols";
import { isInterruptionSymbol } from "./ConnectionSymbols";
import { ProjectIndex } from "./ProjectIndex";
import { ElectricalNetService } from "./ElectricalNetService";
import { PartsListGenerator } from "../reports/PartsList";
import {
  manufacturingRows,
  reportKinds,
} from "../reports/ManufacturingReports";
import { tr } from "../i18n";
import {uniqueCable,type CableAddress} from "./CableArticles";

export type ImpactStatus = "open" | "in_progress" | "reviewed";
export interface ImpactDecision {
  baselineDigest: string;
  key: string;
  fingerprint: string;
  status: ImpactStatus;
  author: string;
  reason: string;
  at: string;
}
export interface ChangeImpactReview {
  schemaVersion: 1;
  decisions: ImpactDecision[];
}
export type ImpactCheck =
  | "voltage_drop"
  | "ampacity"
  | "fault"
  | "thermal"
  | "coordination"
  | "connections";
export interface ImpactCause {
  change: RevisionChange;
  electrical: boolean;
  reason: string;
}
export interface ImpactRow {
  key: string;
  kind: "circuit" | "unassigned" | "documents";
  label: string;
  circuitId?: string;
  cable?: CableAddress;
  addresses: ComponentAddress[];
  causes: ImpactCause[];
  checks: ImpactCheck[];
  documents: string[];
  fingerprint: string;
  decision?: ImpactDecision;
}
export interface ImpactProposal {
  id: string;
  circuitId: string;
  kind: "article" | "wire";
  role?: CircuitArticleRole;
  article?: AssignedArticle;
  device?: ComponentAddress;
  values?: { lengthMm?: number; crossSection?: string };
  label: string;
  note: string;
}
export interface ChangeImpactReport {
  schemaVersion: 1;
  baseline: Pick<
    SavedProjectRevision,
    "id" | "name" | "digest" | "status" | "created"
  >;
  projectId: string;
  sourceRevision: string;
  workingDigest: string;
  generatedAt: string;
  workingChanged: boolean;
  rows: ImpactRow[];
  proposals: ImpactProposal[];
  diagnostics: string[];
}
const same = (a: unknown, b: unknown) =>
  stableProjectJson(a ?? null) === stableProjectJson(b ?? null);
const digest = (v: unknown) =>
  sha256(new TextEncoder().encode(stableProjectJson(v)));
const roles: CircuitArticleRole[] = ["cable", "protection", "load", "upstream"];
const allChecks: ImpactCheck[] = [
  "voltage_drop",
  "ampacity",
  "fault",
  "thermal",
  "coordination",
  "connections",
];
export const impactCheckLabel = (c: ImpactCheck) =>
  ({
    voltage_drop: tr("Spannungsfall", "Voltage drop"),
    ampacity: tr(
      "Strombelastbarkeit / Überlastschutz",
      "Ampacity / overload protection",
    ),
    fault: tr("Kurzschluss / Abschaltung", "Short circuit / disconnection"),
    thermal: tr("Thermischer Nachweis", "Thermal verification"),
    coordination: tr(
      "Selektivität / Schutzkoordination",
      "Selectivity / protection coordination",
    ),
    connections: tr("Elektrische Verbindungen", "Electrical connections"),
  })[c];
export const impactStatusLabel = (s: ImpactStatus) =>
  ({
    open: tr("Offen", "Open"),
    in_progress: tr("In Bearbeitung", "In progress"),
    reviewed: tr("Nachgeprüft", "Reviewed"),
  })[s];

function clean(project: Project): Project {
  // Worklist decisions are evidence, not causes of a new engineering change.
  const p = { ...project };
  delete p.changeImpactReview;
  return p;
}
function mainArticle(
  p: Project,
  a: ComponentAddress,
  registry = new DeviceRegistry(p),
) {
  const ownerAddress = registry.forComponent(a)?.main ?? a;
  const owner = registry.placement(ownerAddress);
  if (!owner) return;
  const articles = effectiveArticles(owner.component, p);
  const mains = articles.filter((a) => a.role === "main");
  const article = mains.length === 1 ? mains[0] : undefined;
  return article ? { article, device: ownerAddress } : undefined;
}
/** Quantity, descriptions and placement are not electrical part identity. */
function partSignature(a?: AssignedArticle) {
  return a
    ? {
        key: circuitArticleKey(a),
        electrical: a.snapshot?.electrical,
        functions: a.snapshot?.functions,
      }
    : null;
}
function componentSignature(
  p: Project,
  c?: PlacedComponent,
  registry = new DeviceRegistry(p),
) {
  if (!c) return null;
  const s = getSymbolForComponent(c, p);
  return {
    symbol: c.symbolId,
    pins: Object.fromEntries(
      Object.entries(c.pins).map(([id, pin]) => [
        id,
        {
          requirement: pin.connectionRequirement,
          potential: pin.potentialConstraint,
        },
      ]),
    ),
    definition: s && {
      function: s.functionDefinition,
      electrical: s.electrical,
      pins: s.pins.map((pin) => ({
        id: pin.id,
        name: pin.name,
        role: pin.electricalRole,
        potential: pin.potentialConstraint,
        requirement: pin.connectionRequirement,
      })),
    },
    terminal: c.terminal,
    type: c.articleFunctionType,
    functionId: c.articleFunctionId,
    scope: [c.higherLevelFunction, c.mountingLocation],
    invalidArticles: invalidArticleAssignment(c)
      ? c.articleAssignment
      : undefined,
    part: partSignature(
      mainArticle(
        p,
        {
          pageId: p.pages.find((page) => page.components.includes(c))!.id,
          componentId: c.id,
        },
        registry,
      )?.article,
    ),
  };
}
function recordSignature(r?: CircuitDimensioning) {
  if (!r) return null;
  const { name, articles, ...rest } = r;
  return {
    ...rest,
    articles:
      articles &&
      Object.fromEntries(
        roles.map((role) => [
          role,
          articles[role] && {
            part: partSignature(articles[role]!.article),
            device: articles[role]!.device,
            cable: articles[role]!.cable,
            source: articles[role]!.source,
            parameters: articles[role]!.parameters,
          },
        ]),
      ),
  };
}
function wireSignature(w?: Wire) {
  return w
    ? {
        from: w.from,
        to: w.to,
        potential: w.potential,
        crossSection: w.crossSection,
        lengthMm: w.lengthMm,
        bridge: w.terminalBridge,
        color: w.color,
      }
    : null;
}
function cableSignature(c?: CableDefinition) {
  return (
    c && {
      type: c.cableType,
      part: partSignature(c.article),
      lengthM: c.lengthM,
      crossSection: c.crossSection,
      coreCount: c.coreCount,
      cores: c.cores.map((core) => ({
        id: core.id,
        color: core.color,
        crossSection: core.crossSection,
        reserve: core.reserve,
        designation: core.designation,
        wireIds: core.wireIds,
        hints: core.connectionHints,
      })),
    }
  );
}
export function impactReferenceWire(
  p: Project,
  r: DimensioningReference,
): Wire | undefined {
  for (const endpoint of [r.from, r.to]) {
    const matches = p.pages.flatMap((page) =>
      page.components.filter((c) => c.id === endpoint.componentId),
    );
    if (matches.length !== 1 || !matches[0].pins[endpoint.pinId]) return;
  }
  const pages = p.pages.filter((page) => page.id === r.pageId);
  const wires = (
    r.logical
      ? (p.logicalConnections ?? [])
      : pages.length === 1
        ? pages[0].wires
        : []
  ).filter((w) => w.id === r.wireId);
  return wires.length === 1 &&
    same(wires[0].from, r.from) &&
    same(wires[0].to, r.to)
    ? wires[0]
    : undefined;
}
const sectionValue = (value?: string) => {
  const match = value?.trim().match(/^(\d+(?:[.,]\d+)?)\s*(?:mm[²2])?$/i);
  const n = match ? Number(match[1].replace(",", ".")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
function dependencies(
  p: Project,
  record: CircuitDimensioning,
  registry = new DeviceRegistry(p),
): ComponentAddress[] {
  const addresses = roles.flatMap((role) =>
    record.articles?.[role]?.device ? [record.articles[role]!.device!] : [],
  );
  if (record.reference)
    for (const endpoint of [record.reference.from, record.reference.to]) {
      const matches = p.pages.flatMap((page) =>
        page.components
          .filter((c) => c.id === endpoint.componentId)
          .map((c) => ({ pageId: page.id, componentId: c.id })),
      );
      if (matches.length === 1) addresses.push(matches[0]);
    }
  for (const a of [...addresses])
    addresses.push(...(registry.forComponent(a)?.members ?? []));
  return [...new Map(addresses.map((a) => [addressKey(a), a])).values()];
}
function conductorDependencies(p: Project, diagnostics?: string[]) {
  const index = new ProjectIndex(p),
    nets = new ElectricalNetService(index);
  if (
    diagnostics &&
    (nets.issues.length ||
      index.identityIssues.some((i) => i.code === "duplicate_component_id"))
  )
    diagnostics.push(
      tr(
        "Netzzuordnung enthält ungültige Anschlüsse oder mehrdeutige Kennungen. Elektrische Prüfung zusätzlich ausführen.",
        "Net mapping contains invalid endpoints or ambiguous IDs. Run electrical inspection as well.",
      ),
    );
  const wireMembers = new Map<string, Set<string>>();
  for (const net of nets.nets) {
    const members = new Set(
      net.ports.map((pin) =>
        addressKey({
          pageId: pin.owner.page.id,
          componentId: pin.owner.component.id,
        }),
      ),
    );
    for (const c of net.connections)
      wireMembers.set(
        JSON.stringify([c.logical ? null : c.page?.id, c.wire.id]),
        members,
      );
  }
  return wireMembers;
}
function electricalChange(
  before: Project,
  after: Project,
  change: RevisionChange,
  registries: DeviceRegistry[],
): boolean {
  if (change.kind === "component") {
    const a = before.pages
      .find((p) => p.id === change.pageId)
      ?.components.find((c) => c.id === change.id);
    const b = after.pages
      .find((p) => p.id === change.pageId)
      ?.components.find((c) => c.id === change.id);
    // Renaming an interruption point changes actual cross-page connectivity.
    const refChanged = (p: Project, c?: PlacedComponent) =>
      c &&
      getSymbolForComponent(c, p) &&
      isInterruptionSymbol(getSymbolForComponent(c, p)!)
        ? [c.bmk, c.functionText]
        : null;
    return (
      !same(
        componentSignature(before, a, registries[0]),
        componentSignature(after, b, registries[1]),
      ) || !same(refChanged(before, a), refChanged(after, b))
    );
  }
  if (change.kind === "wire" || change.kind === "logicalConnections") {
    const find = (p: Project) =>
      (change.kind === "logicalConnections"
        ? p.logicalConnections
        : p.pages.find((page) => page.id === change.pageId)?.wires
      )?.find((w) => w.id === change.id);
    return !same(wireSignature(find(before)), wireSignature(find(after)));
  }
  if (change.kind === "dimensioning")
    return !same(
      recordSignature(before.dimensioning?.find((r) => r.id === change.id)),
      recordSignature(after.dimensioning?.find((r) => r.id === change.id)),
    );
  if (change.kind === "cable")
    return !same(
      cableSignature(
        before.pages
          .find((p) => p.id === change.pageId)
          ?.cables?.find((c) => c.id === change.id),
      ),
      cableSignature(
        after.pages
          .find((p) => p.id === change.pageId)
          ?.cables?.find((c) => c.id === change.id),
      ),
    );
  if (change.kind === "symbolLibrary") {
    const sig = (p: Project) => {
      const s = p.symbolLibrary?.find((s) => s.id === change.id);
      return (
        s && {
          function: s.functionDefinition,
          electrical: s.electrical,
          pins: s.pins,
        }
      );
    };
    return !same(sig(before), sig(after));
  }
  if (change.kind === "page")
    return change.fields.some((f) =>
      /^(higherLevel|location)(\.|$)/.test(f.path),
    );
  if (change.kind === "project")
    return change.fields.some((f) =>
      /^(potentialDefinitions|terminalStrips|connector|automation|importedArticleLibrary)/.test(
        f.path,
      ),
    );
  return ![
    "text",
    "image",
    "group",
    "box",
    "cabinetLayouts",
    "manufacturingReportTemplates",
  ].includes(change.kind);
}

function checksFor(
  causes: ImpactCause[],
  before: Project,
  after: Project,
  registries: DeviceRegistry[],
  a?: CircuitDimensioning,
  b?: CircuitDimensioning,
): ImpactCheck[] {
  const checks = new Set<ImpactCheck>();
  const add = (...values: ImpactCheck[]) =>
    values.forEach((v) => checks.add(v));
  for (const { change: c } of causes) {
    if (c.kind === "symbolLibrary") {
      const definition = (p: Project) => {
        const s = p.symbolLibrary?.find((s) => s.id === c.id);
        return (
          s && {
            function: s.functionDefinition,
            electrical: s.electrical,
            pins: s.pins.map((pin) => ({
              id: pin.id,
              name: pin.name,
              role: pin.electricalRole,
              potential: pin.potentialConstraint,
              requirement: pin.connectionRequirement,
            })),
          }
        );
      };
      if (same(definition(before), definition(after))) {
        add("connections");
        continue;
      }
    }
    if (c.kind === "component") {
      const address = { pageId: c.pageId!, componentId: c.id };
      const related = roles.filter((role) =>
        [a, b].some(
          (r) =>
            r?.articles?.[role]?.device &&
            addressKey(r.articles[role]!.device!) === addressKey(address),
        ),
      );
      if (related.length) {
        for (const role of related)
          if (role === "load") add("voltage_drop", "ampacity");
          else if (role === "upstream") add("fault", "thermal", "coordination");
          else if (role === "protection")
            add("ampacity", "fault", "thermal", "coordination");
          else add("voltage_drop", "ampacity", "fault", "thermal");
        // Part changes have role-specific scope; symbol/terminal topology also requires full review.
        const placement = (p: Project) =>
          p.pages
            .find((page) => page.id === c.pageId)
            ?.components.find((entry) => entry.id === c.id);
        const old = componentSignature(
            before,
            placement(before),
            registries[0],
          ),
          current = componentSignature(after, placement(after), registries[1]);
        add("connections");
        if (same({ ...old, part: undefined }, { ...current, part: undefined }))
          continue;
      }
      add(...allChecks);
    } else if (c.kind === "dimensioning" && c.status === "changed") {
      for (const f of c.fields) {
        const path = f.path;
        if (/^(name)$/.test(path)) continue;
        if (
          /^(articles\.upstream|upstreamDevice|selectivity|verifySelectivity)/.test(
            path,
          )
        )
          add("coordination");
        else if (
          /^(articles\.protection|protect|conventional|trip|threshold|breaking)/.test(
            path,
          )
        )
          add("ampacity", "fault", "thermal", "coordination");
        else if (
          /^(fault|loop|voltageFactor|phaseEarth|requiredDisconnect|verifyFault)/.test(
            path,
          )
        )
          add("fault", "thermal", "coordination");
        else if (/^(energy|letThrough|adiabatic|verifyAdiabatic)/.test(path))
          add("thermal");
        else if (
          /^(verifyAmpacity|ampacity|temperatureFactor|groupingFactor|otherFactor)/.test(
            path,
          )
        )
          add("ampacity");
        else if (
          /^(currentA|outputPowerW|efficiency|cosPhi|loadMode|maxDropPercent)/.test(
            path,
          )
        )
          add("voltage_drop", "ampacity");
        else add(...allChecks);
      }
    } else if (
      (c.kind === "wire" || c.kind === "logicalConnections") &&
      c.status === "changed" &&
      c.fields.every((f) => f.path === "color")
    )
      add("connections");
    else if (
      (c.kind === "wire" || c.kind === "logicalConnections") &&
      c.status === "changed" &&
      c.fields.every((f) => f.path === "lengthMm")
    )
      add("voltage_drop", "fault", "thermal");
    else add(...allChecks);
  }
  return allChecks.filter((c) => checks.has(c));
}

/** Explicit analysis only: no observer, catalogue network requests, or modification of the project. */
export async function analyzeChangeImpact(
  before: Project,
  after: Project,
  baseline: SavedProjectRevision,
): Promise<ChangeImpactReport> {
  const comparison = compareProjectRevisions(clean(before), clean(after));
  const report: ChangeImpactReport = {
    schemaVersion: 1,
    baseline: {
      id: baseline.id,
      name: baseline.name,
      digest: baseline.digest,
      status: baseline.status,
      created: baseline.created,
    },
    projectId: after.id,
    sourceRevision: projectRevision(after),
    workingDigest: await digest(
      clean({
        ...after,
        revisions: undefined,
        revisionOriginId: undefined,
        activePageId: "",
        modified: "",
      }),
    ),
    generatedAt: new Date().toISOString(),
    workingChanged: comparison.changes.length > 0,
    rows: [],
    proposals: [],
    diagnostics: [],
  };
  // The stale guard contains project bytes; keep them out of JSON exports and duplicate payloads.
  Object.defineProperty(report, "sourceRevision", {
    value: report.sourceRevision,
    enumerable: false,
  });
  const registries = [new DeviceRegistry(before), new DeviceRegistry(after)];
  const changes = comparison.changes.map((change) => ({
    change,
    electrical: electricalChange(before, after, change, registries),
    reason: change.fields.map((f) => f.path).join(", ") || change.status,
  }));
  // Shared imported master data can change a device without changing its placement record.
  const placements = [before, after].map(
    (p) =>
      new Map(
        p.pages.flatMap((page) =>
          page.components.map(
            (c) =>
              [
                addressKey({ pageId: page.id, componentId: c.id }),
                { page, c },
              ] as const,
          ),
        ),
      ),
  );
  for (const key of new Set([
    ...placements[0].keys(),
    ...placements[1].keys(),
  ])) {
    const a = placements[0].get(key),
      b = placements[1].get(key),
      entry = b ?? a!;
    if (
      changes.some(
        (c) =>
          c.change.kind === "component" &&
          c.change.id === entry.c.id &&
          c.change.pageId === entry.page.id,
      )
    )
      continue;
    const previous = componentSignature(before, a?.c, registries[0]),
      current = componentSignature(after, b?.c, registries[1]);
    if (same(previous, current)) continue;
    const partOnly = same(
      { ...previous, part: undefined },
      { ...current, part: undefined },
    );
    changes.push({
      change: {
        key: JSON.stringify(["component", entry.page.id, entry.c.id]),
        kind: "component",
        id: entry.c.id,
        pageId: entry.page.id,
        pageNumber: entry.page.pageNumber,
        label: entry.c.bmk || entry.c.id,
        status: "changed",
        fields: [
          {
            path: partOnly ? "articleAssignment.effective" : "electrical",
            before: previous,
            after: current,
          },
        ],
      },
      electrical: true,
      reason: tr(
        "Wirksame elektrische Stammdaten geändert",
        "Effective electrical master data changed",
      ),
    });
  }
  const beforeNets = conductorDependencies(before),
    afterNets = conductorDependencies(after, report.diagnostics);
  const used = new Set<ImpactCause>();
  const recordIds = new Set(
    [...(before.dimensioning ?? []), ...(after.dimensioning ?? [])].map(
      (r) => r.id,
    ),
  );
  for (const id of recordIds) {
    const a = before.dimensioning?.find((r) => r.id === id),
      b = after.dimensioning?.find((r) => r.id === id);
    const addresses = [
      ...new Map(
        [
          ...(a ? dependencies(before, a, registries[0]) : []),
          ...(b ? dependencies(after, b, registries[1]) : []),
        ].map((a) => [addressKey(a), a]),
      ).values(),
    ];
    const keys = new Set(addresses.map(addressKey));
    const causes = changes.filter((c) => {
      if (!c.electrical) return false;
      const d = c.change;
      if (d.kind === "dimensioning") return d.id === id;
      if (d.kind === "component")
        return keys.has(addressKey({ pageId: d.pageId!, componentId: d.id }));
      if (d.kind === "wire" || d.kind === "logicalConnections") {
        const key = JSON.stringify([
          d.kind === "logicalConnections" ? null : d.pageId,
          d.id,
        ]);
        return (
          [beforeNets, afterNets].some((nets) =>
            [...(nets.get(key) ?? [])].some((k) => keys.has(k)),
          ) ||
          [a, b].some(
            (r) =>
              r?.reference?.wireId === d.id &&
              (r.reference.logical
                ? d.kind === "logicalConnections"
                : r.reference.pageId === d.pageId),
          )
        );
      }
      if (d.kind === "cable")
        return [a,b].some(r=>r?.articles?.cable?.cable?.pageId===d.pageId&&r?.articles?.cable?.cable?.cableId===d.id)||[before, after].some((p, i) => {
          const cable = p.pages
            .find((page) => page.id === d.pageId)
            ?.cables?.find((c) => c.id === d.id);
          return (
            cable?.cores.some((core) =>
              core.wireIds?.some((id) =>
                [d.pageId, null].some((pageId) =>
                  [
                    ...([beforeNets, afterNets][i].get(
                      JSON.stringify([pageId, id]),
                    ) ?? []),
                  ].some((k) => keys.has(k)),
                ),
              ),
            ) ?? false
          );
        });
      if (d.kind === "symbolLibrary")
        return [before, after].some((p) =>
          addresses.some((a) =>
            p.pages
              .find((page) => page.id === a.pageId)
              ?.components.some(
                (c) => c.id === a.componentId && c.symbolId === d.id,
              ),
          ),
        );
      // Global connectivity, scope and physical-device edits cannot be safely reduced to a BMK match.
      return (
        (d.kind === "project" &&
          d.fields.some((f) =>
            /^(physicalDevices|potentialDefinitions|terminalStrips|connector|settings|drawingUnitsPerMm)/.test(
              f.path,
            ),
          )) ||
        d.kind === "physicalDevices" ||
        (d.kind === "page" && addresses.some((a) => a.pageId === d.id))
      );
    });
    if (!causes.length) continue;
    causes.forEach((c) => used.add(c));
    report.rows.push({
      key: "circuit:" + id,
      kind: "circuit",
      circuitId: id,
      cable: b?.articles?.cable?.cable??a?.articles?.cable?.cable,
      label: b?.name ?? a?.name ?? id,
      addresses,
      causes,
      checks: checksFor(causes, before, after, registries, a, b),
      documents: [
        tr(
          "Dimensionierungsbericht / Kennlinien",
          "Dimensioning report / curves",
        ),
      ],
      fingerprint: "",
    });
  }
  for (const cause of changes.filter((c) => c.electrical && !used.has(c)))
    report.rows.push({
      key: "unassigned:" + cause.change.key,
      kind: "unassigned",
      cable: cause.change.kind==="cable"&&cause.change.pageId?{pageId:cause.change.pageId,cableId:cause.change.id}:undefined,
      label: cause.change.label,
      addresses:
        cause.change.kind === "component" && cause.change.pageId
          ? [{ pageId: cause.change.pageId, componentId: cause.change.id }]
          : [],
      causes: [cause],
      checks: ["connections"],
      documents: [],
      fingerprint: "",
    });
  const documents: string[] = [];
  if (changes.length)
    documents.push(
      tr("Stromlaufplan / Projektausgabe", "Schematic / project output"),
    );
  try {
    if (
      !same(
        PartsListGenerator.generatePartsList(before),
        PartsListGenerator.generatePartsList(after),
      )
    )
      documents.push(
        tr("Artikelstückliste / Bestellliste", "Parts list / order list"),
      );
    for (const kind of reportKinds)
      if (
        !same(manufacturingRows(before, kind), manufacturingRows(after, kind))
      )
        documents.push(
          {
            terminals: tr("Klemmenplan", "Terminal plan"),
            cables: tr("Kabelplan", "Cable schedule"),
            connectors: tr("Steckerplan", "Connector plan"),
            connections: tr("Verbindungsliste", "Connection list"),
          }[kind],
        );
  } catch (e) {
    report.diagnostics.push(
      tr(
        "Einige Fertigungsunterlagen konnten nicht verglichen werden: ",
        "Some manufacturing documents could not be compared: ",
      ) + String(e),
    );
  }
  if (documents.length)
    report.rows.push({
      key: "documents",
      kind: "documents",
      label: tr(
        "Unterlagen erneut prüfen und ausgeben",
        "Review and regenerate documents",
      ),
      addresses: [],
      causes: changes,
      checks: [],
      documents,
      fingerprint: "",
    });
  // Repeated analysis retains an acknowledgement only while its exact engineering causes are unchanged.
  await Promise.all(
    report.rows.map(async (row) => {
      row.fingerprint = await digest({
        key: row.key,
        causes: row.causes.map((c) => ({
          kind: c.change.kind,
          id: c.change.id,
          pageId: c.change.pageId,
          status: c.change.status,
          fields:
            row.kind === "circuit"
              ? electricalEvidence(before, after, c.change)
              : c.change.fields,
        })),
        dependencies:
          row.kind === "circuit"
            ? [before, after].map((p) => ({
                sourceCable: row.cable?cableSignature(uniqueCable(p,row.cable)):undefined,
                record: recordSignature(
                  p.dimensioning?.find((r) => r.id === row.circuitId),
                ),
                members: row.addresses.map((a) => {
                  const c = p.pages
                    .find((page) => page.id === a.pageId)
                    ?.components.find((c) => c.id === a.componentId);
                  const ref =
                    c &&
                    getSymbolForComponent(c, p) &&
                    isInterruptionSymbol(getSymbolForComponent(c, p)!)
                      ? [c.bmk, c.functionText]
                      : undefined;
                  return [
                    a,
                    componentSignature(p, c, registries[p === before ? 0 : 1]),
                    ref,
                  ];
                }),
              }))
            : undefined,
      });
      row.decision = validDecision(
        after.changeImpactReview,
        baseline.digest,
        row.key,
        row.fingerprint,
      );
    }),
  );
  for (const row of report.rows.filter((row) => row.kind === "circuit")) {
    const r = after.dimensioning?.find((r) => r.id === row.circuitId);
    if (!r) continue;
    for (const role of roles) {
      const selection = r.articles?.[role];
      if (!selection?.device) continue;
      const actual = mainArticle(after, selection.device, registries[1]);
      if (
        !actual ||
        same(partSignature(actual.article), partSignature(selection.article))
      )
        continue;
      const assessment = assessCircuitArticle(actual.article, role, r);
      if (assessment.status === "incompatible") {
        report.diagnostics.push(
          `${r.name} · ${role}: ${assessment.conflicts.join(" ")}`,
        );
        continue;
      }
      // Malformed profile stays a manual task; never trust unvalidated ratings.
      try {
        if (
          actual.article.snapshot?.electrical &&
          !catalogCircuitArticle(actual.article, role)
        )
          continue;
      } catch {
        report.diagnostics.push(
          `${r.name} · ${role}: ${tr("Kennwerte ungültig; manuell prüfen.", "Invalid ratings; review manually.")}`,
        );
        continue;
      }
      report.proposals.push({
        id: JSON.stringify([r.id, role]),
        circuitId: r.id,
        kind: "article",
        role,
        article: structuredClone(actual.article),
        device: actual.device,
        label: `${r.name} · ${circuitRoleLabel(role)}`,
        note: tr(
          "Aktuellen Hauptartikel und dokumentierte Kennwerte in die Berechnung übernehmen. Paarungsbelege werden bei Artikeländerung verworfen.",
          "Adopt current main part and documented ratings into the calculation. Part changes invalidate pairing evidence.",
        ),
      });
    }
    const w = r.reference && impactReferenceWire(after, r.reference);
    if (
      w &&
      r.reference?.importedValues &&
      !same(r.reference.importedValues, {
        lengthMm: w.lengthMm,
        crossSection: w.crossSection,
      })
    ) {
      const validLength =
        w.lengthMm !== undefined &&
        Number.isFinite(w.lengthMm) &&
        w.lengthMm >= 0;
      const validSection = sectionValue(w.crossSection) !== undefined;
      if (
        (w.lengthMm === undefined || validLength) &&
        (w.crossSection === undefined || validSection) &&
        (validLength || validSection)
      )
        report.proposals.push({
          id: JSON.stringify([r.id, "wire"]),
          circuitId: r.id,
          kind: "wire",
          values: { lengthMm: w.lengthMm, crossSection: w.crossSection },
          label: r.name,
          note: tr(
            "Nur bestätigen, wenn diese Verbindung die vollständige Leitungslänge des Stromkreises repräsentiert. Keine Länge aus der Zeichnung berechnet.",
            "Confirm only if this connection represents the full circuit conductor length. No length is inferred from drawing geometry.",
          ),
        });
    }
  }
  return report;
}
/** Fingerprints follow engineering data, not incidental geometry in a mixed diff. */
function electricalEvidence(
  before: Project,
  after: Project,
  change: RevisionChange,
): unknown {
  if (change.kind === "component") return undefined; // Captured in exact member dependencies.
  if (change.kind === "dimensioning")
    return [before, after].map((p) =>
      recordSignature(p.dimensioning?.find((r) => r.id === change.id)),
    );
  if (change.kind === "wire" || change.kind === "logicalConnections")
    return [before, after].map((p) =>
      wireSignature(
        (change.kind === "logicalConnections"
          ? p.logicalConnections
          : p.pages.find((page) => page.id === change.pageId)?.wires
        )?.find((w) => w.id === change.id),
      ),
    );
  if (change.kind === "cable")
    return [before, after].map((p) =>
      cableSignature(
        p.pages
          .find((page) => page.id === change.pageId)
          ?.cables?.find((c) => c.id === change.id),
      ),
    );
  if (change.kind === "project")
    return change.fields.filter((f) =>
      /^(potentialDefinitions|terminalStrips|connector|automation|importedArticleLibrary)/.test(
        f.path,
      ),
    );
  if (change.kind === "page")
    return change.fields.filter((f) =>
      /^(higherLevel|location)(\.|$)/.test(f.path),
    );
  if (change.kind === "symbolLibrary")
    return [before, after].map((p) => {
      const s = p.symbolLibrary?.find((s) => s.id === change.id);
      return (
        s && {
          function: s.functionDefinition,
          electrical: s.electrical,
          pins: s.pins.map((pin) => ({
            id: pin.id,
            name: pin.name,
            x: pin.x,
            y: pin.y,
            direction: pin.direction,
            role: pin.electricalRole,
            requirement: pin.connectionRequirement,
            potential: pin.potentialConstraint,
          })),
        }
      );
    });
  return change.fields;
}
function validDecision(
  review: ChangeImpactReview | undefined,
  baselineDigest: string,
  key: string,
  fingerprint: string,
) {
  if (review?.schemaVersion !== 1 || !Array.isArray(review.decisions)) return;
  return [...review.decisions]
    .reverse()
    .find(
      (d) =>
        d.baselineDigest === baselineDigest &&
        d.key === key &&
        d.fingerprint === fingerprint &&
        ["open", "in_progress", "reviewed"].includes(d.status) &&
        typeof d.author === "string" &&
        !!d.author.trim() &&
        d.author.length <= 120 &&
        typeof d.reason === "string" &&
        !!d.reason.trim() &&
        d.reason.length <= 2000 &&
        Number.isFinite(Date.parse(d.at)),
    );
}
export function assertImpactSource(
  project: Project,
  report: ChangeImpactReport,
) {
  if (
    project.id !== report.projectId ||
    projectRevision(project) !== report.sourceRevision
  )
    throw Error(
      tr(
        "Der Arbeitsstand hat sich geändert. Analyse neu berechnen.",
        "The working state has changed. Refresh the analysis.",
      ),
    );
}
export function reviewChangeImpacts(
  project: Project,
  report: ChangeImpactReport,
  keys: string[],
  status: ImpactStatus,
  author: string,
  reason: string,
): Project {
  assertImpactSource(project, report);
  if (
    !["open", "in_progress", "reviewed"].includes(status) ||
    !author.trim() ||
    !reason.trim() ||
    author.length > 120 ||
    reason.length > 2000
  )
    throw Error(
      tr(
        "Bearbeiter und Begründung erforderlich.",
        "Author and reason are required.",
      ),
    );
  if (!keys.length || keys.some((k) => !report.rows.some((r) => r.key === k)))
    throw Error(tr("Aufgaben auswählen.", "Select tasks."));
  const next = structuredClone(project),
    decisions = (
      next.changeImpactReview?.schemaVersion === 1 &&
      Array.isArray(next.changeImpactReview.decisions)
        ? next.changeImpactReview.decisions
        : []
    ).filter(
      (d) =>
        !(d.baselineDigest === report.baseline.digest && keys.includes(d.key)),
    );
  for (const key of new Set(keys))
    decisions.push({
      baselineDigest: report.baseline.digest,
      key,
      fingerprint: report.rows.find((r) => r.key === key)!.fingerprint,
      status,
      author: author.trim(),
      reason: reason.trim(),
      at: new Date().toISOString(),
    });
  next.changeImpactReview = {
    schemaVersion: 1,
    decisions: decisions.slice(-10000),
  };
  return next;
}
/** Build the exact transaction for preview AND apply; multiple proposals compose on the latest record. */
export function applyImpactProposals(
  project: Project,
  report: ChangeImpactReport,
  ids: string[],
  confirmFullLength = false,
): Project {
  assertImpactSource(project, report);
  if (
    !ids.length ||
    ids.some((id) => !report.proposals.some((p) => p.id === id))
  )
    throw Error(tr("Korrekturen auswählen.", "Select corrections."));
  let next = structuredClone(project);
  for (const id of new Set(ids)) {
    const p = report.proposals.find((p) => p.id === id)!;
    let record = next.dimensioning?.find((r) => r.id === p.circuitId);
    if (!record)
      throw Error(
        tr("Stromkreis nicht mehr vorhanden.", "Circuit no longer exists."),
      );
    if (p.kind === "article") {
      const actual = p.device && mainArticle(next, p.device);
      if (!actual || !same(actual.article, p.article) || !p.role)
        throw Error(
          tr(
            "Artikelzuordnung ist nicht eindeutig.",
            "Part assignment is ambiguous.",
          ),
        );
      const profile = catalogCircuitArticle(actual.article, p.role);
      record = selectCircuitArticle(record, p.role, actual.article, !!profile);
      record.articles![p.role]!.device = structuredClone(actual.device);
    } else {
      if (!confirmFullLength)
        throw Error(
          tr(
            "Die vollständige Leitungslänge ausdrücklich bestätigen.",
            "Explicitly confirm the full conductor length.",
          ),
        );
      const w = record.reference && impactReferenceWire(next, record.reference);
      if (
        !w ||
        !same({ lengthMm: w.lengthMm, crossSection: w.crossSection }, p.values)
      )
        throw Error(
          tr(
            "Leitungsbezug wurde geändert.",
            "Conductor reference has changed.",
          ),
        );
      record = structuredClone(record);
      record.lengthM = w.lengthMm === undefined ? undefined : w.lengthMm / 1000;
      record.sectionMm2 = sectionValue(w.crossSection);
      record.reference!.importedValues = {
        lengthMm: w.lengthMm,
        crossSection: w.crossSection,
      };
      record.inputSource = tr(
        "Aus zugeordneter Verbindung übernommen; vollständige Länge bestätigt.",
        "Adopted from the bound connection; full length confirmed.",
      );
    }
    next = withDimensioning(next, record);
  }
  return next;
}
export function impactProposalPreview(
  project: Project,
  report: ChangeImpactReport,
  ids: string[],
  confirmFullLength = false,
) {
  const next = applyImpactProposals(project, report, ids, confirmFullLength);
  return [
    ...new Set(
      ids.map((id) => report.proposals.find((p) => p.id === id)!.circuitId),
    ),
  ].map((id) => {
    const before = project.dimensioning!.find((r) => r.id === id)!,
      after = next.dimensioning!.find((r) => r.id === id)!;
    return {
      id,
      name: after.name,
      before,
      after,
      result: calculateDimensioning(after, next),
    };
  });
}
