import { validateElectricalData } from "./ArticleElectrical";
import type { Project } from "./types";
import type { AssignedArticle, ComponentAddress } from "./ArticleTypes";
import type {
  CircuitDimensioning,
  NumericDimensioningKey,
} from "./ElectricalDimensioning";
import { effectiveArticles } from "./ArticleAssignments";
import { tr } from "../i18n";
import { uniqueCable, cablePartFindings, sameCablePartData, validateCablePart } from './CableArticles';

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
  cable?: import('./CableArticles').CableArticleBinding;
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
    ...project.pages.flatMap(p=>(p.cables??[]).flatMap(c=>{try{return c.article?[validateCablePart(c.article)]:[];}catch{return [];}})),
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
/** Convert a validated catalogue snapshot into an explicit role-specific profile. */
export function catalogCircuitArticle(
  article: AssignedArticle,
  role: CircuitArticleRole,
): CircuitArticle | undefined {
  if (!article.snapshot?.electrical) return;
  const data = validateElectricalData(article.snapshot.electrical);
  if (data.kind !== (role === "upstream" ? "protection" : role)) return;
  const parameters: Partial<Record<NumericDimensioningKey, number>> = {};
  for (const key of circuitArticleFields[role]) {
    const value = (data as any)[key];
    if (typeof value === "number") parameters[key] = value;
  }
  return {
    article: structuredClone(article),
    parameters,
    source: [data.source, data.conditions].filter(Boolean).join(" · "),
  };
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
    else delete (next as any)[key];
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
    const data = selection.article.snapshot?.electrical;
    if (data?.material) next.material = data.material;
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
  onIssue?: (key: string, message: string) => void,
): string[] {
  const issues: string[] = [];
  const add = (key: string, message: string) => {
    issues.push(message);
    onIssue?.(key, message);
  };
  if (
    record.articles !== undefined &&
    (!record.articles ||
      typeof record.articles !== "object" ||
      Array.isArray(record.articles))
  ) {
    add("invalid", tr("Ungültige Artikelzuordnung", "Invalid part selection"));
    return issues;
  }
  for (const [role, s] of Object.entries(record.articles ?? {})) {
    if (
      typeof s?.article?.articleNumber !== "string" ||
      !s.article.articleNumber.trim() ||
      typeof s.article.manufacturer !== "string" ||
      typeof s.article.variant !== "string" ||
      !Object.hasOwn(circuitArticleFields, role)
    ) {
      add(
        role + ":invalid",
        tr("Ungültige Artikelzuordnung", "Invalid part selection"),
      );
      continue;
    }
    if (s.article.snapshot?.electrical) {
      try {
        const data = validateElectricalData(s.article.snapshot.electrical);
        if (data.kind !== (role === "upstream" ? "protection" : role))
          add(
            role + ":function",
            tr(
              "Artikelfunktion passt nicht zur Stromkreisrolle.",
              "Part function does not match the circuit role.",
            ),
          );
        if (
          data.currentType &&
          data.currentType !== "ac_dc" &&
          data.currentType !== (record.system === "dc" ? "dc" : "ac")
        )
          add(
            role + ":type",
            tr(
              "Stromart des Artikels passt nicht zum Stromkreis.",
              "Part current type does not match the circuit.",
            ),
          );
        if (
          data.ratedVoltageV !== undefined &&
          record.voltageV !== undefined &&
          data.ratedVoltageV < record.voltageV
        )
          add(
            role + ":voltage",
            tr(
              "Bemessungsspannung des Artikels reicht nicht aus.",
              "Part rated voltage is insufficient.",
            ),
          );
        if (
          role === "cable" &&
          data.material &&
          data.material !== record.material
        )
          add(
            role + ":material",
            tr(
              "Leitermaterial weicht vom Artikel ab.",
              "Conductor material differs from the part.",
            ),
          );
      } catch {
        add(
          role + ":electrical",
          tr(
            "Ungültige elektrische Artikeldaten.",
            "Invalid electrical part data.",
          ),
        );
      }
    }
    if(s.cable){
      const cable=project&&uniqueCable(project,s.cable);
      if(role!=='cable'||s.device||!cable?.article||circuitArticleKey(cable.article)!==circuitArticleKey(s.article))
        add(role+':cable',tr('Kabelartikel stimmt nicht mit der verknüpften Kabeldefinition überein.','Cable part does not match the linked cable definition.'));
      else{
        for(const issue of cablePartFindings(cable).filter(i=>i.code!=='cable_length_missing'))add(role+':cable',issue.details);
        if(!sameCablePartData(cable.article,s.article))add(role+':cable_ratings',tr('Kabelkennwerte oder Quelle wurden geändert. Erneut ausdrücklich übernehmen.','Cable ratings or source have changed. Explicitly adopt them again.'));
        if(s.cable.adoptedLengthM!==undefined&&(s.cable.adoptedLengthM!==cable.lengthM||record.lengthM!==s.cable.adoptedLengthM))add(role+':cable_length',tr('Übernommene Kabellänge wurde geändert. Erneut übernehmen oder Kabelbezug lösen.','Adopted cable length has changed. Adopt again or detach the cable binding.'));
      }
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
        add(
          role + ":device",
          `${role}: ${tr("Artikel stimmt nicht mit dem Projektgerät überein", "Part does not match the project device")}`,
        );
    }
    if (
      !s.source ||
      (role !== "upstream" &&
        (!s.parameters || !Object.keys(s.parameters).length))
    )
      add(
        role + ":ratings",
        `${role}: ${tr("Kennwerte und Quelle fehlen", "Ratings and source missing")}`,
      );
    else
      for (const key of circuitArticleFields[role as CircuitArticleRole])
        if (record[key] !== s.parameters?.[key])
          add(
            role + ":" + key,
            `${role}: ${key}: ${tr("Formularwert weicht vom dokumentierten Artikelkennwert ab", "Form value differs from documented part rating")}`,
          );
  }
  return issues;
}
