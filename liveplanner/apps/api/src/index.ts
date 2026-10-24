import { getPersonIdentity } from './auth/accounts';
import { AccountsUnavailable, type ResolvedApiToken } from './db/api-tokens';
import { handleAuth } from './routes/auth';
import { reportServerEvent, telemetryEnabled } from './server-telemetry';
import { resolveApiToken } from './db';
import { apiRouteLabel, bearerTokenOf, errorTypeToken } from '@liveplanner/api-schema';
import {
  API_TOKEN_PREFIX,
  isApiTokenFormat,
  isWorkbenchSessionFormat,
  WORKBENCH_SESSION_PREFIX,
} from '@liveplanner/api-schema';
import { handleTokens } from './routes/tokens';
import { handleOauthExchange } from './routes/oauth';
import { PlanRoom } from './plan-room/plan-room';
import { WorkbenchStore } from './workbench-store-do';
import { handleInternalItems } from './routes/internal-items';
import { CORS_HEADERS, forbidden, json, notFound, payloadTooLarge, rateLimited } from './responses';
import { clientIp, clientNetwork, clientRateKey } from './client-ip';
import { MAX_BODY_BYTES } from './limits';
import { handleAccount } from './routes/account';
import { handleEvents } from './routes/events';
import { handleCatalogues } from './routes/catalogues';
import { handleCapabilities } from './routes/capabilities';
import { handleOpenapi } from './routes/openapi';
import { handleUnfurl } from './routes/unfurl';
import type { RouteContext, WorkbenchContext } from './routes/context';
import { handleProjects } from './routes/projects';
import { handleForms } from './routes/forms';
import { handleParticipants } from './routes/participants';
import { handlePreferences } from './routes/preferences';
import { handleFolders } from './routes/folders';
import { handleShare } from './routes/share';
import { handleTeams } from './routes/teams';
import { handleTrash } from './routes/trash';
import { handleWorkbench } from './routes/workbench';
import { resolveWorkbenchSession } from './auth/workbench-session';
import { workbenchRefusal } from './auth/workbench-confinement';
import { withServerRelease } from './server-release-header';
import type { Env } from './types';

export { PlanRoom, WorkbenchStore };

// Per-owner write rate limit (security audit item). Returns true
// when the caller is over the configured cap (wrangler.toml's
// WRITE_RATE_LIMITER binding) so the endpoint can short-circuit
// with a 429. Falls through to "allowed" when the binding is
// absent so deployments without the feature still serve.
async function isWriteRateLimited(env: Env, ownerId: string): Promise<boolean> {
  if (!env.WRITE_RATE_LIMITER) return false;
  const result = await env.WRITE_RATE_LIMITER.limit({ key: ownerId });
  return !result.success;
}

// Every request the worker answers; `fetch` below stamps the project format number on it.
async function routeApiRequest(
  request: Request,
  env: Env,
  executionCtx?: ExecutionContext,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  const url = new URL(request.url);
  const segments = url.pathname.replace(/^\//, '').split('/');
  if (segments[0] !== 'api') return notFound();

  // Signing in (routes/auth.ts) carries no Bearer, so it is answered before identity and the
  // per-owner write limit, which would otherwise put every sign-in on one 'anonymous' bucket.
  if (segments[1] === 'auth') {
    return handleAuth(request, env, segments, (p) => executionCtx?.waitUntil(p));
  }

  // The One Explorer index's server-to-server doors into a plan's content (routes/internal-items.ts): their own
  // key, never a person's identity, so answered before identity and the per-owner limits.
  if (segments[1] === 'internal')
    return handleInternalItems(request, env, (p) => executionCtx?.waitUntil(p));

  // Who is calling (docs/specs/014-identity/auth-and-guest-access.md): a liveworkspace access token or guest token,
  // verified once here against the accounts Worker's keys. Null when sign-in isn't configured, no Bearer was sent
  // (a link visitor with no identity yet), or the token failed verification.
  const person = await getPersonIdentity(env, request);
  const account = person?.kind === 'account' ? person : null;
  const accountUserId = account?.userId ?? null;
  // The caller's address. ONLY the verified `email` claim from the checked access token is trusted, never a
  // client-supplied header.
  const accountEmail = account?.email ?? null;
  // API token (docs/specs/015-api/public-api-and-tokens.md): a `Bearer lwt_…` resolves to its owner — always a
  // account — via the hashed-token lookup. Only consulted when no account
  // access token verified (a token and a JWT can't both be the bearer). The resolved
  // owner is the token's account id, so a token request flows through the
  // exact same ownership / gate checks as a signed-in one.
  let tokenAuth: ResolvedApiToken | null = null;
  if (!person) {
    const bearer = bearerTokenOf(request.headers.get('Authorization'));
    // A bearer that carries the token prefix claims to be a token even when it is cut short or mistyped (a
    // copy-paste slip): it is refused as one below, never read as a guest or handed to the account path.
    if (bearer?.startsWith(API_TOKEN_PREFIX)) {
      // The token is the liveworkspace account's, checked with liveworkspace (db/api-tokens.ts). When
      // liveworkspace can't answer, the token is neither good nor bad: 503, so a client retries rather
      // than drops its credential.
      try {
        tokenAuth = isApiTokenFormat(bearer) ? await resolveApiToken(env, bearer) : null;
      } catch (err) {
        if (!(err instanceof AccountsUnavailable)) throw err;
        return json(
          { error: 'accounts_unavailable' },
          { status: 503, headers: { 'Retry-After': '5' } },
        );
      }
      // A token-shaped bearer claims to be a token: unknown, revoked or expired, it is refused here, never
      // read as a guest or as nobody (docs/specs/015-api/public-api-and-tokens.md §3.3).
      if (!tokenAuth) {
        console.warn('[tokens] invalid bearer refused', { path: url.pathname });
        return json(
          { error: 'invalid_token' },
          { status: 401, headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' } },
        );
      }
    }
  }
  // Workbench session (docs/specs/013-workspace/workbench-embeds.md): a `Bearer lvw_…` is a person's editor
  // on one project, minted from their token's ticket. Consulted only when neither an account access token nor a token
  // resolved. A session-shaped bearer that does not resolve is refused, never read as a guest. A resolved one
  // is confined at once (auth/workbench-confinement.ts): another project reads as absent, any route outside
  // the allow-list is refused, and a view session writes nothing.
  let workbench: WorkbenchContext | null = null;
  if (!person && !tokenAuth) {
    const bearer = bearerTokenOf(request.headers.get('Authorization'));
    if (bearer?.startsWith(WORKBENCH_SESSION_PREFIX)) {
      // Cut short or mistyped, a session-shaped bearer is refused as a session too (as a token is, above).
      const resolved = isWorkbenchSessionFormat(bearer)
        ? await resolveWorkbenchSession(env, bearer, Date.now())
        : ({ ok: false, reason: 'malformed', sessionPrefix: '' } as const);
      if (!resolved.ok) {
        console.warn('[workbench] bearer-refused', {
          reason: resolved.reason,
          sessionPrefix: resolved.sessionPrefix,
        });
        return json(
          { error: 'invalid_session' },
          { status: 401, headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' } },
        );
      }
      workbench = resolved.workbench;
      const refusal = workbenchRefusal(workbench, request.method, segments, request.headers);
      if (refusal) return refusal;
    }
  }
  const guestId = person?.kind === 'guest' ? person.guestId : null;
  // The caller's id: an account (signed in, or behind an API token or a workbench session), else a guest.
  const resolveOwner = (): string | null =>
    accountUserId ?? tokenAuth?.ownerId ?? workbench?.ownerId ?? guestId;
  // Server-verified account id from either credential (session JWT or API token): the account-only surfaces
  // read it. A guest is never one.
  const verifiedUserId = accountUserId ?? tokenAuth?.ownerId ?? workbench?.ownerId ?? null;
  // The teams the caller has joined, from its token: what GET /api/teams lists, and what the index is told
  // when this api asks it on an API token's behalf. A workbench session carries its token's.
  const teams = account?.teams ?? tokenAuth?.teams ?? workbench?.teams ?? null;

  // Per-owner write rate limit. Gates POST / PUT / DELETE at a
  // generous ceiling (wrangler.toml WRITE_RATE_LIMITER) so a bot
  // pacing under Cloudflare's DDoS threshold still can't spam
  // project creation through to D1 quota
  // exhaustion. Reads pass through untouched. When no token
  // resolves the caller (a link visitor with no identity), fall back to
  // a per-network 'anonymous' key so one unauthenticated client still
  // can't burn the global quota. The telemetry relay (/api/events)
  // is deliberately exempt: it's anonymous, high-frequency, and
  // must never compete with a user's real project writes for the
  // per-owner write budget (docs/specs/017-telemetry/telemetry.md). Client-side batching keeps
  // its volume low instead.
  const isWrite =
    request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE';
  // Read-only token enforcement (docs/specs/015-api/mcp-server.md §4.11): a token minted read-only may
  // only GET/HEAD. Reject every write it presents at this single choke point
  // — so no write route can be reached, present or future, with no per-route
  // changes. signed-in sessions and full tokens are unaffected (tokenAuth is null
  // or readOnly false). A guest's requests carry no tokenAuth either.
  // A token revoking itself escalates nothing, so any token may (docs/specs/015-api/blueprints/cli.md).
  const isSelfRevoke =
    request.method === 'DELETE' && segments[1] === 'tokens' && segments[2] === 'current';
  // Opening and pairing a workbench write nothing a read-only token could misuse: its ticket is minted view-only, so
  // a view token gives a read-only frame (docs/specs/013-workspace/workbench-embeds.md).
  const isWorkbenchAsk =
    request.method === 'POST' &&
    segments.length === 3 &&
    segments[1] === 'workbench' &&
    (segments[2] === 'tickets' || segments[2] === 'pairing-requests');
  if (tokenAuth?.readOnly && isWrite && !isSelfRevoke && !isWorkbenchAsk) {
    return forbidden('read_only_token');
  }
  // Reject oversized bodies up front (cheap Content-Length gate) so a hostile
  // payload never reaches a route's req.json(). The per-field / per-tab caps
  // in the routes catch the rest; this is the blunt outer bound.
  if (isWrite) {
    const len = Number(request.headers.get('content-length'));
    if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
      return payloadTooLarge();
    }
  }
  // Room-ticket mints (docs/specs/015-api/api.md) are exempt like /api/events: the mint
  // is the auth handshake for opening the realtime room, and a 429 —
  // easily reached because it shares the per-owner budget with the
  // ~600ms autosave PUTs — would silently cost a team member their
  // whole session's realtime (the connector has no reconnect loop).
  // Mint volume is one per room join and the route does no
  // unbounded work, so it isn't a quota-exhaustion vector.
  const isRoomTicketMint = segments[1] === 'projects' && segments[3] === 'room-ticket';
  // ...but not unthrottled: each mint may ask the index for a grant. Its own bucket per
  // caller network, so a flood is bounded without touching anyone's autosave budget.
  if (isRoomTicketMint && isWrite && env.WRITE_RATE_LIMITER) {
    if (await isWriteRateLimited(env, `room-ticket:${clientRateKey(request)}`))
      return rateLimited();
  }
  // A form link's doors (docs/specs/030-forms/forms.md "Abuse and limits"): respondents are anonymous, so reads and
  // responses are limited per network, each on its own key, apart from everyone's project writes.
  const isFormRequest = segments[1] === 'forms';
  if (isFormRequest && env.FORM_RATE_LIMITER) {
    const ok = await env.FORM_RATE_LIMITER.limit({
      key: `${isWrite ? 'form' : 'form-read'}:${clientNetwork(clientIp(request))}`,
    });
    if (!ok.success) return rateLimited();
  }
  if (isWrite && url.pathname !== '/api/events' && !isRoomTicketMint && !isFormRequest) {
    // A token request rate-limits on the TOKEN id (docs/specs/015-api/public-api-and-tokens.md §3.5), so a
    // runaway integration is throttled independently of the owner's
    // interactive app use; everything else keys on the resolved owner.
    // A caller with no identity (a link visitor) is keyed on its
    // network, not one global 'anonymous' bucket every new visitor shares.
    // A workbench session's writes key on the session (WB10), apart from its owner's own app use.
    const key = tokenAuth
      ? `token:${tokenAuth.tokenId}`
      : workbench
        ? `workbench:${workbench.sessionId}`
        : (resolveOwner() ?? `anonymous:${clientRateKey(request)}`);
    if (await isWriteRateLimited(env, key)) return rateLimited();
  }
  // Token-authed READS (docs/specs/015-api/public-api-and-tokens.md §3.5): GETs under a token aren't covered by
  // the write limiter, so an external integration's reads get their own
  // per-token throttle. Optional binding → allow when absent (a deployment without it).
  if (tokenAuth && request.method === 'GET' && env.API_TOKEN_READ_RATE_LIMITER) {
    const ok = await env.API_TOKEN_READ_RATE_LIMITER.limit({ key: `token:${tokenAuth.tokenId}` });
    if (!ok.success) return rateLimited();
  }

  // Throttle blind share-code / password guessing on the share-resolve
  // read (GET /api/share/<code>), which carries the optional share
  // password and is otherwise an unauthenticated read exempt from the
  // write limiter above. Per-IP. Absent binding → allow (a deployment without it).
  // A link's previews are liveworkspace's (liveworkspace/docs/previews.md), so only the resolve itself counts here.
  if (request.method === 'GET' && segments[1] === 'share' && env.SHARE_RATE_LIMITER) {
    const key = clientRateKey(request);
    if (!(await env.SHARE_RATE_LIMITER.limit({ key })).success) return rateLimited();
  }

  // Dispatch on the resource segment to its route module. Each
  // handler owns every request for its segment and returns
  // notFound() for sub-paths / methods it doesn't recognise, so an
  // unmatched resource OR an unmatched sub-route both fall through
  // to the final notFound() (preserving the original behaviour).
  const ctx: RouteContext = {
    request,
    env,
    url,
    segments,
    accountUserId,
    verifiedUserId,
    accountEmail,
    resolveOwner,
    token: tokenAuth
      ? {
          id: tokenAuth.tokenId,
          readOnly: tokenAuth.readOnly,
          name: tokenAuth.name,
          expiresAt: tokenAuth.expiresAt,
        }
      : null,
    workbench,
    teams,
    // The browser's own token, which the index takes as it is; an API token's or a workbench session's account
    // is vouched for with this app's key instead (index-service.ts).
    bearer: person ? bearerTokenOf(request.headers.get('Authorization')) : null,
    waitUntil: (promise) => executionCtx?.waitUntil(promise),
  };
  try {
    switch (segments[1]) {
      case 'capabilities':
        return handleCapabilities(ctx);
      case 'templates':
      case 'schema':
        return handleCatalogues(ctx);
      case 'openapi.json':
        return handleOpenapi(ctx);
      case 'unfurl':
        return await handleUnfurl(ctx);
      case 'events':
        return await handleEvents(ctx);
      case 'share':
        return await handleShare(ctx);
      case 'projects':
        return await handleProjects(ctx);
      case 'folders':
        return await handleFolders(ctx);
      // A form link's public doors (docs/specs/030-forms/forms.md "Filling in a form").
      case 'forms':
        return await handleForms(ctx);
      case 'teams':
        return await handleTeams(ctx);
      case 'tokens':
        return await handleTokens(ctx);
      case 'oauth':
        return await handleOauthExchange(ctx);
      case 'account':
        return await handleAccount(ctx);
      case 'trash':
        return await handleTrash(ctx);
      case 'preferences':
        return await handlePreferences(ctx);
      case 'participants':
        return await handleParticipants(ctx);
      case 'workbench':
        return await handleWorkbench(ctx);
    }
  } catch (err) {
    // Log the real error server-side, but don't echo its message to the
    // client — internal error text can leak implementation details (table
    // names, stack hints). Return a generic body instead.
    console.error('api error', err);
    // Self-report the crash (docs/specs/017-telemetry/telemetry.md 'Error' category), so a
    // server-side exception counts even when no client survives to report it.
    // Off the response's critical path (waitUntil), and its own failure is
    // swallowed — the 500 must still go out. The type names the endpoint by its
    // route words only (`Internal.Put.Projects.Tabs`), never an id.
    if (telemetryEnabled(env)) {
      const type = errorTypeToken('Internal', apiRouteLabel(request.method, url.pathname));
      executionCtx?.waitUntil?.(reportServerEvent(env, 'Error', 'Api', type));
    }
    return json({ error: 'internal_error' }, { status: 500 });
  }

  return notFound();
}

const worker = {
  // Every response carries the server release signal (docs/specs/016-platform/new-version-prompt.md, stale-builds.md).
  async fetch(request: Request, env: Env, executionCtx?: ExecutionContext): Promise<Response> {
    return withServerRelease(await routeApiRequest(request, env, executionCtx), env.BUILD_ID);
  },
} satisfies ExportedHandler<Env>;

export default worker;
