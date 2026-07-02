import { getClerkIdentity } from './auth/clerk';
import { emailEnabled } from './email/client';
import { runLifecycleSweep, welcomeOnSighting } from './email/lifecycle';
import { runTokenExpirySweep } from './email/token-expiry';
import {
  deleteOldChangeLogEntries,
  deleteOldEvents,
  deleteOldUnusedImages,
  resolveApiToken,
} from './db';
import { isApiTokenFormat } from './auth/api-token';
import { verifyOwnerId } from './auth/owner-signature';
import { guestSignatureEnforced, OWNER_SCOPED_SEGMENTS } from './auth/guest-rest';
import { handleTokens } from './routes/tokens';
import { handleOauthExchange } from './routes/oauth';
import { DiagramRoom } from './diagram-room';
import { CORS_HEADERS, json, notFound, rateLimited } from './responses';
import { clientIp } from './client-ip';
import { MAX_BODY_BYTES, MAX_IMAGE_BYTES } from './limits';
import { handleAccount } from './routes/account';
import { handleAi } from './routes/ai';
import { handleCapabilities } from './routes/capabilities';
import { handleOpenapi } from './routes/openapi';
import { handleCustomThemes } from './routes/custom-themes';
import { handleUnfurl } from './routes/unfurl';
import type { RouteContext } from './routes/context';
import { handleDiagrams } from './routes/diagrams';
import { handleEvents } from './routes/events';
import { handleFolders } from './routes/folders';
import { handleImages } from './routes/images';
import { handleMigrate } from './routes/migrate';
import { handleGuestId } from './routes/guest-id';
import { handleParticipants } from './routes/participants';
import { handlePreferences } from './routes/preferences';
import { handleShare } from './routes/share';
import { handleTeams } from './routes/teams';
import { handleShared } from './routes/shared';
import { handleTelemetry } from './routes/telemetry';
import type { Env } from './types';

export { DiagramRoom };

// Per-owner write rate limit (security audit item). Returns true
// when the caller is over the configured cap (wrangler.toml's
// WRITE_RATE_LIMITER binding) so the endpoint can short-circuit
// with a 429. Falls through to "allowed" when the binding is
// absent so self-host deployments without the feature still serve.
async function isWriteRateLimited(env: Env, ownerId: string): Promise<boolean> {
  if (!env.WRITE_RATE_LIMITER) return false;
  const result = await env.WRITE_RATE_LIMITER.limit({ key: ownerId });
  return !result.success;
}

export default {
  async fetch(request: Request, env: Env, executionCtx?: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const segments = url.pathname.replace(/^\//, '').split('/');
    if (segments[0] !== 'api') return notFound();

    // Hybrid identity (spec/04). Verify a Clerk Bearer token once at
    // the top of the handler — null when `CLERK_JWKS_URL` is unset,
    // no Bearer was sent, or the token failed verification. Every
    // dispatch site below uses `resolveOwner()` instead of the legacy
    // `ownerOf(request)`, so a signed-in user's diagrams come back
    // under their Clerk userId and guests keep working via the
    // legacy `X-Owner-Id` header.
    const clerkIdentity = await getClerkIdentity(env, request);
    const clerkUserId = clerkIdentity?.userId ?? null;
    // Email used for team-invite matching (spec/32). ONLY the verified
    // `email` claim from the JWKS-checked session token is trusted —
    // never a client-supplied header. A `X-Owner-Email` fallback used to
    // exist here, but it let a signed-in caller forge another address and
    // claim that address's pending team invites (join the team + read its
    // private library). Invite auto-connection now degrades gracefully to
    // off when the deployment hasn't added the email claim to the Clerk
    // session token (dashboard → Sessions → Customize session token →
    // `{"email": "{{user.primary_email_address}}"}`); see auth/clerk.ts.
    const clerkEmail = clerkIdentity?.email ?? null;
    // spec/64: first authenticated sighting => sign-up. Fire-and-forget (the
    // sighting + welcome run in the background) so it never delays the response;
    // a no-op when RESEND_API_KEY is unset.
    if (clerkUserId && clerkEmail && emailEnabled(env)) {
      executionCtx?.waitUntil(welcomeOnSighting(env, clerkUserId, clerkEmail));
    }
    // API token (spec/61): a `Bearer lvd_…` resolves to its owner — always a
    // Clerk account — via the hashed-token lookup. Only consulted when no Clerk
    // JWT verified (a token and a JWT can't both be the bearer). The resolved
    // owner is the token's Clerk userId, so a token request flows through the
    // exact same ownership / gate checks as a signed-in one.
    let tokenAuth: { ownerId: string; tokenId: string } | null = null;
    if (!clerkUserId) {
      const authz = request.headers.get('Authorization');
      const bearer = authz?.startsWith('Bearer ') ? authz.slice(7) : null;
      if (bearer && isApiTokenFormat(bearer)) tokenAuth = await resolveApiToken(env, bearer);
    }
    const resolveOwner = (): string | null =>
      clerkUserId ?? tokenAuth?.ownerId ?? request.headers.get('X-Owner-Id');

    // Guest REST signature gate (spec/61 §4). On owner-scoped routes, a
    // presented `X-Owner-Id` must carry a valid HMAC signature once
    // enforcement is on — so a harvested owner id (a guest UUID, or a
    // signed-up user's Clerk `sub` slipped into the header) can't be used as a
    // credential. Skipped for Clerk / token callers (they aren't on the guest
    // path) and during the grace window. A request with NO `X-Owner-Id` is
    // untouched (it just resolves to no owner), so public reads still work.
    if (
      !clerkUserId &&
      !tokenAuth &&
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
    // diagram / image creation through to D1 / R2 quota
    // exhaustion. Reads pass through untouched. When neither a
    // Clerk token nor X-Owner-Id resolves the caller, fall back to
    // a literal 'anonymous' key so one unauthenticated client still
    // can't burn the global quota. Telemetry ingest (/api/events)
    // is deliberately exempt: it's anonymous, high-frequency, and
    // must never compete with a user's real diagram writes for the
    // per-owner write budget (spec/22). Client-side batching keeps
    // its volume low instead.
    const isWrite =
      request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE';
    // Reject oversized bodies up front (cheap Content-Length gate) so a hostile
    // payload never reaches a route's req.json(). The per-field / per-tab caps
    // in the routes catch the rest; this is the blunt outer bound.
    if (isWrite) {
      const len = Number(request.headers.get('content-length'));
      // Image uploads carry raw bytes with their own, larger cap (spec/19);
      // the route re-checks it and answers with file_too_large + limitBytes.
      const cap = segments[1] === 'images' ? MAX_IMAGE_BYTES : MAX_BODY_BYTES;
      if (Number.isFinite(len) && len > cap) {
        return json({ error: 'payload_too_large' }, { status: 413 });
      }
    }
    if (isWrite && url.pathname !== '/api/events') {
      // A token request rate-limits on the TOKEN id (spec/61 §3.5), so a
      // runaway integration is throttled independently of the owner's
      // interactive app use; everything else keys on the resolved owner.
      const key = tokenAuth ? `token:${tokenAuth.tokenId}` : (resolveOwner() ?? 'anonymous');
      if (await isWriteRateLimited(env, key)) return rateLimited();
    }
    // Token-authed READS (spec/61 §3.5): GETs under a token aren't covered by
    // the write limiter, so an external integration's reads get their own
    // per-token throttle. Optional binding → allow when absent (self-host).
    if (tokenAuth && request.method === 'GET' && env.API_TOKEN_READ_RATE_LIMITER) {
      const ok = await env.API_TOKEN_READ_RATE_LIMITER.limit({ key: `token:${tokenAuth.tokenId}` });
      if (!ok.success) return rateLimited();
    }

    // Throttle blind share-code / password guessing on the share-resolve
    // read (GET /api/share/<code>), which carries the optional share
    // password and is otherwise an unauthenticated read exempt from the
    // write limiter above. Per-IP. Absent binding → allow (self-host).
    if (request.method === 'GET' && segments[1] === 'share' && env.SHARE_RATE_LIMITER) {
      const ip = clientIp(request);
      if (!(await env.SHARE_RATE_LIMITER.limit({ key: ip })).success) return rateLimited();
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
      clerkUserId,
      clerkEmail,
      resolveOwner,
      waitUntil: (promise) => executionCtx?.waitUntil(promise),
    };
    try {
      switch (segments[1]) {
        case 'capabilities':
          return handleCapabilities(ctx);
        case 'openapi.json':
          return handleOpenapi(ctx);
        case 'unfurl':
          return await handleUnfurl(ctx);
        case 'ai':
          return await handleAi(ctx);
        case 'events':
          return await handleEvents(ctx);
        case 'telemetry':
          return await handleTelemetry(ctx);
        case 'share':
          return await handleShare(ctx);
        case 'shared':
          return await handleShared(ctx);
        case 'images':
          return await handleImages(ctx);
        case 'diagrams':
          return await handleDiagrams(ctx);
        case 'folders':
          return await handleFolders(ctx);
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
        case 'preferences':
          return await handlePreferences(ctx);
        case 'migrate':
          return await handleMigrate(ctx);
        case 'guest-id':
          return await handleGuestId(ctx);
        case 'participants':
          return await handleParticipants(ctx);
      }
    } catch (err) {
      // Log the real error server-side, but don't echo its message to the
      // client — internal error text can leak implementation details (table
      // names, stack hints). Return a generic body instead.
      console.error('api error', err);
      return json({ error: 'internal_error' }, { status: 500 });
    }

    return notFound();
  },

  // Scheduled handler. Wired to the cron schedule in wrangler.toml.
  // One worker invocation per `triggers.crons` entry; dispatch on
  // `event.cron` for each pattern. Today's daily 03:00 UTC trigger
  // fires two independent retention sweeps:
  //   - change_log, 90-day floor (item #16 / spec/12).
  //   - events,     60-day floor (spec/22 "Retention").
  //   - images,     30-day floor, unused only (spec/19 "Retention").
  // All are no-ops when nothing is over the floor; all use
  // `ctx.waitUntil` so they run concurrently and the worker can
  // exit as soon as the schedule callback returns.
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (event.cron === '0 3 * * *') {
      const now = Date.now();
      scheduleSweep(
        ctx,
        env,
        'change_log',
        'entries',
        now - CHANGE_LOG_RETENTION_MS,
        deleteOldChangeLogEntries,
      );
      scheduleSweep(ctx, env, 'events', 'rows', now - EVENTS_RETENTION_MS, deleteOldEvents);
      // spec/64: send any due onboarding emails (welcome catch-up + week 1 / 2).
      // No-op when RESEND_API_KEY is unset.
      ctx.waitUntil(runLifecycleSweep(env));
      // spec/64 (#3): warn owners whose API token is within a week of expiry.
      ctx.waitUntil(runTokenExpirySweep(env));
      scheduleSweep(
        ctx,
        env,
        'image',
        'images',
        now - UNUSED_IMAGE_RETENTION_MS,
        deleteOldUnusedImages,
      );
    }
  },
} satisfies ExportedHandler<Env>;

// Run one daily retention sweep in the background: delete rows older than
// `cutoff`, then log the count (or the failure) to `wrangler tail`. The three
// sweeps (change_log / events / unused images) shared this exact waitUntil +
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

// 90 days in ms. Pulled out as a named constant because the
// scheduled handler is the only caller and naming it makes the
// intent obvious from the dispatch site.
const CHANGE_LOG_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

// 60 days in ms. The /telemetry dashboard's longest window is
// "Last 30 days", so anything past 60 days is dead storage (twice
// the surfaced window, leaving headroom for a future "Last 60
// days" view to populate). See spec/22 "Retention".
const EVENTS_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;

// 30 days in ms. The unused-image sweep only reaps images this old
// AND referenced by no diagram, so the floor is the safety margin: a
// freshly uploaded image not yet placed on the canvas is never reaped
// out from under the user. Generous on purpose — storage hygiene, not
// an aggressive GC. See spec/19 "Retention".
const UNUSED_IMAGE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
