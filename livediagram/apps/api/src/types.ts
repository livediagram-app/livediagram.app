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
  ImageSummary,
  ParticipantRecord as ParticipantDTO,
  ParticipantPresence,
  ShareRole,
  ShareLink as ShareLinkDTO,
  ServerMessage,
  ClientMessage,
} from '@livediagram/api-schema';

import type { DocumentRoom } from './document-room/document-room';
import type { PersonStore } from './person-store/person-store';

// Worker bindings injected by Cloudflare at runtime. Not part of the
// wire format (purely a server-side capability handle).
export type Env = {
  // Each document's Durable Object (src/document-room/document-room.ts): its content, in its own SQLite, and its
  // realtime room. Reached through document-client.ts `documentRoom(env, documentId)`.
  DOCUMENT_ROOM: DurableObjectNamespace<DocumentRoom>;
  // Each person's Durable Object (src/person-store/person-store.ts): what livediagram keeps for one person rather
  // than for one canvas (their shape libraries). Reached through person-client.ts `personStore(env, personId)`.
  PERSON_STORE: DurableObjectNamespace<PersonStore>;
  // The key liveworkspace's index presents on this app's internal endpoints (`/api/internal/items/*`,
  // liveworkspace/docs/one-explorer-contracts.md). A secret; unset, those endpoints answer 404.
  INDEX_KEY?: string;
  // liveworkspace's index (liveworkspace/docs/one-explorer.md): where every canvas is filed and who may open it.
  // The grants this api checks are signed by `${INDEX_ORIGIN}/api/index/jwks`, and the document rooms push their
  // summaries there with INDEX_KEY. From hosted-vars.json per environment; local dev sets it in `.dev.vars`.
  INDEX_ORIGIN?: string;
  // The live build id: the deploy's commit, the same one baked into the editor build as
  // NEXT_PUBLIC_BUILD_ID (docs/specs/016-platform/stale-builds.md). Unset (local dev, a deployment that
  // sets neither) leaves it off the server release signal.
  BUILD_ID?: string;
  // Signing in through the liveworkspace accounts Worker (docs/specs/014-identity/auth-and-guest-access.md,
  // auth/accounts.ts + routes/auth.ts). ACCOUNTS_URL is its origin, e.g.
  // `https://liveworkspace.app`; its issuer and key set sit under `/api/auth`. API_RESOURCE is
  // what this API was registered as, e.g. `https://livediagram.app/api`, and every access token must
  // name it as its audience, as must a guest's token (liveworkspace/docs/accounts.md "Guests"). With either unset
  // no caller has an identity: only share-link visitors are served.
  ACCOUNTS_URL?: string;
  API_RESOURCE?: string;
  // This app's OAuth client at the accounts Worker (its scripts/register-client.ts). Only the
  // /api/auth routes read them; the secret is a `wrangler secret`.
  ACCOUNTS_CLIENT_ID?: string;
  ACCOUNTS_CLIENT_SECRET?: string;
  // Local dev only: the origin the browser is on (the router, `http://localhost:3100`), which the
  // sign-in redirect returns to. Unset in production, where the request's own origin is right.
  AUTH_ORIGIN?: string;
  // The OAuth server the CLI signs in through (docs/specs/015-api/cli.md), an https origin.
  OAUTH_ISSUER?: string;
  // The oldest CLI the api accepts writes from, x.y.z; unset for no floor.
  CLI_MIN_VERSION?: string;
  // R2 bucket kept only for the image bytes uploaded before images moved to liveworkspace's media service, until
  // they are migrated. Previews are liveworkspace's now (liveworkspace/docs/previews.md); nothing here writes it.
  IMAGES?: R2Bucket;
  // Cloudflare Workers Rate Limiting API binding. Caps per-owner
  // writes (POST / PUT / DELETE) at the configured limit/period in
  // wrangler.toml. Optional so deployments without the
  // feature flag still serve (the check helper returns "allowed"
  // when the binding is absent).
  WRITE_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-IP limiter for the anonymous telemetry relay (docs/specs/017-telemetry/telemetry.md "The relay"),
  // SEPARATE from WRITE_RATE_LIMITER so it never competes with users'
  // real document writes. Keyed on CF-Connecting-IP. Optional: absent
  // falls through to "allow", same as the write limiter.
  EVENTS_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-IP limiter for share-code resolution (GET /api/share/<code>),
  // which carries the optional share password and is otherwise an
  // unauthenticated read exempt from WRITE_RATE_LIMITER. Bounds blind
  // password / share-code guessing. Keyed on CF-Connecting-IP. Optional:
  // absent → "allow".
  SHARE_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-IP throttle for GET /api/unfurl (docs/specs/009-elements/link-cards.md) — an unauthenticated
  // outbound page fetch, so bound abuse. Keyed on CF-Connecting-IP. Optional:
  // absent → "allow".
  UNFURL_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-owner limiter for POST /api/drive/token (docs/specs/022-drive-mirror/drive-mirror.md,
  // "Tokens"): each call reaches Google's token endpoint, so it gets a far
  // tighter bound than the general write limiter. Keyed on the account id.
  // Optional: absent (self-host) → "allow".
  DRIVE_TOKEN_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // The Community's off switch (docs/specs/025-community/community.md "Turning the Community off"): false, 0 or off
  // turns it off; unset leaves it on. See community-enabled.ts.
  COMMUNITY_ENABLED?: string;
  // The liveworkspace Community service (liveworkspace/docs/community.md), which keeps every app's posts. Unset means
  // production's, https://liveworkspace.app/api/community; staging and local development name their own.
  COMMUNITY_URL?: string;
  // livediagram's secret on that service, sent as a bearer token on its app routes. A secret (wrangler secret put
  // COMMUNITY_KEY); unset, this deploy has no Community to publish to.
  COMMUNITY_KEY?: string;
  // liveworkspace's media service (liveworkspace/docs/media.md, src/media.ts), which keeps every app's uploaded
  // images. Unset means production's, https://liveworkspace.app/api/media; staging and local development name
  // their own.
  MEDIA_URL?: string;
  // livediagram's secret on that service, sent as a bearer token. A secret (wrangler secret put MEDIA_KEY); unset,
  // this deploy has no images, and the image endpoints answer 503 so the editor hides them.
  MEDIA_KEY?: string;
  // Telemetry on/off switch (docs/specs/017-telemetry/telemetry.md). Gates every event this worker
  // sends to the liveworkspace telemetry service, its own and the relay's. A plain
  // wrangler.toml [vars] string; only the literal "true" enables it.
  // Absent/anything-else keeps telemetry fully off — the deployment
  // default, so OSS forks never send analytics unless they opt in.
  TELEMETRY_ENABLED?: string;
  // The liveworkspace telemetry service (liveworkspace/docs/telemetry.md). Unset means production's,
  // https://liveworkspace.app/api/telemetry; staging and local development name their own.
  TELEMETRY_URL?: string;
  // livediagram's secret on that service, sent as X-Telemetry-Key: it proves a batch with no Origin
  // is this app's own. A secret (wrangler secret put TELEMETRY_KEY); unset sends nothing.
  TELEMETRY_KEY?: string;
  // Resend API key for this app's notification and milestone emails
  // (docs/specs/014-identity/transactional-email.md; the onboarding series is liveworkspace's). When
  // absent the whole email feature is inert: no sends. Set via `wrangler secret put RESEND_API_KEY` for prod;
  // drop into `apps/api/.dev.vars` for local dev (gitignored, never commit).
  RESEND_API_KEY?: string;
  // From identity for outbound email (optional). Defaults to
  // "livediagram <hello@livediagram.app>". The domain must be verified in Resend.
  RESEND_FROM?: string;
  // Public origin used to build links in emails (optional). Defaults to
  // "https://livediagram.app".
  APP_BASE_URL?: string;
  // WHOSE model reads sticky notes from a photo, and where
  // (docs/specs/021-event-storming/note-reader.md). The PROVIDER is inferred
  // from which of these keys is set, because a key is provider-specific and its
  // name should say so — see ai-provider.ts. None = the photo reader is hidden
  // (capabilities reports aiEnabled:false and /api/ai/read-notes answers 503),
  // which is the self-host default.
  //
  // Set via `wrangler secret put <NAME>` in production; drop into
  // `apps/api/.dev.vars` for local dev (gitignored, never commit).
  GOOGLE_AI_STUDIO_API_KEY?: string;
  // Any other OpenAI-compatible endpoint (Mistral, OpenRouter, a local
  // llama.cpp or Ollama). Needs AI_BASE_URL and AI_VISION_MODEL with it.
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  // The reader's model, beating the Google default.
  AI_VISION_MODEL?: string;
  // Per-IP rate limiter for POST /api/ai/read-notes. Caps AI requests at
  // 20/60s per IP so a single client can't exhaust the operator's model budget.
  // Optional: absent (self-host) falls through to "allow".
  AI_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-token read limiter for token-authed GETs (docs/specs/015-api/public-api-and-tokens.md §3.5), keyed on the
  // token id. Token writes ride the WRITE_RATE_LIMITER (also keyed on the
  // token id); this covers reads, which that one doesn't. Optional: absent
  // falls through to "allow".
  API_TOKEN_READ_RATE_LIMITER?: {
    limit: (input: { key: string }) => Promise<{ success: boolean }>;
  };
  // Comma-separated Origin allow-list for POST /api/ai/read-notes
  // (docs/specs/021-event-storming/note-reader.md).
  // When set, the worker rejects 403 unless the request's Origin
  // header exactly matches one of the entries (trimmed for
  // whitespace). Unset = no check, matching the historical
  // behaviour so upgrades don't break. Hosted
  // livediagram.app sets this in apps/api/wrangler.toml [vars] (NOT the
  // dashboard, which a deploy wipes) to BOTH
  // "https://www.livediagram.app" and "https://livediagram.app" — `www`
  // first because the apex 301s to it, so `www` is what a browser sends.
  // This comment previously named the apex alone, which as an actual
  // value would 403 every request the editor makes.
  AI_ALLOWED_ORIGINS?: string;
  // When the literal string "true", POST /api/ai/read-notes requires a verified
  // access token and rejects a guest with 401
  // (docs/specs/021-event-storming/note-reader.md). Anything else (unset, "false", any other value) keeps
  // it open to guests. Hosted livediagram.app leaves it unset.
  AI_REQUIRE_SIGN_IN?: string;
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

// The env a document's own code runs with, inside its Durable Object (src/document-room/document-room.ts): the
// worker's bindings plus `DOCUMENT_DB`, the document's own SQLite behind the D1 surface (@liveworkspace/index-app item-db.ts).
// Only the Durable Object can make one, so a content read or write the worker attempts is a type error:
// the worker reaches content through the document's Durable Object instead.
export type DocumentEnv = Env & { DOCUMENT_DB: D1Database };
