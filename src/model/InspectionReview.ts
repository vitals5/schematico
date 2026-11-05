import type { InspectionFinding } from './ElectricalInspection';
import type { ArticleDataState } from './ArticleDataAnalysis';
export type ReviewGrouping = 'rule' | 'designation' | 'page' | 'none';
export interface ReviewFilters {
    rule?: string;
    severity?: string;
    pageId?: string;
    articleState?: ArticleDataState | '';
    search?: string;
}
export interface InspectionGroup {
    id: string;
    label: string;
    messageIds: string[];
}
/** Groups are review contexts, never physical device identities or merged findings. */
export function reviewInspection(messages: readonly InspectionFinding[], filters: ReviewFilters = {}, grouping: ReviewGrouping = 'rule') {
    const search = filters.search?.trim().toLocaleLowerCase() ?? '';
    const filtered = messages.filter(m => (!filters.rule || m.ruleId === filters.rule) && (!filters.severity || m.severity === filters.severity)
        && (!filters.pageId || m.pageId === filters.pageId || m.relatedLocations.some(l => l.pageId === filters.pageId))
        && (!filters.articleState || m.articleData?.state === filters.articleState)
        && (!search || [m.bmk, m.message, m.ruleId, m.pageNumber, m.componentId, m.articleData?.symbolId, m.articleData?.plant, m.articleData?.location, m.articleData?.plant ? '=' + m.articleData.plant : '', m.articleData?.location ? '+' + m.articleData.location : '', m.articleData?.observedArticleNumber].join(' ').toLocaleLowerCase().includes(search)));
    const groups = new Map<string, InspectionGroup>();
    for (const m of filtered) {
        const context = m.articleData;
        const [id, label] = grouping === 'rule' ? [JSON.stringify(['rule', m.ruleId]), m.ruleId] : grouping === 'page' ? [JSON.stringify(['page', m.pageId]), m.pageNumber] : grouping === 'designation' && context?.designationKey
            ? [JSON.stringify(['designation', context.designationKey]), `${context.plant ? '=' + context.plant : ''}${context.location ? '+' + context.location : ''}${m.bmk ?? ''}`]
            : [JSON.stringify(['finding', m.id]), m.bmk || m.componentId || m.ruleId];
        if (!groups.has(id))
            groups.set(id, { id, label, messageIds: [] });
        groups.get(id)!.messageIds.push(m.id);
    }
    return { total: messages.length, filtered, groups: [...groups.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) };
}
