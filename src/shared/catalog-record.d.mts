import type {CatalogArticle} from '../model/ArticleTypes';
export function catalogKey(a:Pick<CatalogArticle,'manufacturer'|'articleNumber'|'variant'>):string;
export function validateCatalogArticle(a:unknown):CatalogArticle;
