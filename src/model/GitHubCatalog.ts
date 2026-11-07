import type { CatalogArticle } from './ArticleTypes';
import {
  parseSharedCatalog,
  validatePublicArticle,
  MAX_CATALOG_BYTES,
  type SharedCatalogData,
} from '../shared/catalog-publication.mjs';
export const SHARED_CATALOG_URL =
  'https://raw.githubusercontent.com/vitals5/schematico/main/catalog/articles.json';
export const SHARED_CATALOG_FILE =
  'https://github.com/vitals5/schematico/blob/main/catalog/articles.json';
export type SharedCatalogState = {
  articles: CatalogArticle[];
  status: 'loading' | 'ready' | 'offline' | 'unavailable';
  updatedAt?: string;
  submission?: SharedCatalogData['submission'];
};
let state: SharedCatalogState = { articles: [], status: 'loading' },
  pending: Promise<SharedCatalogState> | undefined;
const listeners = new Set<() => void>();
export const sharedCatalogState = () => structuredClone(state);
export function onSharedCatalogChange(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function notify() {
  for (const listener of listeners) listener();
}
async function cache(
  mode: 'read' | 'write',
  data?: SharedCatalogData,
): Promise<SharedCatalogData | undefined> {
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
    const req =
      mode === 'read' ? store.get('catalog') : store.put(data, 'catalog');
    tx.oncomplete = () => {
      db.close();
      try {
        resolve(
          mode === 'read' && req.result ? parseSharedCatalog(req.result) : data,
        );
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
        if (saved) {
          state = {
            articles: saved.articles,
            submission: saved.submission,
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
      state = {
        articles: data.articles,
        submission: data.submission,
        status: 'ready',
        updatedAt: new Date().toISOString(),
      };
      try {
        await cache('write', data);
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
) {
  const article = validatePublicArticle(raw),
    endpoint = state.submission;
  if (!endpoint) throw new Error('githubCatalogNotConfigured');
  if (!challengeToken) throw new Error('githubCatalogChallenge');
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetcher(endpoint.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ article, challengeToken }),
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
