import type { Project } from './types';
import { ProjectIndex } from './ProjectIndex';
import { isConnectionSymbol } from './ConnectionSymbols';
import { t } from '../i18n';
import { ElectricalNetService } from './ElectricalNetService';
export interface PlausibilityMessage {
    id: string;
    severity: 'error' | 'warning' | 'info';
    category: string;
    pageId: string;
    pageNumber: string;
    componentId?: string;
    bmk?: string;
    message: string;
    recommendation: string;
}
/** Shared, read-only inspection; the dialog adds presentation and navigation. */
export function collectPlausibilityMessages(project: Project, index = new ProjectIndex(project), nets = new ElectricalNetService(index)): PlausibilityMessage[] {
    const messages: PlausibilityMessage[] = [];
    for (const entry of index.components) {
        const { component: comp, page, symbol: sym } = entry;
        if (sym && (isConnectionSymbol(sym) || sym.category === 'structure'))
            continue;
        const base = { pageId: page.id, pageNumber: page.pageNumber, componentId: comp.id, bmk: entry.tag };
        if (!comp.articleNumber?.trim())
            messages.push({ ...base, id: JSON.stringify(['missing_article', page.id, comp.id]), severity: 'info', category: 'Stammdaten', message: t('plausMsgMissingArticle'), recommendation: t('plausRecMissingArticle') });
        if (sym?.pins.length) {
            const connected = new Set(index.pinsFor(entry).filter(pin=>nets.hasConnection(pin)).map(pin=>pin.id));
            if (!sym.pins.some(pin => connected.has(pin.id)))
                messages.push({ ...base, id: JSON.stringify(['unwired', page.id, comp.id]), severity: 'warning', category: 'Verdrahtung', message: t('plausMsgUnwired', { count: sym.pins.length }), recommendation: t('plausRecUnwired') });
        }
    }
    for (const issue of index.identityIssues) {
        const entry = index.components.find(e => e.page.id === issue.pageId && e.component.id === issue.componentId);
        if (issue.code === 'duplicate_page_id' || issue.code === 'duplicate_component_id') {
            const page = index.pagesById.get(issue.pageId)?.[0];
            messages.push({ id: issue.id, severity: 'error', category: 'Identität', pageId: issue.pageId, pageNumber: page?.pageNumber ?? '', componentId: issue.componentId, message: t(issue.code === 'duplicate_page_id' ? 'plausMsgDuplicatePageId' : 'plausMsgDuplicateComponentId', { id: issue.key }), recommendation: t('plausRecDuplicateIdentity') });
            continue;
        }
        if (!entry)
            continue;
        if (issue.code === 'missing_device_tag') {
            messages.push({ id: issue.id, severity: 'warning', category: 'Betriebsmittel', pageId: entry.page.id, pageNumber: entry.page.pageNumber, componentId: entry.component.id, message: t('plausMsgMissingBmk'), recommendation: t('plausRecMissingBmk') });
            continue;
        }
        messages.push({ id: issue.id, severity: 'error', category: 'Betriebsmittel', pageId: entry.page.id, pageNumber: entry.page.pageNumber, componentId: entry.component.id, bmk: entry.tag, message: t('plausMsgDuplicateBmk', { bmk: entry.tag }), recommendation: t('plausRecDuplicateBmk', { bmk: entry.tag }) });
    }
    for(const issue of nets.issues){
        const page=index.pagesById.get(issue.pageId)?.[0];
        const comp=issue.componentId?index.component(issue.componentId):undefined;
        const key=issue.code==='invalid_endpoint'?'plausMsgInvalidEndpoint':issue.code==='invalid_internal_group'?'plausMsgInvalidInternalGroup':'plausMsgNeutralPeConnection';
        messages.push({id:issue.id,severity:issue.code==='neutral_pe_connection'?'warning':'error',category:'Verdrahtung',
            pageId:issue.pageId,pageNumber:page?.pageNumber??'',componentId:issue.componentId,bmk:comp?.tag,
            message:t(key,{id:issue.wireId??issue.componentId??''}),recommendation:t('plausRecElectricalTopology')});
    }
    return messages;
}
