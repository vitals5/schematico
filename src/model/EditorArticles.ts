import {MacroManager, type WindowMacro} from './MacroManager';
import type {ArticlePackageAssets} from './ArticlePackageAssets';
import type { CatalogArticle } from './ArticleTypes';
import { ArticleCatalog, catalogKey, onLocalCatalogChange, availableCatalogArticles } from './ArticleCatalog';
import { onSharedCatalogChange, refreshSharedCatalog, sharedCatalogState } from './GitHubCatalog';
import { MANUFACTURER_PARTS } from './PartCatalogue';
import { effectiveArticles, setArticleAssignment } from './ArticleAssignments';
import type { PlacedComponent, Project } from './types';

export type EditorArticle = { article: CatalogArticle; name: string; technicalData: string; symbolId?: string; widthModules?: string; packageMacros?:WindowMacro[]; packageDiagnostics?:string[] };
/** Exact keys, including variant. Local edits override public data; no fuzzy part matching. */
export function mergeEditorArticles(shared: CatalogArticle[], local: CatalogArticle[]): EditorArticle[] {
  return availableCatalogArticles(shared, local).map(article => {
    const seed = MANUFACTURER_PARTS.find(p => catalogKey({manufacturer:p.manufacturer,articleNumber:p.articleNumber,variant:''}) === catalogKey(article));
    return { article: structuredClone(article), name: seed?.name ?? (article.description || article.articleNumber),
      technicalData: seed?.technicalData ?? '', symbolId: article.symbolId, widthModules: seed?.widthModules };
  });
}
let local: CatalogArticle[] = [];
let packages:ArticlePackageAssets[]=[];
const listeners = new Set<() => void>();
export function editorArticles() { return mergeEditorArticles(sharedCatalogState().articles, local).map(entry=>{const p=packages.find(p=>p.id===entry.article.id);return {...entry,packageMacros:p?.macros,packageDiagnostics:p?.diagnostics};}); }
export function onEditorArticlesChange(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
const notify = () => { for (const listener of listeners) listener(); };
let loading: Promise<void> | undefined;
let reloadRequested = false;
export async function loadLocalEditorArticles(): Promise<void> {
  if (loading) { reloadRequested = true; return loading; }
  loading = (async () => {
    do {
      reloadRequested = false;
      try { const store=new ArticleCatalog();[local,packages]=await Promise.all([store.list(),store.packageAssets()]);packages=packages.filter(p=>local.some(a=>a.id===p.id));MacroManager.setArticlePackageMacros([...new Map(packages.flatMap(p=>p.macros).map(m=>[m.id,m])).values()]); } catch { /* Public and starter data remain available without IndexedDB. */ }
      notify();
    } while (reloadRequested);
  })();
  try { await loading; } finally { loading = undefined; }
}
onLocalCatalogChange(() => { void loadLocalEditorArticles(); });
onSharedCatalogChange(notify);
export async function refreshEditorArticles() { await Promise.all([loadLocalEditorArticles(), refreshSharedCatalog()]); }

/** Keep accessories, variants and a portable snapshot, without changing pins, wires or symbol. */
export function assignMainCatalogArticle(component: PlacedComponent, article: CatalogArticle, project?: Project) {
  const previous = effectiveArticles(component, project);
  const main = previous.find(a => a.role === 'main');
  const accessories = previous.filter(a => a.role === 'accessory');
  setArticleAssignment(component, [{ articleNumber:article.articleNumber, manufacturer:article.manufacturer,
    variant:article.variant, quantity:main ? main.quantity : 1, role:'main', snapshot:structuredClone(article) }, ...accessories]);
}
