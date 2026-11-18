import assert from "node:assert/strict";
import {
  defaultReportTemplate,
  manufacturingRows,
  validateReportTemplate,
  manufacturingTemplates,
  ReportTemplateEdit,
  encodeReportTemplate,
  decodeReportTemplate,
  selectReportRows,
  manufacturingCsv,
} from "./ManufacturingReports";
import { terminalCableWorkspaceFixture } from "../ui/testing/TerminalCableWorkspaceFixture";
import { wiringWorkspaceFixture } from "../ui/testing/WiringWorkspaceFixture";
import { ProjectHistory } from "../model/ProjectHistory";
const p = terminalCableWorkspaceFixture(),
  before = structuredClone(p),
  template = defaultReportTemplate("terminals"),
  rows = manufacturingRows(p, "terminals");
assert.equal(rows.length, 12);
assert(rows.some((r) => r.cells.c2.includes("-Q1")));
assert(rows.some((r) => r.cells.c3.includes("-M1")));
assert.equal(selectReportRows(rows, template, "Sensor").length, 1);
assert.equal(selectReportRows(rows, template, "", "missing").length, 0);
assert.equal(rows[0].targets.length, 1);
const cable = manufacturingRows(p, "cables");
assert.equal(cable.length, 7);
assert.equal(
  cable.find((r) => r.cells.c3 === "4")!.targets.length,
  0,
  "No drawing destination is invented for reserves",
);
assert.equal(cable.find((r) => r.cells.c3 === "1")!.targets.length, 2);
const empty = structuredClone(p);
empty.pages[0].cables![0].cores = [];
assert.equal(
  manufacturingRows(empty, "cables").length,
  4,
  "A cable without cores remains one real cable row",
);
const w = wiringWorkspaceFixture();
assert.equal(manufacturingRows(w, "connectors").length, 18);
assert.equal(manufacturingRows(w, "connections").length, 12);
const free = manufacturingRows(w, "connectors").filter(
  (r) => !r.targets.length,
);
assert(free.length);
assert(
  free.every(
    (r) =>
      !selectReportRows([r], defaultReportTemplate("connectors"), "", "p")
        .length,
  ),
);
assert.deepEqual(
  decodeReportTemplate(encodeReportTemplate(template)),
  template,
);
assert.throws(() => decodeReportTemplate("{}"), /reportInvalid/);
assert.throws(() => decodeReportTemplate(" ".repeat(131073)), /reportInvalid/);
for (const mutation of [
  { columns: [] },
  { fontSize: 0 },
  { fontSize: NaN },
  { paper: "a0" },
  { sortBy: "unknown" },
  { columns: [{ id: "unknown", label: "x", weight: 1 }] },
  { columns: [...template.columns, template.columns[0]] },
  { columns: [{ ...template.columns[0], weight: Infinity }] },
  { title: "" },
  { id: "../path" },
])
  assert.throws(
    () => validateReportTemplate({ ...template, ...mutation }),
    /reportInvalid/,
  );
const plan = new ReportTemplateEdit(p, {
    ...template,
    title: "Projektvorlage",
  }),
  next = plan.apply(p);
assert.equal(manufacturingTemplates(next).templates[0].title, "Projektvorlage");
assert.equal(manufacturingTemplates(next).templates.length, 4);
assert.equal(
  manufacturingTemplates(JSON.parse(JSON.stringify(next))).templates[0].title,
  "Projektvorlage",
);
assert.deepEqual(next.pages, p.pages);
assert.deepEqual(p, before);
const history = new ProjectHistory();
history.reset(p);
history.record(next);
assert.equal(history.undo()!.manufacturingReportTemplates, undefined);
assert.equal(
  history.redo()!.manufacturingReportTemplates![0].title,
  "Projektvorlage",
);
const concurrent = structuredClone(p);
concurrent.description = "changed";
assert.throws(() => plan.apply(concurrent), /articlesProjectStale/);
const invalid = structuredClone(next);
invalid.manufacturingReportTemplates!.push({ ...template });
assert.equal(
  manufacturingTemplates(invalid).invalid,
  2,
  "Duplicate identities are rejected, never picked arbitrarily",
);
const sorted = selectReportRows(rows, {
  ...template,
  sortBy: "c1",
  descending: true,
});
assert(
  sorted[0].cells.c1.localeCompare(sorted.at(-1)!.cells.c1, undefined, {
    numeric: true,
  }) >= 0,
);
const csv = manufacturingCsv(
  [{ ...rows[0], cells: { c0: "=SUM(A1)", c1: 'a"b\nnext' } }],
  { ...template, columns: template.columns.slice(0, 2) },
);
assert(csv.includes("'=SUM"));
assert(csv.includes('a""b\nnext'));
assert.deepEqual(p, before);
console.log(
  "✓ Manufacturing reports: authoritative four-source adapters, physical order, empty cables, scoped drawing targets, template validation/roundtrip, CSV escaping, stale guards and undo",
);

const removed = new ReportTemplateEdit(next, template, true).apply(next);
assert.equal(removed.manufacturingReportTemplates!.length, 0);
assert.equal(
  manufacturingTemplates(removed).templates[0].title,
  template.title,
);
assert.deepEqual(removed.pages, p.pages);
const ambiguous = structuredClone(p);
ambiguous.pages[0].cables!.push(structuredClone(ambiguous.pages[0].cables![0]));
const ambiguousRows = manufacturingRows(ambiguous, "cables");
assert.equal(
  new Set(ambiguousRows.map((r) => r.key)).size,
  ambiguousRows.length,
);
assert(
  ambiguousRows
    .filter((r) => r.cells.c1 === "-W1")
    .every((r) => r.targets.length === 0),
  "Duplicate cable IDs cannot choose an arbitrary drawing target",
);
