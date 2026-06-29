// API-worker type surface. The wire-format DTOs are now defined in
// `@livediagram/api-schema` so the api worker and the live editor
// share the same source of truth (no more parallel type definitions
// drifting between them — see CLAUDE.md's reuse-over-duplication
// rule). This file re-exports the canonical names under the
// historical `*DTO` aliases the worker code already uses, and adds
// the worker-only `Env` binding shape that has nowhere else to live.

export type {
  Diagram as DiagramDTO,
  DiagramSummary,
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
  ChangeLogEntry as ChangeLogEntryDTO,
  ServerMessage,
  ClientMessage,
} from '@livediagram/api-schema';

// Worker bindings injected by Cloudflare at runtime. Not part of the
// wire format (purely a server-side capability handle).
export type Env = {
  DB: D1Database;
  DIAGRAM_ROOM: DurableObjectNamespace;
  // Clerk JWKS URL: when set, the request handler verifies Bearer
  // tokens against it via `src/auth/clerk.ts` and prefers the
  // resulting userId over `X-Owner-Id`. When unset, the worker stays
  // in pure-guest mode (X-Owner-Id only). See spec/04 + spec/11.
  CLERK_JWKS_URL?: string;
  // Optional: when set, the Clerk JWT verifier also asserts the `iss`
  // claim (spec/04) so a token from another instance sharing the JWKS
  // host can't be replayed. Unset → issuer not asserted (back-compat).
  CLERK_ISSUER?: string;
  // Optional: when set, the Clerk JWT verifier also asserts the `aud`
  // claim (spec/04) so a token minted for a different audience/app can't
  // be replayed here. Unset → audience not asserted (back-compat).
  CLERK_AUDIENCE?: string;
  // HMAC secret for signing guest owner-ids (spec/04 + auth/
  // owner-signature.ts). When set, POST /api/guest-id mints a signed id
  // and /api/migrate requires a valid signature before reassigning a
  // guest's data to a Clerk account — closing the "observe a guest id,
  // claim its data" hole. Unset → migrate keeps its legacy unsigned
  // behaviour (OSS self-host that hasn't configured it).
  GUEST_ID_HMAC_SECRET?: string;
  // Guest REST signature enforcement cutoff (spec/61 §4), epoch ms. While
  // unset (or in the future) the guest `X-Owner-Id` REST path keeps its
  // legacy unsigned behaviour — the grace window that lets pre-signing guests
  // self-heal to a signed id. Set to a past timestamp (once active guests have
  // rotated) to require a valid `X-Owner-Sig` on owner-scoped routes. No-op
  // without GUEST_ID_HMAC_SECRET.
  GUEST_SIG_ENFORCE_AFTER?: string;
  // R2 bucket holding image-element bytes (spec/19). Optional so
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
  // Per-IP limiter for the anonymous telemetry ingest (spec/22),
  // SEPARATE from WRITE_RATE_LIMITER so it never competes with users'
  // real diagram writes. Keyed on CF-Connecting-IP. Optional: absent
  // (self-host) falls through to "allow", same as the write limiter.
  EVENTS_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-IP limiter for share-code resolution (GET /api/share/<code>),
  // which carries the optional share password and is otherwise an
  // unauthenticated read exempt from WRITE_RATE_LIMITER. Bounds blind
  // password / share-code guessing. Keyed on CF-Connecting-IP. Optional:
  // absent (self-host) → "allow".
  SHARE_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-IP throttle for GET /api/unfurl (spec/40) — an unauthenticated
  // outbound page fetch, so bound abuse. Keyed on CF-Connecting-IP. Optional:
  // absent (self-host) → "allow".
  UNFURL_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Telemetry on/off switch (spec/22). Authoritative: gates both
  // POST /api/events and GET /api/telemetry/summary. A plain
  // wrangler.toml [vars] string; only the literal "true" enables it.
  // Absent/anything-else keeps telemetry fully off — the self-host
  // default, so OSS forks never ingest or serve analytics unless they
  // opt in.
  TELEMETRY_ENABLED?: string;
  // Resend API key for transactional + lifecycle email (spec/64). When absent
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
  // OpenAI API key for the AI assistance feature (spec/25). When absent
  // the feature is hidden entirely — GET /api/capabilities returns
  // { aiEnabled: false } and POST /api/ai returns 503. Set via
  // `wrangler secret put OPENAI_API_KEY` for production; drop into
  // `apps/api/.dev.vars` for local dev (gitignored, never commit).
  OPENAI_API_KEY?: string;
  // Override the OpenAI model (optional). Defaults to gpt-4o.
  // Set in wrangler.toml [vars] if you want a different model.
  OPENAI_MODEL?: string;
  // Per-IP rate limiter for POST /api/ai. Caps AI requests at 20/60s
  // per IP so a single client can't exhaust the OpenAI budget.
  // Optional: absent (self-host) falls through to "allow".
  AI_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-token read limiter for token-authed GETs (spec/61 §3.5), keyed on the
  // token id. Token writes ride the WRITE_RATE_LIMITER (also keyed on the
  // token id); this covers reads, which that one doesn't. Optional: absent
  // (self-host) falls through to "allow".
  API_TOKEN_READ_RATE_LIMITER?: {
    limit: (input: { key: string }) => Promise<{ success: boolean }>;
  };
  // Comma-separated Origin allow-list for POST /api/ai (spec/25).
  // When set, the worker rejects 403 unless the request's Origin
  // header exactly matches one of the entries (trimmed for
  // whitespace). Unset = no check, matching the historical
  // behaviour so self-host upgrades don't break. Hosted
  // livediagram.app sets this to "https://livediagram.app".
  AI_ALLOWED_ORIGINS?: string;
  // When the literal string "true", POST /api/ai requires a verified
  // Clerk Bearer JWT and rejects the X-Owner-Id guest path with 401
  // (spec/25). Anything else (unset, "false", any other value) keeps
  // the guest path open. Hosted livediagram.app sets this to "true";
  // OSS self-hosters who run Clerk-less stay on the open path by
  // default.
  AI_REQUIRE_CLERK?: string;
  // Per-owner soft cap on the number of images one owner may keep
  // in the gallery (spec/19). Stored as a decimal string in
  // wrangler.toml [vars]; parsed via parseInt at request time.
  // Unset or non-positive = no limit (the OSS self-host default
  // where the operator runs their own storage budget). Hosted
  // livediagram.app sets this to "100".
  IMAGE_MAX_PER_OWNER?: string;
  // Per-owner soft cap on the total bytes one owner may keep in
  // the gallery (spec/19). Stored as a decimal byte count in
  // wrangler.toml [vars]; parsed via parseInt at request time.
  // Unset or non-positive = no limit. Hosted livediagram.app sets
  // this to "104857600" (100 MB).
  IMAGE_MAX_BYTES_PER_OWNER?: string;
};
