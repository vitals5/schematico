import type { CatalogArticle } from '../model/ArticleTypes';
export const CATALOG_SCHEMA: 'schematico-articles';
export const MAX_CATALOG_BYTES: number;
export const MAX_SUBMISSION_BYTES: number;
export interface SharedCatalogData {
  schema: 'schematico-articles';
  version: 1;
  articles: CatalogArticle[];
  submission?: { url: string; siteKey: string };
}
export function validatePublicArticle(raw: unknown): CatalogArticle;
export function parseSharedCatalog(value: unknown): SharedCatalogData;
export function appendPublicArticle(
  current: unknown,
  raw: unknown,
  options?: { allowSymbolUpdate?: boolean },
): { catalog: SharedCatalogData; article: CatalogArticle; changed: boolean };
export function removeSharedArticle(
  current: unknown,
  filter:
    | string
    | { manufacturer: string; articleNumber: string; variant?: string },
): { catalog: SharedCatalogData; removed: CatalogArticle; changed: boolean };
export function updateSharedArticleSymbol(
  current: unknown,
  filter:
    | string
    | { manufacturer: string; articleNumber: string; variant?: string },
  symbolId?: string,
): { catalog: SharedCatalogData; article: CatalogArticle; changed: boolean };
