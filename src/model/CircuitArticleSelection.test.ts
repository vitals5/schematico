import assert from "node:assert/strict";
import { newDimensioning } from "./ElectricalDimensioning";
import type { AssignedArticle } from "./ArticleTypes";
import type { ArticleElectricalData } from "./ArticleElectrical";
import {
  assessCircuitArticle,
  filterCircuitArticles,
  selectCircuitArticle,
} from "./CircuitArticleSelection";
import { circuitArticleKey } from "./DimensioningArticles";
import { compareCircuitArticles } from "./CircuitDesign";
const part = (
  number: string,
  data?: ArticleElectricalData,
  variant = "",
  manufacturer = "Maker",
): AssignedArticle => ({
  manufacturer,
  articleNumber: number,
  variant,
  role: "main",
  snapshot: {
    id: number + variant,
    manufacturer,
    articleNumber: number,
    variant,
    description: "Test record",
    origin: "user",
    verification: "unverified",
    electrical: data,
  },
});
const cableData: ArticleElectricalData = {
  version: 1,
  kind: "cable",
  source: "Table",
  conditions: "Declared installation",
  sectionMm2: 2.5,
  ampacityA: 25,
  cores: 3,
  material: "copper",
  reactanceOhmKm: 0,
  ratedVoltageV: 500,
  currentType: "ac",
};
const protectData: ArticleElectricalData = {
  version: 1,
  kind: "protection",
  source: "Data sheet",
  protectiveCurrentA: 16,
  conventionalTripA: 23.2,
  poles: 1,
  ratedVoltageV: 230,
  currentType: "ac",
};
const cable = part("C25", cableData),
  protect = part("00016", protectData),
  other = part("00016", protectData, "other", "Other maker"),
  unknown = part("Manual"),
  dc = part("DC16", { ...protectData, currentType: "dc" }),
  wrongVoltage = part("LOW", { ...protectData, ratedVoltageV: 24 }),
  load = part("LOAD", {
    version: 1,
    kind: "load",
    source: "Load sheet",
    ratedVoltageV: 230,
    currentType: "ac",
    currentA: 9,
    cosPhi: 0.8,
  });
const input = {
  ...newDimensioning("Circuit"),
  voltageV: 230,
  currentA: 10,
  lengthM: 20,
  sectionMm2: 2.5,
  temperatureC: 20,
  cosPhi: 1,
  reactanceOhmKm: 0,
  maxDropPercent: 3,
  temperatureFactor: 1,
  groupingFactor: 1,
  otherFactor: 1,
};
assert.equal(
  assessCircuitArticle(protect, "protection", input).status,
  "ready",
);
assert.equal(
  assessCircuitArticle(unknown, "protection", input).status,
  "missing",
);
assert.equal(
  assessCircuitArticle(cable, "protection", input).status,
  "incompatible",
);
assert.equal(
  assessCircuitArticle(dc, "protection", input).status,
  "incompatible",
);
assert.equal(
  assessCircuitArticle(wrongVoltage, "protection", input).status,
  "incompatible",
);
assert.equal(
  assessCircuitArticle(protect, "protection", { ...input, system: "ac3" })
    .status,
  "incompatible",
);
const all = [cable, protect, other, unknown, dc, wrongVoltage, load];
const rows = filterCircuitArticles(all, "protection", input);
assert.deepEqual(
  new Set(rows.map((r) => r.article)),
  new Set([protect, other, unknown]),
);
assert.deepEqual(
  filterCircuitArticles(all, "protection", input, {
    query: "other maker 00016 other",
  }).map((r) => r.article),
  [other],
);
assert.equal(
  filterCircuitArticles(all, "protection", input, { includeIncompatible: true })
    .length,
  5,
);
assert.deepEqual(
  filterCircuitArticles(
    all,
    "protection",
    input,
    { projectOnly: true },
    new Set([circuitArticleKey(other)]),
  ).map((r) => r.article),
  [other],
);
assert.equal(
  filterCircuitArticles(all, "protection", input, { withRatingsOnly: true })
    .length,
  2,
);
const before = structuredClone(input),
  selected = selectCircuitArticle(input, "protection", protect, true);
assert.deepEqual(input, before);
assert.equal(selected.protectiveCurrentA, 16);
assert(selected.protectionSource?.includes("Data sheet"));
const bound = {
  ...selected,
  selectivitySource: "Old pair",
  selectivityLimitA: 3000,
  energySource: "Old energy",
  articles: {
    ...selected.articles,
    protection: {
      ...selected.articles!.protection!,
      device: { pageId: "p", componentId: "old" },
    },
  },
};
const changed = selectCircuitArticle(bound, "protection", other, false);
assert.equal(changed.articles!.protection!.device, undefined);
assert.equal(changed.selectivitySource, undefined);
assert.equal(changed.energySource, undefined);
assert.equal(changed.protectionSource, undefined);
assert.deepEqual(
  selectCircuitArticle(bound, "protection", protect, false).articles!
    .protection!.device,
  bound.articles.protection.device,
);
assert.throws(() => selectCircuitArticle(input, "protection", dc));
assert.equal(
  selectCircuitArticle(changed, "protection", undefined).articles?.protection,
  undefined,
);
const withLoad = selectCircuitArticle(
  { ...input, loadMode: "power" },
  "load",
  load,
  true,
);
assert.equal(withLoad.loadMode, "current");
assert.equal(withLoad.currentA, 9);
assert.equal(withLoad.cosPhi, 0.8);
// An exact selection beyond the bounded catalogue subset must still be compared, including its stored snapshot.
const many = Array.from({ length: 60 }, (_, i) =>
  part("C" + i, { ...cableData, sectionMm2: i + 1 }),
);
const saved = selectCircuitArticle(
  selectCircuitArticle(input, "cable", cable, true),
  "protection",
  other,
  true,
);
const fixed = compareCircuitArticles(
  saved,
  [...many, protect, other],
  24,
  undefined,
  {
    selected: {
      cable: circuitArticleKey(cable),
      protection: circuitArticleKey(other),
    },
  },
);
assert.equal(fixed.total, 1);
assert.equal(
  fixed.candidates[0].record.articles!.cable!.article.articleNumber,
  "C25",
);
assert.equal(
  fixed.candidates[0].record.articles!.protection!.article.manufacturer,
  "Other maker",
);
assert.equal(fixed.truncated, false);
assert.equal(fixed.candidates[0].result.status, "checked");
assert.equal(
  compareCircuitArticles(input, all, 24, undefined, {
    selected: { cable: "missing" },
  }).total,
  0,
  "A missing pinned part must not silently fall back to another cable",
);
assert.equal(
  compareCircuitArticles(input, all, 24, undefined, {
    cable: "C25",
    protection: "00016",
  }).total,
  2,
);
console.log(
  "✓ Role-aware article choice: unknown ratings, incompatible data, exact variants/manufacturers, project scope, explicit adoption, stale device/pair proof invalidation and pinned comparison beyond catalogue limits",
);
