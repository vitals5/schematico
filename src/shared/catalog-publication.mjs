import { validateCatalogArticle, catalogKey } from './catalog-record.mjs';
export const CATALOG_SCHEMA = 'schematico-articles';
export const MAX_CATALOG_BYTES = 20 * 1024 * 1024;
export const MAX_SUBMISSION_BYTES = 32 * 1024;
/** Public submissions are new, unverified data; they never grant authority to
 * overwrite an existing record or alter deployment configuration. */
export function validatePublicArticle(raw) {
  const article = validateCatalogArticle({
    ...raw,
    origin: 'user',
    verification: 'unverified',
  });
  if (
    [article.articleNumber, article.manufacturer, article.variant].some(
      (value) => /[\u0000-\u001f\u007f]/.test(value),
    )
  )
    throw new Error('githubCatalogInvalid');
  if (
    !article.manufacturer ||
    article.manufacturer.length > 160 ||
    article.articleNumber.length > 160 ||
    article.variant.length > 160 ||
    article.description.length > 8000 ||
    (article.functions?.length ?? 0) > 64 ||
    article.functions?.some(
      (f) =>
        f.id.length > 160 ||
        f.type.length > 160 ||
        f.pins.length > 64 ||
        f.pins.some((p) => p.length > 160),
    ) ||
    new TextEncoder().encode(JSON.stringify(article)).length >
      MAX_SUBMISSION_BYTES
  )
    throw new Error('githubCatalogInvalid');
  return article;
}
export function parseSharedCatalog(value) {
  if (
    !value ||
    value.schema !== CATALOG_SCHEMA ||
    value.version !== 1 ||
    !Array.isArray(value.articles) ||
    value.articles.length > 50000
  )
    throw new Error('githubCatalogInvalid');
  const articles = value.articles.map((a) =>
    validateCatalogArticle({ ...a, verification: 'unverified' }),
  );
  if (new Set(articles.map(catalogKey)).size !== articles.length)
    throw new Error('articlesCatalogDuplicate');
  let submission;
  if (value.submission?.url) {
    const url = new URL(value.submission.url);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.hash ||
      typeof value.submission.siteKey !== 'string' ||
      !value.submission.siteKey.trim()
    )
      throw new Error('githubCatalogInvalid');
    submission = {
      url: url.toString(),
      siteKey: value.submission.siteKey.trim(),
    };
  }
  return {
    schema: CATALOG_SCHEMA,
    version: 1,
    articles,
    ...(submission ? { submission } : {}),
  };
}
export function appendPublicArticle(current, raw) {
  const catalog = parseSharedCatalog(current),
    article = validatePublicArticle(raw),
    key = catalogKey(article),
    old = catalog.articles.find((a) => catalogKey(a) === key);
  if (old) {
    const semantic = (a) =>
      JSON.stringify({
        articleNumber: a.articleNumber,
        manufacturer: a.manufacturer,
        variant: a.variant,
        description: a.description,
        functions: a.functions ?? [],
        symbolId: a.symbolId ?? '',
      });
    if (semantic(old) !== semantic(article))
      throw new Error('githubCatalogConflict');
    return { catalog, article, changed: false };
  }
  if (catalog.articles.length >= 50000)
    throw new Error('githubCatalogCapacity');
  catalog.articles.push(article);
  catalog.articles.sort((a, b) =>
    catalogKey(a).localeCompare(catalogKey(b), 'en'),
  );
  if (
    new TextEncoder().encode(JSON.stringify(catalog)).length > MAX_CATALOG_BYTES
  )
    throw new Error('githubCatalogCapacity');
  return { catalog, article, changed: true };
}
