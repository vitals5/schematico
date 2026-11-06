import {
  inspectionTasks,
  filterInspectionTasks,
} from '../../model/InspectionWorkflow';
import type { McpToolDefinition } from './definitions';
import type { CanvasStateManager } from './handlers';
import { inspectElectricalProject } from '../../model/ElectricalInspection';
import {
  reviewInspection,
  type ReviewFilters,
  type ReviewGrouping,
} from '../../model/InspectionReview';
import { ARTICLE_DATA_STATES } from '../../model/ArticleDataAnalysis';
export const GET_INSPECTION_REVIEW_TOOL: McpToolDefinition = {
  name: 'get_inspection_review',
  description:
    'Read-only grouped electrical findings and article import provenance. Filter by rule, severity, page, article state, taskStatus, change or search. Exceptions never suppress the raw electrical summary. Resolved means no longer reported since the explicitly saved baseline, not proven electrically corrected. Designation groups are candidate review contexts, never confirmed physical devices. No automatic article assignment. Use groupId to page through all findings in a selected group; otherwise returns paginated group summaries.',
  inputSchema: {
    type: 'object',
    properties: {
      taskStatus: {
        type: 'string',
        enum: ['open', 'in_progress', 'exception'],
      },
      change: {
        type: 'string',
        enum: ['uncompared', 'new', 'existing', 'resolved'],
      },
      groupBy: {
        type: 'string',
        enum: ['rule', 'designation', 'page', 'none'],
      },
      groupId: { type: 'string' },
      rule: { type: 'string' },
      severity: { type: 'string', enum: ['error', 'warning', 'info'] },
      pageId: { type: 'string' },
      articleState: { type: 'string', enum: [...ARTICLE_DATA_STATES] },
      search: { type: 'string' },
      offset: { type: 'number' },
      limit: { type: 'number' },
    },
  },
};
export async function handleInspectionReview(
  args: any,
  manager: CanvasStateManager,
) {
  const offset = args.offset ?? 0,
    limit = args.limit ?? 50,
    groupBy: ReviewGrouping = args.groupBy ?? 'rule';
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 200
  )
    throw new Error('Ungültiger Indexbereich.');
  if (!['rule', 'designation', 'page', 'none'].includes(groupBy))
    throw new Error('Ungültige Gruppierung.');
  const filters: ReviewFilters = {};
  for (const key of [
    'rule',
    'severity',
    'pageId',
    'articleState',
    'search',
  ] as const) {
    if (args[key] !== undefined && typeof args[key] !== 'string')
      throw new Error('Ungültiger Filter.');
    if (args[key]) (filters as any)[key] = args[key];
  }
  if (
    (filters.articleState &&
      !ARTICLE_DATA_STATES.includes(filters.articleState)) ||
    (filters.severity &&
      !['error', 'warning', 'info'].includes(filters.severity))
  )
    throw new Error('Ungültiger Filter.');
  if (
    (args.taskStatus !== undefined &&
      !['open', 'in_progress', 'exception'].includes(args.taskStatus)) ||
    (args.change !== undefined &&
      !['uncompared', 'new', 'existing', 'resolved'].includes(args.change))
  )
    throw new Error('Invalid worklist filter.');
  const project = manager.getProject(),
    report = inspectElectricalProject(project),
    tasks = inspectionTasks(project, report),
    taskById = new Map(tasks.map((task) => [task.finding.id, task])),
    view = reviewInspection(
      filterInspectionTasks(tasks, args.taskStatus, args.change).map(
        (task) => task.finding,
      ),
      filters,
      groupBy,
    );
  if (args.groupId !== undefined && typeof args.groupId !== 'string')
    throw new Error('Ungültige Gruppe.');
  const group =
    args.groupId === undefined
      ? undefined
      : view.groups.find((g) => g.id === args.groupId);
  if (args.groupId !== undefined && !group)
    throw new Error('Gruppe nicht gefunden.');
  const ids = new Set(group?.messageIds),
    members = group ? view.filtered.filter((m) => ids.has(m.id)) : [];
  return {
    success: true,
    readOnly: true,
    summary: report.summary,
    articleDataSummary: report.articleDataSummary,
    coverage: report.coverage,
    worklist: {
      baselineAt: project.inspectionWorkflow?.baseline?.at,
      taskStatus: args.taskStatus,
      change: args.change,
      current: tasks.filter((task) => task.current).length,
      noLongerReported: tasks.filter((task) => !task.current).length,
    },
    totalFindings: report.messages.length,
    matchingFindings: view.filtered.length,
    groupBy,
    filters,
    groups: {
      total: view.groups.length,
      offset,
      items: group
        ? []
        : view.groups
            .slice(offset, offset + limit)
            .map((g) => ({
              id: g.id,
              label: g.label,
              count: g.messageIds.length,
              sampleMessageIds: g.messageIds.slice(0, 5),
            })),
    },
    ...(group
      ? {
          groupId: group.id,
          messages: {
            total: members.length,
            offset,
            items: members
              .slice(offset, offset + limit)
              .map((finding) => ({
                ...finding,
                worklist: {
                  current: taskById.get(finding.id)!.current,
                  status: taskById.get(finding.id)!.status,
                  change: taskById.get(finding.id)!.change,
                  reason: taskById.get(finding.id)!.reason,
                  staleDecision: taskById.get(finding.id)!.staleDecision,
                },
              })),
          },
        }
      : {}),
  };
}
