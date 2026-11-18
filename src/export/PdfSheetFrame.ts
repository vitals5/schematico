import type { jsPDF } from "jspdf";
import {
  sheetFrameRuns,
  type SheetFrameData,
  type SheetNumbering,
  type SheetArea,
} from "../model/DocumentSheet";
import { renderPdfGraphics } from "./PdfGraphics";
export function renderPdfSheetFrame(
  doc: jsPDF,
  frame: SheetFrameData,
  title: string,
  numbering: SheetNumbering = {},
  monochrome = false,
) {
  const w = doc.internal.pageSize.getWidth(),
    h = doc.internal.pageSize.getHeight(),
    t = frame.template;
  doc.saveGraphicsState();
  renderPdfGraphics(
    doc,
    t.graphics,
    w / t.width,
    h / t.height,
    monochrome ? "monochrome" : "color",
    0,
    0,
    "#7ca552",
  );
  for (const { text, value, cell, fit } of sheetFrameRuns(
    frame,
    title,
    w,
    h,
    numbering,
  )) {
    if (!value) continue;
    doc.saveGraphicsState();
    doc.rect(cell.x, cell.y, cell.width, cell.height, null);
    doc.clip();
    doc.discardPath();
    doc.setFont("helvetica", "normal");
    doc.setFontSize((fit.size * 72) / 25.4);
    doc.setTextColor(
      ...((monochrome ? [0, 0, 0] : [124, 165, 82]) as [
        number,
        number,
        number,
      ]),
    );
    fit.lines.forEach((line, i) =>
      doc.text(line, fit.x, fit.y + i * fit.size * 1.2, {
        align:
          text.anchor === "middle"
            ? "center"
            : text.anchor === "end"
              ? "right"
              : "left",
      }),
    );
    doc.restoreGraphicsState();
  }
  doc.restoreGraphicsState();
}
/** Fit older tabular renderers inside the actual frame area without changing
 * their line wrapping, row order or data. The PDF transform also scales text. */
export function fitLegacyPdfContent(
  doc: jsPDF,
  area: SheetArea,
  sourceWidth: number,
  sourceHeight: number,
) {
  if (!doc.setCurrentTransformationMatrix || !doc.Matrix) return () => {};
  const scale = Math.min(
      1,
      (area.right - area.left) / sourceWidth,
      (area.bottom - area.top) / sourceHeight,
    ),
    tx = area.left - 20 * scale,
    ty = area.top - 24 * scale,
    k = doc.internal.scaleFactor,
    h = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  doc.setCurrentTransformationMatrix(
    doc.Matrix(scale, 0, 0, scale, tx * k, (h * (1 - scale) - ty) * k),
  );
  return () => doc.restoreGraphicsState();
}
