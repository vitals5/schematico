import type { ProtectionCoordination } from "../model/ProtectionCoordination";
import type { ReportRow } from "./ManufacturingReports";
import { tr, type Language } from "../i18n";
export const protectionReportColumns = (language?: Language) => [
  tr("Bezug", "Reference", language),
  tr("Gerät / Größe", "Device / quantity", language),
  tr("Strom / Wert", "Current / value", language),
  tr("Zeitbereich / Quelle / Hinweis", "Time range / source / note", language),
];
export const protectionRoleLabel = (
  role: "protection" | "upstream",
  language?: Language,
) =>
  role === "protection"
    ? tr("Nachgeschaltet", "Downstream", language)
    : tr("Vorgeschaltet", "Upstream", language);
export function protectionReportRows(
  data: ProtectionCoordination,
): ReportRow[] {
  const label = (de: string, en: string) => tr(de, en, data.language);
  const row = (key: string, cells: string[]): ReportRow => ({
    key: JSON.stringify([data.circuitId, key]),
    cells: Object.fromEntries(cells.map((s, i) => ["c" + i, s])),
    pages: [],
    targets: [],
  });
  return [
    row("method", [
      data.name,
      label("Darstellung", "Presentation"),
      data.method,
      label(
        "Grafischer Vergleich dokumentierter Überstromstützpunkte. Verbindungslinien sind nur Lesehilfen. Kein automatischer Abschalt-, Selektivitäts- oder Backup-Nachweis.",
        "Graphical comparison of documented overcurrent points. Connecting lines are visual aids only. No automatic disconnection, selectivity or backup verification.",
      ),
    ]),
    ...(data.inputState
      ? [
          row("input-state", [
            data.name,
            label("Eingabestand", "Input state"),
            data.inputState === "draft"
              ? label("Vorschau", "Preview")
              : label("Gespeichert", "Saved"),
            data.inputState === "draft"
              ? label(
                  "Nicht übernommene Dialogeingaben; kein gespeicherter Projektstand.",
                  "Unsaved dialog inputs; not a saved project state.",
                )
              : label(
                  "Gespeicherter Stromkreisdatensatz.",
                  "Saved circuit record.",
                ),
          ]),
        ]
      : []),
    ...data.curves.flatMap((c) => [
      row(c.role + "-source", [
        protectionRoleLabel(c.role, data.language),
        c.label,
        [
          c.ratedVoltageV !== undefined ? c.ratedVoltageV + " V" : "",
          c.currentType?.toUpperCase(),
        ]
          .filter(Boolean)
          .join(" / "),
        c.source + "\n" + c.conditions,
      ]),
      ...c.points.map((p, i) =>
        row(c.role + "-" + i, [
          protectionRoleLabel(c.role, data.language),
          c.label,
          p.currentA + " A",
          p.timeMinS + " .. " + p.timeMaxS + " s",
        ]),
      ),
    ]),
    ...data.markers.map((m) =>
      row("marker-" + m.id, [
        label("Markierung", "Marker"),
        m.label,
        m.value + (m.axis === "current" ? " A" : " s"),
        m.source,
      ]),
    ),
    ...(data.selectivity
      ? [
          row("pair-proof", [
            label("Eingegebener Paarbeleg", "Entered pair proof"),
            data.selectivity.upstream + " -> " + data.selectivity.downstream,
            data.selectivity.limitA +
              " A / " +
              (data.selectivity.status === "pass"
                ? label("Grenzwertvergleich erfüllt", "Limit comparison passed")
                : data.selectivity.status === "fail"
                  ? label("Grenzwert überschritten", "Limit exceeded")
                  : label("Angaben fehlen", "Inputs missing")),
            data.selectivity.source,
          ]),
        ]
      : []),
    ...data.issues.map((issue, i) =>
      row("issue-" + i, [label("Hinweis", "Note"), "", "", issue]),
    ),
  ];
}
