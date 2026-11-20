import assert from "node:assert/strict";
import { mock } from "node:test";
import { PdfExporter, projectPdfPages, type PdfExportOptions } from "./PdfExporter";
import { prepareProjectPdfSections, projectPdfChoices } from "./ProjectPdfSections";
import { PartsListGenerator } from "../reports/PartsList";
import { TerminalDiagramGenerator } from "../reports/TerminalDiagram";
import { projectDocumentationFixture } from "../ui/testing/ProjectDocumentationFixture";

const project = projectDocumentationFixture();
for (const type of ["parts_list", "terminal_diagram"] as const) {
  const page = structuredClone(project.pages[0]);
  page.id = type;
  page.pageNumber = type;
  page.title = "Imported " + type;
  page.pageType = type;
  page.components = [];
  page.wires = [];
  page.texts = [{ id: type, text: "SOURCE_" + type, x: 100, y: 100,
    fontSize: 10, fontColor: "#000000", fontWeight: "normal", fontStyle: "normal", align: "start", rotation: 0 }];
  project.pages.push(page);
}
const before = structuredClone(project);
const options: PdfExportOptions = {
  paperFormat: "a3", colorMode: "color", pageRange: "all",
  interactiveCrossReferences: true, includeBookmarks: true,
  includeTerminalDiagram: false, includePartsList: false,
  plotFrame: true, additionalSections: [],
};
const bom = mock.method(PartsListGenerator, "generatePartsList");
const terminal = mock.method(TerminalDiagramGenerator, "generateTerminalReport");
const renderBom = mock.method(PdfExporter as any, "renderPartsListPage");
const renderTerminal = mock.method(PdfExporter as any, "renderTerminalDiagramPage");
const texts = mock.method(PdfExporter as any, "renderTexts");
const reset = () => [bom, terminal, renderBom, renderTerminal, texts].forEach(fn => fn.mock.resetCalls());
const pageIds = () => texts.mock.calls.map((call: any) => call.arguments[1].id);
const pagesIn = async (blob: Blob) =>
  (Buffer.from(await blob.arrayBuffer()).toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
try {
  const blob = await PdfExporter.exportToPdf(project, options);
  assert.equal(await pagesIn(blob), 3);
  assert.deepEqual(pageIds(), project.pages.slice(0, 3).map(p => p.id));
  for (const fn of [bom, terminal, renderBom, renderTerminal])
    assert.equal(fn.mock.callCount(), 0, "Deselected lists must not be generated or rendered");

  for (const includePartsList of [false, true])
    for (const includeTerminalDiagram of [false, true]) {
      reset();
      const selection = { ...options, includePartsList, includeTerminalDiagram };
      const selected = projectPdfPages(project, selection);
      assert.equal(selected.some(p => p.id === "parts_list"), includePartsList);
      assert.equal(selected.some(p => p.id === "terminal_diagram"), includeTerminalDiagram);
      const pdf = await PdfExporter.exportToPdf(project, selection);
      assert.deepEqual(pageIds(), selected.map(p => p.id));
      assert.equal(bom.mock.callCount(), Number(includePartsList));
      assert.equal(terminal.mock.callCount(), Number(includeTerminalDiagram));
      assert.equal(renderBom.mock.callCount(), Number(includePartsList));
      assert.equal(renderTerminal.mock.callCount(), Number(includeTerminalDiagram));
      assert(await pagesIn(pdf) >= selected.length + Number(includePartsList) + Number(includeTerminalDiagram));
    }

  reset();
  await assert.rejects(() => PdfExporter.exportToPdf(project, {
    ...options, pageRange: "current", currentPageId: "terminal_diagram",
  }), /pdfNoContent/);
  assert.equal(texts.mock.callCount(), 0, "An excluded active report must not reach the renderer");
  assert.equal(bom.mock.callCount(), 0);
  assert.equal(terminal.mock.callCount(), 0);

  // A separately selected saved template remains an explicit request, even when
  // the legacy appendices and original project sheets are disabled.
  const saved = projectPdfChoices(project).find(c => c.title === "TERMINAL_PROJECT")!;
  const report = await PdfExporter.exportToPdf(project, {
    ...options, includeDrawings: false, additionalSections: [saved.id],
  });
  assert(await pagesIn(report) > 0);
  assert.equal(terminal.mock.callCount(), 1);
  assert.equal(bom.mock.callCount(), 0);
  assert.equal(texts.mock.callCount(), 0);
  assert.equal(renderTerminal.mock.callCount(), 0, "Saved report does not render the legacy appendix");
  reset();
  await assert.rejects(() => PdfExporter.exportToPdf(project, {
    ...options, includeDrawings: false,
  }), /pdfNoContent/);
  for (const fn of [bom, terminal, renderBom, renderTerminal, texts])
    assert.equal(fn.mock.callCount(), 0);

  // Explicitly choosing no appendices must not even inspect their saved data.
  const notRead = Object.defineProperty({}, "cabinetLayouts", {
    get() { throw Error("Deselected cabinet data was read"); },
  });
  assert.deepEqual(prepareProjectPdfSections(notRead as any, []), []);
  assert.deepEqual(project, before, "Selection must not remove data from the electrical project");
} finally {
  mock.restoreAll();
}
console.log("✓ PDF selection: imported report exclusion, zero generator/renderer calls for omitted lists, independent saved templates, exact source-page selection and immutable project");
