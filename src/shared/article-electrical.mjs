/** Portable, sourced electrical ratings. No values are inferred from part names. */
export const electricalFields = {
  ratedVoltageV: {
    kinds: ["cable", "protection", "load"],
    de: "Bemessungsspannung [V]",
    en: "Rated voltage [V]",
    positive: true,
  },
  poles: {
    kinds: ["protection"],
    de: "Geschaltete Pole",
    en: "Switched poles",
    positive: true,
    integer: true,
    max: 8,
  },
  protectiveCurrentA: {
    kinds: ["protection"],
    de: "Bemessungsstrom In [A]",
    en: "Rated current In [A]",
    positive: true,
  },
  conventionalTripA: {
    kinds: ["protection"],
    de: "Konventioneller Auslösestrom I2 [A]",
    en: "Conventional tripping current I2 [A]",
    positive: true,
  },
  breakingCapacityA: {
    kinds: ["protection"],
    de: "Ausschaltvermögen [A]",
    en: "Breaking capacity [A]",
    positive: true,
  },
  residualCurrentA: {
    kinds: ["protection"],
    de: "Bemessungsdifferenzstrom [A]",
    en: "Rated residual current [A]",
    positive: true,
  },
  sectionMm2: {
    kinds: ["cable"],
    de: "Leiterquerschnitt [mm²]",
    en: "Conductor cross-section [mm²]",
    positive: true,
  },
  cores: {
    kinds: ["cable"],
    de: "Aderzahl",
    en: "Number of cores",
    positive: true,
    integer: true,
    max: 1000,
  },
  resistance20OhmKm: {
    kinds: ["cable"],
    de: "Leiterwiderstand bei 20 °C [Ω/km]",
    en: "Conductor resistance at 20 °C [Ω/km]",
    positive: true,
  },
  reactanceOhmKm: {
    kinds: ["cable"],
    de: "Reaktanz [Ω/km]",
    en: "Reactance [Ω/km]",
  },
  ampacityA: {
    kinds: ["cable"],
    de: "Tabellen-Strombelastbarkeit Iz0 [A]",
    en: "Tabulated current capacity Iz0 [A]",
    positive: true,
  },
  adiabaticK: {
    kinds: ["cable"],
    de: "Leiter-/Isolationskennwert k [A√s/mm²]",
    en: "Conductor/insulation factor k [A√s/mm²]",
    positive: true,
  },
  currentA: {
    kinds: ["load"],
    de: "Bemessungsstrom Verbraucher [A]",
    en: "Rated load current [A]",
    positive: true,
  },
  outputPowerW: {
    kinds: ["load"],
    de: "Abgegebene Wirkleistung [W]",
    en: "Output active power [W]",
    positive: true,
  },
  efficiency: {
    kinds: ["load"],
    de: "Wirkungsgrad (0–1)",
    en: "Efficiency (0–1)",
    positive: true,
    max: 1,
  },
  cosPhi: {
    kinds: ["load"],
    de: "Leistungsfaktor cos φ (0–1)",
    en: "Power factor cos φ (0–1)",
    positive: true,
    max: 1,
  },
};
export function validateElectricalData(raw) {
  const invalid = () => {
    throw new Error("articlesElectricalInvalid");
  };
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    raw.version !== 1 ||
    !["cable", "protection", "load"].includes(raw.kind)
  )
    invalid();
  const allowed = new Set([
    "version",
    "kind",
    "source",
    "conditions",
    "currentType",
    "material",
    "characteristic",
    "curve",
    ...Object.keys(electricalFields),
  ]);
  if (Object.keys(raw).some((k) => !allowed.has(k))) invalid();
  if (
    typeof raw.source !== "string" ||
    !raw.source.trim() ||
    raw.source.length > 2000
  )
    invalid();
  const result = { version: 1, kind: raw.kind, source: raw.source.trim() };
  for (const key of ["conditions", "characteristic"])
    if (raw[key] !== undefined) {
      if (
        typeof raw[key] !== "string" ||
        raw[key].length > (key === "conditions" ? 2000 : 80) ||
        (key === "characteristic" && raw.kind !== "protection")
      )
        invalid();
      if (raw[key].trim()) result[key] = raw[key].trim();
    }
  if (raw.currentType !== undefined) {
    if (!["ac", "dc", "ac_dc"].includes(raw.currentType)) invalid();
    result.currentType = raw.currentType;
  }
  if (raw.material !== undefined) {
    if (raw.kind !== "cable" || !["copper", "aluminium"].includes(raw.material))
      invalid();
    result.material = raw.material;
  }
  for (const [key, spec] of Object.entries(electricalFields))
    if (raw[key] !== undefined) {
      const v = raw[key];
      if (
        !spec.kinds.includes(raw.kind) ||
        typeof v !== "number" ||
        !Number.isFinite(v) ||
        v < 0 ||
        (spec.positive && v === 0) ||
        (spec.max !== undefined && v > spec.max) ||
        (spec.integer && !Number.isInteger(v))
      )
        invalid();
      result[key] = v;
    }
  if (raw.ampacityA !== undefined && !result.conditions) invalid();
  if (raw.curve !== undefined) {
    if (
      raw.kind !== "protection" ||
      !result.conditions ||
      !Array.isArray(raw.curve) ||
      raw.curve.length < 2 ||
      raw.curve.length > 256
    )
      invalid();
    let previous = 0;
    result.curve = raw.curve.map((p) => {
      if (
        !p ||
        Object.keys(p).some(
          (k) => !["currentA", "timeMinS", "timeMaxS"].includes(k),
        ) ||
        ["currentA", "timeMinS", "timeMaxS"].some(
          (k) => !Number.isFinite(p[k]) || p[k] <= 0,
        ) ||
        p.currentA <= previous ||
        p.timeMinS > p.timeMaxS
      )
        invalid();
      previous = p.currentA;
      return {
        currentA: p.currentA,
        timeMinS: p.timeMinS,
        timeMaxS: p.timeMaxS,
      };
    });
  }
  return result;
}
