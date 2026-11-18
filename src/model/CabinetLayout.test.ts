import assert from "node:assert/strict";
import { fixture, add } from "../layout/testing/fixture";
import {
  cabinetCandidates,
  inspectCabinet,
  moveCabinetItem,
  railCapacity,
  CabinetLayoutEdit,
  cabinetBounds,
  type CabinetLayout,
  type CabinetItem,
} from "./CabinetLayout";
import { setArticleAssignment } from "./ArticleAssignments";
import {
  validateCatalogArticle,
  catalogToCsv,
  parseCatalogFile,
} from "./ArticleCatalog";
import { ProjectHistory } from "./ProjectHistory";
import { PartsListGenerator } from "../reports/PartsList";
import { ArticleEditPlan } from "./ArticleEdit";
const p = fixture(),
  a = add(p, "a", "contactor_coil"),
  b = add(p, "b", "contactor_coil", 300, 300);
a.bmk = b.bmk = "-K1";
const record = validateCatalogArticle({
  articleNumber: "DIM",
  manufacturer: "Synthetic",
  variant: "",
  description: "Dimensions",
  origin: "user",
  verification: "unverified",
  dimensions: { widthMm: 18, heightMm: 90, depthMm: 70 },
});
setArticleAssignment(a, [
  {
    articleNumber: "DIM",
    manufacturer: "Synthetic",
    variant: "",
    quantity: 1,
    role: "main",
    snapshot: record,
  },
]);
assert.deepEqual(
  validateCatalogArticle(JSON.parse(JSON.stringify(record))).dimensions,
  record.dimensions,
);
assert.deepEqual(
  parseCatalogFile(catalogToCsv([record]), "csv")[0].dimensions,
  record.dimensions,
);
for (const dimensions of [
  { widthMm: 0, heightMm: 90 },
  { widthMm: 18, heightMm: NaN },
  { widthMm: 18 },
  { widthMm: 18, heightMm: 90, depthMm: -1 },
])
  assert.throws(
    () => validateCatalogArticle({ ...record, dimensions }),
    /articlesCatalogInvalid/,
  );
const candidates = cabinetCandidates(p);
assert.equal(
  candidates.length,
  2,
  "Same BMK does not merge independent placements",
);
assert.deepEqual(
  candidates.find((c) => c.main.componentId === "a")!.dimensions,
  record.dimensions,
);
assert.equal(
  candidates.find((c) => c.main.componentId === "b")!.dimensions,
  undefined,
  "Symbol geometry never supplies cabinet dimensions",
);
const before = structuredClone(p),
  bom = PartsListGenerator.generatePartsList(p),
  rail: CabinetItem = {
    id: "rail",
    kind: "rail",
    label: "Rail",
    x: 50,
    y: 150,
    widthMm: 400,
    heightMm: 35,
    rotation: 0,
    clearanceMm: 0,
  },
  device: CabinetItem = {
    id: "device",
    kind: "device",
    label: "K1",
    x: 60,
    y: 122.5,
    widthMm: 18,
    heightMm: 90,
    rotation: 0,
    clearanceMm: 0,
    railId: rail.id,
    source: { pageId: "p", componentId: "a" },
    articleKey: JSON.stringify(["Synthetic", "DIM", ""]),
    sizeOrigin: "article",
  },
  layout: CabinetLayout = {
    schemaVersion: 1,
    id: "plate",
    name: "Plate",
    widthMm: 600,
    heightMm: 800,
    marginMm: 10,
    gridMm: 5,
    items: [rail, device],
  };
assert.deepEqual(inspectCabinet(p, layout), []);
assert.deepEqual(railCapacity(layout, "rail"), { used: 18, free: 382 });
const moved = moveCabinetItem(layout, "rail", 67, 173);
assert.equal(moved.items[0].x, 65);
assert.equal(moved.items[1].x, 75);
assert.equal(moved.items[1].y, 147.5);
assert.deepEqual(
  layout.items[1],
  device,
  "Moving a rail is an isolated draft and carries its devices",
);
const onRail = moveCabinetItem(layout, "device", 102, 500);
assert.equal(onRail.items[1].x, 100);
assert.equal(onRail.items[1].y, 122.5);
assert.equal(cabinetBounds({ ...device, rotation: 90 }).width, 90);
const overlap = structuredClone(layout);
overlap.items.push({
  ...device,
  id: "second",
  source: { pageId: "p", componentId: "b" },
});
assert(inspectCabinet(p, overlap).some((i) => i.code === "cabinetOverlap"));
assert.equal(
  railCapacity(overlap, "rail")!.used,
  18,
  "Overlapping physical width is not double-counted",
);
assert.throws(
  () => new CabinetLayoutEdit(p, overlap).apply(p),
  /cabinetInvalid/,
);
const duplicate = structuredClone(layout);
duplicate.items.push({ ...device, id: "copy", x: 120 });
assert(
  inspectCabinet(p, duplicate).some((i) => i.code === "cabinetDuplicateDevice"),
);
const outside = moveCabinetItem(layout, "device", 590, 0);
assert(inspectCabinet(p, outside).some((i) => i.code === "cabinetOutside"));
assert(inspectCabinet(p, outside).some((i) => i.code === "cabinetRailInvalid"));
const missing = structuredClone(layout);
missing.items[1].source!.componentId = "deleted";
assert(
  inspectCabinet(p, missing).some((i) => i.code === "cabinetMissingDevice"),
);
const changed = structuredClone(p);
changed.pages[0].components[0].articleAssignment!.items[0].snapshot!.dimensions!.widthMm = 20;
assert(
  inspectCabinet(changed, layout).some(
    (i) => i.code === "cabinetArticleChanged",
  ),
);
const saved = new CabinetLayoutEdit(p, layout).apply(p);
assert.deepEqual(saved.pages, p.pages);
assert.deepEqual(
  PartsListGenerator.generatePartsList(saved),
  bom,
  "Cabinet references do not create extra BOM articles",
);
assert.deepEqual(p, before);
assert.deepEqual(JSON.parse(JSON.stringify(saved)).cabinetLayouts, [layout]);
const concurrent = structuredClone(p);
concurrent.description = "other";
assert.throws(
  () => new CabinetLayoutEdit(p, layout).apply(concurrent),
  /articlesProjectStale/,
);
const elsewhere = { ...structuredClone(layout), id: "other" };
assert(
  inspectCabinet(saved, elsewhere).some(
    (i) => i.code === "cabinetDuplicateDevice",
  ),
);
const history = new ProjectHistory();
history.reset(p);
history.record(saved);
assert.equal(history.undo()!.cabinetLayouts, undefined);
assert.deepEqual(history.redo()!.cabinetLayouts, [layout]);
assert.equal(
  new CabinetLayoutEdit(saved, layout, true).apply(saved).cabinetLayouts!
    .length,
  0,
);
const linked = new ArticleEditPlan(p, {
  kind: "link",
  targets: [
    { pageId: "p", componentId: "a" },
    { pageId: "p", componentId: "b" },
  ],
  main: { pageId: "p", componentId: "a" },
}).apply(p);
assert.equal(cabinetCandidates(linked).length, 1);
assert.equal(cabinetCandidates(linked)[0].members.length, 2);
console.log(
  "✓ Cabinet model: real article dimensions, scoped physical identities, millimetre bounds/grid, rail attachment, collisions, missing/stale data, unique placement, unchanged circuits/BOM and undo",
);
const { findCabinetPlacement } = await import("./CabinetLayout");
assert.deepEqual(findCabinetPlacement(layout, 50, 100, "rail"), {
  x: 80,
  y: 117.5,
});
assert.equal(findCabinetPlacement(layout, 500, 100, "rail"), undefined);
const first = findCabinetPlacement(layout, 50, 100)!;
assert(first.x >= 10 && first.y >= 10);
assert.equal(findCabinetPlacement(layout, NaN, 100), undefined);

const { validatePublicArticle } = await import(
  "../shared/catalog-publication.mjs"
);
assert.deepEqual(validatePublicArticle(record).dimensions, record.dimensions);
