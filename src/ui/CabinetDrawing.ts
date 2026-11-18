import type { Project } from "../model/types";
import {
  documentFrame,
  sheetArea,
  type SheetFrameData,
  type SheetNumbering,
} from "../model/DocumentSheet";
import { renderPdfSheetFrame } from "../export/PdfSheetFrame";
import { cabinetStandard } from "../model/CabinetLibrary";
import { cabinetDeviceFace, cabinetFaceSvg } from "./CabinetDeviceFace";
import { jsPDF } from "jspdf";
import {
  cabinetBounds,
  type CabinetLayout,
  type CabinetIssue,
} from "../model/CabinetLayout";
import { escapeSvg as esc } from "../model/ImportedDrawing";
import { visualMeta, visualKey } from "./EngineeringVisualModel";
export function cabinetSvg(
  layout: CabinetLayout,
  labels: Map<string, string>,
  selected = "",
  issues: CabinetIssue[] = [],
  interactive = true,
) {
  const width =
      Number.isFinite(layout.widthMm) &&
      layout.widthMm >= 50 &&
      layout.widthMm <= 10000
        ? layout.widthMm
        : 600,
    height =
      Number.isFinite(layout.heightMm) &&
      layout.heightMm >= 50 &&
      layout.heightMm <= 10000
        ? layout.heightMm
        : 800,
    margin =
      Number.isFinite(layout.marginMm) &&
      layout.marginMm >= 0 &&
      layout.marginMm <= 100
        ? layout.marginMm
        : 10,
    grid =
      Number.isFinite(layout.gridMm) && layout.gridMm >= 1 ? layout.gridMm : 5;
  const nodes = layout.items
    .flatMap((item, index) => {
      const b = cabinetBounds(item);
      if (
        ![b.x, b.y, b.width, b.height].every(Number.isFinite) ||
        b.width <= 0 ||
        b.height <= 0
      )
        return [];
      const label = labels.get(item.id) || item.label,
        problem = issues.some((i) => i.ids.includes(item.id)),
        id = visualKey("cabinet", layout.id, item.id),
        standard = cabinetStandard(item.standardId),
        face = standard
          ? `<g transform="translate(${item.x + (item.rotation === 90 ? item.heightMm : 0)} ${item.y})${item.rotation === 90 ? " rotate(90)" : ""}" pointer-events="none">${cabinetFaceSvg(cabinetDeviceFace(standard, item.widthMm, item.heightMm))}</g>`
          : "";
      return [
        `<g ${interactive ? `data-cabinet-item="${esc(item.id)}" tabindex="0" role="button" aria-label="${esc(label)}" ${visualMeta(id, label, { issue: problem, neighbors: item.railId ? [visualKey("cabinet", layout.id, item.railId)] : [] })}` : ""} class="cb-item ${item.id === selected ? "is-selected" : ""}"><title>${esc(label + " · " + b.width + " × " + b.height + " mm")}</title><rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${item.kind === "device" || item.kind === "standard" ? 1 : 0}" fill="${item.kind === "standard" ? "#f4f6f7" : item.kind === "device" ? "#dceafa" : item.kind === "rail" ? "#c3cbd2" : "#e6e0d3"}" stroke="${problem ? "#c35635" : item.id === selected ? "#226aa4" : "#546676"}" stroke-width="${item.id === selected ? 0.8 : 0.4}"/>${item.kind === "rail" ? `<path d="M${b.x} ${b.y + 3}h${b.width} M${b.x} ${b.y + b.height - 3}h${b.width} M${b.x} ${b.y + b.height / 2}h${b.width}" stroke="#8895a0" stroke-width=".5"/>` : ""}${face}<clipPath id="cb-label-${index}"><rect x="${b.x + 1}" y="${b.y + 1}" width="${Math.max(0.1, b.width - 2)}" height="${Math.max(0.1, b.height - 2)}"/></clipPath><text clip-path="url(#cb-label-${index})" x="${b.x + 2}" y="${b.y + Math.min(b.height / 2 + 1, 7)}" font-size="3" fill="#24394b">${esc(label)}</text></g>`,
      ];
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" class="cb-svg" viewBox="0 0 ${width} ${height}" width="${interactive ? (width * 600) / Math.max(width, height) : width + "mm"}" height="${interactive ? (height * 600) / Math.max(width, height) : height + "mm"}" style="font-family:Arial,Helvetica,sans-serif" ${interactive ? 'role="group" aria-label="' + esc(layout.name) + '"' : ""}><defs><pattern id="cb-grid" width="${grid}" height="${grid}" patternUnits="userSpaceOnUse"><path d="M${grid} 0H0V${grid}" fill="none" stroke="#b9c8d8" stroke-width=".12"/></pattern></defs><rect width="${width}" height="${height}" fill="#fcfdff"/><rect width="${width}" height="${height}" fill="url(#cb-grid)"/><rect x="${margin}" y="${margin}" width="${Math.max(0, width - 2 * margin)}" height="${Math.max(0, height - 2 * margin)}" fill="none" stroke="#8d9dad" stroke-width=".35" stroke-dasharray="2 2"/>${nodes}</svg>`;
}
export function cabinetPdf(
  layout: CabinetLayout,
  labels: Map<string, string>,
  projectName: string,
  project?: Project,
) {
  const doc = new jsPDF({
    format: "a3",
    orientation: "landscape",
    unit: "mm",
  });
  renderCabinetPdfPage(doc, layout, labels, projectName, {
    frame: documentFrame(project ?? projectName),
  });
  return doc;
}
export interface CabinetPdfOptions extends SheetNumbering {
  frame?: SheetFrameData | false;
  monochrome?: boolean;
  pageTargets?: ReadonlyMap<string, number>;
}
/** Shared vector renderer for the standalone and complete project PDF. */
export function renderCabinetPdfPage(
  doc: jsPDF,
  layout: CabinetLayout,
  labels: Map<string, string>,
  projectName: string,
  options: CabinetPdfOptions = {},
) {
  const w = doc.internal.pageSize.getWidth(),
    h = doc.internal.pageSize.getHeight(),
    frame =
      options.frame ??
      (options.frame === false ? false : documentFrame(projectName)),
    area = sheetArea(frame, w, h);
  if (frame)
    renderPdfSheetFrame(doc, frame, layout.name, options, !!options.monochrome);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([], 0);
  const color = (hex: string) => {
    if (!options.monochrome) return hex;
    const n = parseInt(hex.slice(1), 16),
      v = Math.round(
        0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255),
      );
    return `#${v.toString(16).padStart(2, "0").repeat(3)}`;
  };
  doc.setFontSize(13);
  const title = doc.splitTextToSize(
    layout.name,
    area.right - area.left,
  ) as string[];
  doc.text(title, area.left, area.top);
  doc.setFontSize(8);
  const caption = doc
      .splitTextToSize(projectName.slice(0, 160), area.right - area.left)
      .slice(0, 2) as string[],
    captionY = area.top + title.length * 5.3 + 2;
  doc.text(caption, area.left, captionY);
  const top = captionY + caption.length * 3.3 + 5,
    s = Math.min(
      (area.right - area.left) / layout.widthMm,
      (area.bottom - top) / layout.heightMm,
    );
  doc.text(
    `${layout.widthMm} × ${layout.heightMm} mm · Faktor ${s.toFixed(3)}`,
    area.left,
    area.footerY,
  );
  doc.setDrawColor(options.monochrome ? "#000000" : "#465564");
  doc.rect(area.left, top, layout.widthMm * s, layout.heightMm * s);
  for (const i of layout.items) {
    const b = cabinetBounds(i),
      x = area.left + b.x * s,
      y = top + b.y * s;
    doc.setFillColor(
      color(
        i.kind === "device"
          ? "#dceafa"
          : i.kind === "standard"
            ? "#f4f6f7"
            : i.kind === "rail"
              ? "#c3cbd2"
              : "#e6e0d3",
      ),
    );
    doc.rect(x, y, b.width * s, b.height * s, "FD");
    if (i.kind === "rail") {
      doc.setDrawColor(color("#8895a0"));
      doc.setLineWidth(0.5 * s);
      for (const offset of [3, b.height - 3, b.height / 2])
        doc.line(x, y + offset * s, x + b.width * s, y + offset * s);
    }
    const target = i.source && options.pageTargets?.get(i.source.pageId);
    if (i.kind === "device" && target)
      doc.link(x, y, b.width * s, b.height * s, { pageNumber: target });
    const standard = cabinetStandard(i.standardId);
    if (standard) {
      const point = (px: number, py: number) =>
        i.rotation === 90
          ? [x + (i.heightMm - py) * s, y + px * s]
          : [x + px * s, y + py * s];
      for (const p of cabinetDeviceFace(standard, i.widthMm, i.heightMm)) {
        const [px, py] = point(p.x, p.y);
        if (p.kind === "text") {
          doc.setTextColor(options.monochrome ? "#000000" : "#24394b");
          doc.setFontSize((p.size * s) / 0.352778);
          doc.text(p.text, px, py, {
            align: "center",
            angle: i.rotation === 90 ? 270 : 0,
          });
        } else {
          doc.setDrawColor(color(p.stroke));
          doc.setLineWidth(0.3 * s);
          if (p.kind === "line") {
            const [tx, ty] = point(p.x2, p.y2);
            doc.line(px, py, tx, ty);
          } else {
            doc.setFillColor(color(p.fill));
            if (p.kind === "circle") doc.circle(px, py, p.r * s, "FD");
            else if (i.rotation === 90)
              doc.rect(px - p.h * s, py, p.h * s, p.w * s, "FD");
            else doc.rect(px, py, p.w * s, p.h * s, "FD");
          }
        }
      }
    }
    doc.setDrawColor(options.monochrome ? "#000000" : "#465564");
    doc.setTextColor(options.monochrome ? "#000000" : "#24394b");
    doc.setLineWidth(0.2);
    doc.setFontSize((3 * s) / 0.352778);
    // Match the editor's single clipped label, including its physical anchor.
    doc.saveGraphicsState();
    doc.rect(
      x + s,
      y + s,
      Math.max(0.1, b.width - 2) * s,
      Math.max(0.1, b.height - 2) * s,
      null,
    );
    doc.clip();
    doc.discardPath();
    doc.text(
      (labels.get(i.id) || i.label).replace(/\s+/g, " "),
      x + 2 * s,
      y + Math.min(b.height / 2 + 1, 7) * s,
    );
    doc.restoreGraphicsState();
  }
  return doc;
}
