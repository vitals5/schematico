import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createCatalogServer, tokenHash } from './catalog.mjs';
const folder = mkdtempSync(join(tmpdir(), 'schematico-catalog-')),
  token = randomBytes(32).toString('hex'),
  reader = randomBytes(32).toString('hex');
const config = {
  teamId: 'test',
  database: join(folder, 'catalog.sqlite'),
  allowedOrigins: ['https://allowed.test'],
  users: [
    { id: 'editor', role: 'editor', tokenHash: tokenHash(token) },
    { id: 'reader', role: 'reader', tokenHash: tokenHash(reader) },
  ],
};
let server = createCatalogServer(config);
server.listen(0, '127.0.0.1');
await once(server, 'listening');
let address = `http://127.0.0.1:${server.address().port}`;
const req = (path, method = 'GET', body, rev, credential = token, origin) =>
  fetch(address + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + credential,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(rev !== undefined ? { 'If-Match': String(rev) } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
try {
  assert.equal(
    (await req('/v1/catalog', 'GET', undefined, undefined, 'bad')).status,
    401,
  );
  assert.equal(
    (
      await req(
        '/v1/catalog',
        'GET',
        undefined,
        undefined,
        token,
        'https://forbidden.test',
      )
    ).status,
    403,
  );
  const article = {
    articleNumber: 'A',
    manufacturer: 'ACME',
    variant: '',
    description: 'Test',
    origin: 'user',
    verification: 'unverified',
  };
  assert.equal(
    (await req('/v1/catalog', 'PUT', { articles: [article] }, 0, reader))
      .status,
    403,
  );
  assert.equal(
    (await req('/v1/catalog', 'PUT', { articles: [article] })).status,
    428,
  );
  const responses = await Promise.all([
    req('/v1/catalog', 'PUT', { articles: [article] }, 0),
    req(
      '/v1/catalog',
      'PUT',
      { articles: [{ ...article, description: 'Other' }] },
      0,
    ),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const saved = await (await req('/v1/catalog')).json();
  assert.equal(saved.revision, 1);
  assert.equal(saved.articles.length, 1);
  assert.equal(saved.user.role, 'editor');
  assert(!JSON.stringify(saved).includes(token));
  assert.equal(
    (await req('/v1/catalog', 'PUT', { articles: [article, article] }, 1))
      .status,
    400,
  );
  assert.equal((await (await req('/v1/catalog')).json()).revision, 1);
  assert.equal(
    (await (await req('/v1/history')).json()).versions[0].author,
    'editor',
  );
  assert.equal((await (await req('/v1/versions/0')).json()).articles.length, 0);
  await new Promise((resolve) => server.close(resolve));
  server = createCatalogServer(config);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  address = `http://127.0.0.1:${server.address().port}`;
  assert.equal(
    (await (await req('/v1/catalog')).json()).revision,
    1,
    'SQLite survives restart',
  );
  assert.equal(
    (await req('/v1/catalog', 'PUT', { articles: [] }, 1)).status,
    200,
  );
  assert.equal(
    (await (await req('/v1/versions/1')).json()).articles.length,
    1,
    'Older snapshots remain readable after deletion',
  );
  console.log(
    '✓ Team service: credential roles, CORS, concurrent optimistic writes, validation rollback, audit history, deletion and durable restart',
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
  rmSync(folder, { recursive: true, force: true });
}
