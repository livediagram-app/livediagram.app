#!/usr/bin/env node
// E2E stack (docs/specs/003-system-architecture/e2e-smoke.md): the three-process stack the Playwright smoke suite
// runs against, booted by the stack every product shares (scripts/e2e-stack/stack.mjs at the monorepo's root): the
// real static `apps/editor/out` build served with the production router/worker rewrites, the api worker
// (each canvas's content in its own local Durable Object), and liveworkspace's index on its own local D1. This file holds only liveknowledge's settings.
//
// The static server rewrites `/document/*` to the single placeholder, forwards `/api/index/*` to the index, serves
// and proxies the rest of `/api/*` (WebSocket upgrades included) to the api worker so the app is
// same-origin. Its ports: E2E_EDITOR_PORT (3602), E2E_API_PORT (9287), E2E_INDEX_PORT (8319), E2E_MARKETING_PORT (3613),
// each wrangler's inspector beside its service.
//
// Switches:
//   E2E_EDITOR_OUT        serve another export of the editor app, e.g. the signed-in `.next/out-signed-in` the
//                    signed-in specs run against (`../packages/next-config/scripts/build-signed-in.mjs`).
//   E2E_EDITOR_ONLY=1     serve the static editor only, proxying to the api already listening on E2E_API_PORT (no
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
} from '../../packages/workbench/src/lib/workbench/workbench-frame-path.ts';
// Every page enforces Trusted Types in production (docs/specs/016-platform/trusted-types.md), so the suite runs
// against the same header: a violation throws in the page, and the pageErrors fixture fails the spec on it.
import { TRUSTED_TYPES_CSP } from '../packages/ui/src/trusted-types-csp.ts';
import { startClaudeStandIn } from './e2e-claude-stand-in.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDITOR_PORT = Number(process.env.E2E_EDITOR_PORT ?? 3602);
const API_PORT = Number(process.env.E2E_API_PORT ?? 9287);
const INDEX_PORT = Number(process.env.E2E_INDEX_PORT ?? 8319);
// The accounts Worker stand-in the api's ACCOUNTS binding reaches for the AI key door (../../scripts/e2e-stack/
// accounts-worker): one above the api, unless the environment names another.
const ACCOUNTS_WORKER_PORT = Number(process.env.E2E_ACCOUNTS_WORKER_PORT ?? API_PORT + 1);
// No request of this stack reaches Anthropic: the api's door to the model opens on the stand-in instead
// (e2e-claude-stand-in.mjs), on a free loopback port. Not started beside an api that is already up.
const claude = process.env.E2E_EDITOR_ONLY === '1' ? null : await startClaudeStandIn();

runE2EStack({
  product: 'liveknowledge',
  root: ROOT,
  appPackage: '@liveknowledge/editor',
  apiPackage: '@liveknowledge/api',
  outDir: path.join(ROOT, 'apps', 'editor', process.env.E2E_EDITOR_OUT ?? 'out'),
  csp: TRUSTED_TYPES_CSP,
  ports: {
    editor: EDITOR_PORT,
    api: API_PORT,
    apiInspector: inspectorPortOf(process.env.E2E_API_INSPECTOR_PORT, API_PORT),
    index: INDEX_PORT,
    indexInspector: inspectorPortOf(process.env.E2E_INDEX_INSPECTOR_PORT, INDEX_PORT),
    marketing: Number(process.env.E2E_MARKETING_PORT ?? 3613),
  },
  // A signed-in asker with no knowledgebase key asks accounts whose AI key applies (docs/specs/030-knowledgebase/
  // search-and-ask.md "Which key answers"); the stand-in answers none, so Ask runs on built-in AI as deployed.
  accountsWorker: {
    port: ACCOUNTS_WORKER_PORT,
    inspectorPort: inspectorPortOf(
      process.env.E2E_ACCOUNTS_WORKER_INSPECTOR_PORT,
      ACCOUNTS_WORKER_PORT,
    ),
  },
  apiResource: 'https://e2e.liveknowledge.test/api',
  // The client id and secret only turn the guest handoff on; the stand-in checks neither.
  clientId: 'liveknowledge-e2e',
  accountsRecords: false,
  placeholders: ['/document', '/form'],
  workspaceFrame: { isPath: isWorkspaceFramePath, page: WORKSPACE_FRAME_PAGE },
  editorOnly: process.env.E2E_EDITOR_ONLY === '1',
  workbench: true,
  // The guest handoff comes back to this stack's editor, never the router a developer's .dev.vars names.
  // AI_KEY_SECRET seals a knowledgebase's own AI key (docs/specs/030-knowledgebase/search-and-ask.md): a test-only
  // value, so the AI settings and Ask routes answer here as they do deployed.
  apiVars: [
    `AUTH_ORIGIN:http://localhost:${EDITOR_PORT}`,
    'AI_KEY_SECRET:e2e-liveknowledge-ai-key-secret',
    ...(claude ? [`E2E_CLAUDE_STAND_IN:${claude.origin}`] : []),
  ],
});
