#!/usr/bin/env node
// E2E stack (spec/72): the two-process stack the Playwright smoke suite
// runs against — the real static `apps/live/out` build served with the
// production router/worker rewrites, plus the api worker on a local D1.
// Dependency-free (node builtins) so it adds nothing to install cost.
//
// Boots:
//   1. api — `wrangler dev --local` (apps/api) after applying the D1
//      migrations to a fresh local database, so persistence works.
//   2. live — a static file server for `out/` that reproduces the three
//      things production does (spec/72): strip the `/live` assetPrefix,
//      rewrite `/diagram/*` to the single placeholder, and proxy
//      `/api/*` to the api worker so the app is same-origin.
//
// Foregrounds both and stays alive; Playwright's webServer waits on the
// live port. SIGINT/SIGTERM tears the whole tree down.

import { spawn } from 'node:child_process';
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_DIR = path.join(ROOT, 'apps', 'api');
const OUT_DIR = path.join(ROOT, 'apps', 'live', 'out');

const LIVE_PORT = Number(process.env.E2E_LIVE_PORT ?? 3002);
const API_PORT = Number(process.env.E2E_API_PORT ?? 8787);

const children = [];
function run(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
  children.push(child);
  return child;
}
function shutdown(code) {
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {
      // best effort
    }
  }
  process.exit(code ?? 0);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    child.on('error', reject);
  });
}

async function waitForPort(port, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const req = http.request({ host: '127.0.0.1', port, method: 'HEAD', path: '/' }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.end();
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} did not come up on :${port} within ${timeoutMs}ms`);
}

// --- Static file serving with the production rewrites --------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
}

// Resolve a request path to a file in out/, mirroring the live worker
// (apps/live/src/worker.ts) + the static export's file layout.
function resolveStatic(pathname) {
  // The build references assets as `/live/_next/*` (assetPrefix); the
  // files live at out/_next/*.
  let p = pathname.startsWith('/live/') ? pathname.slice('/live'.length) : pathname;
  // /diagram and everything under it share one placeholder HTML.
  if (p === '/diagram' || p.startsWith('/diagram/')) p = '/diagram/placeholder';
  if (p === '/') p = '/index';
  const candidates = [
    path.join(OUT_DIR, p), // exact file (assets)
    path.join(OUT_DIR, `${p}.html`), // clean route → new.html
    path.join(OUT_DIR, p, 'index.html'),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

function proxyApi(req, res) {
  const proxyReq = http.request(
    { host: '127.0.0.1', port: API_PORT, method: req.method, path: req.url, headers: req.headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'api_unreachable' }));
  });
  req.pipe(proxyReq);
}

function startLiveServer() {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/api' || pathname.startsWith('/api/')) return proxyApi(req, res);
    // Match the worker's /explorer → /explorer/recent redirect.
    if (pathname === '/explorer' || pathname === '/explorer/') {
      res.writeHead(302, { Location: '/explorer/recent' });
      res.end();
      return;
    }
    const file = resolveStatic(pathname);
    if (file) return serveFile(res, file);
    const notFound = path.join(OUT_DIR, '404.html');
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    if (existsSync(notFound)) createReadStream(notFound).pipe(res);
    else res.end('Not found');
  });
  server.listen(LIVE_PORT, () => console.log(`[e2e] live static server on :${LIVE_PORT}`));
}

// --- Boot ---------------------------------------------------------------
async function main() {
  if (!existsSync(OUT_DIR)) {
    console.error(`[e2e] ${OUT_DIR} missing — run \`pnpm --filter @livediagram/live build\` first`);
    process.exit(1);
  }
  console.log('[e2e] applying local D1 migrations…');
  await waitForExit(
    run('pnpm', ['--filter', '@livediagram/api', 'run', 'db:migrate:local'], { cwd: ROOT }),
  );
  console.log('[e2e] starting api worker…');
  run(
    'pnpm',
    [
      '--filter',
      '@livediagram/api',
      'exec',
      'wrangler',
      'dev',
      '--local',
      '--port',
      String(API_PORT),
    ],
    {
      cwd: ROOT,
    },
  );
  await waitForPort(API_PORT, 'api worker');
  console.log('[e2e] api worker up; starting live static server…');
  startLiveServer();
}

main().catch((err) => {
  console.error('[e2e] stack failed:', err);
  shutdown(1);
});
