import type { Project, Page } from "./types";
import {
  defaultPlotFrame,
  frameTextCell,
  frameTextValue,
  fitFrameText,
  type PlotFrameTemplate,
} from "./PlotFrame";
import { drawingToSvg, escapeSvg } from "./ImportedDrawing";
export interface SheetFrameData {
  template: PlotFrameTemplate;
  name: string;
  description: string;
  company: string;
  author: string;
  date: string;
  commission: string;
}
export interface SheetNumbering {
  ordinal?: number;
  total?: number;
  code?: string;
  source?: Page;
  previous?: string;
  next?: string;
}
export interface SheetArea {
  left: number;
  right: number;
  top: number;
  bottom: number;
  footerY: number;
}
/** Only document metadata is retained; the report layout never copies electrical/project records. */
export function documentFrame(source: Project | string): SheetFrameData {
  const p = typeof source === "string" ? undefined : source,
    tb = p?.pages[0]?.plotFrame?.titleBlock;
  return {
    template: p?.plotFrameTemplate ?? defaultPlotFrame(p?.language ?? "de"),
    name: typeof source === "string" ? source : source.name || "",
    description:
      p?.description ||
      tb?.projectTitle ||
      (typeof source === "string" ? source : source.name) ||
      "",
    company: p?.company || tb?.company || "",
    author: p?.author || tb?.author || "",
    date:
      tb?.date || p?.modified?.slice(0, 10) || p?.created?.slice(0, 10) || "",
    commission: tb?.commission || "",
  };
}
function validate(t: PlotFrameTemplate) {
  if (
    !t ||
    !Number.isFinite(t.width) ||
    !Number.isFinite(t.height) ||
    t.width <= 0 ||
    t.height <= 0 ||
    !Array.isArray(t.graphics) ||
    !Array.isArray(t.texts) ||
    t.texts.some(
      (v) => !v || ![v.x, v.y, v.size].every(Number.isFinite) || v.size <= 0,
    )
  )
    throw Error("pdfFrameInvalid");
}
/** Largest free rectangular strip between frame rules and text bands. The
 * entire band occupied by a frame caption is reserved, including custom heads. */
export function sheetArea(
  frame: SheetFrameData | false,
  width: number,
  height: number,
): SheetArea {
  if (!frame)
    return {
      left: 12,
      right: width - 12,
      top: 14,
      bottom: height - 15,
      footerY: height - 7,
    };
  const t = frame.template;
  validate(t);
  const xs = [0, t.width],
    ys = [0, t.height],
    bands: { top: number; bottom: number }[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    if (Math.abs(y1 - y2) < 0.001 && Math.abs(x1 - x2) >= t.width * 0.55)
      ys.push(y1);
    if (Math.abs(x1 - x2) < 0.001 && Math.abs(y1 - y2) >= t.height * 0.55)
      xs.push(x1);
  };
  for (const g of t.graphics) {
    if (g.kind === "line") line(g.x1, g.y1, g.x2, g.y2);
    else if (g.kind === "rect") {
      line(g.x, g.y, g.x + g.width, g.y);
      line(g.x, g.y + g.height, g.x + g.width, g.y + g.height);
      line(g.x, g.y, g.x, g.y + g.height);
      line(g.x + g.width, g.y, g.x + g.width, g.y + g.height);
      if (g.width < t.width * 0.55 && g.height < t.height * 0.55)
        bands.push({ top: g.y, bottom: g.y + g.height });
    } else if (g.kind === "circle")
      bands.push({ top: g.y - g.radius, bottom: g.y + g.radius });
    else if (g.kind === "polygon" && g.points.length)
      bands.push({
        top: Math.min(...g.points.map((p) => p.y)),
        bottom: Math.max(...g.points.map((p) => p.y)),
      });
    else if (g.kind === "text")
      bands.push({ top: g.y - g.size * 1.2, bottom: g.y + g.size * 0.3 });
  }
  for (const text of t.texts) {
    // Side indices outside the content margins do not partition the whole page.
    const legend = text.text?.trim(),
      span = (((legend?.length ?? 0) * text.size * height) / t.height) * 0.9,
      x = (text.x * width) / t.width,
      left =
        text.anchor === "end"
          ? x - span
          : text.anchor === "middle"
            ? x - span / 2
            : x,
      right = left + span;
    if (
      text.property === undefined &&
      legend &&
      legend.length <= 3 &&
      (right < 10 || left > width - 10)
    )
      continue;
    bands.push({
      top: text.y - text.size * 1.2,
      bottom: text.y + text.size * 0.3,
    });
  }
  for (const b of bands) ys.push(b.top, b.bottom);
  const gap = (cuts: number[], max: number, blocked: typeof bands = []) => {
    const sorted = [
      ...new Set(cuts.filter((v) => Number.isFinite(v) && v >= 0 && v <= max)),
    ].sort((a, b) => a - b);
    const gaps = sorted
      .slice(1)
      .map((end, i) => ({ start: sorted[i], end }))
      .filter(
        (g) =>
          !blocked.some(
            (b) =>
              (g.start + g.end) / 2 > b.top && (g.start + g.end) / 2 < b.bottom,
          ),
      );
    return gaps.sort((a, b) => b.end - b.start - (a.end - a.start))[0];
  };
  const x = gap(xs, t.width),
    y = gap(ys, t.height, bands);
  if (!x || !y) throw Error("pdfFrameInvalid");
  const left = Math.max(12, (x.start * width) / t.width + 4),
    right = Math.min(width - 12, (x.end * width) / t.width - 4),
    top = Math.max(14, (y.start * height) / t.height + 8),
    bottom = Math.min(height - 15, (y.end * height) / t.height - 10),
    footerY = Math.min(height - 7, (y.end * height) / t.height - 3);
  if (right - left < 24 || bottom - top < 24) throw Error("pdfFrameInvalid");
  return { left, right, top, bottom, footerY };
}
export function sheetFrameRuns(
  frame: SheetFrameData,
  title: string,
  width: number,
  height: number,
  numbering: SheetNumbering = {},
) {
  const t = frame.template;
  validate(t);
  const sx = width / t.width,
    sy = height / t.height,
    ordinal = numbering.ordinal ?? 1,
    total = numbering.total ?? 1;
  const page =
    numbering.source ??
    ({
      id: "document",
      title,
      pageNumber: numbering.code ?? String(ordinal),
      higherLevel: "",
      location: "",
      plotFrame: {
        titleBlock: {
          projectTitle: frame.description,
          company: frame.company,
          author: frame.author,
          date: frame.date,
          commission: frame.commission,
        },
      },
    } as Page);
  const p = {
    name: frame.name,
    description: frame.description,
    company: frame.company,
    author: frame.author,
    pages: [page],
  } as Project;
  const cells = t.texts.map((text) => frameTextCell(text, t));
  return t.texts.map((text, index) => {
    const value =
      text.text !== undefined
        ? text.text
        : text.property === 10000
          ? frame.name
          : text.property === 25020
            ? String(ordinal)
            : text.property === 10300
              ? String(total)
              : text.property === 11041
                ? (numbering.previous ??
                  (ordinal > 1 ? String(ordinal - 1) : ""))
                : text.property === 11040
                  ? (numbering.next ??
                    (ordinal < total ? String(ordinal + 1) : ""))
                  : frameTextValue(text, page, p, t);
    const c = cells[index],
      cell = {
        x: c.x * sx,
        y: c.y * sy,
        width: c.width * sx,
        height: c.height * sy,
      },
      physical = {
        ...text,
        x: text.x * sx,
        y: text.y * sy,
        size:
          text.size *
          (t.texts.some(
            (other, j) =>
              j !== index &&
              Math.abs(other.y - text.y) <
                Math.max(other.size, text.size) * 0.3 &&
              Math.abs(cells[j].x - c.x) < 0.01 &&
              Math.abs(cells[j].y - c.y) < 0.01 &&
              Math.abs(cells[j].width - c.width) < 0.01,
          )
            ? Math.min(sx, sy)
            : sy),
      };
    return { text, value, cell, fit: fitFrameText(value, physical, cell) };
  });
}
export function documentFrameSvg(
  frame: SheetFrameData,
  title: string,
  width: number,
  height: number,
  numbering: SheetNumbering = {},
) {
  const t = frame.template,
    runs = sheetFrameRuns(frame, title, width, height, numbering);
  return `<g class="document-sheet-frame" color="#7ca552"><g transform="scale(${width / t.width} ${height / t.height})">${drawingToSvg(t.graphics, { color: "currentColor" })}</g>${runs.map(({ text, value, cell, fit }, i) => (!value ? "" : `<defs><clipPath id="document-frame-${i}"><rect x="${cell.x}" y="${cell.y}" width="${cell.width}" height="${cell.height}"/></clipPath></defs><text clip-path="url(#document-frame-${i})" x="${fit.x}" y="${fit.y}" font-size="${fit.size}" text-anchor="${text.anchor}" fill="currentColor">${fit.lines.map((line, n) => `<tspan x="${fit.x}" dy="${n ? fit.size * 1.2 : 0}">${escapeSvg(line)}</tspan>`).join("")}</text>`)).join("")}</g>`;
}
