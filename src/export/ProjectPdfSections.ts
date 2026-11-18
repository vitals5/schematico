import { documentFrame } from "../model/DocumentSheet";
import type { Project } from "../model/types";
import {
  cabinetLayouts,
  cabinetCandidates,
  inspectCabinet,
  type CabinetLayout,
} from "../model/CabinetLayout";
import {
  manufacturingTemplates,
  manufacturingRows,
  selectReportRows,
  type ReportRow,
  type ReportKind,
} from "../reports/ManufacturingReports";
import { automationData } from "../model/Automation";
import { automationPlan, automationColumns } from "../reports/AutomationPlan";
import {
  layoutManufacturingReport,
  layoutPdfTable,
  type ReportLayout,
} from "./ManufacturingReportPdf";
export interface ProjectPdfChoice {
  id: string;
  kind: "cabinet" | "report" | "automation" | "invalid";
  title: string;
  detail: string;
  problem?: string;
}
const key = (kind: string, id: string) => JSON.stringify([kind, id]);
/** Cheap catalogue of saved sections: no net rebuild or report pagination while opening the dialog. */
export function projectPdfChoices(project: Project): ProjectPdfChoice[] {
  const boards = cabinetLayouts(project),
    reports = manufacturingTemplates(project),
    choices: ProjectPdfChoice[] = [];
  for (const l of boards)
    choices.push({
      id: key("cabinet", l.id),
      kind: "cabinet",
      title: l.name,
      detail: `${l.widthMm} × ${l.heightMm} mm · ${l.items.length}`,
      ...(boards.filter((b) => b.id === l.id).length > 1
        ? { problem: "cabinetInvalid" }
        : {}),
    });
  const raw = project.cabinetLayouts;
  const invalid =
    (Array.isArray(raw) ? raw.length : raw === undefined ? 0 : 1) -
    boards.length;
  if (invalid)
    choices.push({
      id: key("invalid", "cabinet"),
      kind: "invalid",
      title: "cabinetInvalid",
      detail: String(invalid),
      problem: "cabinetInvalid",
    });
  for (const t of reports.templates)
    choices.push({
      id: key("report", t.id),
      kind: "report",
      title: t.title,
      detail: `${t.paper.toUpperCase()} · ${t.orientation}`,
    });
  if (reports.invalid)
    choices.push({
      id: key("invalid", "report"),
      kind: "invalid",
      title: "reportInvalid",
      detail: String(reports.invalid),
      problem: "reportInvalid",
    });
  const d = automationData(project);
  if (Object.values(d).some((a) => Array.isArray(a) && a.length))
    choices.push({
      id: key("automation", "all"),
      kind: "automation",
      title:
        project.language === "en"
          ? "PLC, bus and building automation"
          : "SPS, Bus- und Gebäudeautomation",
      detail: "SPS · Bus · KNX · Loxone",
    });
  return choices;
}
export type ProjectPdfSection =
  | {
      kind: "cabinet";
      id: string;
      title: string;
      pages: number;
      board: CabinetLayout;
      labels: Map<string, string>;
    }
  | {
      kind: "report";
      id: string;
      title: string;
      pages: number;
      layout: ReportLayout;
      rows: ReportRow[];
    };
export function prepareProjectPdfSections(
  project: Project,
  requested?: readonly string[],
  paper: "a3" | "a4" = "a3",
  framed = true,
): ProjectPdfSection[] {
  const choices = projectPdfChoices(project);
  if (
    requested &&
    (!Array.isArray(requested) ||
      requested.length > 1000 ||
      requested.some((id) => !choices.some((c) => c.id === id)))
  )
    throw Error("pdfSectionInvalid");
  const selected = new Set(requested ?? choices.map((c) => c.id)),
    result: ProjectPdfSection[] = [],
    cache = new Map<ReportKind, ReportRow[]>();
  let candidates: ReturnType<typeof cabinetCandidates> | undefined;
  const templates = manufacturingTemplates(project).templates;
  for (const choice of choices) {
    if (!selected.has(choice.id)) continue;
    if (choice.problem) throw Error(choice.problem);
    if (choice.kind === "cabinet") {
      const l = cabinetLayouts(project).find(
        (l) => key("cabinet", l.id) === choice.id,
      )!;
      if (inspectCabinet(project, l).some((i) => i.severity === "error"))
        throw Error(`pdfCabinetInvalid:${l.name}`);
      candidates ??= cabinetCandidates(project);
      const labels = new Map(
        l.items.map((i) => [
          i.id,
          i.kind === "device"
            ? (candidates!.find(
                (c) =>
                  c.main.pageId === i.source?.pageId &&
                  c.main.componentId === i.source?.componentId,
              )?.designation ?? i.label)
            : i.label,
        ]),
      );
      result.push({
        kind: "cabinet",
        id: choice.id,
        title: l.name,
        pages: 1,
        board: l,
        labels,
      });
    } else if (choice.kind === "report") {
      const t = templates.find((t) => key("report", t.id) === choice.id)!;
      if (!cache.has(t.kind))
        cache.set(t.kind, manufacturingRows(project, t.kind));
      const rows = selectReportRows(cache.get(t.kind)!, t);
      if (!rows.length) continue;
      const layout = layoutManufacturingReport(
        t,
        rows,
        project.name,
        framed ? documentFrame(project) : false,
      );
      result.push({
        kind: "report",
        id: choice.id,
        title: t.title,
        pages: layout.pages.length,
        layout,
        rows,
      });
    } else if (choice.kind === "automation") {
      const rows: ReportRow[] = automationPlan(project).map((r, i) => {
        const page = project.pages.filter((p) => p.id === r.pageId),
          target =
            page.length === 1 &&
            page[0].components.filter((c) => c.id === r.componentId).length ===
              1
              ? {
                  pageId: page[0].id,
                  componentId: r.componentId!,
                  label: page[0].pageNumber,
                }
              : undefined;
        return {
          key: JSON.stringify([r.entity, r.id, i]),
          cells: Object.fromEntries(r.cells.map((v, j) => ["c" + j, v])),
          pages: target ? [target.pageId] : [],
          targets: target ? [target] : [],
        };
      });
      if (!rows.length) continue;
      const layout = layoutPdfTable(
        {
          title: choice.title,
          paper,
          orientation: "landscape",
          fontSize: 7,
          columns: automationColumns.map((label, i) => ({
            id: "c" + i,
            label,
            weight: [7, 9, 10, 11, 12].includes(i) ? 3 : 1,
          })),
        },
        rows,
        project.name,
        framed ? documentFrame(project) : false,
      );
      result.push({
        kind: "report",
        id: choice.id,
        title: choice.title,
        pages: layout.pages.length,
        layout,
        rows,
      });
    }
  }
  return result;
}
