// API-worker type surface. The wire-format DTOs are now defined in
// `@livediagram/api-schema` so the api worker and the live editor
// share the same source of truth (no more parallel type definitions
// drifting between them — see AGENTS.md's reuse-over-duplication
// rule). This file re-exports the canonical names under the
// historical `*DTO` aliases the worker code already uses, and adds
// the worker-only `Env` binding shape that has nowhere else to live.

export type {
  LiveDoc as DocumentDTO,
  DocumentSummary,
  TabSummary as TabSummaryDTO,
  TabRecord as TabDTO,
  Folder as FolderDTO,
  CustomTheme as CustomThemeDTO,
  CustomThemeDefinition,
  ApiToken as ApiTokenDTO,
  ImageSummary,
  ParticipantRecord as ParticipantDTO,
  ParticipantPresence,
  ShareRole,
  ShareLink as ShareLinkDTO,
  ServerMessage,
  ClientMessage,
} from '@livediagram/api-schema';

// Worker bindings injected by Cloudflare at runtime. Not part of the
// wire format (purely a server-side capability handle).
export type Env = {
  DB: D1Database;
  DOCUMENT_ROOM: DurableObjectNamespace;
  // The live build id: the deploy's commit, the same one baked into the editor build as
  // NEXT_PUBLIC_BUILD_ID (docs/specs/016-platform/stale-builds.md). Unset (local dev, a self-host that
  // sets neither) leaves it off the server release signal.
  BUILD_ID?: string;
  // Clerk JWKS URL: when set, the request handler verifies Bearer
  // tokens against it via `src/auth/clerk.ts` and prefers the
  // resulting userId over `X-Owner-Id`. When unset, the worker stays
  // in pure-guest mode (X-Owner-Id only). See docs/specs/014-identity/auth-and-guest-access.md + docs/specs/015-api/api.md.
  CLERK_JWKS_URL?: string;
  // The OAuth server the CLI signs in through (docs/specs/015-api/cli.md), an https origin.
  OAUTH_ISSUER?: string;
  // The oldest CLI the api accepts writes from, x.y.z; unset for no floor.
  CLI_MIN_VERSION?: string;
  // Optional: when set, the Clerk JWT verifier also asserts the `iss`
  // claim (docs/specs/014-identity/auth-and-guest-access.md) so a token from another instance sharing the JWKS
  // host can't be replayed. Unset → issuer not asserted (back-compat).
  CLERK_ISSUER?: string;
  // Optional: when set, the Clerk JWT verifier also asserts the `aud`
  // claim (docs/specs/014-identity/auth-and-guest-access.md) so a token minted for a different audience/app can't
  // be replayed here. Unset → audience not asserted (back-compat).
  CLERK_AUDIENCE?: string;
  // HMAC secret for signing guest owner-ids (docs/specs/014-identity/auth-and-guest-access.md + auth/
  // owner-signature.ts). When set, POST /api/guest-id mints a signed id
  // and /api/migrate requires a valid signature before reassigning a
  // guest's data to a Clerk account — closing the "observe a guest id,
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
  // When this deployment started signing guest ids, epoch ms (docs/specs/015-api/public-api-and-tokens.md §4).
  // Once enforcement is armed, an id whose participant row is older than this
  // is a legacy (pre-signing) guest and may still run the one-time upgrade onto
  // a signed id unsigned; every newer id must prove possession. Unset = no
  // legacy exception.
  GUEST_SIGNING_LIVE_AT?: string;
  // R2 bucket holding image-element bytes (docs/specs/009-elements/images.md). Optional so
  // self-hosters who haven't provisioned R2 can still deploy the
  // api worker: when unbound, the image endpoints all return 503
  // and the live app hides the Image palette entry.
  IMAGES?: R2Bucket;
  // Cloudflare Workers Rate Limiting API binding. Caps per-owner
  // writes (POST / PUT / DELETE) at the configured limit/period in
  // wrangler.toml. Optional so self-host deployments without the
  // feature flag still serve (the check helper returns "allowed"
  // when the binding is absent).
  WRITE_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-IP limiter for the anonymous telemetry ingest (docs/specs/017-telemetry/telemetry.md),
  // SEPARATE from WRITE_RATE_LIMITER so it never competes with users'
  // real document writes. Keyed on CF-Connecting-IP. Optional: absent
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
  // Per-owner limiter for POST /api/drive/token (docs/specs/022-drive-mirror/drive-mirror.md,
  // "Tokens"): each call reaches Google's token endpoint, so it gets a far
  // tighter bound than the general write limiter. Keyed on the Clerk user id.
  // Optional: absent (self-host) → "allow".
  DRIVE_TOKEN_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-network limiter for Community likes and reports (docs/specs/025-community/blueprints/community.md §7),
  // keyed `community:<address range>` (community-network.ts). These callers are anonymous, so the owner-keyed write
  // limiter would lump them all onto its 'anonymous' key. Optional: absent (self-host) → "allow".
  COMMUNITY_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // The Community's off switch (docs/specs/025-community/community.md "Turning the Community off"): false, 0 or off
  // turns it off; unset leaves it on. See community-enabled.ts.
  COMMUNITY_ENABLED?: string;
  // Telemetry on/off switch (docs/specs/017-telemetry/telemetry.md). Authoritative: gates both
  // POST /api/events and GET /api/telemetry/summary. A plain
  // wrangler.toml [vars] string; only the literal "true" enables it.
  // Absent/anything-else keeps telemetry fully off — the self-host
  // default, so OSS forks never ingest or serve analytics unless they
  // opt in.
  TELEMETRY_ENABLED?: string;
  // Shared secret proving a /api/events post came from one of our own
  // workers over a service binding, not the open internet (docs/specs/017-telemetry/telemetry.md, issue
  // #36). Those calls carry no CF-Connecting-IP, so they all collapsed onto
  // one 'anonymous' rate-limit key and throttled each other. Optional:
  // unset means no caller is ever exempt, which is the pre-existing
  // behaviour and keeps self-hosting working with no configuration.
  INTERNAL_EVENTS_KEY?: string;
  // Resend API key for transactional + lifecycle email (docs/specs/014-identity/transactional-email.md). When absent
  // the whole email feature is inert: no sends, and the email_lifecycle table
  // is never touched. Set via `wrangler secret put RESEND_API_KEY` for prod;
  // drop into `apps/api/.dev.vars` for local dev (gitignored, never commit).
  RESEND_API_KEY?: string;
  // From identity for outbound email (optional). Defaults to
  // "livediagram <hello@livediagram.app>". The domain must be verified in Resend.
  RESEND_FROM?: string;
  // Public origin used to build links in emails (optional). Defaults to
  // "https://livediagram.app".
  APP_BASE_URL?: string;
  // WHOSE model, and where (docs/specs/007-editor/ai-assistance.md). The PROVIDER is inferred from which of
  // these keys is set, because a key is provider-specific and its name should
  // say so — see ai-provider.ts. Each feature takes its own provider from them
  // (the assistant prefers OpenAI, the crop reader Google); one key serves
  // both. None = the whole AI surface is hidden (capabilities reports aiEnabled:false and the AI routes
  // answer 503), which is the self-host default.
  //
  // Set via `wrangler secret put <NAME>` in production; drop into
  // `apps/api/.dev.vars` for local dev (gitignored, never commit).
  GOOGLE_AI_STUDIO_API_KEY?: string;
  OPENAI_API_KEY?: string;
  // Any other OpenAI-compatible endpoint (Mistral, OpenRouter, a local
  // llama.cpp or Ollama). Needs AI_BASE_URL and AI_MODEL with it.
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  // The assistant's model, overriding its provider's default. Reaches the
  // reader only when the reader runs on the same provider.
  AI_MODEL?: string;
  // The crop reader's model (docs/specs/021-event-storming/event-storming.md Phase 8), beating every default.
  AI_VISION_MODEL?: string;
  // Per-IP rate limiter for POST /api/ai. Caps AI requests at 20/60s
  // per IP so a single client can't exhaust the operator's model budget.
  // Optional: absent (self-host) falls through to "allow".
  AI_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
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
  // Comma-separated Origin allow-list for POST /api/ai (docs/specs/007-editor/ai-assistance.md).
  // When set, the worker rejects 403 unless the request's Origin
  // header exactly matches one of the entries (trimmed for
  // whitespace). Unset = no check, matching the historical
  // behaviour so self-host upgrades don't break. Hosted
  // livediagram.app sets this in apps/api/wrangler.toml [vars] (NOT the
  // dashboard, which a deploy wipes) to BOTH
  // "https://www.livediagram.app" and "https://livediagram.app" — `www`
  // first because the apex 301s to it, so `www` is what a browser sends.
  // This comment previously named the apex alone, which as an actual
  // value would 403 every request the editor makes.
  AI_ALLOWED_ORIGINS?: string;
  // When the literal string "true", POST /api/ai requires a verified
  // Clerk Bearer JWT and rejects the X-Owner-Id guest path with 401
  // (docs/specs/007-editor/ai-assistance.md). Anything else (unset, "false", any other value) keeps
  // the guest path open. Hosted livediagram.app sets this to "true";
  // OSS self-hosters who run Clerk-less stay on the open path by
  // default.
  AI_REQUIRE_CLERK?: string;
  // Per-owner soft cap on the number of images one owner may keep
  // in the gallery (docs/specs/009-elements/images.md). Stored as a decimal string in
  // wrangler.toml [vars]; parsed via parseInt at request time.
  // Unset or non-positive = no limit (the OSS self-host default
  // where the operator runs their own storage budget). Hosted
  // livediagram.app sets this to "100".
  IMAGE_MAX_PER_OWNER?: string;
  // Per-owner soft cap on the total bytes one owner may keep in
  // the gallery (docs/specs/009-elements/images.md). Stored as a decimal byte count in
  // wrangler.toml [vars]; parsed via parseInt at request time.
  // Unset or non-positive = no limit. Hosted livediagram.app sets
  // this to "104857600" (100 MB).
  IMAGE_MAX_BYTES_PER_OWNER?: string;
  // Google Drive mirror (docs/specs/022-drive-mirror/drive-mirror.md, "Self-hosting").
  // GOOGLE_CLIENT_ID (plain var) switches the feature on at all; with
  // GOOGLE_CLIENT_SECRET and DRIVE_TOKEN_KEY (both secrets) the worker brokers
  // refresh tokens, otherwise the browser holds its own short-lived tokens.
  // Unset = every /api/drive route answers 503 drive_not_configured.
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  // base64 of 32 random bytes (`openssl rand -base64 32`): seals refresh
  // tokens (AES-GCM) and, through HKDF, signs the consent state.
  DRIVE_TOKEN_KEY?: string;
  // Test-only: where the token exchange and revoke go instead of
  // https://oauth2.googleapis.com (the e2e suite's fake Google). Never set
  // by a real deployment.
  GOOGLE_OAUTH_BASE_URL?: string;
};
