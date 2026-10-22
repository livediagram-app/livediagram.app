import { runTabStatsBackfill } from './tab-stats-backfill';
import { getAccountIdentity } from './auth/accounts';
import { handleAuth } from './routes/auth';
import { emailEnabled } from './email/client';
import { runLifecycleSweep, welcomeOnSighting } from './email/lifecycle';
import { runTokenExpirySweep } from './email/token-expiry';
import { runTeamInviteSweep } from './email/team-invite-reminders';
import { NOTIFY_EMAIL_DEDUPE_MS } from './email/notifications';
import { runTimelineExpirySweep } from './timeline';
import {
  deleteOldEvents,
  deleteOldChangesets,
  deleteOldNotifyEmailClaims,
  deleteOldTimelineEvents,
  purgeExpiredTrash,
  resolveApiToken,
  trashEmptyDocuments,
} from './db';
import {
  apiRouteLabel,
  CHANGESET_RETENTION_MS,
  bearerTokenOf,
  errorTypeToken,
  isAccountIdShape,
  TIMELINE_RETENTION_MS,
} from '@liveplanner/api-schema';
import {
  API_TOKEN_PREFIX,
  isApiTokenFormat,
  isWorkbenchSessionFormat,
  WORKBENCH_SESSION_PREFIX,
} from '@liveplanner/api-schema';
import { verifyOwnerId } from './auth/owner-signature';
import { guestSignatureEnforced, OWNER_SCOPED_SEGMENTS } from './auth/guest-rest';
import { handleTokens } from './routes/tokens';
import { handleOauthExchange } from './routes/oauth';
import { DocumentRoom } from './document-room';
import { CORS_HEADERS, forbidden, json, notFound, payloadTooLarge, rateLimited } from './responses';
import { insertTelemetryEvents } from './db/telemetry';
import { deleteOldDocumentOpens } from './db/document-opens';
import { clientIp, clientNetwork, clientRateKey } from './client-ip';
import { MAX_BODY_BYTES } from './limits';
import { handleAccount } from './routes/account';
import { handleAi } from './routes/ai';
import { handleCatalogues } from './routes/catalogues';
import { handleCapabilities } from './routes/capabilities';
import { handleOpenapi } from './routes/openapi';
import { handleCustomThemes } from './routes/custom-themes';
import { handleUnfurl } from './routes/unfurl';
import type { RouteContext, WorkbenchContext } from './routes/context';
import { handleDocuments } from './routes/documents';
import { handleEvents } from './routes/events';
import { handleFolders } from './routes/folders';
import { handleForms } from './routes/forms';
import { handleMigrate } from './routes/migrate';
import { handleGuestId } from './routes/guest-id';
import { handleParticipants } from './routes/participants';
import { handleFavourites } from './routes/favourites';
import { handleTags } from './routes/tags';
import { handlePlacementDefaults } from './routes/placement-defaults';
import { handleTimeline } from './routes/timeline';
import { handleActivity } from './routes/activity';
import { handleHome } from './routes/home';
import { handlePreferences } from './routes/preferences';
import { handleShare } from './routes/share';
import { isSharePreviewPath } from './routes/share-preview';
import { handleTeams } from './routes/teams';
import { handleShared } from './routes/shared';
import { handleTelemetry } from './routes/telemetry';
import { handleTrash } from './routes/trash';
import { handleWorkbench } from './routes/workbench';
import { resolveWorkbenchSession } from './auth/workbench-session';
import { workbenchRefusal } from './auth/workbench-confinement';
import { sweepWorkbench } from './db/workbench';
import { withServerRelease } from './server-release-header';
import type { Env } from './types';
import { runSheetExpiry } from './sheet-sweep';

export { DocumentRoom };

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

// Owners whose first-sighting write already ran in this isolate — see
// the welcomeOnSighting call below.
const sightedThisIsolate = new Set<string>();

// Every request the worker answers; `fetch` below stamps the document format number on it.
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

  // Hybrid identity (docs/specs/014-identity/auth-and-guest-access.md). Verify the accounts
  // access token once at the top of the handler: null when sign-in isn't configured, no Bearer
  // was sent, or the token failed verification. Every dispatch site below uses `resolveOwner()`
  // instead of the legacy `ownerOf(request)`, so a signed-in user's documents come back under
  // their account id and guests keep working via the legacy `X-Owner-Id` header.
  const accountIdentity = await getAccountIdentity(env, request);
  const accountUserId = accountIdentity?.userId ?? null;
  // Email used for team-invite matching (docs/specs/013-workspace/teams.md). ONLY the verified
  // `email` claim from the checked access token is trusted, never a client-supplied header: a
  // `X-Owner-Email` fallback used to exist here, and it let a signed-in caller forge another
  // address and claim that address's pending team invites. See auth/accounts.ts.
  const accountEmail = accountIdentity?.email ?? null;
  // docs/specs/014-identity/transactional-email.md: first authenticated sighting => sign-up. Fire-and-forget (the
  // sighting + welcome run in the background) so it never delays the response;
  // a no-op when RESEND_API_KEY is unset.
  if (
    accountUserId &&
    accountEmail &&
    emailEnabled(env) &&
    !sightedThisIsolate.has(accountUserId)
  ) {
    // Once per isolate, not per request: a signed-in editor autosaves
    // every ~600ms, and each request was scheduling a (no-op after the
    // first) INSERT OR IGNORE into email_lifecycle — ~100 wasted D1
    // writes a minute. The INSERT stays idempotent, so a cold isolate
    // simply pays it once more.
    sightedThisIsolate.add(accountUserId);
    executionCtx?.waitUntil(welcomeOnSighting(env, accountUserId, accountEmail));
  }
  // API token (docs/specs/015-api/public-api-and-tokens.md): a `Bearer lvd_…` resolves to its owner — always a
  // account — via the hashed-token lookup. Only consulted when no account
  // access token verified (a token and a JWT can't both be the bearer). The resolved
  // owner is the token's account id, so a token request flows through the
  // exact same ownership / gate checks as a signed-in one.
  let tokenAuth: { ownerId: string; tokenId: string; readOnly: boolean } | null = null;
  if (!accountUserId) {
    const bearer = bearerTokenOf(request.headers.get('Authorization'));
    // A bearer that carries the token prefix claims to be a token even when it is cut short or mistyped (a
    // copy-paste slip): it is refused as one below, never read as a guest or handed to the account path.
    if (bearer?.startsWith(API_TOKEN_PREFIX)) {
      tokenAuth = isApiTokenFormat(bearer) ? await resolveApiToken(env, bearer) : null;
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
  // on one document, minted from their token's ticket. Consulted only when neither an account access token nor a token
  // resolved. A session-shaped bearer that does not resolve is refused, never read as a guest. A resolved one
  // is confined at once (auth/workbench-confinement.ts): another document reads as absent, any route outside
  // the allow-list is refused, and a view session writes nothing.
  let workbench: WorkbenchContext | null = null;
  if (!accountUserId && !tokenAuth) {
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
  // An empty guest header is no identity at all: as '' it would be one shared,
  // writable owner namespace (and one shared rate-limit bucket) for everyone.
  const resolveOwner = (): string | null =>
    accountUserId ??
    tokenAuth?.ownerId ??
    workbench?.ownerId ??
    (request.headers.get('X-Owner-Id') || null);
  // Server-verified account id from either credential (session JWT
  // or API token). Feeds the team-membership content gates + teams-surface
  // reads (see RouteContext.verifiedUserId); administration surfaces keep
  // reading `accountUserId` directly.
  const verifiedUserId = accountUserId ?? tokenAuth?.ownerId ?? workbench?.ownerId ?? null;

  // An account id presented as the GUEST header is always a replay of
  // a harvested id, never a real client (see auth/guest-rest.ts): the guest
  // credential is a server-minted UUID, and a signed-in caller sends
  // `Authorization` instead. Refused unconditionally, BEFORE the signature
  // gate below, because that gate is off until an operator arms it — and
  // this shape needs no grace window, having never been legitimate.
  // `share` is included even though it is not owner-scoped: its resolver
  // compares the header with the document's owner to decide redaction.
  if (
    !accountUserId &&
    !tokenAuth &&
    !workbench &&
    (OWNER_SCOPED_SEGMENTS.has(segments[1] ?? '') || segments[1] === 'share')
  ) {
    const headerOwner = request.headers.get('X-Owner-Id');
    if (headerOwner && isAccountIdShape(headerOwner)) {
      return json({ error: 'account_id_not_a_guest_credential' }, { status: 401 });
    }
  }

  // Guest REST signature gate (docs/specs/015-api/public-api-and-tokens.md §4). On owner-scoped routes, a
  // presented `X-Owner-Id` must carry a valid HMAC signature once
  // enforcement is on — so a harvested owner id (a guest UUID, or a
  // signed-up user's account `sub` slipped into the header) can't be used as a
  // credential. Skipped for signed-in / token callers (they aren't on the guest
  // path) and during the grace window. A request with NO `X-Owner-Id` is
  // untouched (it just resolves to no owner), so public reads still work.
  if (
    !accountUserId &&
    !tokenAuth &&
    !workbench &&
    OWNER_SCOPED_SEGMENTS.has(segments[1] ?? '') &&
    guestSignatureEnforced(env, Date.now())
  ) {
    const headerOwner = request.headers.get('X-Owner-Id');
    if (
      headerOwner &&
      !(await verifyOwnerId(
        env.GUEST_ID_HMAC_SECRET,
        headerOwner,
        request.headers.get('X-Owner-Sig'),
      ))
    ) {
      return json({ error: 'signature_required' }, { status: 401 });
    }
  }

  // Per-owner write rate limit. Gates POST / PUT / DELETE at a
  // generous ceiling (wrangler.toml WRITE_RATE_LIMITER) so a bot
  // pacing under Cloudflare's DDoS threshold still can't spam
  // document creation through to D1 quota
  // exhaustion. Reads pass through untouched. When neither a
  // account token nor X-Owner-Id resolves the caller, fall back to
  // a literal 'anonymous' key so one unauthenticated client still
  // can't burn the global quota. Telemetry ingest (/api/events)
  // is deliberately exempt: it's anonymous, high-frequency, and
  // must never compete with a user's real document writes for the
  // per-owner write budget (docs/specs/017-telemetry/telemetry.md). Client-side batching keeps
  // its volume low instead.
  const isWrite =
    request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE';
  // Read-only token enforcement (docs/specs/015-api/mcp-server.md §4.11): a token minted read-only may
  // only GET/HEAD. Reject every write it presents at this single choke point
  // — so no write route can be reached, present or future, with no per-route
  // changes. signed-in sessions and full tokens are unaffected (tokenAuth is null
  // or readOnly false). Guest header requests carry no tokenAuth either.
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
  // One read is a credential, not content: the share-link list carries every
  // code (edit links included), so a read-only token that could list it could
  // promote itself to edit by opening a link.
  const isShareLinkList =
    segments[1] === 'documents' && segments.length === 4 && segments[3] === 'share';
  if (tokenAuth?.readOnly && isShareLinkList) {
    console.warn('[read-only-token] share-link list refused', { tokenId: tokenAuth.tokenId });
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
  // Mint volume is one row per room join and the route does no
  // unbounded work, so it isn't a quota-exhaustion vector.
  const isRoomTicketMint = segments[1] === 'documents' && segments[3] === 'room-ticket';
  // ...but not unthrottled: each mint is a D1 write. Its own bucket per
  // caller network (the owner id is caller-chosen for a guest), so a flood is
  // bounded without touching anyone's autosave budget.
  if (isRoomTicketMint && isWrite && env.WRITE_RATE_LIMITER) {
    if (await isWriteRateLimited(env, `room-ticket:${clientRateKey(request)}`))
      return rateLimited();
  }
  // A form link's doors (docs/specs/030-forms/forms.md "Abuse and limits"): respondents are anonymous, so reads and
  // responses are limited per network, each on its own key, apart from everyone's document writes.
  const isFormRequest = segments[1] === 'forms';
  if (isFormRequest && env.FORM_RATE_LIMITER) {
    const ok = await env.FORM_RATE_LIMITER.limit({
      key: `${isWrite ? 'form' : 'form-read'}:${clientNetwork(clientIp(request))}`,
    });
    if (!ok.success) return rateLimited();
  }
  // An invite email's Decline link (docs/specs/013-workspace/teams.md "Declining from the email"): open, so
  // limited per network, reads and declines on one key, apart from everyone's document writes.
  const isInviteDecline = segments[1] === 'teams' && segments[2] === 'invite-decline';
  if (isInviteDecline && env.TEAM_INVITE_RATE_LIMITER) {
    const ok = await env.TEAM_INVITE_RATE_LIMITER.limit({
      key: `invite-decline:${clientNetwork(clientIp(request))}`,
    });
    if (!ok.success) return rateLimited();
  }
  if (
    isWrite &&
    url.pathname !== '/api/events' &&
    !isRoomTicketMint &&
    !isFormRequest &&
    !isInviteDecline
  ) {
    // A token request rate-limits on the TOKEN id (docs/specs/015-api/public-api-and-tokens.md §3.5), so a
    // runaway integration is throttled independently of the owner's
    // interactive app use; everything else keys on the resolved owner.
    // A caller with no identity yet (minting a guest id) is keyed on its
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
  // A link preview's two reads (docs/specs/013-workspace/share-link-previews.md) take their own bucket, so a room
  // of people opening one link together never spends the editor's share resolve on previews.
  if (request.method === 'GET' && segments[1] === 'share' && env.SHARE_RATE_LIMITER) {
    const ip = clientRateKey(request);
    const key = isSharePreviewPath(segments) ? `share-preview:${ip}` : ip;
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
    token: tokenAuth ? { id: tokenAuth.tokenId, readOnly: tokenAuth.readOnly } : null,
    workbench,
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
      case 'ai':
        // The assistant (docs/specs/007-editor/ai-assistance.md) at /api/ai.
        if (segments[2] === undefined) return await handleAi(ctx);
        return notFound();
      case 'events':
        return await handleEvents(ctx);
      case 'telemetry':
        return await handleTelemetry(ctx);
      case 'share':
        return await handleShare(ctx);
      case 'shared':
        return await handleShared(ctx);
      case 'documents':
        return await handleDocuments(ctx);
      case 'folders':
        return await handleFolders(ctx);
      // A form link's public doors (docs/specs/030-forms/forms.md "Filling in a form").
      case 'forms':
        return await handleForms(ctx);
      case 'custom-themes':
        return await handleCustomThemes(ctx);
      case 'teams':
        return await handleTeams(ctx);
      case 'tokens':
        return await handleTokens(ctx);
      case 'oauth':
        return await handleOauthExchange(ctx);
      case 'account':
        return await handleAccount(ctx);
      case 'favourites':
        return await handleFavourites(ctx);
      // Per-person document tags (docs/specs/013-workspace/tags.md).
      case 'tags':
        return await handleTags(ctx);
      case 'placement-defaults':
        return await handlePlacementDefaults(ctx);
      case 'trash':
        return await handleTrash(ctx);
      case 'timeline':
        return await handleTimeline(ctx);
      case 'activity':
        return await handleActivity(ctx);
      case 'home':
        return await handleHome(ctx);
      case 'preferences':
        return await handlePreferences(ctx);
      case 'migrate':
        return await handleMigrate(ctx);
      case 'guest-id':
        return await handleGuestId(ctx);
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
    // Self-report the crash to the events table (docs/specs/017-telemetry/telemetry.md 'Error'
    // category): the worker owns the D1 binding, so a server-side
    // exception counts even when no client survives to report it.
    // Same TELEMETRY_ENABLED gate as the ingest; off the response's
    // critical path (waitUntil), and its own failure is swallowed —
    // the 500 must still go out. The type names the endpoint by its
    // route words only (`Internal.Put.Documents.Tabs`), never an id.
    if (env.TELEMETRY_ENABLED === 'true') {
      const type = errorTypeToken('Internal', apiRouteLabel(request.method, url.pathname));
      const report = insertTelemetryEvents(
        env,
        [{ category: 'Error', action: 'Api', type }],
        Date.now(),
      ).catch(() => {});
      executionCtx?.waitUntil?.(report);
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

  // Scheduled handler. Wired to the cron schedule in wrangler.toml.
  // One worker invocation per `triggers.crons` entry; dispatch on
  // `event.cron` for each pattern. Today's daily 03:00 UTC trigger
  // fires independent retention sweeps:
  //   - events,     60-day floor (docs/specs/017-telemetry/telemetry.md "Retention").
  //   - trash,      30 days after deletion (docs/specs/013-workspace/trash.md).
  //   - empty,      documents empty and unsaved for 30 days move to the Trash
  //                 (docs/specs/013-workspace/empty-document-cleanup.md).
  // All are no-ops when nothing is over the floor; all use
  // `ctx.waitUntil` so they run concurrently and the worker can
  // exit as soon as the schedule callback returns.
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (event.cron === '0 3 * * *') {
      const now = Date.now();
      scheduleSweep(ctx, env, 'events', 'rows', now - EVENTS_RETENTION_MS, deleteOldEvents);
      // docs/specs/013-workspace/timeline.md §3.5: the Timeline feed keeps a year.
      scheduleSweep(
        ctx,
        env,
        'timeline',
        'events',
        now - TIMELINE_RETENTION_MS,
        deleteOldTimelineEvents,
      );
      // docs/specs/013-workspace/explorer-home.md "Opens": an open older than the Timeline's year
      // is forgotten, the same retention as the events it sits beside.
      scheduleSweep(
        ctx,
        env,
        'home_opens',
        'rows',
        now - TIMELINE_RETENTION_MS,
        deleteOldDocumentOpens,
      );
      // docs/specs/024-agents/agent-changesets.md "Revert": a changeset can be reverted while its
      // record exists, as long as the Trash keeps a document (CS28).
      scheduleSweep(
        ctx,
        env,
        'changesets',
        'rows',
        now - CHANGESET_RETENTION_MS,
        deleteOldChangesets,
      );
      // docs/specs/012-collaboration/assigned-actions.md §4: a notify-email claim past its dedupe window
      // decides nothing any more.
      scheduleSweep(
        ctx,
        env,
        'notify_email_claims',
        'rows',
        now - NOTIFY_EMAIL_DEDUPE_MS,
        deleteOldNotifyEmailClaims,
      );
      // docs/specs/029-sheets/sheet-store.md "Deleting a sheet": delete sheets unreferenced for 30 days.
      ctx.waitUntil(
        runSheetExpiry(env).catch((err) => console.error('[sheets] sheets.expired failed', err)),
      );
      // docs/specs/014-identity/transactional-email.md: send any due onboarding emails (welcome catch-up + week 1 / 2).
      // No-op when RESEND_API_KEY is unset.
      ctx.waitUntil(runLifecycleSweep(env));
      // docs/specs/013-workspace/teams.md "Reminders and expiry": expire invites nobody answered in 28 days
      // (always), then send the 1 / 7 / 21-day reminders (email only). Logs its own outcome.
      ctx.waitUntil(
        runTeamInviteSweep(env, now)
          .then(() => undefined)
          .catch((err) => console.error('[team-invites] sweep failed', err)),
      );
      // docs/specs/014-identity/transactional-email.md (#3): warn owners whose API token is within a week of expiry.
      ctx.waitUntil(runTokenExpirySweep(env));
      // docs/specs/013-workspace/timeline.md §4.5: the same window, on the Timeline. Separate from
      // the email sweep above because that one no-ops without a Resend
      // key, and a deployment with no email provider still needs to know
      // its integration is about to break.
      ctx.waitUntil(
        runTimelineExpirySweep(env)
          .then((count) => console.log(`timeline expiry sweep: emitted ${count} events`))
          .catch((err) => console.error('timeline expiry sweep failed', err)),
      );
      // docs/specs/013-workspace/trash.md: purge what has been in the Trash for
      // 30 days, oldest first, capped per run (TRASH_PURGE_MAX_BATCHES).
      ctx.waitUntil(
        purgeExpiredTrash(env, now)
          .then((count) => console.log(`trash sweep: purged ${count} documents`))
          .catch((err) => console.error('trash sweep failed', err)),
      );
      // docs/specs/013-workspace/empty-document-cleanup.md: move documents empty and
      // unsaved for 30 days to the Trash, stamped `now`, so the purge above
      // never takes one this run: it waits its full 30 days there.
      ctx.waitUntil(
        trashEmptyDocuments(env, now)
          .then((count) => console.log(`empty sweep: moved ${count} documents to the Trash`))
          .catch((err) => console.error('empty sweep failed', err)),
      );
      // docs/specs/013-workspace/explorer-details-view.md "Counting the existing tabs": count the
      // tabs written before tab stats existed, a bounded number a run. Logs its own outcome.
      ctx.waitUntil(
        runTabStatsBackfill(env)
          .then(() => undefined)
          .catch((err) => console.error('tab-stats: backfill failed', err)),
      );
      // docs/specs/013-workspace/blueprints/workbench-embeds.md "Retention": spent tickets and requests,
      // sessions past their grace, pairings of tokens no longer live.
      ctx.waitUntil(
        sweepWorkbench(env, now)
          .then((count) => console.log(`workbench sweep: deleted ${count} rows`))
          .catch((err) => console.error('workbench sweep failed', err)),
      );
    }
  },
} satisfies ExportedHandler<Env>;

export default worker;

// Run one daily retention sweep in the background: delete rows older than
// `cutoff`, then log the count (or the failure) to `wrangler tail`. The
// retention sweeps (events / sessions / timeline / opens) share this exact waitUntil +
// then/catch shape; `label` + `unit` keep each log line reading naturally. A
// zero is the normal case most days — observability without a metrics pipeline.
function scheduleSweep(
  ctx: ExecutionContext,
  env: Env,
  label: string,
  unit: string,
  cutoff: number,
  deleteOlderThan: (env: Env, cutoff: number) => Promise<number>,
): void {
  ctx.waitUntil(
    deleteOlderThan(env, cutoff)
      .then((count) => {
        console.log(`${label} sweep: deleted ${count} ${unit} older than ${cutoff}`);
      })
      .catch((err) => {
        console.error(`${label} sweep failed`, err);
      }),
  );
}

// 60 days in ms. The /telemetry dashboard's longest window is
// "Last 30 days", so anything past 60 days is dead storage (twice
// the surfaced window, leaving headroom for a future "Last 60
// days" view to populate). See docs/specs/017-telemetry/telemetry.md "Retention".
const EVENTS_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;
