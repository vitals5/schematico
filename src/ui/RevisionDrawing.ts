import type { Project } from "../model/types";
import type { RevisionComparison } from "../model/ProjectRevisions";
import { snapshotPage } from "../layout/geometry";
import { getDrawingUnitsPerMm, getSymbolForComponent } from "../model/symbols";
import {
  drawingToSvg,
  uprightSymbolSvg,
  escapeSvg as esc,
} from "../model/ImportedDrawing";

/** Read-only comparison drawing; markers do not become project objects. */
export function revisionDrawing(
  project: Project,
  pageId: string,
  report: RevisionComparison,
  side: "before" | "after",
): string {
  const page = project.pages.find((p) => p.id === pageId);
  if (!page) return "<p>Dieses Blatt ist in diesem Stand nicht enthalten.</p>";
  const snapshot = snapshotPage(page, project),
    u = getDrawingUnitsPerMm(project);
  const w = page.plotFrame.width / u,
    h = page.plotFrame.height / u;
  const vectors = page.components
    .map((c) => {
      const s = getSymbolForComponent(c, project);
      return !s
        ? ""
        : `<g transform="scale(${1 / u})"><g transform="translate(${c.x},${c.y}) rotate(${c.rotation},${s.width / 2},${s.height / 2})">${s.importedGraphics ? drawingToSvg(s.importedGraphics, { color: "currentColor", componentRotation: c.rotation }) : uprightSymbolSvg(s.svgContent, c.rotation)}</g></g>`;
    })
    .join("");
  const wires = snapshot.edges
    .map(
      (e) =>
        `<polyline points="${e.points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="currentColor" stroke-width=".35"/>`,
    )
    .join("");
  const shapes = [
    ...snapshot.nodes.flatMap((n) => n.shapes),
    ...snapshot.frames.flatMap((n) => n.shapes ?? []),
  ];
  const labels = shapes
    .flatMap((s) =>
      s.text
        ? [
            `<text x="${s.text.anchor.x}" y="${s.text.anchor.y}" font-size="${s.text.size}" text-anchor="${esc(s.text.align)}" fill="currentColor" transform="rotate(${s.text.rotation},${s.text.anchor.x},${s.text.anchor.y})">${s.text.value
              .split("\n")
              .map(
                (line, i) =>
                  `<tspan x="${s.text!.anchor.x}" dy="${i ? s.text!.size * 1.25 : 0}">${esc(line)}</tspan>`,
              )
              .join("")}</text>`,
          ]
        : [],
    )
    .join("");
  const markers = report.changes
    .filter(
      (c) =>
        c.pageId === pageId &&
        (side === "before" ? c.status !== "added" : c.status !== "removed"),
    )
    .map((c) => {
      const node = snapshot.nodes.find((n) => n.id === c.id),
        frame = snapshot.frames.find((n) => n.id === c.id),
        edge = snapshot.edges.find((e) => e.id === c.id);
      const points = edge?.points ?? [];
      const r =
        node?.rect ??
        frame?.rect ??
        (points.length
          ? {
              x: Math.min(...points.map((p) => p.x)),
              y: Math.min(...points.map((p) => p.y)),
              width:
                Math.max(...points.map((p) => p.x)) -
                Math.min(...points.map((p) => p.x)),
              height:
                Math.max(...points.map((p) => p.y)) -
                Math.min(...points.map((p) => p.y)),
            }
          : undefined);
      if (!r) return "";
      const color =
        c.status === "added"
          ? "#65d69a"
          : c.status === "removed"
            ? "#ff7d8d"
            : "#ffd479";
      return `<rect data-change="${esc(c.key)}" x="${r.x - 1.5}" y="${r.y - 1.5}" width="${r.width + 3}" height="${r.height + 3}" fill="${color}" fill-opacity=".08" stroke="${color}" stroke-width=".5"><title>${esc(c.label)}</title></rect>`;
    })
    .join("");
  return `<svg class="revision-drawing" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(side === "before" ? report.before : report.after)}"><rect width="${w}" height="${h}" fill="#111a26"/>${wires}${vectors}${labels}${markers}</svg>`;
}
