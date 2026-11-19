import assert from "node:assert/strict";
import { fixture, add } from "../layout/testing/fixture";
import { projectRevision } from "../layout/types";
import {
  saveProjectRevision,
  readProjectRevision,
  releaseProjectRevision,
  restoreProjectRevision,
  removeProjectRevision,
  compareProjectRevisions,
  savedRevisions,
  assertRevisionSource,
} from "./ProjectRevisions";
import { revisionDrawing } from "../ui/RevisionDrawing";
import { ProjectHistory } from "./ProjectHistory";
const p = fixture();
add(p, "F1");
add(p, "F2", "circuit_breaker_1p", 120, 80);
p.pages[0].wires.push({
  id: "w",
  from: { componentId: "F1", pinId: "2" },
  to: { componentId: "F2", pinId: "1" },
  potential: "L1",
});
p.pages[0].texts = [{ id: "note", text: "Erster Entwurf", x: 12, y: 15 }];
const original = structuredClone(p);
const input = { name: "Entwurf A", author: "Planer", reason: "Erste Planung" };
const first = await saveProjectRevision(p, input),
  record = first.revisions![0];
assert.deepEqual(p, original);
assert.equal(record.status, "draft");
assert.deepEqual(await readProjectRevision(record), original);
const edited = structuredClone(first);
edited.pages[0].components[0].bmk = "-F100";
edited.pages[0].components[0].x += 20;
edited.pages[0].components[0].articleNumber = "000123";
edited.pages[0].texts![0].text = "Neuer Entwurf";
edited.pages[0].wires[0].crossSection = "2,5 mm²";
edited.pages[0].components.pop();
add(edited, "F3");
const diff = compareProjectRevisions(
  await readProjectRevision(record),
  edited,
  "Entwurf A",
  "Arbeitsstand",
);
assert(
  diff.changes.some(
    (c) =>
      c.kind === "component" &&
      c.id === "F1" &&
      c.fields.some((f) => f.path === "bmk"),
  ),
);
assert(
  diff.changes.some(
    (c) => c.kind === "component" && c.status === "removed" && c.id === "F2",
  ),
);
assert(
  diff.changes.some(
    (c) => c.kind === "component" && c.status === "added" && c.id === "F3",
  ),
);
assert(
  diff.changes.some(
    (c) => c.kind === "wire" && c.fields.some((f) => f.path === "crossSection"),
  ),
);
assert(
  diff.changes.some(
    (c) => c.kind === "text" && c.fields.some((f) => f.path === "text"),
  ),
);
assert.equal(diff.summary.added, 1);
assert.equal(diff.summary.removed, 1);
const view = structuredClone(p);
view.activePageId = "p";
view.modified = "new";
view.pages[0].components.reverse();
view.pages[0].components[0].pins["1"].wireIds = ["derived-cache"];
assert.equal(
  compareProjectRevisions(p, view).changes.length,
  0,
  "Object array order and derived caches do not create false electrical changes",
);
const second = await saveProjectRevision(edited, {
  ...input,
  name: "Entwurf B",
});
assert.equal(second.revisions!.length, 2);
assert.equal(
  (await readProjectRevision(second.revisions![1])).revisions,
  undefined,
  "Archives never recursively contain older archives",
);
await assert.rejects(
  () => saveProjectRevision(second, { ...input, name: "entwurf a" }),
  /bereits/,
);
const released = await releaseProjectRevision(
  second,
  record.id,
  "Prüfer",
  "Zur Fertigung freigegeben",
);
const approved = released.revisions![0];
assert.equal(approved.payload, record.payload);
assert.equal(approved.digest, record.digest);
assert.equal(approved.approval!.author, "Prüfer");
const releaseHistory = new ProjectHistory();
releaseHistory.reset(second);
releaseHistory.record(released);
assert.equal(
  releaseHistory.undo()!.revisions![0].status,
  "released",
  "A released archive cannot be unlocked by drawing undo",
);
assert.equal(releaseHistory.redo()!.revisions![0].status, "released");
assert.throws(() => removeProjectRevision(released, record.id), /Freigegebene/);
await assert.rejects(
  () => releaseProjectRevision(released, record.id, "Other", "Other"),
  /Freigegebene/,
);
const reopened = await restoreProjectRevision(
  released,
  record.id,
  "Planer",
  "Variante aus A weiterbearbeiten",
);
assert.deepEqual(reopened.pages, p.pages);
assert.equal(reopened.revisionOriginId, record.id);
assert.equal(reopened.revisions!.length, 3);
assert.deepEqual(
  (await readProjectRevision(reopened.revisions!.at(-1)!)).pages,
  released.pages,
  "Current drawing is backed up before restore",
);
assert.deepEqual(reopened.revisions![0], approved);
const history = new ProjectHistory();
history.reset(released);
history.record(reopened);
assert.deepEqual(history.undo(), released);
assert.deepEqual(history.redo(), reopened);
const file = JSON.parse(JSON.stringify(reopened));
assert.deepEqual(
  await readProjectRevision(file.revisions[0]),
  p,
  "Normal project JSON keeps portable snapshots",
);
const altered = { ...record, digest: "0".repeat(64) };
await assert.rejects(() => readProjectRevision(altered), /Integritätsprüfung/);
await assert.rejects(
  () => readProjectRevision({ ...record, bytes: 1 }),
  /übergroßer|Größe/,
);
assert.throws(
  () => savedRevisions({ ...first, revisions: [record, record] }),
  /mehrfach/,
);
const dup = structuredClone(p);
dup.pages[0].components.push(dup.pages[0].components[0]);
assert.throws(() => compareProjectRevisions(p, dup), /Mehrdeutige/);
assert.throws(
  () => assertRevisionSource(edited, projectRevision(first)),
  /verändert/,
);
const left = revisionDrawing(p, "p", diff, "before"),
  right = revisionDrawing(edited, "p", diff, "after");
assert(left.includes("data-change=") && right.includes("data-change="));
assert(left.includes("#ff7d8d") && right.includes("#65d69a"));
assert.deepEqual(p, original);
const metadataHistory = new ProjectHistory(),
  mutable = structuredClone(first);
metadataHistory.reset(mutable);
mutable.revisions![0].reason = "Nachbearbeitete Entwurfsbeschreibung";
metadataHistory.record(mutable);
assert.equal(metadataHistory.undo()!.revisions![0].reason, input.reason);
assert.equal(
  metadataHistory.redo()!.revisions![0].reason,
  mutable.revisions![0].reason,
);
console.log(
  "✓ Portable compressed revisions, immutable released payloads, attributed approval, identity/field/graphic comparison, safe working-copy restoration with backup/undo, integrity and expansion guards, stale dialogs and unchanged originals",
);
