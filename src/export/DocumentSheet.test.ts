import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { jsPDF } from "jspdf";
import {
  documentFrame,
  sheetArea,
  sheetFrameRuns,
  documentFrameSvg,
} from "../model/DocumentSheet";
import { defaultPlotFrame } from "../model/PlotFrame";
import { projectDocumentationFixture } from "../ui/testing/ProjectDocumentationFixture";
import { prepareProjectPdfSections } from "./ProjectPdfSections";
import { PdfExporter, type PdfExportOptions } from "./PdfExporter";
import {
  manufacturingReportPdf,
  layoutManufacturingReport,
} from "./ManufacturingReportPdf";
import { defaultReportTemplate } from "../reports/ManufacturingReports";
import { cabinetPdf } from "../ui/CabinetDrawing";
import { connectionListPdf } from "./ConnectionListPdf";
import { connectorPlanPdf } from "./ConnectorPlanPdf";
import { automationPlanPdf } from "./AutomationPlanPdf";
import { connectionList } from "../reports/ConnectionList";
import { connectorRows } from "../model/Connectors";
import { automationPlan } from "../reports/AutomationPlan";
import { renderPdfSheetFrame } from "./PdfSheetFrame";
const p = projectDocumentationFixture();
p.company = "FRAME-COMPANY";
p.author = "FRAME-AUTHOR";
p.description = "FRAME-PROJECT";
p.plotFrameTemplate = defaultPlotFrame();
p.plotFrameTemplate.texts.push({
  id: "custom-marker",
  x: 302,
  y: 294,
  size: 2,
  anchor: "start",
  text: "FRAME-MARK",
});
const before = structuredClone(p),
  frame = documentFrame(p);
for (const [w, h] of [
  [420, 297],
  [297, 210],
  [210, 297],
  [297, 420],
]) {
  const a = sheetArea(frame, w, h);
  assert(
    a.left >= 0 &&
      a.right <= w &&
      a.top < a.bottom &&
      a.footerY < (h * 281) / 297,
  );
  assert(
    a.bottom < a.footerY,
    "Report rows and local counters remain above the actual footer",
  );
  const runs = sheetFrameRuns(frame, "REPORT", w, h, { ordinal: 7, total: 23 });
  assert.equal(runs.find((r) => r.text.property === 25020)!.value, "7");
  assert.equal(runs.find((r) => r.text.property === 10300)!.value, "23");
  assert(runs.some((r) => r.value === "FRAME-COMPANY"));
  assert(runs.some((r) => r.value === "FRAME-AUTHOR"));
  const l = layoutManufacturingReport(
    {
      ...defaultReportTemplate("connections"),
      paper: w === 210 ? "a4" : "a3",
      orientation: w < h ? "portrait" : "landscape",
    },
    Array.from({ length: 180 }, (_, i) => ({
      key: String(i),
      cells: { c0: "ROW " + i, c11: "Long text ".repeat(90) },
      pages: [],
      targets: [],
    })),
    p.name,
    frame,
  );
  assert(l.pages.length > 1);
  assert(l.pages.flat().every((r) => r.y + r.height <= l.area.bottom + 0.001));
  assert(
    l.columns[0].x >= l.area.left &&
      l.columns.at(-1)!.x + l.columns.at(-1)!.width <= l.area.right + 0.001,
  );
}
const custom = documentFrame(p);
custom.template = structuredClone(frame.template);
custom.template.graphics.push({
  kind: "line",
  x1: 0,
  y1: 240,
  x2: 420,
  y2: 240,
  color: "#000",
  width: 0.2,
});
custom.template.texts.push({
  id: "large-head",
  x: 10,
  y: 250,
  size: 3,
  anchor: "start",
  text: "LOW FOOTER",
});
assert(
  sheetArea(custom, 420, 297).bottom < 240,
  "A taller custom footer moves the content limit upwards",
);
const indexed = documentFrame(p);
indexed.template = structuredClone(frame.template);
indexed.template.texts.push(
  ...[80, 160, 240].map((y, i) => ({
    id: "side-index-" + i,
    x: 2,
    y,
    size: 2,
    anchor: "start" as const,
    text: String.fromCharCode(65 + i),
  })),
);
assert.deepEqual(
  sheetArea(indexed, 420, 297),
  sheetArea(frame, 420, 297),
  "Marginal row indices do not split the usable report area",
);
const escaped = structuredClone(frame);
escaped.company = '<img src=x onerror="bad">';
assert(!documentFrameSvg(escaped, "Report", 420, 297).includes("<img"));
const invalid = structuredClone(frame);
invalid.template.width = NaN;
assert.throws(() => sheetArea(invalid, 420, 297), /pdfFrameInvalid/);
function streams(raw: string) {
  return [...raw.matchAll(/\d+ 0 obj\s*([\s\S]*?)\s*endobj/g)]
    .flatMap((m) => {
      const s = m[1].match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
      if (!s) return [];
      return [
        /\/Filter \/FlateDecode/.test(m[1])
          ? inflateSync(Buffer.from(s[1], "latin1")).toString("latin1")
          : s[1],
      ];
    })
    .join("\n");
}
function check(raw: string) {
  const count = (raw.match(/\/Type \/Page\b/g) ?? []).length,
    text = streams(raw);
  assert(count > 0);
  for (const m of raw.matchAll(/\/MediaBox \[([\d. ]+)\]/g)) {
    const box = m[1].split(" ").map(Number);
    assert(box[2] > box[3], "Every combined and standalone PDF page is landscape");
  }
  assert.equal(
    (text.match(/FRAME-MARK/g) ?? []).length,
    count,
    "Every PDF page uses the custom project frame",
  );
  assert.equal(
    (text.match(/FRAME-COMPANY/g) ?? []).length,
    count,
    "Project company is repeated in each title block",
  );
  assert(!text.includes("KOM-2026"));
  return count;
}
const options: PdfExportOptions = {
  paperFormat: "a4",
  pageRange: "all",
  colorMode: "color",
  interactiveCrossReferences: true,
  includeBookmarks: true,
  includeTerminalDiagram: true,
  includePartsList: true,
  plotFrame: true,
};
const blob = await PdfExporter.exportToPdf(p, options),
  count = check(Buffer.from(await blob.arrayBuffer()).toString("latin1"));
assert(count > 8);
const sections = prepareProjectPdfSections(p);
for (const s of sections)
  if (s.kind === "report") check(manufacturingReportPdf(s.layout).output());
const board = p.cabinetLayouts![0];
check(cabinetPdf(board, new Map(), p.name, p).output());
check(connectionListPdf(connectionList(p), p.name, p).output());
check(connectorPlanPdf(connectorRows(p), p.name, p).output());
check(automationPlanPdf(automationPlan(p), p.name, p).output());
const no = await PdfExporter.exportToPdf(p, { ...options, plotFrame: false });
assert(
  !streams(Buffer.from(await no.arrayBuffer()).toString("latin1")).includes(
    "FRAME-MARK",
  ),
  "Global no-frame option applies to legacy and added sections alike",
);
const doc = new jsPDF(),
  printed: { value: string; page: number }[] = [];
const original = doc.text.bind(doc);
doc.text = ((...args: any[]) => {
  printed.push({
    value: String(args[0]),
    page: doc.getCurrentPageInfo().pageNumber,
  });
  return (original as any)(...args);
}) as any;
renderPdfSheetFrame(doc, frame, "Continuation", { ordinal: 16, total: 21 });
assert(
  printed.some((t) => t.value === "16") &&
    printed.some((t) => t.value === "21"),
);
assert.deepEqual(p, before);
console.log(
  "✓ Project frames on every main, BOM, terminal, cabinet, manufacturing and navigator page; A3/A4 both orientations, custom footer reservation, numbering, escaped preview, standalone parity, explicit frame-off and immutable project",
);
