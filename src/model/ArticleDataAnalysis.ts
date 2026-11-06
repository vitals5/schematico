import type { IndexedComponent, ProjectIndex } from './ProjectIndex';
import { isConnectionSymbol } from './ConnectionSymbols';
import {activeImportedArticles} from './ImportedArticles';
export const ARTICLE_DATA_STATES = ['assigned', 'inherited', 'not_applicable', 'import_not_read', 'source_record_empty', 'imported_unassigned', 'import_unknown', 'unassigned'] as const;
export type ArticleDataState = typeof ARTICLE_DATA_STATES[number];
export interface ArticleDataContext {
    state: ArticleDataState;
    articleNumbers?: string[];
    role: 'main' | 'contact' | 'terminal' | 'connection' | 'structure' | 'annotation' | 'native_part' | 'component' | 'unknown';
    symbolId: string;
    plant: string;
    location: string;
    designationKey?: string;
    source?: string;
    readStatus?: string;
    observedArticleNumber?: string;
    articleNumber?: string;
    manufacturer?: string;
    inheritedFromComponentId?: string;
    sourceObjectType?: number;
}
/** Classify evidence; never infer that missing destination fields prove an empty source database. */
export function articleDataContext(entry: IndexedComponent, index: ProjectIndex): ArticleDataContext {
    const { component: c, symbol: s } = entry, policy = c.articleRequirement ?? s?.articleRequirement;
    const role: ArticleDataContext['role'] = !s ? 'unknown' : s.annotationKind ? 'annotation' : isConnectionSymbol(s) ? 'connection' : s.category === 'structure' ? 'structure' : s.isMaster ? 'main' : s.isContact ? 'contact' : s.category === 'terminals' ? 'terminal' : entry.nativeRepresentation ? 'native_part' : 'component';
    const base = { role, symbolId: c.symbolId, plant: entry.structure.plant, location: entry.structure.location, designationKey: entry.deviceKey,
        source: c.articleImport?.source, readStatus: c.articleImport?.status, observedArticleNumber: c.articleImport?.observedArticleNumber,
        sourceObjectType: c.source?.objectType };
    const references=activeImportedArticles(c);
    if(references)return {...base,state:'assigned',articleNumber:c.articleNumber,articleNumbers:references.map(r=>r.articleNumber),manufacturer:c.manufacturer};
    if (c.articleNumber?.trim())
        return { ...base, state: 'assigned', articleNumber: c.articleNumber.trim(), manufacturer: c.manufacturer?.trim() };
    const masters = s?.isContact ? index.referencesFor(c).filter(e => e.symbol?.isMaster) : [];
    if (masters.length === 1 && masters[0].component.articleNumber?.trim())
        return { ...base, state: 'inherited', articleNumber: masters[0].component.articleNumber!.trim(), manufacturer: masters[0].component.manufacturer, inheritedFromComponentId: masters[0].component.id };
    if (policy === 'none' || policy === 'optional' || policy !== 'required' && ['connection', 'structure', 'annotation'].includes(role))
        return { ...base, state: 'not_applicable' };
    if (c.articleImport?.status === 'not_read')
        return { ...base, state: 'import_not_read' };
    if (c.articleImport?.status === 'record_read')
        return { ...base, state: c.articleImport.observedArticleNumber?.trim() ? 'imported_unassigned' : 'source_record_empty' };
    if (entry.nativeRepresentation || c.importedSymbol)
        return { ...base, state: 'import_unknown' };
    return { ...base, state: 'unassigned' };
}
