import type { CabinetStandard } from "../model/CabinetLibrary";
import { escapeSvg as esc } from "../model/ImportedDrawing";
export type CabinetFacePrimitive =
  | {
      kind: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      fill: string;
      stroke: string;
    }
  | {
      kind: "circle";
      x: number;
      y: number;
      r: number;
      fill: string;
      stroke: string;
    }
  | {
      kind: "line";
      x: number;
      y: number;
      x2: number;
      y2: number;
      stroke: string;
    }
  | { kind: "text"; x: number; y: number; size: number; text: string };
/** Shared front-view geometry for the editor, library thumbnails, SVG and PDF. All units in mm. */
export function cabinetDeviceFace(
  d: CabinetStandard,
  w: number,
  h: number,
): CabinetFacePrimitive[] {
  if (![w, h].every((n) => Number.isFinite(n) && n > 0)) return [];
  const shapes: CabinetFacePrimitive[] = [],
    stroke = "#667686",
    pale = "#e4e9ec",
    ink = "#2b3e4d",
    count = Math.min(d.poles, 8),
    rect = (x: number, y: number, ww: number, hh: number, fill = pale) =>
      shapes.push({ kind: "rect", x, y, w: ww, h: hh, fill, stroke }),
    circle = (x: number, y: number, r: number, fill = pale) =>
      shapes.push({ kind: "circle", x, y, r, fill, stroke }),
    line = (x: number, y: number, x2: number, y2: number) =>
      shapes.push({ kind: "line", x, y, x2, y2, stroke }),
    text = (s: string, y: number) =>
      shapes.push({
        kind: "text",
        x: w / 2,
        y,
        size: Math.min(3, w / Math.max(2, s.length * 0.6)),
        text: s,
      }),
    pins = () => {
      for (let n = 0; n < count; n++) {
        const x = ((n + 0.5) * w) / count,
          r = Math.min(1.7, (w / count) * 0.2);
        circle(x, h * 0.13, r);
        circle(x, h * 0.87, r);
      }
    },
    bank = (fill: string) => {
      rect(w * 0.1, h * 0.2, w * 0.8, h * 0.6, fill);
      for (let n = 0; n < count; n++) {
        const y = h * (0.3 + (n * 0.4) / Math.max(1, count - 1));
        circle(w * 0.3, y, Math.min(1.6, w * 0.18));
        circle(w * 0.7, y, Math.min(1.6, w * 0.18));
      }
    };
  switch (d.face) {
    case "breaker":
    case "rcd":
      pins();
      rect(w * 0.08, h * 0.3, w * 0.84, h * 0.4, "#f0f2f3");
      for (let n = 0; n < Math.min(count, 4); n++) {
        const step = w / Math.min(count, 4);
        rect(n * step + step * 0.22, h * 0.45, step * 0.56, h * 0.13, ink);
      }
      if (d.face === "rcd") {
        circle(w * 0.72, h * 0.37, Math.min(2, w * 0.12), "#78a7c5");
      }
      text(d.badge, h * 0.73);
      break;
    case "fuse":
      pins();
      for (let n = 0; n < count; n++) {
        const step = w / count;
        rect(
          n * step + step * 0.18,
          h * 0.28,
          step * 0.64,
          h * 0.43,
          "#f8f8f5",
        );
        rect(n * step + step * 0.33, h * 0.4, step * 0.34, h * 0.16, "#c2cbd0");
      }
      text(d.badge, h * 0.79);
      break;
    case "surge":
      pins();
      for (let n = 0; n < count; n++) {
        const step = w / count;
        rect(n * step + step * 0.1, h * 0.23, step * 0.8, h * 0.56, "#e7d7bb");
        rect(n * step + step * 0.32, h * 0.4, step * 0.36, h * 0.07, "#438564");
      }
      text(d.badge, h * 0.7);
      break;
    case "switch":
      pins();
      circle(w * 0.5, h * 0.49, Math.min(w * 0.28, h * 0.19), "#273f50");
      line(w * 0.5, h * 0.49, w * 0.65, h * 0.38);
      text(d.badge, h * 0.75);
      break;
    case "contactor":
      pins();
      rect(w * 0.15, h * 0.26, w * 0.7, h * 0.45, "#c9d2d8");
      rect(w * 0.35, h * 0.38, w * 0.3, h * 0.14, "#263c4b");
      text(d.badge, h * 0.66);
      break;
    case "relay":
      pins();
      rect(w * 0.12, h * 0.26, w * 0.76, h * 0.47, "#e8dfc1");
      circle(w * 0.5, h * 0.4, Math.min(w * 0.2, 3), "#d5ad4e");
      text(d.badge, h * 0.64);
      break;
    case "meter":
      pins();
      rect(w * 0.12, h * 0.3, w * 0.76, h * 0.22, "#b5c9bd");
      text("0000", h * 0.45);
      text(d.badge, h * 0.7);
      break;
    case "power":
    case "drive":
      pins();
      for (let n = 0; n < 5; n++)
        line(w * 0.18, h * (0.25 + n * 0.07), w * 0.82, h * (0.25 + n * 0.07));
      if (d.face === "drive")
        rect(w * 0.25, h * 0.65, w * 0.5, h * 0.1, "#9dbfb2");
      text(d.badge, h * 0.76);
      break;
    case "plc":
      pins();
      rect(w * 0.1, h * 0.25, w * 0.8, h * 0.5, "#465c69");
      for (let n = 0; n < Math.min(count, 4); n++)
        circle(
          w * (0.22 + n * 0.18),
          h * 0.35,
          Math.min(1, w * 0.04),
          "#83c49a",
        );
      rect(w * 0.28, h * 0.5, w * 0.44, h * 0.13, "#bccbd1");
      text(d.badge, h * 0.8);
      break;
    case "terminal":
      bank("#e2e4e4");
      break;
    case "earth":
      bank("#d1d98e");
      line(w * 0.5, h * 0.28, w * 0.5, h * 0.72);
      break;
    case "neutral":
      bank("#a9cbeb");
      break;
    case "socket":
      circle(w * 0.5, h * 0.49, Math.min(w * 0.36, h * 0.25), "#eef0f1");
      circle(w * 0.36, h * 0.49, Math.min(1.7, w * 0.04), ink);
      circle(w * 0.64, h * 0.49, Math.min(1.7, w * 0.04), ink);
      line(w * 0.5, h * 0.3, w * 0.5, h * 0.36);
      text(d.badge, h * 0.79);
      break;
    case "fan":
      circle(w * 0.5, h * 0.5, Math.min(w, h) * 0.36);
      circle(w * 0.5, h * 0.5, Math.min(w, h) * 0.07, ink);
      for (let n = 0; n < 4; n++) {
        const a = (n * Math.PI) / 2;
        line(
          w * 0.5 + Math.cos(a) * w * 0.09,
          h * 0.5 + Math.sin(a) * h * 0.09,
          w * 0.5 + Math.cos(a + 0.5) * w * 0.28,
          h * 0.5 + Math.sin(a + 0.5) * h * 0.28,
        );
      }
      break;
    case "light":
      rect(w * 0.06, h * 0.25, w * 0.88, h * 0.5, "#fff4ca");
      break;
    case "blank":
      rect(w * 0.1, h * 0.23, w * 0.8, h * 0.55, "#edf0f3");
      if (d.badge) text(d.badge, h * 0.54);
      break;
  }
  return shapes;
}
export function cabinetFaceSvg(primitives: CabinetFacePrimitive[]) {
  return primitives
    .map((p) =>
      p.kind === "rect"
        ? `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.fill}" stroke="${p.stroke}" stroke-width=".3"/>`
        : p.kind === "circle"
          ? `<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${p.fill}" stroke="${p.stroke}" stroke-width=".3"/>`
          : p.kind === "line"
            ? `<line x1="${p.x}" y1="${p.y}" x2="${p.x2}" y2="${p.y2}" stroke="${p.stroke}" stroke-width=".5"/>`
            : `<text x="${p.x}" y="${p.y}" font-size="${p.size}" text-anchor="middle" fill="#24394b">${esc(p.text)}</text>`,
    )
    .join("");
}
export function cabinetLibraryPreview(d: CabinetStandard) {
  const w = d.widthMm,
    h = d.heightMm;
  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="-3 -3 ${w + 6} ${h + 6}" style="font-family:Arial,Helvetica,sans-serif"><rect width="${w}" height="${h}" rx="1" fill="#f4f6f7" stroke="#71879b" stroke-width=".5"/>${cabinetFaceSvg(cabinetDeviceFace(d, w, h))}</svg>`;
}
