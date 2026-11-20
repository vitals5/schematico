import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { fixture } from "../layout/testing/fixture";
import { newDimensioning } from "../model/ElectricalDimensioning";
import { catalogCircuitArticle } from "../model/DimensioningArticles";
import type { AssignedArticle } from "../model/ArticleTypes";
import { protectionCoordination } from "../model/ProtectionCoordination";
import { protectionCoordinationPdf } from "./ProtectionCoordinationPdf";
import {
  prepareProjectPdfSections,
  projectPdfChoices,
} from "./ProjectPdfSections";
import { PdfExporter } from "./PdfExporter";
const p = fixture();
p.name = "COORDINATION-PROJECT";
p.company = "CURVE-COMPANY";
const article: AssignedArticle = {
  manufacturer: "TEST",
  articleNumber: "CURVE-16",
  variant: "A",
  role: "main",
  snapshot: {
    id: "curve",
    manufacturer: "TEST",
    articleNumber: "CURVE-16",
    variant: "A",
    description: "Test",
    origin: "user",
    verification: "unverified",
    electrical: {
      version: 1,
      kind: "protection",
      source: "VERIFIED-SOURCE",
      conditions: "TEST-CONDITIONS",
      curveKind: "overcurrent",
      curve: [
        { currentA: 100, timeMinS: 0.1, timeMaxS: 1 },
        { currentA: 1000, timeMinS: 0.01, timeMaxS: 0.1 },
      ],
    },
  },
};
p.dimensioning = [
  {
    ...newDimensioning("PROTECTION-CIRCUIT"),
    articles: { protection: catalogCircuitArticle(article, "protection") },
  },
];
const before = structuredClone(p),
  data = protectionCoordination(p.dimensioning[0], p);
const choice = projectPdfChoices(p).find((c) => c.kind === "protection")!;
assert(choice);
for (const paper of ["a3", "a4"] as const) {
  const sections = prepareProjectPdfSections(p, [choice.id], paper);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].kind, "protection");
  const report = sections[1];
  assert(report.kind === "report");
  assert(report.layout.width > report.layout.height);
  assert(
    report.layout.pages
      .flat()
      .every((f) => f.y + f.height <= report.layout.area.bottom + 0.001),
  );
  const standalone = protectionCoordinationPdf(data, p, paper).output();
  check(standalone);
  for (const frame of [true, false]) {
    const blob = await PdfExporter.exportToPdf(p, {
      paperFormat: paper,
      colorMode: frame ? "color" : "monochrome",
      pageRange: "all",
      includeDrawings: false,
      interactiveCrossReferences: true,
      includeBookmarks: true,
      includeTerminalDiagram: false,
      includePartsList: false,
      plotFrame: frame,
      additionalSections: [choice.id],
    });
    check(Buffer.from(await blob.arrayBuffer()).toString("latin1"), frame);
  }
}
function check(raw: string, frame = true) {
  for (const box of raw.matchAll(/\/MediaBox \[([\d. ]+)\]/g)) {
    const n = box[1].split(" ").map(Number);
    assert(n[2] > n[3]);
  }
  const streams = [...raw.matchAll(/\d+ 0 obj\s*([\s\S]*?)\s*endobj/g)]
    .flatMap((m) => {
      const s = m[1].match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
      return s
        ? [
            /\/Filter \/FlateDecode/.test(m[1])
              ? inflateSync(Buffer.from(s[1], "latin1")).toString("latin1")
              : s[1],
          ]
        : [];
    })
    .join("\n");
  if (frame) assert(streams.includes("CURVE-COMPANY"));
  assert(streams.includes("VERIFIED-SOURCE"));
  assert(streams.includes("TEST-CONDITIONS"));
  assert(streams.includes("CURVE-16"));
  assert(!/NaN|Infinity/.test(streams));
  assert(!raw.includes("/Subtype /Image"), "Chart remains vector content");
}
const en = structuredClone(p);
en.language = "en";
const enData = protectionCoordination(en.dimensioning![0], en, "en");
const enPdf = protectionCoordinationPdf(enData, en).output();
assert(enPdf.includes("Protection coordination"));
const enSections = prepareProjectPdfSections(en, [choice.id]);
assert(enSections[0].kind === "protection");
assert.equal(enSections[0].data.language, "en");
assert(enSections[1].kind === "report");
assert(enSections[1].rows.some((r) => r.cells.c1 === "Presentation"));
const draft = structuredClone(data);
draft.inputState = "draft";
assert(
  protectionCoordinationPdf(draft, p)
    .output()
    .includes(draft.language === "en" ? "Preview" : "Vorschau"),
);
assert.deepEqual(p, before);
console.log(
  "✓ Protection chart and complete source/point report: standalone/shared A3/A4 landscape, vector output, frames, full metadata, monochrome, section selection and immutable inputs",
);
