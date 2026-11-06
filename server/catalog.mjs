import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateCatalogArticle,
  catalogKey,
} from '../src/shared/catalog-record.mjs';
export const tokenHash = (token) =>
  createHash('sha256').update(token).digest('hex');
export function createCatalogServer(config) {
  if (
    !config.teamId ||
    !Array.isArray(config.users) ||
    !config.users.length ||
    config.users.some(
      (u) =>
        !u.id ||
        !['reader', 'editor', 'admin'].includes(u.role) ||
        !/^[a-f0-9]{64}$/.test(u.tokenHash),
    ) ||
    new Set(config.users.map((u) => u.id)).size !== config.users.length ||
    new Set(config.users.map((u) => u.tokenHash)).size !== config.users.length
  )
    throw new Error('Invalid catalog service configuration');
  const path = resolve(config.database);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  chmodSync(path, 0o600);
  db.exec(
    'PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS versions (revision INTEGER PRIMARY KEY, author TEXT NOT NULL, created TEXT NOT NULL, articles TEXT NOT NULL);',
  );
  if (!db.prepare('SELECT revision FROM versions LIMIT 1').get())
    db.prepare('INSERT INTO versions VALUES (0, ?, ?, ?)').run(
      'system',
      new Date().toISOString(),
      '[]',
    );
  const latest = () =>
    db.prepare('SELECT * FROM versions ORDER BY revision DESC LIMIT 1').get();
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const origin = req.headers.origin;
    if (origin) {
      if (!(config.allowedOrigins ?? []).includes(origin)) {
        res.writeHead(403);
        res.end();
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    if (req.method === 'OPTIONS') {
      if(origin&&req.headers['access-control-request-private-network']==='true')res.setHeader('Access-Control-Allow-Private-Network','true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type, If-Match',
      );
      res.writeHead(204);
      res.end();
      return;
    }
    const authorization = req.headers.authorization ?? '',
      provided = tokenHash(
        authorization.startsWith('Bearer ') ? authorization.slice(7) : '',
      );
    const user = config.users.find((u) =>
      timingSafeEqual(
        Buffer.from(u.tokenHash, 'hex'),
        Buffer.from(provided, 'hex'),
      ),
    );
    if (!user) {
      send(401, { error: 'teamUnauthorized' });
      return;
    }
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/v1/catalog') {
        const current = latest();
        send(200, {
          schema: 'schematico-team-catalog',
          version: 1,
          teamId: config.teamId,
          user: { id: user.id, role: user.role },
          revision: current.revision,
          articles: JSON.parse(current.articles),
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/v1/history') {
        const rows = db
          .prepare(
            'SELECT revision,author,created FROM versions ORDER BY revision DESC LIMIT 100',
          )
          .all();
        send(200, { teamId: config.teamId, versions: rows });
        return;
      }
      if (req.method === 'GET' && /^\/v1\/versions\/\d+$/.test(url.pathname)) {
        const row = db
          .prepare('SELECT * FROM versions WHERE revision=?')
          .get(Number(url.pathname.split('/').pop()));
        if (!row) {
          send(404, { error: 'teamNotFound' });
          return;
        }
        send(200, {
          teamId: config.teamId,
          revision: row.revision,
          author: row.author,
          created: row.created,
          articles: JSON.parse(row.articles),
        });
        return;
      }
      if (req.method === 'PUT' && url.pathname === '/v1/catalog') {
        if (user.role === 'reader') {
          send(403, { error: 'teamReadOnly' });
          return;
        }
        const match = req.headers['if-match'];
        if (typeof match !== 'string' || !/^"?\d+"?$/.test(match)) {
          send(428, { error: 'teamRevisionRequired' });
          return;
        }
        if (!req.headers['content-type']?.startsWith('application/json')) {
          send(415, { error: 'teamInvalid' });
          return;
        }
        let size = 0,
          chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 20 * 1024 * 1024) {
            send(413, { error: 'teamInvalid' });
            return;
          }
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!Array.isArray(body.articles) || body.articles.length > 10000) {
          send(400, { error: 'teamInvalid' });
          return;
        }
        const articles = body.articles.map(validateCatalogArticle);
        if (new Set(articles.map(catalogKey)).size !== articles.length) {
          send(400, { error: 'teamInvalid' });
          return;
        }
        db.exec('BEGIN IMMEDIATE');
        try {
          const current = latest();
          if (Number(match.replaceAll('"', '')) !== current.revision) {
            db.exec('ROLLBACK');
            send(409, { error: 'teamStale' });
            return;
          }
          const revision = current.revision + 1;
          db.prepare('INSERT INTO versions VALUES (?,?,?,?)').run(
            revision,
            user.id,
            new Date().toISOString(),
            JSON.stringify(articles),
          );
          db.exec('COMMIT');
          send(200, {
            schema: 'schematico-team-catalog',
            version: 1,
            teamId: config.teamId,
            user: { id: user.id, role: user.role },
            revision,
            articles,
          });
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
        return;
      }
      send(404, { error: 'teamNotFound' });
    } catch (e) {
      send(
        e instanceof SyntaxError || e.message === 'articlesCatalogInvalid'
          ? 400
          : 500,
        {
          error:
            e instanceof SyntaxError || e.message === 'articlesCatalogInvalid'
              ? 'teamInvalid'
              : 'teamServerError',
        },
      );
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  server.on('close', () => db.close());
  return server;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const path = process.env.SCHEMATICO_CATALOG_CONFIG;
  if (!path)
    throw new Error(
      'Set SCHEMATICO_CATALOG_CONFIG to the private service configuration file',
    );
  const config = JSON.parse(readFileSync(path, 'utf8'));
  createCatalogServer(config).listen(
    config.port ?? 4785,
    config.host ?? '127.0.0.1',
    () => process.stdout.write('Schematico catalog service ready\n'),
  );
}
