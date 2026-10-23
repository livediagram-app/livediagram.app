// API-worker type surface. The wire-format DTOs are now defined in
// `@livedesign/api-schema` so the api worker and the live editor
// share the same source of truth (no more parallel type definitions
// drifting between them — see AGENTS.md's reuse-over-duplication
// rule). This file re-exports the canonical names under the
// historical `*DTO` aliases the worker code already uses, and adds
// the worker-only `Env` binding shape that has nowhere else to live.

export type {
  LiveDoc as DesignDTO,
  DesignSummary,
  TabSummary as TabSummaryDTO,
  TabRecord as TabDTO,
  Folder as FolderDTO,
  ApiToken as ApiTokenDTO,
  ImageSummary,
  ParticipantRecord as ParticipantDTO,
  ParticipantPresence,
  ShareRole,
  ShareLink as ShareLinkDTO,
  ServerMessage,
  ClientMessage,
} from '@livedesign/api-schema';

// Worker bindings injected by Cloudflare at runtime. Not part of the
// wire format (purely a server-side capability handle).
export type Env = {
  DB: D1Database;
  DESIGN_ROOM: DurableObjectNamespace;
  // The live build id: the deploy's commit, the same one baked into the editor build as
  // NEXT_PUBLIC_BUILD_ID (docs/specs/016-platform/stale-builds.md). Unset (local dev, a self-host that
  // sets neither) leaves it off the server release signal.
  BUILD_ID?: string;
  // Signing in through the liveworkspace accounts Worker (docs/specs/014-identity/auth-and-guest-access.md,
  // auth/accounts.ts + routes/auth.ts). ACCOUNTS_URL is its origin, e.g.
  // `https://liveworkspace.app`; its issuer and key set sit under `/api/auth`. API_RESOURCE is
  // what this API was registered as, e.g. `https://livedesign.app/api`, and every access token must
  // name it as its audience. With either unset the worker stays in pure-guest mode (X-Owner-Id only).
  ACCOUNTS_URL?: string;
  API_RESOURCE?: string;
  // This app's OAuth client at the accounts Worker (its scripts/register-client.ts). Only the
  // /api/auth routes read them; the secret is a `wrangler secret`.
  ACCOUNTS_CLIENT_ID?: string;
  ACCOUNTS_CLIENT_SECRET?: string;
  // Local dev only: the origin the browser is on (the router, `http://localhost:3400`), which the
  // sign-in redirect returns to. Unset in production, where the request's own origin is right.
  AUTH_ORIGIN?: string;
  // The OAuth server the CLI signs in through (docs/specs/015-api/cli.md), an https origin.
  OAUTH_ISSUER?: string;
  // The oldest CLI the api accepts writes from, x.y.z; unset for no floor.
  CLI_MIN_VERSION?: string;
  // HMAC secret for signing guest owner-ids (docs/specs/014-identity/auth-and-guest-access.md + auth/
  // owner-signature.ts). When set, POST /api/guest-id mints a signed id
  // and /api/migrate requires a valid signature before reassigning a
  // guest's data to an account — closing the "observe a guest id,
  // claim its data" hole. Unset → migrate keeps its legacy unsigned
  // behaviour (OSS self-host that hasn't configured it).
  GUEST_ID_HMAC_SECRET?: string;
  // Guest REST signature enforcement cutoff (docs/specs/015-api/public-api-and-tokens.md §4), epoch ms. While
  // unset (or in the future) the guest `X-Owner-Id` REST path keeps its
  // legacy unsigned behaviour — the grace window that lets pre-signing guests
  // self-heal to a signed id. Set to a past timestamp (once active guests have
  // rotated) to require a valid `X-Owner-Sig` on owner-scoped routes. No-op
  // without GUEST_ID_HMAC_SECRET.
  GUEST_SIG_ENFORCE_AFTER?: string;
  // R2 bucket holding design snapshots (thumb/<designId>), and the image bytes uploaded before images moved
  // to liveworkspace's media service, until they are migrated.
  IMAGES?: R2Bucket;
  // liveworkspace's media service (liveworkspace/docs/media.md, src/media.ts), which keeps every app's uploaded
  // images. Unset means production's, https://liveworkspace.app/api/media; staging and local development name
  // their own.
  MEDIA_URL?: string;
  // livedesign's secret on that service, sent as a bearer token. A secret (wrangler secret put MEDIA_KEY); unset,
  // this deploy has no images, and the image endpoints answer 503 so the editor hides them.
  MEDIA_KEY?: string;
  // R2 bucket holding photo pages' blobs (docs/specs/031-photo/photo-store.md "The photo blob store"),
  // apart from IMAGES. Unbound, every photo blob route answers 503 photos_unavailable.
  PHOTO_BLOBS?: R2Bucket;
  // Cloudflare Workers Rate Limiting API binding. Caps per-owner
  // writes (POST / PUT / DELETE) at the configured limit/period in
  // wrangler.toml. Optional so self-host deployments without the
  // feature flag still serve (the check helper returns "allowed"
  // when the binding is absent).
  WRITE_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-IP limiter for the anonymous telemetry relay (docs/specs/017-telemetry/telemetry.md "The relay"),
  // SEPARATE from WRITE_RATE_LIMITER so it never competes with users'
  // real design writes. Keyed on CF-Connecting-IP. Optional: absent
  // (self-host) falls through to "allow", same as the write limiter.
  EVENTS_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-IP limiter for share-code resolution (GET /api/share/<code>),
  // which carries the optional share password and is otherwise an
  // unauthenticated read exempt from WRITE_RATE_LIMITER. Bounds blind
  // password / share-code guessing. Keyed on CF-Connecting-IP. Optional:
  // absent (self-host) → "allow".
  SHARE_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-IP throttle for GET /api/unfurl (docs/specs/009-elements/link-cards.md) — an unauthenticated
  // outbound page fetch, so bound abuse. Keyed on CF-Connecting-IP. Optional:
  // absent (self-host) → "allow".
  UNFURL_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Telemetry on/off switch (docs/specs/017-telemetry/telemetry.md) for this worker's own events. A plain
  // wrangler.toml [vars] string; only the literal "true" enables it.
  // Absent/anything-else keeps telemetry fully off — the self-host
  // default, so OSS forks never send analytics unless they opt in.
  TELEMETRY_ENABLED?: string;
  // liveworkspace's central telemetry service (liveworkspace/docs/telemetry.md). Unset means
  // production's, TELEMETRY_URL in @liveworkspace/telemetry.
  TELEMETRY_URL?: string;
  // livedesign's Worker key for that service (a secret, the same value as the mcp worker's),
  // sent as X-Telemetry-Key. Unset means this worker sends no telemetry.
  TELEMETRY_KEY?: string;
  // Resend API key for livedesign's own email (docs/specs/014-identity/transactional-email.md):
  // notifications, milestones, team invites, token expiry and account deletion. When absent none of
  // them is sent. The onboarding series is liveworkspace's, sent by its accounts Worker. Set via
  // `wrangler secret put RESEND_API_KEY` for prod; drop into `apps/api/.dev.vars` for local dev
  // (gitignored, never commit).
  RESEND_API_KEY?: string;
  // From identity for outbound email (optional). Defaults to
  // "livedesign <hello@livedesign.app>". The domain must be verified in Resend.
  RESEND_FROM?: string;
  // Public origin used to build links in emails (optional). Defaults to
  // "https://livedesign.app".
  APP_BASE_URL?: string;
  // Explorer Home's reads (docs/specs/013-workspace/explorer-home.md), per owner. Absent binding
  // (a self-host) allows every read.
  HOME_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Workbench ticket mints and pairing requests (docs/specs/013-workspace/workbench-embeds.md), keyed on the
  // token id: WORKBENCH_TICKETS_PER_MINUTE a minute. Absent binding (a self-host) allows every mint.
  WORKBENCH_TICKET_RATE_LIMITER?: {
    limit: (input: { key: string }) => Promise<{ success: boolean }>;
  };
  // Per-token read limiter for token-authed GETs (docs/specs/015-api/public-api-and-tokens.md §3.5), keyed on the
  // token id. Token writes ride the WRITE_RATE_LIMITER (also keyed on the
  // token id); this covers reads, which that one doesn't. Optional: absent
  // (self-host) falls through to "allow".
  API_TOKEN_READ_RATE_LIMITER?: {
    limit: (input: { key: string }) => Promise<{ success: boolean }>;
  };
  // The most bytes of photo blobs one tab may hold (docs/specs/031-photo/photo-store.md "Limits").
  // Unset, blank or non-positive = no limit (the self-host default). Hosted livedesign.app sets
  // "536870912" (512 MB).
  PHOTO_MAX_BYTES_PER_TAB?: string;
};
