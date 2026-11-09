import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  appendPublicArticle,
  validatePublicArticle,
  MAX_CATALOG_BYTES,
  appendPublicSymbol,
  validatePublicSymbol,
  MAX_SYMBOLS_BYTES,
} from '../src/shared/catalog-publication.mjs';
const REPOSITORY = 'vitals5/schematico';
const FILE = 'catalog/articles.json';
const SYMBOLS_FILE = 'catalog/symbols.json';
/** Compare-and-swap with bounded retries: concurrent submissions cannot replace
 * each other's additions. No user-controlled path, branch, command or script. */
export async function updateCatalogFile(
  transform,
  {
    fetcher = fetch,
    token,
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    message,
    targetFile = FILE,
    maxBytes = MAX_CATALOG_BYTES,
  } = {},
) {
  if (!token) throw Error('Missing workflow authentication');
  const endpoint = `https://api.github.com/repos/${REPOSITORY}/contents/${targetFile}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Schematico-Catalog-Publisher',
  };
  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await fetcher(endpoint + '?ref=main', {
      headers,
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Error(`Cannot read shared ${targetFile}`);
    const file = await response.json();
    if (
      file.type !== 'file' ||
      file.path !== targetFile ||
      typeof file.sha !== 'string' ||
      !/^[a-f0-9]{40,64}$/i.test(file.sha) ||
      file.size > maxBytes
    )
      throw Error('Invalid shared catalogue response');
    let encoded = file;
    if (file.encoding === 'none') {
      const blob = await fetcher(
        `https://api.github.com/repos/${REPOSITORY}/git/blobs/${file.sha}`,
        { headers, signal: AbortSignal.timeout(20000) },
      );
      if (!blob.ok) throw Error('Cannot read catalogue blob');
      encoded = await blob.json();
      if (encoded.sha !== file.sha || encoded.size > maxBytes)
        throw Error('Invalid catalogue blob');
    }
    if (encoded.encoding !== 'base64' || typeof encoded.content !== 'string')
      throw Error('Invalid shared catalogue encoding');
    const bytes = Buffer.from(encoded.content, 'base64');
    if (bytes.length > maxBytes)
      throw Error('Catalogue capacity exceeded');
    const merged = transform(JSON.parse(bytes.toString('utf8')));
    if (!merged.changed) return { changed: false };
    const output = merged.catalog ?? merged.symbolsData;
    const serialized = JSON.stringify(output, null, 2) + '\n';
    if (Buffer.byteLength(serialized, 'utf8') > maxBytes)
      throw Error('Catalogue capacity exceeded');
    const commitMsg =
      message ??
      (merged.symbol
        ? `catalog: update vector symbol ${merged.symbol.id}`
        : merged.article?.symbolId
          ? `catalog: update symbol for ${merged.article.manufacturer} ${merged.article.articleNumber}`
          : 'catalog: add community article');
    const put = await fetcher(endpoint, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: commitMsg,
        branch: 'main',
        sha: file.sha,
        content: Buffer.from(serialized).toString('base64'),
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (put.ok) return { changed: true };
    if (![409, 422].includes(put.status))
      throw Error(`Cannot publish shared ${targetFile}`);
    await wait(Math.min(4000, 200 * (attempt + 1)));
  }
  throw Error('Catalogue changed repeatedly; retry submission');
}
export function publishCatalogArticle(raw, options) {
  const article = validatePublicArticle(raw);
  return updateCatalogFile(
    (current) =>
      appendPublicArticle(current, article, { allowSymbolUpdate: true }),
    options,
  );
}

export function publishCatalogSymbol(raw, options) {
  const symbol = validatePublicSymbol(raw);
  return updateCatalogFile(
    (current) => appendPublicSymbol(current, symbol),
    {
      ...options,
      targetFile: SYMBOLS_FILE,
      maxBytes: MAX_SYMBOLS_BYTES,
      message: `catalog: add vector symbol ${symbol.id}`,
    },
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const event = JSON.parse(
    fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'),
  );
  if (
    process.env.GITHUB_REPOSITORY !== REPOSITORY ||
    !['repository_dispatch', 'workflow_dispatch'].includes(
      process.env.GITHUB_EVENT_NAME,
    )
  )
    throw Error('Unsupported catalogue event');
  const raw =
    process.env.GITHUB_EVENT_NAME === 'repository_dispatch' &&
    event.action === 'schematico.article.submitted'
      ? event.client_payload?.article
      : process.env.GITHUB_EVENT_NAME === 'workflow_dispatch'
        ? JSON.parse(event.inputs?.article ?? 'null')
        : undefined;
  const rawSymbol =
    process.env.GITHUB_EVENT_NAME === 'repository_dispatch' &&
    event.action === 'schematico.article.submitted'
      ? event.client_payload?.symbol
      : process.env.GITHUB_EVENT_NAME === 'workflow_dispatch'
        ? JSON.parse(event.inputs?.symbol ?? 'null')
        : undefined;

  const result = await publishCatalogArticle(raw, {
    token: process.env.GH_TOKEN,
  });
  console.log(
    result.changed
      ? 'Shared article added/updated.'
      : 'Identical shared article already exists.',
  );
  if (rawSymbol) {
    const symResult = await publishCatalogSymbol(rawSymbol, {
      token: process.env.GH_TOKEN,
    });
    console.log(
      symResult.changed
        ? 'Shared vector symbol added/updated.'
        : 'Identical shared vector symbol already exists.',
    );
  }
}
