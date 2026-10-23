import type { PlanRouteContext, WorkbenchContext } from './context';
import type { Env, PlanEnv } from '../types';

// Shared test builder for RouteContext (docs/specs/003-system-architecture/testing.md). Eight route test
// files used to hand-roll the same URL → segments → JSON Request →
// context skeleton, differing only in their surface's identity
// defaults — so RouteContext growing a field meant eight edits (and
// the copies had already drifted on which fields they bothered to
// stub). Each test file keeps a thin local `makeCtx` wrapper that
// bakes in its identity default (guest 'owner-1', signed-in 'user_1', …)
// and delegates the skeleton here.
//
// Not a `.test.ts` file so vitest doesn't collect it as a suite; it is
// only ever imported from tests.
export function makeTestRouteContext(
  method: string,
  path: string,
  opts: {
    // What resolveOwner() returns — the hybrid identity (docs/specs/014-identity/auth-and-guest-access.md) the
    // route acts as. Wrappers bake their surface's default.
    owner?: string | null;
    accountUserId?: string | null;
    // Defaults to accountUserId (a signed-in session carries both); pass
    // explicitly for the token-caller shape (verified account id with
    // NO signed-in session, docs/specs/015-api/public-api-and-tokens.md).
    verifiedUserId?: string | null;
    accountEmail?: string | null;
    // The API token the request presented (docs/specs/024-agents/agent-changesets.md).
    token?: { id: string; readOnly?: boolean } | null;
    // The workbench session the request presented (docs/specs/013-workspace/workbench-embeds.md).
    workbench?: WorkbenchContext | null;
    // JSON-encoded into the request body when present.
    body?: unknown;
    // Sent as is, for a body that does not parse.
    rawBody?: string;
    headers?: Record<string, string>;
    // Per-test bindings (e.g. a SNAPSHOTS stub); an empty
    // Env otherwise.
    env?: Env | PlanEnv;
    // Provide to observe background dispatches; absent = the unit-test
    // default where `ctx.waitUntil?.(...)` skips its argument.
    waitUntil?: (promise: Promise<unknown>) => void;
  } = {},
): PlanRouteContext {
  const url = new URL(`https://api.test${path}`);
  const segments = url.pathname.replace(/^\//, '').split('/');
  const request = new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    body: opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
  });
  const accountUserId = opts.accountUserId ?? null;
  const verifiedUserId = opts.verifiedUserId === undefined ? accountUserId : opts.verifiedUserId;
  return {
    request,
    env: planEnvFor(segments, opts.env),
    url,
    segments,
    accountUserId,
    verifiedUserId,
    accountEmail: opts.accountEmail ?? null,
    resolveOwner: () => opts.owner ?? null,
    token: opts.token ?? null,
    workbench: opts.workbench ?? null,
    ...(opts.waitUntil ? { waitUntil: opts.waitUntil } : {}),
  };
}

// A request about a plan (/api/projects/<id>/…, /api/forms/<code>/…) runs inside the plan's Durable Object
// (routes/projects.ts, routes/forms.ts), whose env carries the plan's store: an env without one gets a stand-in,
// so the handler under test takes the in-plan path. Any other path keeps the env it was given.
//
// The stand-in answers nothing (no rows, no changes) and is not enumerable, so a test asserting the env a
// mocked module was handed (`toHaveBeenCalledWith({}, …)`) still sees the bindings it gave.
function planEnvFor(segments: string[], env: Env | PlanEnv | undefined): PlanEnv {
  const base = env ?? ({} as Env);
  if ('PLAN_DB' in base) return base as PlanEnv;
  if (segments[1] !== 'projects' && segments[1] !== 'forms') return base as PlanEnv;
  return Object.defineProperty({ ...base }, 'PLAN_DB', {
    value: emptyPlanDb(),
    enumerable: false,
  }) as PlanEnv;
}

function emptyPlanDb(): D1Database {
  const statement = {
    bind: () => statement,
    first: async () => null,
    all: async () => ({ results: [], success: true, meta: {} }),
    run: async () => ({ results: [], success: true, meta: { changes: 0 } }),
    raw: async () => [],
  };
  return {
    prepare: () => statement,
    batch: async (statements: unknown[]) =>
      statements.map(() => ({ results: [], success: true, meta: { changes: 0 } })),
  } as unknown as D1Database;
}
