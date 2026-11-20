import { jsPDF } from "jspdf";
import type { Project } from "../model/types";
import type { ProtectionCoordination } from "../model/ProtectionCoordination";
import {
  documentFrame,
  sheetArea,
  type SheetFrameData,
  type SheetNumbering,
} from "../model/DocumentSheet";
import { renderPdfSheetFrame } from "./PdfSheetFrame";
import { renderPdfGraphics } from "./PdfGraphics";
import {
  layoutPdfTable,
  appendManufacturingReportPdf,
} from "./ManufacturingReportPdf";
import {
  protectionCoordinationDrawing,
  protectionColors,
} from "../ui/ProtectionCoordinationDrawing";
import {
  protectionReportRows,
  protectionReportColumns,
  protectionRoleLabel,
} from "../reports/ProtectionCoordinationReport";
import { engineeringPdfRows } from "../reports/EngineeringCalculations";
import { tr as translate } from "../i18n";
export function renderProtectionCoordinationPdfPage(
  doc: jsPDF,
  data: ProtectionCoordination,
  frame: SheetFrameData | false,
  numbering: SheetNumbering = {},
  monochrome = false,
) {
  const tr = (de: string, en: string) => translate(de, en, data.language);
  const w = doc.internal.pageSize.getWidth(),
    h = doc.internal.pageSize.getHeight(),
    area = sheetArea(frame, w, h),
    title =
      tr(
        "Schutzkoordination · Überstrom",
        "Protection coordination · overcurrent",
      ) + (data.inputState === "draft" ? tr(" · Vorschau", " · Preview") : "");
  if (frame) renderPdfSheetFrame(doc, frame, title, numbering, monochrome);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text(title, area.left, area.top + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const name = doc.splitTextToSize(
    data.name.slice(0, 240),
    area.right - area.left,
  ) as string[];
  doc.text(name.slice(0, 2), area.left, area.top + 9);
  let top = area.top + 12 + Math.min(2, name.length) * 3;
  for (const c of data.curves) {
    const color = protectionColors[c.role];
    doc.setDrawColor(monochrome ? "#000000" : color);
    doc.setLineDashPattern(c.role === "upstream" ? [2, 1] : [], 0);
    doc.line(area.left, top, area.left + 8, top);
    doc.setDrawColor(0);
    doc.setLineDashPattern([], 0);
    const labels = doc.splitTextToSize(
      (protectionRoleLabel(c.role, data.language) + ": " + c.label).slice(
        0,
        240,
      ),
      area.right - area.left - 12,
    ) as string[];
    doc.text(labels.slice(0, 2), area.left + 11, top + 1);
    top += Math.max(1, Math.min(2, labels.length)) * 3.2 + 2;
  }
  if (data.markers.length) {
    doc.setFontSize(7);
    const markers = data.markers
      .map(
        (m) => m.label + ": " + m.value + (m.axis === "current" ? " A" : " s"),
      )
      .join(" | ");
    const lines = doc.splitTextToSize(
      markers,
      area.right - area.left,
    ) as string[];
    doc.text(lines.slice(0, 2), area.left, top + 2);
    top += Math.min(2, lines.length) * 3 + 3;
  }
  const drawing = protectionCoordinationDrawing(data),
    chartHeight = area.bottom - top - 13,
    scale = Math.min((area.right - area.left) / 900, chartHeight / 560);
  if (chartHeight < 15)
    throw Error(
      tr(
        "Zeichenbereich des Plankopfs ist für das Kennliniendiagramm zu klein.",
        "Title block leaves insufficient room for the curve chart.",
      ),
    );
  if (data.curves.length)
    renderPdfGraphics(
      doc,
      drawing.graphics,
      scale,
      scale,
      monochrome ? "monochrome" : "color",
      area.left / scale,
      top / scale,
    );
  else
    doc.text(
      tr(
        "Keine verwendbare Überstromkennlinie hinterlegt.",
        "No usable overcurrent curve recorded.",
      ),
      area.left,
      top + 8,
    );
  doc.setFontSize(6.5);
  doc.setTextColor(0);
  doc.setLineDashPattern([], 0);
  const notice = tr(
    "Linien verbinden Herstellerstützpunkte, ohne rechnerische Interpolation. Quellen, Stützpunkte und Hinweise stehen im Kennlinienbericht. Kein Selektivitätsnachweis aus der Grafik.",
    "Lines connect manufacturer points without numerical interpolation. Sources, points and notes are in the curve report. The chart does not establish selectivity.",
  );
  doc.text(
    (doc.splitTextToSize(notice, area.right - area.left) as string[]).slice(
      0,
      2,
    ),
    area.left,
    area.bottom - 5,
  );
}
export function protectionCoordinationPdf(
  data: ProtectionCoordination,
  project: Project,
  paper: "a3" | "a4" = "a3",
) {
  const tr = (de: string, en: string) => translate(de, en, data.language);
  const frame = documentFrame(project),
    columns = protectionReportColumns(data.language),
    rows = engineeringPdfRows(protectionReportRows(data)),
    layout = layoutPdfTable(
      {
        title: tr("Kennlinienbericht", "Curve report"),
        paper,
        orientation: "landscape",
        fontSize: 7,
        columns: columns.map((label, i) => ({
          id: "c" + i,
          label,
          weight: i === 3 ? 4 : 2,
        })),
      },
      rows,
      project.name,
      frame,
    );
  const doc = new jsPDF({
    unit: "mm",
    format: paper,
    orientation: "landscape",
  });
  renderProtectionCoordinationPdfPage(doc, data, frame, {
    ordinal: 1,
    total: 1 + layout.pages.length,
  });
  appendManufacturingReportPdf(doc, layout, true, false, {
    ordinal: 2,
    total: 1 + layout.pages.length,
  });
  return doc;
}
