import { validateCatalogArticle } from './CatalogRecord';
import type { AssignedArticle } from './ArticleTypes';
import type { PlacedComponent, Project } from './types';
import { activeImportedArticles } from './ImportedArticles';
export const clean = (v: string | undefined) => v?.trim() ?? '';
export function validateAssignments(
  items: AssignedArticle[],
): AssignedArticle[] {
  if (!Array.isArray(items) || items.length > 200)
    throw new Error('articlesInvalid');
  let mains = 0;
  return items.map((a) => {
    if (
      !a ||
      typeof a.articleNumber !== 'string' ||
      !a.articleNumber.trim() ||
      typeof a.manufacturer !== 'string' ||
      typeof a.variant !== 'string' ||
      !['main', 'accessory'].includes(a.role) ||
      (a.quantity !== undefined &&
        (!Number.isFinite(a.quantity) || a.quantity < 0)) ||
      (a.role === 'main' && ++mains > 1)
    )
      throw new Error('articlesInvalid');
    const result = structuredClone(a);
    if (result.snapshot)
      result.snapshot = validateCatalogArticle(result.snapshot);
    result.articleNumber = a.articleNumber.trim();
    result.manufacturer = a.manufacturer.trim();
    result.variant = a.variant.trim();
    if (
      result.snapshot &&
      (result.snapshot.articleNumber !== result.articleNumber ||
        result.snapshot.manufacturer !== result.manufacturer ||
        result.snapshot.variant !== result.variant)
    )
      delete result.snapshot;
    return result;
  });
}
export function primaryArticle(items: AssignedArticle[]) {
  return items.find((a) => a.role === 'main') ?? items[0];
}
/** Explicit manual emptiness disables source accessories. Legacy scalar edits
 * override the complete manual list rather than reviving obsolete accessories. */
export function effectiveArticles(
  c: PlacedComponent,
  p?: Project,
): AssignedArticle[] {
  if (c.articleAssignment) {
    if (c.articleAssignment.mode !== 'manual') return [];
    let items: AssignedArticle[];
    try {
      items = validateAssignments(c.articleAssignment.items);
    } catch {
      return [];
    }
    const primary = primaryArticle(items);
    if (
      clean(c.articleNumber) === clean(primary?.articleNumber) &&
      clean(c.manufacturer) === clean(primary?.manufacturer)
    )
      return structuredClone(items);
    return clean(c.articleNumber)
      ? [
          {
            articleNumber: clean(c.articleNumber),
            manufacturer: clean(c.manufacturer),
            variant: '',
            quantity: 1,
            role: 'main',
          },
        ]
      : [];
  }
  const refs = activeImportedArticles(c);
  if (refs)
    return refs.map((r, i) => ({
      articleNumber: r.articleNumber,
      manufacturer:
        r.articleNumber === c.articleNumber
          ? c.manufacturer || r.manufacturer || ''
          : (r.manufacturer ?? ''),
      variant: r.variant,
      quantity: r.quantity,
      role:
        refs.length === 1 ||
        (r.position === 1 && refs.filter((a) => a.position === 1).length === 1)
          ? 'main'
          : 'accessory',
      snapshot: {
        id: r.masterDataId ?? 'source-' + r.sourceId,
        articleNumber: r.articleNumber,
        manufacturer: r.manufacturer ?? '',
        variant: r.variant,
        description:
          p?.importedArticleLibrary?.find((m) => m.id === r.masterDataId)
            ?.description ?? '',
        origin: 'project_import',
        verification: 'unverified',
      },
    }));
  return clean(c.articleNumber)
    ? [
        {
          articleNumber: clean(c.articleNumber),
          manufacturer: clean(c.manufacturer),
          variant: '',
          quantity: 1,
          role: 'main',
        },
      ]
    : [];
}
export function setArticleAssignment(
  c: PlacedComponent,
  items: AssignedArticle[],
) {
  const valid = validateAssignments(items);
  c.articleAssignment = { mode: 'manual', items: valid };
  const primary = primaryArticle(valid);
  c.articleNumber = primary?.articleNumber ?? '';
  c.manufacturer = primary?.manufacturer ?? '';
}
export function articleSignature(c: PlacedComponent, p: Project) {
  return JSON.stringify(
    effectiveArticles(c, p)
      .map((a) => [
        a.articleNumber,
        a.manufacturer,
        a.variant,
        a.quantity ?? null,
      ])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
}

export function invalidArticleAssignment(c: PlacedComponent) {
  if (!c.articleAssignment) return false;
  try {
    if (c.articleAssignment.mode !== 'manual') return true;
    validateAssignments(c.articleAssignment.items);
    return false;
  } catch {
    return true;
  }
}
