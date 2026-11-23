import assert from "node:assert/strict";
import { fixture, add } from "../layout/testing/fixture";
import {
  TerminalRowCreationPlan,
  TERMINAL_ROW_SYMBOL_IDS,
  nextTerminalRowTag,
  nextTerminalNumber,
} from "./TerminalRowCreation";
import { TerminalEditorSession } from "./TerminalEditorSession";
import {
  terminalEditorSnapshot,
  terminalEditorChanges,
} from "../ui/TerminalEditorModel";
import {
  getSymbolById,
  getSymbolForComponent,
  setProjectSymbolLibrary,
} from "./symbols";
import { terminalStripBindings } from "./TerminalStripTypes";
import { AutoconnectEngine } from "./AutoconnectEngine";
import { componentShapes, usableArea } from "../layout/geometry";
import { contains, overlaps, union } from "../layout/rect";
import { ProjectHistory } from "./ProjectHistory";
import { effectiveArticles } from "./ArticleAssignments";
import { PartsListGenerator } from "../reports/PartsList";
import { TerminalDiagramGenerator } from "../reports/TerminalDiagram";
import { PackageHandler } from "../packages/PackageHandler";
import { setUiLanguage } from "../i18n";
setUiLanguage("de");
const identity = { plant: "", location: "", strip: "-X1" },
  baseOptions = {
    mode: "new" as const,
    identity,
    symbolId: "terminal_single",
    count: 10,
    startNumber: 1,
    title: "Terminal strip -X1",
  };
for (const units of [1, 2, 4])
  for (const id of TERMINAL_ROW_SYMBOL_IDS) {
    const p = fixture();
    p.drawingUnitsPerMm = units;
    p.pages[0].plotFrame.width = 420 * units;
    p.pages[0].plotFrame.height = 297 * units;
    setProjectSymbolLibrary(p);
    assert(getSymbolById(id, p)?.terminalDefinition, id);
    const original = structuredClone(p),
      plan = new TerminalRowCreationPlan(p, { ...baseOptions, symbolId: id }),
      next = plan.apply(p);
    assert.deepEqual(p, original);
    assert.equal(plan.members.length, 10);
    assert.equal(next.terminalStrips!.length, 1);
    assert.equal(next.terminalStrips![0].positions.length, 10);
    assert.equal(terminalStripBindings(next).issues.length, 0);
    assert(
      next.pages
        .flatMap((page) => page.components)
        .every((c) => effectiveArticles(c, next).length === 0),
    );
    assert.equal(
      PartsListGenerator.generatePartsList(next).reduce(
        (sum, row) => sum + row.quantity,
        0,
      ),
      10,
    );
    assert.equal(new Set(plan.members.map((a) => a.componentId)).size, 10);
    for (const page of next.pages) {
      const boxes = page.components.map((c) =>
        union(
          componentShapes(c, getSymbolForComponent(c, next)!, next).map(
            (s) => s.rect,
          ),
        ),
      );
      for (const box of boxes)
        assert(contains(usableArea(page, next), box), id + " bounds");
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++)
          assert(!overlaps(boxes[i], boxes[j], 1), id + " overlap");
      assert.equal(
        AutoconnectEngine.findAutoconnectPairs(page.components, 2, 0, next)
          .length,
        0,
        id + " accidental connection",
      );
      for (const c of page.components) {
        assert.equal(c.functionText, "");
        assert.equal(c.bmk, identity.strip + ":" + c.terminal!.number);
        const s = getSymbolForComponent(c, next)!,
          pin = AutoconnectEngine.getRotatedPinInfo(c, s.pins[0], s),
          grid = page.grid!;
        assert(
          Math.abs(
            (pin.worldX - grid.origin.x) / (grid.spacing / 4) -
              Math.round((pin.worldX - grid.origin.x) / (grid.spacing / 4)),
          ) < 1e-7,
        );
      }
    }
    const history = new ProjectHistory();
    history.reset(p);
    history.record(next);
    assert.deepEqual(history.undo(), p);
    assert.deepEqual(history.redo(), next);
  }
const p = fixture();
setProjectSymbolLibrary(p);
const session = new TerminalEditorSession(p);
session.createRow({ ...baseOptions, count: 0 });
assert(session.changed);
assert.equal(session.project.pages.length, 1);
assert.equal(terminalEditorSnapshot(session.project).strips.length, 1);
assert.equal(terminalEditorSnapshot(session.project).strips[0].rows.length, 0);
assert(
  terminalEditorChanges(
    terminalEditorSnapshot(p),
    terminalEditorSnapshot(session.project),
  ).some((c) => c.label === "Klemmenreihe" && c.after.includes("-X1")),
);
assert.throws(
  () => session.createRow({ ...baseOptions, count: 0 }),
  /terminalRowExists/,
);
session.createRow({
  ...baseOptions,
  mode: "append",
  count: 3,
  startNumber: 10,
});
assert.equal(session.project.terminalStrips![0].positions.length, 3);
assert.equal(nextTerminalNumber(session.project, identity), 13);
assert.equal(nextTerminalRowTag(session.project), "-X2");
const staged = structuredClone(session.project);
assert.throws(
  () =>
    session.createRow({
      ...baseOptions,
      mode: "append",
      count: 2,
      startNumber: 11,
    }),
  /terminalRowNumberUsed/,
);
assert.deepEqual(session.project, staged);
session.undo();
assert.equal(session.project.pages.length, 1);
assert.equal(session.project.terminalStrips![0].positions.length, 0);
session.redo();
assert.equal(session.project.terminalStrips![0].positions.length, 3);
assert.throws(
  () => new TerminalRowCreationPlan(p, { ...baseOptions, count: 101 }),
  /terminalRowCountInvalid/,
);
assert.throws(
  () => new TerminalRowCreationPlan(p, { ...baseOptions, startNumber: 0 }),
  /terminalRowCountInvalid/,
);
assert.throws(
  () =>
    new TerminalRowCreationPlan(p, {
      ...baseOptions,
      identity: { ...identity, strip: "-X1:3" },
    }),
  /terminalRowIdentityInvalid/,
);
const hundred = new TerminalRowCreationPlan(p, {
  ...baseOptions,
  count: 100,
  symbolId: "terminal_triple",
}).apply(p);
assert.equal(hundred.pages.flatMap((page) => page.components).length, 100);
assert(hundred.pages.length > 2);
assert.equal(
  TerminalDiagramGenerator.generateTerminalReport(hundred).get("-X1")!.length,
  300,
);
const existing = fixture();
setProjectSymbolLibrary(existing);
const old = add(existing, "old", "terminal_single", 180, 180);
old.bmk = "-X0:1";
const existingBefore = structuredClone(existing);
const onSheet = new TerminalRowCreationPlan(existing, {
  ...baseOptions,
  count: 3,
  pageId: "p",
}).apply(existing);
assert.equal(onSheet.pages.length, 1);
assert.deepEqual(
  onSheet.pages[0].components.find((c) => c.id === "old"),
  old,
);
assert.equal(
  AutoconnectEngine.findAutoconnectPairs(
    onSheet.pages[0].components,
    2,
    0,
    onSheet,
  ).length,
  0,
);
assert.deepEqual(existing, existingBefore);
const tiny = fixture();
tiny.pages[0].plotFrame.width = 30;
tiny.pages[0].plotFrame.height = 30;
assert.throws(
  () => new TerminalRowCreationPlan(tiny, { ...baseOptions, pageId: "p" }),
  /terminalRowCapacity/,
);
assert.equal(tiny.pages[0].components.length, 0);
const scoped = new TerminalRowCreationPlan(session.project, {
  ...baseOptions,
  identity: { plant: "OTHER", location: "FIELD", strip: "X1" },
  count: 1,
}).apply(session.project);
assert.equal(scoped.terminalStrips!.length, 2);
assert(
  scoped.pages
    .flatMap((page) => page.components)
    .some(
      (c) =>
        c.bmk === "-X1:1" &&
        c.higherLevelFunction === "=OTHER" &&
        c.mountingLocation === "+FIELD",
    ),
);
const stale = new TerminalRowCreationPlan(p, baseOptions);
assert.throws(
  () => stale.apply({ ...p, name: "Changed" }),
  /articlesProjectStale/,
);
assert.deepEqual(
  JSON.parse(JSON.stringify(session.project)).terminalStrips,
  session.project.terminalStrips,
);
const archive = await PackageHandler.inspectFile(
  new File([PackageHandler.generateProjectXml(session.project)], "rows.xml"),
);
assert.deepEqual(
  archive.extractedProject?.terminalStrips,
  session.project.terminalStrips,
);
console.log(
  "✓ Create/extend/empty terminal strips: all standard types at three scales, unique numbering and scoped identities, safe measured/grid placement, no accidental autoconnect, automatic extra sheets, unchanged source and no fabricated part assignments, local/application undo, atomic failures, stale guards and archive persistence",
);

// A populated target sheet retains both existing manual routes and automatic
// endpoint pairs. New independent terminals cannot intercept that conductor.
const wired = fixture();
setProjectSymbolLibrary(wired);
const upper = add(wired, "upper", "terminal_single", 180, 180),
  lower = add(wired, "lower", "terminal_single", 180, 300);
upper.bmk = "-X0:1";
lower.bmk = "-X0:2";
wired.pages[0].wires = [
  {
    id: "keep-route",
    from: { componentId: "upper", pinId: "2" },
    to: { componentId: "lower", pinId: "1" },
    potential: "Signal",
    waypoints: [{ x: 210, y: 230 }],
  },
];
const beforePairs = AutoconnectEngine.findAutoconnectPairs(
  wired.pages[0].components,
  2,
  0,
  wired,
).map((p) => [
  p.pin1.componentId,
  p.pin1.pinId,
  p.pin2.componentId,
  p.pin2.pinId,
]);
const preserved = new TerminalRowCreationPlan(wired, {
  ...baseOptions,
  count: 5,
  pageId: "p",
}).apply(wired);
assert.deepEqual(preserved.pages[0].wires, wired.pages[0].wires);
assert.deepEqual(
  AutoconnectEngine.findAutoconnectPairs(
    preserved.pages[0].components,
    2,
    0,
    preserved,
  ).map((p) => [
    p.pin1.componentId,
    p.pin1.pinId,
    p.pin2.componentId,
    p.pin2.pinId,
  ]),
  beforePairs,
);
console.log(
  "✓ Existing target-sheet routes and automatic endpoint pairs remain exactly preserved",
);
