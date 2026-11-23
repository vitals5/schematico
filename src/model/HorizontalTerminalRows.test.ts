import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { fixture, add } from "../layout/testing/fixture";
import { TerminalRowCreationPlan } from "./TerminalRowCreation";
import { TerminalRowAlignmentPlan } from "./TerminalRowAlignment";
import {
  componentBmkText,
  computeBmkPosition,
  terminalFunctionLabels,
  terminalRowAnchor,
  computePinLabelPosition,
} from "./LabelLayout";
import { getSymbolForComponent, setProjectSymbolLibrary } from "./symbols";
import { componentShapes } from "../layout/geometry";
import { PdfExporter } from "../export/PdfExporter";
import { sameConductorTopology } from "./ElectricalNetService";
import { ProjectHistory } from "./ProjectHistory";
import { TerminalDiagramGenerator } from "../reports/TerminalDiagram";
const identity = { plant: "", location: "", strip: "-X100" },
  options = {
    mode: "new" as const,
    identity,
    symbolId: "terminal_single",
    count: 18,
    startNumber: 1,
    title: "Terminal strip",
  };
const p = fixture();
setProjectSymbolLibrary(p);
let result = new TerminalRowCreationPlan(p, options).apply(p);
for (const page of result.pages) {
  if (!page.components.length) continue;
  const positions = page.components.map((c) => {
    const s = getSymbolForComponent(c, result)!,
      a = terminalRowAnchor(s);
    return { x: c.x + a.x, y: c.y + a.y };
  });
  assert(positions.every((a) => a.y === positions[0].y));
  assert(positions.slice(1).every((a, i) => a.x > positions[i].x));
  assert.equal(
    page.components.filter((c) => c.terminal?.rowDisplay === "start").length,
    1,
  );
  for (const [i, c] of page.components.entries()) {
    const s = getSymbolForComponent(c, result)!;
    assert.equal(c.bmk, "-X100:" + c.terminal!.number);
    assert.equal(
      componentBmkText(c, s),
      i === 0 ? "-X100" : c.terminal!.number,
    );
    assert(s.pins.every((pin) => !computePinLabelPosition(c, s, pin).visible));
  }
  const texts = page.components.flatMap((c) =>
    componentShapes(c, getSymbolForComponent(c, result)!, result).flatMap(
      (s) => (s.text ? [s.text.value] : []),
    ),
  );
  assert.equal(texts.filter((t) => t === "-X100").length, 1);
  assert(!texts.some((t) => t.startsWith("-X100:")));
  assert.equal(texts.length, page.components.length + 1);
  // Call the actual vector PDF renderer and inspect its emitted text, not just its inputs.
  const doc = new jsPDF(),
    printed: string[] = [];
  doc.text = ((value: string | string[]) => {
    printed.push(...(Array.isArray(value) ? value : [value]));
    return doc;
  }) as typeof doc.text;
  (PdfExporter as any).renderComponents(
    doc,
    page,
    result,
    420,
    297,
    { colorMode: "monochrome" },
    new Map(),
  );
  assert.equal(printed.filter((t) => t === "-X100").length, 1);
  assert.deepEqual(
    printed.filter((t) => /^\d+$/.test(t)).sort(),
    page.components.map((c) => c.terminal!.number).sort(),
  );
  assert(!printed.some((t) => t.startsWith("-X100:")));
}
const oldPages = result.pages.length,
  firstPage = result.pages.find((page) => page.components.length)!,
  old = structuredClone(firstPage.components);
result = new TerminalRowCreationPlan(result, {
  ...options,
  mode: "append",
  symbolId: "terminal_pe",
  count: 2,
  startNumber: 19,
}).apply(result);
assert.equal(result.pages.length, oldPages);
assert.deepEqual(
  result.pages
    .find((page) => page.id === firstPage.id)!
    .components.slice(0, old.length),
  old,
);
assert.equal(
  result.pages
    .find((page) => page.id === firstPage.id)!
    .components.filter((c) => c.terminal!.rowDisplay === "start").length,
  1,
);
const many = new TerminalRowCreationPlan(p, { ...options, count: 100 }).apply(
  p,
);
assert(many.pages.length > 2);
for (const page of many.pages) {
  if (!page.components.length) continue;
  assert.equal(
    new Set(
      page.components.map(
        (c) => c.y + terminalRowAnchor(getSymbolForComponent(c, many)!).y,
      ),
    ).size,
    1,
  );
  assert.equal(
    page.components.filter(
      (c) => componentBmkText(c, getSymbolForComponent(c, many)!) === "-X100",
    ).length,
    1,
  );
}
for (const symbolId of ["terminal_feed_3", "terminal_feed_4"]) {
  const rows = new TerminalRowCreationPlan(p, {
    ...options,
    symbolId,
    count: 8,
  }).apply(p);
  const placed = rows.pages.flatMap((p) => p.components);
  assert(placed.every((c) => c.symbolId === symbolId + "_row"));
  assert(
    placed.every(
      (c) =>
        getSymbolForComponent(c, rows)!.functionDefinition ===
        "symbol:" + symbolId,
    ),
  );
}
// Explicit repair preserves logical identities and article/report records.
const previous = fixture();
setProjectSymbolLibrary(previous);
for (let i = 0; i < 8; i++) {
  const c = add(
    previous,
    "c" + i,
    "terminal_single",
    120 + (i % 4) * 100 + Math.floor(i / 4) * 8,
    160 + Math.floor(i / 4) * 120,
  );
  c.bmk = "-X100:" + (i + 1);
  c.terminal = {
    strip: "-X100",
    number: String(i + 1),
    level: "",
    pinSides: {},
  };
}
const repaired = new TerminalRowAlignmentPlan(previous, "p", identity).apply(
  previous,
);
assert(sameConductorTopology(previous, repaired));
assert.equal(new Set(repaired.pages[0].components.map((c) => c.y)).size, 1);
assert.deepEqual(
  repaired.pages[0].components.map((c) => c.bmk),
  previous.pages[0].components.map((c) => c.bmk),
);
assert.equal(
  TerminalDiagramGenerator.generateTerminalReport(repaired).get("-X100")!
    .length,
  8,
);
const history = new ProjectHistory();
history.reset(previous);
history.record(repaired);
assert.deepEqual(history.undo(), previous);
const wired = structuredClone(previous);
wired.pages[0].wires.push({
  id: "w",
  from: { componentId: "c0", pinId: "2" },
  to: { componentId: "c4", pinId: "1" },
  potential: "Signal",
});
assert.throws(
  () => new TerminalRowAlignmentPlan(wired, "p", identity),
  /terminalRowAlignmentConnected/,
);
const first = structuredClone(firstPage.components[0]),
  symbol = getSymbolForComponent(first, result)!;
first.bmkPosition = { visible: false };
assert(!computeBmkPosition(first, symbol).visible);
assert(
  terminalFunctionLabels(first, symbol).every(
    (l) => l.key !== "terminal-number" || !l.position.visible,
  ),
);
assert.deepEqual(
  JSON.parse(JSON.stringify(result))
    .pages.flatMap((p: any) => p.components)
    .map((c: any) => c.terminal.rowDisplay),
  result.pages.flatMap((p) => p.components).map((c) => c.terminal!.rowDisplay),
);
console.log(
  "✓ Horizontal terminal runs: one baseline, rightward extension, first-only strip heading and retained full BMKs, matching measured/editor/PDF labels, no implicit bridges, multi-sheet continuation, 3/4-point row variants, undoable existing-row repair and wired-item guard",
);

const { TerminalDistributionPlan } = await import("./TerminalDistribution");
const multi = new TerminalRowCreationPlan(p, {
    ...options,
    symbolId: "terminal_triple",
    count: 1,
  }).apply(p),
  ma = multi.pages.flatMap((page) =>
    page.components.map((c) => ({ pageId: page.id, componentId: c.id })),
  )[0];
const divided = new TerminalDistributionPlan(multi, {
  kind: "split",
  target: ma,
  mode: "levels",
}).apply(multi);
assert.equal(
  divided.pages
    .flatMap((p) => p.components)
    .filter((c) => c.terminal?.rowDisplay === "start").length,
  1,
);

const { normaliseTerminalRowHeadings } = await import("./TerminalFunctions");
const deleted = structuredClone(firstPage);
deleted.components.shift();
normaliseTerminalRowHeadings(deleted);
assert.equal(deleted.components[0].terminal!.rowDisplay, "start");
assert.equal(
  deleted.components.filter((c) => c.terminal!.rowDisplay === "start").length,
  1,
);
const { PackageHandler } = await import("../packages/PackageHandler");
const archived = await PackageHandler.inspectFile(
  new File([PackageHandler.generateProjectXml(result)], "row.xml"),
);
assert.deepEqual(
  archived.extractedProject?.pages
    .flatMap((page) => page.components)
    .map((c) => c.terminal?.rowDisplay),
  result.pages
    .flatMap((page) => page.components)
    .map((c) => c.terminal?.rowDisplay),
);
