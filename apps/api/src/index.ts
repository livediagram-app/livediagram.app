import { getClerkUserId } from './auth/clerk';
import { deleteOldChangeLogEntries, deleteOldEvents } from './db';
import { DiagramRoom } from './diagram-room';
import { CORS_HEADERS, json, notFound, rateLimited } from './responses';
import { handleAccount } from './routes/account';
import type { RouteContext } from './routes/context';
import { handleDiagrams } from './routes/diagrams';
import { handleEvents } from './routes/events';
import { handleFolders } from './routes/folders';
import { handleImages } from './routes/images';
import { handleMigrate } from './routes/migrate';
import { handleParticipants } from './routes/participants';
import { handlePreferences } from './routes/preferences';
import { handleShare } from './routes/share';
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
  async fetch(request: Request, env: Env): Promise<Response> {
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
    const clerkUserId = await getClerkUserId(env, request);
    const resolveOwner = (): string | null => clerkUserId ?? request.headers.get('X-Owner-Id');

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
    if (isWrite && url.pathname !== '/api/events') {
      const key = resolveOwner() ?? 'anonymous';
      if (await isWriteRateLimited(env, key)) return rateLimited();
    }

    // Dispatch on the resource segment to its route module. Each
    // handler owns every request for its segment and returns
    // notFound() for sub-paths / methods it doesn't recognise, so an
    // unmatched resource OR an unmatched sub-route both fall through
    // to the final notFound() (preserving the original behaviour).
    const ctx: RouteContext = { request, env, url, segments, clerkUserId, resolveOwner };
    try {
      switch (segments[1]) {
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
        case 'account':
          return await handleAccount(ctx);
        case 'preferences':
          return await handlePreferences(ctx);
        case 'migrate':
          return await handleMigrate(ctx);
        case 'participants':
          return await handleParticipants(ctx);
      }
    } catch (err) {
      console.error('api error', err);
      return json(
        { error: 'internal_error', message: String((err as Error).message ?? err) },
        { status: 500 },
      );
    }

    return notFound();
  },

  // Scheduled handler. Wired to the cron schedule in wrangler.toml.
  // One worker invocation per `triggers.crons` entry; dispatch on
  // `event.cron` for each pattern. Today's daily 03:00 UTC trigger
  // fires two independent retention sweeps:
  //   - change_log, 90-day floor (item #16 / spec/12).
  //   - events,     60-day floor (spec/22 "Retention").
  // Both are no-ops when nothing is over the floor; both use
  // `ctx.waitUntil` so they run concurrently and the worker can
  // exit as soon as the schedule callback returns.
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (event.cron === '0 3 * * *') {
      const now = Date.now();
      const changeLogCutoff = now - CHANGE_LOG_RETENTION_MS;
      ctx.waitUntil(
        deleteOldChangeLogEntries(env, changeLogCutoff)
          .then((count) => {
            // wrangler tail shows these so an oversized sweep
            // surfaces in observability without needing a metrics
            // pipeline. A zero is fine: most days nothing's older
            // than 90 days yet.
            console.log(`change_log sweep: deleted ${count} entries older than ${changeLogCutoff}`);
          })
          .catch((err) => {
            console.error('change_log sweep failed', err);
          }),
      );

      const eventsCutoff = now - EVENTS_RETENTION_MS;
      ctx.waitUntil(
        deleteOldEvents(env, eventsCutoff)
          .then((count) => {
            console.log(`events sweep: deleted ${count} rows older than ${eventsCutoff}`);
          })
          .catch((err) => {
            console.error('events sweep failed', err);
          }),
      );
    }
  },
} satisfies ExportedHandler<Env>;

// 90 days in ms. Pulled out as a named constant because the
// scheduled handler is the only caller and naming it makes the
// intent obvious from the dispatch site.
const CHANGE_LOG_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

// 60 days in ms. The /telemetry dashboard's longest window is
// "Last 30 days", so anything past 60 days is dead storage (twice
// the surfaced window, leaving headroom for a future "Last 60
// days" view to populate). See spec/22 "Retention".
const EVENTS_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;
