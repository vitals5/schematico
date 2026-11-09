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

import type { SymbolDefinition } from '../model/types';
export const SYMBOLS_SCHEMA: 'schematico-symbols';
export const MAX_SYMBOLS_BYTES: number;
export const MAX_SYMBOL_SUBMISSION_BYTES: number;
export interface SharedSymbolsData {
  schema: 'schematico-symbols';
  version: 1;
  symbols: SymbolDefinition[];
}
export function validatePublicSymbol(raw: unknown): SymbolDefinition;
export function parseSharedSymbols(value: unknown): SharedSymbolsData;
export function appendPublicSymbol(
  current: unknown,
  raw: unknown,
): { symbolsData: SharedSymbolsData; symbol: SymbolDefinition; changed: boolean };
export function removeSharedSymbol(
  current: unknown,
  symbolId: string,
): { symbolsData: SharedSymbolsData; removed: SymbolDefinition; changed: boolean };
