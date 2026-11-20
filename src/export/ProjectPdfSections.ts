import {protectionCoordination,type ProtectionCoordination} from '../model/ProtectionCoordination';
import {protectionReportRows,protectionReportColumns} from '../reports/ProtectionCoordinationReport';
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
import { dimensioningReportRows, dimensioningColumns, revisionReportRows, revisionColumns, engineeringPdfRows } from '../reports/EngineeringCalculations';
import { savedRevisions } from '../model/ProjectRevisions';
import {
  layoutManufacturingReport,
  layoutPdfTable,
  type ReportLayout,
} from "./ManufacturingReportPdf";
export interface ProjectPdfChoice {
  id: string;
  kind: "cabinet" | "report" | "automation" | "dimensioning" | "protection" | "revisions" | "invalid";
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
      detail: `${t.paper.toUpperCase()} · landscape`,
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
  if (project.dimensioning !== undefined && (!Array.isArray(project.dimensioning) || project.dimensioning.length))
    choices.push({id:key('dimensioning','all'),kind:'dimensioning',title:project.language==='en'?'Electrical dimensioning':'Elektrische Dimensionierung',detail:'Spannungsfall · Leiter- und Schutzgerätekoordination'});
  if(Array.isArray(project.dimensioning))for(const r of project.dimensioning){
    if(r&&typeof r.id==='string'&&typeof r.name==='string'&&(['protection','upstream'] as const).some(role=>r.articles?.[role]?.article?.snapshot?.electrical?.curve?.length))choices.push({id:key('protection',r.id),kind:'protection',title:(project.language==='en'?'Protection coordination · ':'Schutzkoordination · ')+r.name,detail:project.language==='en'?'Overcurrent chart, sources and manufacturer points':'Überstromdiagramm, Quellen und Herstellerstützpunkte'});
  }
  try {
    const revisions = savedRevisions(project);
    if (revisions.length) choices.push({id:key('revisions','all'),kind:'revisions',title:project.language==='en'?'Project revisions and approvals':'Projektstände und Freigaben',detail:String(revisions.length)});
  } catch { choices.push({id:key('invalid','revisions'),kind:'invalid',title:'revisionInvalid',detail:'',problem:'revisionInvalid'}); }
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
  | {kind:"protection";id:string;title:string;pages:number;data:ProtectionCoordination;}
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
  // An explicit empty selection must not inspect or prepare any saved reports.
  if (Array.isArray(requested) && requested.length === 0) return [];
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
    } else if(choice.kind==='protection'){
      const record=project.dimensioning!.find(r=>key('protection',r.id)===choice.id)!;
      const data=protectionCoordination(record,project,project.language);data.inputState="saved";const rows=engineeringPdfRows(protectionReportRows(data)),columns=protectionReportColumns(data.language);
      result.push({kind:'protection',id:choice.id,title:choice.title,pages:1,data});
      const layout=layoutPdfTable({title:choice.title+' · '+(project.language==='en'?'Curve report':'Kennlinienbericht'),paper,orientation:'landscape',fontSize:7,columns:columns.map((label,i)=>({id:'c'+i,label,weight:i===3?4:2}))},rows,project.name,framed?documentFrame(project):false);
      result.push({kind:'report',id:choice.id+'-data',title:layout.title.join(' '),pages:layout.pages.length,layout,rows});
    } else if (choice.kind === 'dimensioning' || choice.kind === 'revisions') {
      const rows = engineeringPdfRows(choice.kind === 'dimensioning' ? dimensioningReportRows(project) : revisionReportRows(project));
      const columns = choice.kind === 'dimensioning' ? dimensioningColumns : revisionColumns;
      if (!rows.length) continue;
      const layout = layoutPdfTable({title:choice.title,paper,orientation:'landscape',fontSize:7,
        columns:columns.map((label,i)=>({id:'c'+i,label,weight:i===3?5:1}))},rows,project.name,framed?documentFrame(project):false);
      result.push({kind:'report',id:choice.id,title:choice.title,pages:layout.pages.length,layout,rows});
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
