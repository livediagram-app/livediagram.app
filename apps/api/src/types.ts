// API-worker type surface. The wire-format DTOs are now defined in
// `@liveplanner/api-schema` so the api worker and the live editor
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
  ParticipantRecord as ParticipantDTO,
  ParticipantPresence,
  ShareRole,
  ShareLink as ShareLinkDTO,
  ServerMessage,
  ClientMessage,
} from '@liveplanner/api-schema';

// Worker bindings injected by Cloudflare at runtime. Not part of the
// wire format (purely a server-side capability handle).
export type Env = {
  DB: D1Database;
  DOCUMENT_ROOM: DurableObjectNamespace;
  // The live build id: the deploy's commit, the same one baked into the editor build as
  // NEXT_PUBLIC_BUILD_ID (docs/specs/016-platform/stale-builds.md). Unset (local dev, a deployment that
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
  // behaviour (a deployment that hasn't configured it).
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
  // R2 bucket caching each project's SVG snapshot (`thumb/<id>`) and share card
  // (docs/specs/006-document/document-snapshots.md). Optional so a deploy without R2 still runs:
  // unbound, the snapshot doors answer 404 and the Explorer row keeps its icon.
  SNAPSHOTS?: R2Bucket;
  // Cloudflare Workers Rate Limiting API binding. Caps per-owner
  // writes (POST / PUT / DELETE) at the configured limit/period in
  // wrangler.toml. Optional so deployments without the
  // feature flag still serve (the check helper returns "allowed"
  // when the binding is absent).
  WRITE_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-IP limiter for the anonymous telemetry ingest (docs/specs/017-telemetry/telemetry.md),
  // SEPARATE from WRITE_RATE_LIMITER so it never competes with users'
  // real document writes. Keyed on CF-Connecting-IP. Optional: absent
  // (a deployment without it) falls through to "allow", same as the write limiter.
  EVENTS_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-IP limiter for share-code resolution (GET /api/share/<code>),
  // which carries the optional share password and is otherwise an
  // unauthenticated read exempt from WRITE_RATE_LIMITER. Bounds blind
  // password / share-code guessing. Keyed on CF-Connecting-IP. Optional:
  // absent (a deployment without it) → "allow".
  SHARE_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-IP throttle for GET /api/unfurl (docs/specs/009-elements/link-cards.md) — an unauthenticated
  // outbound page fetch, so bound abuse. Keyed on CF-Connecting-IP. Optional:
  // absent (a deployment without it) → "allow".
  UNFURL_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-network limiter for a form link's reads and responses (docs/specs/030-forms/forms.md "Abuse and limits").
  FORM_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-network limiter for an invite email's Decline link (docs/specs/013-workspace/teams.md "Declining from the
  // email"), keyed `invite-decline:<address range>`: open doors, so the owner-keyed limiter cannot key them.
  // Optional: absent (a deployment without it) → "allow".
  TEAM_INVITE_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Telemetry on/off switch (docs/specs/017-telemetry/telemetry.md). Authoritative: gates both
  // POST /api/events and GET /api/telemetry/summary. A plain
  // wrangler.toml [vars] string; only the literal "true" enables it.
  // Absent/anything-else keeps telemetry fully off — the unconfigured
  // default, so deployments never ingest or serve analytics unless they
  // opt in.
  TELEMETRY_ENABLED?: string;
  // Shared secret proving a /api/events post came from one of our own
  // workers over a service binding, not the open internet (docs/specs/017-telemetry/telemetry.md, issue
  // #36). Those calls carry no CF-Connecting-IP, so they all collapsed onto
  // one 'anonymous' rate-limit key and throttled each other. Optional:
  // unset means no caller is ever exempt, which is the pre-existing
  // behaviour and keeps a deployment working with no configuration.
  INTERNAL_EVENTS_KEY?: string;
  // Resend API key for transactional + lifecycle email (docs/specs/014-identity/transactional-email.md). When absent
  // the whole email feature is inert: no sends, and the email_lifecycle table
  // is never touched. Set via `wrangler secret put RESEND_API_KEY` for prod;
  // drop into `apps/api/.dev.vars` for local dev (gitignored, never commit).
  RESEND_API_KEY?: string;
  // From identity for outbound email (optional). Defaults to
  // "liveplanner <hello@liveplanner.app>". The domain must be verified in Resend.
  RESEND_FROM?: string;
  // Public origin used to build links in emails (optional). Defaults to
  // "https://liveplanner.app".
  APP_BASE_URL?: string;
  // WHOSE model, and where (docs/specs/007-editor/ai-assistance.md). The PROVIDER is inferred from which of
  // these keys is set, because a key is provider-specific and its name should
  // say so — see ai-provider.ts. The assistant prefers OpenAI, then Google.
  // None = the whole AI surface is hidden (capabilities reports aiEnabled:false and the AI routes
  // answer 503), which is the unconfigured default.
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
  // Per-IP rate limiter for POST /api/ai. Caps AI requests at 20/60s
  // per IP so a single client can't exhaust the operator's model budget.
  // Optional: absent (a deployment without it) falls through to "allow".
  AI_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Explorer Home's reads (docs/specs/013-workspace/explorer-home.md), per owner. Absent binding
  // (a deployment without it) allows every read.
  HOME_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Workbench ticket mints and pairing requests (docs/specs/013-workspace/workbench-embeds.md), keyed on the
  // token id: WORKBENCH_TICKETS_PER_MINUTE a minute. Absent binding (a deployment without it) allows every mint.
  WORKBENCH_TICKET_RATE_LIMITER?: {
    limit: (input: { key: string }) => Promise<{ success: boolean }>;
  };
  // Per-token read limiter for token-authed GETs (docs/specs/015-api/public-api-and-tokens.md §3.5), keyed on the
  // token id. Token writes ride the WRITE_RATE_LIMITER (also keyed on the
  // token id); this covers reads, which that one doesn't. Optional: absent
  // (a deployment without it) falls through to "allow".
  API_TOKEN_READ_RATE_LIMITER?: {
    limit: (input: { key: string }) => Promise<{ success: boolean }>;
  };
  // Comma-separated Origin allow-list for POST /api/ai (docs/specs/007-editor/ai-assistance.md).
  // When set, the worker rejects 403 unless the request's Origin
  // header exactly matches one of the entries (trimmed for
  // whitespace). Unset = no check, matching the historical
  // behaviour so existing deployments don't break. Hosted
  // liveplanner.app sets this in apps/api/wrangler.toml [vars] (NOT the
  // dashboard, which a deploy wipes) to BOTH
  // "https://www.liveplanner.app" and "https://liveplanner.app" — `www`
  // first because the apex 301s to it, so `www` is what a browser sends.
  // This comment previously named the apex alone, which as an actual
  // value would 403 every request the editor makes.
  AI_ALLOWED_ORIGINS?: string;
  // When the literal string "true", POST /api/ai requires a verified
  // Clerk Bearer JWT and rejects the X-Owner-Id guest path with 401
  // (docs/specs/007-editor/ai-assistance.md). Anything else (unset, "false", any other value) keeps
  // the guest path open. Hosted liveplanner.app sets this to "true";
  // deployments that run Clerk-less stay on the open path by
  // default.
  AI_REQUIRE_CLERK?: string;
};
