import type { AssignedArticle } from "./ArticleTypes";
import type { CircuitDimensioning } from "./ElectricalDimensioning";
import {
  validateElectricalData,
  type ArticleElectricalData,
  type ElectricalRatingKey,
} from "./ArticleElectrical";
import {
  circuitArticleKey,
  catalogCircuitArticle,
  adoptCircuitArticle,
  type CircuitArticleRole,
} from "./DimensioningArticles";
import { tr } from "../i18n";
export const circuitRoleLabel = (role: CircuitArticleRole) =>
  ({
    cable: tr("Leitung / Kabel", "Conductor / cable"),
    protection: tr("Schutzgerät", "Protective device"),
    load: tr("Verbraucher", "Load"),
    upstream: tr("Vorgeschaltetes Schutzgerät", "Upstream protective device"),
  })[role];
export interface CircuitArticleAssessment {
  status: "ready" | "missing" | "incompatible";
  missing: string[];
  conflicts: string[];
  data?: ArticleElectricalData;
}
/** A preselection check, not a complete circuit calculation or installation approval. */
export function assessCircuitArticle(
  article: AssignedArticle,
  role: CircuitArticleRole,
  input: CircuitDimensioning,
): CircuitArticleAssessment {
  const missing: string[] = [],
    conflicts: string[] = [];
  const raw = article.snapshot?.electrical;
  if (!raw)
    return {
      status: "missing",
      missing: [
        tr(
          "Strukturierte elektrische Kennwerte fehlen.",
          "Structured electrical ratings are missing.",
        ),
      ],
      conflicts,
    };
  let data: ArticleElectricalData;
  try {
    data = validateElectricalData(raw);
  } catch {
    return {
      status: "missing",
      missing: [
        tr(
          "Elektrische Kennwerte oder Quelle sind ungültig.",
          "Electrical ratings or source are invalid.",
        ),
      ],
      conflicts,
    };
  }
  if (data.kind !== (role === "upstream" ? "protection" : role))
    conflicts.push(
      tr(
        "Artikelfunktion passt nicht zur Rolle.",
        "Part function does not match this role.",
      ),
    );
  const need = (key: ElectricalRatingKey, label: string) => {
    if (data[key] === undefined) missing.push(label);
  };
  need(
    "ratedVoltageV",
    tr("Bemessungsspannung fehlt.", "Rated voltage missing."),
  );
  if (!data.currentType)
    missing.push(tr("Stromart fehlt.", "Current type missing."));
  else if (
    data.currentType !== "ac_dc" &&
    data.currentType !== (input.system === "dc" ? "dc" : "ac")
  )
    conflicts.push(
      tr(
        "Stromart passt nicht zum Stromkreis.",
        "Current type does not match the circuit.",
      ),
    );
  if (
    data.ratedVoltageV !== undefined &&
    input.voltageV !== undefined &&
    data.ratedVoltageV < input.voltageV
  )
    conflicts.push(
      tr("Bemessungsspannung ist zu niedrig.", "Rated voltage is too low."),
    );
  if (role === "cable") {
    need(
      "sectionMm2",
      tr("Leiterquerschnitt fehlt.", "Conductor cross-section missing."),
    );
    need(
      "ampacityA",
      tr(
        "Tabellen-Strombelastbarkeit fehlt.",
        "Tabulated current capacity missing.",
      ),
    );
    need("cores", tr("Aderzahl fehlt.", "Core count missing."));
    if (!data.material)
      missing.push(tr("Leitermaterial fehlt.", "Conductor material missing."));
    if (
      data.cores !== undefined &&
      data.cores < (input.system === "ac3" ? 4 : input.system === "ac1" ? 3 : 2)
    )
      conflicts.push(
        tr(
          "Aderzahl reicht für die Stromkreisvorlage nicht aus.",
          "Insufficient cores for the circuit template.",
        ),
      );
    if (input.system !== "dc")
      need(
        "reactanceOhmKm",
        tr(
          "Reaktanz fehlt; bewusst vernachlässigt als 0 erfassen.",
          "Reactance missing; enter 0 if deliberately neglected.",
        ),
      );
  } else if (role === "protection" || role === "upstream") {
    need(
      "protectiveCurrentA",
      tr("Bemessungsstrom fehlt.", "Rated current missing."),
    );
    need("poles", tr("Polzahl fehlt.", "Pole count missing."));
    if (role === "protection") {
      need(
        "conventionalTripA",
        tr(
          "Konventioneller Auslösestrom I2 fehlt.",
          "Conventional tripping current I2 missing.",
        ),
      );
      if (
        data.poles !== undefined &&
        data.poles < (input.system === "ac3" ? 3 : 1)
      )
        conflicts.push(
          tr(
            "Zu wenige Pole für das gewählte System.",
            "Too few poles for the selected system.",
          ),
        );
      if (input.verifyFault)
        need(
          "breakingCapacityA",
          tr("Ausschaltvermögen fehlt.", "Breaking capacity missing."),
        );
    }
  } else if (
    data.currentA === undefined &&
    (data.outputPowerW === undefined || data.efficiency === undefined)
  )
    missing.push(
      tr(
        "Betriebsstrom oder Leistung mit Wirkungsgrad fehlen.",
        "Operating current or power with efficiency missing.",
      ),
    );
  if (role === "load" && input.system !== "dc")
    need("cosPhi", tr("Leistungsfaktor fehlt.", "Power factor missing."));
  return {
    status: conflicts.length
      ? "incompatible"
      : missing.length
        ? "missing"
        : "ready",
    missing,
    conflicts,
    data,
  };
}
export interface CircuitArticleFilters {
  query?: string;
  manufacturer?: string;
  projectOnly?: boolean;
  withRatingsOnly?: boolean;
  includeIncompatible?: boolean;
}
export type CircuitArticleRow = {
  article: AssignedArticle;
  assessment: CircuitArticleAssessment;
  inProject: boolean;
};
/** Build assessments once per catalogue/record snapshot; search does not rerun electrical validation. */
export function circuitArticleRows(
  articles: AssignedArticle[],
  role: CircuitArticleRole,
  input: CircuitDimensioning,
  projectKeys: ReadonlySet<string> = new Set(),
): CircuitArticleRow[] {
  return articles
    .filter(
      (a) =>
        !a.snapshot?.electrical?.kind ||
        a.snapshot.electrical.kind ===
          (role === "upstream" ? "protection" : role),
    )
    .map((article) => ({
      article,
      assessment: assessCircuitArticle(article, role, input),
      inProject: projectKeys.has(circuitArticleKey(article)),
    }))
    .sort(
      (a, b) =>
        ({ ready: 0, missing: 1, incompatible: 2 })[a.assessment.status] -
          { ready: 0, missing: 1, incompatible: 2 }[b.assessment.status] ||
        a.article.manufacturer.localeCompare(b.article.manufacturer) ||
        a.article.articleNumber.localeCompare(b.article.articleNumber) ||
        a.article.variant.localeCompare(b.article.variant),
    );
}
export function filterCircuitArticleRows(
  rows: CircuitArticleRow[],
  filters: CircuitArticleFilters = {},
) {
  const words = (filters.query ?? "")
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return rows.filter(
    ({ article, assessment, inProject }) =>
      (filters.manufacturer === undefined ||
        article.manufacturer === filters.manufacturer) &&
      (!filters.projectOnly || inProject) &&
      (!filters.withRatingsOnly || !!assessment.data) &&
      (filters.includeIncompatible || assessment.status !== "incompatible") &&
      words.every((w) =>
        [
          article.manufacturer,
          article.articleNumber,
          article.variant,
          article.snapshot?.description,
          assessment.data?.characteristic,
          assessment.data?.sectionMm2,
          assessment.data?.protectiveCurrentA,
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(w),
      ),
  );
}
/** Role-aware search without guessing categories or ratings from part descriptions. */
export function filterCircuitArticles(
  articles: AssignedArticle[],
  role: CircuitArticleRole,
  input: CircuitDimensioning,
  filters: CircuitArticleFilters = {},
  projectKeys: ReadonlySet<string> = new Set(),
) {
  return filterCircuitArticleRows(
    circuitArticleRows(articles, role, input, projectKeys),
    filters,
  );
}
/** Choosing another exact part detaches the previous device and invalidates pair-specific proof. */
export function selectCircuitArticle(
  input: CircuitDimensioning,
  role: CircuitArticleRole,
  article: AssignedArticle | undefined,
  adopt = false,
): CircuitDimensioning {
  const next = structuredClone(input),
    old = next.articles?.[role];
  if (
    article &&
    assessCircuitArticle(article, role, input).status === "incompatible"
  )
    throw Error(
      tr(
        "Dieser Artikel passt nicht zum gewählten Stromkreis.",
        "This part does not match the selected circuit.",
      ),
    );
  const changed =
    !article ||
    !old ||
    circuitArticleKey(old.article) !== circuitArticleKey(article) ||
    JSON.stringify(old.article.snapshot) !== JSON.stringify(article.snapshot);
  next.articles = { ...next.articles };
  if (changed) {
    if (role === "protection" || role === "upstream") {
      delete next.selectivityLimitA;
      delete next.selectivitySource;
    }
    if (role === "protection") {
      delete next.protectionSource;
      delete next.energySource;
    }
    if (role === "cable") delete next.ampacitySource;
    if (article)
      next.articles[role] = {
        ...(catalogCircuitArticle(article, role) ?? {}),
        article: structuredClone(article),
      };
    else delete next.articles[role];
  }
  if (adopt) {
    if (!article)
      throw Error(
        tr("Zuerst einen Artikel auswählen.", "Select a part first."),
      );
    const adopted = adoptCircuitArticle(next, role);
    if (role === "load") {
      const p = adopted.articles?.load?.parameters;
      if (p?.currentA !== undefined) adopted.loadMode = "current";
      else if (p?.outputPowerW !== undefined) adopted.loadMode = "power";
    }
    return adopted;
  }
  return next;
}
