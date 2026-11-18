import { jsPDF } from "jspdf";
import {
  validateReportTemplate,
  type ReportTemplate,
  type ReportRow,
} from "../reports/ManufacturingReports";
export interface ReportFragment {
  key: string;
  offset: number;
  y: number;
  height: number;
  cells: string[][];
}
export interface ReportLayout {
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  title: string[];
  caption: string[];
  columns: { id: string; x: number; width: number; lines: string[] }[];
  headingY: number;
  bodyY: number;
  pages: ReportFragment[][];
  rowCount: number;
}
/** A single measured layout drives both browser preview and PDF. Long rows continue on later sheets. */
export function layoutManufacturingReport(
  input: ReportTemplate,
  rows: ReportRow[],
  projectName: string,
): ReportLayout {
  return layoutPdfTable(validateReportTemplate(input), rows, projectName);
}
export type PdfTableTemplate = Pick<
  ReportTemplate,
  "title" | "paper" | "orientation" | "fontSize" | "columns"
>;
/** Common measured table layout, also used for the wider PLC/bus report. */
export function layoutPdfTable(
  template: PdfTableTemplate,
  rows: ReportRow[],
  projectName: string,
): ReportLayout {
  if (
    !template.title?.trim() ||
    template.title.length > 120 ||
    !["a3", "a4"].includes(template.paper) ||
    !["landscape", "portrait"].includes(template.orientation) ||
    !Number.isFinite(template.fontSize) ||
    template.fontSize < 6 ||
    template.fontSize > 12 ||
    !template.columns.length ||
    template.columns.length > 20 ||
    new Set(template.columns.map((c) => c.id)).size !==
      template.columns.length ||
    template.columns.some(
      (c) =>
        !c.label?.trim() ||
        c.label.length > 80 ||
        !Number.isFinite(c.weight) ||
        c.weight < 1 ||
        c.weight > 20,
    )
  )
    throw Error("reportInvalid");
  const doc = new jsPDF({
      format: template.paper,
      orientation: template.orientation,
      unit: "mm",
    }),
    width = doc.internal.pageSize.getWidth(),
    height = doc.internal.pageSize.getHeight(),
    lineHeight = template.fontSize * 0.352778 * 1.25,
    space = width - 24,
    min = 12,
    remainder = space - template.columns.length * min,
    total = template.columns.reduce((n, c) => n + c.weight, 0);
  if (remainder < 0) throw Error("reportInvalid");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(template.fontSize + 4);
  const title = doc.splitTextToSize(template.title, space) as string[];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(template.fontSize);
  const caption = doc.splitTextToSize(
      projectName.slice(0, 240),
      space,
    ) as string[],
    headingY =
      14 +
      title.length * (template.fontSize + 4) * 0.352778 * 1.25 +
      caption.length * lineHeight +
      5;
  let x = 12;
  doc.setFont("helvetica", "bold");
  const columns = template.columns.map((c) => {
      const w = min + (remainder * c.weight) / total,
        v = {
          id: c.id,
          x,
          width: w,
          lines: doc.splitTextToSize(c.label, w - 3) as string[],
        };
      x += w;
      return v;
    }),
    bodyY =
      headingY +
      Math.max(...columns.map((c) => c.lines.length)) * lineHeight +
      4,
    bottom = height - 15;
  if (bodyY + lineHeight + 4 > bottom) throw Error("reportInvalid");
  const pages: ReportFragment[][] = [[]];
  let y = bodyY;
  doc.setFont("helvetica", "normal");
  for (const row of rows) {
    const cells = columns.map(
        (c) =>
          doc.splitTextToSize(row.cells[c.id] || "—", c.width - 3) as string[],
      ),
      count = Math.max(1, ...cells.map((c) => c.length));
    let offset = 0;
    while (offset < count) {
      if (y + lineHeight + 3 > bottom) {
        pages.push([]);
        y = bodyY;
      }
      const take = Math.min(
        count - offset,
        Math.floor((bottom - y - 3) / lineHeight),
      );
      if (take < 1) throw Error("reportInvalid");
      const h = take * lineHeight + 3;
      pages.at(-1)!.push({
        key: row.key,
        offset,
        y,
        height: h,
        cells: cells.map((c) => c.slice(offset, offset + take)),
      });
      y += h;
      offset += take;
    }
  }
  return {
    width,
    height,
    fontSize: template.fontSize,
    lineHeight,
    title,
    caption,
    columns,
    headingY,
    bodyY,
    pages,
    rowCount: rows.length,
  };
}
export function manufacturingReportPdf(layout: ReportLayout): jsPDF {
  const doc = new jsPDF({
    unit: "mm",
    format: [layout.width, layout.height],
    orientation: layout.width > layout.height ? "landscape" : "portrait",
  });
  appendManufacturingReportPdf(doc, layout, false);
  return doc;
}
/** Append vector pages without converting them to images or changing their measured layout. */
export function appendManufacturingReportPdf(
  doc: jsPDF,
  layout: ReportLayout,
  append = true,
  monochrome = false,
) {
  layout.pages.forEach((fragments, page) => {
    if (append || page)
      doc.addPage(
        [layout.width, layout.height],
        layout.width > layout.height ? "landscape" : "portrait",
      );
    doc.setTextColor(0);
    doc.setDrawColor(0);
    doc.setLineDashPattern([], 0);
    let y = 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(layout.fontSize + 4);
    for (const line of layout.title) {
      doc.text(line, 12, y);
      y += (layout.fontSize + 4) * 0.352778 * 1.25;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(layout.fontSize);
    for (const line of layout.caption) {
      doc.text(line, 12, y);
      y += layout.lineHeight;
    }
    doc.setFillColor(
      ...((monochrome ? [232, 232, 232] : [225, 234, 242]) as [
        number,
        number,
        number,
      ]),
    );
    doc.rect(
      12,
      layout.headingY - 3,
      layout.width - 24,
      layout.bodyY - layout.headingY + 3,
      "F",
    );
    doc.setFont("helvetica", "bold");
    for (const c of layout.columns)
      c.lines.forEach((line, i) =>
        doc.text(line, c.x + 1.5, layout.headingY + i * layout.lineHeight),
      );
    doc.setFont("helvetica", "normal");
    fragments.forEach((r, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(
          ...((monochrome ? [248, 248, 248] : [246, 248, 251]) as [
            number,
            number,
            number,
          ]),
        );
        doc.rect(12, r.y, layout.width - 24, r.height, "F");
      }
      r.cells.forEach((lines, c) =>
        lines.forEach((line, i) =>
          doc.text(
            line,
            layout.columns[c].x + 1.5,
            r.y + layout.lineHeight + i * layout.lineHeight,
          ),
        ),
      );
      doc.setDrawColor(
        ...((monochrome ? [200, 200, 200] : [190, 201, 211]) as [
          number,
          number,
          number,
        ]),
      );
      doc.setLineWidth(0.15);
      doc.line(12, r.y + r.height, layout.width - 12, r.y + r.height);
    });
    doc.setFontSize(7);
    doc.text(
      `${page + 1} / ${layout.pages.length} · ${layout.rowCount}`,
      layout.width - 12,
      layout.height - 7,
      { align: "right" },
    );
  });
  return doc;
}
