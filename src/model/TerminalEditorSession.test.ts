import assert from "node:assert/strict";
import { fixture, add } from "../layout/testing/fixture";
import { TerminalEditorSession } from "./TerminalEditorSession";
import {
  terminalEditorSnapshot,
  terminalEditorChanges,
} from "../ui/TerminalEditorModel";
import { terminalSettings } from "./WiringManagement";
import { terminalIdentity } from "./TerminalStripTypes";
import { setProjectSymbolLibrary } from "./symbols";
import { PartsListGenerator } from "../reports/PartsList";
import { ProjectHistory } from "./ProjectHistory";
import { sameConductorTopology } from "./ElectricalNetService";
import { setUiLanguage } from "../i18n";
setUiLanguage("de");
const p = fixture();
setProjectSymbolLibrary(p);
const c = add(p, "terminal", "terminal_triple", 150, 150);
c.bmk = "-X1:7";
c.functionText = "";
c.terminal = { strip: "-X1", number: "7", level: "", pinSides: {} };
const original = structuredClone(p),
  session = new TerminalEditorSession(p),
  target = { pageId: "p", componentId: c.id };
session.wiring(
  {
    kind: "terminal",
    target,
    settings: { ...terminalSettings(c), number: "8" },
  },
  "Incoming",
);
assert.equal(session.project.pages[0].components[0].functionText, "Incoming");
assert.deepEqual(p, original);
session.distribution({ kind: "split", target, mode: "levels", mainLevel: "3" });
const device = session.project.physicalDevices![0];
session.article({
  kind: "assign",
  targets: device.members,
  items: [
    {
      articleNumber: "TERM",
      manufacturer: "Synthetic",
      variant: "",
      quantity: 1,
      role: "main",
    },
  ],
});
assert.equal(
  PartsListGenerator.generatePartsList(session.project)[0].quantity,
  1,
);
const snapshot = terminalEditorSnapshot(session.project);
assert.equal(snapshot.strips.length, 1);
assert.equal(snapshot.strips[0].rows.length, 3);
assert.equal(snapshot.strips[0].rows.filter((r) => r.main).length, 1);
assert(
  snapshot.strips[0].rows.every(
    (r) => r.article === "TERM" && r.positionNumber === 1,
  ),
);
const beforeUndo = structuredClone(session.project);
session.undo();
assert(
  !session.project.pages[0].components.some((c) => c.articleNumber === "TERM"),
);
session.redo();
assert.deepEqual(session.project, beforeUndo);
const history = new ProjectHistory();
history.reset(p);
history.record(session.apply(p));
assert.deepEqual(history.undo(), p);
assert.deepEqual(p, original);
assert.throws(
  () => session.apply({ ...p, name: "changed elsewhere" }),
  /articlesProjectStale/,
);
session.reset();
assert.equal(session.changed, false);
assert.equal(session.canUndo, false);
assert.deepEqual(session.project, p);
assert.throws(
  () =>
    session.transaction((temp) => {
      temp.strip({
        kind: "initialize",
        identity: terminalIdentity(p.pages[0], c),
      });
      temp.strip({
        kind: "group",
        stripId: temp.project.terminalStrips![0].id,
        positionIds: [],
        levels: [],
      });
    }),
  /terminalStripGroupInvalid/,
);
assert.deepEqual(
  session.project,
  p,
  "A failed compound change cannot leave its initialisation staged",
);
assert(sameConductorTopology(p, session.project));
// Identical strip designations in different structure contexts stay distinct.
const scoped = structuredClone(p),
  second = {
    ...structuredClone(p.pages[0]),
    id: "p2",
    location: "+OTHER",
    components: [{ ...structuredClone(c), id: "other" }],
  };
scoped.pages.push(second);
assert.equal(terminalEditorSnapshot(scoped).strips.length, 2);
// Partial placements remain visible individually with one shared owner/article.
const feed = fixture();
setProjectSymbolLibrary(feed);
const f = add(feed, "feed", "terminal_feed_4", 100, 100);
f.bmk = "-X2:1";
f.terminal = { strip: "-X2", number: "1", level: "", pinSides: {} };
const parts = new TerminalEditorSession(feed);
parts.distribution({
  kind: "split",
  target: { pageId: "p", componentId: "feed" },
  mode: "parts",
});
const rows = terminalEditorSnapshot(parts.project).strips[0].rows;
assert.equal(rows.length, 4);
assert.equal(rows.filter((r) => r.main).length, 1);
assert(rows.every((r) => r.reports.length === 1 && r.positionNumber === 1));
assert.deepEqual(feed.pages[0].components, [f]);
console.log(
  "✓ Central terminal draft: atomic composed edits, local undo/redo/reset, one application undo, stale protection, immutable cancellation, scoped strips, physical order and shared partial ownership",
);

const review = terminalEditorChanges(terminalEditorSnapshot(p), snapshot);
assert(
  review.some((r) => r.before.includes("-X1:7") && r.after.includes("-X1:8")),
);
assert(review.some((r) => r.label.includes("Geräteposition")));
const bridgeProject = fixture();
setProjectSymbolLibrary(bridgeProject);
for (const [id, number] of [
  ["one", "1"],
  ["two", "2"],
]) {
  const c = add(
    bridgeProject,
    id,
    "terminal_single",
    100 + 100 * bridgeProject.pages[0].components.length,
    160,
  );
  c.bmk = "-X3:" + number;
  c.terminal = { strip: "-X3", number, level: "", pinSides: {} };
}
const bridgeDraft = new TerminalEditorSession(bridgeProject);
bridgeDraft.wiring({
  kind: "bridge",
  from: { pageId: "p", componentId: "one", pinId: "2" },
  to: { pageId: "p", componentId: "two", pinId: "1" },
  bridgeType: "plug",
});
const bridgeDiff = terminalEditorChanges(
  terminalEditorSnapshot(bridgeProject),
  terminalEditorSnapshot(bridgeDraft.project),
);
assert(
  bridgeDiff.some((r) => r.label === "Brücke" && r.after.includes("-X3:1:2")),
);
bridgeDraft.undo();
assert(!bridgeDraft.changed);
bridgeDraft.redo();
assert(bridgeDraft.changed);
bridgeDraft.strip({
  kind: "initialize",
  identity: { plant: "", location: "", strip: "-X3" },
});
bridgeDraft.strip({
  kind: "accessory",
  stripId: bridgeDraft.project.terminalStrips![0].id,
  description: "End bracket",
  article: {
    articleNumber: "END",
    manufacturer: "Synthetic",
    variant: "",
    quantity: 2,
    role: "accessory",
    snapshot: {
      id: "end",
      articleNumber: "END",
      manufacturer: "Synthetic",
      variant: "",
      description: "End bracket",
      origin: "user",
      verification: "user_checked",
    },
  },
});
const accessoryDiff = terminalEditorChanges(
  terminalEditorSnapshot(bridgeProject),
  terminalEditorSnapshot(bridgeDraft.project),
);
assert(
  accessoryDiff.some(
    (r) => r.label === "Zubehörposition" && r.after.includes("END"),
  ),
);
const last = bridgeDraft.project.terminalStrips![0].positions.at(-1)!;
assert(
  last.kind === "accessory" &&
    last.article.snapshot?.verification === "user_checked",
);
console.log(
  "✓ Before/after review covers changed numbers, physical positions, exact bridge endpoints and accessory parts; cached draft state follows undo and redo",
);

setUiLanguage("en");
assert(
  terminalEditorChanges(
    terminalEditorSnapshot(bridgeProject),
    terminalEditorSnapshot(bridgeDraft.project),
  ).some((r) => r.label === "Bridge"),
);
setUiLanguage("de");

const grouped = structuredClone(bridgeProject);
grouped.pages[0].groups = [
  {
    id: "g",
    name: "Assembly",
    members: [
      { kind: "component", id: "one" },
      { kind: "component", id: "two" },
    ],
  },
];
const groupedDraft = new TerminalEditorSession(grouped);
assert.throws(
  () =>
    groupedDraft.article({
      kind: "assign",
      targets: [{ pageId: "p", componentId: "one" }],
      items: [],
    }),
  /terminalStripDrawingGroup/,
);
assert(!groupedDraft.changed);
console.log("✓ Drawing-group ownership retains its existing part-edit guard");
