import {MacroManager, type WindowMacro} from './MacroManager';
import type {ArticlePackageAssets} from './ArticlePackageAssets';
import type { CatalogArticle } from './ArticleTypes';
import { ArticleCatalog, catalogKey, onLocalCatalogChange, availableCatalogArticles } from './ArticleCatalog';
import { onSharedCatalogChange, refreshSharedCatalog, sharedCatalogState } from './GitHubCatalog';
import { effectiveArticles, setArticleAssignment } from './ArticleAssignments';
import type { PlacedComponent, Project, SymbolDefinition } from './types';

export type EditorArticle = { article: CatalogArticle; name: string; technicalData: string; symbolId?: string; widthModules?: string; packageMacros?:WindowMacro[]; packageDiagnostics?:string[]; packageSymbol?:SymbolDefinition };
/** Exact keys, including variant. Local edits override public data; no fuzzy part matching. */
export function mergeEditorArticles(shared: CatalogArticle[], local: CatalogArticle[], deletedIds: Set<string> = new Set()): EditorArticle[] {
  return availableCatalogArticles(shared, local, deletedIds).map(article => {
    const parts = (article.description || '').split(' · ');
    const name = parts[0] || article.articleNumber;
    const technicalData = parts[1] || '';
    return { article: structuredClone(article), name, technicalData, symbolId: article.symbolId, widthModules: undefined };
  });
}
let local: CatalogArticle[] = [];
let packages:ArticlePackageAssets[]=[];
let deleted: Set<string> = new Set();
const listeners = new Set<() => void>();
export function editorArticles() {
  return mergeEditorArticles(sharedCatalogState().articles, local, deleted).map(entry=>{
    const p=packages.find(p=>p.id===entry.article.id);
    const customSym = entry.article.symbol;
    return {...entry,packageMacros:p?.macros,packageDiagnostics:p?.diagnostics,packageSymbol:p?.macros.flatMap(m=>m.symbolLibrary??[]).find(s=>s.id===entry.symbolId) ?? customSym};
  });
}
export function onEditorArticlesChange(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
const notify = () => { for (const listener of listeners) listener(); };
let loading: Promise<void> | undefined;
let reloadRequested = false;
export async function loadLocalEditorArticles(): Promise<void> {
  if (loading) { reloadRequested = true; return loading; }
  loading = (async () => {
    do {
      reloadRequested = false;
      try {
        const store=new ArticleCatalog();
        const [loadedLocal, loadedPackages, loadedDeleted] = await Promise.all([store.list(), store.packageAssets(), store.deletedIds()]);
        local = loadedLocal;
        deleted = new Set(loadedDeleted);
        packages=loadedPackages.filter(p=>local.some(a=>a.id===p.id));
        MacroManager.setArticlePackageMacros([...new Map(packages.flatMap(p=>p.macros).map(m=>[m.id,m])).values()]);
      } catch { /* Public and starter data remain available without IndexedDB. */ }
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
