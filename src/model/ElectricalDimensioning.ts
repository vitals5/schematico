import type { Project, Wire } from "./types";
import type { ConnectionRow } from "../reports/ConnectionList";

export interface DimensioningReference {
  pageId?: string;
  wireId: string;
  logical?: boolean;
  from: Wire["from"];
  to: Wire["to"];
  importedValues?: { lengthMm?: number; crossSection?: string };
}
export const dimensioningReferenceKey = (r?: DimensioningReference) =>
  !r
    ? ""
    : JSON.stringify([
        r.logical ?? false,
        r.pageId ?? null,
        r.wireId,
        r.from?.componentId,
        r.from?.pinId,
        r.to?.componentId,
        r.to?.pinId,
      ]);
export interface CircuitDimensioning {
  schemaVersion: 1;
  id: string;
  name: string;
  reference?: DimensioningReference;
  system: "dc" | "ac1" | "ac3";
  material: "copper" | "aluminium";
  loadMode: "current" | "power";
  powerFactorKind: "lagging" | "leading";
  voltageV?: number;
  currentA?: number;
  outputPowerW?: number;
  efficiency?: number;
  cosPhi?: number;
  lengthM?: number;
  sectionMm2?: number;
  temperatureC?: number;
  resistance20OhmKm?: number;
  reactanceOhmKm?: number;
  maxDropPercent?: number;
  inputSource?: string;
  verifyAmpacity?: boolean;
  ampacityA?: number;
  temperatureFactor?: number;
  groupingFactor?: number;
  otherFactor?: number;
  ampacitySource?: string;
  protectiveCurrentA?: number;
  conventionalTripA?: number;
  protectionSource?: string;
  verifyFault?: boolean;
  faultMode?: "direct" | "loop";
  faultMinA?: number;
  faultMaxA?: number;
  phaseEarthVoltageV?: number;
  loopMaxOhm?: number;
  loopMinOhm?: number;
  voltageFactorMin?: number;
  voltageFactorMax?: number;
  tripThresholdA?: number;
  requiredDisconnectS?: number;
  thresholdTimeS?: number;
  breakingCapacityA?: number;
  faultSource?: string;
  faultMaximumSource?: string;
  verifyAdiabatic?: boolean;
  adiabaticK?: number;
  letThroughA2s?: number;
  energyTimeS?: number;
  energySource?: string;
  verifySelectivity?: boolean;
  upstreamDevice?: string;
  downstreamDevice?: string;
  selectivityLimitA?: number;
  selectivitySource?: string;
}
export type NumericDimensioningKey = {
  [K in keyof CircuitDimensioning]-?: NonNullable<
    CircuitDimensioning[K]
  > extends number
    ? K
    : never;
}[keyof CircuitDimensioning];
export const dimensioningNumbers: Partial<
  Record<
    NumericDimensioningKey,
    { label: string; min: number; max?: number; positive?: boolean }
  >
> = {
  voltageV: {
    label: "Betriebsspannung U [V] (Drehstrom: Außenleiter)",
    min: 0,
    positive: true,
  },
  currentA: { label: "Betriebsstrom Ib [A]", min: 0 },
  outputPowerW: { label: "Abgegebene Wirkleistung [W]", min: 0 },
  efficiency: {
    label: "Wirkungsgrad η (1 = elektrische Last)",
    min: 0,
    positive: true,
    max: 1,
  },
  cosPhi: { label: "Leistungsfaktor cos φ", min: 0, positive: true, max: 1 },
  lengthM: { label: "Einfache reale Leitungslänge [m]", min: 0 },
  sectionMm2: { label: "Leiterquerschnitt S [mm²]", min: 0, positive: true },
  temperatureC: {
    label: "Betriebstemperatur des Leiters [°C]",
    min: -50,
    max: 200,
  },
  resistance20OhmKm: {
    label: "Leiterwiderstand R20 laut Datenblatt [Ω/km] (optional)",
    min: 0,
    positive: true,
  },
  reactanceOhmKm: {
    label: "Reaktanz X [Ω/km] (0 = ausdrücklich vernachlässigt)",
    min: 0,
  },
  maxDropPercent: {
    label: "Zulässiger Spannungsfall [%]",
    min: 0,
    positive: true,
    max: 100,
  },
  ampacityA: {
    label: "Tabellen-Strombelastbarkeit Iz0 [A]",
    min: 0,
    positive: true,
  },
  temperatureFactor: {
    label: "Temperaturfaktor kt",
    min: 0,
    positive: true,
    max: 10,
  },
  groupingFactor: {
    label: "Häufungsfaktor kg",
    min: 0,
    positive: true,
    max: 1,
  },
  otherFactor: {
    label: "Weiterer Korrekturfaktor k",
    min: 0,
    positive: true,
    max: 10,
  },
  protectiveCurrentA: {
    label: "Bemessungsstrom Schutzgerät In [A]",
    min: 0,
    positive: true,
  },
  conventionalTripA: {
    label: "Konventioneller Auslösestrom I2 [A]",
    min: 0,
    positive: true,
  },
  faultMinA: {
    label: "Kleinster Fehlerstrom Ik,min [A]",
    min: 0,
    positive: true,
  },
  faultMaxA: {
    label: "Größter Kurzschlussstrom Ik,max [A]",
    min: 0,
    positive: true,
  },
  phaseEarthVoltageV: {
    label: "Spannung gegen Erde U0 [V]",
    min: 0,
    positive: true,
  },
  loopMaxOhm: {
    label: "Maximale vollständige Fehlerschleifenimpedanz Zs,max [Ω]",
    min: 0,
    positive: true,
  },
  loopMinOhm: {
    label: "Minimale vollständige Fehlerschleifenimpedanz Zs,min [Ω]",
    min: 0,
    positive: true,
  },
  voltageFactorMin: {
    label: "Spannungsfaktor cmin",
    min: 0,
    positive: true,
    max: 2,
  },
  voltageFactorMax: {
    label: "Spannungsfaktor cmax",
    min: 0,
    positive: true,
    max: 2,
  },
  tripThresholdA: {
    label: "Auslösestrom Ia für angegebene Abschaltzeit [A]",
    min: 0,
    positive: true,
  },
  requiredDisconnectS: {
    label: "Geforderte Abschaltzeit [s]",
    min: 0,
    positive: true,
  },
  thresholdTimeS: {
    label: "Zum Auslösestrom Ia gehörende maximale Abschaltzeit [s]",
    min: 0,
    positive: true,
  },
  breakingCapacityA: {
    label: "Ausschaltvermögen Schutzgerät [A]",
    min: 0,
    positive: true,
  },
  adiabaticK: {
    label: "Leiter-/Isolationskennwert k [A√s/mm²]",
    min: 0,
    positive: true,
  },
  letThroughA2s: {
    label: "Durchlassenergie I²t [A²s]",
    min: 0,
    positive: true,
  },
  energyTimeS: {
    label: "Zur Durchlassenergie gehörende Fehlerdauer [s] (≤ 5 s)",
    min: 0,
    positive: true,
    max: 5,
  },
  selectivityLimitA: {
    label: "Selektivitätsgrenze der geprüften Gerätepaarung [A]",
    min: 0,
    positive: true,
  },
};
export interface DimensioningCheck {
  id: string;
  label: string;
  status: "pass" | "fail" | "missing" | "not_requested";
  message: string;
  formula?: string;
}
export interface DimensioningResult {
  circuitId: string;
  name: string;
  status: "checked" | "failed" | "incomplete";
  checks: DimensioningCheck[];
  values: {
    currentA?: number;
    resistanceOhmKm?: number;
    dropV?: number;
    dropPercent?: number;
    lossW?: number;
    ampacityA?: number;
    faultMinA?: number;
    faultMaxA?: number;
    loopFaultMaxA?: number;
    withstandA2s?: number;
  };
  assumptions: string[];
  method: "schematico-dimensioning-v1";
}
export const dimensioningNumber = (n?: number) =>
  n === undefined
    ? "—"
    : Number.isFinite(n)
      ? Number(n.toPrecision(7)).toLocaleString("de-DE", {
          maximumSignificantDigits: 7,
        })
      : "ungültig";
export function newDimensioning(
  name = "Neuer Stromkreis",
): CircuitDimensioning {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name,
    system: "ac1",
    material: "copper",
    loadMode: "current",
    powerFactorKind: "lagging",
    faultMode: "direct",
  };
}
/** A drawing connection is a reference, not proof of a complete circuit or a physical length. */
function dimensioningForConnection(row: ConnectionRow): CircuitDimensioning {
  const record = newDimensioning(`${row.from} → ${row.to}`.slice(0, 160));
  record.reference = {
    pageId: row.pageId,
    wireId: row.wireId,
    logical: row.kind === "logical",
    from: { componentId: row.fromComponentId, pinId: "" },
    to: { componentId: row.toComponentId, pinId: "" },
  };
  return record;
}
export function dimensioningInputErrors(r: CircuitDimensioning): string[] {
  if (!r || typeof r !== "object") return ["Ungültiger Berechnungsdatensatz"];
  const errors: string[] = [];
  if (
    r.schemaVersion !== 1 ||
    typeof r.id !== "string" ||
    !r.id ||
    typeof r.name !== "string" ||
    !r.name.trim() ||
    r.name.length > 160
  )
    errors.push("Name oder Kennung fehlt bzw. ist ungültig");
  if (
    !["dc", "ac1", "ac3"].includes(r.system) ||
    !["copper", "aluminium"].includes(r.material) ||
    !["current", "power"].includes(r.loadMode) ||
    !["lagging", "leading"].includes(r.powerFactorKind) ||
    (r.faultMode !== undefined && !["direct", "loop"].includes(r.faultMode))
  )
    errors.push("Ungültiges Berechnungsverfahren");
  for (const [key, spec] of Object.entries(dimensioningNumbers)) {
    const v = r[key as NumericDimensioningKey];
    if (
      v !== undefined &&
      (typeof v !== "number" ||
        !Number.isFinite(v) ||
        v < spec.min ||
        (spec.positive && v === 0) ||
        (spec.max !== undefined && v > spec.max))
    )
      errors.push(`${spec.label}: ungültiger Wert`);
  }
  for (const key of [
    "inputSource",
    "ampacitySource",
    "protectionSource",
    "faultSource",
    "faultMaximumSource",
    "energySource",
    "selectivitySource",
    "upstreamDevice",
    "downstreamDevice",
  ] as const)
    if (
      r[key] !== undefined &&
      (typeof r[key] !== "string" || r[key]!.length > 2000)
    )
      errors.push(`${key}: ungültiger Text`);
  for (const key of [
    "verifyAmpacity",
    "verifyFault",
    "verifyAdiabatic",
    "verifySelectivity",
  ] as const)
    if (r[key] !== undefined && typeof r[key] !== "boolean")
      errors.push(`${key}: ungültiger Prüfstatus`);
  if (
    r.reference &&
    (typeof r.reference.wireId !== "string" ||
      !r.reference.wireId ||
      !r.reference.from ||
      !r.reference.to ||
      [r.reference.from, r.reference.to].some(
        (p) =>
          typeof p.componentId !== "string" ||
          !p.componentId ||
          typeof p.pinId !== "string" ||
          !p.pinId,
      ) ||
      (!r.reference.logical && typeof r.reference.pageId !== "string"))
  )
    errors.push("Ungültiger Verbindungsbezug");
  if (
    r.reference?.importedValues &&
    ((r.reference.importedValues.lengthMm !== undefined &&
      (typeof r.reference.importedValues.lengthMm !== "number" ||
        !Number.isFinite(r.reference.importedValues.lengthMm) ||
        r.reference.importedValues.lengthMm < 0)) ||
      (r.reference.importedValues.crossSection !== undefined &&
        typeof r.reference.importedValues.crossSection !== "string"))
  )
    errors.push("Ungültiger Nachweis übernommener Leitungsdaten");
  if (
    r.faultMode !== "loop" &&
    r.faultMinA !== undefined &&
    r.faultMaxA !== undefined &&
    r.faultMinA > r.faultMaxA
  )
    errors.push("Ik,min darf Ik,max nicht überschreiten");
  if (
    r.loopMinOhm !== undefined &&
    r.loopMaxOhm !== undefined &&
    r.loopMinOhm > r.loopMaxOhm
  )
    errors.push("Zs,min darf Zs,max nicht überschreiten");
  if (
    r.voltageFactorMin !== undefined &&
    r.voltageFactorMax !== undefined &&
    r.voltageFactorMin > r.voltageFactorMax
  )
    errors.push("cmin darf cmax nicht überschreiten");
  return errors;
}
function referenceWire(
  project: Project,
  reference: DimensioningReference,
): Wire | undefined {
  const pages = project.pages.filter((p) => p.id === reference.pageId);
  const matches = (
    reference.logical
      ? (project.logicalConnections ?? [])
      : pages.length === 1
        ? pages[0].wires
        : []
  ).filter((w) => w.id === reference.wireId);
  if (matches.length !== 1) return;
  const wire = matches[0];
  const same = (a: Wire["from"], b: Wire["from"]) =>
    a.componentId === b.componentId && a.pinId === b.pinId;
  return same(wire.from, reference.from) && same(wire.to, reference.to)
    ? wire
    : undefined;
}
export function connectionDimensioning(
  project: Project,
  row: ConnectionRow,
): CircuitDimensioning {
  const record = dimensioningForConnection(row);
  const pages = project.pages.filter((p) => p.id === row.pageId);
  const matches = (
    row.kind === "logical"
      ? (project.logicalConnections ?? [])
      : pages.length === 1
        ? pages[0].wires
        : []
  ).filter((w) => w.id === row.wireId);
  if (matches.length !== 1) throw Error("Verbindung ist nicht eindeutig.");
  record.reference!.from = structuredClone(matches[0].from);
  record.reference!.to = structuredClone(matches[0].to);
  // Values are offered only by an explicit UI transfer, never inferred from drawing distances.
  return record;
}
export function calculateDimensioning(
  record: CircuitDimensioning,
  project?: Project,
): DimensioningResult {
  const errors = dimensioningInputErrors(record);
  const result: DimensioningResult = {
    circuitId: record?.id ?? "",
    name: record?.name ?? "Ungültiger Stromkreis",
    status: "incomplete",
    checks: [],
    values: {},
    method: "schematico-dimensioning-v1",
    assumptions: [
      "Einfache reale Leitungslänge; Hin- und Rückleiter mit gleichem Material, Querschnitt und gleicher Temperatur.",
      "Drehstrom: symmetrische Grundschwingungslast, Außenleiterspannung; keine Oberschwingungs- oder Neutralleiterüberlastberechnung.",
      "Spannungsfall als Längskomponente; keine vollständige Lastflussrechnung.",
    ],
  };
  const add = (
    id: string,
    label: string,
    ok: boolean,
    message: string,
    formula?: string,
  ) =>
    result.checks.push({
      id,
      label,
      status: ok ? "pass" : "fail",
      message,
      formula,
    });
  const missing = (id: string, label: string, message: string) =>
    result.checks.push({ id, label, status: "missing", message });
  const needs = (
    id: string,
    label: string,
    keys: (keyof CircuitDimensioning)[],
  ) => {
    const absent = keys.filter(
      (k) =>
        record[k] === undefined ||
        (typeof record[k] === "string" && !(record[k] as string).trim()),
    );
    if (!absent.length) return true;
    missing(
      id,
      label,
      "Fehlende Angaben: " +
        absent
          .map(
            (k) =>
              dimensioningNumbers[k as NumericDimensioningKey]?.label ??
              (
                {
                  ampacitySource: "Quelle und Verlegebedingungen für Iz0",
                  protectionSource: "Schutzgerätekennwerte und Quelle",
                  faultSource: "Quelle der Fehlerstrom-/Schleifenangaben",
                  faultMaximumSource:
                    "Beleg für den maßgebenden maximalen Netzkurzschlussstrom (alle relevanten Fehlerfälle)",
                  energySource: "Quelle von k und I²t",
                  selectivitySource: "Herstellerbeleg zur Gerätepaarung",
                  upstreamDevice: "Vorgeschaltetes Gerät",
                  downstreamDevice: "Nachgeschaltetes Gerät",
                } as Record<string, string>
              )[k] ??
              k,
          )
          .join("; "),
    );
    return false;
  };
  if (errors.length) {
    missing("input", "Eingaben", errors.join("; "));
    return result;
  }
  if (record.reference) {
    const wire = project ? referenceWire(project, record.reference) : undefined;
    if (!wire)
      missing(
        "reference",
        "Planbezug",
        "Die zugeordnete Verbindung fehlt, ist mehrdeutig oder besitzt andere Anschlüsse. Bezug neu zuordnen oder ausdrücklich entfernen.",
      );
    else if (
      record.reference.importedValues &&
      (record.reference.importedValues.lengthMm !== wire.lengthMm ||
        record.reference.importedValues.crossSection !== wire.crossSection)
    )
      missing(
        "reference_input",
        "Übernommene Leitungsdaten",
        "Reale Länge oder Querschnitt der Bezugslinie wurden seit der Übernahme verändert. Stromkreiseingaben prüfen und Werte erneut ausdrücklich übernehmen.",
      );
  }
  const ac = record.system !== "dc",
    factor = record.system === "ac3" ? Math.sqrt(3) : 2;
  if (
    needs(
      "load",
      "Betriebsstrom",
      record.loadMode === "current"
        ? ["currentA"]
        : [
            "outputPowerW",
            "efficiency",
            "voltageV",
            ...(ac ? ["cosPhi" as const] : []),
          ],
    )
  ) {
    result.values.currentA =
      record.loadMode === "current"
        ? record.currentA!
        : record.outputPowerW! /
          (record.voltageV! *
            record.efficiency! *
            (ac ? record.cosPhi! : 1) *
            (record.system === "ac3" ? Math.sqrt(3) : 1));
  }
  const voltageKeys: (keyof CircuitDimensioning)[] = [
    "voltageV",
    "lengthM",
    "sectionMm2",
    "temperatureC",
    ...(ac ? (["cosPhi", "reactanceOhmKm"] as const) : []),
  ];
  if (
    needs("voltage_input", "Spannungsfall-Eingaben", voltageKeys) &&
    result.values.currentA !== undefined
  ) {
    const rho = record.material === "copper" ? 0.0175 : 0.0282,
      alpha = record.material === "copper" ? 0.00393 : 0.00403;
    const resistance =
      (record.resistance20OhmKm ?? (1000 * rho) / record.sectionMm2!) *
      (1 + alpha * (record.temperatureC! - 20));
    const pf = ac ? record.cosPhi! : 1,
      x = ac ? record.reactanceOhmKm! : 0,
      direction = record.powerFactorKind === "leading" ? -1 : 1;
    const drop =
      ((factor * record.lengthM!) / 1000) *
      result.values.currentA *
      (resistance * pf + direction * x * Math.sqrt(Math.max(0, 1 - pf * pf)));
    result.values.resistanceOhmKm = resistance;
    result.values.dropV = drop;
    result.values.dropPercent = (100 * drop) / record.voltageV!;
    result.values.lossW =
      ((record.system === "ac3" ? 3 : 2) *
        result.values.currentA ** 2 *
        resistance *
        record.lengthM!) /
      1000;
    result.assumptions.push(
      record.resistance20OhmKm !== undefined
        ? "R20 aus ausdrücklicher Eingabe."
        : `Planungswert ρ20 = ${rho} Ω·mm²/m (${record.material === "copper" ? "Cu" : "Al"}); kein maximaler Hersteller-Leiterwiderstand.`,
    );
    result.assumptions.push(
      `Temperaturkoeffizient α20 = ${alpha} /K. ${ac && x === 0 ? "Reaktanz wurde ausdrücklich mit 0 eingegeben." : ""}`,
    );
    if (needs("voltage_limit", "Spannungsfall-Grenze", ["maxDropPercent"]))
      add(
        "voltage_drop",
        "Spannungsfall",
        Math.abs(result.values.dropPercent) <= record.maxDropPercent! + 1e-10,
        `${dimensioningNumber(drop)} V / ${dimensioningNumber(result.values.dropPercent)} %; Grenze ±${dimensioningNumber(record.maxDropPercent)} %`,
        `${record.system === "ac3" ? "√3" : "2"} · L[km] · Ib · (Rθ · cosφ ${direction < 0 ? "−" : "+"} X · sinφ); DC: cosφ=1, X=0`,
      );
  }
  if (record.verifyAmpacity) {
    if (
      needs("ampacity_input", "Strombelastbarkeit und Überlastschutz", [
        "ampacityA",
        "temperatureFactor",
        "groupingFactor",
        "otherFactor",
        "ampacitySource",
        "protectiveCurrentA",
        "conventionalTripA",
        "protectionSource",
      ]) &&
      result.values.currentA !== undefined
    ) {
      const iz =
        record.ampacityA! *
        record.temperatureFactor! *
        record.groupingFactor! *
        record.otherFactor!;
      result.values.ampacityA = iz;
      add(
        "ampacity",
        "Strombelastbarkeit",
        result.values.currentA <= record.protectiveCurrentA! &&
          record.protectiveCurrentA! <= iz,
        `Ib ${dimensioningNumber(result.values.currentA)} A ≤ In ${dimensioningNumber(record.protectiveCurrentA)} A ≤ Iz ${dimensioningNumber(iz)} A`,
        "Iz = Iz0 · kt · kg · k; Ib ≤ In ≤ Iz",
      );
      add(
        "overload",
        "Konventioneller Überlastschutz",
        record.conventionalTripA! <= 1.45 * iz,
        `I2 ${dimensioningNumber(record.conventionalTripA)} A ≤ 1,45 · Iz ${dimensioningNumber(1.45 * iz)} A`,
        "I2 ≤ 1,45 · Iz",
      );
    }
  }
  const needFault = record.verifyFault || record.verifySelectivity;
  if (needFault) {
    if (record.faultMode === "loop") {
      if (
        needs(
          "fault_input",
          "Einpoliger Fehlerstrom aus vollständiger Fehlerschleife",
          [
            "phaseEarthVoltageV",
            "loopMaxOhm",
            "loopMinOhm",
            "voltageFactorMin",
            "voltageFactorMax",
            "faultSource",
          ],
        )
      ) {
        result.values.faultMinA =
          (record.voltageFactorMin! * record.phaseEarthVoltageV!) /
          record.loopMaxOhm!;
        result.values.loopFaultMaxA =
          (record.voltageFactorMax! * record.phaseEarthVoltageV!) /
          record.loopMinOhm!;
        result.assumptions.push(
          "Schleifenverfahren: einpoliger Fehler; Zs umfasst die vollständige Fehlerschleife einschließlich Einspeisung. Kein berechneter dreipoliger Netzkurzschluss.",
        );
        if (
          needs(
            "fault_maximum",
            "Maßgebender maximaler Netzkurzschlussstrom für Ausschaltvermögen / Selektivität",
            ["faultMaxA", "faultMaximumSource"],
          )
        ) {
          if (
            record.faultMaxA! < result.values.loopFaultMaxA ||
            record.faultMaxA! < result.values.faultMinA!
          )
            missing(
              "fault_envelope",
              "Kurzschlussstrombereich",
              "Der angegebene maximale Netzkurzschlussstrom ist kleiner als ein bereits berechneter Fehlerstrom. Quelle und Fehlerfälle prüfen.",
            );
          else result.values.faultMaxA = record.faultMaxA;
        }
      }
    } else if (
      needs(
        "fault_input",
        "Fehler-/Kurzschlussstrom aus vorhandener Netzberechnung oder Messung",
        ["faultMinA", "faultMaxA", "faultSource"],
      )
    ) {
      result.values.faultMinA = record.faultMinA;
      result.values.faultMaxA = record.faultMaxA;
    }
  }
  if (
    record.verifyFault &&
    result.values.faultMinA !== undefined &&
    result.values.faultMaxA !== undefined &&
    needs("fault_protection", "Abschaltbedingung und Ausschaltvermögen", [
      "tripThresholdA",
      "requiredDisconnectS",
      "thresholdTimeS",
      "breakingCapacityA",
      "protectionSource",
    ])
  ) {
    add(
      "disconnection",
      "Abschaltbedingung",
      result.values.faultMinA >= record.tripThresholdA! &&
        record.thresholdTimeS! <= record.requiredDisconnectS!,
      `Ik,min ${dimensioningNumber(result.values.faultMinA)} A ≥ Ia ${dimensioningNumber(record.tripThresholdA)} A; t(Ia) ${dimensioningNumber(record.thresholdTimeS)} s ≤ ${dimensioningNumber(record.requiredDisconnectS)} s`,
      "Ik,min ≥ Ia und t(Ia) ≤ tmax; Schleifenverfahren: Ik,min = cmin · U0 / Zs,max",
    );
    add(
      "breaking",
      "Ausschaltvermögen",
      result.values.faultMaxA <= record.breakingCapacityA!,
      `Ik,max ${dimensioningNumber(result.values.faultMaxA)} A ≤ ${dimensioningNumber(record.breakingCapacityA)} A`,
      "Maßgebender maximaler Netzkurzschlussstrom Ik,max ≤ Ausschaltvermögen (alle relevanten Fehlerfälle)",
    );
  }
  if (
    record.verifyAdiabatic &&
    needs("adiabatic_input", "Adiabatischer Leiterschutz", [
      "sectionMm2",
      "adiabaticK",
      "letThroughA2s",
      "energyTimeS",
      "energySource",
    ])
  ) {
    result.values.withstandA2s = (record.adiabaticK! * record.sectionMm2!) ** 2;
    add(
      "adiabatic",
      "Thermischer Kurzschlussschutz",
      record.letThroughA2s! <= result.values.withstandA2s,
      `I²t ${dimensioningNumber(record.letThroughA2s)} A²s ≤ k²S² ${dimensioningNumber(result.values.withstandA2s)} A²s`,
      "I²t ≤ k² · S²; k und Durchlassenergie für Leiter, Isolation und relevanten Fehlerstrombereich nachweisen",
    );
  }
  if (
    record.verifySelectivity &&
    needs("selectivity_input", "Selektivitätsnachweis", [
      "upstreamDevice",
      "downstreamDevice",
      "selectivityLimitA",
      "selectivitySource",
    ]) &&
    result.values.faultMaxA !== undefined
  ) {
    add(
      "selectivity",
      "Selektivität der dokumentierten Gerätepaarung",
      result.values.faultMaxA <= record.selectivityLimitA!,
      `${record.upstreamDevice} → ${record.downstreamDevice}: Ik,max ${dimensioningNumber(result.values.faultMaxA)} A ≤ bestätigte Grenze ${dimensioningNumber(record.selectivityLimitA)} A`,
      "Ik,max ≤ Hersteller-Selektivitätsgrenze der konkreten Paarung; keine Ableitung aus Bemessungsstromverhältnissen",
    );
  }
  for (const [flag, id, label] of [
    ["verifyAmpacity", "ampacity", "Strombelastbarkeit / Überlastschutz"],
    ["verifyFault", "fault", "Abschaltbedingung / Ausschaltvermögen"],
    ["verifyAdiabatic", "adiabatic", "Thermischer Kurzschlussschutz"],
    ["verifySelectivity", "selectivity", "Selektivität"],
  ] as const)
    if (!record[flag])
      result.checks.push({
        id: id + "_off",
        label,
        status: "not_requested",
        message: "Nicht beauftragt; kein Nachweis für diesen Bereich.",
      });
  if (Object.values(result.values).some((v) => !Number.isFinite(v))) {
    result.values = {};
    missing(
      "overflow",
      "Berechnungsbereich",
      "Die Eingabekombination überschreitet den numerischen Berechnungsbereich.",
    );
  }
  result.status = result.checks.some((c) => c.status === "fail")
    ? "failed"
    : result.checks.some((c) => c.status === "missing")
      ? "incomplete"
      : "checked";
  return result;
}
export function dimensioningResults(project: Project): DimensioningResult[] {
  if (project.dimensioning === undefined) return [];
  if (
    !Array.isArray(project.dimensioning) ||
    project.dimensioning.length > 5000
  )
    return [
      {
        circuitId: "",
        name: "Dimensionierung",
        status: "incomplete",
        method: "schematico-dimensioning-v1",
        values: {},
        assumptions: [],
        checks: [
          {
            id: "input",
            label: "Eingaben",
            status: "missing",
            message: "Ungültiger Dimensionierungsbestand.",
          },
        ],
      },
    ];
  const ids = new Set<string>();
  return project.dimensioning.map((r) => {
    const result = calculateDimensioning(r, project);
    if (ids.has(r?.id)) {
      result.checks.push({
        id: "identity",
        label: "Kennung",
        status: "missing",
        message: "Berechnungskennung mehrfach vorhanden.",
      });
      result.status = "incomplete";
    }
    ids.add(r?.id);
    return result;
  });
}
export function withDimensioning(
  project: Project,
  record: CircuitDimensioning,
): Project {
  const errors = dimensioningInputErrors(record);
  if (errors.length) throw Error(errors.join("; "));
  if (
    project.dimensioning !== undefined &&
    !Array.isArray(project.dimensioning)
  )
    throw Error("Ungültiger Dimensionierungsbestand.");
  const old = project.dimensioning ?? [];
  if (old.some((r) => !r || typeof r.id !== "string"))
    throw Error("Ungültiger Dimensionierungsbestand. Projektdatei prüfen.");
  if (old.length >= 5000 && !old.some((r) => r.id === record.id))
    throw Error("Maximal 5.000 Berechnungsdatensätze je Projekt.");
  if (old.filter((r) => r.id === record.id).length > 1)
    throw Error("Berechnungskennung mehrfach vorhanden.");
  const next = structuredClone(record);
  return {
    ...project,
    dimensioning: old.some((r) => r.id === record.id)
      ? old.map((r) => (r.id === record.id ? next : r))
      : [...old, next],
  };
}
