import type { Project } from "./types";
import type { AssignedArticle } from "./ArticleTypes";
import type {
  CircuitDimensioning,
  DimensioningResult,
} from "./ElectricalDimensioning";
import { calculateDimensioning } from "./ElectricalDimensioning";
import {
  catalogCircuitArticle,
  adoptCircuitArticle,
  circuitArticleFields,
} from "./DimensioningArticles";
import { validateElectricalData } from "./ArticleElectrical";
import { tr } from "../i18n";
export interface CircuitDesignCandidate {
  record: CircuitDimensioning;
  result: DimensioningResult;
  issues: string[];
}
/** Compare exact sourced catalogue pairs; installation inputs are never invented. */
export function circuitDesignCandidate(
  input: CircuitDimensioning,
  cable: AssignedArticle,
  protection: AssignedArticle,
  project?: Project,
): CircuitDesignCandidate {
  let record = structuredClone(input);
  const c = catalogCircuitArticle(cable, "cable"),
    p = catalogCircuitArticle(protection, "protection");
  if (!c || !p)
    throw Error(
      tr(
        "Leitungs- und Schutzgerätekennwerte fehlen.",
        "Cable and protective device ratings are missing.",
      ),
    );
  // Replacing a design must not retain electrical data from the previous pair.
  for (const role of ["cable", "protection"] as const)
    for (const key of circuitArticleFields[role]) delete (record as any)[key];
  delete record.selectivitySource;
  delete record.selectivityLimitA;
  delete record.energySource;
  record.articles = { ...record.articles, cable: c, protection: p };
  record = adoptCircuitArticle(
    adoptCircuitArticle(record, "cable"),
    "protection",
  );
  record.verifyAmpacity = true;
  const cd = validateElectricalData(cable.snapshot!.electrical),
    pd = validateElectricalData(protection.snapshot!.electrical),
    issues: string[] = [];
  const add = (de: string, en: string) => issues.push(tr(de, en));
  const type = record.system === "dc" ? "dc" : "ac";
  for (const [label, d] of [
    [tr("Leitung", "Cable"), cd],
    [tr("Schutzgerät", "Protective device"), pd],
  ] as const) {
    if (!d.currentType)
      add(`${label}: Stromart fehlt.`, `${label}: current type missing.`);
    else if (d.currentType !== type && d.currentType !== "ac_dc")
      add(
        `${label}: Stromart passt nicht.`,
        `${label}: current type does not match.`,
      );
    if (d.ratedVoltageV === undefined)
      add(
        `${label}: Bemessungsspannung fehlt.`,
        `${label}: rated voltage missing.`,
      );
    else if (record.voltageV !== undefined && d.ratedVoltageV < record.voltageV)
      add(
        `${label}: Bemessungsspannung zu niedrig.`,
        `${label}: rated voltage too low.`,
      );
  }
  if (!cd.material) add("Leitermaterial fehlt.", "Conductor material missing.");
  const minCores =
    record.system === "ac3" ? 4 : record.system === "ac1" ? 3 : 2;
  if (cd.cores === undefined || cd.cores < minCores)
    add(
      "Aderzahl fehlt oder reicht für die Vorlage nicht aus.",
      "Core count is missing or insufficient for the template.",
    );
  if (pd.poles === undefined || pd.poles < (record.system === "ac3" ? 3 : 1))
    add(
      "Polzahl fehlt oder passt nicht zum System.",
      "Pole count is missing or incompatible with the system.",
    );
  const load = record.articles?.load?.article.snapshot?.electrical;
  if (load) {
    const ld = validateElectricalData(load);
    if (ld.kind !== "load")
      add(
        "Verbraucherartikel hat eine andere Artikelfunktion.",
        "Load part has a different part function.",
      );
    if (ld.currentType && ld.currentType !== type && ld.currentType !== "ac_dc")
      add(
        "Stromart des Verbrauchers passt nicht.",
        "Load current type does not match.",
      );
    if (
      ld.ratedVoltageV !== undefined &&
      record.voltageV !== undefined &&
      ld.ratedVoltageV < record.voltageV
    )
      add(
        "Bemessungsspannung des Verbrauchers zu niedrig.",
        "Load rated voltage too low.",
      );
  }
  const result = calculateDimensioning(record, project);
  return { record, result, issues };
}
export function compareCircuitArticles(
  input: CircuitDimensioning,
  articles: AssignedArticle[],
  limit = 24,
  project?: Project,
  filters: { cable?: string; protection?: string } = {},
) {
  const matches = (a: AssignedArticle, query = "") =>
    query
      .toLocaleLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every((w) =>
        [a.manufacturer, a.articleNumber, a.variant, a.snapshot?.description]
          .join(" ")
          .toLocaleLowerCase()
          .includes(w),
      );
  const cables = articles.filter(
      (a) =>
        a.snapshot?.electrical?.kind === "cable" && matches(a, filters.cable),
    ),
    protection = articles.filter(
      (a) =>
        a.snapshot?.electrical?.kind === "protection" &&
        matches(a, filters.protection),
    );
  const candidates: CircuitDesignCandidate[] = [];
  // A bounded catalogue subset is explicit in the UI; never evaluate an unbounded cartesian product.
  for (const c of cables.slice(0, 40))
    for (const p of protection.slice(0, 40))
      candidates.push(circuitDesignCandidate(input, c, p, project));
  const rank = (c: CircuitDesignCandidate) =>
    c.result.status === "failed"
      ? 2
      : c.result.status === "incomplete" || c.issues.length
        ? 1
        : 0;
  candidates.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.record.sectionMm2 ?? Infinity) - (b.record.sectionMm2 ?? Infinity) ||
      (a.record.protectiveCurrentA ?? Infinity) -
        (b.record.protectiveCurrentA ?? Infinity),
  );
  return {
    candidates: candidates.slice(0, limit),
    total: candidates.length,
    cableCount: cables.length,
    protectionCount: protection.length,
    truncated: cables.length > 40 || protection.length > 40,
  };
}
