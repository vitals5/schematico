import assert from "node:assert/strict";
import { cabinetSvg, cabinetPdf } from "./CabinetDrawing";
import type { CabinetLayout } from "../model/CabinetLayout";
const l: CabinetLayout = {
    schemaVersion: 1,
    id: "plate",
    name: "Cabinet",
    widthMm: 600,
    heightMm: 800,
    marginMm: 10,
    gridMm: 5,
    items: [
      {
        id: "shape",
        kind: "duct",
        label: '<img src=x onerror="bad">',
        x: 10,
        y: 10,
        widthMm: 40,
        heightMm: 780,
        rotation: 0,
        clearanceMm: 0,
      },
    ],
  },
  before = structuredClone(l),
  svg = cabinetSvg(l, new Map(), "", [], false);
assert(svg.includes('width="600mm"'));
assert(svg.includes('height="800mm"'));
assert(svg.includes('viewBox="0 0 600 800"'));
assert(!svg.includes("<img"));
assert(svg.includes("&lt;img"));
assert(!svg.includes("data-eng-id"));
assert(cabinetSvg(l, new Map()).includes("data-eng-id"));
assert.equal(cabinetPdf(l, new Map(), "Test").getNumberOfPages(), 1);
assert(cabinetPdf(l, new Map(), "Test").output().startsWith("%PDF"));
assert.deepEqual(l, before);
const invalid = {
  ...l,
  marginMm: '0" onload="bad',
} as unknown as CabinetLayout;
assert(!cabinetSvg(invalid, new Map()).includes("onload="));
console.log(
  "✓ Cabinet graphics: independent millimetre SVG, escaped labels, bounded interactive view, standalone PDF, immutable geometry and safe numeric fallbacks",
);
