import type { Project } from "../model/types";
import { documentFrame } from "../model/DocumentSheet";
import {
  layoutPdfTable,
  manufacturingReportPdf,
} from "./ManufacturingReportPdf";
/** All navigator tables share measured wrapping, continued rows and project frames. */
export function engineeringTablePdf(
  title: string,
  columns: readonly string[],
  cells: readonly string[][],
  projectName: string,
  project?: Project,
  weights?: readonly number[],
) {
  const rows = cells.map((values, i) => ({
    key: String(i),
    cells: Object.fromEntries(values.map((v, j) => ["c" + j, v])),
    pages: [],
    targets: [],
  }));
  return manufacturingReportPdf(
    layoutPdfTable(
      {
        title,
        paper: "a3",
        orientation: "landscape",
        fontSize: 7,
        columns: columns.map((label, i) => ({
          id: "c" + i,
          label,
          weight: Math.max(1, (weights?.[i] ?? 20) / 10),
        })),
      },
      rows,
      projectName,
      documentFrame(project ?? projectName),
    ),
  );
}
