import assert from "node:assert/strict";
import { fixture, add } from "../layout/testing/fixture";
import {
  newDimensioning,
  calculateDimensioning,
} from "./ElectricalDimensioning";
import {
  dimensioningArticleCandidates,
  captureCircuitArticle,
  adoptCircuitArticle,
  circuitArticleIssues,
} from "./DimensioningArticles";
const p = fixture(),
  c = add(p, "F1");
c.articleNumber = "00016";
c.manufacturer = "Example";
const before = structuredClone(p),
  article = dimensioningArticleCandidates(p)[0];
assert.equal(article.articleNumber, "00016");
let r = {
  ...newDimensioning("Circuit"),
  currentA: 10,
  voltageV: 230,
  cosPhi: 1,
  reactanceOhmKm: 0,
  lengthM: 20,
  sectionMm2: 2.5,
  temperatureC: 20,
  maxDropPercent: 3,
  protectiveCurrentA: 16,
  articles: {
    protection: {
      article,
      device: { pageId: p.pages[0].id, componentId: c.id },
    },
  },
};
assert(
  circuitArticleIssues(p, r).length > 0,
  "Selecting identity alone is not electrical evidence",
);
const captured = captureCircuitArticle(
  r,
  "protection",
  "Data sheet ABC, page 3",
);
const adopted = adoptCircuitArticle(captured, "protection");
assert.equal(circuitArticleIssues(p, adopted).length, 0);
assert.equal(
  adopted.protectionSource,
  "Example · 00016 · Data sheet ABC, page 3",
);
assert.equal(calculateDimensioning(adopted, p).status, "checked");
assert(
  circuitArticleIssues(p, { ...adopted, protectiveCurrentA: 20 }).length > 0,
);
const changed = structuredClone(p);
changed.pages[0].components[0].articleNumber = "00020";
assert.equal(calculateDimensioning(adopted, changed).status, "incomplete");
assert.deepEqual(
  p,
  before,
  "Association/adoption cannot rewrite the drawing or BOM",
);
assert.equal(
  circuitArticleIssues(p, JSON.parse(JSON.stringify(adopted))).length,
  0,
);
assert.equal(
  dimensioningArticleCandidates(p, [article]).length,
  1,
  "Exact identities deduplicate, retaining leading zeros",
);
assert.throws(() => captureCircuitArticle(r, "protection", ""));
console.log(
  "✓ Circuit parts, exact identity, explicit ratings/evidence, source drift, persistence and unchanged drawing/BOM",
);
