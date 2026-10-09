// The Cloudflare runtime: the seam answered from the Worker bindings the api
// worker has always used (apps/api/src/types.ts).
//
// This file is also the proof that the seam is a structural subset of those
// bindings rather than a parallel model of them — it compiles only while
// `D1Database`, `R2Bucket`, `DurableObjectNamespace` and the rate-limit
// bindings still satisfy `Runtime`, with no adapter in between. If one of those
// types drifts, this file stops compiling, which is the signal we want
// (docs/specs/016-platform/blueprints/self-hosted-runtime.md).

import type {
  Db,
  HtmlTransformer,
  Limiters,
  ObjectStore,
  RoomHost,
  Scheduler,
} from '@livediagram/runtime';
import type { Env, Runtime } from '../types';

/**
 * The rooms, reached exactly as the api worker reaches them today: one Durable
 * Object per document id, spoken to over HTTP
 * (apps/api/src/room-client.ts).
 */
function cloudflareRooms(env: Env): RoomHost {
  return {
    for: (documentId) => {
      const stub = env.DOCUMENT_ROOM.get(env.DOCUMENT_ROOM.idFromName(documentId));
      return { fetch: (request) => stub.fetch(request) };
    },
  };
}

/**
 * The named limiters. Every one is optional in `Env` because the bindings are
 * optional in wrangler.toml, and an unprovisioned binding has always meant
 * "allow" — the reader keeps that meaning.
 */
function cloudflareLimiters(env: Env): Limiters {
  return {
    WRITE_RATE_LIMITER: env.WRITE_RATE_LIMITER,
    EVENTS_RATE_LIMITER: env.EVENTS_RATE_LIMITER,
    AI_RATE_LIMITER: env.AI_RATE_LIMITER,
    SHARE_RATE_LIMITER: env.SHARE_RATE_LIMITER,
    UNFURL_RATE_LIMITER: env.UNFURL_RATE_LIMITER,
    API_TOKEN_READ_RATE_LIMITER: env.API_TOKEN_READ_RATE_LIMITER,
    DRIVE_TOKEN_RATE_LIMITER: env.DRIVE_TOKEN_RATE_LIMITER,
    HOME_RATE_LIMITER: env.HOME_RATE_LIMITER,
    COMMUNITY_RATE_LIMITER: env.COMMUNITY_RATE_LIMITER,
    WORKBENCH_TICKET_RATE_LIMITER: env.WORKBENCH_TICKET_RATE_LIMITER,
  };
}

/**
 * `waitUntil` is the execution context's; `cron` is a no-op here because
 * Cloudflare drives the sweeps through `triggers.crons` and the worker's
 * `scheduled` export (apps/api/wrangler.toml), not through a registration.
 */
function cloudflareScheduler(ctx: ExecutionContext | undefined): Scheduler {
  return {
    waitUntil: (promise) => {
      void ctx?.waitUntil?.(promise);
    },
    cron: () => {},
  };
}

export function cloudflareRuntime(env: Env, ctx?: ExecutionContext): Runtime {
  // These two assignments are the check this file exists to make: no cast, so
  // the compiler reports it the day `D1Database` or `R2Bucket` stops
  // satisfying the seam.
  const db: Db = env.DB;
  const objects: ObjectStore | undefined = env.IMAGES;
  return {
    // The configuration rides along untouched: the seam names the platform
    // capabilities, everything else in `Env` is a value the application reads.
    ...env,
    db,
    objects,
    rooms: cloudflareRooms(env),
    limiters: cloudflareLimiters(env),
    scheduler: cloudflareScheduler(ctx),
    // The one cast in the seam, and it is deliberate: `HTMLRewriter` is a class
    // whose `Element` carries more than the unfurl route uses, and naming that
    // subset is what lets the Node runtime substitute a parser.
    html: () => new HTMLRewriter() as unknown as HtmlTransformer,
    identity: {
      jwksUrl: env.CLERK_JWKS_URL,
      issuer: env.CLERK_ISSUER,
      audience: env.CLERK_AUDIENCE,
    },
    buildId: env.BUILD_ID,
  };
}
