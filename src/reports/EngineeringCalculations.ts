import type { Project } from "../model/types";
import {
  dimensioningResults,
  dimensioningNumbers,
  dimensioningNumber,
  type NumericDimensioningKey,
} from "../model/ElectricalDimensioning";
import {
  savedRevisions,
  type RevisionComparison,
} from "../model/ProjectRevisions";
import type { ReportRow } from "./ManufacturingReports";
export const dimensioningStatus = {
  pass: "Erfüllt",
  fail: "Nicht erfüllt",
  missing: "Angaben fehlen",
  not_requested: "Nicht beauftragt",
};
/** The bundled PDF table font uses WinAnsi. Spell mathematical notation before measuring it. */
export function engineeringPdfRows(rows: ReportRow[]): ReportRow[] {
  const symbols: Record<string, string> = {
    Ω: "Ohm",
    φ: "phi",
    η: "eta",
    θ: "theta",
    α: "alpha",
    ρ: "rho",
    "√": "sqrt",
    "≤": "<=",
    "≥": ">=",
    "→": "->",
    "−": "-",
    "…": "...",
  };
  return rows.map((r) => ({
    ...r,
    cells: Object.fromEntries(
      Object.entries(r.cells).map(([key, value]) => [
        key,
        value
          .replace(/√3/g, "sqrt(3)")
          .replace(/√s/g, " sqrt(s)")
          .replace(/[Ωφηθαρ√≤≥→−…]/g, (c) => symbols[c]),
      ]),
    ),
  }));
}
export function dimensioningReportRows(project: Project): ReportRow[] {
  return dimensioningResults(project).flatMap((r, i) => {
    const input = Array.isArray(project.dimensioning)
      ? project.dimensioning[i]
      : undefined;
    const targetPage = project.pages.find(
      (p) => p.id === input?.reference?.pageId,
    );
    const target = targetPage?.components.find(
      (c) => c.id === input?.reference?.from?.componentId,
    );
    const base = {
      pages: targetPage ? [targetPage.id] : [],
      targets:
        targetPage && target
          ? [
              {
                pageId: targetPage.id,
                componentId: target.id,
                label: target.bmk,
              },
            ]
          : [],
    };
    const row = (
      key: string,
      label: string,
      status: string,
      detail: string,
    ): ReportRow => ({
      ...base,
      key: JSON.stringify([r.circuitId, key]),
      cells: { c0: r.name, c1: label, c2: status, c3: detail },
    });
    return [
      row(
        "system",
        "Berechnungsmodell",
        r.method,
        `${input?.system ?? "—"} · ${input?.material ?? "—"} · Last: ${input?.loadMode ?? "—"} · ${input?.powerFactorKind ?? "—"} · Fehlerstrom: ${input?.faultMode ?? "direct"}`,
      ),
      ...(input?.reference
        ? [
            row(
              "reference",
              "Planbezug",
              input.reference.pageId ?? "logisch",
              `${input.reference.wireId} · ${input.reference.from?.componentId}:${input.reference.from?.pinId} → ${input.reference.to?.componentId}:${input.reference.to?.pinId}${input.reference.importedValues ? "\nAusdrücklich übernommene Quelldaten: " + JSON.stringify(input.reference.importedValues) : ""}`,
            ),
          ]
        : []),
      ...Object.entries(dimensioningNumbers).flatMap(([key, spec]) =>
        input?.[key as NumericDimensioningKey] === undefined
          ? []
          : [
              row(
                "input-" + key,
                spec.label,
                "Eingabe",
                String(input[key as NumericDimensioningKey]),
              ),
            ],
      ),
      ...(
        [
          "inputSource",
          "ampacitySource",
          "protectionSource",
          "faultSource",
          "faultMaximumSource",
          "energySource",
          "selectivitySource",
          "upstreamDevice",
          "downstreamDevice",
        ] as const
      ).flatMap((key) =>
        input?.[key]
          ? [
              row(
                "source-" + key,
                {
                  inputSource: "Quelle Leitungs-/Lastdaten",
                  ampacitySource: "Quelle Iz0 / Verlegebedingungen",
                  protectionSource: "Quelle Schutzgerätekennwerte",
                  faultSource: "Quelle Fehlerstrom / Impedanz",
                  faultMaximumSource: "Beleg maximaler Netzkurzschlussstrom",
                  energySource: "Quelle k / Durchlassenergie",
                  selectivitySource: "Selektivitätsbeleg",
                  upstreamDevice: "Vorgeschaltetes Gerät",
                  downstreamDevice: "Nachgeschaltetes Gerät",
                }[key],
                "Nachweis / Angabe",
                input[key]!,
              ),
            ]
          : [],
      ),
      ...Object.entries(r.values).map(([key, value]) =>
        row(
          "result-" + key,
          (
            {
              currentA: "Betriebsstrom [A]",
              resistanceOhmKm: "Betriebswiderstand [Ω/km]",
              dropV: "Spannungsfall [V]",
              dropPercent: "Spannungsfall [%]",
              lossW: "Leitungsverlust [W]",
              ampacityA: "Korrigiertes Iz [A]",
              faultMinA: "Ik,min [A]",
              faultMaxA: "Maßgebender Ik,max [A]",
              loopFaultMaxA: "Einpoliger maximaler Schleifen-Fehlerstrom [A]",
              withstandA2s: "k²S² [A²s]",
            } as Record<string, string>
          )[key] ?? key,
          "Ergebnis",
          dimensioningNumber(value),
        ),
      ),
      ...r.checks.map((c) =>
        row(
          c.id,
          c.label,
          dimensioningStatus[c.status],
          c.message + (c.formula ? "\n" + c.formula : ""),
        ),
      ),
      ...r.assumptions.map((s, j) =>
        row("assumption-" + j, "Berechnungsgrundlage", "Annahme / Methode", s),
      ),
    ];
  });
}
export const dimensioningColumns = [
  "Stromkreis",
  "Prüfung / Größe",
  "Status / Einheit",
  "Eingabe / Ergebnis / Grundlage",
];
export const revisionColumns = [
  "Stand",
  "Status",
  "Bearbeiter / Datum",
  "Änderungsgrund / Freigabe",
];
export function revisionReportRows(project: Project): ReportRow[] {
  return savedRevisions(project).map((r) => ({
    key: r.id,
    pages: [],
    targets: [],
    cells: {
      c0: r.name,
      c1: r.status === "released" ? "Freigegeben" : "Gespeichert",
      c2: `${r.author}\n${r.created}`,
      c3: `${r.reason}\nSHA-256: ${r.digest}${r.approval ? `\nFreigabe: ${r.approval.author} · ${r.approval.at}\n${r.approval.reason}` : ""}`,
    },
  }));
}
export function comparisonReportRows(report: RevisionComparison): ReportRow[] {
  return report.changes.flatMap((c) =>
    c.fields.map((f, i) => ({
      key: c.key + ":" + i,
      pages: [],
      targets: [],
      cells: {
        c0: c.pageNumber ?? "Projekt",
        c1: `${c.kind} · ${c.label}`,
        c2: `${c.status} · ${f.path}`,
        c3: JSON.stringify(f.before) ?? "—",
        c4: JSON.stringify(f.after) ?? "—",
      },
    })),
  );
}
export function engineeringReportCsv(
  columns: string[],
  rows: ReportRow[],
): string {
  const quote = (v: string) =>
    '"' + (/^[=+@\-\t\r]/.test(v) ? "'" : "") + v.replaceAll('"', '""') + '"';
  return (
    "\uFEFF" +
    [columns, ...rows.map((r) => columns.map((_, i) => r.cells["c" + i] ?? ""))]
      .map((r) => r.map(quote).join(";"))
      .join("\r\n")
  );
}
