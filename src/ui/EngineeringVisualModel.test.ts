import assert from "node:assert/strict";
import {
  clampVisualScale,
  relatedVisualIds,
  visualKey,
  visualMapLayout,
  visualMeta,
  type VisualRecord,
} from "./EngineeringVisualModel";
import {
  connectorRelationships,
  connectorCards,
  connectionCards,
} from "./WiringVisuals";
import { wiringWorkspaceFixture } from "./testing/WiringWorkspaceFixture";
import { connectorRows } from "../model/Connectors";
import { connectionList } from "../reports/ConnectionList";
import { terminalCableWorkspaceFixture } from "./testing/TerminalCableWorkspaceFixture";
import {
  terminalCableSnapshot,
  terminalStripCards,
  cableCoreCards,
} from "./TerminalCableVisuals";
import { automationWorkspaceFixture } from "./testing/AutomationWorkspaceFixture";
import { automationVisuals, automationNetworkKey } from "./AutomationVisuals";
import { inspectAutomation } from "../model/Automation";

const record = (
  id: string,
  neighbors: string[] = [],
  groups: string[] = [],
  issue = false,
): VisualRecord => ({ id, label: id, neighbors, groups, issue });
const records = [
  record("origin", ["direct"], ["saved-net"]),
  record("direct", ["indirect"]),
  record("reverse", ["origin"]),
  record("same-net", [], ["saved-net"]),
  record("indirect"),
  record("same-label-different-net", [], ["other-net"]),
];
const before = structuredClone(records);
assert.deepEqual(
  [...relatedVisualIds(records, "origin")],
  ["origin", "direct", "reverse", "same-net"],
);
assert.equal(relatedVisualIds(records, "absent").size, 0);
assert(
  !relatedVisualIds(records, "origin").has("indirect"),
  "Focus does not traverse unrelated chains",
);
assert.deepEqual(
  [
    ...relatedVisualIds(
      [record("a", ["b"]), record("a", ["c"]), record("b", ["a"]), record("c")],
      "a",
    ),
  ],
  ["a", "b", "c"],
  "Duplicate depictions share a single record identity",
);
assert.deepEqual(records, before);
assert.notEqual(visualKey("a:b", "c"), visualKey("a", "b:c"));
const safe = visualMeta('" onclick="bad', "<img src=x>", {
  neighbors: ['"'],
  groups: ["<"],
  issue: true,
});
assert(!safe.includes("<img"));
assert(safe.includes("&quot;"));
assert(safe.includes('data-eng-issue="true"'));
for (const [input, expected] of [
  [0, 0.55],
  [10, 1.5],
  [1.234, 1.23],
  [NaN, 1],
  [Infinity, 1],
])
  assert.equal(clampVisualScale(input), expected);
const boxes = [
    { id: "a", x: -100, y: 30, width: 60, height: 80 },
    { id: "b", x: 900, y: 30, width: 80, height: 80 },
  ],
  copy = structuredClone(boxes),
  map = visualMapLayout(boxes);
assert.equal(map.left, -100);
assert.equal(map.top, 30);
assert.equal(map.boxes.length, 2);
for (const b of map.boxes) {
  assert(b.x >= 4 && b.y >= 4);
  assert(b.x + b.width <= 206.001);
  assert(b.y + b.height <= 54.001);
}
assert.deepEqual(boxes, copy);
assert.equal(
  visualMapLayout([{ id: "invalid", x: NaN, y: 0, width: 0, height: 1 }]).boxes
    .length,
  0,
);

const p = wiringWorkspaceFixture(),
  rows = connectorRows(p),
  peers = connectorRelationships(rows, p.connectorPairings!),
  first = rows.find(
    (r) => r.connectorId === "housing-m" && r.position === "1",
  )!;
assert.equal(peers.get(first)?.connectorId, "housing-f");
assert.equal(peers.get(first)?.position, "1");
const altered = structuredClone(p);
altered.connectorPairings![0].contacts[0].femalePosition = "6";
altered.connectorPairings![0].contacts[5].femalePosition = "1";
const changed = connectorRows(altered);
assert.equal(
  connectorRelationships(changed, altered.connectorPairings!).get(changed[0])
    ?.position,
  "6",
  "Saved mapping, not matching names/positions",
);
assert.equal(
  connectorRelationships(rows, []).size,
  0,
  "Names alone cannot imply pairing",
);
assert.equal(
  connectorRelationships(rows, [
    ...p.connectorPairings!,
    ...p.connectorPairings!,
  ]).size,
  0,
  "Ambiguous pairings are not highlighted as certain",
);
assert(
  !connectorRelationships([...rows, { ...rows[7] }], p.connectorPairings!).has(
    first,
  ),
  "Duplicate counterpart positions cannot imply a unique relation",
);
assert(
  connectorCards(
    p.connectorAssemblies!,
    rows,
    rows,
    p.connectorPairings!,
  ).includes('data-eng-neighbors="['),
);
const connections = connectionList(p);
const samePotential = connections
  .slice(0, 2)
  .map((r, i) => ({ ...r, potential: "L1", netId: "isolated-" + i }));
const html = connectionCards(
  samePotential,
  new Map(samePotential.map((r, i) => [r, i])),
);
assert(
  html.includes("isolated-0") && html.includes("isolated-1"),
  "Highlight uses actual net identity, not potential names",
);
const snapshot = terminalCableSnapshot(terminalCableWorkspaceFixture());
assert(snapshot.bridges[0].fromKey?.includes("terminal-4"));
assert(snapshot.bridges[0].toKey?.includes("terminal-5"));
assert(
  terminalStripCards(snapshot.terminals, snapshot.bridges).includes(
    'data-eng-neighbors="[',
  ),
);
assert(cableCoreCards(snapshot.cables).includes("wire-assignment"));
const ap = automationWorkspaceFixture(),
  nodes = ap.automation!.nodes,
  automationHtml = automationVisuals(ap, inspectAutomation(ap), {
    section: "nodes",
    query: "",
    issuesOnly: false,
    controllerId: "",
    network: automationNetworkKey(nodes[0]),
    groupId: "",
  });
assert(automationHtml.includes("data-eng-id"));
assert(automationHtml.includes("data-eng-issue"));
assert(automationHtml.includes("data-eng-neighbors"));
console.log(
  "✓ Focus lens: scoped direct/reverse relationships, truthful saved mappings and net identity, ambiguity, safe attributes, bounded scale/map geometry and immutable inputs",
);
