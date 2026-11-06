import type { PlacedComponent } from './types';
/** Source references stay as evidence after a manual replacement/clear. Only
 * unchanged source assignments are active; old accessories must not reappear. */
export function activeImportedArticles(component: PlacedComponent) {
    const references = component.articleReferences;
    if (!references?.length)
        return;
    const observed = component.articleImport?.observedArticleNumber;
    if (observed !== undefined && (component.articleNumber?.trim() ?? '') !== observed.trim())
        return;
    return references;
}
