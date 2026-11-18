import type { Project } from "../model/types";
import {
  connectionColumns,
  connectionCells,
  type ConnectionRow,
} from "../reports/ConnectionList";
import { engineeringTablePdf } from "./EngineeringTablePdf";
export function connectionListPdf(
  rows: ConnectionRow[],
  projectName: string,
  project?: Project,
) {
  return engineeringTablePdf(
    "Verbindungsliste",
    connectionColumns,
    rows.map(connectionCells),
    projectName,
    project,
    [17, 31, 21, 46, 46, 20, 17, 23, 25, 20, 22, 112],
  );
}
