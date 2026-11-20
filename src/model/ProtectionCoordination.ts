import type { Project } from "./types";
import type { CircuitDimensioning } from "./ElectricalDimensioning";
import { calculateDimensioning } from "./ElectricalDimensioning";
import {
  validateElectricalData,
  type ArticleElectricalData,
} from "./ArticleElectrical";
import {
  circuitArticleIssues,
  circuitArticleKey,
} from "./DimensioningArticles";
import { tr as translate, getUiLanguage, type Language } from "../i18n";
export type ProtectionRole = "protection" | "upstream";
export type ProtectionPoint = NonNullable<
  ArticleElectricalData["curve"]
>[number];
export interface ProtectionCurve {
  role: ProtectionRole;
  key: string;
  label: string;
  source: string;
  conditions: string;
  points: ProtectionPoint[];
  ratedVoltageV?: number;
  currentType?: ArticleElectricalData["currentType"];
}
export interface ProtectionMarker {
  id: string;
  axis: "current" | "time";
  value: number;
  label: string;
  source: string;
}
export interface ProtectionCoordination {
  method: "schematico-protection-coordination-v1";
  inputState?: "saved" | "draft";
  language: Language;
  circuitId: string;
  name: string;
  curves: ProtectionCurve[];
  markers: ProtectionMarker[];
  issues: string[];
  sampleCurrents: number[];
  selectivity?: {
    upstream: string;
    downstream: string;
    limitA: number;
    source: string;
    status: string;
  };
}
const positive = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;
/** Read-only projection of documented snapshots. It never invents curves, interpolates proof or writes ratings. */
export function protectionCoordination(
  record: CircuitDimensioning,
  project?: Project,
  language: Language = getUiLanguage(),
): ProtectionCoordination {
  const tr = (de: string, en: string) => translate(de, en, language);
  const out: ProtectionCoordination = {
    method: "schematico-protection-coordination-v1",
    language,
    circuitId: record.id,
    name: record.name,
    curves: [],
    markers: [],
    issues: [],
    sampleCurrents: [],
  };
  for (const role of ["protection", "upstream"] as const) {
    const title =
        role === "protection"
          ? tr("Nachgeschaltetes Schutzgerät", "Downstream protective device")
          : tr("Vorgeschaltetes Schutzgerät", "Upstream protective device"),
      selection = record.articles?.[role];
    if (!selection) {
      out.issues.push(
        title + ": " + tr("Kein Artikel zugeordnet.", "No part assigned."),
      );
      continue;
    }
    let data: ArticleElectricalData;
    try {
      data = validateElectricalData(selection.article.snapshot?.electrical);
    } catch {
      out.issues.push(
        title +
          ": " +
          tr(
            "Dokumentierte elektrische Artikeldaten fehlen oder sind ungültig.",
            "Documented electrical part data is missing or invalid.",
          ),
      );
      continue;
    }
    if (data.kind !== "protection" || !data.curve?.length) {
      out.issues.push(
        title +
          ": " +
          tr(
            "Keine Herstellerstützpunkte hinterlegt.",
            "No manufacturer points recorded.",
          ),
      );
      continue;
    }
    if (data.curveKind !== "overcurrent") {
      out.issues.push(
        title +
          ": " +
          (data.curveKind === "residual"
            ? tr(
                "Differenzstromkennlinie gehört nicht in den Überstromvergleich.",
                "Residual-current curve is not part of an overcurrent comparison.",
              )
            : tr(
                "Kennlinienart fehlt. Im Artikel ausdrücklich Überstrom oder Differenzstrom festlegen.",
                "Curve type missing. Explicitly specify overcurrent or residual current in the part.",
              )),
      );
      continue;
    }
    const label = [
      selection.article.manufacturer,
      selection.article.articleNumber,
      selection.article.variant,
    ]
      .filter(Boolean)
      .join(" · ");
    out.curves.push({
      role,
      key: circuitArticleKey(selection.article),
      label,
      source: data.source,
      conditions: data.conditions!,
      points: structuredClone(data.curve),
      ratedVoltageV: data.ratedVoltageV,
      currentType: data.currentType,
    });
    if (!data.currentType)
      out.issues.push(
        title +
          ": " +
          tr("Stromart nicht dokumentiert.", "Current type not documented."),
      );
    else if (
      data.currentType !== "ac_dc" &&
      data.currentType !== (record.system === "dc" ? "dc" : "ac")
    )
      out.issues.push(
        title +
          ": " +
          tr(
            "Stromart passt nicht zur Berechnung.",
            "Current type does not match the calculation.",
          ),
      );
    if (data.ratedVoltageV === undefined)
      out.issues.push(
        title +
          ": " +
          tr(
            "Bemessungsspannung nicht dokumentiert.",
            "Rated voltage not documented.",
          ),
      );
    else if (
      record.voltageV !== undefined &&
      data.ratedVoltageV < record.voltageV
    )
      out.issues.push(
        title +
          ": " +
          tr(
            "Bemessungsspannung niedriger als die Betriebsspannung.",
            "Rated voltage below operating voltage.",
          ),
      );
  }
  circuitArticleIssues(project, record, (key, message) => {
    if (
      key === "invalid" ||
      key.startsWith("protection:") ||
      key.startsWith("upstream:")
    )
      out.issues.push(message);
  });
  const result = calculateDimensioning(record, project);
  const marker = (
    id: string,
    axis: ProtectionMarker["axis"],
    value: number | undefined,
    label: string,
    source: string | undefined,
  ) => {
    if (positive(value) && source?.trim())
      out.markers.push({ id, axis, value, label, source });
  };
  marker(
    "ib",
    "current",
    result.values.currentA,
    tr("Betriebsstrom Ib", "Operating current Ib"),
    record.inputSource ||
      tr(
        "Berechnung aus eingegebenen Lastdaten",
        "Calculated from entered load data",
      ),
  );
  marker(
    "ik-min",
    "current",
    result.values.faultMinA,
    "Ik,min",
    record.faultSource,
  );
  marker(
    "ik-max",
    "current",
    result.values.faultMaxA,
    "Ik,max",
    record.faultMode === "loop"
      ? record.faultMaximumSource
      : record.faultSource,
  );
  if (record.verifyFault)
    marker(
      "disconnect",
      "time",
      record.requiredDisconnectS,
      tr("Geforderte Abschaltzeit", "Required disconnection time"),
      tr("Explizite Eingabe im Stromkreis", "Explicit circuit input"),
    );
  if (
    record.verifySelectivity &&
    positive(record.selectivityLimitA) &&
    record.selectivitySource?.trim() &&
    record.upstreamDevice?.trim() &&
    record.downstreamDevice?.trim()
  ) {
    out.selectivity = {
      limitA: record.selectivityLimitA,
      source: record.selectivitySource,
      upstream: record.upstreamDevice,
      downstream: record.downstreamDevice,
      status:
        result.checks.find((c) => c.id === "selectivity")?.status ?? "missing",
    };
    marker(
      "selectivity",
      "current",
      record.selectivityLimitA,
      tr(
        "Eingegebene Hersteller-Selektivitätsgrenze",
        "Entered manufacturer selectivity limit",
      ),
      record.selectivitySource,
    );
  }
  out.sampleCurrents = [
    ...new Set(out.curves.flatMap((c) => c.points.map((p) => p.currentA))),
  ].sort((a, b) => a - b);
  out.issues = [...new Set(out.issues)];
  return out;
}
export function protectionSamplesAt(
  data: ProtectionCoordination,
  currentA: number,
) {
  return data.curves.map((c) => ({
    role: c.role,
    label: c.label,
    point: c.points.find((p) => p.currentA === currentA),
  }));
}
