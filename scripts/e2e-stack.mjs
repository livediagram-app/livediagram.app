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
//      rewrite `/document/*` to the single placeholder, and proxy
//      `/api/*` (WebSocket upgrades included) to the api worker so the app
//      is same-origin.
//
// Foregrounds both and stays alive; Playwright's webServer waits on the
// live port. SIGINT/SIGTERM tears the whole tree down.

import { spawn } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import {
  cpSync,
  createReadStream,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// The caching rules production's router applies (docs/specs/016-platform/stale-builds.md), run from
// the same file: type-only TypeScript, which Node runs as is.
import {
  HTML_CACHE_CONTROL,
  IMMUTABLE_CACHE_CONTROL,
  cacheRule,
  isBuildAsset,
} from '../apps/router/src/cache-policy.ts';
import { EXPLORER_LANDING_PATH } from '../apps/live/lib/explorer-landing.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// E2E_LIVE_OUT serves another export of the live app, e.g. the Clerk-enabled `.next/out-clerk-stub`
// the signed-in specs run against (apps/live/scripts/build-clerk-stub.mjs).
const OUT_DIR = path.join(ROOT, 'apps', 'live', process.env.E2E_LIVE_OUT ?? 'out');
// The builds a simulated deploy (POST /__e2e/deploy) made: copies whose chunk files carry new
// names, as a real deploy's do. Deploy n is served from deployDirs[n - 1].
const deployDirs = [];
// Production's caching, as a browser meets it (docs/specs/016-platform/stale-builds.md): Cloudflare's
// asset server marks every file `public, max-age=0, must-revalidate` with an ETag, and the router's
// caching rules then make pages `no-store` and build assets immutable. E2E_CACHE_POLICY=off serves
// without the router's rules, as production did before them.
const ASSET_SERVER_CACHE_CONTROL = 'public, max-age=0, must-revalidate';
const CACHE_POLICY = process.env.E2E_CACHE_POLICY !== 'off';
// Set by POST /__e2e/assets-out-of-cache, cleared by the next simulated deploy: build assets go out
// `no-store`, so the browser keeps a page but not its chunks, as a cache that evicted them (or never
// held a lazily loaded one) does.
//
// Both belong to the browser context that asked (a cookie each, which `page.request` shares with
// its page), never to the whole stack: the suite runs in parallel, and a deploy every test saw
// would pull chunks from under pages that never asked for one.
const DEPLOY_COOKIE = 'e2e-deploy';
const OUT_OF_CACHE_COOKIE = 'e2e-assets-out-of-cache';
function cookiesOf(req) {
  const jar = new Map();
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) jar.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
  }
  return jar;
}
// The build this request's browser context is served: its latest simulated deploy, else OUT_DIR.
function buildFor(req) {
  return deployDirs[Number(cookiesOf(req).get(DEPLOY_COOKIE)) - 1] ?? OUT_DIR;
}
function assetsOutOfCacheFor(req) {
  return cookiesOf(req).get(OUT_OF_CACHE_COOKIE) === '1';
}

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
//   E2E_CLERK_JWKS=1  act as Clerk for the signed-in specs (docs/specs/003-system-architecture/
//                    e2e-smoke.md): a key made at boot, its JWKS on /e2e/jwks.json for the api
//                    worker to verify against, and /e2e/token?sub=<id> minting a session token
//                    for any test account. Test-only: nothing outside this stack trusts the key.
const CLERK_JWKS = process.env.E2E_CLERK_JWKS === '1';
const clerkKey = CLERK_JWKS ? generateKeyPairSync('rsa', { modulusLength: 2048 }) : null;
const CLERK_KID = 'e2e-clerk-stub';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

// An RS256 session token shaped like Clerk's: sub, sid, iat / nbf / exp.
function mintClerkToken(sub) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', kid: CLERK_KID, typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({ sub, sid: `sess_${sub}`, iat: now, nbf: now - 5, exp: now + 3600 }),
  );
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), clerkKey.privateKey);
  return `${header}.${payload}.${b64url(signature)}`;
}

// Answers the two Clerk stand-in routes, or returns false for anything else.
function serveClerkStandIn(pathname, url, res) {
  if (!CLERK_JWKS) return false;
  if (pathname === '/e2e/jwks.json') {
    const jwk = clerkKey.publicKey.export({ format: 'jwk' });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ keys: [{ ...jwk, kid: CLERK_KID, alg: 'RS256', use: 'sig' }] }));
    return true;
  }
  if (pathname === '/e2e/token') {
    const sub = url.searchParams.get('sub') ?? '';
    if (!/^user_[A-Za-z0-9]+$/.test(sub)) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('sub must look like user_<id>');
      return true;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end(mintClerkToken(sub));
    return true;
  }
  return false;
}

const children = [];
function run(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
  children.push(child);
  return child;
}
function shutdown(code) {
  for (const dir of deployDirs) rmSync(dir, { recursive: true, force: true });
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

// What production sends for a response: the asset server's caching, then the router's rules.
function cacheControlFor(req, pathname, status, contentType) {
  if (assetsOutOfCacheFor(req) && isBuildAsset(pathname)) {
    return { cacheControl: 'no-store', missing: false };
  }
  if (!CACHE_POLICY) return { cacheControl: ASSET_SERVER_CACHE_CONTROL, missing: false };
  const rule = cacheRule(pathname, status, contentType);
  if (rule === 'no-store') return { cacheControl: HTML_CACHE_CONTROL, missing: false };
  if (rule === 'immutable') return { cacheControl: IMMUTABLE_CACHE_CONTROL, missing: false };
  if (rule === 'missing-asset') return { cacheControl: HTML_CACHE_CONTROL, missing: true };
  return { cacheControl: ASSET_SERVER_CACHE_CONTROL, missing: false };
}

function serveFile(req, res, filePath, pathname) {
  const ext = path.extname(filePath);
  const contentType = MIME[ext] ?? 'application/octet-stream';
  const { size, mtimeMs } = statSync(filePath);
  const etag = `W/"${size}-${Math.floor(mtimeMs)}"`;
  const headers = {
    'Content-Type': contentType,
    ETag: etag,
    'Cache-Control': cacheControlFor(req, pathname, 200, contentType).cacheControl,
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  res.writeHead(200, headers);
  createReadStream(filePath).pipe(res);
}

// A missing file: the site's HTML 404 page, as Cloudflare's `not_found_handling = "404-page"`
// answers, unless the router's rules make a missing build asset a plain-text 404.
function serveNotFound(req, res, pathname, notFoundPage) {
  const html = 'text/html; charset=utf-8';
  const { cacheControl, missing } = cacheControlFor(req, pathname, 404, html);
  if (missing || !notFoundPage || !existsSync(notFoundPage)) {
    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
    });
    res.end('Not found');
    return;
  }
  res.writeHead(404, { 'Content-Type': html, 'Cache-Control': cacheControl });
  createReadStream(notFoundPage).pipe(res);
}

// A deploy, simulated: a copy of the build a context is served whose chunk files are renamed,
// every reference to them rewritten, and the copy served to that context from now on. The old
// names are gone for it, exactly as after a real deploy, while a page the browser kept still
// names them.
const TEXT_FILES = new Set(['.html', '.txt', '.js', '.css', '.json', '.map']);
function filesUnder(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) filesUnder(p, out);
    else out.push(p);
  }
  return out;
}
function simulateDeploy(from) {
  const next = mkdtempSync(path.join(tmpdir(), 'livediagram-e2e-deploy-'));
  const n = deployDirs.push(next);
  cpSync(from, next, { recursive: true });
  const renames = new Map();
  for (const file of filesUnder(path.join(next, '_next', 'static', 'chunks'))) {
    const ext = path.extname(file);
    const name = path.basename(file);
    const renamed = `${name.slice(0, -ext.length)}-d${n}${ext}`;
    renames.set(name, renamed);
    renameSync(file, path.join(path.dirname(file), renamed));
  }
  const escaped = [...renames.keys()].map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(?<![A-Za-z0-9_-])(${escaped.join('|')})`, 'g');
  for (const file of filesUnder(next)) {
    if (!TEXT_FILES.has(path.extname(file))) continue;
    const text = readFileSync(file, 'utf8');
    const rewritten = text.replace(pattern, (m) => renames.get(m) ?? m);
    if (rewritten !== text) writeFileSync(file, rewritten);
  }
  console.log(`[e2e] simulated deploy ${n}: ${renames.size} chunks renamed, serving ${next}`);
  return n;
}

// Resolve a request path to a file in out/, mirroring the live worker
// (apps/live/src/worker.ts) + the static export's file layout.
function resolveStatic(pathname, out) {
  // The build references assets as `/live/_next/*` (assetPrefix); the
  // files live at out/_next/*.
  let p = pathname.startsWith('/live/') ? pathname.slice('/live'.length) : pathname;
  // /document and everything under it share one placeholder HTML.
  if (p === '/document' || p.startsWith('/document/')) p = '/document/placeholder';
  if (p === '/') p = '/index';
  const candidates = [
    path.join(out, p), // exact file (assets)
    path.join(out, `${p}.html`), // clean route → new.html
    path.join(out, p, 'index.html'),
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

// The realtime room is a WebSocket on /api/documents/<id>/ws. Production routes
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
    const liveOut = buildFor(req);
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
    if (serveClerkStandIn(pathname, new URL(req.url, 'http://localhost'), res)) return;
    if (pathname === '/__e2e/assets-out-of-cache' && req.method === 'POST') {
      res.writeHead(204, {
        'Cache-Control': 'no-store',
        'Set-Cookie': `${OUT_OF_CACHE_COOKIE}=1; Path=/; SameSite=Lax`,
      });
      res.end();
      return;
    }
    if (pathname === '/__e2e/deploy' && req.method === 'POST') {
      const deploy = simulateDeploy(liveOut);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Set-Cookie': [
          `${DEPLOY_COOKIE}=${deploy}; Path=/; SameSite=Lax`,
          `${OUT_OF_CACHE_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`,
        ],
      });
      res.end(JSON.stringify({ deploy }));
      return;
    }
    if (pathname === '/api' || pathname.startsWith('/api/')) return proxyApi(req, res);
    // Match the worker's /explorer → Home redirect, from the same constant.
    if (pathname === '/explorer' || pathname === '/explorer/') {
      res.writeHead(302, { Location: EXPLORER_LANDING_PATH });
      res.end();
      return;
    }
    // Cloudflare's assets layer (`html_handling` defaults to
    // "auto-trailing-slash") answers `/new/` — whose file is `new.html`, not
    // `new/index.html` — with a redirect to `/new`, query intact. Without
    // this the stack answered 404, the page recovered client-side without its
    // query string, and `?truth=1` typed on `/new/` armed nothing.
    const bare = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : null;
    if (bare && !bare.startsWith('/document') && existsSync(path.join(liveOut, `${bare}.html`))) {
      const search = new URL(req.url, 'http://localhost').search;
      res.writeHead(307, { Location: `${bare}${search}` });
      res.end();
      return;
    }
    const site = resolveSite(pathname);
    if (typeof site === 'string') return serveFile(req, res, site, pathname);
    if (site) {
      console.warn(`[e2e] ${pathname}: no build at ${site.notFound}`);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Not built: ${site.notFound}`);
      return;
    }
    const file = resolveStatic(pathname, liveOut);
    if (file) return serveFile(req, res, file, pathname);
    serveNotFound(req, res, pathname, path.join(liveOut, '404.html'));
  });
  server.on('upgrade', proxyApiUpgrade);
  server.listen(LIVE_PORT, () => console.log(`[e2e] live static server on :${LIVE_PORT}`));
  startMarketingServer();
}

// Marketing on its own port, clean routes, the same caching as production. Absent build: a logged 404.
function startMarketingServer() {
  if (!existsSync(MARKETING_DIR)) {
    console.warn(`[e2e] marketing not built (${MARKETING_DIR}); :${MARKETING_PORT} answers 404`);
  }
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const p = pathname === '/' ? '/index' : pathname.replace(/\/$/, '');
    const file = existsSync(MARKETING_DIR) ? resolveIn(MARKETING_DIR, p) : null;
    if (file) return serveFile(req, res, file, pathname);
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
      // Guest ids are signed as in production (docs/specs/014-identity/auth-and-guest-access.md), so
      // the signed-id upgrade a fresh guest goes through runs here too. A test-only secret.
      '--var',
      'GUEST_ID_HMAC_SECRET:e2e-guest-signing-secret',
      // Verify session tokens against the stack's own key (E2E_CLERK_JWKS above), never a real
      // Clerk instance a developer's .dev.vars may name.
      ...(CLERK_JWKS
        ? ['--var', `CLERK_JWKS_URL:http://127.0.0.1:${LIVE_PORT}/e2e/jwks.json`]
        : []),
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
