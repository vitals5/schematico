import type { Project } from "../model/types";
import {
  automationColumns,
  type AutomationPlanRow,
} from "../reports/AutomationPlan";
import { engineeringTablePdf } from "./EngineeringTablePdf";
export function automationPlanPdf(
  rows: AutomationPlanRow[],
  projectName: string,
  project?: Project,
) {
  return engineeringTablePdf(
    "SPS- und Busübersicht",
    automationColumns,
    rows.map((r) => r.cells),
    projectName,
    project,
    [16, 32, 32, 28, 22, 20, 24, 40, 22, 42, 36, 36, 50],
  );
}
