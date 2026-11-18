import assert from "node:assert/strict";
import { visualDrawingTargets as targets } from "./EngineeringDrawing";
import { terminalCableWorkspaceFixture } from "./testing/TerminalCableWorkspaceFixture";
import { wiringWorkspaceFixture } from "./testing/WiringWorkspaceFixture";
import { automationWorkspaceFixture } from "./testing/AutomationWorkspaceFixture";
import { visualKey } from "./EngineeringVisualModel";
const p = terminalCableWorkspaceFixture(),
  before = structuredClone(p),
  id = (kind: string, ...parts: unknown[]) =>
    visualKey(kind, JSON.stringify(parts));
assert.equal(
  targets(p, id("terminal", "p", "terminal-0"))[0].componentId,
  "terminal-0",
);
assert.equal(targets(p, id("core", "p", "control", "phase")).length, 2);
assert.equal(
  targets(p, id("core", "p", "control", "spare")).length,
  0,
  "Reserve cores have no invented drawing destination",
);
assert.equal(targets(p, id("core", "p", "control", "missing")).length, 0);
assert.equal(
  targets(p, id("cable", "p", "control")).length,
  4,
  "Shared consumer is deduplicated",
);
assert.equal(targets(p, id("wire", "p", "external-0", 0)).length, 2);
assert.equal(targets(p, id("terminal", "missing", "terminal-0")).length, 0);
for (const malformed of ["null", "{}", "garbage", '["terminal",null]'])
  assert.deepEqual(targets(p, malformed), []);
const duplicated = structuredClone(p);
duplicated.pages[0].components.push(
  structuredClone(
    duplicated.pages[0].components.find((c) => c.id === "terminal-0")!,
  ),
);
assert.equal(
  targets(duplicated, id("terminal", "p", "terminal-0")).length,
  0,
  "Ambiguous component destinations are omitted",
);
const w = wiringWorkspaceFixture();
assert.equal(targets(w, visualKey("contact", "housing-m", "1")).length, 1);
assert.equal(targets(w, visualKey("contact", "housing-m", "7")).length, 0);
const ap = automationWorkspaceFixture();
assert.equal(
  targets(ap, visualKey("automation", "channels", "DI-0")).length,
  1,
);
assert.equal(
  targets(ap, visualKey("automation", "channels", "DI-7")).length,
  0,
);
assert.equal(
  targets(ap, visualKey("automation", "controllers", "cpu-main")).length,
  0,
  "No inferred physical CPU mapping",
);
assert.deepEqual(
  p,
  before,
  "Navigation resolution cannot mutate geometry or electrical data",
);
console.log(
  "✓ Drawing inspection: real scoped assignments, cable/core endpoints, reserves, ambiguous/missing targets, and immutable source",
);
