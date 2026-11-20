import assert from "node:assert/strict";
import { fixture } from "../layout/testing/fixture";
import { newDimensioning } from "./ElectricalDimensioning";
import { catalogCircuitArticle } from "./DimensioningArticles";
import type { AssignedArticle } from "./ArticleTypes";
import {
  protectionCoordination,
  protectionSamplesAt,
} from "./ProtectionCoordination";
import { validateElectricalData } from "./ArticleElectrical";
import {
  protectionCoordinationDrawing,
  protectionNumber,
} from "../ui/ProtectionCoordinationDrawing";
import { protectionReportRows } from "../reports/ProtectionCoordinationReport";
const make = (number: string, multiple: number): AssignedArticle => ({
  manufacturer: "TEST",
  articleNumber: number,
  variant: "A",
  role: "main",
  snapshot: {
    id: number,
    manufacturer: "TEST",
    articleNumber: number,
    variant: "A",
    description: "Test only",
    origin: "user",
    verification: "unverified",
    electrical: {
      version: 1,
      kind: "protection",
      source: "SOURCE-" + number,
      conditions: "Declared 230 V AC test conditions",
      curveKind: "overcurrent",
      ratedVoltageV: 230,
      currentType: "ac",
      protectiveCurrentA: 16 * multiple,
      conventionalTripA: 23.2 * multiple,
      poles: 1,
      curve: [
        { currentA: 100, timeMinS: 0.1 * multiple, timeMaxS: 1 * multiple },
        { currentA: 1000, timeMinS: 0.01 * multiple, timeMaxS: 0.1 * multiple },
      ],
    },
  },
});
const down = make("DOWN", 1),
  up = make("UP", 3),
  project = fixture();
const record = {
  ...newDimensioning("CURVE-CIRCUIT"),
  voltageV: 230,
  currentA: 10,
  lengthM: 20,
  sectionMm2: 2.5,
  temperatureC: 20,
  cosPhi: 1,
  reactanceOhmKm: 0,
  maxDropPercent: 3,
  articles: {
    protection: catalogCircuitArticle(down, "protection")!,
    upstream: catalogCircuitArticle(up, "upstream")!,
  },
};
const before = structuredClone(record),
  pBefore = structuredClone(project),
  data = protectionCoordination(record, project);
assert.equal(data.curves.length, 2);
assert.equal(
  data.selectivity,
  undefined,
  "Graph separation does not create selectivity evidence",
);
assert.equal(data.curves[0].source, "SOURCE-DOWN");
assert.deepEqual(data.sampleCurrents, [100, 1000]);
assert.equal(protectionSamplesAt(data, 100)[0].point?.timeMaxS, 1);
assert(
  protectionSamplesAt(data, 500).every((r) => r.point === undefined),
  "No interpolation between manufacturer points",
);
const unknown = structuredClone(record);
delete unknown.articles.protection.article.snapshot!.electrical!.curveKind;
const unknownData = protectionCoordination(unknown, project);
assert.equal(unknownData.curves.length, 1);
assert(unknownData.issues.some((m) => /Kennlinienart|Curve type/.test(m)));
const residual = structuredClone(record);
residual.articles.protection.article.snapshot!.electrical!.curveKind =
  "residual";
assert.equal(protectionCoordination(residual).curves.length, 1);
const invalid = structuredClone(record);
invalid.articles.protection.article.snapshot!.electrical!.curve![0].timeMinS =
  -1;
assert.equal(protectionCoordination(invalid).curves.length, 1);
assert.throws(() =>
  validateElectricalData({
    ...down.snapshot!.electrical!,
    curveKind: "unknown",
  }),
);
assert.equal(
  validateElectricalData({
    ...down.snapshot!.electrical!,
    curveKind: "residual",
  }).curveKind,
  "residual",
);
const drawing = protectionCoordinationDrawing(data);
assert.equal(drawing.points.length, 8);
assert(
  Math.abs(
    (drawing.x(100) + drawing.x(1000)) / 2 - drawing.x(Math.sqrt(100 * 1000)),
  ) < 1e-8,
  "Geometric-mean current maps to midpoint on logarithmic axis",
);
assert(Math.abs((drawing.y(0.01) + drawing.y(1)) / 2 - drawing.y(0.1)) < 1e-8);
for (const p of drawing.points) {
  assert(p.x >= drawing.area.left && p.x <= drawing.area.right);
  assert(p.y >= drawing.area.top && p.y <= drawing.area.bottom);
}
const extreme = structuredClone(data);
extreme.curves[0].points = [
  {
    currentA: Number.MIN_VALUE,
    timeMinS: Number.MIN_VALUE,
    timeMaxS: Number.MIN_VALUE,
  },
  { currentA: Number.MAX_VALUE, timeMinS: 1, timeMaxS: Number.MAX_VALUE },
];
for (const g of protectionCoordinationDrawing(extreme).graphics)
  for (const v of Object.values(g))
    if (typeof v === "number")
      assert(
        Number.isFinite(v),
        "Finite chart geometry at valid numerical extremes",
      );
const withProof = protectionCoordination({
  ...record,
  verifySelectivity: true,
  faultMinA: 100,
  faultMaxA: 1000,
  faultSource: "Network study",
  upstreamDevice: "TEST UP A",
  downstreamDevice: "TEST DOWN A",
  selectivityLimitA: 1500,
  selectivitySource: "Manufacturer pair table",
});
assert(withProof.markers.some((m) => m.id === "ik-max" && m.value === 1000));
assert(
  withProof.markers.some((m) => m.id === "selectivity" && m.value === 1500),
);
assert.equal(withProof.selectivity?.source, "Manufacturer pair table");
const english = protectionCoordination(record, project, "en");
assert(
  protectionReportRows(english).some((r) => r.cells.c1 === "Presentation"),
);
assert(
  protectionCoordinationDrawing(english).graphics.some(
    (g) => g.kind === "text" && g.text.includes("Current I"),
  ),
);
assert.equal(protectionNumber(1000, "en"), "1,000");
assert.equal(protectionNumber(1000, "de"), "1.000");
const rows = protectionReportRows(data);
assert.equal(rows.filter((r) => r.key.includes("protection-0")).length, 1);
assert(rows.some((r) => r.cells.c3.includes("SOURCE-DOWN")));
assert.deepEqual(record, before);
assert.deepEqual(project, pBefore);
console.log(
  "✓ Protection coordination: explicit current quantity, immutable sourced points, no interpolated proof, fault/pair markers, logarithmic geometry, numerical bounds and complete report rows",
);
