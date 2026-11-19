import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { fixture, add } from "../layout/testing/fixture";
import {
  saveProjectRevision,
  releaseProjectRevision,
  compareProjectRevisions,
} from "../model/ProjectRevisions";
import {
  newDimensioning,
  withDimensioning,
} from "../model/ElectricalDimensioning";
import {
  prepareProjectPdfSections,
  projectPdfChoices,
} from "./ProjectPdfSections";
import { PdfExporter } from "./PdfExporter";
import { engineeringTablePdf } from "./EngineeringTablePdf";
import { comparisonReportRows } from "../reports/EngineeringCalculations";
import { PackageHandler } from "../packages/PackageHandler";
const p = fixture();
p.name = "Engineering fixture";
p.company = "ENGINEERING-COMPANY";
p.author = "Planer";
add(p, "F1");
let next = await saveProjectRevision(p, {
  name: "REV-A",
  author: "Planer",
  reason: "Engineering baseline",
});
next = await releaseProjectRevision(
  next,
  next.revisions![0].id,
  "Pruefer",
  "Released source",
);
next = withDimensioning(next, {
  ...newDimensioning("CIRCUIT-CHECK"),
  system: "ac1",
  voltageV: 230,
  currentA: 16,
  lengthM: 25,
  sectionMm2: 2.5,
  temperatureC: 20,
  cosPhi: 1,
  reactanceOhmKm: 0,
  maxDropPercent: 3,
});
const before = structuredClone(next);
const choices = projectPdfChoices(next),
  sections = prepareProjectPdfSections(next);
assert(
  choices.some((c) => c.kind === "revisions") &&
    choices.some((c) => c.kind === "dimensioning"),
);
const reports = sections.filter(
  (s) =>
    s.kind === "report" &&
    ["Elektrische Dimensionierung", "Projektstände und Freigaben"].includes(
      s.title,
    ),
);
assert.equal(reports.length, 2);
for (const r of reports) {
  assert(r.kind === "report");
  assert(r.layout.width > r.layout.height);
  assert(r.rows.length > 0);
  assert(
    r.layout.pages
      .flat()
      .every((f) => f.y + f.height <= r.layout.area.bottom + 0.001),
  );
}
function check(raw: string) {
  for (const box of raw.matchAll(/\/MediaBox \[([\d. ]+)\]/g)) {
    const n = box[1].split(" ").map(Number);
    assert(n[2] > n[3]);
  }
  const content = [...raw.matchAll(/\d+ 0 obj\s*([\s\S]*?)\s*endobj/g)]
    .flatMap((m) => {
      const s = m[1].match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
      return !s
        ? []
        : [
            /\/Filter \/FlateDecode/.test(m[1])
              ? inflateSync(Buffer.from(s[1], "latin1")).toString("latin1")
              : s[1],
          ];
    })
    .join("\n");
  assert(content.includes("ENGINEERING-COMPANY"));
  return content;
}
for (const paperFormat of ["a3", "a4"] as const) {
  const blob = await PdfExporter.exportToPdf(next, {
    paperFormat,
    colorMode: "color",
    pageRange: "all",
    interactiveCrossReferences: true,
    includeBookmarks: true,
    includeTerminalDiagram: false,
    includePartsList: false,
    plotFrame: true,
  });
  const text = check(Buffer.from(await blob.arrayBuffer()).toString("latin1"));
  assert(
    text.includes("REV-A") &&
      text.includes("CIRCUIT-CHECK") &&
      text.includes("schematico-dimensioning-v1"),
  );
}
const rows = comparisonReportRows(compareProjectRevisions(p, next));
assert(rows.length > 0);
check(
  engineeringTablePdf(
    "Revisionsvergleich",
    ["Blatt", "Objekt", "Feld", "Vorher", "Nachher"],
    rows.map((r) => [
      r.cells.c0,
      r.cells.c1,
      r.cells.c2,
      r.cells.c3,
      r.cells.c4,
    ]),
    next.name,
    next,
  ).output(),
);
const packed = await PackageHandler.exportToZw1(next);
assert(packed.size > 0);
const imported = await PackageHandler.inspectFile(
  new File([await packed.arrayBuffer()], "engineering.zw1"),
);
assert.deepEqual(imported.extractedProject?.revisions, next.revisions);
assert.deepEqual(imported.extractedProject?.dimensioning, next.dimensioning);
assert.deepEqual(
  next,
  before,
  "PDF and native export do not change stored inputs or archive records",
);
console.log(
  "✓ Revisions and dimensioning in shared A3/A4 landscape project documentation, continued bounded rows, custom project frames, full calculation/method data, comparison PDF and immutable native export",
);
