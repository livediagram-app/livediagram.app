// The e2e stack every product's Playwright suite runs against (each product's scripts/e2e-stack.mjs and its
// docs/specs/003-system-architecture/e2e-smoke.md), booted from that product's few settings: the real static build
// served with the production router/worker rewrites, the api worker on local Durable Objects, liveworkspace's index
// (liveworkspace/apps/index, liveworkspace/docs/specs/004-index/one-explorer.md) on its own local D1 and, where the
// product runs it, liveworkspace's media service. Dependency-free (node builtins), so it adds nothing to install cost.
//
// Boots:
//   1. index: `wrangler dev --local` (liveworkspace/apps/index) on the stack's index port, its D1 kept apart from a
//      developer's own local index, trusting this stack's accounts stand-in and calling this api.
//   2. media (`media` set): liveworkspace's media service (liveworkspace/apps/media, its scripts/e2e-media.mjs) under
//      `wrangler dev --local`, its D1 and R2 fresh each run, so uploads and the gallery run end to end.
//   3. api: `wrangler dev --local` (the product's apps/api), its Durable Objects in wrangler's local storage.
//   4. live: a static file server for the build that reproduces what production does
//      (docs/specs/003-system-architecture/e2e-smoke.md): strip the `/live` assetPrefix, rewrite each canvas route to
//      its single placeholder, forward `/api/index/*` to the index (and `/api/previews/*` to media), serve
//      liveworkspace's Explorer when its site is built, and proxy the rest of `/api/*` (WebSocket upgrades included)
//      to the api worker so the app is same-origin. Marketing gets a port of its own.
//
// Foregrounds them all and stays alive; Playwright's webServer waits on the live port. SIGINT/SIGTERM tears the
// whole tree down.

import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAccountsStandIn } from './accounts-stand-in.mjs';
import { run, shutdown, waitForExit, waitForPort } from './processes.mjs';
import { createProxies } from './proxies.mjs';
import { createStaticServing } from './static-serving.mjs';

// The key the api and the index share (the api's INDEX_KEY, the index's INDEX_KEY_<PRODUCT>). Test-only.
const INDEX_KEY = 'e2e-index-key';
// Accounts' key at the index (its MERGE_KEY): what the index's "teams as they are now" call carries to the
// stand-in (POST /api/account/index/teams). Test-only.
const MERGE_KEY = 'e2e-merge-key';

/**
 * Boot a product's stack. Settings, each the product's own:
 * - `product` ('livediagram'), `root` (its folder), `appPackage` and `apiPackage` (its live app's and api's package
 *   names), `outDir` (the build to serve) and `csp` (the Trusted Types header every page goes out with);
 * - `ports`: `editor`, `api`, `apiInspector`, `index`, `indexInspector`, `marketing`;
 * - `apiResource` (the api's audience), `clientId` (its accounts client) and `accountsRecords` (whether the stand-in
 *   keeps teams and settings for the specs to seed, ./accounts-stand-in.mjs);
 * - `placeholders`: the canvas routes whose every path shares one placeholder page (the first is the product's own
 *   canvas, which a trailing slash never redirects off), and `workspaceFrame` ({ isPath, page }) where the editor
 *   serves its workspace frames;
 * - `workspace`: the paths liveworkspace's site answers on this origin (the Explorer, the Community), `appMeta` to name
 *   the app on its pages; absent where the product shows none;
 * - `media` ({ port, inspectorPort, app }) where the stack runs liveworkspace's media service;
 * - `editorOnly` (serve the static editor only, beside an api already up) and `editorOnlyNote` (said with it);
 * - `routes(req, res, pathname)`: the product's own answers, asked first (true when it answered);
 * - `apiVars`: the product's own `KEY:value` vars for the api, beside the stack's.
 */
export function runE2EStack(settings) {
  const { product, root, outDir, csp, ports, apiResource } = settings;
  const EDITOR_PORT = ports.editor;
  const API_PORT = ports.api;
  const INDEX_PORT = ports.index;
  const MARKETING_PORT = ports.marketing;
  const UPPER = product.toUpperCase();

  // Served with production's caching and Trusted Types header, and a simulated deploy per browser context.
  const { buildFor, cacheControlFor, serveFile, serveNotFound, resolveIn, serveE2eControls } =
    createStaticServing({ outDir, csp, product });

  const INDEX_DIR = path.resolve(root, '..', 'liveworkspace', 'apps', 'index');
  // The index's local D1 for this stack, apart from a developer's `wrangler dev` state.
  const INDEX_STATE = path.join(INDEX_DIR, '.wrangler', 'e2e-state');

  // liveworkspace's site, whose Explorer production serves at the product's own /explorer (the router's
  // routeToWorkspace, @liveworkspace/sites/workspace-proxy): its static export, when built. E2E_WORKSPACE_SITE_OUT
  // serves another export of it: the signed-in specs' `.next/out-e2e` (liveworkspace/apps/site/scripts/build-e2e.mjs),
  // which reads the specs' session as the editor's signed-in build does.
  const WORKSPACE_SITE_DIR = path.resolve(
    root,
    '..',
    'liveworkspace',
    'apps',
    'site',
    process.env.E2E_WORKSPACE_SITE_OUT ?? 'out',
  );

  // The other sites, for the audits that open them (docs/specs/004-interface-design/blueprints/
  // optical-alignment.md, "Ink audit"). Help sits under its basePath on the live origin, as the router mounts it;
  // marketing owns "/" in production, so it gets its own port.
  const SITES = [{ prefix: '/help', dir: path.join(root, 'apps', 'help', 'out') }];
  const MARKETING_DIR = path.join(root, 'apps', 'marketing', 'out');

  //   E2E_WORKBENCH=1  the workbench embed e2e (docs/specs/013-workspace/blueprints/workbench-embeds.md,
  //                    "Testing"): the api builds its workbench and pairing URLs on this live origin
  //                    (APP_BASE_URL). The live build must carry NEXT_PUBLIC_E2E_AUTH=1.
  const WORKBENCH = settings.workbench === true && process.env.E2E_WORKBENCH === '1';

  // The accounts stand-in (./accounts-stand-in.mjs): the origin the api and the index both trust, on this live
  // origin, and the client the api is started with.
  const { ACCOUNTS_ORIGIN, ACCOUNTS_CLIENT, serveAccountsStandIn } = createAccountsStandIn({
    editorPort: EDITOR_PORT,
    apiResource,
    clientId: settings.clientId,
    mergeKey: MERGE_KEY,
    records: settings.accountsRecords,
  });
  const { proxyApi, proxyApiUpgrade } = createProxies({
    apiPort: API_PORT,
    indexPort: INDEX_PORT,
    mediaPort: settings.media?.port,
  });

  const [canvasRoute] = settings.placeholders;

  // Resolve a request path to a file in the build, mirroring the editor worker (apps/<app>/src/worker.ts) and the
  // static export's file layout.
  function resolveStatic(pathname, out) {
    // The build references assets as `/live/_next/*` (assetPrefix); the files live at out/_next/*.
    let p = pathname.startsWith('/live/') ? pathname.slice('/live'.length) : pathname;
    // The canvas route and everything under it share one placeholder HTML, and so does every form link,
    // /form/<code> (apps/<app>/lib/form-path.ts, as the editor worker rewrites it).
    for (const route of settings.placeholders) {
      if (p === route || p.startsWith(`${route}/`)) {
        p = `${route}/placeholder`;
        break;
      }
    }
    // So does every place inside a workspace frame, as the editor worker serves them (lib/workbench/workbench-frame-path.ts).
    if (settings.workspaceFrame?.isPath(p)) p = settings.workspaceFrame.page;
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

  // The router's routeToWorkspace (@liveworkspace/sites/workspace-proxy): liveworkspace's pages (the Explorer, and
  // where the product shows it the Community), shown at the product's own paths with the address unchanged, their
  // build assets under /_liveworkspace. Served from the site's static export when it is built; otherwise a logged
  // 404, so only the specs that open those pages need the build.
  const workspacePaths = settings.workspace?.paths ?? [];
  const isWorkspacePath = (pathname) =>
    workspacePaths.length > 0 &&
    (workspacePaths.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
      pathname.startsWith('/_liveworkspace/'));

  function serveWorkspace(req, res, pathname) {
    if (!existsSync(WORKSPACE_SITE_DIR)) {
      console.warn(`[e2e] ${pathname}: liveworkspace's site is not built (${WORKSPACE_SITE_DIR})`);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Not built: ${WORKSPACE_SITE_DIR}`);
      return;
    }
    // The export's own layout: each Explorer view a page of its own, its assets under out/_liveworkspace.
    const p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    const file = resolveIn(WORKSPACE_SITE_DIR, p);
    if (file && settings.workspace.appMeta && path.extname(file) === '.html')
      return serveWorkspacePage(req, res, file, pathname);
    if (file) return serveFile(req, res, file, pathname);
    serveNotFound(req, res, pathname, path.join(WORKSPACE_SITE_DIR, '404.html'));
  }

  // An Explorer page names the app it is shown for (liveworkspace/docs/specs/004-index/one-explorer.md "The Explorer
  // on each app's address"): locally the page otherwise reads the app from the port's block, and this stack runs on
  // whatever ports it is given (an agent's block, a CI runner's), so it says the app outright.
  function serveWorkspacePage(req, res, filePath, pathname) {
    const meta = `<meta name="liveworkspace-app" content="${settings.workspace.appMeta}">`;
    const html = readFileSync(filePath, 'utf8').replace(/<head>/i, `<head>${meta}`);
    const { size, mtimeMs } = statSync(filePath);
    const etag = `W/"${size}-${Math.floor(mtimeMs)}-app"`;
    const headers = {
      'Content-Type': 'text/html; charset=utf-8',
      ETag: etag,
      'Cache-Control': cacheControlFor(req, pathname, 200, 'text/html; charset=utf-8').cacheControl,
      'Content-Security-Policy': csp,
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    res.writeHead(200, headers);
    res.end(html);
  }

  function startLiveServer() {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const liveOut = buildFor(req);
      if (settings.routes?.(req, res, pathname)) return;
      if (serveAccountsStandIn(req, pathname, new URL(req.url, 'http://localhost'), res)) return;
      if (serveE2eControls(req, res, pathname, liveOut)) return;
      if (pathname === '/api' || pathname.startsWith('/api/')) return proxyApi(req, res);
      if (isWorkspacePath(pathname)) return serveWorkspace(req, res, pathname);
      // Cloudflare's assets layer (`html_handling` defaults to "auto-trailing-slash") answers `/new/`, whose file is
      // `new.html`, not `new/index.html`, with a redirect to `/new`, query intact. Without this the stack answered
      // 404, the page recovered client-side without its query string, and `?truth=1` typed on `/new/` armed nothing.
      const bare = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : null;
      if (bare && !bare.startsWith(canvasRoute) && existsSync(path.join(liveOut, `${bare}.html`))) {
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
    server.listen(EDITOR_PORT, () => console.log(`[e2e] live static server on :${EDITOR_PORT}`));
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

  // The index, migrated fresh, then started trusting and calling only this stack.
  async function startIndex() {
    console.log('[e2e] applying the index local D1 migrations…');
    rmSync(INDEX_STATE, { recursive: true, force: true });
    await waitForExit(
      run(
        'pnpm',
        [
          'exec',
          'wrangler',
          'd1',
          'migrations',
          'apply',
          'liveworkspace-index',
          '--local',
          '--persist-to',
          INDEX_STATE,
        ],
        { cwd: INDEX_DIR },
      ),
    );
    console.log('[e2e] starting the index…');
    run(
      'pnpm',
      [
        'exec',
        'wrangler',
        'dev',
        '--local',
        '--port',
        String(INDEX_PORT),
        '--inspector-port',
        String(ports.indexInspector),
        '--persist-to',
        INDEX_STATE,
        // Everything it trusts and calls is this stack, never what a developer's .dev.vars names: the accounts the
        // api trusts (the stand-in), this api's audience and key, and this api's origin.
        '--var',
        'ENVIRONMENT:development',
        '--var',
        `ACCOUNTS_URL:${ACCOUNTS_ORIGIN}`,
        '--var',
        `INDEX_AUDIENCES:${apiResource}`,
        '--var',
        `INDEX_KEY_${UPPER}:${INDEX_KEY}`,
        '--var',
        `APP_ORIGIN_${UPPER}:http://127.0.0.1:${API_PORT}`,
        '--var',
        `MERGE_KEY:${MERGE_KEY}`,
      ],
      { cwd: INDEX_DIR },
    );
  }

  // liveworkspace's media service, where the product runs it (liveworkspace/apps/media/scripts/e2e-media.mjs).
  async function startMedia() {
    const { media } = settings;
    const mediaScript = path.resolve(
      root,
      '..',
      'liveworkspace',
      'apps',
      'media',
      'scripts',
      'e2e-media.mjs',
    );
    const { e2eMediaKey, MEDIA_DIR, startE2EMedia } = await import(pathToFileURL(mediaScript).href);
    // The media service's local D1 and R2 for this stack, apart from a developer's `wrangler dev` state.
    const state = path.join(MEDIA_DIR, '.wrangler', `e2e-state-${media.port}`);
    const url = await startE2EMedia({
      run,
      waitForExit,
      port: media.port,
      inspectorPort: media.inspectorPort,
      state,
      apps: [media.app],
      // Previews end to end: the stack's index decides who sees one, this api's export door draws it.
      indexUrl: `http://127.0.0.1:${INDEX_PORT}/api/index`,
      appOrigins: { [media.app]: `http://127.0.0.1:${API_PORT}` },
    });
    return ['--var', `MEDIA_URL:${url}`, '--var', `MEDIA_KEY:${e2eMediaKey(media.app)}`];
  }

  function startApi(mediaVars) {
    console.log('[e2e] starting api worker…');
    run(
      'pnpm',
      [
        '--filter',
        settings.apiPackage,
        'exec',
        'wrangler',
        'dev',
        '--local',
        '--port',
        String(API_PORT),
        '--inspector-port',
        String(ports.apiInspector),
        // Verify access and guest tokens against the stack's own key (the accounts stand-in above), never a
        // real accounts Worker a developer's .dev.vars may name. The client id and secret also turn the
        // guest handoff (/api/auth/guest) on, to the stand-in's.
        '--var',
        `ACCOUNTS_URL:${ACCOUNTS_ORIGIN}`,
        '--var',
        `API_RESOURCE:${apiResource}`,
        '--var',
        `ACCOUNTS_CLIENT_ID:${ACCOUNTS_CLIENT.id}`,
        '--var',
        `ACCOUNTS_CLIENT_SECRET:${ACCOUNTS_CLIENT.secret}`,
        // The stack's index, never one a developer's .dev.vars names.
        '--var',
        `INDEX_ORIGIN:http://127.0.0.1:${INDEX_PORT}`,
        '--var',
        `INDEX_KEY:${INDEX_KEY}`,
        // The stack's media, never one a developer's .dev.vars names.
        ...mediaVars,
        ...(settings.apiVars ?? []).flatMap((v) => ['--var', v]),
        ...(WORKBENCH ? ['--var', `APP_BASE_URL:http://localhost:${EDITOR_PORT}`] : []),
      ],
      { cwd: root },
    );
  }

  async function main() {
    if (!existsSync(outDir)) {
      console.error(
        `[e2e] ${outDir} missing: run \`pnpm --filter ${settings.appPackage} build\` first`,
      );
      process.exit(1);
    }
    if (settings.editorOnly) {
      console.log(
        `[e2e] static editor only, proxying to the api on :${API_PORT}${settings.editorOnlyNote ?? ''}`,
      );
      startLiveServer();
      return;
    }
    if (workspacePaths.length > 0 && !existsSync(WORKSPACE_SITE_DIR)) {
      console.warn(
        `[e2e] liveworkspace's site is not built (${WORKSPACE_SITE_DIR}): /explorer answers 404 until it is`,
      );
    }
    if (settings.media) {
      // The stack's own wrangler dev registry, so a service binding (media's INDEX) reaches this stack's Workers,
      // never a developer's or another stack's registered under the same name. Every wrangler the stack starts
      // inherits it. Fresh each run: a previous run's entries point at Workers that are gone, and a binding to one
      // loses its connection.
      const registry = path.join(INDEX_DIR, '.wrangler', `e2e-registry-${settings.media.port}`);
      rmSync(registry, { recursive: true, force: true });
      process.env.WRANGLER_REGISTRY_PATH = registry;
    }
    await startIndex();
    const mediaVars = settings.media ? await startMedia() : [];
    startApi(mediaVars);
    await waitForPort(INDEX_PORT, 'index');
    if (settings.media) await waitForPort(settings.media.port, 'media');
    await waitForPort(API_PORT, 'api worker');
    console.log('[e2e] api worker up; starting live static server…');
    startLiveServer();
  }

  main().catch((err) => {
    console.error('[e2e] stack failed:', err);
    shutdown(1);
  });
}
