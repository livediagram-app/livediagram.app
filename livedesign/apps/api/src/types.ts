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
  ImageSummary,
  ParticipantRecord as ParticipantDTO,
  ParticipantPresence,
  ShareRole,
  ShareLink as ShareLinkDTO,
  ServerMessage,
  ClientMessage,
} from '@livedesign/api-schema';

import type { DesignRoom } from './design-room/design-room';

// Worker bindings injected by Cloudflare at runtime. Not part of the
// wire format (purely a server-side capability handle).
export type Env = {
  // Each design's Durable Object (src/design-room/design-room.ts): its content, in its own SQLite, and its
  // realtime room. Reached through design-client.ts `designRoom(env, designId)`.
  DESIGN_ROOM: DurableObjectNamespace<DesignRoom>;
  // liveworkspace's index (liveworkspace/docs/specs/004-index/one-explorer.md, src/index-service.ts): where every design is and who
  // may open it. INDEX_ORIGIN is its origin (`https://www.liveworkspace.app`; locally `http://127.0.0.1:8793`): the
  // grants this api checks are signed by `${INDEX_ORIGIN}/api/index/jwks`. INDEX_KEY is this app's key there, a
  // secret, the same both ways: the index presents it on this app's internal endpoints (`/api/internal/items/*`),
  // and this app presents it to push a design's summary and to act for an API token's account. Unset, the design
  // doors answer as missing and the internal endpoints 404.
  INDEX_ORIGIN?: string;
  INDEX_KEY?: string;
  // The live build id: the deploy's commit, the same one baked into the editor build as
  // NEXT_PUBLIC_BUILD_ID (docs/specs/016-platform/stale-builds.md). Unset (local dev, a deployment that
  // sets neither) leaves it off the server release signal.
  BUILD_ID?: string;
  // Signing in through the liveworkspace accounts Worker (docs/specs/014-identity/auth-and-guest-access.md,
  // auth/accounts.ts + routes/auth.ts). ACCOUNTS_URL is its origin, e.g.
  // `https://liveworkspace.app`; its issuer and key set sit under `/api/auth`. API_RESOURCE is
  // what this API was registered as, e.g. `https://livedesign.app/api`, and every access token must
  // name it as its audience. With either unset no access token verifies: only guests and links are served.
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
  // The Community's off switch (docs/specs/025-community/community.md "Turning the Community off"): false, 0 or off
  // turns it off; unset leaves it on. See community-service.ts.
  COMMUNITY_ENABLED?: string;
  // The liveworkspace Community service (liveworkspace/docs/specs/007-community/community.md), which keeps every app's
  // posts. Unset means production's, https://www.liveworkspace.app/api/community; staging and local development name
  // their own.
  COMMUNITY_URL?: string;
  // livedesign's secret on that service (the same value as its COMMUNITY_KEY_LIVEDESIGN), sent as a bearer token
  // on its app routes. A secret (wrangler secret put COMMUNITY_KEY); unset, this deploy has no Community: publishing
  // answers 404 and the capabilities say it is off.
  COMMUNITY_KEY?: string;
  // liveworkspace's media service (liveworkspace/docs/specs/006-media/media.md, src/media.ts), which keeps every app's uploaded
  // images. Unset means production's, https://www.liveworkspace.app/api/media; staging and local development name
  // their own.
  MEDIA_URL?: string;
  // livedesign's secret on that service, sent as a bearer token. A secret (wrangler secret put MEDIA_KEY); unset,
  // this deploy has no images, and the image endpoints answer 503 so the editor hides them.
  MEDIA_KEY?: string;
  // livedesign's secret on liveworkspace's Drive mirror (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps"), the
  // same value as the service's DRIVE_KEY_LIVEDESIGN: it opens the internal export door (its `file` format) and the
  // import door, nothing else. A secret (wrangler secret put DRIVE_KEY); unset, the mirror has no way in.
  DRIVE_KEY?: string;
  // The migrate tool's key on the migration door (docs/migration.md "The apps' migration door"): it opens
  // PUT /api/internal/items/:id/migration and nothing else. A secret set only while the migration runs (wrangler
  // secret put MIGRATION_KEY), removed after; unset, the door takes INDEX_KEY alone (the index's handoff).
  MIGRATION_KEY?: string;
  // R2 bucket holding photo pages' blobs (docs/specs/031-photo/photo-store.md "The photo blob store"),
  // a tab's working data, not someone's pictures. Unbound, every photo blob route answers 503 photos_unavailable.
  PHOTO_BLOBS?: R2Bucket;
  // Cloudflare Workers Rate Limiting API binding. Caps per-owner
  // writes (POST / PUT / DELETE) at the configured limit/period in
  // wrangler.toml. Optional so deployments without the
  // feature flag still serve (the check helper returns "allowed"
  // when the binding is absent).
  WRITE_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-IP limiter for the anonymous telemetry relay (docs/specs/017-telemetry/telemetry.md "The relay"),
  // SEPARATE from WRITE_RATE_LIMITER so it never competes with users'
  // real design writes. Keyed on CF-Connecting-IP. Optional: absent
  // (when unbound) falls through to "allow", same as the write limiter.
  EVENTS_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-IP limiter for share-code resolution (GET /api/share/<code>),
  // which carries the optional share password and is otherwise an
  // unauthenticated read exempt from WRITE_RATE_LIMITER. Bounds blind
  // password / share-code guessing. Keyed on CF-Connecting-IP. Optional:
  // absent (when unbound) → "allow".
  SHARE_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-IP throttle for GET /api/unfurl (docs/specs/009-elements/link-cards.md) — an unauthenticated
  // outbound page fetch, so bound abuse. Keyed on CF-Connecting-IP. Optional:
  // absent (when unbound) → "allow".
  UNFURL_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Telemetry on/off switch (docs/specs/017-telemetry/telemetry.md) for this worker's own events. A plain
  // wrangler.toml [vars] string; only the literal "true" enables it.
  // Absent/anything-else keeps telemetry fully off — the
  // default, so a deployment never sends analytics unless they opt in.
  TELEMETRY_ENABLED?: string;
  // liveworkspace's central telemetry service (liveworkspace/docs/specs/008-telemetry/telemetry.md). Unset means
  // production's, TELEMETRY_URL in @liveworkspace/telemetry.
  TELEMETRY_URL?: string;
  // livedesign's Worker key for that service (a secret, the same value as the mcp worker's),
  // sent as X-Telemetry-Key. Unset means this worker sends no telemetry.
  TELEMETRY_KEY?: string;
  // Cloudflare Email Service's `send_email` binding for livedesign's own email
  // (docs/specs/014-identity/transactional-email.md, liveworkspace/docs/specs/003-accounts/email.md): notifications, milestones and
  // account deletion. No key: the binding is the credential. When absent none of them is sent. The onboarding
  // series is liveworkspace's, sent by its accounts Worker. `wrangler dev` simulates it, printing each email.
  EMAIL?: SendEmail;
  // From identity for outbound email (optional), a bare address or `Name <address>`. Defaults to
  // "livedesign <hello@livedesign.app>". The domain must be onboarded to Email Service on this account.
  EMAIL_FROM?: string;
  // Public origin used to build links in emails (optional). Defaults to
  // "https://www.livedesign.app".
  APP_BASE_URL?: string;
  // Per-token read limiter for token-authed GETs (docs/specs/015-api/public-api-and-tokens.md §3.5), keyed on the
  // token id. Token writes ride the WRITE_RATE_LIMITER (also keyed on the
  // token id); this covers reads, which that one doesn't. Optional: absent
  // (when unbound) falls through to "allow".
  API_TOKEN_READ_RATE_LIMITER?: {
    limit: (input: { key: string }) => Promise<{ success: boolean }>;
  };
  // The most bytes of photo blobs one tab may hold (docs/specs/031-photo/photo-store.md "Limits").
  // Unset, blank or non-positive = no limit (the default when unset). Hosted livedesign.app sets
  // "536870912" (512 MB).
  PHOTO_MAX_BYTES_PER_TAB?: string;
};

// The env a design's own code runs with, inside its Durable Object (src/design-room/design-room.ts): the
// worker's bindings plus `DESIGN_DB`, the design's own SQLite behind the D1 surface the room builds.
// Only the Durable Object can make one, so a content read or write the worker attempts is a type error:
// the worker reaches content through the design's Durable Object instead.
// `ROOM_PEOPLE`: the person tags of the sessions in the design's room right now, so a phone notification skips
// someone already looking at it (docs/specs/014-identity/phone-notifications.md).
export type DesignEnv = Env & { DESIGN_DB: D1Database; ROOM_PEOPLE?: () => ReadonlySet<string> };
