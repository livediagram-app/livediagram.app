#!/usr/bin/env node
// E2E stack (docs/specs/003-system-architecture/e2e-smoke.md): the two-process stack the Playwright smoke suite
// runs against — the real static `apps/live/out` build served with the
// production router/worker rewrites, plus the api worker on a local D1.
// Dependency-free (node builtins) so it adds nothing to install cost.
//
// Boots:
//   1. api — `wrangler dev --local` (apps/api) after applying the D1
//      migrations to a fresh local database, so persistence works.
//   2. live — a static file server for `out/` that reproduces the three
//      things production does (docs/specs/003-system-architecture/e2e-smoke.md): strip the `/live` assetPrefix,
//      rewrite `/diagram/*` to the single placeholder, and proxy
//      `/api/*` (WebSocket upgrades included) to the api worker so the app
//      is same-origin.
//
// Foregrounds both and stays alive; Playwright's webServer waits on the
// live port. SIGINT/SIGTERM tears the whole tree down.

import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'apps', 'live', 'out');

const LIVE_PORT = Number(process.env.E2E_LIVE_PORT ?? 3002);
const API_PORT = Number(process.env.E2E_API_PORT ?? 8787);
// The other sites, for the audits that open them (docs/specs/004-interface-design/blueprints/
// optical-alignment.md, "Ink audit"). Help and telemetry sit under their basePath on the live
// origin, as the router mounts them; marketing owns "/" in production, so it gets its own port.
const SITES = [
  { prefix: '/help', dir: path.join(ROOT, 'apps', 'help', 'out') },
  { prefix: '/telemetry', dir: path.join(ROOT, 'apps', 'telemetry', 'out') },
];
const MARKETING_DIR = path.join(ROOT, 'apps', 'marketing', 'out');
const MARKETING_PORT = Number(process.env.E2E_MARKETING_PORT ?? 3013);
// Two switches for trying the editor as a DIFFERENT deployment would run it,
// beside a stack that is already up:
//   E2E_LIVE_ONLY=1  serve the static editor only, proxying to the api
//                    already listening on E2E_API_PORT (no second worker).
//   E2E_NO_AI=1      answer /api/capabilities with aiEnabled: false, as a
//                    deployment with no AI key does — so the photo import
//                    reads with the in-browser model.
//   E2E_AI_BUDGET_SPENT=1  answer /api/ai/read-notes with 429 `ai_quota`, as a
//                    hosted reader whose free budget is spent does — so the
//                    photo import fails over to the in-browser model.
const LIVE_ONLY = process.env.E2E_LIVE_ONLY === '1';
const NO_AI = process.env.E2E_NO_AI === '1';
const AI_BUDGET_SPENT = process.env.E2E_AI_BUDGET_SPENT === '1';
//   E2E_DRIVE=1      the Google Drive mirror e2e (docs/specs/022-drive-mirror/blueprints/
//                    drive-mirror.md, "Testing"): the api worker verifies JWTs
//                    against the JWKS the test serves (E2E_DRIVE_JWKS_PORT) and
//                    talks OAuth to the fake Google the test serves
//                    (E2E_DRIVE_GOOGLE_PORT). Test values only; the live build
//                    must carry NEXT_PUBLIC_E2E_AUTH=1.
const DRIVE = process.env.E2E_DRIVE === '1';
const DRIVE_JWKS_PORT = Number(process.env.E2E_DRIVE_JWKS_PORT ?? 8795);
const DRIVE_GOOGLE_PORT = Number(process.env.E2E_DRIVE_GOOGLE_PORT ?? 8796);
const DRIVE_E2E_VARS = {
  CLERK_JWKS_URL: `http://127.0.0.1:${DRIVE_JWKS_PORT}/jwks.json`,
  GOOGLE_CLIENT_ID: '123456789012-e2e.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'e2e-client-secret',
  DRIVE_TOKEN_KEY: Buffer.alloc(32, 7).toString('base64'),
  GOOGLE_OAUTH_BASE_URL: `http://127.0.0.1:${DRIVE_GOOGLE_PORT}`,
};

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
  // Cloudflare serves it so; streaming compilation needs it.
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    // NEVER let a browser hold on to this build. The HTML names the hashed
    // JS chunks, so a cached page keeps running the code it was built with —
    // and a tab left open across a rebuild then shows behaviour that no
    // longer exists in the repo, which is indistinguishable from the fix not
    // working. Costs nothing here: this server exists for e2e and review.
    'Cache-Control': 'no-store, must-revalidate',
  });
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

// A basePath site's file for a request under its prefix, or null. A missing build is not an
// error here: only the audits need these sites, and they fail loudly on the 404.
function resolveSite(pathname) {
  for (const site of SITES) {
    if (pathname !== site.prefix && !pathname.startsWith(`${site.prefix}/`)) continue;
    const p = pathname.slice(site.prefix.length) || '/';
    return resolveIn(site.dir, p === '/' ? '/index' : p) ?? { notFound: site.dir };
  }
  return null;
}

// A clean-route static file in `dir`: the exact file, `<p>.html`, or `<p>/index.html`.
function resolveIn(dir, p) {
  for (const c of [
    path.join(dir, p),
    path.join(dir, `${p}.html`),
    path.join(dir, p, 'index.html'),
  ]) {
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

// The realtime room is a WebSocket on /api/diagrams/<id>/ws. Production routes
// the upgrade through the router like any other /api request; without this the
// browser's socket was never answered here, so no e2e test could see a room op.
// Relays the raw upgrade to the api worker and pipes both directions.
function proxyApiUpgrade(req, socket, head) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (!pathname.startsWith('/api/')) {
    socket.destroy();
    return;
  }
  const upstream = net.connect(API_PORT, '127.0.0.1', () => {
    const headerLines = [];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      headerLines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    }
    upstream.write(
      `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headerLines.join('\r\n')}\r\n\r\n`,
    );
    if (head.length > 0) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
}

function startLiveServer() {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (NO_AI && pathname === '/api/capabilities') {
      // Everything else about the real answer stands; only the AI is off.
      http
        .get({ host: '127.0.0.1', port: API_PORT, path: '/api/capabilities' }, (up) => {
          let body = '';
          up.on('data', (c) => (body += c));
          up.on('end', () => {
            let caps = {};
            try {
              caps = JSON.parse(body);
            } catch {
              /* the api answered something else: report AI off regardless */
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ...caps, aiEnabled: false }));
          });
        })
        .on('error', () => {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'api_unreachable' }));
        });
      return;
    }
    if (AI_BUDGET_SPENT && pathname === '/api/ai/read-notes') {
      // Drain the body first, as a real server would, then refuse for quota.
      req.resume();
      req.on('end', () => {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'ai_quota' }));
      });
      return;
    }
    if (pathname === '/api' || pathname.startsWith('/api/')) return proxyApi(req, res);
    // Match the worker's /explorer → /explorer/recent redirect.
    if (pathname === '/explorer' || pathname === '/explorer/') {
      res.writeHead(302, { Location: '/explorer/recent' });
      res.end();
      return;
    }
    // Cloudflare's assets layer (`html_handling` defaults to
    // "auto-trailing-slash") answers `/new/` — whose file is `new.html`, not
    // `new/index.html` — with a redirect to `/new`, query intact. Without
    // this the stack answered 404, the page recovered client-side without its
    // query string, and `?truth=1` typed on `/new/` armed nothing.
    const bare = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : null;
    if (bare && !bare.startsWith('/diagram') && existsSync(path.join(OUT_DIR, `${bare}.html`))) {
      const search = new URL(req.url, 'http://localhost').search;
      res.writeHead(307, { Location: `${bare}${search}` });
      res.end();
      return;
    }
    const site = resolveSite(pathname);
    if (typeof site === 'string') return serveFile(res, site);
    if (site) {
      console.warn(`[e2e] ${pathname}: no build at ${site.notFound}`);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Not built: ${site.notFound}`);
      return;
    }
    const file = resolveStatic(pathname);
    if (file) return serveFile(res, file);
    const notFound = path.join(OUT_DIR, '404.html');
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    if (existsSync(notFound)) createReadStream(notFound).pipe(res);
    else res.end('Not found');
  });
  server.on('upgrade', proxyApiUpgrade);
  server.listen(LIVE_PORT, () => console.log(`[e2e] live static server on :${LIVE_PORT}`));
  startMarketingServer();
}

// Marketing on its own port, clean routes, same no-store rule. Absent build: a logged 404.
function startMarketingServer() {
  if (!existsSync(MARKETING_DIR)) {
    console.warn(`[e2e] marketing not built (${MARKETING_DIR}); :${MARKETING_PORT} answers 404`);
  }
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const p = pathname === '/' ? '/index' : pathname.replace(/\/$/, '');
    const file = existsSync(MARKETING_DIR) ? resolveIn(MARKETING_DIR, p) : null;
    if (file) return serveFile(res, file);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(existsSync(MARKETING_DIR) ? 'Not found' : `Not built: ${MARKETING_DIR}`);
  });
  server.listen(MARKETING_PORT, () =>
    console.log(`[e2e] marketing static server on :${MARKETING_PORT}`),
  );
}

// --- Boot ---------------------------------------------------------------
async function main() {
  if (!existsSync(OUT_DIR)) {
    console.error(`[e2e] ${OUT_DIR} missing — run \`pnpm --filter @livediagram/live build\` first`);
    process.exit(1);
  }
  if (LIVE_ONLY) {
    console.log(
      `[e2e] static editor only, proxying to the api on :${API_PORT}${NO_AI ? ', AI reported off' : ''}${AI_BUDGET_SPENT ? ', AI budget spent' : ''}`,
    );
    startLiveServer();
    return;
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
      // Production's origin allow-list lives in wrangler.toml [vars], which
      // `wrangler dev` reads too; it would 403 every AI call from this
      // localhost editor. Blank it, as `pnpm dev` does (docs/specs/007-editor/ai-assistance.md).
      '--var',
      'AI_ALLOWED_ORIGINS:',
      ...(DRIVE ? Object.entries(DRIVE_E2E_VARS).flatMap(([k, v]) => ['--var', `${k}:${v}`]) : []),
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
