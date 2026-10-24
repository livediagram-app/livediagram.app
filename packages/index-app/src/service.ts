// An app's api reaching liveworkspace's index (liveworkspace/docs/one-explorer.md, one-explorer-contracts.md):
// where every item is and who may open it. The index decides access and says so in a grant, an ES256 JWT the
// app checks offline against the index's published keys; the item's content stays in its Durable Object.
//
// `createIndexService(app)` binds the three ways in to one app, all through INDEX_ORIGIN
// (`https://liveworkspace.app`; locally `http://127.0.0.1:8793`):
//
//   - a grant check (`verifyGrant`): the editor fetches its own grant and sends it as X-Index-Grant;
//   - a grant fetched for a caller that has none (`requestGrant`): an API token or a workbench session, as that
//     account with the app's key (the index's delegated mode), or a browser with its own bearer and share headers;
//   - the app's key, for what an item pushes (`appClient`) and for the routes an API client calls (`clientFor`).

import {
  createGrantVerifier,
  createIndexAppClient,
  createIndexClient,
  createIndexDelegateClient,
  GRANT_RENEW_BEFORE_S,
  INDEX_API_PATH,
  IndexError,
  type App,
  type GrantClaims,
  type GrantResponse,
  type GrantVerifier,
  type IndexAppClient,
  type IndexAppClientOptions,
  type IndexClient,
  type Level,
  type ShareAccess,
} from '@liveworkspace/index-client';

// The two settings every app on the index has: the index's origin and the app's key there (a secret).
export type IndexEnv = { INDEX_ORIGIN?: string; INDEX_KEY?: string };

// A grant as a request carries it: the index's claims, and the share code the caller came in through (the
// item's room closes a revoked code's sessions by it).
export type ItemGrant = {
  item: string;
  level: Level;
  // The one tab a tab-scoped link opens, or null for every tab.
  tab: string | null;
  // `user_…`, `guest_…`, or `link:<code>` for a link visitor with no identity.
  sub: string;
  team: string | null;
  // The item's owner as the index has it now (null from a grant signed before the index named it).
  owner?: string | null;
  // Epoch seconds.
  exp: number;
  shareCode: string | null;
  // The grant as the index signed it, for the room's ticket.
  token: string;
};

// Who the app asks for: an account it checked itself (an API token's, a workbench session's owner) with the
// app's key, or a browser with its own bearer (an access or guest token, or none for a link visitor).
export type GrantCaller =
  | { kind: 'delegate'; personId: string; teams: readonly string[] }
  | { kind: 'bearer'; token: string | null };

export type GrantOutcome =
  | { ok: true; grant: GrantResponse }
  // The index's refusal (`not_found`, `password_required`, ...), or `index_unavailable` when it could not be asked.
  | { ok: false; status: number; error: string };

// The share code a link visitor's grant names, from its subject (`link:<code>`).
export function linkCodeOf(sub: string): string | null {
  return sub.startsWith('link:') ? sub.slice(5) || null : null;
}

export function itemGrantOf(
  claims: GrantClaims,
  shareCode: string | null,
  token: string,
): ItemGrant {
  return {
    token,
    item: claims.item,
    level: claims.level,
    tab: claims.tab,
    sub: claims.sub,
    team: claims.team,
    owner: claims.owner ?? null,
    exp: claims.exp,
    shareCode: linkCodeOf(claims.sub) ?? shareCode,
  };
}

// The index's API root, or null when this deployment has no index (every item door then answers as missing).
export function indexApiUrl(env: Pick<IndexEnv, 'INDEX_ORIGIN'>): string | null {
  const origin = env.INDEX_ORIGIN?.trim().replace(/\/+$/, '');
  return origin ? `${origin}${INDEX_API_PATH}` : null;
}

// Grants fetched for a caller are kept until a minute before they lapse, per caller, item and share code, so an
// API client's burst asks the index once. Bounded: past the cap the oldest entry goes first (a Map keeps
// insertion order). 1,000 entries is a few hundred KB at most.
export const GRANT_CACHE_MAX = 1000;

export type IndexService = ReturnType<typeof createIndexService>;

export function createIndexService<A extends App>(app: A) {
  // One verifier per key set for the life of the isolate: it caches the keys and refetches only on an unknown kid.
  const verifiers = new Map<string, GrantVerifier>();
  let verifierOverride: GrantVerifier | null = null;
  const grantCache = new Map<string, { grant: GrantResponse; until: number }>();

  function verifierFor(env: Pick<IndexEnv, 'INDEX_ORIGIN'>): GrantVerifier | null {
    if (verifierOverride) return verifierOverride;
    const base = indexApiUrl(env);
    if (!base) return null;
    let verify = verifiers.get(base);
    if (!verify) {
      verify = createGrantVerifier({ jwksUrl: `${base}/jwks`, audience: app });
      verifiers.set(base, verify);
    }
    return verify;
  }

  // The index as a caller reaches it: delegated with the app's key, or with the browser's own bearer. Null when
  // this deployment has no index (or, delegated, no key).
  function clientFor(env: IndexEnv, caller: GrantCaller): IndexClient | null {
    const baseUrl = indexApiUrl(env);
    if (!baseUrl) return null;
    if (caller.kind === 'delegate') {
      if (!env.INDEX_KEY) return null;
      return createIndexDelegateClient({
        app,
        key: env.INDEX_KEY,
        personId: caller.personId,
        teams: caller.teams,
        baseUrl,
      });
    }
    return createIndexClient({ baseUrl, getToken: () => caller.token });
  }

  // The app's own options at the index (its name, key and base), or null without an index or key.
  function appOptions(env: IndexEnv): IndexAppClientOptions | null {
    const baseUrl = indexApiUrl(env);
    if (!baseUrl || !env.INDEX_KEY) return null;
    return { app, key: env.INDEX_KEY, baseUrl };
  }

  function cacheKey(caller: GrantCaller, itemId: string, share: ShareAccess | null): string {
    const who =
      caller.kind === 'delegate'
        ? `d:${caller.personId}:${[...caller.teams].sort().join(',')}`
        : `b:${caller.token ?? ''}`;
    return `${who}|${itemId}|${share?.code ?? ''}|${share?.password ?? ''}`;
  }

  return {
    app,

    // Tests check grants against a local key set (or a stub) instead of fetching the index's.
    setGrantVerifierForTests: (verify: GrantVerifier | null): void => {
      verifierOverride = verify;
    },
    clearGrantCacheForTests: (): void => {
      grantCache.clear();
    },

    // The claims of a grant for this item, or null for a missing, forged, expired or misaddressed one.
    verifyGrant: async (
      env: Pick<IndexEnv, 'INDEX_ORIGIN'>,
      token: string | null | undefined,
      itemId: string,
    ): Promise<GrantClaims | null> => {
      if (!token) return null;
      const verify = verifierFor(env);
      if (!verify) return null;
      const claims = await verify(token);
      if (!claims) {
        console.warn('[grant] refused', { reason: 'invalid' });
        return null;
      }
      if (claims.item !== itemId) {
        console.warn('[grant] refused', { reason: 'other_item' });
        return null;
      }
      return claims;
    },

    requestGrant: async (
      env: IndexEnv,
      caller: GrantCaller,
      itemId: string,
      share: ShareAccess | null,
      now = Date.now(),
    ): Promise<GrantOutcome> => {
      const key = cacheKey(caller, itemId, share);
      const cached = grantCache.get(key);
      if (cached && cached.until > now) return { ok: true, grant: cached.grant };
      if (cached) grantCache.delete(key);
      const client = clientFor(env, caller);
      if (!client) return { ok: false, status: 503, error: 'index_unavailable' };
      try {
        const grant = await client.grant(itemId, share);
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
    },

    clientFor,
    appOptions,

    // What an item pushes (outbox.ts): its summary, each tab's comments and actions, its Timeline events.
    appClient: (env: IndexEnv): IndexAppClient | null => {
      const options = appOptions(env);
      return options ? createIndexAppClient(options) : null;
    },
  };
}
