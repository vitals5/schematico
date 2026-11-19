import assert from "node:assert/strict";
import { fixture, add } from "../layout/testing/fixture";
import {
  newDimensioning,
  calculateDimensioning,
  dimensioningResults,
  withDimensioning,
  connectionDimensioning,
  type CircuitDimensioning,
} from "./ElectricalDimensioning";
import { inspectElectricalProject } from "./ElectricalInspection";
import { connectionList } from "../reports/ConnectionList";
import {
  dimensioningReportRows,
  dimensioningColumns,
  engineeringReportCsv,
} from "../reports/EngineeringCalculations";
import { ProjectHistory } from "./ProjectHistory";
const base: CircuitDimensioning = {
  ...newDimensioning("Abgang 1"),
  system: "dc",
  voltageV: 24,
  currentA: 10,
  lengthM: 25,
  sectionMm2: 2.5,
  temperatureC: 20,
  maxDropPercent: 15,
};
const close = (actual: number | undefined, expected: number) =>
  assert(
    actual !== undefined &&
      Math.abs(actual - expected) <= Math.max(1e-8, Math.abs(expected) * 1e-10),
    `${actual} ≠ ${expected}`,
  );
let r = calculateDimensioning(base);
assert.equal(r.status, "checked");
close(r.values.resistanceOhmKm, 7);
close(r.values.dropV, 3.5);
close(r.values.lossW, 35);
close(r.values.dropPercent, (100 * 3.5) / 24);
assert.equal(
  calculateDimensioning({ ...base, maxDropPercent: 10 }).status,
  "failed",
);
close(
  calculateDimensioning({ ...base, material: "aluminium" }).values
    .resistanceOhmKm,
  11.28,
);
close(
  calculateDimensioning({ ...base, resistance20OhmKm: 8, temperatureC: 70 })
    .values.resistanceOhmKm,
  8 * (1 + 0.00393 * 50),
);
const ac: CircuitDimensioning = {
  ...base,
  system: "ac1",
  voltageV: 230,
  cosPhi: 1,
  reactanceOhmKm: 0,
  maxDropPercent: 3,
};
close(calculateDimensioning(ac).values.dropV, 3.5);
const three: CircuitDimensioning = {
  ...ac,
  system: "ac3",
  voltageV: 400,
  currentA: 16,
};
r = calculateDimensioning(three);
close(r.values.dropV, ((Math.sqrt(3) * 25) / 1000) * 16 * 7);
close(r.values.lossW, 134.4);
const motor = {
  ...three,
  loadMode: "power" as const,
  outputPowerW: 11000,
  efficiency: 0.9,
  cosPhi: 0.8,
  reactanceOhmKm: 0.08,
};
close(
  calculateDimensioning(motor).values.currentA,
  11000 / (400 * 0.9 * 0.8 * Math.sqrt(3)),
);
assert(
  calculateDimensioning({ ...motor, powerFactorKind: "leading" }).values
    .dropV! < calculateDimensioning(motor).values.dropV!,
);
assert.equal(
  calculateDimensioning({ ...ac, reactanceOhmKm: undefined }).status,
  "incomplete",
  "AC reactance is never silently assumed",
);
assert.equal(
  calculateDimensioning({ ...ac, maxDropPercent: undefined }).status,
  "incomplete",
  "No invented normative voltage-drop limit",
);
for (const bad of [NaN, Infinity, -1])
  assert.equal(
    calculateDimensioning({ ...base, sectionMm2: bad }).status,
    "incomplete",
  );
assert.equal(
  calculateDimensioning({ ...ac, cosPhi: 1.1 }).status,
  "incomplete",
);
assert.equal(
  calculateDimensioning({ ...motor, efficiency: 0 }).status,
  "incomplete",
);
const protection: CircuitDimensioning = {
  ...ac,
  verifyAmpacity: true,
  ampacityA: 25,
  temperatureFactor: 0.9,
  groupingFactor: 0.8,
  otherFactor: 1,
  ampacitySource: "Iz0: approved table, B2, 2 loaded conductors, PVC",
  protectiveCurrentA: 16,
  conventionalTripA: 23.2,
  protectionSource: "Device data, 230 V, AC",
};
r = calculateDimensioning(protection);
close(r.values.ampacityA, 18);
assert.equal(r.status, "checked");
assert.equal(
  calculateDimensioning({ ...protection, groupingFactor: 0.5 }).checks.find(
    (c) => c.id === "ampacity",
  )!.status,
  "fail",
);
assert.equal(
  calculateDimensioning({ ...protection, conventionalTripA: 30 }).checks.find(
    (c) => c.id === "overload",
  )!.status,
  "fail",
);
assert.equal(
  calculateDimensioning({ ...protection, ampacitySource: "" }).status,
  "incomplete",
);
const fault: CircuitDimensioning = {
  ...protection,
  verifyFault: true,
  faultMode: "loop",
  phaseEarthVoltageV: 230,
  loopMaxOhm: 2,
  loopMinOhm: 0.1,
  voltageFactorMin: 0.95,
  voltageFactorMax: 1.1,
  faultSource: "Whole loop including source, min/max",
  faultMaxA: 2530,
  faultMaximumSource: "Network study: maximum over all relevant faults",
  tripThresholdA: 80,
  thresholdTimeS: 0.1,
  requiredDisconnectS: 0.4,
  breakingCapacityA: 6000,
};
r = calculateDimensioning(fault);
assert.equal(r.status, "checked");
close(r.values.faultMinA, 109.25);
close(r.values.faultMaxA, 2530);
close(r.values.loopFaultMaxA, 2530);
assert.equal(
  calculateDimensioning({ ...fault, faultMaxA: undefined }).status,
  "incomplete",
  "Single-pole loop maximum cannot prove worst network short circuit",
);
assert(
  calculateDimensioning({ ...fault, faultMaxA: 1000 }).checks.some(
    (c) => c.id === "fault_envelope" && c.status === "missing",
  ),
);

assert.equal(
  calculateDimensioning({ ...fault, tripThresholdA: 120 }).checks.find(
    (c) => c.id === "disconnection",
  )!.status,
  "fail",
);
assert.equal(
  calculateDimensioning({ ...fault, thresholdTimeS: 0.5 }).checks.find(
    (c) => c.id === "disconnection",
  )!.status,
  "fail",
);
assert.equal(
  calculateDimensioning({ ...fault, breakingCapacityA: 2000 }).checks.find(
    (c) => c.id === "breaking",
  )!.status,
  "fail",
);
const direct = {
  ...fault,
  faultMode: "direct" as const,
  faultMinA: 120,
  faultMaxA: 3000,
};
close(calculateDimensioning(direct).values.faultMaxA, 3000);
assert.equal(
  calculateDimensioning({ ...direct, faultMaxA: 100 }).status,
  "incomplete",
);
const complete: CircuitDimensioning = {
  ...fault,
  verifyAdiabatic: true,
  adiabaticK: 115,
  letThroughA2s: 50000,
  energyTimeS: 0.1,
  energySource: "Cable k and device I²t envelope for fault range",
  verifySelectivity: true,
  upstreamDevice: "Fuse 63A article A",
  downstreamDevice: "MCB 16A article B",
  selectivityLimitA: 3000,
  selectivitySource: "Manufacturer pair table at 230 V",
};
r = calculateDimensioning(complete);
assert.equal(r.status, "checked");
close(r.values.withstandA2s, (115 * 2.5) ** 2);
assert.equal(
  calculateDimensioning({ ...complete, letThroughA2s: 100000 }).checks.find(
    (c) => c.id === "adiabatic",
  )!.status,
  "fail",
);
assert.equal(
  calculateDimensioning({ ...complete, selectivityLimitA: 2000 }).checks.find(
    (c) => c.id === "selectivity",
  )!.status,
  "fail",
);
assert.equal(
  calculateDimensioning({ ...complete, selectivitySource: undefined }).status,
  "incomplete",
  "No selectivity claimed without pair evidence",
);
assert.equal(
  calculateDimensioning({ ...complete, energyTimeS: 6 }).status,
  "incomplete",
  "Adiabatic method has a bounded duration",
);
const p = fixture();
add(p, "F1");
add(p, "F2");
p.pages[0].wires = [
  {
    id: "line",
    from: { componentId: "F1", pinId: "2" },
    to: { componentId: "F2", pinId: "1" },
    potential: "L1",
    lengthMm: 25000,
    crossSection: "2.5 mm²",
  },
];
const before = structuredClone(p),
  row = connectionList(p)[0],
  draft = connectionDimensioning(p, row);
assert.equal(
  draft.lengthM,
  undefined,
  "No automatic full-circuit length claim from a line segment",
);
const linked = { ...complete, reference: draft.reference },
  next = withDimensioning(p, linked);
assert.deepEqual(p, before);
assert.deepEqual(next.pages, p.pages);
assert.equal(dimensioningResults(next)[0].status, "checked");
const stale = structuredClone(next);
stale.pages[0].wires[0].to.pinId = "2";
assert(
  dimensioningResults(stale)[0].checks.some(
    (c) => c.id === "reference" && c.status === "missing",
  ),
);
const adopted = withDimensioning(p, {
  ...linked,
  reference: {
    ...linked.reference!,
    importedValues: { lengthMm: 25000, crossSection: "2.5 mm²" },
  },
});
const changedSource = structuredClone(adopted);
changedSource.pages[0].wires[0].lengthMm = 30000;
assert(
  dimensioningResults(changedSource)[0].checks.some(
    (c) => c.id === "reference_input" && c.status === "missing",
  ),
  "Adopted physical data must be reviewed when the source wire changes",
);
assert(
  dimensioningResults({ ...next, dimensioning: [linked, linked] }).some(
    (r) => r.status === "incomplete",
  ),
);
assert.equal(
  dimensioningResults(JSON.parse(JSON.stringify(next)))[0].status,
  "checked",
);
const bad = withDimensioning(next, { ...linked, maxDropPercent: 0.1 });
assert(
  inspectElectricalProject(bad).messages.some(
    (m) => m.ruleId === "dimensioning_limit" && m.location.wireId === "line",
  ),
);
assert(
  inspectElectricalProject(withDimensioning(p, draft)).messages.some(
    (m) => m.ruleId === "dimensioning_input",
  ),
);
const rows = dimensioningReportRows(next),
  csv = engineeringReportCsv(dimensioningColumns, rows);
assert(
  csv.includes("Hersteller") &&
    csv.includes("Spannungsfall") &&
    csv.includes("50000") &&
    csv.includes("Iz0"),
);
const history = new ProjectHistory();
history.reset(p);
history.record(next);
assert.deepEqual(history.undo(), p);
assert.deepEqual(history.redo(), next);
assert.equal(dimensioningResults(p).length, 0);
assert.deepEqual(p, before);
console.log(
  "✓ Independent DC/AC/three-phase numeric cases, power/PF/temperature/materials, explicit limits, overload/loop/disconnection/breaking/adiabatic/selectivity evidence, missing/invalid inputs, stable references, inspection integration, reports, portable data and undo without rewiring",
);
