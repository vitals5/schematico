import assert from "node:assert/strict";
import { cabinetSvg, cabinetPdf, renderCabinetPdfPage } from "./CabinetDrawing";
import { jsPDF } from "jspdf";
import { sheetArea } from "../model/DocumentSheet";
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
for (const format of ["a3", "a4"] as const) {
  const doc = new jsPDF({ format, orientation: "landscape", unit: "mm" });
  const rectangles: number[][] = [],
    original = doc.rect.bind(doc);
  doc.rect = ((...args: Parameters<typeof doc.rect>) => {
    rectangles.push(args.slice(0, 4) as number[]);
    return original(...args);
  }) as typeof doc.rect;
  renderCabinetPdfPage(doc, l, new Map(), "Test", { frame: false });
  const [x, y, width, height] = rectangles[0];
  const area = sheetArea(
    false,
    doc.internal.pageSize.getWidth(),
    doc.internal.pageSize.getHeight(),
  );
  assert(
    Math.abs(width / height - l.widthMm / l.heightMm) < 0.0001,
    "Tall plates keep their physical proportions",
  );
  assert(
    x >= area.left && y >= area.top &&
      x + width <= area.right + 0.001 && y + height <= area.bottom + 0.001,
    "The plate fits above the footer on A3 and A4 landscape",
  );
}
const standalone = cabinetPdf(l, new Map(), "Test");
assert(
  standalone.internal.pageSize.getWidth() > standalone.internal.pageSize.getHeight(),
);
assert.deepEqual(l, before);
const invalid = {
  ...l,
  marginMm: '0" onload="bad',
} as unknown as CabinetLayout;
assert(!cabinetSvg(invalid, new Map()).includes("onload="));
console.log(
  "✓ Cabinet graphics: independent millimetre SVG, escaped labels, bounded interactive view, standalone PDF, immutable geometry and safe numeric fallbacks",
);
const { cabinetStandardLibrary } = await import("../model/CabinetLibrary");
const { cabinetDeviceFace } = await import("./CabinetDeviceFace");
for (const d of cabinetStandardLibrary) {
  const face = cabinetDeviceFace(d, d.widthMm, d.heightMm);
  assert(face.length > 0);
  for (const shape of face) {
    assert(
      shape.x >= 0 &&
        shape.x <= d.widthMm &&
        shape.y >= 0 &&
        shape.y <= d.heightMm,
      d.id,
    );
    if (shape.kind === "rect")
      assert(
        shape.x + shape.w <= d.widthMm + 0.001 &&
          shape.y + shape.h <= d.heightMm + 0.001,
        d.id,
      );
  }
  for (const rotation of [0, 90] as const) {
    const form: CabinetLayout = {
      ...l,
      items: [
        {
          id: "form",
          kind: "standard",
          label: "-F1",
          x: 20,
          y: 20,
          widthMm: d.widthMm,
          heightMm: d.heightMm,
          rotation,
          clearanceMm: 0,
          standardId: d.id,
          sizeOrigin: "standard",
        },
      ],
    };
    const svg = cabinetSvg(form, new Map(), "", [], false);
    assert(
      svg.includes("<circle") ||
        svg.includes("<line") ||
        svg.includes("RES") ||
        d.face === "blank" ||
        d.face === "light",
      d.id,
    );
    if (rotation) assert(svg.includes("rotate(90)"));
    assert(cabinetPdf(form, new Map(), "Test").output().startsWith("%PDF"));
  }
}
console.log(
  "✓ All generic device faces and 90° orientations share finite geometry in editor/SVG and PDF",
);
