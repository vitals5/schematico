import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { jsPDF } from "jspdf";
import { projectDocumentationFixture } from "../ui/testing/ProjectDocumentationFixture";
import { fixture } from "../layout/testing/fixture";
import { PdfExporter, type PdfExportOptions } from "./PdfExporter";
import {
  projectPdfChoices,
  prepareProjectPdfSections,
} from "./ProjectPdfSections";
import {
  layoutManufacturingReport,
  appendManufacturingReportPdf,
} from "./ManufacturingReportPdf";
import { defaultReportTemplate } from "../reports/ManufacturingReports";
import { defaultCoverPageTemplate } from "../model/CoverPage";
const p = projectDocumentationFixture(),
  before = structuredClone(p),
  choices = projectPdfChoices(p),
  sections = prepareProjectPdfSections(p);
assert.equal(choices.length, 7);
assert.equal(sections.length, 7);
assert(sections.some((s) => s.title === "CABINET_MAIN"));
assert(sections.some((s) => s.title === "CUSTOM_WIRING"));
const terminal = sections.find((s) => s.title === "TERMINAL_PROJECT")!;
assert(terminal.kind === "report");
assert(terminal.layout.width > terminal.layout.height);
assert(
  choices.filter((c) => c.kind === "report").every((c) => c.detail.endsWith("landscape")),
);
assert(
  terminal.rows[0].cells.c1.localeCompare(
    terminal.rows.at(-1)!.cells.c1,
    undefined,
    { numeric: true },
  ) >= 0,
);
const automation = sections.find((s) => s.title.includes("Gebäudeautomation"))!;
assert(automation.kind === "report");
const autoText = automation.rows
  .map((r) => Object.values(r.cells).join(" "))
  .join("\n");
for (const text of ["Loxone Tree", "Loxone Air", "KNX", "1/0/1", "Reserve"])
  assert(autoText.includes(text), text);
const cabinet = sections.find((s) => s.kind === "cabinet")!;
assert(cabinet.kind === "cabinet");
assert(cabinet.labels.get("source")!.includes("-X1"));
assert.notEqual(cabinet.labels.get("source"), "Stale tag");
assert.deepEqual(prepareProjectPdfSections(p, []), []);
assert.throws(
  () => prepareProjectPdfSections(p, ["unknown"]),
  /pdfSectionInvalid/,
);
const options: PdfExportOptions = {
  paperFormat: "a3",
  colorMode: "color",
  pageRange: "all",
  interactiveCrossReferences: true,
  includeBookmarks: true,
  includeTerminalDiagram: false,
  includePartsList: false,
  plotFrame: false,
};
async function pdf(optionsOverride: Partial<PdfExportOptions> = {}) {
  const blob = await PdfExporter.exportToPdf(p, {
    ...options,
    ...optionsOverride,
  });
  const raw = Buffer.from(await blob.arrayBuffer()).toString("latin1");
  const objects = [...raw.matchAll(/(\d+) 0 obj\s*([\s\S]*?)\s*endobj/g)];
  const pages = objects.filter((m) => /\/Type \/Page\b/.test(m[2]));
  const streams = objects
    .flatMap((m) => {
      const s = m[2].match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
      if (!s) return [];
      return [
        /\/Filter \/FlateDecode/.test(m[2])
          ? inflateSync(Buffer.from(s[1], "latin1")).toString("latin1")
          : s[1],
      ];
    })
    .join("\n");
  return { raw, pages, streams };
}
const complete = await pdf(),
  expected = 3 + sections.reduce((n, s) => n + s.pages, 0);
assert.equal(
  complete.pages.length,
  expected,
  "Every prepared section is appended exactly once",
);
for (const title of ["CABINET_MAIN", "CUSTOM_WIRING", "TERMINAL_PROJECT"])
  assert(complete.raw.includes(title), title + " bookmark");
for (const text of [
  "FI 4P",
  "LS 1P",
  "CABINET_MAIN",
  "CUSTOM_WIRING",
  "Loxone Tree",
])
  assert(complete.streams.includes(text), text + " vector text");
const pageObjects = new Set(complete.pages.map((m) => m[1]));
for (const dest of complete.raw.matchAll(/\/Dest \[(\d+) 0 R/g))
  assert(
    pageObjects.has(dest[1]),
    "Internal link/bookmark resolves to a real page",
  );
assert(complete.raw.includes("/Subtype /Link"));
assert(
  complete.pages.every((m) => {
    const box = m[2]
      .match(/\/MediaBox \[([\d. ]+)\]/)![1]
      .split(" ")
      .map(Number);
    return box[2] > box[3];
  }),
  "Every drawing, saved portrait report and tall cabinet uses landscape",
);
const withBom = await pdf({ includePartsList: true });
assert(withBom.pages.length > complete.pages.length);
assert(withBom.streams.includes("PART-001") && withBom.streams.includes("CABINET_MAIN"), "BOM and new appendices coexist");
const legacyOnly = await pdf({includeDrawings:false, additionalSections:[], includeTerminalDiagram:true, includePartsList:true});
assert(legacyOnly.pages.length >= 2, "Legacy report-only selection has no mandatory drawing page");
assert(legacyOnly.streams.includes("PART-001"));
const only = await pdf({
  includeDrawings: false,
  additionalSections: [cabinet.id],
});
assert.equal(
  only.pages.length,
  1,
  "Cabinet-only export has no leading blank sheet",
);
assert(
  !only.raw.includes("/Subtype /Link"),
  "No links to unexported drawing sheets",
);
const current = await pdf({
  pageRange: "current",
  currentPageId: "auto",
  additionalSections: [cabinet.id],
});
assert.equal(current.pages.length, 2);
assert(
  !current.raw.includes("/Subtype /Link"),
  "Cabinet reference to a different unexported sheet stays unlinked",
);
const plain = await pdf({
  additionalSections: [],
  interactiveCrossReferences: false,
  includeBookmarks: false,
});
assert.equal(plain.pages.length, 3);
assert(!plain.raw.includes("/Subtype /Link"));
assert(!plain.raw.includes("/Type /Outlines"));
const mono = await pdf({ colorMode: "monochrome", includeDrawings: false });
assert(
  !/\b[\d.]+ [\d.]+ [\d.]+ (?:rg|RG)\b/.test(mono.streams),
  "Additional vector pages use only grayscale colors",
);
await assert.rejects(
  () =>
    PdfExporter.exportToPdf(fixture(), {
      ...options,
      includeDrawings: false,
      additionalSections: [],
    }),
  /pdfNoContent/,
);
await assert.rejects(
  () => pdf({ pageRange: "current", currentPageId: "missing" }),
  /pdfPageMissing/,
);
const bad = structuredClone(p);
bad.cabinetLayouts![0].items[1].x = 599;
await assert.rejects(
  () => PdfExporter.exportToPdf(bad, options),
  /pdfCabinetInvalid:CABINET_MAIN/,
);
const malformed = structuredClone(p);
(malformed as any).cabinetLayouts = [null];
assert(
  projectPdfChoices(malformed).some((c) => c.problem === "cabinetInvalid"),
);
assert.throws(() => prepareProjectPdfSections(malformed), /cabinetInvalid/);
assert.deepEqual(
  prepareProjectPdfSections(malformed, []),
  [],
  "Explicit omission does not silently select an invalid layout",
);
const long = layoutManufacturingReport(
  defaultReportTemplate("connections"),
  [
    {
      key: "long",
      cells: { c0: "CONTINUED ".repeat(6000) },
      pages: [],
      targets: [],
    },
  ],
  "Test",
);
assert(long.pages.length > 1);
const doc = new jsPDF();
appendManufacturingReportPdf(doc, long);
assert.equal(doc.getNumberOfPages(), long.pages.length + 1);
const coverProject = fixture();
coverProject.coverPageTemplate = {
  ...defaultCoverPageTemplate("de"),
  graphics: [],
  texts: defaultCoverPageTemplate("de").texts.filter(
    (t) => t.property === 10300,
  ),
};
const cover = new jsPDF(),
  printed: string[] = [];
const original = cover.text.bind(cover);
cover.text = ((...args: any[]) => {
  printed.push(String(args[0]));
  return (original as any)(...args);
}) as any;
(PdfExporter as any).renderCoverPage(
  cover,
  coverProject.pages[0],
  coverProject,
  420,
  297,
  "color",
  37,
);
assert(printed.includes("37"), "Cover page count includes additional sections");
assert.deepEqual(p, before, "Complete documentation is read-only");
console.log(
  "✓ Project PDF: all saved cabinet/report/automation data, shared vector fronts, custom portrait templates, sorting/pagination, exact page counts, bookmarks/valid links, section selection, grayscale, cover totals, invalid-layout rejection and immutable source",
);
