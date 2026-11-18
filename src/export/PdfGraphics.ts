import type { jsPDF } from "jspdf";
import type { DrawingPrimitive } from "../model/types";
import { arcPoints } from "../model/ImportedDrawing";
export function renderPdfGraphics(
  doc: jsPDF,
  graphics: DrawingPrimitive[],
  sx: number,
  sy: number,
  mode: "color" | "monochrome",
  ox = 0,
  oy = 0,
  foreground?: string,
): void {
  const x = (n: number) => (n + ox) * sx,
    y = (n: number) => (n + oy) * sy;
  const rgb = (value: string): number[] => {
    const hex = value.replace("#", "");
    if (mode === "monochrome" || !/^(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(hex))
      return [0, 0, 0];
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
    // White and light editor foregrounds must remain visible on white PDF paper.
    return channels.every((c) => c >= 200) ? [0, 0, 0] : channels;
  };
  for (const g of graphics) {
    const color = rgb(foreground ?? g.color);
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setTextColor(color[0], color[1], color[2]);
    const width =
      g.kind === "rect"
        ? (g.lineWidth ?? 0.6)
        : "width" in g
          ? (g.width ?? 0.6)
          : 0.5;
    doc.setLineWidth(width * sx);
    doc.setLineDashPattern(
      "dash" in g ? (g.dash?.map((n) => n * sx) ?? []) : [],
      0,
    );
    if (g.kind === "line") doc.line(x(g.x1), y(g.y1), x(g.x2), y(g.y2));
    else if (g.kind === "rect")
      doc.rect(x(g.x), y(g.y), g.width * sx, g.height * sy);
    else if (g.kind === "circle") {
      if (g.fill) {
        const fill = rgb(foreground ?? g.fill);
        doc.setFillColor(fill[0], fill[1], fill[2]);
      }
      doc.circle(x(g.x), y(g.y), g.radius * sx, g.fill ? "FD" : "S");
    } else if (g.kind === "polygon" || g.kind === "arc") {
      const points = g.kind === "polygon" ? g.points : arcPoints(g);
      if (points.length < 2) continue;
      if (g.kind === "polygon" && g.fill) {
        const fill = rgb(foreground ?? g.fill);
        doc.setFillColor(fill[0], fill[1], fill[2]);
      }
      const path = points.map((point, i) => ({
        op: i ? "l" : "m",
        c: [x(point.x), y(point.y)],
      }));
      if (g.kind === "polygon") path.push({ op: "h", c: [] });
      doc.path(path);
      if (g.kind === "polygon" && g.fill) doc.fillStroke();
      else doc.stroke();
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize((g.size * sy * 72) / 25.4);
      doc.text(g.text, x(g.x), y(g.y), {
        align:
          g.anchor === "end"
            ? "right"
            : g.anchor === "middle"
              ? "center"
              : "left",
        angle: -(g.rotation ?? 0),
      });
    }
  }
  doc.setLineDashPattern([], 0);
}
