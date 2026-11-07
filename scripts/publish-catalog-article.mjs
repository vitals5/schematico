import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  appendPublicArticle,
  validatePublicArticle,
  MAX_CATALOG_BYTES,
} from '../src/shared/catalog-publication.mjs';
const REPOSITORY = 'vitals5/schematico';
const FILE = 'catalog/articles.json';
/** Compare-and-swap with bounded retries: concurrent submissions cannot replace
 * each other's additions. No user-controlled path, branch, command or script. */
export async function updateCatalogFile(
  transform,
  {
    fetcher = fetch,
    token,
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  if (!token) throw Error('Missing workflow authentication');
  const endpoint = `https://api.github.com/repos/${REPOSITORY}/contents/${FILE}`;
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
    if (!response.ok) throw Error('Cannot read shared catalogue');
    const file = await response.json();
    if (
      file.type !== 'file' ||
      file.path !== FILE ||
      typeof file.sha !== 'string' ||
      !/^[a-f0-9]{40,64}$/i.test(file.sha) ||
      file.size > MAX_CATALOG_BYTES
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
      if (encoded.sha !== file.sha || encoded.size > MAX_CATALOG_BYTES)
        throw Error('Invalid catalogue blob');
    }
    if (encoded.encoding !== 'base64' || typeof encoded.content !== 'string')
      throw Error('Invalid shared catalogue encoding');
    const bytes = Buffer.from(encoded.content, 'base64');
    if (bytes.length > MAX_CATALOG_BYTES)
      throw Error('Catalogue capacity exceeded');
    const merged = transform(JSON.parse(bytes.toString('utf8')));
    if (!merged.changed) return { changed: false };
    const serialized = JSON.stringify(merged.catalog, null, 2) + '\n';
    if (Buffer.byteLength(serialized, 'utf8') > MAX_CATALOG_BYTES)
      throw Error('Catalogue capacity exceeded');
    const put = await fetcher(endpoint, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'catalog: add community article',
        branch: 'main',
        sha: file.sha,
        content: Buffer.from(serialized).toString('base64'),
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (put.ok) return { changed: true };
    if (![409, 422].includes(put.status))
      throw Error('Cannot publish shared article');
    await wait(Math.min(4000, 200 * (attempt + 1)));
  }
  throw Error('Catalogue changed repeatedly; retry submission');
}
export function publishCatalogArticle(raw, options) {
  const article = validatePublicArticle(raw);
  return updateCatalogFile(
    (current) => appendPublicArticle(current, article),
    options,
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
  const result = await publishCatalogArticle(raw, {
    token: process.env.GH_TOKEN,
  });
  console.log(
    result.changed
      ? 'Shared article added.'
      : 'Identical shared article already exists.',
  );
}
