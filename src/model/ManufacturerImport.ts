import { DOMParser } from '@xmldom/xmldom';
import { validateCatalogArticle } from './CatalogRecord';
import type { CatalogArticle } from './ArticleTypes';
/** BMEcat fields are evidence. Coded features never imply device functions. */
export function manufacturerArticles(xml: string) {
  if (xml.length > 20 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error('manufacturerInvalid');
  let failed = false;
  const doc = new DOMParser({
    errorHandler: {
      warning: () => {
        failed = true;
      },
      error: () => {
        failed = true;
      },
      fatalError: () => {
        failed = true;
      },
    },
  }).parseFromString(xml, 'text/xml');
  if (failed || doc.documentElement?.localName?.toUpperCase() !== 'BMECAT')
    throw new Error('manufacturerInvalid');
  const descendants = (node: Element, name: string) =>
    [...Array.from(node.getElementsByTagName('*'))].filter(
      (n) => n.localName.toUpperCase() === name,
    );
  const text = (node: Element, name: string) =>
    descendants(node, name)[0]?.textContent?.trim() ?? '';
  const elements = Array.from(doc.getElementsByTagName('*')).filter((n) =>
    ['ARTICLE', 'PRODUCT'].includes(n.localName.toUpperCase()),
  );
  if (!elements.length || elements.length > 10000)
    throw new Error('manufacturerInvalid');
  const articles: CatalogArticle[] = [],
    hints: string[] = [];
  for (const node of elements) {
    const supplier = text(node, 'SUPPLIER_PID') || text(node, 'SUPPLIER_AID'),
      articleNumber =
        text(node, 'MANUFACTURER_PID') ||
        text(node, 'MANUFACTURER_AID') ||
        supplier;
    if (!articleNumber) throw new Error('manufacturerInvalid');
    const features = descendants(node, 'FEATURE').map((f) => ({
      name: text(f, 'FNAME'),
      values: descendants(f, 'FVALUE').map((v) => v.textContent?.trim() ?? ''),
      unit: text(f, 'FUNIT'),
    }));
    const explicit = features.filter((f) => f.name === 'SCHEMATICO_FUNCTIONS');
    if (explicit.length > 1 || explicit.some(f => f.values.length !== 1))
      throw new Error('manufacturerInvalid');
    let functions: CatalogArticle['functions'];
    if (explicit.length) {
      try {
        functions = JSON.parse(explicit[0].values[0]);
      } catch {
        throw new Error('manufacturerInvalid');
      }
    }
    const description = [
      text(node, 'DESCRIPTION_SHORT'),
      text(node, 'DESCRIPTION_LONG'),
      text(node, 'MANUFACTURER_TYPE_DESCR'),
      supplier ? `Supplier: ${supplier}` : '',
      ...features
        .filter((f) => f.name !== 'SCHEMATICO_FUNCTIONS')
        .map((f) => `${f.name}: ${f.values.join(', ')} ${f.unit}`),
    ]
      .filter(Boolean)
      .join('\n');
    articles.push(
      validateCatalogArticle({
        articleNumber,
        manufacturer: text(node, 'MANUFACTURER_NAME'),
        variant: text(node, 'VARIANT_ID'),
        description,
        origin: 'user',
        verification: 'unverified',
        functions,
      }),
    );
    if (!functions?.length) hints.push(articleNumber);
  }
  return { articles, withoutFunctions: hints };
}
