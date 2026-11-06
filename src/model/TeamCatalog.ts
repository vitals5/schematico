import type { CatalogArticle } from './ArticleTypes';
import { catalogKey, validateCatalogArticle } from './CatalogRecord';
import { catalogRevision, ArticleCatalog } from './ArticleCatalog';
export interface TeamState {
  revision: number;
  base: CatalogArticle[];
  localBase?: CatalogArticle[];
}
export interface TeamSnapshot {
  schema: 'schematico-team-catalog';
  version: 1;
  teamId: string;
  user: { id: string; role: 'reader' | 'editor' | 'admin' };
  revision: number;
  articles: CatalogArticle[];
}
const imported = (a: CatalogArticle) =>
  validateCatalogArticle({ ...a, verification: 'unverified' });
export function teamUrl(input: string) {
  const url = new URL(input);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      ))
  )
    throw new Error('teamUrlInvalid');
  return url.href.replace(/\/$/, '');
}
export class TeamCatalogClient {
  readonly url: string;
  constructor(
    input: string,
    private token: string,
  ) {
    this.url = teamUrl(input);
  }
  private async request(path: string, options: RequestInit = {}) {
    const response = await fetch(this.url + path, {
      ...options,
      headers: { Authorization: 'Bearer ' + this.token, ...options.headers },
      signal: AbortSignal.timeout(20000),
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        [
          'teamUnauthorized',
          'teamReadOnly',
          'teamStale',
          'teamInvalid',
          'teamRevisionRequired',
        ].includes(result.error)
          ? result.error
          : 'teamServerError',
      );
    return result;
  }
  async read(): Promise<TeamSnapshot> {
    return this.validate(await this.request('/v1/catalog'));
  }
  async write(
    articles: CatalogArticle[],
    revision: number,
  ): Promise<TeamSnapshot> {
    return this.validate(
      await this.request('/v1/catalog', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': String(revision),
        },
        body: JSON.stringify({ articles }),
      }),
    );
  }
  async history(): Promise<{
    versions: { revision: number; author: string; created: string }[];
  }> {
    const value = await this.request('/v1/history');
    if (
      !Array.isArray(value.versions) ||
      value.versions.length > 100 ||
      value.versions.some(
        (v: any) =>
          !Number.isSafeInteger(v.revision) ||
          typeof v.author !== 'string' ||
          typeof v.created !== 'string',
      )
    )
      throw new Error('teamInvalid');
    return value;
  }
  async version(revision: number) {
    if (!Number.isSafeInteger(revision) || revision < 0)
      throw new Error('teamInvalid');
    const value = await this.request('/v1/versions/' + revision);
    if (
      value.revision !== revision ||
      typeof value.teamId !== 'string' ||
      !Array.isArray(value.articles) ||
      value.articles.length > 10000
    )
      throw new Error('teamInvalid');
    return { ...value, articles: value.articles.map(validateCatalogArticle) };
  }
  private validate(value: any): TeamSnapshot {
    if (
      value.schema !== 'schematico-team-catalog' ||
      value.version !== 1 ||
      typeof value.teamId !== 'string' ||
      !value.user ||
      typeof value.user.id !== 'string' ||
      !['reader', 'editor', 'admin'].includes(value.user.role) ||
      !Number.isSafeInteger(value.revision) ||
      value.revision < 0 ||
      !Array.isArray(value.articles) ||
      value.articles.length > 10000
    )
      throw new Error('teamInvalid');
    value.articles = value.articles.map(validateCatalogArticle);
    if (new Set(value.articles.map(catalogKey)).size !== value.articles.length)
      throw new Error('teamInvalid');
    return value;
  }
}
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
function merge(
  local: CatalogArticle[],
  snapshot: TeamSnapshot,
  base: TeamState | undefined,
  choices: Record<string, 'local' | 'remote'>,
  pullOnly: boolean,
  preview = false,
) {
  const a = new Map(local.map((a) => [catalogKey(a), a])),
    b = new Map(snapshot.articles.map((a) => [catalogKey(a), a])),
    oldRemote = new Map(base?.base.map((a) => [catalogKey(a), a])),
    oldLocal = new Map(
      (base?.localBase ?? base?.base)?.map((a) => [catalogKey(a), a]),
    );
  const rows: {
      key: string;
      local?: CatalogArticle;
      remote?: CatalogArticle;
      conflict: boolean;
    }[] = [],
    resultLocal: CatalogArticle[] = [],
    resultRemote: CatalogArticle[] = [],
    localBase: CatalogArticle[] = [];
  for (const key of new Set([
    ...a.keys(),
    ...b.keys(),
    ...oldRemote.keys(),
    ...oldLocal.keys(),
  ])) {
    const l = a.get(key),
      r = b.get(key),
      nr = r && imported(r),
      ol = oldLocal.get(key),
      or = oldRemote.get(key),
      lc = !equal(l, ol),
      rc = !equal(nr, or),
      same = equal(l, nr) || equal(l, r),
      conflict = lc && rc && !same;
    const push = (
      target: CatalogArticle[],
      value: CatalogArticle | undefined,
    ) => {
      if (value) target.push(structuredClone(value));
    };
    if ((!lc && !rc) || same) {
      push(resultLocal, l);
      push(resultRemote, r);
      push(localBase, l);
      continue;
    }
    rows.push({
      key,
      local: l && structuredClone(l),
      remote: r && structuredClone(r),
      conflict,
    });
    if (conflict && !choices[key] && !preview)
      throw new Error('teamResolveConflicts');
    const useLocal = conflict ? choices[key] === 'local' : lc;
    if (useLocal) {
      push(resultLocal, l);
      push(resultRemote, pullOnly ? r : l);
      push(localBase, pullOnly && !equal(l, r) && !equal(l, nr) ? ol : l);
    } else {
      push(resultLocal, nr);
      push(resultRemote, r);
      push(localBase, nr);
    }
  }
  return {
    rows,
    local: resultLocal,
    remote: resultRemote,
    localBase,
    writesRemote:
      catalogRevision(resultRemote) !== catalogRevision(snapshot.articles),
  };
}
export class TeamSyncPlan {
  readonly rows: ReturnType<typeof merge>['rows'];
  private local: CatalogArticle[];
  private remote: TeamSnapshot;
  private base: TeamState | undefined;
  constructor(local: CatalogArticle[], remote: TeamSnapshot, base?: TeamState) {
    this.local = structuredClone(local);
    this.remote = structuredClone(remote);
    this.base = structuredClone(base);
    this.rows = merge(this.local, this.remote, this.base, {}, false, true).rows;
  }
  result(choices: Record<string, 'local' | 'remote'> = {}, pullOnly = false) {
    return merge(this.local, this.remote, this.base, choices, pullOnly);
  }
  async apply(
    catalog: ArticleCatalog,
    client: TeamCatalogClient,
    choices: Record<string, 'local' | 'remote'> = {},
    pullOnly = false,
  ) {
    const result = this.result(choices, pullOnly);
    if (this.remote.user.role === 'reader' && result.writesRemote)
      throw new Error('teamReadOnly');
    const fresh = await client.read();
    if (
      fresh.revision !== this.remote.revision ||
      fresh.teamId !== this.remote.teamId ||
      fresh.user.id !== this.remote.user.id
    )
      throw new Error('teamStale');
    const saved = result.writesRemote
      ? await client.write(result.remote, fresh.revision)
      : fresh;
    if (saved.teamId !== fresh.teamId || saved.user.id !== fresh.user.id)
      throw new Error('teamInvalid');
    try {
      await catalog.replaceForSync(
        result.local,
        catalogRevision(this.local),
        JSON.stringify([client.url,saved.teamId,saved.user.id]),
        {
          revision: saved.revision,
          base: saved.articles.map(imported),
          localBase: result.localBase,
        },
      );
    } catch (e) {
      if (result.writesRemote) throw new Error('teamRemoteSavedLocalStale');
      throw e;
    }
    return saved;
  }
}
