// API-worker type surface. The wire-format DTOs are now defined in
// `@liveplanner/api-schema` so the api worker and the live editor
// share the same source of truth (no more parallel type definitions
// drifting between them — see AGENTS.md's reuse-over-duplication
// rule). This file re-exports the canonical names under the
// historical `*DTO` aliases the worker code already uses, and adds
// the worker-only `Env` binding shape that has nowhere else to live.

export type {
  Project as ProjectDTO,
  ProjectSummary,
  TabSummary as TabSummaryDTO,
  TabRecord as TabDTO,
  Folder as FolderDTO,
  ParticipantRecord as ParticipantDTO,
  ParticipantPresence,
  ShareRole,
  ShareLink as ShareLinkDTO,
  ServerMessage,
  ClientMessage,
} from '@liveplanner/api-schema';

import type { PlanRoom } from './plan-room/plan-room';

// Worker bindings injected by Cloudflare at runtime. Not part of the
// wire format (purely a server-side capability handle).
export type Env = {
  // What is neither a plan's content nor the index's (docs/specs/015-api/api.md "Storage"): form links. A
  // person's settings, profile and API tokens are the liveworkspace accounts Worker's.
  DB: D1Database;
  // Each plan's Durable Object (src/plan-room/plan-room.ts): its content, in its own SQLite, and its
  // realtime room. Reached through plan-client.ts `planRoom(env, planId)`.
  PLAN_ROOM: DurableObjectNamespace<PlanRoom>;
  // Each person's workbench (src/workbench-store.ts, @liveworkspace/index-app workbench.ts): their pairing
  // requests, pairings, tickets and sessions, in its own SQLite.
  WORKBENCH: DurableObjectNamespace;
  // liveworkspace's index (liveworkspace/docs/one-explorer.md, src/index-service.ts): where every plan is and who
  // may open it. INDEX_ORIGIN is its origin (`https://liveworkspace.app`; locally `http://127.0.0.1:8793`): the
  // grants this api checks are signed by `${INDEX_ORIGIN}/api/index/jwks`. INDEX_KEY is this app's key there, a
  // secret, the same both ways: the index presents it on this app's internal endpoints (`/api/internal/items/*`),
  // and this app presents it to push a plan's summary and to act for an API token's account. Unset, the plan
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
  // what this API was registered as, e.g. `https://liveplanner.app/api`, and every access token must
  // name it as its audience. With either unset the worker stays in pure-guest mode (X-Owner-Id only).
  ACCOUNTS_URL?: string;
  API_RESOURCE?: string;
  // This app's OAuth client at the accounts Worker (its scripts/register-client.ts). Only the
  // /api/auth routes read them; the secret is a `wrangler secret`.
  ACCOUNTS_CLIENT_ID?: string;
  ACCOUNTS_CLIENT_SECRET?: string;
  // Local dev only: the origin the browser is on (the router, `http://localhost:3200`), which the
  // sign-in redirect returns to. Unset in production, where the request's own origin is right.
  AUTH_ORIGIN?: string;
  // The OAuth server the CLI signs in through (docs/specs/015-api/cli.md), an https origin.
  OAUTH_ISSUER?: string;
  // The oldest CLI the api accepts writes from, x.y.z; unset for no floor.
  CLI_MIN_VERSION?: string;
  // R2 bucket caching each project's SVG snapshot (`thumb/<id>`) and share card
  // (docs/specs/006-project/project-snapshots.md). Optional so a deploy without R2 still runs:
  // unbound, the snapshot doors answer 404 and the Explorer row keeps its icon.
  SNAPSHOTS?: R2Bucket;
  // Cloudflare Workers Rate Limiting API binding. Caps per-owner
  // writes (POST / PUT / DELETE) at the configured limit/period in
  // wrangler.toml. Optional so deployments without the
  // feature flag still serve (the check helper returns "allowed"
  // when the binding is absent).
  WRITE_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  // Per-IP limiter for the anonymous telemetry relay (docs/specs/017-telemetry/telemetry.md "The relay"),
  // SEPARATE from WRITE_RATE_LIMITER so it never competes with users'
  // real project writes. Keyed on CF-Connecting-IP. Optional: absent
  // (self-host) falls through to "allow", same as the write limiter.
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
  // Telemetry on/off switch (docs/specs/017-telemetry/telemetry.md) for this worker's own events. A plain
  // wrangler.toml [vars] string; only the literal "true" enables it.
  // Absent/anything-else keeps telemetry fully off — the unconfigured
  // default, so deployments never send analytics unless they opt in.
  TELEMETRY_ENABLED?: string;
  // liveworkspace's central telemetry service (liveworkspace/docs/telemetry.md). Unset means
  // production's, TELEMETRY_URL in @liveworkspace/telemetry.
  TELEMETRY_URL?: string;
  // liveplanner's Worker key for that service (a secret, the same value as the mcp worker's),
  // sent as X-Telemetry-Key. Unset means this worker sends no telemetry.
  TELEMETRY_KEY?: string;
  // Resend API key for transactional email (docs/specs/014-identity/transactional-email.md). When absent
  // the whole email feature is inert: no sends. Set via `wrangler secret put RESEND_API_KEY` for prod;
  // drop into `apps/api/.dev.vars` for local dev (gitignored, never commit).
  RESEND_API_KEY?: string;
  // From identity for outbound email (optional). Defaults to
  // "liveplanner <hello@liveplanner.app>". The domain must be verified in Resend.
  RESEND_FROM?: string;
  // Public origin used to build links in emails (optional). Defaults to
  // "https://liveplanner.app".
  APP_BASE_URL?: string;
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
};

// The env a plan's own code runs with, inside its Durable Object (src/plan-room/plan-room.ts): the
// worker's bindings plus `PLAN_DB`, the plan's own SQLite behind the D1 surface (plan-room/plan-db.ts).
// Only the Durable Object can make one, so a content read or write the worker attempts is a type error:
// the worker reaches content through the plan's Durable Object instead.
export type PlanEnv = Env & { PLAN_DB: D1Database };
