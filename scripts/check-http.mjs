import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const endpoints = ['/games/politikum', '/public/news', '/public/lobby_chat', '/public/matches_open'];

export async function checkHttp(base, { fetcher = fetch, host } = {}) {
  for (const endpoint of endpoints) {
    const response = await fetcher(new URL(endpoint, base), {
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
      headers: { Accept: 'application/json', ...(host ? { Host: host } : {}) },
    });
    if (response.status !== 200) throw new Error(`${endpoint}: HTTP ${response.status}`);
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error(`${endpoint}: expected JSON, got another content type`);
    }
    const json = await response.json();
    if (json.ok !== true) throw new Error(`${endpoint}: ok is not true`);
    if (endpoint === '/games/politikum' && (json.backend !== 'java' || json.liveMatches !== true)) {
      throw new Error(`${endpoint}: unexpected backend response`);
    }
  }
}

export async function waitForHttp(base, { timeoutMs = 90000, intervalMs = 2000, probe = checkHttp, host } = {}) {
  const deadline = Date.now() + timeoutMs;
  let consecutive = 0;
  let lastError = 'not ready';
  do {
    try {
      await probe(base, { host });
      if (++consecutive === 3) return;
    } catch (error) {
      consecutive = 0;
      lastError = error.message;
    }
    if (Date.now() >= deadline) break;
    await sleep(Math.min(intervalMs, deadline - Date.now()));
  } while (Date.now() < deadline);
  throw new Error(`HTTP readiness failed for ${base}: ${lastError} (need 3 consecutive healthy checks)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const bases = process.argv.slice(2);
    if (!bases.length) throw new Error('Usage: node scripts/check-http.mjs URL [URL ...]');
    for (const base of bases) {
      await waitForHttp(base, { host: process.env.PROBE_HOST });
      console.log(`HTTP ready: ${base}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
