// liveworkspace's index as this api reaches it (liveworkspace/docs/one-explorer.md, one-explorer-contracts.md):
// where every plan is and who may open it. The index decides access and says so in a grant, an ES256 JWT this
// api checks offline against the index's published keys; the plan's content stays in its Durable Object.
//
// Three ways in, all through INDEX_ORIGIN (`https://liveworkspace.app`; locally `http://127.0.0.1:8793`):
//
//   - a grant check (`verifyPlanGrant`): the editor fetches its own grant and sends it as X-Index-Grant;
//   - a grant fetched for a caller that has none (`requestGrant`): an API token or a workbench session, as that
//     account with this app's key (the index's delegated mode), and a browser that sent no grant, with its own
//     bearer and share headers;
//   - this app's key, for what a plan pushes (`indexAppClient`, plan-outbox.ts) and for the routes an API
//     client still calls here (`indexFor`, routes/index-adapters.ts and the routes beside it).

import {
  createGrantVerifier,
  createIndexAppClient,
  createIndexClient,
  createIndexDelegateClient,
  GRANT_RENEW_BEFORE_S,
  INDEX_API_PATH,
  IndexError,
  type GrantClaims,
  type GrantResponse,
  type GrantVerifier,
  type IndexAppClient,
  type IndexClient,
  type ShareAccess,
} from '@liveworkspace/index-client';
import type { AccessLevel } from '@liveplanner/api-schema';
import type { Env } from './types';

export const INDEX_APP = 'liveplanner' as const;

// A plan grant as a request carries it: the index's claims, and the share code the caller came in through (the
// room closes a revoked code's sessions by it).
export type PlanGrant = {
  item: string;
  level: AccessLevel;
  // The one tab a tab-scoped link opens, or null for every tab.
  tab: string | null;
  // `user_…`, `guest_…`, or `link:<code>` for a link visitor with no identity.
  sub: string;
  team: string | null;
  // Epoch seconds.
  exp: number;
  shareCode: string | null;
  // The grant as the index signed it, for the room's ticket (routes/project-room-routes.ts).
  token: string;
};

// The index's API root, or null when this deployment has no index (every plan door then answers as missing).
export function indexApiUrl(env: Pick<Env, 'INDEX_ORIGIN'>): string | null {
  const origin = env.INDEX_ORIGIN?.trim().replace(/\/+$/, '');
  return origin ? `${origin}${INDEX_API_PATH}` : null;
}

// ---------- Checking a grant ----------------------------------------------------------------------------------

// One verifier per key set for the life of the isolate: it caches the keys and refetches only on an unknown kid.
const verifiers = new Map<string, GrantVerifier>();
let verifierOverride: GrantVerifier | null = null;

// Tests check grants against a local key set (or a stub) instead of fetching the index's.
export function setGrantVerifierForTests(verify: GrantVerifier | null): void {
  verifierOverride = verify;
}

function verifierFor(env: Pick<Env, 'INDEX_ORIGIN'>): GrantVerifier | null {
  if (verifierOverride) return verifierOverride;
  const base = indexApiUrl(env);
  if (!base) return null;
  let verify = verifiers.get(base);
  if (!verify) {
    verify = createGrantVerifier({ jwksUrl: `${base}/jwks`, audience: INDEX_APP });
    verifiers.set(base, verify);
  }
  return verify;
}

// The claims of a grant for this plan, or null for a missing, forged, expired or misaddressed one.
export async function verifyPlanGrant(
  env: Pick<Env, 'INDEX_ORIGIN'>,
  token: string | null | undefined,
  planId: string,
): Promise<GrantClaims | null> {
  if (!token) return null;
  const verify = verifierFor(env);
  if (!verify) return null;
  const claims = await verify(token);
  if (!claims) {
    console.warn('[grant] refused', { reason: 'invalid' });
    return null;
  }
  if (claims.item !== planId) {
    console.warn('[grant] refused', { reason: 'other_item' });
    return null;
  }
  return claims;
}

// The share code a link visitor's grant names, from its subject (`link:<code>`).
export function linkCodeOf(sub: string): string | null {
  return sub.startsWith('link:') ? sub.slice(5) || null : null;
}

export function planGrantOf(
  claims: GrantClaims,
  shareCode: string | null,
  token: string,
): PlanGrant {
  return {
    token,
    item: claims.item,
    level: claims.level,
    tab: claims.tab,
    sub: claims.sub,
    team: claims.team,
    exp: claims.exp,
    shareCode: linkCodeOf(claims.sub) ?? shareCode,
  };
}

// ---------- Fetching a grant for a caller that has none -------------------------------------------------------

// Who the api asks for: an account it checked itself (an API token's, a workbench session's owner) with this
// app's key, or a browser with its own bearer (an access or guest token, or none for a link visitor).
export type GrantCaller =
  | { kind: 'delegate'; personId: string; teams: readonly string[] }
  | { kind: 'bearer'; token: string | null };

export type GrantOutcome =
  | { ok: true; grant: GrantResponse }
  // The index's refusal (`not_found`, `password_required`, ...), or `unavailable` when it could not be asked.
  | { ok: false; status: number; error: string };

// Grants fetched here are kept until a minute before they lapse, per caller, plan and share code, so an API
// client's burst of requests asks the index once. Bounded: past the cap the oldest entry goes first (a Map keeps
// insertion order). 1,000 entries is a few hundred KB at most.
const GRANT_CACHE_MAX = 1000;
const grantCache = new Map<string, { grant: GrantResponse; until: number }>();

export function clearGrantCacheForTests(): void {
  grantCache.clear();
}

function cacheKey(caller: GrantCaller, planId: string, share: ShareAccess | null): string {
  const who =
    caller.kind === 'delegate'
      ? `d:${caller.personId}:${[...caller.teams].sort().join(',')}`
      : `b:${caller.token ?? ''}`;
  return `${who}|${planId}|${share?.code ?? ''}|${share?.password ?? ''}`;
}

export async function requestGrant(
  env: Env,
  caller: GrantCaller,
  planId: string,
  share: ShareAccess | null,
  now = Date.now(),
): Promise<GrantOutcome> {
  const key = cacheKey(caller, planId, share);
  const cached = grantCache.get(key);
  if (cached && cached.until > now) return { ok: true, grant: cached.grant };
  if (cached) grantCache.delete(key);
  const client = indexFor(env, caller);
  if (!client) return { ok: false, status: 503, error: 'index_unavailable' };
  try {
    const grant = await client.grant(planId, share);
    grantCache.set(key, { grant, until: grant.expiresAt - GRANT_RENEW_BEFORE_S * 1000 });
    while (grantCache.size > GRANT_CACHE_MAX) {
      const oldest = grantCache.keys().next().value;
      if (oldest === undefined) break;
      grantCache.delete(oldest);
    }
    return { ok: true, grant };
  } catch (err) {
    if (err instanceof IndexError) return { ok: false, status: err.status, error: err.code };
    console.error('[grant] index unreachable', { error: String(err) });
    return { ok: false, status: 503, error: 'index_unavailable' };
  }
}

// ---------- Clients -------------------------------------------------------------------------------------------

// The index as a caller reaches it: delegated with this app's key, or with the browser's own bearer. Null when
// this deployment has no index (or, delegated, no key).
export function indexFor(env: Env, caller: GrantCaller): IndexClient | null {
  const baseUrl = indexApiUrl(env);
  if (!baseUrl) return null;
  if (caller.kind === 'delegate') {
    if (!env.INDEX_KEY) return null;
    return createIndexDelegateClient({
      app: INDEX_APP,
      key: env.INDEX_KEY,
      personId: caller.personId,
      teams: caller.teams,
      baseUrl,
    });
  }
  return createIndexClient({ baseUrl, getToken: () => caller.token });
}

// What a plan pushes (plan-outbox.ts): its summary and each tab's comments and actions, with this app's key.
export function indexAppClient(
  env: Pick<Env, 'INDEX_ORIGIN' | 'INDEX_KEY'>,
): IndexAppClient | null {
  const baseUrl = indexApiUrl(env);
  if (!baseUrl || !env.INDEX_KEY) return null;
  return createIndexAppClient({ app: INDEX_APP, key: env.INDEX_KEY, baseUrl });
}
