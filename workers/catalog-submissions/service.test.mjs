import assert from 'node:assert/strict';
import service from './index.mjs';
import { publishCatalogArticle } from '../../scripts/publish-catalog-article.mjs';
const article = {
  articleNumber: '001',
  manufacturer: 'Maker',
  variant: '',
  description: 'Example',
  origin: 'user',
  verification: 'user_checked',
};
const env = {
  GITHUB_DISPATCH_TOKEN: 'test-server-secret',
  TURNSTILE_SECRET: 'test-challenge-secret',
  SUBMISSION_LIMITER: { limit: async () => ({ success: true }) },
};
const request = (
  data = { article, challengeToken: 'test-response' },
  origin = 'https://vitals5.github.io',
) =>
  new Request('https://catalog.example.workers.dev/submit', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '192.0.2.1',
    },
    body: JSON.stringify(data),
  });
const original = globalThis.fetch;
let calls = [];
try {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (String(url).includes('siteverify'))
      return Response.json({
        success: true,
        action: 'catalog-submit',
        hostname: 'vitals5.github.io',
      });
    return new Response(null, { status: 204 });
  };
  const response = await service.fetch(request(), env);
  assert.equal(response.status, 202);
  const result = await response.json();
  assert.match(result.submissionId, /^[a-f0-9]{64}$/);
  assert(!JSON.stringify(result).includes('secret'));
  assert.equal(calls.length, 2);
  const payload = JSON.parse(calls[1].options.body);
  assert.equal(payload.event_type, 'schematico.article.submitted');
  assert.equal(payload.client_payload.article.verification, 'unverified');
  assert(!JSON.stringify(payload).includes('test-server-secret'));
  calls = [];
  assert.equal(
    (await service.fetch(request(undefined, 'https://attacker.invalid'), env))
      .status,
    403,
  );
  assert.equal(calls.length, 0);
  assert.equal(
    (
      await service.fetch(request(), {
        ...env,
        SUBMISSION_LIMITER: { limit: async () => ({ success: false }) },
      })
    ).status,
    429,
  );
  assert.equal(
    (
      await service.fetch(request(), {
        ...env,
        GITHUB_DISPATCH_TOKEN: undefined,
      })
    ).status,
    503,
  );
  globalThis.fetch = async () =>
    Response.json({
      success: true,
      action: 'different',
      hostname: 'vitals5.github.io',
    });
  assert.equal((await service.fetch(request(), env)).status, 403);
  globalThis.fetch = async () =>
    Response.json({
      success: true,
      action: 'catalog-submit',
      hostname: 'attacker.invalid',
    });
  assert.equal((await service.fetch(request(), env)).status, 403);
  assert.equal(
    (
      await service.fetch(
        request({
          article: { ...article, manufacturer: '' },
          challengeToken: 'test',
        }),
        env,
      )
    ).status,
    400,
  );
} finally {
  globalThis.fetch = original;
}
const base = { schema: 'schematico-articles', version: 1, articles: [] };
const file = (catalog, sha = 'a'.repeat(40)) =>
  Response.json({
    type: 'file',
    path: 'catalog/articles.json',
    sha,
    encoding: 'base64',
    content: Buffer.from(JSON.stringify(catalog)).toString('base64'),
    size: JSON.stringify(catalog).length,
  });
let puts = 0,
  reads = 0,
  written;
const concurrent = {
  ...base,
  articles: [
    { ...article, articleNumber: 'other', verification: 'unverified' },
  ],
};
const saved = await publishCatalogArticle(article, {
  token: 'test-workflow-secret',
  wait: async () => {},
  fetcher: async (url, options) => {
    assert(
      String(url).startsWith(
        'https://api.github.com/repos/vitals5/schematico/contents/catalog/articles.json',
      ),
    );
    if (options?.method === 'PUT') {
      puts++;
      written = JSON.parse(
        Buffer.from(JSON.parse(options.body).content, 'base64'),
      );
      assert.equal(JSON.parse(options.body).branch, 'main');
      return new Response(null, { status: puts === 1 ? 409 : 200 });
    }
    return file(
      reads++ === 0 ? base : concurrent,
      reads === 1 ? 'a'.repeat(40) : 'b'.repeat(40),
    );
  },
});
assert(saved.changed);
assert.equal(puts, 2);
assert.equal(
  written.articles.length,
  2,
  'A competing addition survives the retry',
);
const unchanged = await publishCatalogArticle(article, {
  token: 'test',
  fetcher: async () => file(written),
});
assert.equal(unchanged.changed, false);
await assert.rejects(
  () =>
    publishCatalogArticle(
      { ...article, description: 'replacement' },
      { token: 'test', fetcher: async () => file(written) },
    ),
  /githubCatalogConflict/,
);
let blobRead = false;
await publishCatalogArticle(
  { ...article, articleNumber: 'large-catalog' },
  {
    token: 'test',
    fetcher: async (url, options) => {
      if (options?.method === 'PUT') return new Response(null, { status: 200 });
      if (String(url).includes('/git/blobs/')) {
        blobRead = true;
        return Response.json({
          sha: 'a'.repeat(40),
          size: 10,
          encoding: 'base64',
          content: Buffer.from(JSON.stringify(base)).toString('base64'),
        });
      }
      return Response.json({
        type: 'file',
        path: 'catalog/articles.json',
        sha: 'a'.repeat(40),
        encoding: 'none',
        size: 1048577,
      });
    },
  },
);
assert(
  blobRead,
  'Catalogues larger than the Contents API inline limit use the bounded blob API',
);
console.log(
  '✓ Anonymous submission service: server-only credentials, origin/challenge/rate checks, sanitized payloads, fixed repository path, immutable existing records, large-file reads and concurrent update retries',
);
