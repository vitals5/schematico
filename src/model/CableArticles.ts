import type { AssignedArticle } from "./ArticleTypes";
import type { CableDefinition, Project } from "./types";
import { validateAssignments } from "./ArticleAssignments";
import { validateElectricalData } from "./ArticleElectrical";
import { tr } from "../i18n";
import type { CircuitArticleAssessment } from "./CircuitArticleSelection";

export interface CableAddress {
  pageId: string;
  cableId: string;
}
export interface CableArticleBinding extends CableAddress {
  adoptedLengthM?: number;
}
export type CablePartFinding = {
  code:
    | "cable_article_assignment"
    | "cable_length_missing"
    | "cable_length_invalid";
  details: string;
};
export const cablePartKey = (a: AssignedArticle) =>
  JSON.stringify([a.manufacturer, a.articleNumber, a.variant]);
export const cablePartLabel = (a?: AssignedArticle) =>
  a
    ? [a.manufacturer, a.articleNumber, a.variant ? "[" + a.variant + "]" : ""]
        .filter(Boolean)
        .join(" · ")
    : "—";
export function uniqueCable(
  project: Project,
  address: CableAddress,
): CableDefinition | undefined {
  const pages = project.pages.filter((p) => p.id === address.pageId);
  const cables =
    pages.length === 1
      ? pages[0].cables?.filter((c) => c.id === address.cableId)
      : [];
  return cables?.length === 1 ? cables[0] : undefined;
}
export function validateCablePart(article: AssignedArticle): AssignedArticle {
  const a = validateAssignments([article])[0];
  if (article.snapshot && !a.snapshot)
    throw Error(
      tr(
        "Artikel und Kennwert-Snapshot besitzen unterschiedliche Identitäten.",
        "Part and rating snapshot have different identities.",
      ),
    );
  if (a.role !== "main")
    throw Error(
      tr(
        "Für das Kabel einen Hauptartikel auswählen.",
        "Select a main part for the cable.",
      ),
    );
  if (
    a.snapshot?.electrical &&
    validateElectricalData(a.snapshot.electrical).kind !== "cable"
  )
    throw Error(
      tr(
        "Der Artikel ist kein Kabelartikel.",
        "This part is not a cable article.",
      ),
    );
  return { ...a, quantity: 1 };
}
export function cablePartData(article?: AssignedArticle) {
  if (!article?.snapshot?.electrical) return;
  const validated = validateCablePart(article);
  return validated.snapshot?.electrical
    ? validateElectricalData(validated.snapshot.electrical)
    : undefined;
}
/** Cable assignment has no assumed AC/DC system, voltage or load. */
export function assessCablePart(
  article: AssignedArticle,
): CircuitArticleAssessment {
  try {
    const a = validateCablePart(article),
      data = cablePartData(a),
      missing: string[] = [];
    if (!data)
      missing.push(
        tr(
          "Strukturierte Kabelkennwerte fehlen.",
          "Structured cable ratings are missing.",
        ),
      );
    else {
      if (data.cores === undefined)
        missing.push(tr("Aderzahl fehlt.", "Core count missing."));
      if (data.sectionMm2 === undefined)
        missing.push(tr("Querschnitt fehlt.", "Cross-section missing."));
    }
    return {
      status: missing.length ? "missing" : "ready",
      missing,
      conflicts: [],
      data,
    };
  } catch (e) {
    return {
      status: "incompatible",
      missing: [],
      conflicts: [e instanceof Error ? e.message : String(e)],
    };
  }
}
export function cableSectionMm2(value: string): number | undefined {
  const m = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(?:mm[²2])?$/i),
    n = m ? Number(m[1].replace(",", ".")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
export const validCableLength = (length: unknown): length is number =>
  typeof length === "number" && Number.isFinite(length) && length >= 0;
export function cablePartFindings(cable: CableDefinition): CablePartFinding[] {
  const issues: CablePartFinding[] = [];
  if (cable.lengthM !== undefined && !validCableLength(cable.lengthM))
    issues.push({
      code: "cable_length_invalid",
      details: String(cable.lengthM),
    });
  if (!cable.article) return issues;
  if (cable.lengthM === undefined)
    issues.push({
      code: "cable_length_missing",
      details: tr(
        "Keine Bestellmenge aus der Zeichnung ableiten.",
        "Do not infer purchasing quantity from the drawing.",
      ),
    });
  try {
    validateCablePart(cable.article);
    const data = cablePartData(cable.article);
    if (data?.cores !== undefined && cable.coreCount !== data.cores)
      issues.push({
        code: "cable_article_assignment",
        details: `${tr("Aderzahl", "Core count")}: ${cable.coreCount ?? "?"} / ${data.cores}`,
      });
    if (
      data?.sectionMm2 !== undefined &&
      cableSectionMm2(cable.crossSection) !== data.sectionMm2
    )
      issues.push({
        code: "cable_article_assignment",
        details: `${tr("Querschnitt", "Cross-section")}: ${cable.crossSection || "?"} / ${data.sectionMm2} mm²`,
      });
  } catch (e) {
    issues.push({
      code: "cable_article_assignment",
      details: e instanceof Error ? e.message : String(e),
    });
  }
  return issues;
}
/** Structural comparison also includes source/conditions/curve points; property order is immaterial. */
export function sameCablePartData(
  a?: AssignedArticle,
  b?: AssignedArticle,
): boolean {
  const canonical = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => [key, canonical(value)]),
          )
        : v;
  return (
    JSON.stringify(canonical(a?.snapshot?.electrical)) ===
    JSON.stringify(canonical(b?.snapshot?.electrical))
  );
}
