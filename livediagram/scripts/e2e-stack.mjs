#!/usr/bin/env node
// E2E stack (docs/specs/003-system-architecture/e2e-smoke.md): the four-process stack the Playwright smoke suite
// runs against, booted by the stack every product shares (scripts/e2e-stack/stack.mjs at the monorepo's root): the
// real static `apps/editor/out` build served with the production router/worker rewrites, the api worker with local
// Durable Objects, liveworkspace's index (liveworkspace/apps/index, liveworkspace/docs/specs/004-index/one-explorer.md)
// on its own local D1, and liveworkspace's media service (liveworkspace/apps/media, its scripts/e2e-media.mjs), its
// D1 and R2 fresh each run, so uploads and the gallery run end to end. This file holds only livediagram's settings.
//
// The static server strips the `/live` assetPrefix, rewrites `/document/*` to the single placeholder, forwards
// `/api/index/*` to the index and `/api/previews/*` to media, serves liveworkspace's Explorer and Community when its
// site is built, and proxies the rest of `/api/*` (WebSocket upgrades included) to the api worker so the app is
// same-origin. Its ports: E2E_EDITOR_PORT (3102), E2E_API_PORT (8687), E2E_INDEX_PORT (8119), E2E_MEDIA_PORT (8120),
// E2E_MARKETING_PORT (3113), each wrangler's inspector beside its service.
//
// The stack always acts as the liveworkspace accounts Worker (scripts/e2e-stack/accounts-stand-in.mjs): the api and
// the index both trust it, and it answers the account API the api calls from its own records, which the signed-in
// specs fill through /e2e/accounts/__seed/* (e2e/accounts-stub.ts). Test-only: nothing outside this stack trusts the
// key or the records.
//
// Switches:
//   E2E_EDITOR_OUT     serve another export of the editor app, e.g. the signed-in `.next/out-signed-in` the
//                    signed-in specs run against (`../packages/next-config/scripts/build-signed-in.mjs`).
//   E2E_EDITOR_ONLY=1  serve the static editor only, proxying to the api already listening on E2E_API_PORT (no
//                    second worker), for trying the editor beside a stack that is already up.
//   E2E_CACHE_POLICY=off, E2E_WORKSPACE_SITE_OUT: see scripts/e2e-stack/static-serving.mjs and stack.mjs.
//   E2E_NO_AI=1      answer /api/capabilities with aiEnabled: false, as a deployment with no AI key does, so the
//                    photo import reads with the in-browser model.
//   E2E_AI_BUDGET_SPENT=1  answer /api/ai/read-notes with 429 `ai_quota`, as a hosted reader whose free budget is
//                    spent does, so the photo import fails over to the in-browser model.
//   E2E_WORKBENCH=1  the workbench embed e2e (docs/specs/013-workspace/blueprints/workbench-embeds.md, "Testing"):
//                    the api builds its workbench and pairing URLs on this live origin (APP_BASE_URL). The live
//                    build must carry NEXT_PUBLIC_E2E_AUTH=1.

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectorPortOf } from '../../scripts/e2e-stack/inspector-ports.mjs';
import { runE2EStack } from '../../scripts/e2e-stack/stack.mjs';
import {
  isWorkspaceFramePath,
  WORKSPACE_FRAME_PAGE,
} from '../../packages/workbench/src/lib/workbench/workbench-frame-path.ts';
// Every page enforces Trusted Types in production (docs/specs/016-platform/trusted-types.md), so the suite runs
// against the same header: a violation throws in the page, and the pageErrors fixture fails the spec on it.
import { TRUSTED_TYPES_CSP } from '../packages/ui/src/trusted-types-csp.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDITOR_PORT = Number(process.env.E2E_EDITOR_PORT ?? 3102);
const API_PORT = Number(process.env.E2E_API_PORT ?? 8687);
const INDEX_PORT = Number(process.env.E2E_INDEX_PORT ?? 8119);
const MEDIA_PORT = Number(process.env.E2E_MEDIA_PORT ?? 8120);
const NO_AI = process.env.E2E_NO_AI === '1';
const AI_BUDGET_SPENT = process.env.E2E_AI_BUDGET_SPENT === '1';

// The two AI switches above, answered before anything else.
function aiRoutes(req, res, pathname) {
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
    return true;
  }
  if (AI_BUDGET_SPENT && pathname === '/api/ai/read-notes') {
    // Drain the body first, as a real server would, then refuse for quota.
    req.resume();
    req.on('end', () => {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ai_quota' }));
    });
    return true;
  }
  return false;
}

runE2EStack({
  product: 'livediagram',
  root: ROOT,
  appPackage: '@livediagram/editor',
  apiPackage: '@livediagram/api',
  outDir: path.join(ROOT, 'apps', 'editor', process.env.E2E_EDITOR_OUT ?? 'out'),
  csp: TRUSTED_TYPES_CSP,
  ports: {
    editor: EDITOR_PORT,
    api: API_PORT,
    apiInspector: inspectorPortOf(process.env.E2E_API_INSPECTOR_PORT, API_PORT),
    index: INDEX_PORT,
    indexInspector: inspectorPortOf(process.env.E2E_INDEX_INSPECTOR_PORT, INDEX_PORT),
    marketing: Number(process.env.E2E_MARKETING_PORT ?? 3113),
  },
  apiResource: 'https://e2e.livediagram.test/api',
  clientId: 'e2e-livediagram',
  accountsRecords: true,
  placeholders: ['/document', '/form'],
  workspaceFrame: { isPath: isWorkspaceFramePath, page: WORKSPACE_FRAME_PAGE },
  workspace: { paths: ['/explorer', '/community'] },
  media: {
    port: MEDIA_PORT,
    inspectorPort: inspectorPortOf(process.env.E2E_MEDIA_INSPECTOR_PORT, MEDIA_PORT),
    app: 'livediagram.app',
  },
  editorOnly: process.env.E2E_EDITOR_ONLY === '1',
  editorOnlyNote: `${NO_AI ? ', AI reported off' : ''}${AI_BUDGET_SPENT ? ', AI budget spent' : ''}`,
  workbench: true,
  routes: aiRoutes,
  // Production's origin allow-list lives in wrangler.toml [vars], which `wrangler dev` reads too; it would 403 every
  // AI call from this localhost editor. Blank it, as `pnpm dev` does (docs/specs/021-event-storming/note-reader.md).
  apiVars: ['AI_ALLOWED_ORIGINS:'],
});
