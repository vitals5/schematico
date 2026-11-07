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
): { catalog: SharedCatalogData; article: CatalogArticle; changed: boolean };
