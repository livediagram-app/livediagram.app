#!/usr/bin/env node
// E2E stack (docs/specs/003-system-architecture/e2e-smoke.md): the three-process stack the Playwright smoke suite
// runs against, booted by the stack every product shares (scripts/e2e-stack/stack.mjs at the monorepo's root): the
// real static `apps/live/out` build served with the production router/worker rewrites, the api worker
// (each design's and each person's Durable Object keeps its own SQLite in wrangler's local storage), and liveworkspace's index on its own local D1. This file holds only livedesign's settings.
//
// The static server rewrites `/design/*` to the single placeholder, forwards `/api/index/*` to the index, serves
// liveworkspace's Explorer at `/explorer` when its site is built, and proxies the rest of `/api/*` (WebSocket upgrades included) to the api worker so the app is
// same-origin. Its ports: E2E_LIVE_PORT (3402), E2E_API_PORT (8989), E2E_INDEX_PORT (8419), E2E_MARKETING_PORT (3413),
// each wrangler's inspector beside its service.
//
// Switches:
//   E2E_LIVE_OUT        serve another export of the live app, e.g. the signed-in `.next/out-signed-in` the
//                    signed-in specs run against (apps/live/scripts/build-signed-in.mjs).
//   E2E_LIVE_ONLY=1     serve the static editor only, proxying to the api already listening on E2E_API_PORT (no
//                    second worker), for trying the editor beside a stack that is already up.
//   E2E_WORKBENCH=1  the workbench embed e2e (docs/specs/013-workspace/blueprints/workbench-embeds.md, "Testing").
//   E2E_CACHE_POLICY=off, E2E_WORKSPACE_SITE_OUT: see scripts/e2e-stack/static-serving.mjs and stack.mjs.
//
// The stack always acts as the liveworkspace accounts Worker (scripts/e2e-stack/accounts-stand-in.mjs): a key made at
// boot, its JWKS, the guest handoff, minted access and guest tokens, and the account's API tokens and profiles.
// Test-only: nothing outside this stack trusts the key.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectorPortOf } from '../../scripts/e2e-stack/inspector-ports.mjs';
import { runE2EStack } from '../../scripts/e2e-stack/stack.mjs';
import {
  isWorkspaceFramePath,
  WORKSPACE_FRAME_PAGE,
} from '../apps/live/lib/workbench/workbench-frame-path.ts';
// Every page enforces Trusted Types in production (docs/specs/016-platform/trusted-types.md), so the suite runs
// against the same header: a violation throws in the page, and the pageErrors fixture fails the spec on it.
import { TRUSTED_TYPES_CSP } from '../packages/ui/src/trusted-types-csp.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDITOR_PORT = Number(process.env.E2E_LIVE_PORT ?? 3402);
const API_PORT = Number(process.env.E2E_API_PORT ?? 8989);
const INDEX_PORT = Number(process.env.E2E_INDEX_PORT ?? 8419);

runE2EStack({
  product: 'livedesign',
  root: ROOT,
  appPackage: '@livedesign/live',
  apiPackage: '@livedesign/api',
  outDir: path.join(ROOT, 'apps', 'live', process.env.E2E_LIVE_OUT ?? 'out'),
  csp: TRUSTED_TYPES_CSP,
  ports: {
    editor: EDITOR_PORT,
    api: API_PORT,
    apiInspector: inspectorPortOf(process.env.E2E_API_INSPECTOR_PORT, API_PORT),
    index: INDEX_PORT,
    indexInspector: inspectorPortOf(process.env.E2E_INDEX_INSPECTOR_PORT, INDEX_PORT),
    marketing: Number(process.env.E2E_MARKETING_PORT ?? 3413),
  },
  apiResource: 'https://e2e.livedesign.test/api',
  // The client id and secret only turn the guest handoff on; the stand-in checks neither.
  clientId: 'livedesign-e2e',
  accountsRecords: false,
  placeholders: ['/design', '/form'],
  workspaceFrame: { isPath: isWorkspaceFramePath, page: WORKSPACE_FRAME_PAGE },
  workspace: { paths: ['/explorer'] },
  editorOnly: process.env.E2E_LIVE_ONLY === '1',
  workbench: true,
  // The guest handoff comes back to this stack's editor, never the router a developer's .dev.vars names.
  apiVars: [`AUTH_ORIGIN:http://localhost:${EDITOR_PORT}`],
});
