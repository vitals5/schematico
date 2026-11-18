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
        id = visualKey("cabinet", layout.id, item.id);
      return [
        `<g ${interactive ? `data-cabinet-item="${esc(item.id)}" tabindex="0" role="button" aria-label="${esc(label)}" ${visualMeta(id, label, { issue: problem, neighbors: item.railId ? [visualKey("cabinet", layout.id, item.railId)] : [] })}` : ""} class="cb-item ${item.id === selected ? "is-selected" : ""}"><title>${esc(label + " · " + b.width + " × " + b.height + " mm")}</title><rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${item.kind === "device" ? 1 : 0}" fill="${item.kind === "device" ? "#dceafa" : item.kind === "rail" ? "#c3cbd2" : "#e6e0d3"}" stroke="${problem ? "#c35635" : item.id === selected ? "#226aa4" : "#546676"}" stroke-width="${item.id === selected ? 0.8 : 0.4}"/>${item.kind === "rail" ? `<path d="M${b.x} ${b.y + 3}h${b.width} M${b.x} ${b.y + b.height - 3}h${b.width} M${b.x} ${b.y + b.height / 2}h${b.width}" stroke="#8895a0" stroke-width=".5"/>` : ""}<clipPath id="cb-label-${index}"><rect x="${b.x + 1}" y="${b.y + 1}" width="${Math.max(0.1, b.width - 2)}" height="${Math.max(0.1, b.height - 2)}"/></clipPath><text clip-path="url(#cb-label-${index})" x="${b.x + 2}" y="${b.y + Math.min(b.height / 2 + 1, 7)}" font-size="3" fill="#24394b">${esc(label)}</text></g>`,
      ];
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" class="cb-svg" viewBox="0 0 ${width} ${height}" width="${interactive ? (width * 600) / Math.max(width, height) : width + "mm"}" height="${interactive ? (height * 600) / Math.max(width, height) : height + "mm"}" style="font-family:Arial,Helvetica,sans-serif" ${interactive ? 'role="group" aria-label="' + esc(layout.name) + '"' : ""}><defs><pattern id="cb-grid" width="${grid}" height="${grid}" patternUnits="userSpaceOnUse"><path d="M${grid} 0H0V${grid}" fill="none" stroke="#b9c8d8" stroke-width=".12"/></pattern></defs><rect width="${width}" height="${height}" fill="#fcfdff"/><rect width="${width}" height="${height}" fill="url(#cb-grid)"/><rect x="${margin}" y="${margin}" width="${Math.max(0, width - 2 * margin)}" height="${Math.max(0, height - 2 * margin)}" fill="none" stroke="#8d9dad" stroke-width=".35" stroke-dasharray="2 2"/>${nodes}</svg>`;
}
export function cabinetPdf(
  layout: CabinetLayout,
  labels: Map<string, string>,
  projectName: string,
) {
  const doc = new jsPDF({
      format: "a3",
      orientation: layout.widthMm > layout.heightMm ? "landscape" : "portrait",
      unit: "mm",
    }),
    w = doc.internal.pageSize.getWidth(),
    h = doc.internal.pageSize.getHeight();
  doc.setFontSize(13);
  const title = doc.splitTextToSize(layout.name, w - 24) as string[];
  doc.text(title, 12, 12);
  doc.setFontSize(8);
  const caption = doc
      .splitTextToSize(projectName.slice(0, 160), w - 24)
      .slice(0, 2) as string[],
    captionY = 12 + title.length * 5.3 + 2;
  doc.text(caption, 12, captionY);
  const top = captionY + caption.length * 3.3 + 5,
    s = Math.min((w - 24) / layout.widthMm, (h - top - 15) / layout.heightMm);
  doc.text(
    `${layout.widthMm} × ${layout.heightMm} mm · Faktor ${s.toFixed(3)}`,
    12,
    h - 8,
  );
  doc.setDrawColor(70, 85, 100);
  doc.rect(12, top, layout.widthMm * s, layout.heightMm * s);
  for (const i of layout.items) {
    const b = cabinetBounds(i),
      x = 12 + b.x * s,
      y = top + b.y * s;
    doc.setFillColor(
      ...((i.kind === "device"
        ? [220, 234, 250]
        : i.kind === "rail"
          ? [195, 203, 210]
          : [230, 224, 211]) as [number, number, number]),
    );
    doc.rect(x, y, b.width * s, b.height * s, "FD");
    doc.setFontSize((3 * s) / 0.352778);
    const lines = doc.splitTextToSize(
      labels.get(i.id) || i.label,
      Math.max(0.1, b.width * s - 2 * s),
    );
    if (b.height * s > 4 * s)
      doc.text(
        lines.slice(0, Math.max(1, Math.floor(b.height / 4))),
        x + s,
        y + 3 * s,
      );
  }
  return doc;
}
