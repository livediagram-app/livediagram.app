// The e2e stacks' static serving (livediagram's and livehuddle's scripts/e2e-stack.mjs, their
// docs/specs/016-platform/stale-builds.md): files served with production's caching and its Trusted Types header, the
// 404 page, and a simulated deploy per browser context. Dependency-free (node builtins), as the stacks are.

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
import path from 'node:path';
// The caching rules production's router applies (docs/specs/016-platform/stale-builds.md), run from
// the same file: type-only TypeScript, which Node runs as is.
import {
  HTML_CACHE_CONTROL,
  IMMUTABLE_CACHE_CONTROL,
  cacheRule,
  isBuildAsset,
} from '../../packages/sites/src/cache-policy.ts';
import { onShutdown } from './processes.mjs';

// `outDir` is the build a browser context is served until it asks for a deploy, `csp` the Trusted Types header
// every page goes out with, and `product` names the deploys' temporary copies.
export function createStaticServing({ outDir, csp, product }) {
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
    return deployDirs[Number(cookiesOf(req).get(DEPLOY_COOKIE)) - 1] ?? outDir;
  }
  function assetsOutOfCacheFor(req) {
    return cookiesOf(req).get(OUT_OF_CACHE_COOKIE) === '1';
  }

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
      ...(contentType.startsWith('text/html') ? { 'Content-Security-Policy': csp } : {}),
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
    res.writeHead(404, {
      'Content-Type': html,
      'Cache-Control': cacheControl,
      'Content-Security-Policy': csp,
    });
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
    const next = mkdtempSync(path.join(tmpdir(), `${product}-e2e-deploy-`));
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

  onShutdown(() => {
    for (const dir of deployDirs) rmSync(dir, { recursive: true, force: true });
  });

  // The suite's controls (POST /__e2e/assets-out-of-cache and /__e2e/deploy), answered for the browser context that
  // asked; false for any other request.
  function serveE2eControls(req, res, pathname, liveOut) {
    if (pathname === '/__e2e/assets-out-of-cache' && req.method === 'POST') {
      res.writeHead(204, {
        'Cache-Control': 'no-store',
        'Set-Cookie': `${OUT_OF_CACHE_COOKIE}=1; Path=/; SameSite=Lax`,
      });
      res.end();
      return true;
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
      return true;
    }
    return false;
  }

  return { buildFor, cacheControlFor, serveFile, serveNotFound, resolveIn, serveE2eControls };
}
