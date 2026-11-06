import type { McpToolDefinition } from './definitions';
import type { CanvasStateManager } from './handlers';
export const GET_IMPORTED_ARTICLES_TOOL: McpToolDefinition = { name: 'get_imported_articles', description: 'Read-only imported project article evidence, not a manufacturer portal or verified physical BOM. Page through master records or original source references, including unplaced targets. Filter by componentId or search; unplacedOnly is available for references. Source evidence remains available after manual replacements.', inputSchema: { type: 'object', properties: { view: { type: 'string', enum: ['masters', 'references'] }, componentId: { type: 'string' }, unplacedOnly: { type: 'boolean' }, search: { type: 'string' }, offset: { type: 'number' }, limit: { type: 'number' } } } };
export async function handleGetImportedArticles(args: any, manager: CanvasStateManager) {
    const p = manager.getProject(), view = args.view ?? 'references', offset = args.offset ?? 0, limit = args.limit ?? 50;
    if (!['masters', 'references'].includes(view) || !Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200)
        throw new Error('Ungültiger Artikelbereich.');
    if (args.unplacedOnly !== undefined && typeof args.unplacedOnly !== 'boolean' || args.search !== undefined && typeof args.search !== 'string')
        throw new Error('Ungültiger Filter.');
    const components = p.pages.flatMap(page => page.components), selected = args.componentId === undefined ? undefined : components.find(c => c.id === args.componentId);
    if (args.componentId !== undefined && !selected)
        throw new Error('Bauteil nicht gefunden.');
    const owners = new Map<number, string[]>();
    for (const c of components)
        for (const ref of c.articleReferences ?? [])
            owners.set(ref.sourceId, [...(owners.get(ref.sourceId) ?? []), c.id]);
    const refs = p.sourceArticleReferences ?? [], masters = p.importedArticleLibrary ?? [], ids = new Set(selected?.articleReferences?.map(r => r.sourceId));
    const filteredRefs = refs.filter(r => (!selected || ids.has(r.sourceId)) && (!args.unplacedOnly || !owners.has(r.sourceId)));
    const masterIds = new Set(filteredRefs.map(r => r.masterDataId));
    const search = (args.search ?? '').toLocaleLowerCase();
    const rows = view === 'masters' ? masters.filter(m => (!selected && !args.unplacedOnly || masterIds.has(m.id)) && [m.articleNumber, m.variant, m.manufacturer, m.description].join(' ').toLocaleLowerCase().includes(search))
        : filteredRefs.filter(r => [r.articleNumber, r.variant, r.manufacturer].join(' ').toLocaleLowerCase().includes(search)).map(r => ({ ...r, placedComponentIds: owners.get(r.sourceId) ?? [] }));
    return { success: true, readOnly: true, sourceEvidence: true, diagnostics: p.articleImportDiagnostics??[], counts: { masters: masters.length, references: refs.length, unplacedReferences: refs.filter(r => !owners.has(r.sourceId)).length }, view, total: rows.length, offset, items: rows.slice(offset, offset + limit) };
}
