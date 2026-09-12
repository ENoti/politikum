import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkHttp, waitForHttp } from './check-http.mjs';

const healthy = () => Response.json({ ok: true, backend: 'java', liveMatches: true });

test('checks every public route through the specified virtual host', async () => {
  const paths = [];
  await checkHttp('http://localhost', { host: 'example.test', fetcher: async (url, options) => {
    assert.equal(options.headers.Host, 'example.test');
    paths.push(url.pathname);
    return healthy();
  } });
  assert.deepEqual(paths, ['/games/politikum', '/public/news', '/public/lobby_chat', '/public/matches_open']);
});

for (const [name, response] of [
  ['502', () => new Response('Bad gateway', { status: 502 })],
  ['SPA fallback with status 200', () => new Response('<html/>', { headers: { 'content-type': 'text/html' } })],
  ['wrong backend', () => Response.json({ ok: true, backend: 'node', liveMatches: true })],
  ['application error', () => Response.json({ ok: false })],
]) {
  test(`rejects ${name}`, async () => {
    await assert.rejects(checkHttp('http://localhost', { fetcher: async () => response() }));
  });
}

test('fails when another public route returns 502 despite a healthy health route', async () => {
  await assert.rejects(checkHttp('http://localhost', { fetcher: async (url) =>
    url.pathname === '/public/news' ? new Response('', { status: 502 }) : healthy() }));
});

test('waits through startup failures and requires consecutive successes', async () => {
  let attempts = 0;
  await waitForHttp('http://localhost', { intervalMs: 1, timeoutMs: 1000, probe: async () => {
    if ([1, 3].includes(++attempts)) throw new Error('connection refused');
  } });
  assert.equal(attempts, 6);
});

test('never reports readiness for a backend that stays down', async () => {
  await assert.rejects(waitForHttp('http://localhost', {
    intervalMs: 1, timeoutMs: 10, probe: async () => { throw new Error('HTTP 502'); },
  }), /HTTP 502/);
});
