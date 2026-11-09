import type { CatalogArticle } from './ArticleTypes';
import type { SymbolDefinition } from './types';
import defaultSymbols from '../../catalog/symbols.json';
import {
  parseSharedCatalog,
  validatePublicArticle,
  MAX_CATALOG_BYTES,
  type SharedCatalogData,
  parseSharedSymbols,
  validatePublicSymbol,
  MAX_SYMBOLS_BYTES,
  type SharedSymbolsData,
} from '../shared/catalog-publication.mjs';
export const SHARED_CATALOG_URL =
  'https://raw.githubusercontent.com/vitals5/schematico/main/catalog/articles.json';
export const SHARED_CATALOG_FILE =
  'https://github.com/vitals5/schematico/blob/main/catalog/articles.json';
export const SHARED_SYMBOLS_URL =
  'https://raw.githubusercontent.com/vitals5/schematico/main/catalog/symbols.json';
export const SHARED_SYMBOLS_FILE =
  'https://github.com/vitals5/schematico/blob/main/catalog/symbols.json';
export type SharedCatalogState = {
  articles: CatalogArticle[];
  symbols: SymbolDefinition[];
  status: 'loading' | 'ready' | 'offline' | 'unavailable';
  updatedAt?: string;
  submission?: SharedCatalogData['submission'];
};
const starterSymbols: SymbolDefinition[] = Array.isArray(
  (defaultSymbols as any)?.symbols,
)
  ? (defaultSymbols as any).symbols
  : [];
let state: SharedCatalogState = {
    articles: [],
    symbols: starterSymbols,
    status: 'loading',
  },
  pending: Promise<SharedCatalogState> | undefined;
const listeners = new Set<() => void>();
export const sharedCatalogState = () => structuredClone(state);
export const sharedCatalogSymbols = (): SymbolDefinition[] =>
  structuredClone(state.symbols);
export const getSharedCatalogSymbol = (
  id: string,
): SymbolDefinition | undefined => state.symbols.find((s) => s.id === id);
export function onSharedCatalogChange(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function notify() {
  for (const listener of listeners) listener();
}
async function cache(
  mode: 'read' | 'write',
  data?: { catalog?: SharedCatalogData; symbols?: SharedSymbolsData },
): Promise<
  { catalog?: SharedCatalogData; symbols?: SharedSymbolsData } | undefined
> {
  if (typeof indexedDB === 'undefined') return;
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('schematico-github-catalog', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('snapshot');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('articlesStorageUnavailable'));
  });
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
        'snapshot',
        mode === 'read' ? 'readonly' : 'readwrite',
      ),
      store = tx.objectStore('snapshot');
    const reqCatalog =
      mode === 'read'
        ? store.get('catalog')
        : data?.catalog
          ? store.put(data.catalog, 'catalog')
          : undefined;
    const reqSymbols =
      mode === 'read'
        ? store.get('symbols')
        : data?.symbols
          ? store.put(data.symbols, 'symbols')
          : undefined;
    tx.oncomplete = () => {
      db.close();
      try {
        if (mode === 'read') {
          const parsedCatalog = reqCatalog?.result
            ? parseSharedCatalog(reqCatalog.result)
            : undefined;
          const parsedSymbols = reqSymbols?.result
            ? parseSharedSymbols(reqSymbols.result)
            : undefined;
          resolve({ catalog: parsedCatalog, symbols: parsedSymbols });
        } else {
          resolve(data);
        }
      } catch (error) {
        reject(error);
      }
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function refreshSharedCatalog(
  fetcher: typeof fetch = fetch,
): Promise<SharedCatalogState> {
  if (pending) return pending;
  pending = (async () => {
    if (!state.articles.length) {
      try {
        const saved = await cache('read');
        if (saved?.catalog) {
          state = {
            articles: saved.catalog.articles,
            symbols: saved.symbols?.symbols ?? starterSymbols,
            submission: saved.catalog.submission,
            status: 'loading',
          };
          notify();
        }
      } catch {
        /* Local cache failure must not disable the online catalogue. */
      }
    }
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetcher(SHARED_CATALOG_URL, {
        signal: controller.signal,
        cache: 'no-cache',
        credentials: 'omit',
      });
      if (
        !response.ok ||
        Number(response.headers.get('content-length') ?? 0) > MAX_CATALOG_BYTES
      )
        throw new Error('githubCatalogUnavailable');
      const text = await boundedText(response, MAX_CATALOG_BYTES),
        data = parseSharedCatalog(JSON.parse(text));

      let symbolsData: SharedSymbolsData | undefined;
      try {
        const symbolsResp = await fetcher(SHARED_SYMBOLS_URL, {
          signal: controller.signal,
          cache: 'no-cache',
          credentials: 'omit',
        });
        if (
          symbolsResp.ok &&
          Number(symbolsResp.headers.get('content-length') ?? 0) <=
            MAX_SYMBOLS_BYTES
        ) {
          const symText = await boundedText(symbolsResp, MAX_SYMBOLS_BYTES);
          symbolsData = parseSharedSymbols(JSON.parse(symText));
        }
      } catch {
        /* Optional symbols fetch failure preserves existing symbols */
      }

      const effectiveSymbols = symbolsData?.symbols ?? state.symbols;
      state = {
        articles: data.articles,
        symbols: effectiveSymbols,
        submission: data.submission,
        status: 'ready',
        updatedAt: new Date().toISOString(),
      };
      try {
        await cache('write', {
          catalog: data,
          symbols: symbolsData ?? {
            schema: 'schematico-symbols',
            version: 1,
            symbols: effectiveSymbols,
          },
        });
      } catch {
        /* Data remains usable for this session. */
      }
    } catch {
      state = {
        ...state,
        status: state.articles.length ? 'offline' : 'unavailable',
      };
    } finally {
      clearTimeout(timeout);
      notify();
    }
    return sharedCatalogState();
  })();
  try {
    return await pending;
  } finally {
    pending = undefined;
  }
}
async function boundedText(response: Response, limit: number) {
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).length > limit)
      throw new Error('githubCatalogInvalid');
    return text;
  }
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new Error('githubCatalogInvalid');
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}
export async function submitSharedArticle(
  raw: CatalogArticle,
  challengeToken: string,
  fetcher: typeof fetch = fetch,
  rawSymbol?: unknown,
) {
  const article = validatePublicArticle(raw),
    symbol = rawSymbol ? validatePublicSymbol(rawSymbol) : undefined,
    endpoint = state.submission;
  if (!endpoint) throw new Error('githubCatalogNotConfigured');
  if (!challengeToken) throw new Error('githubCatalogChallenge');
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetcher(endpoint.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        article,
        ...(symbol ? { symbol } : {}),
        challengeToken,
      }),
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 403) throw new Error('githubCatalogChallenge');
      if (response.status === 409) throw new Error('githubCatalogConflict');
      if (response.status === 429) throw new Error('githubCatalogRateLimited');
      throw new Error('githubCatalogSubmitFailed');
    }
    const result = JSON.parse(await boundedText(response, 8192));
    if (
      response.status !== 202 ||
      result.status !== 'submitted' ||
      typeof result.submissionId !== 'string' ||
      !/^[a-f0-9]{64}$/.test(result.submissionId)
    )
      throw new Error('githubCatalogSubmitFailed');
    return { submissionId: result.submissionId };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('githubCatalog'))
      throw error;
    throw new Error('githubCatalogSubmitFailed');
  } finally {
    clearTimeout(timeout);
  }
}
