#!/usr/bin/env node
// E2E stack (docs/specs/003-system-architecture/e2e-smoke.md): the four-process stack the Playwright smoke suite
// runs against, booted by the stack every product shares (scripts/e2e-stack/stack.mjs at the monorepo's root): the
// real static `apps/editor/out` build served with the production router/worker rewrites, the api worker with local
// Durable Objects, liveworkspace's index (liveworkspace/apps/index, liveworkspace/docs/specs/004-index/one-explorer.md)
// on its own local D1, and liveworkspace's media service (liveworkspace/apps/media, its scripts/e2e-media.mjs), its
// D1 and R2 fresh each run, so uploads and the gallery run end to end. This file holds only livehuddle's settings.
//
// The static server strips the `/live` assetPrefix, rewrites `/document/*` to the single placeholder, forwards
// `/api/index/*` to the index and `/api/previews/*` to media, serves liveworkspace's Explorer and Community when its
// site is built, and proxies the rest of `/api/*` (WebSocket upgrades included) to the api worker so the app is
// same-origin. Its ports: E2E_EDITOR_PORT (3502), E2E_API_PORT (9087), E2E_INDEX_PORT (8119), E2E_MEDIA_PORT (8120),
// E2E_MARKETING_PORT (3513), each wrangler's inspector beside its service.
//
// The stack always acts as the liveworkspace accounts Worker (scripts/e2e-stack/accounts-stand-in.mjs): the api and
// the index both trust it, and it answers the account API the api calls from its own records, which the signed-in
// specs fill through /e2e/accounts/__seed/* (e2e/accounts-stub.ts). Test-only: nothing outside this stack trusts the
// key or the records.
//
// Switches:
//   E2E_EDITOR_OUT     serve another export of the editor app, e.g. the signed-in `.next/out-signed-in` the
//                    signed-in specs run against (apps/editor/scripts/build-signed-in.mjs).
//   E2E_EDITOR_ONLY=1  serve the static editor only, proxying to the api already listening on E2E_API_PORT (no
//                    second worker), for trying the editor beside a stack that is already up.
//   E2E_CACHE_POLICY=off, E2E_WORKSPACE_SITE_OUT: see scripts/e2e-stack/static-serving.mjs and stack.mjs.
//   E2E_API_VARS     more vars for the api, space-separated `KEY:value` pairs: E2E_API_VARS="REALTIME_APP_ID:x …"
//                    turns on what a stack has no secrets for, such as proximity audio's calls
//                    (docs/specs/012-collaboration/proximity-audio.md).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectorPortOf } from '../../scripts/e2e-stack/inspector-ports.mjs';
import { runE2EStack } from '../../scripts/e2e-stack/stack.mjs';
// Every page enforces Trusted Types in production (docs/specs/016-platform/trusted-types.md), so the suite runs
// against the same header: a violation throws in the page, and the pageErrors fixture fails the spec on it.
import { TRUSTED_TYPES_CSP } from '../packages/ui/src/trusted-types-csp.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDITOR_PORT = Number(process.env.E2E_EDITOR_PORT ?? 3502);
const API_PORT = Number(process.env.E2E_API_PORT ?? 9087);
const INDEX_PORT = Number(process.env.E2E_INDEX_PORT ?? 8119);
const MEDIA_PORT = Number(process.env.E2E_MEDIA_PORT ?? 8120);

runE2EStack({
  product: 'livehuddle',
  root: ROOT,
  appPackage: '@livehuddle/editor',
  apiPackage: '@livehuddle/api',
  outDir: path.join(ROOT, 'apps', 'editor', process.env.E2E_EDITOR_OUT ?? 'out'),
  csp: TRUSTED_TYPES_CSP,
  ports: {
    editor: EDITOR_PORT,
    api: API_PORT,
    apiInspector: inspectorPortOf(process.env.E2E_API_INSPECTOR_PORT, API_PORT),
    index: INDEX_PORT,
    indexInspector: inspectorPortOf(process.env.E2E_INDEX_INSPECTOR_PORT, INDEX_PORT),
    marketing: Number(process.env.E2E_MARKETING_PORT ?? 3513),
  },
  apiResource: 'https://e2e.livehuddle.test/api',
  clientId: 'e2e-livehuddle',
  accountsRecords: true,
  placeholders: ['/document', '/form'],
  // An Explorer page names the app it is shown for (liveworkspace/docs/specs/004-index/one-explorer.md "The Explorer
  // on each app's address"), since this stack runs on whatever ports it is given.
  workspace: { paths: ['/explorer', '/community'], appMeta: 'livehuddle' },
  media: {
    port: MEDIA_PORT,
    inspectorPort: inspectorPortOf(process.env.E2E_MEDIA_INSPECTOR_PORT, MEDIA_PORT),
    app: 'livehuddle.app',
  },
  editorOnly: process.env.E2E_EDITOR_ONLY === '1',
  apiVars: [
    // The guest handoff comes back to this stack's editor, never the router a developer's .dev.vars names.
    `AUTH_ORIGIN:http://localhost:${EDITOR_PORT}`,
    ...(process.env.E2E_API_VARS ?? '').split(/\s+/).filter(Boolean),
  ],
});
