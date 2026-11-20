import {cablePartLabel} from "../model/CableArticles";
import type { Project } from "../model/types";
import { projectRevision } from "../layout/types";
import { TerminalDiagramGenerator } from "./TerminalDiagram";
import { cableSchedule } from "../model/WiringManagement";
import { connectorRows } from "../model/Connectors";
import { connectorColumns, connectorCells } from "./ConnectorPlan";
import {
  connectionList,
  connectionColumns,
  connectionCells,
} from "./ConnectionList";
export const reportKinds = [
  "terminals",
  "cables",
  "connectors",
  "connections",
] as const;
export type ReportKind = (typeof reportKinds)[number];
export interface ReportTemplate {
  id: string;
  kind: ReportKind;
  title: string;
  paper: "a3" | "a4";
  orientation: "landscape" | "portrait";
  fontSize: number;
  columns: { id: string; label: string; weight: number }[];
  sortBy: string;
  descending: boolean;
}
export interface ReportRow {
  key: string;
  cells: Record<string, string>;
  pages: string[];
  targets: { pageId: string; componentId: string; label: string }[];
}
const schemas: Record<ReportKind, { title: string; columns: string[] }> = {
  terminals: {
    title: "Klemmenplan",
    columns: [
      "Leiste",
      "Klemme / Ebene",
      "Innenziel",
      "Außenziel",
      "Funktionstext",
      "Farbe",
      "Querschnitt",
      "Blatt",
      "Position",
    ],
  },
  cables: {
    title: "Kabelplan",
    columns: [
      "Blatt",
      "Kabel",
      "Typ",
      "Ader",
      "Farbe",
      "Querschnitt",
      "Reserve",
      "Ziele",
      "Kabelartikel",
      "Reale Kabellänge [m]",
    ],
  },
  connectors: { title: "Steckerplan", columns: connectorColumns },
  connections: { title: "Verdrahtungsliste", columns: connectionColumns },
};
export function defaultReportTemplate(kind: ReportKind): ReportTemplate {
  return {
    id: "report-" + kind,
    kind,
    title: schemas[kind].title,
    paper: "a3",
    orientation: "landscape",
    fontSize: 8,
    columns: schemas[kind].columns.map((label, i) => ({
      id: "c" + i,
      label,
      weight:
        kind === "terminals"
          ? (({ c2: 2, c3: 2, c4: 3 } as Record<string, number>)["c" + i] ?? 1)
          : kind === "cables"
            ? i === 7
              ? 4
              : i === 2
                ? 2
                : 1
            : kind === "connectors"
              ? [5, 8, 9, 10].includes(i)
                ? 3
                : 1
              : [3, 4, 11].includes(i)
                ? 3
                : 1,
    })),
    sortBy: "",
    descending: false,
  };
}
export function validateReportTemplate(value: unknown): ReportTemplate {
  if (!value || typeof value !== "object") throw Error("reportInvalid");
  const v = value as ReportTemplate;
  if (
    !reportKinds.includes(v.kind) ||
    typeof v.id !== "string" ||
    !/^[-a-zA-Z0-9_]{1,100}$/.test(v.id) ||
    typeof v.title !== "string" ||
    !v.title.trim() ||
    v.title.length > 120 ||
    !["a3", "a4"].includes(v.paper) ||
    !["landscape", "portrait"].includes(v.orientation) ||
    !Number.isFinite(v.fontSize) ||
    v.fontSize < 6 ||
    v.fontSize > 12 ||
    !Array.isArray(v.columns) ||
    !v.columns.length ||
    v.columns.length > schemas[v.kind].columns.length ||
    typeof v.descending !== "boolean"
  )
    throw Error("reportInvalid");
  const allowed = new Set(
    defaultReportTemplate(v.kind).columns.map((c) => c.id),
  );
  if (
    v.columns.some(
      (c) =>
        !c ||
        !allowed.has(c.id) ||
        typeof c.label !== "string" ||
        !c.label.trim() ||
        c.label.length > 80 ||
        !Number.isFinite(c.weight) ||
        c.weight < 1 ||
        c.weight > 20,
    ) ||
    new Set(v.columns.map((c) => c.id)).size !== v.columns.length ||
    typeof v.sortBy !== "string" ||
    (v.sortBy !== "" && !allowed.has(v.sortBy))
  )
    throw Error("reportInvalid");
  if (reportKinds.some((k) => "report-" + k === v.id && k !== v.kind))
    throw Error("reportInvalid");
  return {
    id: v.id,
    kind: v.kind,
    title: v.title,
    paper: v.paper,
    orientation: v.orientation,
    fontSize: v.fontSize,
    columns: v.columns.map((c) => ({
      id: c.id,
      label: c.label,
      weight: c.weight,
    })),
    sortBy: v.sortBy,
    descending: v.descending,
  };
}
export function manufacturingTemplates(project: Project) {
  const defaults = reportKinds.map(defaultReportTemplate),
    stored = project.manufacturingReportTemplates ?? [],
    templates = new Map(defaults.map((t) => [t.id, t]));
  let invalid = 0;
  const ids = new Map<string, number>();
  for (const v of Array.isArray(stored) ? stored : [])
    if (v && typeof v.id === "string") ids.set(v.id, (ids.get(v.id) ?? 0) + 1);
  if (!Array.isArray(stored)) return { templates: defaults, invalid: 1 };
  for (const value of stored)
    try {
      const v = validateReportTemplate(value);
      if (ids.get(v.id) !== 1) throw Error("reportInvalid");
      templates.set(v.id, v);
    } catch {
      invalid++;
    }
  return { templates: [...templates.values()], invalid };
}
export class ReportTemplateEdit {
  readonly #base: string;
  readonly #template: ReportTemplate;
  constructor(
    project: Project,
    template: unknown,
    private remove = false,
  ) {
    this.#base = projectRevision(project);
    this.#template = validateReportTemplate(template);
  }
  apply(current: Project) {
    if (projectRevision(current) !== this.#base)
      throw Error("articlesProjectStale");
    const next = structuredClone(current);
    if (
      next.manufacturingReportTemplates !== undefined &&
      !Array.isArray(next.manufacturingReportTemplates)
    )
      throw Error("reportInvalid");
    next.manufacturingReportTemplates = [
      ...(next.manufacturingReportTemplates ?? []).filter(
        (t) => t?.id !== this.#template.id,
      ),
      ...(this.remove ? [] : [structuredClone(this.#template)]),
    ];
    next.modified = new Date().toISOString();
    return next;
  }
}
export function encodeReportTemplate(template: ReportTemplate) {
  return JSON.stringify(
    {
      schema: "schematico-report-template",
      version: 1,
      template: validateReportTemplate(template),
    },
    null,
    2,
  );
}
export function decodeReportTemplate(text: string) {
  if (text.length > 131072) throw Error("reportInvalid");
  try {
    const v = JSON.parse(text);
    if (v.schema !== "schematico-report-template" || v.version !== 1)
      throw Error();
    return validateReportTemplate(v.template);
  } catch {
    throw Error("reportInvalid");
  }
}
export function manufacturingRows(
  project: Project,
  kind: ReportKind,
): ReportRow[] {
  const pageCounts = new Map<string, number>();
  for (const page of project.pages)
    pageCounts.set(page.id, (pageCounts.get(page.id) ?? 0) + 1);
  const placements = new Map<
    string,
    { pageId: string; componentId: string; label: string }[]
  >();
  for (const p of project.pages)
    for (const c of p.components) {
      const key = c.id;
      placements.set(key, [
        ...(placements.get(key) ?? []),
        {
          pageId: p.id,
          componentId: c.id,
          label: p.pageNumber + " · " + (c.bmk || c.id),
        },
      ]);
    }
  const targets = (addresses: { pageId?: string; componentId?: string }[]) => [
    ...new Map(
      addresses
        .flatMap((a) => {
          const matches = placements.get(a.componentId ?? "");
          return matches?.length === 1 &&
            matches[0].pageId === a.pageId &&
            pageCounts.get(a.pageId ?? "") === 1
            ? [matches[0]]
            : [];
        })
        .map((a) => [JSON.stringify([a.pageId, a.componentId]), a]),
    ).values(),
  ];
  let sequence = 0;
  const row = (
    key: string,
    cells: (string | number | undefined)[],
    addresses: { pageId?: string; componentId?: string }[],
    pages: string[] = [],
  ): ReportRow => {
    const t = targets(addresses);
    return {
      key: JSON.stringify([kind, key, sequence++]),
      cells: Object.fromEntries(
        cells.map((v, i) => ["c" + i, v === undefined ? "" : String(v)]),
      ),
      targets: t,
      pages: [...new Set([...pages, ...t.map((a) => a.pageId)])],
    };
  };
  if (kind === "terminals")
    return [
      ...TerminalDiagramGenerator.generateTerminalReport(project),
    ].flatMap(([strip, entries]) =>
      entries.map((e, i) =>
        row(
          JSON.stringify(["terminal", strip, e.pageId, e.componentId, i]),
          [
            strip,
            e.terminalNumber,
            e.internalTarget,
            e.externalTarget,
            e.functionText,
            e.wireColor,
            e.crossSection,
            project.pages.find((p) => p.id === e.pageId)?.pageNumber,
            e.assemblyPosition,
          ],
          [{ pageId: e.pageId, componentId: e.componentId }],
          e.pageId ? [e.pageId] : [],
        ),
      ),
    );
  if (kind === "connectors")
    return connectorRows(project).map((r, i) =>
      row(
        JSON.stringify(["contact", r.connectorId, r.position, i]),
        connectorCells(r),
        r.binding ? [r.binding] : [],
      ),
    );
  if (kind === "connections")
    return connectionList(project).map((r) =>
      row(
        r.key,
        connectionCells(r),
        [
          { pageId: r.fromPageId, componentId: r.fromComponentId },
          { pageId: r.toPageId, componentId: r.toComponentId },
        ],
        r.pageId ? [r.pageId] : [],
      ),
    );
  const coreRows = cableSchedule(project).map((r) => {
    const cables =
        project.pages
          .find((p) => p.id === r.pageId)
          ?.cables?.filter((c) => c.id === r.cableId) ?? [],
      cable = cables.length === 1 ? cables[0] : undefined,
      cores = cable?.cores.filter((c) => c.id === r.coreId) ?? [],
      core = cores.length === 1 ? cores[0] : undefined,
      addresses = (core?.wireIds ?? []).flatMap((id) => {
        const matches =
          project.pages
            .find((p) => p.id === r.pageId)
            ?.wires.filter((w) => w.id === id) ?? [];
        if (matches.length === 1)
          return [matches[0].from, matches[0].to].map((ep) => ({
            pageId: r.pageId,
            componentId: ep.componentId,
          }));
        const logical =
          project.logicalConnections?.filter((w) => w.id === id) ?? [];
        return logical.length === 1
          ? [logical[0].from, logical[0].to].flatMap((ep) =>
              placements.get(ep.componentId)?.length === 1
                ? [placements.get(ep.componentId)![0]]
                : [],
            )
          : [];
      });
    return row(
      JSON.stringify(["core", r.pageId, r.cableId, r.coreId]),
      [
        r.pageNumber,
        r.bmk,
        r.type,
        r.designation,
        r.color,
        r.crossSection,
        r.reserve ? "Ja" : "",
        r.targets.join(" | "),
        r.article,
        r.lengthM,
      ],
      addresses,
      [r.pageId],
    );
  });
  return [
    ...coreRows,
    ...project.pages.flatMap((page) =>
      (page.cables ?? [])
        .filter((c) => !c.cores.length)
        .map((c) =>
          row(
            JSON.stringify(["cable", page.id, c.id]),
            [
              page.pageNumber,
              c.bmk,
              c.cableType,
              "",
              "",
              c.crossSection,
              "",
              "",
              cablePartLabel(c.article),
              c.lengthM,
            ],
            [],
            [page.id],
          ),
        ),
    ),
  ];
}
export function selectReportRows(
  rows: ReportRow[],
  template: ReportTemplate,
  search = "",
  pageId = "",
) {
  const words = search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean),
    selected = rows.filter(
      (r) =>
        (!pageId || r.pages.includes(pageId)) &&
        words.every((w) =>
          Object.values(r.cells).join(" ").toLocaleLowerCase().includes(w),
        ),
    );
  return template.sortBy
    ? selected
        .map((r, i) => ({ r, i }))
        .sort(
          (a, b) =>
            (a.r.cells[template.sortBy] ?? "").localeCompare(
              b.r.cells[template.sortBy] ?? "",
              undefined,
              { numeric: true },
            ) * (template.descending ? -1 : 1) || a.i - b.i,
        )
        .map((v) => v.r)
    : selected;
}
export function manufacturingCsv(rows: ReportRow[], template: ReportTemplate) {
  const q = (v: string) =>
    '"' +
    (/^(?:\s*[=+@-]|[\t\r\n])/.test(v) ? "'" : "") +
    v.replaceAll('"', '""') +
    '"';
  return (
    "\uFEFF" +
    [
      template.columns.map((c) => c.label),
      ...rows.map((r) => template.columns.map((c) => r.cells[c.id] ?? "")),
    ]
      .map((r) => r.map(q).join(";"))
      .join("\r\n")
  );
}
