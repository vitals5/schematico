import type { Project } from "../model/types";
import { connectorColumns, connectorCells } from "../reports/ConnectorPlan";
import type { ConnectorRow } from "../model/Connectors";
import { engineeringTablePdf } from "./EngineeringTablePdf";
export function connectorPlanPdf(
  rows: ConnectorRow[],
  projectName: string,
  project?: Project,
) {
  return engineeringTablePdf(
    "Steckerplan",
    connectorColumns,
    rows.map(connectorCells),
    projectName,
    project,
    [32, 18, 18, 23, 16, 50, 32, 20, 50, 65, 76],
  );
}
