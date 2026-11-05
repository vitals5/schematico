import type { Project } from './types';
import { ProjectIndex, interruptionTag, type IndexedComponent } from './ProjectIndex';
import { ElectricalNetService, portIdentity } from './ElectricalNetService';
import { isConnectionSymbol, isInterruptionSymbol } from './ConnectionSymbols';
import { referenceTargets } from './CrossReferenceNavigation';
import { componentInsertionPoint, rotatedLocalPoint } from './SymbolGeometry';
import { t } from '../i18n';
import {articleDataContext,ARTICLE_DATA_STATES,type ArticleDataContext} from './ArticleDataAnalysis';
export const ELECTRICAL_RULES = ['missing_article', 'unwired', 'required_pin_open', 'reserve_pin_connected', 'missing_device_tag', 'duplicate_page_id', 'duplicate_component_id', 'duplicate_master', 'duplicate_device_tag', 'duplicate_terminal', 'invalid_endpoint', 'invalid_internal_group', 'neutral_pe_connection', 'potential_conflict', 'unresolved_reference', 'missing_reference_target', 'missing_master_reference'] as const;
export type ElectricalRule = typeof ELECTRICAL_RULES[number];
export interface InspectionLocation {
    pageId: string;
    pageNumber: string;
    componentId?: string;
    pinId?: string;
    wireId?: string;
    netId?: string;
    x: number;
    y: number;
}
export interface InspectionFinding {
    articleData?: ArticleDataContext;
    id: string;
    ruleId: ElectricalRule;
    domain: 'electrical';
    severity: 'error' | 'warning' | 'info';
    category: string;
    pageId: string;
    pageNumber: string;
    componentId?: string;
    bmk?: string;
    message: string;
    recommendation: string;
    cause: {
        code: string;
        details: Record<string, unknown>;
    };
    location: InspectionLocation;
    relatedLocations: InspectionLocation[];
}
export interface ElectricalInspectionReport {
    articleDataSummary: Record<string,number>;
    schemaVersion: 1;
    domain: 'electrical';
    status: 'errors' | 'warnings' | 'infos' | 'no_findings';
    projectId: string;
    projectName: string;
    summary: {
        errors: number;
        warnings: number;
        infos: number;
    };
    coverage: {
        placements: number;
        unknownInternalConnections: number;
        unknownPinRoles: number;
        switchStatesSimulated: false;
        standardsCertified: false;
    };
    rules: readonly ElectricalRule[];
    messages: InspectionFinding[];
}
export function inspectionLocation(index: ProjectIndex, entry?: IndexedComponent, pinId?: string, wireId?: string): InspectionLocation {
    const page = entry?.page ?? index.project.pages[0], def = entry?.symbol?.pins.find(p => p.id === pinId);
    const local = entry?.symbol && def ? rotatedLocalPoint(def, entry.symbol, entry.component.rotation) : undefined;
    const point = entry ? local ? { x: entry.component.x + local.x, y: entry.component.y + local.y } : entry.symbol ? componentInsertionPoint(entry.component, entry.symbol) : { x: entry.component.x, y: entry.component.y } : { x: (page?.plotFrame.width ?? 0) / 2, y: (page?.plotFrame.height ?? 0) / 2 };
    return { pageId: page?.id ?? '', pageNumber: page?.pageNumber ?? '', componentId: entry?.component.id, pinId, wireId, ...point };
}
/** Read-only rule service. Stable identity/cause data is separate from localized text and geometry. */
export function inspectElectricalProject(project: Project, index = new ProjectIndex(project), nets = new ElectricalNetService(index)): ElectricalInspectionReport {
    const messages: InspectionFinding[] = [];
    const articles=new Map(index.components.map(entry=>[entry,articleDataContext(entry,index)]));
    const articleDataSummary=Object.fromEntries(ARTICLE_DATA_STATES.map(state=>[state,0]));
    for(const context of articles.values())articleDataSummary[context.state]++;
    const add = (ruleId: ElectricalRule, key: unknown, severity: InspectionFinding['severity'], location: InspectionLocation, message: string, recommendation: string, details: Record<string, unknown> = {}, relatedLocations: InspectionLocation[] = []) => {
        const entry = location.componentId ? index.component(location.componentId, location.pageId) : undefined;
        messages.push({ id: JSON.stringify([ruleId, key]), ruleId, domain: 'electrical', severity, category: ruleId.includes('article') ? 'Stammdaten' : ruleId.includes('reference') ? 'Verweise' : ruleId.includes('device') || ruleId.includes('duplicate') ? 'Identität' : 'Verdrahtung', pageId: location.pageId, pageNumber: location.pageNumber, componentId: location.componentId, bmk: entry?.tag, articleData:entry?articles.get(entry):undefined, message, recommendation, cause: { code: ruleId, details }, location, relatedLocations });
    };
    for (const entry of index.components) {
        const { component: comp, symbol } = entry, exempt = !!symbol && (isConnectionSymbol(symbol) || symbol.category === 'structure' || !!symbol.annotationKind);
        const requirement = comp.articleRequirement ?? symbol?.articleRequirement;
        const masters = index.referencesFor(comp).filter(e => e.symbol?.isMaster);
        const inheritedArticle = !!symbol?.isContact && masters.length === 1 && !!masters[0].component.articleNumber?.trim();
        if ((!exempt || requirement === 'required') && !comp.articleNumber?.trim() && !inheritedArticle && requirement !== 'optional' && requirement !== 'none')
            add('missing_article', comp.id, requirement === 'required' ? 'warning' : 'info', inspectionLocation(index, entry), t(articles.get(entry)?.state==='import_not_read'?'plausMsgArticleNotRead':'plausMsgMissingArticle'), t(['import_not_read','import_unknown','imported_unassigned'].includes(articles.get(entry)!.state)?'plausRecArticleImport':'plausRecMissingArticle'), { requirement: requirement ?? 'legacy',articleState:articles.get(entry)!.state });
        const pins = index.pinsFor(entry), explicit = pins.filter(p => (comp.pins[p.id]?.connectionRequirement ?? p.definition?.connectionRequirement) !== undefined);
        for (const pin of explicit) {
            const policy = comp.pins[pin.id]?.connectionRequirement ?? pin.definition?.connectionRequirement, connected = nets.hasConnection(pin);
            if (policy === 'required' && !connected)
                add('required_pin_open', portIdentity(pin), 'warning', inspectionLocation(index, entry, pin.id), t('plausMsgRequiredPin', { pin: pin.label }), t('plausRecRequiredPin'), { pinId: pin.id, requirement: policy });
            if (policy === 'reserve' && connected)
                add('reserve_pin_connected', portIdentity(pin), 'warning', inspectionLocation(index, entry, pin.id), t('plausMsgReservePin', { pin: pin.label }), t('plausRecReservePin'), { pinId: pin.id, requirement: policy });
        }
        if (!exempt && symbol?.pins.length && !explicit.length && !pins.some(p => nets.hasConductiveConnection(p)))
            add('unwired', comp.id, 'warning', inspectionLocation(index, entry), t('plausMsgUnwired', { count: symbol.pins.length }), t('plausRecUnwired'));
        const refPolicy = comp.referenceRequirement ?? symbol?.referenceRequirement, peers = index.referencesFor(comp).filter(e => e.component.id !== comp.id);
        if (refPolicy === 'required' && !peers.length)
            add('missing_reference_target', comp.id, 'warning', inspectionLocation(index, entry), t('plausMsgMissingReference'), t('plausRecReference'), { tag: entry.tag || interruptionTag(comp) });
        else if (symbol?.isContact && !entry.nativeRepresentation && entry.tag && refPolicy !== 'optional' && !masters.length)
            add('missing_master_reference', comp.id, 'warning', inspectionLocation(index, entry), t('plausMsgMissingMaster'), t('plausRecReference'), { tag: entry.tag });
        const tokens = [...(comp.crossRef ?? '').matchAll(/\/([^\s,|/:]+)\.(\d+)/g)];
        if (tokens.length) {
            const targets = referenceTargets(project, comp, index);
            for (const token of tokens) {
                const target = targets.find(t => t.start === token.index), requiresDevice = !!symbol && (!!symbol.isContact || !!symbol.isMaster || isInterruptionSymbol(symbol));
                if (!target || (requiresDevice && !entry.nativeRepresentation && !target.componentId))
                    add('unresolved_reference', [comp.id, token[0]], 'warning', inspectionLocation(index, entry), t('plausMsgUnresolvedReference', { reference: token[0] }), t('plausRecReference'), { reference: token[0], reason: !target ? 'page_or_column_missing' : 'device_missing' });
            }
        }
    }
    for (const issue of index.identityIssues) {
        const entries = index.components.filter(e => issue.componentIds.includes(e.component.id));
        let location = inspectionLocation(index, entries.find(e => e.page.id === issue.pageId));
        if (issue.code === 'duplicate_page_id') {
            const page = index.pagesById.get(issue.pageId)?.[0];
            location = { ...location, pageId: issue.pageId, pageNumber: page?.pageNumber ?? '' };
        }
        const key = issue.code === 'missing_device_tag' ? 'plausMsgMissingBmk' : issue.code === 'duplicate_page_id' ? 'plausMsgDuplicatePageId' : issue.code === 'duplicate_component_id' ? 'plausMsgDuplicateComponentId' : 'plausMsgDuplicateBmk';
        add(issue.code, issue.key, issue.code === 'missing_device_tag' ? 'warning' : 'error', location, t(key, { id: issue.key, bmk: entries[0]?.tag ?? '' }), t(issue.code === 'missing_device_tag' ? 'plausRecMissingBmk' : issue.code === 'duplicate_page_id' || issue.code === 'duplicate_component_id' ? 'plausRecDuplicateIdentity' : 'plausRecDuplicateBmk'), { key: issue.key, componentIds: issue.componentIds }, entries.map(e => inspectionLocation(index, e)));
    }
    for (const issue of nets.issues) {
        const wire = issue.wireId ? index.connections.find(c => c.wire.id === issue.wireId && (!c.page || c.page.id === issue.pageId)) : undefined;
        const endpoints = wire ? [wire.wire.from, wire.wire.to] : [];
        const locations = endpoints.map(ep => { const entry = index.component(ep.componentId, wire?.page?.id); return entry ? inspectionLocation(index, entry, ep.pinId, issue.wireId) : undefined; }).filter((v): v is InspectionLocation => !!v);
        const entry = issue.componentId ? index.component(issue.componentId, issue.pageId) : undefined, page = index.pagesById.get(issue.pageId)?.[0];
        let location = locations.find(l => { const e = index.component(l.componentId!, l.pageId); return e?.symbol && !e.symbol.unresolved && !e.symbol.pins.some(p => p.id === l.pinId); }) ?? locations[0] ?? inspectionLocation(index, entry);
        location = { ...location, pageId: locations.length ? location.pageId : issue.pageId, pageNumber: locations.length ? location.pageNumber : page?.pageNumber ?? '', wireId: issue.wireId, netId: issue.netId };
        const key = issue.code === 'invalid_endpoint' ? 'plausMsgInvalidEndpoint' : issue.code === 'invalid_internal_group' ? 'plausMsgInvalidInternalGroup' : 'plausMsgNeutralPeConnection';
        const stableCause = issue.code === 'invalid_endpoint' ? [issue.wireId, endpoints.map(ep => [ep.componentId, ep.pinId]).sort()] : issue.code === 'invalid_internal_group' ? [issue.componentId, [...(issue.pinIds ?? [])].sort()] : issue.netId;
        add(issue.code, stableCause, issue.code === 'neutral_pe_connection' ? 'warning' : 'error', location, t(key, { id: issue.wireId ?? issue.componentId ?? '' }), t(issue.code === 'neutral_pe_connection' ? 'plausRecNeutralPe' : 'plausRecTopology'), { wireId: issue.wireId, pinIds: issue.pinIds, netId: issue.netId, endpoints }, locations);
    }
    for (const net of nets.nets) {
        const constrained = net.ports.map(pin => ({ pin, value: (pin.owner.component.pins[pin.id]?.potentialConstraint ?? pin.definition?.potentialConstraint ?? '').trim() })).filter(p => p.value), names = [...new Set(constrained.map(p => p.value))].sort();
        if (names.length > 1) {
            const locations = constrained.map(({ pin }) => ({ ...inspectionLocation(index, pin.owner, pin.id), netId: net.id }));
            add('potential_conflict', constrained.map(p => [portIdentity(p.pin), p.value]).sort(), 'error', locations[0], t('plausMsgPotentialConflict', { names: names.join(', ') }), t('plausRecPotentialConflict'), { netId: net.id, constraints: names }, locations);
        }
    }
    const unique = [...new Map(messages.map(m => [m.id, m])).values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const summary = { errors: unique.filter(m => m.severity === 'error').length, warnings: unique.filter(m => m.severity === 'warning').length, infos: unique.filter(m => m.severity === 'info').length };
    return { schemaVersion: 1, domain: 'electrical', projectId: project.id, projectName: project.name, status: summary.errors ? 'errors' : summary.warnings ? 'warnings' : summary.infos ? 'infos' : 'no_findings', summary, coverage: { placements: index.components.length, unknownInternalConnections: index.components.filter(e => index.pinsFor(e).length && nets.knowledge.get(e) === 'unknown').length, unknownPinRoles: index.components.flatMap(e => index.pinsFor(e)).filter(p => p.role === 'unknown').length, switchStatesSimulated: false, standardsCertified: false }, articleDataSummary,rules: ELECTRICAL_RULES, messages: unique };
}
