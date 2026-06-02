# 22, Telemetry + public transparency dashboard

First-party, anonymous product analytics, surfaced on a **public** dashboard so anyone can see what we measure. The goal: understand which features get used so we know what works, while staying honest about the product's "no creepy tracking" stance.

## Principles

- **Anonymous, aggregate, first-party.** Events carry no user id, no IP, no user-generated content (never a diagram name, tab name, participant name, element text, share code, or diagram id). Only a fixed, app-defined vocabulary of enum values is ever stored.
- **No external vendors.** Ingestion is our api worker; storage is our existing D1 database; the dashboard is our own app. Nothing is sent to a third party, and data is never sold or shared beyond the public dashboard.
- **Off by default.** A single env var gates the whole system, so OSS self-hosters and forks emit/serve nothing unless they opt in. This keeps the "no required SaaS calls" rule ([03](03-open-source-and-business-model.md)) intact.
- **Transparent.** The dashboard is public (`/telemetry`), and the privacy policy + landing page say plainly what we capture and why, and link to it.

## Event schema

Every event is three small fields (`packages/api-schema`, shared by emitter + ingest so they can't drift):

```ts
type TelemetryEvent = {
  category: TelemetryCategory; // the "parent": Diagram | Element | Tab | Theme | Canvas | Template | Comment | Session
  action: TelemetryAction; // the "verb": Created | Deleted | Shared | Joined | Added | ...
  type?: string | null; // one app-defined reference value: 'Square', 'Edit', 'PNG', a template id, a theme name
};
```

Examples: `{category:'Diagram', action:'Created'}`, `{category:'Diagram', action:'Shared', type:'Edit'}`, `{category:'Diagram', action:'Joined', type:'Edit'}`, `{category:'Element', action:'Added', type:'Square'}`.

`category` and `action` validate against closed enums. `type` is a bounded set of app-defined values (shape kinds, share roles `Edit`/`View`, export formats, template ids, theme names) — all presets, never UGC. The ingest endpoint rejects values outside the allowed sets, so the public dashboard can only ever show known, safe strings.

## Storage (existing D1)

A new `events` table on the **existing** `DB` database (migration `apps/api/migrations/0015_*`), deliberately not a separate database so self-hosters who already provisioned `DB` get telemetry with zero extra setup:

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  action   TEXT NOT NULL,
  type     TEXT,
  ts       INTEGER NOT NULL  -- ms epoch
);
CREATE INDEX idx_events_ts ON events (ts);
```

No owner/IP column — rows are anonymous by construction. If write volume ever outgrows D1, the migration path is Workers Analytics Engine (write-optimised, same Cloudflare account, no new vendor); the ingest + summary contract stays the same.

## Retention

The dashboard surfaces three fixed windows that top out at **30 days** (Last month). Rows older than that are dead storage: never read, never aggregated, never user-visible. The api worker's `scheduled` handler runs a daily **60-day sweep** at 03:00 UTC that deletes events older than the retention floor (twice the dashboard's longest window, so a future "Last 60 days" expansion would have data to populate). Symmetric with the existing 90-day `change_log` retention (spec/12); both fire on the same cron, dispatched on `event.cron`. Self-hosters with `TELEMETRY_ENABLED` off never accumulate events in the first place, so the sweep is a no-op for them.

## API

- **`POST /api/events`** — ingest. Body `{ events: TelemetryEvent[] }` (batched). Validates each against the schema; inserts the valid ones with a server-stamped `ts`. Returns 204. **Deliberately exempt from the diagram write-rate-limiter** so a busy editor session's telemetry can never eat into / block a user's real diagram saves; client-side batching keeps request volume low. Anonymous (no auth required); no body field is stored beyond the three enums + ts. When telemetry is disabled, no-ops with 204.
- **`GET /api/telemetry/summary`** — the dashboard's only data source. Returns grouped counts for three **fixed** windows so the queries stay simple and the response is cacheable: **Today** (since UTC midnight), **Last 7 days**, **Last 30 days** ("Last month"). No custom ranges. Shape:
  ```ts
  {
    enabled: boolean;
    generatedAt: number;
    windows: {
      today: Window;
      last7: Window;
      last30: Window;
    }
  }
  // Window = { total: number; rows: { category; action; type; count }[] }
  ```
  Cached at the edge (Cache API, a few minutes) so a public traffic spike never hammers D1. When disabled, returns `{ enabled: false }`.

## On/off env var

`TELEMETRY_ENABLED` (worker, `wrangler.toml [vars]`, default off) is **authoritative**: it gates both `POST /api/events` and `GET /api/telemetry/summary`. The live editor also reads `NEXT_PUBLIC_TELEMETRY_ENABLED` (baked at build) to avoid emitting at all when off — a client optimisation; the server flag is the real gate. Both absent → fully off, which is the self-host default.

## Abuse controls

`POST /api/events` is public + unauthenticated by design, so it's guarded in layers without identifying users (it's anonymous trend data, not billing — the goal is "not worth it" + protect cost, not "impossible"):

- **Closed vocabulary.** Events are validated against the `category`/`action`/`type` enums and the batch is capped (100), so an attacker can only ever inflate counts of _known_ events — never inject arbitrary strings into the public dashboard or store junk.
- **Per-IP rate limit.** A dedicated `EVENTS_RATE_LIMITER` binding (separate from the diagram `WRITE_RATE_LIMITER`, so it never touches real users) keyed on `CF-Connecting-IP` — which the client can't forge, unlike `X-Owner-Id`. 120 batches/60s/IP: generous for a real session, bounding for a flood. The IP is a transient key, never stored. Degrades to "allow" when the binding is absent (self-host).
- **Same-origin filter.** A request whose `Origin` header is present and isn't this site is dropped (silently, 204) — stops casual cross-origin / drive-by posting. Spoofable by curl, which the rate limit then catches.
- **Cloudflare edge.** Automatic DDoS protection fronts the worker for free. **Recommended manual step:** add a WAF rate-limiting rule on `path eq /api/events` keyed by IP in the Cloudflare dashboard — it blocks abuse _before_ the worker runs (so it costs nothing per blocked request and never touches D1). This is the strongest, cheapest lever and is dashboard config, not code; hosted-only, so forks add their own.

Residual risk: a distributed botnet across many IPs could still nudge the numbers. Accepted — that's a lot of effort to juice an anonymous usage chart. If it ever matters, a global daily insert ceiling is the backstop.

## Emitting (live editor only)

A `track(category, action, type?)` helper in `apps/live/lib` buffers events and flushes them batched on an interval and on `visibilitychange`/unload via `navigator.sendBeacon`. Fire-and-forget; failures are swallowed (telemetry must never affect the editor). Gated by `NEXT_PUBLIC_TELEMETRY_ENABLED`. Instrumented only in the **editor** (`apps/live`), never the static marketing site, so the marketing "0 trackers" claim stays literally true. Call sites are one-liners, e.g. `track('Element', 'Added', 'Square')`.

The aim is to cover every meaningful interaction a person has with a diagram (discrete feature actions, never continuous gestures like drag/resize/pan/zoom or raw colour tweaks, which would just be noise). Current taxonomy:

- **Diagram**: Created; Shared `Edit`/`View`; Joined `Edit`/`View`; Duplicated; Deleted; Exported `Markdown`/`PDF`/`PNG`/`JSON`.
- **Element**: Added `<shape kind | Text | Sticky | Arrow | Image>`; Deleted; Duplicated; Grouped; Ungrouped; Locked; Unlocked.
- **Tab**: Created; Deleted; Duplicated; Renamed; Locked; Unlocked; Linked.
- **Theme**: Changed `<theme label>`.
- **Canvas**: Changed `<background pattern>`.
- **Template**: Used `<template kind>`.
- **Comment**: Added.

Extend by adding to the `TELEMETRY_CATEGORIES` / `TELEMETRY_ACTIONS` enums (if needed) + a one-line `track()` call at the interaction's handler. Hits / unique visits (a `Session` event per load) are deliberately not wired yet.

## Dashboard app (`apps/telemetry`)

A new Next.js static-export app (same stack as the others), mounted by the router at **`/telemetry`** (`basePath: '/telemetry'`, prefix stripped by the router exactly like `/live`). Public, read-only. A timeframe toggle (Today / Last 7 days / Last month) switches which window of the single `GET /api/telemetry/summary` payload it shows: headline totals + breakdowns grouped by category → action → type. Explains in-page that the data is anonymous, first-party, no vendors. Degrades to an "analytics not enabled" state when the summary returns `enabled: false`.

## Routing & deploy

- **Router** ([08](08-router-app.md)): a `TELEMETRY` service binding and a `/telemetry` route that strips the prefix and forwards (mirrors `/live`).
- **Deploy** ([10](10-deployment.md)): build + upload `apps/telemetry/out`, a `deploy-telemetry` job in parallel with marketing/live/api, and `deploy-router` gains it as a dependency. The `events` migration applies in the existing `wrangler d1 migrations apply DB` step.

## Provisioning (one-time, owner only)

1. Apply the migration: `wrangler d1 migrations apply DB --remote` (the deploy workflow already does this).
2. Set `TELEMETRY_ENABLED = "true"` in `apps/api/wrangler.toml [vars]` (and `NEXT_PUBLIC_TELEMETRY_ENABLED=true` for the live + telemetry builds) to turn it on. Leaving them unset keeps telemetry off — the self-host default.

## Privacy posture

The privacy policy + landing page state: we record anonymous, first-party product events (the three-field schema, examples), to learn which features help; no external analytics vendors; data is never sold or shared beyond the public `/telemetry` dashboard. This is consistent with the existing "no tracking pixels / no third-party analytics" claims — those remain true (first-party, anonymous, no third parties, no ad tracking).
