import assert from "node:assert/strict";
import { handleGetPartsList } from "../ai/mcp-tools/handlers";
import { fixture, add } from "../layout/testing/fixture";
import type { AssignedArticle } from "./ArticleTypes";
import { CableArticleEditPlan } from "./CableArticleEditPlan";
import { cablePartFindings, assessCablePart } from "./CableArticles";
import {
  dimensioningArticleCandidates,
  circuitArticleIssues,
} from "./DimensioningArticles";
import { newDimensioning } from "./ElectricalDimensioning";
import { PartsListGenerator, partQuantityLabel } from "../reports/PartsList";
import { inspectWiring, cableSchedule } from "./WiringManagement";
import { inspectElectricalProject } from "./ElectricalInspection";
import {
  manufacturingRows,
  defaultReportTemplate,
} from "../reports/ManufacturingReports";
import { ProjectHistory } from "./ProjectHistory";
import { projectArticles } from "./ArticleCatalog";
import { setArticleAssignment } from "./ArticleAssignments";
import { saveProjectRevision, readProjectRevision } from "./ProjectRevisions";
import { analyzeChangeImpact } from "./ChangeImpact";
import { circuitArticleRows } from "./CircuitArticleSelection";
import { setUiLanguage, t } from "../i18n";

const part = (number = "0001", section = 2.5): AssignedArticle => ({
  manufacturer: "CableMaker",
  articleNumber: number,
  variant: "01",
  role: "main",
  quantity: 1,
  snapshot: {
    id: "part-" + number,
    manufacturer: "CableMaker",
    articleNumber: number,
    variant: "01",
    description: "Sourced installation cable",
    origin: "user",
    verification: "user_checked",
    electrical: {
      version: 1,
      kind: "cable",
      source: "Cable data sheet",
      conditions: "Reference installation",
      cores: 3,
      sectionMm2: section,
      material: "copper",
      ratedVoltageV: 500,
      currentType: "ac_dc",
      ampacityA: 25,
      resistance20OhmKm: 7.41,
      reactanceOhmKm: 0,
      adiabaticK: 115,
    },
  },
});
const p = fixture();
add(p, "Q1");
add(p, "X1");
p.pages[0].wires = [
  {
    id: "wire",
    from: { componentId: "Q1", pinId: "2" },
    to: { componentId: "X1", pinId: "1" },
    potential: "L1",
    lengthMm: 999999,
    crossSection: "1.5",
  },
];
p.pages[0].cables = [
  {
    id: "cable",
    bmk: "-W1",
    cableType: "Old type",
    crossSection: "1.5",
    coreCount: 2,
    start: { x: 20, y: 20 },
    end: { x: 60, y: 20 },
    cores: [{ id: "core", t: 0.5, designation: "1", wireIds: ["wire"] }],
  },
];
p.dimensioning = [
  {
    ...newDimensioning("Feed"),
    id: "calc",
    system: "ac1",
    currentA: 10,
    lengthM: 5,
    voltageV: 230,
  },
  { ...newDimensioning("Second circuit"), id: "second" },
];
const address = { pageId: "p", cableId: "cable" };
const edit = {
  article: part(),
  lengthM: 12.75,
  adoptSpecification: true,
  circuitIds: ["calc"],
  adoptCircuitValues: true,
  confirmFullLength: true,
};
const original = structuredClone(p),
  plan = new CableArticleEditPlan(p, address, edit),
  next = plan.apply(p);
assert.deepEqual(
  p,
  original,
  "Constructing a preview must not modify the project",
);
assert.equal(next.pages[0].cables![0].crossSection, "2.5");
assert.equal(next.pages[0].cables![0].coreCount, 3);
assert.equal(
  next.pages[0].cables![0].cores.length,
  1,
  "Adoption never invents or deletes core wiring",
);
assert.deepEqual(next.pages[0].wires, p.pages[0].wires);
assert.deepEqual(next.pages[0].components, p.pages[0].components);
assert.equal(
  next.dimensioning![0].lengthM,
  12.75,
  "Do not derive length from the diagram or add conductor lengths",
);
assert.equal(next.dimensioning![0].sectionMm2, 2.5);
assert.equal(next.dimensioning![0].ampacityA, 25);
assert.deepEqual(next.dimensioning![0].articles!.cable!.cable, {
  ...address,
  adoptedLengthM: 12.75,
});
assert.deepEqual(next.dimensioning![1], p.dimensioning![1]);
assert.deepEqual(circuitArticleIssues(next, next.dimensioning![0]), []);
assert.equal(plan.calculations[0].after.lengthM, next.dimensioning![0].lengthM);
assert.equal(
  PartsListGenerator.generatePartsList(next).find((p) => p.unit === "m")!
    .quantity,
  12.75,
);
assert.equal(
  partQuantityLabel(
    PartsListGenerator.generatePartsList(next).find((p) => p.unit === "m")!,
  ),
  "12.75 m",
);
assert(
  dimensioningArticleCandidates(next).some((a) => a.articleNumber === "0001"),
);
assert.equal(cableSchedule(next)[0].article, "CableMaker · 0001 · [01]");
assert.equal(cableSchedule(next)[0].lengthM, 12.75);
const rows = manufacturingRows(next, "cables");
assert.equal(rows[0].cells.c8, "CableMaker · 0001 · [01]");
assert.equal(rows[0].cells.c9, "12.75");
assert(defaultReportTemplate("cables").columns.some((c) => c.id === "c9"));
const history = new ProjectHistory();
history.reset(p);
history.record(next);
assert.deepEqual(history.undo(), p);
assert.deepEqual(history.redo(), next);
assert.deepEqual(
  JSON.parse(JSON.stringify(next)),
  next,
  "New associations travel with the project",
);
const moved = structuredClone(p);
moved.pages[0].cables![0].start.x += 5;
assert.throws(() => plan.apply(moved), /Projekt|Project/);
for (const lengthM of [-1, NaN, Infinity])
  assert.throws(
    () => new CableArticleEditPlan(p, address, { ...edit, lengthM }),
  );
assert.throws(
  () =>
    new CableArticleEditPlan(p, address, { ...edit, confirmFullLength: false }),
);
assert.throws(
  () =>
    new CableArticleEditPlan(p, address, {
      ...edit,
      circuitIds: ["calc", "calc"],
    }),
);
assert.throws(
  () =>
    new CableArticleEditPlan(p, address, {
      ...edit,
      circuitIds: ["not-found"],
    }),
);
assert.throws(
  () => new CableArticleEditPlan(p, address, { ...edit, article: undefined }),
);
assert.throws(
  () =>
    new CableArticleEditPlan(p, address, {
      ...edit,
      article: { ...part(), role: "accessory" },
    }),
);
const wrong = part();
wrong.snapshot!.electrical!.kind = "protection";
assert.throws(
  () => new CableArticleEditPlan(p, address, { ...edit, article: wrong }),
);
const sourceConflict = structuredClone(p);
sourceConflict.dimensioning![0].reference = {
  pageId: "p",
  wireId: "wire",
  from: p.pages[0].wires[0].from,
  to: p.pages[0].wires[0].to,
  importedValues: { lengthMm: 5 },
};
assert.throws(
  () => new CableArticleEditPlan(sourceConflict, address, edit),
  /Planbezug|drawing reference/,
);

// Unknown lengths remain unknown; five cores do not make five separate purchased cable lengths.
const partial = structuredClone(next),
  extra = structuredClone(next.pages[0].cables![0]);
extra.id = "other";
extra.bmk = "-W2";
extra.lengthM = undefined;
extra.cores = [];
partial.pages[0].cables!.push(extra);
let meter = PartsListGenerator.generatePartsList(partial).find(
  (p) => p.unit === "m",
)!;
assert.equal(meter.quantity, 12.75);
assert(meter.quantityUncertain);
assert.equal(partQuantityLabel(meter), "12.75 + ? m");
assert(
  inspectWiring(partial).some(
    (i) => i.code === "cable_length_missing" && i.cableId === "other",
  ),
);
assert(
  inspectElectricalProject(partial).messages.some(
    (i) => i.ruleId === "cable_length_missing",
  ),
);
assert(
  manufacturingRows(partial, "cables").some(
    (r) =>
      r.cells.c1 === "-W2" && r.cells.c8.includes("0001") && r.cells.c9 === "",
  ),
);
extra.lengthM = 0;
assert(
  !PartsListGenerator.generatePartsList(partial).find((p) => p.unit === "m")!
    .quantityUncertain,
);
const piece = add(partial, "separate");
setArticleAssignment(piece, [part()]);
assert.equal(
  PartsListGenerator.generatePartsList(partial).filter(
    (p) => p.articleNumber === "0001",
  ).length,
  2,
  "Pieces and metres cannot be merged into one quantity",
);
const variant = structuredClone(extra);
variant.id = "variant";
variant.article = {
  ...part(),
  variant: "02",
  snapshot: { ...part().snapshot!, variant: "02" },
};
partial.pages[0].cables!.push(variant);
assert.equal(
  PartsListGenerator.generatePartsList(partial).filter((p) => p.unit === "m")
    .length,
  2,
  "Variants remain exact",
);
const unknown = new CableArticleEditPlan(p, address, {
  ...edit,
  lengthM: undefined,
  circuitIds: [],
  adoptCircuitValues: false,
}).apply(p);
assert.equal(
  PartsListGenerator.generatePartsList(unknown).find((p) => p.unit === "m")!
    .quantity,
  0,
);
assert.equal(
  partQuantityLabel(
    PartsListGenerator.generatePartsList(unknown).find((p) => p.unit === "m")!,
  ),
  "? m",
);

// Drift is visible even when the article number remains the same, including after a manager edit without re-adoption.
const changed = structuredClone(next);
changed.pages[0].cables![0].lengthM = 20;
assert(
  circuitArticleIssues(changed, changed.dimensioning![0]).some((m) =>
    /länge|length/.test(m),
  ),
);
const updatedWithoutAdoption = new CableArticleEditPlan(next, address, {
  ...edit,
  lengthM: 20,
  adoptCircuitValues: false,
}).apply(next);
assert.equal(
  updatedWithoutAdoption.dimensioning![0].articles!.cable!.cable!
    .adoptedLengthM,
  12.75,
);
assert(
  circuitArticleIssues(
    updatedWithoutAdoption,
    updatedWithoutAdoption.dimensioning![0],
  ).length,
);
const ratings = structuredClone(next);
ratings.pages[0].cables![0].article = part("0001", 4);
assert(
  circuitArticleIssues(ratings, ratings.dimensioning![0]).some((m) =>
    /Kennwerte|ratings/.test(m),
  ),
);
const detached = new CableArticleEditPlan(next, address, {
  ...edit,
  circuitIds: [],
  adoptCircuitValues: false,
}).apply(next);
assert.equal(detached.dimensioning![0].articles!.cable!.cable, undefined);
assert.equal(detached.dimensioning![0].lengthM, 12.75);
const noRatings = {
  manufacturer: "Manual",
  articleNumber: "manual-cable",
  variant: "",
  role: "main" as const,
};
const manual = new CableArticleEditPlan(p, address, {
  ...edit,
  article: noRatings,
  adoptSpecification: false,
  adoptCircuitValues: false,
}).apply(p);
assert(
  circuitArticleIssues(manual, manual.dimensioning![0]).length,
  "No guessed manufacturer ratings",
);
assert.throws(
  () => new CableArticleEditPlan(p, address, { ...edit, article: noRatings }),
);
const dc = part();
dc.snapshot!.electrical!.currentType = "dc";
dc.snapshot!.electrical!.cores = 2;
assert.equal(
  assessCablePart(dc).status,
  "ready",
  "Cable assignment has no invented AC-system or minimum core count",
);
const assessed = circuitArticleRows([dc], "cable", newDimensioning("test"));
assert.equal(
  assessed[0].assessment.status,
  "incompatible",
  "Circuit picker still enforces its actual system",
);
for (const lang of ["de", "en"] as const) {
  setUiLanguage(lang);
  for (const code of [
    "cable_article_assignment",
    "cable_length_missing",
    "cable_length_invalid",
  ] as const)
    assert.notEqual(t(code), code);
}
setUiLanguage("de");
const archived = await saveProjectRevision(next, {
    name: "Cable baseline",
    author: "Engineer",
    reason: "Documented cable source",
  }),
  baseline = archived.revisions![0];
const after = structuredClone(archived);
after.pages[0].cables![0].lengthM = 30;
const impact = await analyzeChangeImpact(
  await readProjectRevision(baseline),
  after,
  baseline,
);
assert(
  impact.rows.some(
    (r) => r.circuitId === "calc" && r.cable?.cableId === "cable",
  ),
);
assert(
  impact.rows
    .find((r) => r.kind === "documents")!
    .documents.some((d) => /Artikel|Parts/.test(d)),
);
assert.equal(
  cablePartFindings({ ...next.pages[0].cables![0], lengthM: -3 })[0].code,
  "cable_length_invalid",
);
console.log(
  "Cable articles: exact identity, sourced values, metre BOM, unknown lengths, circuit drift, report data, snapshots, atomic preview, undo and cable-aware impacts passed",
);

assert(projectArticles(next).some((a) => a.articleNumber === "0001"));

const quantities = await handleGetPartsList({}, {
  getProject: () => partial,
} as any);
const allParts = PartsListGenerator.generatePartsList(partial);
assert.equal(
  quantities.totalQuantity,
  allParts.filter((p) => p.unit !== "m").reduce((n, p) => n + p.quantity, 0),
);
assert.equal(quantities.cableLengthM, 12.75);
assert.equal(quantities.quantityUnit, "piece");
const mismatched = part();
mismatched.snapshot!.articleNumber = "other";
assert.throws(
  () => new CableArticleEditPlan(p, address, { ...edit, article: mismatched }),
  /Identit|identit/,
);
const assembly = structuredClone(next);
assembly.pages[0].groups = [
  {
    id: "kit",
    members: [{ kind: "cable", id: "cable" }],
    articleNumber: "KIT",
    manufacturer: "Maker",
  },
];
const assemblyParts = PartsListGenerator.generatePartsList(assembly);
assert(assemblyParts.some((p) => p.articleNumber === "KIT"));
assert(
  !assemblyParts.some((p) => p.unit === "m"),
  "A cable included in a composite article is not purchased twice",
);
