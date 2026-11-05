import type { McpToolDefinition } from './definitions';
import type { CanvasStateManager } from './handlers';
import { inspectElectricalProject } from '../../model/ElectricalInspection';
import { reviewInspection, type ReviewFilters, type ReviewGrouping } from '../../model/InspectionReview';
import { ARTICLE_DATA_STATES } from '../../model/ArticleDataAnalysis';
export const GET_INSPECTION_REVIEW_TOOL: McpToolDefinition = { name: 'get_inspection_review', description: 'Read-only grouped electrical findings and article import provenance. Filter by rule, severity, page, article state or search. Designation groups are candidate review contexts, never confirmed physical devices. No automatic article assignment. Use groupId to page through all findings in a selected group; otherwise returns paginated group summaries.', inputSchema: { type: 'object', properties: { groupBy: { type: 'string', enum: ['rule', 'designation', 'page', 'none'] }, groupId: { type: 'string' }, rule: { type: 'string' }, severity: { type: 'string', enum: ['error', 'warning', 'info'] }, pageId: { type: 'string' }, articleState: { type: 'string', enum: [...ARTICLE_DATA_STATES] }, search: { type: 'string' }, offset: { type: 'number' }, limit: { type: 'number' } } } };
export async function handleInspectionReview(args: any, manager: CanvasStateManager) {
    const offset = args.offset ?? 0, limit = args.limit ?? 50, groupBy: ReviewGrouping = args.groupBy ?? 'rule';
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200)
        throw new Error('Ungültiger Indexbereich.');
    if (!['rule', 'designation', 'page', 'none'].includes(groupBy))
        throw new Error('Ungültige Gruppierung.');
    const filters: ReviewFilters = {};
    for (const key of ['rule', 'severity', 'pageId', 'articleState', 'search'] as const) {
        if (args[key] !== undefined && typeof args[key] !== 'string')
            throw new Error('Ungültiger Filter.');
        if (args[key])
            (filters as any)[key] = args[key];
    }
    if (filters.articleState && !ARTICLE_DATA_STATES.includes(filters.articleState) || filters.severity && !['error', 'warning', 'info'].includes(filters.severity))
        throw new Error('Ungültiger Filter.');
    const report = inspectElectricalProject(manager.getProject()), view = reviewInspection(report.messages, filters, groupBy);
    if (args.groupId !== undefined && typeof args.groupId !== 'string')
        throw new Error('Ungültige Gruppe.');
    const group = args.groupId === undefined ? undefined : view.groups.find(g => g.id === args.groupId);
    if (args.groupId !== undefined && !group)
        throw new Error('Gruppe nicht gefunden.');
    const ids = new Set(group?.messageIds), members = group ? view.filtered.filter(m => ids.has(m.id)) : [];
    return { success: true, readOnly: true, summary: report.summary, articleDataSummary: report.articleDataSummary, coverage: report.coverage, totalFindings: report.messages.length, matchingFindings: view.filtered.length, groupBy, filters,
        groups: { total: view.groups.length, offset, items: group ? [] : view.groups.slice(offset, offset + limit).map(g => ({ id: g.id, label: g.label, count: g.messageIds.length, sampleMessageIds: g.messageIds.slice(0, 5) })) },
        ...(group ? { groupId: group.id, messages: { total: members.length, offset, items: members.slice(offset, offset + limit) } } : {}) };
}
