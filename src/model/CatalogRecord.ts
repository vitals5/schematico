import type { CatalogArticle } from './ArticleTypes';
export const catalogKey = (
  a: Pick<CatalogArticle, 'articleNumber' | 'manufacturer' | 'variant'>,
) =>
  JSON.stringify([
    a.manufacturer.trim(),
    a.articleNumber.trim(),
    a.variant.trim(),
  ]);
export function validateCatalogArticle(value: unknown): CatalogArticle {
  const a = value as CatalogArticle;
  if (
    !a ||
    ['articleNumber', 'manufacturer', 'variant', 'description'].some(
      (k) => typeof (a as any)[k] !== 'string' || (a as any)[k].length > 50000,
    ) ||
    !a.articleNumber.trim() ||
    !['user', 'project_import', 'starter'].includes(a.origin) ||
    !['unverified', 'user_checked'].includes(a.verification)
  )
    throw new Error('articlesCatalogInvalid');
  if (
    a.functions !== undefined &&
    (!Array.isArray(a.functions) ||
      a.functions.length > 500 ||
      new Set(a.functions.map((f) => f?.id)).size !== a.functions.length ||
      a.functions.some(
        (f) =>
          !f ||
          typeof f.id !== 'string' ||
          !f.id.trim() ||
          typeof f.type !== 'string' ||
          !f.type.trim() ||
          !Array.isArray(f.pins) ||
          !f.pins.length ||
          f.pins.length > 500 ||
          f.pins.some((n) => typeof n !== 'string' || !n.trim()) ||
          new Set(f.pins).size !== f.pins.length,
      ))
  )
    throw new Error('articlesCatalogInvalid');
  const result: CatalogArticle = {
    id: '',
    articleNumber: a.articleNumber.trim(),
    manufacturer: a.manufacturer.trim(),
    variant: a.variant.trim(),
    description: a.description,
    origin: a.origin,
    verification: a.verification,
    ...(a.functions
      ? {
          functions: a.functions.map((f) => ({
            id: f.id.trim(),
            type: f.type.trim(),
            pins: f.pins.map((n) => n.trim()),
          })),
        }
      : {}),
  };
  if (
    result.functions &&
    (new Set(result.functions.map((f) => f.id)).size !==
      result.functions.length ||
      result.functions.some((f) => new Set(f.pins).size !== f.pins.length))
  )
    throw new Error('articlesCatalogInvalid');
  result.id = catalogKey(result);
  return result;
}
