import type { Project } from './types';
import type {
  CatalogArticle,
  ComponentAddress,
  AssignedArticle,
} from './ArticleTypes';
import { catalogKey, validateCatalogArticle } from './CatalogRecord';
import { effectiveArticles, setArticleAssignment } from './ArticleAssignments';
import { DeviceRegistry } from './DeviceRegistry';
import { projectRevision } from '../layout/types';

export interface ArticleUsageGroup {
  key: string;
  articleNumber: string;
  manufacturer: string;
  variant: string;
  uses: {
    address: ComponentAddress;
    bmk: string;
    pageNumber: string;
    position: number;
    article: AssignedArticle;
  }[];
  missingFunctions: number;
  unverified: number;
}
/** An exact catalogue key groups article uses, never physical devices. */
export function articleUsageGroups(project: Project): ArticleUsageGroup[] {
  const groups = new Map<string, ArticleUsageGroup>();
  for (const page of project.pages)
    for (const component of page.components) {
      effectiveArticles(component, project).forEach((article, position) => {
        const key = catalogKey(article);
        let group = groups.get(key);
        if (!group)
          groups.set(
            key,
            (group = {
              key,
              articleNumber: article.articleNumber,
              manufacturer: article.manufacturer,
              variant: article.variant,
              uses: [],
              missingFunctions: 0,
              unverified: 0,
            }),
          );
        group.uses.push({
          address: { pageId: page.id, componentId: component.id },
          bmk: component.bmk,
          pageNumber: page.pageNumber,
          position,
          article,
        });
        if (!article.snapshot?.functions?.length) group.missingFunctions++;
        if (article.snapshot?.verification !== 'user_checked')
          group.unverified++;
      });
    }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export class ArticleSnapshotPlan {
  readonly changes: {
    address: ComponentAddress;
    bmk: string;
    pageNumber: string;
    position: number;
    before: AssignedArticle;
    after: AssignedArticle;
  }[] = [];
  readonly #base: string;
  readonly #result: Project;
  readonly #replaces: boolean;
  constructor(project: Project, key: string, raw: CatalogArticle) {
    this.#base = projectRevision(project);
    const article = validateCatalogArticle(raw),
      group = articleUsageGroups(project).find((g) => g.key === key);
    if (!group || catalogKey(article) !== key)
      throw new Error('articleMaintenanceKey');
    const result = structuredClone(project),
      registry = new DeviceRegistry(result);
    let replaces = false;
    for (const use of group.uses) {
      const placement = registry.placement(use.address);
      if (
        !placement ||
        result.pages.filter((p) => p.id === use.address.pageId).length !== 1 ||
        result.pages
          .flatMap((p) => p.components)
          .filter((c) => c.id === use.address.componentId).length !== 1
      )
        throw new Error('articlesSelectionInvalid');
      const items = effectiveArticles(placement.component, result),
        before = items[use.position];
      if (!before || catalogKey(before) !== key)
        throw new Error('articlesProjectStale');
      if (JSON.stringify(before.snapshot) === JSON.stringify(article)) continue;
      const after = { ...before, snapshot: structuredClone(article) };
      replaces ||= !!before.snapshot;
      this.changes.push({
        ...use,
        before: structuredClone(before),
        after: structuredClone(after),
      });
      items[use.position] = after;
      setArticleAssignment(placement.component, items);
    }
    this.#result = result;
    this.#replaces = replaces;
  }
  get requiresConfirmation() {
    return this.#replaces;
  }
  apply(project: Project, confirmReplace = false) {
    if (projectRevision(project) !== this.#base)
      throw new Error('articlesProjectStale');
    if (this.#replaces && !confirmReplace)
      throw new Error('repairConfirmation');
    if (!this.changes.length) throw new Error('articleMaintenanceUnchanged');
    const result = structuredClone(this.#result);
    result.activePageId = project.activePageId;
    result.modified = new Date().toISOString();
    return result;
  }
}
