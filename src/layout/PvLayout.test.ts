import { AutoconnectEngine } from '../model/AutoconnectEngine';
import assert from "node:assert/strict";
import { pvDraft } from "./testing/pvDraft";
import { fixture, add } from "./testing/fixture";
import { previewLayout, applyLayout } from "./service";
import { clone, topology } from "./types";
import { duplicateSchematicPage } from "./duplicate";
import { ProjectHistory } from "../model/ProjectHistory";
const { project, draft } = pvDraft(),
  original = JSON.stringify(project),
  net = topology(draft);
const preview = await previewLayout(project, "p", {}, draft);
assert.equal(preview.status, "preview_ready");
assert.equal(
  preview.before.metrics.bodyOverlaps,
  0,
  "staged zero-position objects are not the current page",
);
assert.equal(draft.pages[0].components.length, 24);
assert.equal(JSON.stringify(project), original);
applyLayout(project, preview.candidates[0], draft);
assert.equal(topology(project), net);
AutoconnectEngine.updatePageAutoconnections(project.pages[0]);
assert.equal(topology(project), net, 'Refreshing a checked layout must not introduce electrical connections');
assert(preview.candidates.every((c) => c.report.valid));
const tiny = clone(draft);
tiny.pages[0].plotFrame.width = 100;
tiny.pages[0].plotFrame.height = 100;
const failed = await previewLayout(tiny, "p", { multiPage: false });
assert.equal(failed.status, "layout_invalid");
assert(failed.issues.some((i) => i.type === "sheet_capacity"));
assert(
  !failed.issues.some(
    (i) =>
      i.type === "route_failed" ||
      i.type === "body_overlap" ||
      i.type === "sheet_overflow",
  ),
  "unplaced groups must not generate follow-on routing/collision errors",
);
assert(failed.issues.length < 20);
const source = fixture();
add(source, "Q", "contactor_coil", 100, 100);
add(source, "F", "circuit_breaker_1p", 100, 200);
source.pages[0].wires = [
  {
    id: "w",
    from: { componentId: "F", pinId: "1" },
    to: { componentId: "Q", pinId: "A2" },
    potential: "L1",
    waypoints: [{ x: 112, y: 170 }],
  },
];
source.pages[0].components[0].pins.A2.wireIds = ["w"];
source.pages[0].groups = [
  {
    id: "g",
    members: [
      { kind: "component", id: "Q" },
      { kind: "wire", id: "w" },
    ],
  },
];
source.pages[0].layoutConstraints = {
  lockedIds: ["Q"],
  containerMembers: { g: ["Q"] },
};
source.pages[0].groups!.push({ id: 'single', members: [{ kind: 'component', id: 'F' }] });
const before = JSON.stringify(source),
  history = new ProjectHistory();
history.reset(source);
const copy = duplicateSchematicPage(source, "p", "Kopie");
assert.equal(JSON.stringify(source), before);
assert.notEqual(copy.page.id, "p");
assert.equal(copy.page.groups!.length, 2);
assert.deepEqual(copy.page.groups!.map(g => g.members.length), [2, 1]);
assert.deepEqual(
  copy.page.components.map((c) => [
    c.symbolId,
    c.bmk,
    c.x,
    c.y,
    c.pins.A2?.wireIds?.length,
  ]),
  source.pages[0].components.map((c) => [
    c.symbolId,
    c.bmk,
    c.x,
    c.y,
    c.pins.A2?.wireIds?.length,
  ]),
);
const ids = new Set(copy.page.components.map((c) => c.id));
assert(
  copy.page.wires.every(
    (w) => ids.has(w.from.componentId) && ids.has(w.to.componentId),
  ),
);
assert.notEqual(copy.page.wires[0].id, "w");
assert.equal(
  copy.page.components[0].pins.A2.wireIds![0],
  copy.page.wires[0].id,
);
assert.equal(
  copy.page.layoutConstraints!.lockedIds![0],
  copy.page.components[0].id,
);
history.record(copy.project);
assert.deepEqual(history.undo(), source);
console.log(
  "✓ 24-object grouped PV regression, bounded placement diagnostics, unchanged topology and exact page duplication with undo",
);
