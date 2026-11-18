import assert from "node:assert/strict";
import {
  layoutManufacturingReport,
  manufacturingReportPdf,
} from "./ManufacturingReportPdf";
import {
  defaultReportTemplate,
  type ReportRow,
} from "../reports/ManufacturingReports";
const text =
    "Langer Funktionstext mit technischen Angaben und Umlauten für Geräte. ".repeat(
      1800,
    ),
  template = {
    ...defaultReportTemplate("terminals"),
    columns: [{ id: "c4", label: "Funktionstext", weight: 1 }],
  };
const row: ReportRow = {
  key: "long",
  cells: { c4: text },
  pages: [],
  targets: [],
};
for (const paper of ["a4", "a3"] as const)
  for (const orientation of ["portrait", "landscape"] as const) {
    const l = layoutManufacturingReport(
        { ...template, paper, orientation },
        [row],
        "Testprojekt",
      ),
      fragments = l.pages.flat();
    assert(l.pages.length > 1);
    assert(
      fragments.every(
        (f) => f.y >= l.bodyY && f.y + f.height <= l.height - 15 + 0.001,
      ),
    );
    assert.equal(fragments[0].offset, 0);
    for (let i = 1; i < fragments.length; i++)
      assert.equal(
        fragments[i].offset,
        fragments[i - 1].offset + fragments[i - 1].cells[0].length,
      );
    const reconstructed = fragments
      .flatMap((f) => f.cells[0])
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    assert.equal(
      reconstructed,
      text.trim(),
      "No row content is lost between sheets",
    );
    const doc = manufacturingReportPdf(l);
    assert.equal(doc.getNumberOfPages(), l.pages.length);
    assert(doc.output().startsWith("%PDF"));
  }
const full = layoutManufacturingReport(
  {
    ...defaultReportTemplate("connections"),
    paper: "a4",
    orientation: "portrait",
    fontSize: 12,
  },
  [],
  "Name",
);
assert.equal(full.pages.length, 1);
assert(full.columns.every((c) => c.width >= 12));
assert(
  Math.abs(
    full.columns.at(-1)!.x + full.columns.at(-1)!.width - (full.width - 12),
  ) < 0.001,
);
const two = layoutManufacturingReport(
  template,
  [
    { ...row, cells: { c4: "First" } },
    { ...row, key: "second", cells: { c4: "Second" } },
  ],
  "Project",
);
assert.equal(two.pages[0].length, 2);
assert(two.pages[0][0].y + two.pages[0][0].height <= two.pages[0][1].y);
assert.deepEqual(row.cells, { c4: text });
console.log(
  "✓ Shared preview/PDF layout: A3/A4 both orientations, bounded widths, exact line continuation across sheets, stable geometry and PDF page parity",
);
