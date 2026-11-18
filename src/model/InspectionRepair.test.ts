import assert from "node:assert/strict";
import { fixture, add } from "../layout/testing/fixture";
import {
  InspectionRepairSession,
  repairUnits,
  compareRepairReports,
} from "./InspectionRepair";
import { ArticleEditPlan } from "./ArticleEdit";
import { inspectElectricalProject } from "./ElectricalInspection";
import { ProjectHistory } from "./ProjectHistory";
const p = fixture(),
  a = add(p, "a", "contactor_coil"),
  b = add(p, "b", "contactor_coil", 100, 100);
a.bmk = b.bmk = "-K1";
const before = structuredClone(p),
  addresses = [
    { pageId: "p", componentId: "a" },
    { pageId: "p", componentId: "b" },
  ];
const session = new InspectionRepairSession(p);
assert.equal(
  repairUnits(p, addresses, inspectElectricalProject(p)).length,
  2,
  "Same tag does not merge physical devices",
);
assert.equal(session.changed, false);
const items = [
  {
    articleNumber: "TEST",
    manufacturer: "Synthetic",
    variant: "",
    quantity: 1,
    role: "main" as const,
  },
];
let draft = session.project();
session.stage(
  new ArticleEditPlan(draft, {
    kind: "assign",
    targets: [addresses[0]],
    items,
  }).apply(draft),
);
assert.deepEqual(p, before);
assert(session.changed);
assert(
  session
    .comparison()
    .removed.some(
      (f) => f.ruleId === "missing_article" && f.componentId === "a",
    ),
);
assert(
  session.comparison().added.some((f) => f.ruleId === "article_spec_unknown"),
  "Unverified article data remains visibly unresolved",
);
draft = session.project();
session.stage(
  new ArticleEditPlan(draft, {
    kind: "assign",
    targets: [addresses[1]],
    items,
  }).apply(draft),
);
assert.equal(session.modifiedPlacements().length, 2);
assert.deepEqual(p, before);
const leak = session.project();
leak.pages[0].components[0].x = 999;
assert.notEqual(session.project().pages[0].components[0].x, 999);
const report = session.report(),
  copy = structuredClone(report);
const first = copy.messages[0];
first.severity = first.severity === "warning" ? "error" : "warning";
const comparison = compareRepairReports(report, copy);
assert(comparison.changed.some((f) => f.id === first.id));
assert.notEqual(
  comparison.changedDetails.find((p) => p.after.id === first.id)!.before
    .severity,
  first.severity,
);
assert(!comparison.remaining.some((f) => f.id === first.id));
const history = new ProjectHistory();
history.record(p);
const applied = session.apply(p);
assert.equal(applied.pages[0].components[0].articleNumber, "TEST");
history.record(applied);
const undone = history.undo()!;
assert.deepEqual(
  undone.pages[0].components,
  p.pages[0].components,
  "All staged editors form one undo step",
);
assert.equal(history.redo()!.pages[0].components[1].articleNumber, "TEST");
const moved = structuredClone(p);
moved.pages[0].components[0].x += 10;
assert.throws(() => session.apply(moved), /articlesProjectStale/);
const nav = structuredClone(p);
nav.activePageId = "view-only";
assert.equal(session.apply(nav).activePageId, "view-only");
assert.deepEqual(applied.pages[0].wires, p.pages[0].wires);
assert.deepEqual(
  applied.pages[0].components.map((c) => [c.x, c.y, c.rotation, c.symbolId]),
  p.pages[0].components.map((c) => [c.x, c.y, c.rotation, c.symbolId]),
);
session.reset();
assert.equal(session.changed, false);
assert.equal(session.comparison().added.length, 0);
assert.throws(() => session.apply(p), /articlesPreviewRequired/);
const linked = new ArticleEditPlan(applied, {
  kind: "link",
  targets: addresses,
  main: addresses[0],
}).apply(applied);
assert.equal(
  repairUnits(linked, [addresses[1]], inspectElectricalProject(linked))[0]
    .members.length,
  2,
);
assert.equal(
  repairUnits(linked, addresses, inspectElectricalProject(linked)).length,
  1,
);
assert.equal(
  repairUnits(
    linked,
    [{ pageId: "missing", componentId: "a" }],
    inspectElectricalProject(linked),
  ).length,
  0,
);
console.log(
  "✓ Combined inspection repair: isolated staged editors, truthful new/changed/remaining/removed findings, physical identity, stale guards, one-step undo, reset and unchanged geometry",
);
