// API-worker type surface. The wire-format DTOs are now defined in
// `@livehuddle/api-schema` so the api worker and the live editor
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
} from '@livehuddle/api-schema';

import type { DocumentRoom } from './document-room/document-room';
import type { PersonStore } from './person-store/person-store';

// Worker bindings injected by Cloudflare at runtime. Not part of the
// wire format (purely a server-side capability handle).
export type Env = {
  // Each document's Durable Object (src/document-room/document-room.ts): its content, in its own SQLite, and its
  // realtime room. Reached through document-client.ts `documentRoom(env, documentId)`.
  DOCUMENT_ROOM: DurableObjectNamespace<DocumentRoom>;
  // Each person's Durable Object (src/person-store/person-store.ts): what livehuddle keeps for one person rather
  // than for one canvas (their shape libraries). Reached through person-client.ts `personStore(env, personId)`.
  PERSON_STORE: DurableObjectNamespace<PersonStore>;
  // The key liveworkspace's index presents on this app's internal endpoints (`/api/internal/items/*`,
  // liveworkspace/docs/specs/004-index/one-explorer-contracts.md). A secret; unset, those endpoints answer 404.
  INDEX_KEY?: string;
  // liveworkspace's index (liveworkspace/docs/specs/004-index/one-explorer.md): where every canvas is filed and who may open it.
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
  // what this API was registered as, e.g. `https://livehuddle.app/api`, and every access token must
  // name it as its audience, as must a guest's token (liveworkspace/docs/specs/003-accounts/accounts.md "Guests"). With either unset
  // no caller has an identity: only share-link visitors are served.
  ACCOUNTS_URL?: string;
  API_RESOURCE?: string;
  // This app's OAuth client at the accounts Worker (its scripts/register-client.ts). Only the
  // /api/auth routes read them; the secret is a `wrangler secret`.
  ACCOUNTS_CLIENT_ID?: string;
  ACCOUNTS_CLIENT_SECRET?: string;
  // Local dev only: the origin the browser is on (the router, `http://localhost:3500`), which the
  // sign-in redirect returns to. Unset in production, where the request's own origin is right.
  AUTH_ORIGIN?: string;
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
  // The Community's off switch (docs/specs/025-community/community.md "Turning the Community off"): false, 0 or off
  // turns it off; unset leaves it on. See community-enabled.ts.
  COMMUNITY_ENABLED?: string;
  // The liveworkspace Community service (liveworkspace/docs/specs/007-community/community.md), which keeps every app's posts. Unset means
  // production's, https://www.liveworkspace.app/api/community; staging and local development name their own.
  COMMUNITY_URL?: string;
  // livehuddle's secret on that service, sent as a bearer token on its app routes. A secret (wrangler secret put
  // COMMUNITY_KEY); unset, this deploy has no Community to publish to.
  COMMUNITY_KEY?: string;
  // liveworkspace's media service (liveworkspace/docs/specs/006-media/media.md, src/media.ts), which keeps every app's uploaded
  // images. Unset means production's, https://www.liveworkspace.app/api/media; staging and local development name
  // their own.
  MEDIA_URL?: string;
  // livehuddle's secret on that service, sent as a bearer token. A secret (wrangler secret put MEDIA_KEY); unset,
  // this deploy has no images, and the image endpoints answer 503 so the editor hides them.
  MEDIA_KEY?: string;
  // livehuddle's secret on liveworkspace's Drive mirror (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps"), the
  // same value as the service's DRIVE_KEY_LIVEHUDDLE: it opens the internal export door (its `file` format) and the
  // import door, nothing else. A secret (wrangler secret put DRIVE_KEY); unset, the mirror has no way in.
  DRIVE_KEY?: string;
  // The migrate tool's key on the migration door (docs/migration.md "The apps' migration door"): it opens
  // PUT /api/internal/items/:id/migration and PUT /api/internal/people/:id/migration (a person's shape libraries) and
  // nothing else. A secret set only while the migration runs (wrangler secret put MIGRATION_KEY), removed after;
  // unset, the item door takes INDEX_KEY alone (the index's handoff) and the person door is a 404.
  MIGRATION_KEY?: string;
  // Telemetry on/off switch (docs/specs/017-telemetry/telemetry.md). Gates every event this worker
  // sends to the liveworkspace telemetry service, its own and the relay's. A plain
  // wrangler.toml [vars] string; only the literal "true" enables it.
  // Absent/anything-else keeps telemetry fully off — the deployment
  // default, so OSS forks never send analytics unless they opt in.
  TELEMETRY_ENABLED?: string;
  // The liveworkspace telemetry service (liveworkspace/docs/specs/008-telemetry/telemetry.md). Unset means production's,
  // https://www.liveworkspace.app/api/telemetry; staging and local development name their own.
  TELEMETRY_URL?: string;
  // livehuddle's secret on that service, sent as X-Telemetry-Key: it proves a batch with no Origin
  // is this app's own. A secret (wrangler secret put TELEMETRY_KEY); unset sends nothing.
  TELEMETRY_KEY?: string;
  // Cloudflare Email Service's `send_email` binding for this app's notification and milestone emails
  // (docs/specs/014-identity/transactional-email.md, liveworkspace/docs/specs/003-accounts/email.md; the onboarding series is
  // liveworkspace's). Declared in wrangler.toml, no key: the binding is the credential. When absent the whole
  // email feature is inert: no sends.
  EMAIL?: SendEmail;
  // From identity for outbound email (optional), a bare address or "Name <address>". Defaults to
  // "livehuddle <hello@livehuddle.app>". Its domain must be onboarded to Email Service on this account.
  EMAIL_FROM?: string;
  // Public origin used to build links in emails (optional). Defaults to
  // "https://www.livehuddle.app".
  APP_BASE_URL?: string;
  // Per-token read limiter for token-authed GETs (docs/specs/015-api/public-api-and-tokens.md §3.5), keyed on the
  // token id. Token writes ride the WRITE_RATE_LIMITER (also keyed on the
  // token id); this covers reads, which that one doesn't. Optional: absent
  // falls through to "allow".
  API_TOKEN_READ_RATE_LIMITER?: {
    limit: (input: { key: string }) => Promise<{ success: boolean }>;
  };
  // Proximity audio (docs/specs/012-collaboration/proximity-audio.md "The mint route"): the Cloudflare Realtime SFU
  // app this Worker mints sessions and tracks on, and the TURN key it mints short-lived ICE credentials from. All
  // four are secrets (wrangler secret put), the owner's to create; with any unset, calls are off (calls/calls-gate.ts).
  // REALTIME_APP_TOKEN also keys the calls' session and track tokens (calls/call-tokens.ts).
  REALTIME_APP_ID?: string;
  REALTIME_APP_TOKEN?: string;
  TURN_KEY_ID?: string;
  TURN_KEY_API_TOKEN?: string;
  // The calls kill switch (docs/specs/016-platform/calls-kill-switch.md): the KV namespace holding `calls-mode`
  // (on, audio-only, off) and the budget poll's trip record. Absent, calls read as on and the poll does nothing.
  CALLS_SWITCH?: KVNamespace;
  // The budget poll's thresholds, in dollars a month above Realtime's free tier ([vars]; defaults 10 and 25).
  CALLS_AUDIO_ONLY_AT_USD?: string;
  CALLS_OFF_AT_USD?: string;
  // The Cloudflare account whose Realtime usage the poll prices ([vars]).
  CALLS_USAGE_ACCOUNT_ID?: string;
  // A Cloudflare API token with Account Analytics: Read alone (a secret). Unset, the poll does nothing.
  CALLS_ANALYTICS_TOKEN?: string;
  // Where a trip's email goes (a secret, so the address stays out of the repo). Unset, a trip sends no email.
  CALLS_ALERT_TO?: string;
  // Staging rehearsal only: a usage figure in GB the poll uses in place of the analytics request.
  CALLS_USAGE_TEST_GB?: string;
};

// The env a document's own code runs with, inside its Durable Object (src/document-room/document-room.ts): the
// worker's bindings plus `DOCUMENT_DB`, the document's own SQLite behind the D1 surface (@liveworkspace/index-app item-db.ts).
// Only the Durable Object can make one, so a content read or write the worker attempts is a type error:
// the worker reaches content through the document's Durable Object instead.
// `ROOM_PEOPLE`: the person tags of the sessions in the canvas's room right now, so a phone notification skips someone
// already looking at it (docs/specs/014-identity/phone-notifications.md).
export type DocumentEnv = Env & {
  DOCUMENT_DB: D1Database;
  ROOM_PEOPLE?: () => ReadonlySet<string>;
};
