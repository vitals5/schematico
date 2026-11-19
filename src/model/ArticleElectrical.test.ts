import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { validateElectricalData } from "./ArticleElectrical";
import {
  validateCatalogArticle,
  catalogToJson,
  catalogToCsv,
  parseCatalogFile,
  ArticleCatalog,
  catalogRevision,
  projectArticles,
} from "./ArticleCatalog";
import {
  appendPublicArticle,
  validatePublicArticle,
} from "../shared/catalog-publication.mjs";
import { fixture, add } from "../layout/testing/fixture";
import { setArticleAssignment, effectiveArticles } from "./ArticleAssignments";
export const electrical = {
  version: 1 as const,
  kind: "protection" as const,
  source: "Manufacturer data sheet, table 2",
  conditions: "230 V AC, test conditions",
  currentType: "ac" as const,
  ratedVoltageV: 230,
  poles: 1,
  protectiveCurrentA: 16,
  conventionalTripA: 23.2,
  breakingCapacityA: 6000,
  characteristic: "B",
  curve: [
    { currentA: 32, timeMinS: 1, timeMaxS: 10 },
    { currentA: 80, timeMinS: 0.01, timeMaxS: 0.1 },
  ],
};
const a = validateCatalogArticle({
  articleNumber: "00016",
  manufacturer: "Example",
  variant: "A",
  description: "Test part",
  origin: "user",
  verification: "unverified",
  electrical,
  symbolId: "circuit_breaker_1p",
});
assert.deepEqual(a.electrical, electrical);
assert.equal(validateElectricalData({ ...electrical }).protectiveCurrentA, 16);
for (const raw of [
  { ...electrical, source: "" },
  { ...electrical, protectiveCurrentA: -1 },
  { ...electrical, poles: 1.5 },
  { ...electrical, breakingCapacityA: NaN },
  { ...electrical, unknown: 1 },
  { ...electrical, curve: [...electrical.curve].reverse() },
  { ...electrical, conditions: "" },
  {
    ...electrical,
    curve: [
      { currentA: 1, timeMinS: 2, timeMaxS: 1 },
      { currentA: 2, timeMinS: 1, timeMaxS: 2 },
    ],
  },
  { version: 1, kind: "cable", source: "Table", ampacityA: 25 },
  { ...electrical, material: "copper" },
])
  assert.throws(() => validateElectricalData(raw), /articlesElectricalInvalid/);
for (const format of ["json", "csv"] as const) {
  const parsed = parseCatalogFile(
    format === "json" ? catalogToJson([a]) : catalogToCsv([a]),
    format,
  );
  assert.deepEqual(parsed[0].electrical, electrical);
}
const store = new ArticleCatalog();
await store.merge([a], false, catalogRevision(await store.list()));
assert.deepEqual((await store.list())[0].electrical, electrical);
assert.deepEqual(validatePublicArticle(a).electrical, electrical);
const catalog = { schema: "schematico-articles", version: 1, articles: [a] };
assert.equal(appendPublicArticle(catalog, a).changed, false);
assert.throws(
  () =>
    appendPublicArticle(catalog, {
      ...a,
      electrical: { ...electrical, protectiveCurrentA: 20 },
    }),
  /githubCatalogConflict/,
);
const p = fixture(),
  c = add(p, "F1");
setArticleAssignment(c, [
  {
    articleNumber: a.articleNumber,
    manufacturer: a.manufacturer,
    variant: a.variant,
    role: "main",
    snapshot: a,
  },
]);
assert.deepEqual(effectiveArticles(c, p)[0].snapshot?.electrical, electrical);
assert.deepEqual(projectArticles(p)[0].electrical, electrical);
console.log(
  "✓ Sourced electrical ratings: ranges, curve bounds, catalogue JSON/CSV/storage, publication conflicts and portable device snapshots",
);
