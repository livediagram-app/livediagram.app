import type { RouteContext } from './context';
import type { Env } from '../types';

// Shared test builder for RouteContext (spec/18). Eight route test
// files used to hand-roll the same URL → segments → JSON Request →
// context skeleton, differing only in their surface's identity
// defaults — so RouteContext growing a field meant eight edits (and
// the copies had already drifted on which fields they bothered to
// stub). Each test file keeps a thin local `makeCtx` wrapper that
// bakes in its identity default (guest 'owner-1', Clerk 'user_1', …)
// and delegates the skeleton here.
//
// Not a `.test.ts` file so vitest doesn't collect it as a suite; it is
// only ever imported from tests.
export function makeTestRouteContext(
  method: string,
  path: string,
  opts: {
    // What resolveOwner() returns — the hybrid identity (spec/04) the
    // route acts as. Wrappers bake their surface's default.
    owner?: string | null;
    clerkUserId?: string | null;
    // Defaults to clerkUserId (a Clerk session carries both); pass
    // explicitly for the token-caller shape (verified account id with
    // NO Clerk session, spec/61).
    verifiedUserId?: string | null;
    clerkEmail?: string | null;
    // JSON-encoded into the request body when present.
    body?: unknown;
    headers?: Record<string, string>;
    // Per-test bindings (e.g. the images tests' IMAGES stub); an empty
    // Env otherwise.
    env?: Env;
    // Provide to observe background dispatches; absent = the unit-test
    // default where `ctx.waitUntil?.(...)` skips its argument.
    waitUntil?: (promise: Promise<unknown>) => void;
  } = {},
): RouteContext {
  const url = new URL(`https://api.test${path}`);
  const segments = url.pathname.replace(/^\//, '').split('/');
  const request = new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const clerkUserId = opts.clerkUserId ?? null;
  const verifiedUserId = opts.verifiedUserId === undefined ? clerkUserId : opts.verifiedUserId;
  return {
    request,
    env: opts.env ?? ({} as Env),
    url,
    segments,
    clerkUserId,
    verifiedUserId,
    clerkEmail: opts.clerkEmail ?? null,
    resolveOwner: () => opts.owner ?? null,
    ...(opts.waitUntil ? { waitUntil: opts.waitUntil } : {}),
  };
}
