import {
  validatePublicArticle,
  MAX_SUBMISSION_BYTES,
  validatePublicSymbol,
  MAX_SYMBOL_SUBMISSION_BYTES,
} from '../../src/shared/catalog-publication.mjs';
const REPOSITORY = 'vitals5/schematico';
const EVENT = 'schematico.article.submitted';
const digest = async (text) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
const json = (value, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
async function readRequest(request) {
  if (!request.body) throw Error('invalid_article');
  const reader = request.body.getReader(),
    parts = [];
  let size = 0;
  const maxAllowed = MAX_SUBMISSION_BYTES + MAX_SYMBOL_SUBMISSION_BYTES + 8192;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxAllowed) {
        await reader.cancel();
        throw Error('invalid_article');
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    bytes.set(part, at);
    at += part.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url),
      origin = request.headers.get('Origin') ?? '';
    const allowed = (env.ALLOWED_ORIGINS ?? 'https://vitals5.github.io')
      .split(',')
      .map((v) => v.trim());
    const headers = allowed.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
      : {};
    if (url.pathname === '/health' && request.method === 'GET')
      return json(
        {
          service: 'schematico-catalog-submissions',
          configured: !!(
            env.GITHUB_DISPATCH_TOKEN &&
            env.TURNSTILE_SECRET &&
            env.SUBMISSION_LIMITER
          ),
        },
        200,
        headers,
      );
    if (url.pathname !== '/submit')
      return json({ error: 'not_found' }, 404, headers);
    if (!allowed.includes(origin))
      return json({ error: 'origin_not_allowed' }, 403);
    if (request.method === 'OPTIONS')
      return new Response(null, {
        status: 204,
        headers: {
          ...headers,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '600',
        },
      });
    if (request.method !== 'POST')
      return json({ error: 'method_not_allowed' }, 405, headers);
    if (
      !env.GITHUB_DISPATCH_TOKEN ||
      !env.TURNSTILE_SECRET ||
      !env.SUBMISSION_LIMITER
    )
      return json({ error: 'service_not_configured' }, 503, headers);
    if (
      !request.headers
        .get('Content-Type')
        ?.toLowerCase()
        .startsWith('application/json')
    )
      return json({ error: 'invalid_article' }, 400, headers);
    try {
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip) return json({ error: 'client_unavailable' }, 400, headers);
      const limit = await env.SUBMISSION_LIMITER.limit({
        key: await digest(ip),
      });
      if (!limit.success)
        return json({ error: 'rate_limited' }, 429, {
          ...headers,
          'Retry-After': '60',
        });
      const input = await readRequest(request),
        article = validatePublicArticle(input.article),
        symbol = input.symbol ? validatePublicSymbol(input.symbol) : undefined;
      if (
        typeof input.challengeToken !== 'string' ||
        !input.challengeToken ||
        input.challengeToken.length > 4096
      )
        return json({ error: 'challenge_failed' }, 403, headers);
      const verified = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          body: new URLSearchParams({
            secret: env.TURNSTILE_SECRET,
            response: input.challengeToken,
            remoteip: ip,
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      const challenge = await verified.json();
      if (
        !verified.ok ||
        challenge.success !== true ||
        challenge.action !== 'catalog-submit'
      )
        return json({ error: 'challenge_failed' }, 403, headers);
      const expectedHost = origin === 'null' ? null : new URL(origin).hostname;
      if (expectedHost && challenge.hostname !== expectedHost)
        return json({ error: 'challenge_failed' }, 403, headers);
      const submissionId = await digest(JSON.stringify(article));
      const dispatched = await fetch(
        `https://api.github.com/repos/${REPOSITORY}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'Schematico-Catalog',
          },
          body: JSON.stringify({
            event_type: EVENT,
            client_payload: {
              article,
              ...(symbol ? { symbol } : {}),
              submissionId,
            },
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (dispatched.status !== 204)
        return json({ error: 'dispatch_unavailable' }, 502, headers);
      return json({ status: 'submitted', submissionId }, 202, headers);
    } catch (error) {
      const invalid =
        error instanceof SyntaxError ||
        [
          'invalid_article',
          'articlesCatalogInvalid',
          'githubCatalogInvalid',
        ].includes(error?.message);
      return json(
        { error: invalid ? 'invalid_article' : 'service_unavailable' },
        invalid ? 400 : 503,
        headers,
      );
    }
  },
};
