import assert from "node:assert/strict";
import { fixture, add } from "../layout/testing/fixture";
import {
  saveProjectRevision,
  readProjectRevision,
  releaseProjectRevision,
} from "./ProjectRevisions";
import {
  analyzeChangeImpact,
  applyImpactProposals,
  impactProposalPreview,
  reviewChangeImpacts,
} from "./ChangeImpact";
import { selectCircuitArticle } from "./CircuitArticleSelection";
import { newDimensioning } from "./ElectricalDimensioning";
import { setArticleAssignment } from "./ArticleAssignments";
import { linkPhysicalDevice } from "./DeviceRegistry";
import { ProjectHistory } from "./ProjectHistory";
import type { AssignedArticle } from "./ArticleTypes";

const part = (number: string, current = 16): AssignedArticle => ({
  manufacturer: "Maker",
  articleNumber: number,
  variant: "01",
  role: "main",
  quantity: 1,
  snapshot: {
    id: "part-" + number,
    manufacturer: "Maker",
    articleNumber: number,
    variant: "01",
    description: "Protection",
    origin: "user",
    verification: "user_checked",
    electrical: {
      version: 1,
      kind: "protection",
      currentType: "ac",
      ratedVoltageV: 400,
      poles: 1,
      source: "Data sheet " + number,
      protectiveCurrentA: current,
      conventionalTripA: current * 1.45,
    },
  },
});
const p = fixture();
add(p, "F1");
add(p, "F2");
add(p, "F3");
setArticleAssignment(p.pages[0].components[0], [part("001")]);
setArticleAssignment(p.pages[0].components[1], [part("010")]);
p.pages[0].wires.push({
  id: "w1",
  from: { componentId: "F1", pinId: "2" },
  to: { componentId: "F3", pinId: "1" },
  potential: "L1",
  lengthMm: 10000,
  crossSection: "2,5 mm²",
});
const a = selectCircuitArticle(
  {
    ...newDimensioning("Circuit A"),
    id: "circuit-a",
    system: "ac1",
    currentA: 10,
    lengthM: 10,
    sectionMm2: 2.5,
    selectivitySource: "Old pairing",
    selectivityLimitA: 5000,
  },
  "protection",
  part("001"),
  true,
);
a.articles!.protection!.device = { pageId: "p", componentId: "F1" };
a.reference = {
  pageId: "p",
  wireId: "w1",
  from: structuredClone(p.pages[0].wires[0].from),
  to: structuredClone(p.pages[0].wires[0].to),
  importedValues: { lengthMm: 10000, crossSection: "2,5 mm²" },
};
a.selectivitySource = "Old pairing";
a.selectivityLimitA = 5000;
const b = selectCircuitArticle(
  { ...newDimensioning("Circuit B"), id: "circuit-b" },
  "protection",
  part("010"),
  true,
);
b.articles!.protection!.device = { pageId: "p", componentId: "F2" };
p.dimensioning = [a, b];
let saved = await saveProjectRevision(p, {
  name: "Baseline",
  author: "Engineer",
  reason: "Design approved for review",
});
saved = await releaseProjectRevision(
  saved,
  saved.revisions![0].id,
  "Engineer",
  "Released archive",
);
const baseline = saved.revisions![0],
  before = await readProjectRevision(baseline);
assert.equal(
  (await analyzeChangeImpact(before, saved, baseline)).rows.length,
  0,
);
const current = structuredClone(saved);
setArticleAssignment(current.pages[0].components[0], [part("002", 20)]);
const untouched = structuredClone(current);
const report = await analyzeChangeImpact(before, current, baseline);
assert.deepEqual(current, untouched, "Analysis must not mutate project state");
assert.deepEqual(
  report.rows.filter((r) => r.kind === "circuit").map((r) => r.circuitId),
  ["circuit-a"],
  "Exact binding, not shared names or catalogue-wide impact",
);
assert(
  report.rows
    .find((r) => r.circuitId === "circuit-a")!
    .checks.includes("coordination"),
);
assert(
  !report.rows
    .find((r) => r.circuitId === "circuit-a")!
    .checks.includes("voltage_drop"),
  "Protection rating change has role-specific checks",
);
assert(
  report.rows
    .find((r) => r.kind === "documents")!
    .documents.some((d) => /Artikel|Parts/.test(d)),
);
assert.equal(report.proposals.length, 1);
assert(
  !JSON.stringify(report).includes("sourceRevision"),
  "Do not duplicate the full project/archive in diagnostic exports",
);
assert.match(report.workingDigest, /^[a-f0-9]{64}$/);
const proposal = report.proposals[0];
const preview = impactProposalPreview(current, report, [proposal.id]);
assert.equal(preview[0].before.protectiveCurrentA, 16);
assert.equal(preview[0].after.protectiveCurrentA, 20);
assert.equal(
  preview[0].after.selectivitySource,
  undefined,
  "Old device-pair proof must not carry over",
);
const applied = applyImpactProposals(current, report, [proposal.id]);
assert.equal(
  applied.dimensioning![0].articles!.protection!.article.articleNumber,
  "002",
);
assert.deepEqual(applied.dimensioning![0].articles!.protection!.device, {
  pageId: "p",
  componentId: "F1",
});
assert.deepEqual(
  applied.pages,
  current.pages,
  "Calculation sync must not alter drawings or actual part assignments",
);
assert.deepEqual(
  applied.revisions,
  current.revisions,
  "Released archive and approval remain immutable",
);
assert.deepEqual(
  applied.dimensioning![0],
  preview[0].after,
  "Preview and application share the same transaction",
);
const history = new ProjectHistory();
history.reset(current);
history.record(applied);
assert.deepEqual(
  history.undo()!.dimensioning,
  current.dimensioning,
  "Batch adoption must be undoable",
);
const changedAgain = structuredClone(current);
changedAgain.pages[0].components[0].x += 8;
assert.throws(
  () => applyImpactProposals(changedAgain, report, [proposal.id]),
  /Arbeitsstand|working state/,
  "Stale proposals cannot apply",
);
assert.throws(() => applyImpactProposals(current, report, ["unknown"]));

const row = report.rows.find((r) => r.circuitId === "circuit-a")!;
const reviewed = reviewChangeImpacts(
  current,
  report,
  [row.key],
  "reviewed",
  "Engineer",
  "Ratings reviewed; remaining proofs pending",
);
const reviewedReport = await analyzeChangeImpact(before, reviewed, baseline);
assert.equal(
  reviewedReport.rows.find((r) => r.key === row.key)!.decision!.status,
  "reviewed",
);
assert.equal(
  reviewedReport.rows.length,
  report.rows.length,
  "Review notes must not create new causes",
);
assert.deepEqual(reviewed.revisions, current.revisions);
assert.throws(() =>
  reviewChangeImpacts(current, report, [row.key], "reviewed", "", "No author"),
);
const moved = structuredClone(reviewed);
moved.pages[0].components[0].x += 16;
moved.pages[0].components[0].functionTextPosition = {
  offsetX: 2,
  offsetY: 3,
  fontSize: 9,
};
const movedReport = await analyzeChangeImpact(before, moved, baseline);
assert.equal(
  movedReport.rows.find((r) => r.key === row.key)!.decision!.status,
  "reviewed",
  "Text position must not reopen electrical review",
);
const ratedAgain = structuredClone(reviewed);
ratedAgain.pages[0].components[0].articleAssignment!.items[0] = part("002", 25);
assert.equal(
  (await analyzeChangeImpact(before, ratedAgain, baseline)).rows.find(
    (r) => r.key === row.key,
  )!.decision,
  undefined,
  "Same identity with new ratings invalidates review",
);
const descriptionOnly = structuredClone(saved);
descriptionOnly.pages[0].components[0].articleAssignment!.items[0].snapshot!.description =
  "Long new description";
assert(
  !(await analyzeChangeImpact(before, descriptionOnly, baseline)).rows.some(
    (r) => r.kind === "circuit",
  ),
  "Description-only edits do not imply new electrical sizing",
);
const quantityOnly = structuredClone(saved);
quantityOnly.pages[0].components[0].articleAssignment!.items[0].quantity = 2;
const quantityReport = await analyzeChangeImpact(
  before,
  quantityOnly,
  baseline,
);
assert(!quantityReport.rows.some((r) => r.kind === "circuit"));
assert(
  quantityReport.rows
    .find((r) => r.kind === "documents")!
    .documents.some((d) => /Artikel|Parts/.test(d)),
);
const geometryOnly = structuredClone(saved);
geometryOnly.pages[0].components[0].rotation = 180;
geometryOnly.pages[0].components[0].x += 8;
assert(
  !(await analyzeChangeImpact(before, geometryOnly, baseline)).rows.some(
    (r) => r.kind === "circuit",
  ),
);
const unmapped = structuredClone(saved);
add(unmapped, "F4");
assert(
  (await analyzeChangeImpact(before, unmapped, baseline)).rows.some(
    (r) => r.kind === "unassigned" && r.addresses[0]?.componentId === "F4",
  ),
  "Do not hide unassigned engineering changes",
);

const wireChanged = structuredClone(current);
wireChanged.pages[0].wires[0].lengthMm = 20000;
wireChanged.pages[0].wires[0].crossSection = "4 mm2";
const wireReport = await analyzeChangeImpact(before, wireChanged, baseline);
const wireProposal = wireReport.proposals.find((p) => p.kind === "wire")!;
assert(wireProposal);
assert.throws(
  () => applyImpactProposals(wireChanged, wireReport, [wireProposal.id]),
  /Länge|length/,
);
const both = applyImpactProposals(
  wireChanged,
  wireReport,
  wireReport.proposals.map((p) => p.id),
  true,
);
assert.equal(both.dimensioning![0].lengthM, 20);
assert.equal(both.dimensioning![0].sectionMm2, 4);
assert.equal(
  both.dimensioning![0].protectiveCurrentA,
  20,
  "Multiple corrections must compose, not overwrite each other",
);
assert.equal(both.dimensioning![0].reference!.importedValues!.lengthMm, 20000);
const wireTask = wireReport.rows.find((r) => r.circuitId === "circuit-a")!;
const wireReviewed = reviewChangeImpacts(
  wireChanged,
  wireReport,
  [wireTask.key],
  "reviewed",
  "Engineer",
  "Conductor parameters reviewed",
);
wireReviewed.pages[0].wires[0].waypoints = [
  { x: 40, y: 50 },
  { x: 70, y: 50 },
];
assert.equal(
  (await analyzeChangeImpact(before, wireReviewed, baseline)).rows.find(
    (r) => r.key === wireTask.key,
  )!.decision!.status,
  "reviewed",
  "Rerouting geometry must not invalidate reviewed electrical changes",
);
const endpointChanged = structuredClone(wireChanged);
endpointChanged.pages[0].wires[0].to = { componentId: "F2", pinId: "1" };
assert(
  !(
    await analyzeChangeImpact(before, endpointChanged, baseline)
  ).proposals.some((p) => p.kind === "wire"),
  "Never reattach a physical reference after endpoint changes",
);
const invalidSection = structuredClone(wireChanged);
invalidSection.pages[0].wires[0].crossSection = "4-wire cable";
assert(
  !(await analyzeChangeImpact(before, invalidSection, baseline)).proposals.some(
    (p) => p.kind === "wire",
  ),
  "Do not parse free-text descriptions as cross-section",
);
const incompatible = structuredClone(current);
incompatible.pages[0].components[0].articleAssignment!.items[0].snapshot!.electrical!.currentType =
  "dc";
assert.equal(
  (await analyzeChangeImpact(before, incompatible, baseline)).proposals.length,
  0,
  "Known incompatible articles remain manual tasks",
);

// A shared conductor change affects bound devices on that actual net, not equal potential strings.
const accessoryOnly = structuredClone(current);
setArticleAssignment(accessoryOnly.pages[0].components[0], [
  { ...part("003", 25), role: "accessory" },
]);
assert.equal(
  (await analyzeChangeImpact(before, accessoryOnly, baseline)).proposals.length,
  0,
  "An accessory must never be adopted as the main protective device",
);
const netBefore = structuredClone(saved);
netBefore.pages[0].wires.push({
  id: "w2",
  from: { componentId: "F3", pinId: "1" },
  to: { componentId: "F2", pinId: "2" },
  potential: "L1",
});
const netSaved = await saveProjectRevision(netBefore, {
  name: "Net baseline",
  author: "Engineer",
  reason: "Conductor branch",
});
const netBaseline = netSaved.revisions!.at(-1)!,
  netOld = await readProjectRevision(netBaseline),
  netNew = structuredClone(netSaved);
netNew.pages[0].wires[1].crossSection = "1,5 mm²";
const netReport = await analyzeChangeImpact(netOld, netNew, netBaseline);
assert.deepEqual(
  new Set(
    netReport.rows.filter((r) => r.kind === "circuit").map((r) => r.circuitId),
  ),
  new Set(["circuit-a", "circuit-b"]),
);
// Cable data follows actual assigned conductors; moving cable graphics does not change sizing.
const cableBefore = structuredClone(saved);
cableBefore.pages[0].cables = [
  {
    id: "cable",
    start: { x: 20, y: 20 },
    end: { x: 30, y: 20 },
    bmk: "-W1",
    cableType: "Declared cable",
    crossSection: "2.5 mm²",
    cores: [{ id: "core", t: 0.5, designation: "1", wireIds: ["w1"] }],
  },
];
const cableSaved = await saveProjectRevision(cableBefore, {
    name: "Cable baseline",
    author: "Engineer",
    reason: "Assigned core",
  }),
  cableBaseline = cableSaved.revisions!.at(-1)!,
  cableOld = await readProjectRevision(cableBaseline),
  cableNew = structuredClone(cableSaved);
cableNew.pages[0].cables![0].crossSection = "4 mm²";
assert.deepEqual(
  (await analyzeChangeImpact(cableOld, cableNew, cableBaseline)).rows
    .filter((r) => r.kind === "circuit")
    .map((r) => r.circuitId),
  ["circuit-a"],
);
const cableMove = structuredClone(cableSaved);
cableMove.pages[0].cables![0].start.x += 8;
assert(
  !(await analyzeChangeImpact(cableOld, cableMove, cableBaseline)).rows.some(
    (r) => r.kind === "circuit" || r.kind === "unassigned",
  ),
);
// Valid secondary representations resolve to the confirmed main device and synchronize that exact binding.
const grouped = structuredClone(saved);
grouped.pages[0].components[2].bmk = grouped.pages[0].components[0].bmk;
linkPhysicalDevice(
  grouped,
  [
    { pageId: "p", componentId: "F1" },
    { pageId: "p", componentId: "F3" },
  ],
  { pageId: "p", componentId: "F1" },
);
grouped.dimensioning![0].articles!.protection!.device = {
  pageId: "p",
  componentId: "F3",
};
const groupedSaved = await saveProjectRevision(grouped, {
    name: "Grouped baseline",
    author: "Engineer",
    reason: "Confirmed physical device",
  }),
  groupedBaseline = groupedSaved.revisions!.at(-1)!,
  groupedOld = await readProjectRevision(groupedBaseline),
  groupedNew = structuredClone(groupedSaved);
setArticleAssignment(groupedNew.pages[0].components[0], [part("003", 25)]);
const groupedReport = await analyzeChangeImpact(
  groupedOld,
  groupedNew,
  groupedBaseline,
);
assert.equal(groupedReport.proposals.length, 1);
assert.deepEqual(groupedReport.proposals[0].device, {
  pageId: "p",
  componentId: "F1",
});
assert.deepEqual(
  applyImpactProposals(groupedNew, groupedReport, [
    groupedReport.proposals[0].id,
  ]).dimensioning![0].articles!.protection!.device,
  { pageId: "p", componentId: "F1" },
);
// A wire ID is scoped by page, and a duplicate global endpoint ID must never permit numeric adoption.
const otherPage = structuredClone(saved),
  extra = fixture();
add(extra, "otherA");
add(extra, "otherB");
extra.pages[0].id = "other-page";
extra.pages[0].wires = [
  {
    ...structuredClone(otherPage.pages[0].wires[0]),
    from: { componentId: "otherA", pinId: "1" },
    to: { componentId: "otherB", pinId: "1" },
  },
];
otherPage.pages.push(extra.pages[0]);
const otherSaved = await saveProjectRevision(otherPage, {
    name: "Two pages",
    author: "Engineer",
    reason: "Scoped wire IDs",
  }),
  otherBaseline = otherSaved.revisions!.at(-1)!,
  otherOld = await readProjectRevision(otherBaseline),
  otherNew = structuredClone(otherSaved);
otherNew.pages[1].wires[0].lengthMm = 60000;
assert(
  !(await analyzeChangeImpact(otherOld, otherNew, otherBaseline)).rows.some(
    (r) => r.kind === "circuit",
  ),
);
otherNew.pages[1].components[0].id = "F1";
otherNew.pages[0].wires[0].lengthMm = 20000;
const ambiguousReport = await analyzeChangeImpact(
  otherOld,
  otherNew,
  otherBaseline,
);
assert(!ambiguousReport.proposals.some((p) => p.kind === "wire"));
assert(ambiguousReport.diagnostics.length);
console.log(
  "Change impact: binding scope, ratings, provenance, review invalidation, previews, transactions, net dependencies and immutable archives passed",
);
