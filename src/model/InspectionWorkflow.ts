import type { Project } from './types';
import {
  inspectElectricalProject,
  type InspectionFinding,
  type ElectricalInspectionReport,
} from './ElectricalInspection';
import { projectRevision } from '../layout/types';
export type TaskStatus = 'open' | 'in_progress' | 'exception';
export type InspectionChange = 'uncompared' | 'new' | 'existing' | 'resolved';
export interface InspectionWorkflow {
  schemaVersion: 1;
  baseline?: {
    at: string;
    rules: readonly string[];
    findings: InspectionFinding[];
  };
  decisions: {
    findingId: string;
    fingerprint: string;
    status: TaskStatus;
    reason: string;
    at: string;
  }[];
}
export interface InspectionTask {
  finding: InspectionFinding;
  current: boolean;
  status: TaskStatus;
  change: InspectionChange;
  reason: string;
  staleDecision: boolean;
}
/** No translated text and no review metadata participates in the evidence key.
 * Any changed affected drawing/data invalidates a prior acknowledgement. */
export function findingFingerprint(
  project: Project,
  finding: InspectionFinding,
): string {
  const locations = [finding.location, ...finding.relatedLocations];
  return JSON.stringify({
    rule: finding.ruleId,
    cause: finding.cause,
    articleData: finding.articleData,
    contexts: locations.map((l) => {
      const pages = project.pages.filter((p) => p.id === l.pageId);
      return {
        pageId: l.pageId,
        componentId: l.componentId,
        pinId: l.pinId,
        wireId: l.wireId,
        cableId: l.cableId,
        coreId: l.coreId,
        pages: pages.map((p) => ({
          higherLevel: p.higherLevel,
          location: p.location,
          components: p.components
            .filter((c) => c.id === l.componentId)
            .map((c) => ({
              component: c,
              symbol: project.symbolLibrary
                ?.filter((s) => s.id === c.symbolId)
                .map((s) => ({
                  id: s.id,
                  pins: s.pins,
                  electrical: s.electrical,
                  unresolved: s.unresolved,
                  functionDefinition: s.functionDefinition,
                })),
            })),
          wires: p.wires.filter((w) => w.id === l.wireId),
          cables: p.cables?.filter((c) => c.id === l.cableId),
        })),
      };
    }),
    logical: project.logicalConnections?.filter((w) =>
      locations.some((l) => w.id === l.wireId),
    ),
    devices: project.physicalDevices?.filter((d) =>
      d.members.some((a) =>
        locations.some((l) => l.componentId === a.componentId),
      ),
    ),
    potentials: finding.ruleId.startsWith('potential_')
      ? project.potentialDefinitions
      : undefined,
  });
}
export function inspectionTasks(
  project: Project,
  report: ElectricalInspectionReport = inspectElectricalProject(project),
): InspectionTask[] {
  const workflow = project.inspectionWorkflow,
    decisions = new Map(
      (workflow?.decisions ?? []).map((d) => [d.findingId, d]),
    ),
    previous = new Set(workflow?.baseline?.findings.map((f) => f.id)),
    current = new Set(report.messages.map((f) => f.id));
  const tasks: InspectionTask[] = report.messages.map((finding) => {
    const decision = decisions.get(finding.id),
      valid =
        !!decision &&
        decision.fingerprint === findingFingerprint(project, finding);
    return {
      finding,
      current: true,
      status: valid ? decision!.status : 'open',
      reason: valid ? decision!.reason : '',
      staleDecision: !!decision && !valid,
      change: workflow?.baseline
        ? previous.has(finding.id)
          ? 'existing'
          : 'new'
        : 'uncompared',
    };
  });
  for (const finding of workflow?.baseline?.findings ?? [])
    if (!current.has(finding.id))
      tasks.push({
        finding,
        current: false,
        status: 'open',
        reason: '',
        staleDecision: false,
        change: 'resolved',
      });
  return tasks;
}
export function filterInspectionTasks(
  tasks: InspectionTask[],
  status?: string,
  change?: string,
) {
  return tasks.filter(
    (t) =>
      (change === 'resolved' ? !t.current : t.current) &&
      (!status || t.status === status) &&
      (!change || t.change === change),
  );
}
export type WorkflowAction =
  | { kind: 'baseline' }
  | { kind: 'status'; ids: string[]; status: TaskStatus; reason: string };
export class InspectionWorkflowPlan {
  readonly #base: string;
  readonly #result: Project;
  constructor(project: Project, action: WorkflowAction) {
    this.#base = projectRevision(project);
    const result = structuredClone(project),
      report = inspectElectricalProject(project),
      workflow = (result.inspectionWorkflow ??= {
        schemaVersion: 1,
        decisions: [],
      });
    if (action.kind === 'baseline')
      workflow.baseline = {
        at: new Date().toISOString(),
        rules: [...report.rules],
        findings: structuredClone(report.messages),
      };
    else {
      if (
        !action.ids.length ||
        new Set(action.ids).size !== action.ids.length ||
        !['open', 'in_progress', 'exception'].includes(action.status) ||
        typeof action.reason !== 'string' ||
        action.reason.length > 4000 ||
        (action.status === 'exception' && !action.reason.trim())
      )
        throw new Error('worklistInvalid');
      const findings = new Map(report.messages.map((f) => [f.id, f]));
      for (const id of action.ids) {
        const finding = findings.get(id);
        if (!finding) throw new Error('worklistInvalid');
        workflow.decisions = workflow.decisions.filter(
          (d) => d.findingId !== id,
        );
        if (action.status !== 'open')
          workflow.decisions.push({
            findingId: id,
            fingerprint: findingFingerprint(project, finding),
            status: action.status,
            reason: action.reason.trim(),
            at: new Date().toISOString(),
          });
      }
    }
    this.#result = result;
  }
  apply(project: Project) {
    if (projectRevision(project) !== this.#base)
      throw new Error('articlesProjectStale');
    const result = structuredClone(this.#result);
    result.activePageId = project.activePageId;
    result.modified = new Date().toISOString();
    return result;
  }
}
