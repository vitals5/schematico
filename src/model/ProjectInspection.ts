import type { Project } from './types';
import { ProjectIndex } from './ProjectIndex';
import { ElectricalNetService } from './ElectricalNetService';
import { inspectElectricalProject } from './ElectricalInspection';
export type { InspectionFinding as PlausibilityMessage } from './ElectricalInspection';
/** Compatibility entry point: all consumers share the same rule service. */
export function collectPlausibilityMessages(project: Project, index = new ProjectIndex(project), nets = new ElectricalNetService(index)) {
    return inspectElectricalProject(project, index, nets).messages;
}
