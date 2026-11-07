import type { CatalogArticle } from './ArticleTypes';
import type { Project } from './types';
import { effectiveArticles } from './ArticleAssignments';
import { MANUFACTURER_PARTS } from './PartCatalogue';
export { catalogKey, validateCatalogArticle } from './CatalogRecord';
import { catalogKey, validateCatalogArticle } from './CatalogRecord';
const catalogListeners = new Set<() => void>();
export function onLocalCatalogChange(listener: () => void) {
  catalogListeners.add(listener);
  return () => catalogListeners.delete(listener);
}
function notifyCatalogChange() {
  for (const listener of catalogListeners) listener();
}
export const catalogRevision = (articles: CatalogArticle[]) =>
  JSON.stringify(
    [...articles].sort((a, b) => catalogKey(a).localeCompare(catalogKey(b))),
  );
export function planCatalogMerge(
  current: CatalogArticle[],
  incoming: CatalogArticle[],
) {
  if (!Array.isArray(incoming) || incoming.length > 10000)
    throw new Error('articlesCatalogInvalid');
  const known = new Map(current.map((a) => [catalogKey(a), a])),
    seen = new Set<string>(),
    added: CatalogArticle[] = [],
    conflicts: CatalogArticle[] = [],
    unchanged: CatalogArticle[] = [];
  for (const raw of incoming) {
    const a = validateCatalogArticle(raw),
      key = catalogKey(a);
    if (seen.has(key)) throw new Error('articlesCatalogDuplicate');
    seen.add(key);
    const old = known.get(key);
    if (!old) added.push(a);
    else if (JSON.stringify({ ...old, id: a.id }) === JSON.stringify(a))
      unchanged.push(a);
    else conflicts.push(a);
  }
  return { added, conflicts, unchanged };
}
export function starterArticles(): CatalogArticle[] {
  return MANUFACTURER_PARTS.map((p) =>
    validateCatalogArticle({
      articleNumber: p.articleNumber,
      manufacturer: p.manufacturer,
      variant: '',
      description: p.name + ' · ' + p.description,
      origin: 'starter',
      verification: 'unverified',
      symbolId: p.symbolId,
    }),
  );
}
/** Older shared seed records lack symbol IDs. Local records remain authoritative,
 * including an explicitly removed default symbol. */
export function availableCatalogArticles(shared: CatalogArticle[], local: CatalogArticle[]) {
  const map = new Map(starterArticles().map(a => [catalogKey(a), a]));
  for (const a of shared) {
    const key = catalogKey(a), symbolId = a.symbolId ?? map.get(key)?.symbolId;
    map.set(key, { ...a, ...(symbolId ? {symbolId} : {}) });
  }
  for (const a of local) map.set(catalogKey(a), a);
  return [...map.values()];
}
export function projectArticles(p: Project): CatalogArticle[] {
  const rows: CatalogArticle[] = (p.importedArticleLibrary ?? []).map((m) =>
    validateCatalogArticle({
      articleNumber: m.articleNumber,
      manufacturer: m.manufacturer ?? '',
      variant: m.variant,
      description: m.description ?? '',
      origin: 'project_import',
      verification: 'unverified',
    }),
  );
  for (const page of p.pages)
    for (const c of page.components)
      for (const a of effectiveArticles(c, p))
        rows.push(
          validateCatalogArticle(
            a.snapshot ?? {
              articleNumber: a.articleNumber,
              manufacturer: a.manufacturer,
              variant: a.variant,
              description: c.functionText ?? '',
              origin: 'project_import',
              verification: 'unverified',
            },
          ),
        );
  // Preserve distinct variants and prefer the most complete record for an exact
  // key only if no specification conflicts. Never invent manufacturer functions.
  const byKey = new Map<string, CatalogArticle>();
  for (const a of rows) {
    const key = catalogKey(a),
      old = byKey.get(key);
    if (!old) byKey.set(key, a);
    else if (
      old.functions &&
      a.functions &&
      JSON.stringify(old.functions) !== JSON.stringify(a.functions)
    )
      throw new Error('articlesCatalogDuplicate');
    else if (
      (!old.functions && a.functions) ||
      (!old.description && a.description)
    )
      byKey.set(key, a);
  }
  return [...byKey.values()];
}
export function catalogToCsv(articles: CatalogArticle[]): string {
  const cell = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  return [
    ['articleNumber', 'manufacturer', 'variant', 'description', 'functions', 'symbolId'],
    ...articles.map((a) => [
      a.articleNumber,
      a.manufacturer,
      a.variant,
      a.description,
      a.functions ? JSON.stringify(a.functions) : '',
      a.symbolId ?? '',
    ]),
  ]
    .map((row) => row.map(cell).join(';'))
    .join('\r\n');
}
function csvRows(text: string): string[][] {
  const delimiter = text
    .slice(0, text.indexOf('\n') < 0 ? undefined : text.indexOf('\n'))
    .includes(';')
    ? ';'
    : ',';
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    after = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          after = true;
        }
      } else cell += ch;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell);
      cell = '';
      after = false;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((v) => v.length)) rows.push(row);
      row = [];
      cell = '';
      after = false;
    } else if (ch === '"' && !cell && !after) quoted = true;
    else {
      if (after || ch === '"') throw new Error('articlesCatalogInvalid');
      cell += ch;
    }
  }
  if (quoted) throw new Error('articlesCatalogInvalid');
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
export function parseCatalogFile(
  text: string,
  format: 'json' | 'csv',
): CatalogArticle[] {
  if (text.length > 20 * 1024 * 1024) throw new Error('articlesCatalogInvalid');
  let items: unknown;
  if (format === 'json') {
    const parsed = JSON.parse(text);
    if (parsed.schema !== 'schematico-articles' || parsed.version !== 1)
      throw new Error('articlesCatalogInvalid');
    items = parsed.articles;
  } else {
    const [headers, ...rows] = csvRows(text.replace(/^\uFEFF/, ''));
    if (
      !headers ||
      !['articleNumber', 'manufacturer', 'variant', 'description'].every((k) =>
        headers.includes(k),
      ) ||
      new Set(headers).size !== headers.length
    )
      throw new Error('articlesCatalogInvalid');
    items = rows.map((row) => {
      if (row.length !== headers.length)
        throw new Error('articlesCatalogInvalid');
      const fields = Object.fromEntries(headers.map((key, i) => [key, row[i]]));
      return {
        articleNumber: fields.articleNumber,
        manufacturer: fields.manufacturer,
        variant: fields.variant,
        description: fields.description,
        functions: fields.functions ? JSON.parse(fields.functions) : undefined,
        symbolId: fields.symbolId || undefined,
        origin: 'user',
        verification: 'unverified',
      };
    });
  }
  if (!Array.isArray(items) || items.length > 10000)
    throw new Error('articlesCatalogInvalid');
  return items.map((a) =>
    validateCatalogArticle({ ...a, verification: 'unverified' }),
  );
}
export const catalogToJson = (articles: CatalogArticle[]) =>
  JSON.stringify(
    { schema: 'schematico-articles', version: 1, articles },
    null,
    2,
  );
/** One read-write transaction checks the preview revision before any writes. */
export class ArticleCatalog {
  private async open() {
    if (typeof indexedDB === 'undefined')
      throw new Error('articlesStorageUnavailable');
    return new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('schematico-articles', 2);
      r.onupgradeneeded = () => {if(!r.result.objectStoreNames.contains('articles'))r.result.createObjectStore('articles',{keyPath:'id'});if(!r.result.objectStoreNames.contains('sync'))r.result.createObjectStore('sync');};
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error('articlesStorageUnavailable'));
    });
  }
  async syncState(key:string):Promise<import('./TeamCatalog').TeamState|undefined>{const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction('sync','readonly'),r=tx.objectStore('sync').get(key);tx.oncomplete=()=>{db.close();resolve(r.result);};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error);};});}
  async replaceForSync(articles:CatalogArticle[],expected:string,key:string,state:import('./TeamCatalog').TeamState){const rows=articles.map(validateCatalogArticle);if(new Set(rows.map(catalogKey)).size!==rows.length)throw new Error('articlesCatalogDuplicate');const db=await this.open();return new Promise<void>((resolve,reject)=>{const tx=db.transaction(['articles','sync'],'readwrite'),store=tx.objectStore('articles'),read=store.getAll();let error:unknown;read.onsuccess=()=>{if(catalogRevision(read.result)!==expected){error=new Error('articlesCatalogStale');tx.abort();return;}store.clear();rows.forEach(r=>store.put(r));tx.objectStore('sync').put(state,key);};tx.oncomplete=()=>{db.close();notifyCatalogChange();resolve();};tx.onabort=tx.onerror=()=>{db.close();reject(error??tx.error);};});}
  async list(): Promise<CatalogArticle[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('articles', 'readonly'),
        r = tx.objectStore('articles').getAll();
      tx.oncomplete = () => {
        db.close();
        try {
          resolve(r.result.map(validateCatalogArticle));
        } catch (e) {
          reject(e);
        }
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }
  async merge(incoming: CatalogArticle[], replace: boolean, expected: string) {
    const normalized = incoming.map(validateCatalogArticle),
      db = await this.open();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('articles', 'readwrite'),
        store = tx.objectStore('articles'),
        read = store.getAll();
      let failure: unknown;
      read.onsuccess = () => {
        try {
          if (catalogRevision(read.result) !== expected)
            throw new Error('articlesCatalogStale');
          const plan = planCatalogMerge(read.result, normalized);
          if (plan.conflicts.length && !replace)
            throw new Error('articlesCatalogConflict');
          for (const a of [...plan.added, ...plan.conflicts]) store.put(a);
        } catch (e) {
          failure = e;
          tx.abort();
        }
      };
      tx.oncomplete = () => {
        db.close();
        notifyCatalogChange();
        resolve();
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(failure ?? tx.error ?? new Error('articlesStorageUnavailable'));
      };
    });
  }
  async remove(id: string, expected: string) {
    const db = await this.open();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('articles', 'readwrite'),
        store = tx.objectStore('articles'),
        r = store.getAll();
      let error: unknown;
      r.onsuccess = () => {
        if (catalogRevision(r.result) !== expected) {
          error = new Error('articlesCatalogStale');
          tx.abort();
        } else store.delete(id);
      };
      tx.oncomplete = () => {
        db.close();
        notifyCatalogChange();
        resolve();
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(error ?? tx.error);
      };
    });
  }
}
