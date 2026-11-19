import assert from "node:assert/strict";
import {
  newDimensioning,
  calculateDimensioning,
} from "./ElectricalDimensioning";
import {
  compareCircuitArticles,
  circuitDesignCandidate,
} from "./CircuitDesign";
import { validateCatalogArticle } from "./ArticleCatalog";
import {
  catalogCircuitArticle,
  adoptCircuitArticle,
} from "./DimensioningArticles";
import type { ArticleElectricalData } from "./ArticleElectrical";
import type { AssignedArticle } from "./ArticleTypes";
import { fixture } from "../layout/testing/fixture";
import { circuitSchematicDraft } from "./CircuitSchematic";
import { previewLayout, applyLayout } from "../layout/service";
import { preferDraftAutoconnect } from "../layout/autoconnectDraft";
import { unverifiedAutoconnections } from "../layout/autoconnectPolicy";
import { PartsListGenerator } from "../reports/PartsList";
const part = (
  number: string,
  symbolId: string | undefined,
  electrical: ArticleElectricalData,
): AssignedArticle => ({
  manufacturer: "Example",
  articleNumber: number,
  variant: "A",
  role: "main",
  quantity: 1,
  snapshot: validateCatalogArticle({
    manufacturer: "Example",
    articleNumber: number,
    variant: "A",
    description: "Test only",
    origin: "user",
    verification: "user_checked",
    symbolId,
    electrical,
  }),
});
const cable = part("00025", undefined, {
  version: 1,
  kind: "cable",
  source: "Cable table 1",
  conditions:
    "Declared installation method, loaded cores and ambient temperature",
  material: "copper",
  currentType: "ac",
  ratedVoltageV: 500,
  sectionMm2: 2.5,
  cores: 3,
  resistance20OhmKm: 7.41,
  reactanceOhmKm: 0,
  ampacityA: 25,
});
const protect = part("00016", "circuit_breaker_1p", {
  version: 1,
  kind: "protection",
  source: "Protection data sheet",
  currentType: "ac",
  ratedVoltageV: 230,
  poles: 1,
  protectiveCurrentA: 16,
  conventionalTripA: 23.2,
  breakingCapacityA: 6000,
});
const input = {
  ...newDimensioning("Test circuit"),
  voltageV: 230,
  currentA: 10,
  lengthM: 20,
  temperatureC: 20,
  cosPhi: 1,
  maxDropPercent: 3,
  temperatureFactor: 1,
  groupingFactor: 1,
  otherFactor: 1,
};
const p = fixture(),
  original = structuredClone(p),
  result = circuitDesignCandidate(input, cable, protect, p);
assert.equal(result.result.status, "checked");
assert.equal(result.issues.length, 0);
assert.equal(result.record.verifyAmpacity, true);
assert.equal(result.record.sectionMm2, 2.5);
assert.deepEqual(p, original);
assert.equal(
  circuitDesignCandidate({ ...input, currentA: 30 }, cable, protect).result
    .status,
  "failed",
);
assert.equal(
  circuitDesignCandidate({ ...input, lengthM: 300 }, cable, protect).result
    .status,
  "failed",
);
assert.equal(
  circuitDesignCandidate(
    { ...input, groupingFactor: undefined },
    cable,
    protect,
  ).result.status,
  "incomplete",
);
assert(
  circuitDesignCandidate(
    { ...input, system: "dc" },
    cable,
    protect,
  ).issues.some((i) => /Stromart|current type/i.test(i)),
);
assert(
  circuitDesignCandidate(
    { ...input, system: "ac3", voltageV: 400 },
    cable,
    protect,
  ).issues.length > 0,
);
const previous = {
  ...input,
  tripThresholdA: 80,
  thresholdTimeS: 0.1,
  letThroughA2s: 100,
  energyTimeS: 0.1,
  selectivityLimitA: 5000,
  selectivitySource: "Old device pair",
  energySource: "Old energy",
};
const replaced = circuitDesignCandidate(previous, cable, protect).record;
assert.equal(replaced.tripThresholdA, undefined);
assert.equal(replaced.selectivitySource, undefined);
assert.equal(replaced.energySource, undefined);
assert.equal(compareCircuitArticles(input, [cable, protect]).total, 1);
const selected = catalogCircuitArticle(protect, "protection")!;
assert.equal(selected.parameters?.protectiveCurrentA, 16);
assert.equal(catalogCircuitArticle(cable, "protection"), undefined);
const adopted = adoptCircuitArticle(
  { ...input, articles: { protection: selected } },
  "protection",
);
assert.equal(adopted.protectiveCurrentA, 16);
const planned = circuitSchematicDraft(p, result.record, "socket_schuko");
assert.deepEqual(p, original);
assert.equal(planned.draft.pages.length, p.pages.length + 1);
const page = planned.draft.pages.find((p) => p.id === planned.pageId)!;
assert(page.wires.length >= 4);
assert(page.wires.some((w) => w.potential === "PE"));
assert(page.wires.some((w) => w.potential === "N"));
assert.equal(
  page.components.filter((c) => c.articleNumber === "00016").length,
  1,
);
assert.equal(
  calculateDimensioning(planned.record, planned.draft).status,
  "checked",
);
// New sheets must be previewed and applied as one transaction, including sourced design records.
const raw = await previewLayout(
  p,
  planned.pageId,
  { constructionOnly: true },
  planned.draft,
);
const checked = preferDraftAutoconnect(p, planned.draft, raw, true);
assert.equal(
  checked.preview.status,
  "preview_ready",
  JSON.stringify(checked.preview.issues),
);
const candidate = checked.preview.candidates[0];
assert.equal(candidate.autoconnectRequired, true);
assert.equal(
  unverifiedAutoconnections(checked.draft, candidate.page).length,
  0,
);
const applied = structuredClone(p);
applyLayout(applied, candidate, checked.draft);
assert.equal(applied.pages.length, 2);
assert.equal(applied.dimensioning?.length, 1);
assert.equal(
  PartsListGenerator.generatePartsList(applied).find(
    (a) => a.articleNumber === "00016",
  )?.quantity,
  1,
);
assert.deepEqual(p, original);
const stale = structuredClone(p);
stale.name = "Changed";
assert.throws(() => applyLayout(stale, candidate, checked.draft), /Projekt/);
assert.throws(() =>
  circuitSchematicDraft(p, { ...result.record, currentA: 35 }, "socket_schuko"),
);
const cable3 = part("00040", undefined, {
  ...cable.snapshot!.electrical!,
  cores: 4,
});
const protect3 = part("0003P", "circuit_breaker_3p", {
  ...protect.snapshot!.electrical!,
  ratedVoltageV: 400,
  poles: 3,
});
const three = circuitDesignCandidate(
  { ...input, system: "ac3", voltageV: 400 },
  cable3,
  protect3,
  p,
);
assert.equal(three.result.status, "checked");
assert.equal(three.issues.length, 0);
const motor = circuitSchematicDraft(p, three.record, "motor_3phase");
const mraw = await previewLayout(
  p,
  motor.pageId,
  { constructionOnly: true },
  motor.draft,
);
const mchecked = preferDraftAutoconnect(p, motor.draft, mraw, true);
assert.equal(
  mchecked.preview.status,
  "preview_ready",
  JSON.stringify(mchecked.preview.issues),
);
const mp = structuredClone(p);
applyLayout(mp, mchecked.preview.candidates[0], mchecked.draft);
assert.equal(
  mp.pages[1].components.filter((c) => c.symbolId === "motor_3phase").length,
  1,
);
assert.equal(unverifiedAutoconnections(mp, mp.pages[1]).length, 0);
const allPotentials = new Set(mp.pages[1].wires.map((w) => w.potential));
for (const phase of ["L1", "L2", "L3", "PE"]) assert(allPotentials.has(phase));
assert(!allPotentials.has("N"));
assert.throws(
  () => circuitSchematicDraft(p, result.record, "motor_3phase"),
  /Verbraucher|Load/,
);
console.log(
  "✓ Circuit assistant: sourced pair comparison, missing data, overload/drop failures, exact assignment, separate N/PE, new sheet preview, verified Autoconnect, transactional apply and stale protection",
);
