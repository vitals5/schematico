import type { Project } from "./types";
import type { AssignedArticle, ComponentAddress } from "./ArticleTypes";
import type {
  CircuitDimensioning,
  NumericDimensioningKey,
} from "./ElectricalDimensioning";
import { effectiveArticles } from "./ArticleAssignments";
import { tr } from "../i18n";

export const circuitArticleFields = {
  cable: [
    "sectionMm2",
    "resistance20OhmKm",
    "reactanceOhmKm",
    "ampacityA",
    "adiabaticK",
  ],
  protection: [
    "protectiveCurrentA",
    "conventionalTripA",
    "tripThresholdA",
    "thresholdTimeS",
    "breakingCapacityA",
    "letThroughA2s",
    "energyTimeS",
  ],
  load: ["currentA", "outputPowerW", "efficiency", "cosPhi"],
  upstream: [],
} as const satisfies Record<string, readonly NumericDimensioningKey[]>;
export type CircuitArticleRole = "cable" | "protection" | "load" | "upstream";
export interface CircuitArticle {
  article: AssignedArticle;
  device?: ComponentAddress;
  parameters?: Partial<Record<NumericDimensioningKey, number>>;
  source?: string;
}
export const circuitArticleKey = (
  a: Pick<AssignedArticle, "manufacturer" | "articleNumber" | "variant">,
) => JSON.stringify([a.manufacturer, a.articleNumber, a.variant]);
export function dimensioningArticleCandidates(
  project: Project,
  catalogue: AssignedArticle[] = [],
): AssignedArticle[] {
  const all = [
    ...project.pages.flatMap((p) =>
      p.components.flatMap((c) => effectiveArticles(c, project)),
    ),
    ...catalogue,
  ];
  return [
    ...new Map(
      all
        .filter((a) => a.articleNumber?.trim())
        .map((a) => [circuitArticleKey(a), structuredClone(a)]),
    ).values(),
  ];
}
/** Values are explicitly attached to an exact part identity, never parsed from a description. */
export function captureCircuitArticle(
  record: CircuitDimensioning,
  role: CircuitArticleRole,
  source: string,
): CircuitDimensioning {
  const selection = record.articles?.[role];
  if (!selection || !source.trim())
    throw Error(
      tr(
        "Artikel und Kennwertquelle angeben.",
        "Specify a part and data source.",
      ),
    );
  const parameters: Partial<Record<NumericDimensioningKey, number>> = {};
  for (const key of circuitArticleFields[role]) {
    const value = record[key];
    if (value !== undefined) {
      if (!Number.isFinite(value) || value < 0)
        throw Error(tr("Ungültiger Kennwert", "Invalid rating"));
      parameters[key] = value;
    }
  }
  if (role !== "upstream" && !Object.keys(parameters).length)
    throw Error(
      tr(
        "Zuerst die zugehörigen Kennwerte im Formular erfassen.",
        "Enter the relevant ratings in the form first.",
      ),
    );
  return {
    ...record,
    articles: {
      ...record.articles,
      [role]: { ...selection, parameters, source: source.trim() },
    },
  };
}
export function adoptCircuitArticle(
  record: CircuitDimensioning,
  role: CircuitArticleRole,
): CircuitDimensioning {
  const selection = record.articles?.[role];
  if (!selection?.parameters || !selection.source)
    throw Error(
      tr(
        "Keine dokumentierten Kennwerte vorhanden.",
        "No documented ratings available.",
      ),
    );
  const next = structuredClone(record);
  for (const key of circuitArticleFields[role]) {
    const v = selection.parameters[key];
    if (v !== undefined) (next as any)[key] = v;
  }
  const citation = [
    selection.article.manufacturer,
    selection.article.articleNumber,
    selection.article.variant,
    selection.source,
  ]
    .filter(Boolean)
    .join(" · ");
  if (role === "cable") {
    next.inputSource = citation;
    next.ampacitySource = citation;
  }
  if (role === "protection") next.protectionSource = citation;
  if (role === "load") next.inputSource = citation;
  if (role === "upstream") next.upstreamDevice = citation;
  if (role === "protection")
    next.downstreamDevice = [
      selection.article.manufacturer,
      selection.article.articleNumber,
      selection.article.variant,
    ]
      .filter(Boolean)
      .join(" ");
  return next;
}
export function circuitArticleIssues(
  project: Project | undefined,
  record: CircuitDimensioning,
  onIssue?:(key:string,message:string)=>void,
): string[] {
  const issues: string[] = [];
  const add=(key:string,message:string)=>{issues.push(message);onIssue?.(key,message);};
  if (
    record.articles !== undefined &&
    (!record.articles ||
      typeof record.articles !== "object" ||
      Array.isArray(record.articles))
  )
    {add("invalid",tr("Ungültige Artikelzuordnung", "Invalid part selection"));return issues;}
  for (const [role, s] of Object.entries(record.articles ?? {})) {
    if (
      typeof s?.article?.articleNumber !== "string" ||
      !s.article.articleNumber.trim() ||
      typeof s.article.manufacturer !== "string" ||
      typeof s.article.variant !== "string" ||
      !Object.hasOwn(circuitArticleFields, role)
    ) {
      add(role+":invalid",tr("Ungültige Artikelzuordnung", "Invalid part selection"));
      continue;
    }
    if (s.device) {
      const pages =
          project?.pages.filter((p) => p.id === s.device!.pageId) ?? [],
        devices =
          pages.length === 1
            ? pages[0].components.filter((c) => c.id === s.device!.componentId)
            : [];
      if (
        devices.length !== 1 ||
        !effectiveArticles(devices[0], project).some(
          (a) =>
            a.role === "main" &&
            circuitArticleKey(a) === circuitArticleKey(s.article),
        )
      )
        add(role+":device",
          `${role}: ${tr("Artikel stimmt nicht mit dem Projektgerät überein", "Part does not match the project device")}`,
        );
    }
    if (
      (!s.source || (role !== "upstream" && (!s.parameters || !Object.keys(s.parameters).length)))
    )
      add(role+":ratings",
        `${role}: ${tr("Kennwerte und Quelle fehlen", "Ratings and source missing")}`,
      );
    else
      for (const key of circuitArticleFields[role as CircuitArticleRole])
        if (record[key] !== s.parameters?.[key])
          add(role+":"+key,
            `${role}: ${key}: ${tr("Formularwert weicht vom dokumentierten Artikelkennwert ab", "Form value differs from documented part rating")}`,
          );
  }
  return issues;
}
