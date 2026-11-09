# Telemetry: blueprint

Derived from [telemetry.md](../telemetry.md). The spec decides; this file only adds engineering precision, read from
the code. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `TELn`.
Paths are relative to the repository root.

Scope, by file:

| File                                                            | Role                                                                                                                                            |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/telemetry/src/index.ts`                     | The Worker: `fetch` routes `/api/telemetry/events` and `/api/telemetry/summary`, 404 for every other path; `scheduled` sweeps and recounts      |
| `liveworkspace/apps/telemetry/src/config.ts`                    | `API_PATH`, `DAY_MS`, `RETENTION_MS`, `CORS` (kept out of the entry, which may export only its handler)                                         |
| `liveworkspace/apps/telemetry/src/env.ts`                       | `Env`; `appKey(env, app)` maps each app to its own `TELEMETRY_KEY_<APP>` secret                                                                 |
| `liveworkspace/apps/telemetry/src/ingest.ts`                    | `handleIngest`: body bounds, `senderOf`, the rate limit, the vocabulary filters, the insert; always `204`                                       |
| `liveworkspace/apps/telemetry/src/vocabularies.ts`              | `VOCABULARIES` (each sender's `isValid` and `isServerOnly`), `isSiteSettingsEvent`                                                              |
| `liveworkspace/apps/telemetry/src/summary.ts`                   | `handleSummary`: the app filter, the edge cache, the one query, `buildTelemetrySummary`                                                         |
| `liveworkspace/apps/telemetry/src/db.ts`                        | `insertEvents`, `dailyCountsSince`, `deleteEventsBefore`, `recountDay`, `utcDay`: every statement                                               |
| `liveworkspace/apps/telemetry/src/test-env.ts`                  | `TELEMETRY_DB` as node:sqlite with the migrations applied (`@liveworkspace/api-kit/testing/sqlite-d1`); `env.rows`, `env.counts`, `env.seed`    |
| `liveworkspace/apps/telemetry/migrations/0001_events.sql`       | The `events` table and its two indexes                                                                                                          |
| `liveworkspace/apps/telemetry/migrations/0002_event_counts.sql` | The `event_counts` table, its first fill from `events`, and dropping `events_app_ts_idx`                                                        |
| `liveworkspace/apps/telemetry/wrangler.toml`                    | Routes, D1, the rate limiter, the cron, vars, per environment                                                                                   |
| `liveworkspace/apps/telemetry/.dev.vars.example`                | Local `ENVIRONMENT=development` and four dev keys                                                                                               |
| `packages/telemetry/src/apps.ts`                                | `TELEMETRY_APPS`, `TELEMETRY_APP_ORIGINS`, `PLATFORM_TELEMETRY_APP`, `PLATFORM_TELEMETRY_ORIGINS`, the guards                                   |
| `packages/telemetry/src/wire.ts`                                | `TELEMETRY_URL`, the two paths, `TelemetryWireEvent`, `TelemetryBatch`, `TELEMETRY_BATCH_MAX`, `TELEMETRY_KEY_HEADER`, `TELEMETRY_TYPE_PATTERN` |
| `packages/telemetry/src/summary.ts`                             | `TelemetrySummary` and friends, `TELEMETRY_WINDOW_DAYS`, `metricKey`, `telemetrySeriesStart`, `telemetryQueryStart`, `buildTelemetrySummary`    |
| `packages/telemetry/src/emitter.ts`                             | `createTelemetryEngine`: the browser's buffer, timer, one retry, per-app batches, page-hide beacon                                              |
| `packages/telemetry/src/server.ts`                              | `postServerEvents`: an app Worker's keyed send                                                                                                  |
| `packages/telemetry/src/explorer-events.ts`                     | `EXPLORER_TELEMETRY_EVENTS`, `isExplorerTelemetryEvent`, `TEAM_ITEM_TYPES`                                                                      |
| `packages/telemetry/src/error-tokens.ts`                        | `pascalToken`, `errorTypeToken`, `errorNameToken`, `errorPageToken`, `createApiRouteLabel`: error events' `type` tokens                         |
| `packages/telemetry-client/src/*`                               | The browser side every app binds: opt-out, errors, timings, daily return, page hide                                                             |

## Domain and naming

| Term            | Identifier                                                       | Meaning                                                                                                  |
| --------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Event           | `TelemetryWireEvent` `{ category, action, type? }`               | Three short fields from a closed vocabulary; never user content                                          |
| Batch           | `TelemetryBatch` `{ app, events }`                               | What one `POST /events` carries                                                                          |
| App             | `TelemetryApp`, one of `TELEMETRY_APPS` or `HELD_TELEMETRY_APPS` | `livediagram.app`, `liveplanner.app`, `livedocuments.app`, `livedesign.app`, `livehuddle.app`; none held |
| Platform sender | `PLATFORM_TELEMETRY_APP` = `'liveworkspace.app'`                 | The Explorer and Settings on liveworkspace.app, speaking for an app or for itself                        |
| Sender          | `TelemetrySender` = app or platform; `TELEMETRY_SENDERS`         | What a batch may name in `app`                                                                           |
| Sender kind     | `'server' \| 'browser' \| 'platform'` (`senderOf`)               | How the batch proved who it is                                                                           |
| Filter          | `TelemetryAppFilter` = app or `ALL_TELEMETRY_APPS` (`'all'`)     | What the summary is asked for                                                                            |
| Window          | `TelemetryWindowKey` `today` / `last7` / `last30`                | 1, 7 or 30 UTC calendar days ending today (`TELEMETRY_WINDOW_DAYS`)                                      |
| Metric key      | `metricKey(category, action, type)` = `category\|action\|type`   | One event's series key; `type` null is `''`                                                              |
| Server-only     | `isServerEmittedEvent` (each app's `api-schema`)                 | Events only the app's Workers may count (a sign-up, an email sent)                                       |

## Behaviour and state

### Ingest, in order (`handleIngest`)

Every exit answers `204` with `Access-Control-Allow-Origin: *`, stored or not.

1. `TELEMETRY_ENABLED !== 'true'`: stop.
2. `Content-Length` over `MAX_BODY_BYTES` (64 KiB): stop. Read the body through api-kit's `readCappedBody`, which
   counts bytes and stops reading past 64 KiB (a chunked body declares no length); over it, no body, or not JSON: stop.
3. `app` must pass `isTelemetrySender` and `events` must be an array: else stop.
4. `senderOf(request, env, app)`:
   1. `X-Telemetry-Key` present: `app` must be an app (never `liveworkspace.app`), its `appKey` set, and the key equal
      it by `timingSafeEqual`; then `'server'`, else refused.
   2. No `Origin`: refused.
   3. `Origin` in `PLATFORM_TELEMETRY_ORIGINS`: `'platform'`.
   4. `app` an app and `telemetryAppOfOrigin(Origin) === app`: `'browser'`.
   5. `ENVIRONMENT === 'development'` and a localhost origin (`isLocalhostOrigin`): `'platform'` when `app` is
      `liveworkspace.app`, else `'browser'`.
   6. Otherwise refused. Refused stops.
5. Not `'server'` and `EVENTS_RATE_LIMITER` bound: `limit({ key: clientRateKey(request) })` (the IPv4 address or
   the IPv6 /64); over the limit stops.
6. Filter, in order: `VOCABULARIES[app].isValid`; for a non-server sender, drop `isServerOnly`; for `'platform'`, keep
   only `isExplorerTelemetryEvent` or `isSiteSettingsEvent(app, e)`; then the first `TELEMETRY_BATCH_MAX` (100).
7. `insertEvents(env, app, valid, Date.now())`: one `batch` (one transaction) of one prepared `INSERT` per event, then
   one day-count upsert per distinct `category·action·type` in the batch, with its count (`INSERT INTO event_counts …
ON CONFLICT (app, day, category, action, type) DO UPDATE SET count = count + excluded.count`, `day = utcDay(ts)`,
   `type ?? ''`). Six bound parameters a statement at most. A thrown D1 error loses the whole batch, events and counts,
   and is swallowed (TEL1).

### Vocabularies (`vocabularies.ts`)

| Sender              | `isValid`                                                                                                                                               | `isServerOnly`                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `liveworkspace.app` | `isPlatformEvent`: string `category` and `action`, `type` absent or matching `TELEMETRY_TYPE_PATTERN`, and an Explorer event or a shared settings event | never                                      |
| each app            | `@<app>/api-schema` `isValidTelemetryEvent`                                                                                                             | `@<app>/api-schema` `isServerEmittedEvent` |

`isSiteSettingsEvent(sender, e)` matches `category·action·type` against a set built once per isolate from
`@liveworkspace/settings` `catalogueEvents(<app catalogue>)`; for `liveworkspace.app` the set is
`sharedCatalogueEvents` of all four catalogues.

### Summary (`handleSummary`)

1. `TELEMETRY_ENABLED !== 'true'`: `200 { enabled: false }`.
2. `app` query param, default `all`; not a filter: `400 { error: 'unknown_app' }`.
3. Cache key `<origin><path>?app=<filter>` (other params ignored). Outside development, a `caches.default` hit is
   returned as is.
4. One query: `dailyCountsSince(env, telemetryQueryStart(now), app)` (null for `all`), over `event_counts` only.
5. `buildTelemetrySummary(now, filter, app ? [app] : TELEMETRY_SENDERS, rows)`.
6. Outside development: `Cache-Control: public, max-age=300` (`CACHE_SECONDS`), and the cache put in `waitUntil`
   (a failure logs `summary cache put failed`).
7. `index.ts` copies the response (cached headers are immutable) and adds `Access-Control-Allow-Origin: *`.

### Building the summary (`buildTelemetrySummary`)

- The series is 30 UTC days from `telemetrySeriesStart(now)` = today's UTC midnight minus 29 days; the query starts
  30 days earlier (`telemetryQueryStart`), 59 days back, inside the 60-day retention.
- Each row's day offset from the series start: inside the series it adds to `totals`, `byCategory[category]`,
  `byMetric[metricKey]` and `byApp[app]` at that day, and to every window whose last N days hold it; rows in the N
  days before a window add to `previousWindows[k]` (for `today` and `last7` those days are inside the series).
- The same event from several apps merges into one row; each window keeps `byApp` with every counted sender, zero
  when silent. Rows sort by count, descending.
- Answer: `{ enabled: true, generatedAt, app, windows, previousWindows, daily: { days, totals, byCategory, byMetric, byApp } }`.

### Retention (`scheduled`)

The one cron (`17 3 * * *`, both environments) runs two jobs, each in its own `waitUntil`:

1. The sweep, `deleteEventsBefore(env, now - RETENTION_MS)` (60 days): one batch of `DELETE FROM events WHERE ts < ?`
   and `DELETE FROM event_counts WHERE day < utcDay(cutoff)`. The cutoff's own day keeps its counts: it is a day
   before `telemetryQueryStart`, so the summary never reads it. Logs `{"sweep":"events","rows":<events>,"counts":<n>}`;
   a failure logs `events sweep failed`.
2. The recount, `recountDay(env, <yesterday's UTC midnight>)`: one batch of `DELETE FROM event_counts WHERE day = ?` and
   an `INSERT … SELECT … FROM events WHERE ts >= midnight AND ts < midnight + DAY_MS GROUP BY app, category, action,
type` (through `events_ts_idx`). No batch can still land in yesterday (`ts` is stamped on arrival), so the
   counts equal the events afterwards. It heals the one known drift: during a deploy, between the migration and the
   new code, the old code stores events without counts. Logs `{"recount":"yesterday","counts":<n>}`; a failure logs
   `day recount failed`.

### The browser engine (`createTelemetryEngine`)

| From         | Event                                      | To       | Effect                                                                                                           |
| ------------ | ------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------- |
| any          | `track()` while disabled or opted out      | same     | nothing                                                                                                          |
| empty        | `track()`                                  | buffered | held as `{ app, event }`; timer armed for `TELEMETRY_FLUSH_DELAY_MS` (10 s); listeners attached                  |
| buffered     | buffer reaches `TELEMETRY_MAX_BUFFER` (25) | empty    | flush now                                                                                                        |
| buffered     | timer fires                                | empty    | flush: one batch per app, in first-seen order, `fetch` `text/plain`, `keepalive`, `credentials: 'omit'`          |
| buffered     | page hidden or unloaded                    | empty    | flush with `navigator.sendBeacon` (a `text/plain` Blob); a false or throwing beacon falls to the keepalive fetch |
| sent (fetch) | the fetch rejects (not on unload)          | retry    | the fresh events (never ones already retried) go to `retryBuffer`, capped at 25, oldest dropped; timer armed     |
| sent         | any HTTP answer                            | done     | never retried, so nothing counts twice                                                                           |

### The server send (`postServerEvents`)

No-op unless `TELEMETRY_ENABLED === 'true'`, `TELEMETRY_KEY` set and events non-empty. `POST
<TELEMETRY_URL || TELEMETRY_URL>/events`, JSON, `X-Telemetry-Key: <key>`; a thrown fetch is swallowed.

## Interfaces and contracts

| Route                             | Auth                                                                  | Request                                                  | Answers                                                                                                                                |
| --------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `OPTIONS /api/telemetry/events`   | none                                                                  |                                                          | `204`, `Access-Control-Allow-Origin: *`                                                                                                |
| `POST /api/telemetry/events`      | an app's `Origin`, liveworkspace.app's `Origin`, or `X-Telemetry-Key` | `TelemetryBatch` as `text/plain` or JSON, at most 64 KiB | `204` always, with `Access-Control-Allow-Origin: *`                                                                                    |
| other methods on `/events`        |                                                                       |                                                          | `405`, `Allow: POST`                                                                                                                   |
| `GET /api/telemetry/summary?app=` | none                                                                  | `app` = `all` (default) or an app                        | `200 TelemetrySummary`, or `200 { enabled: false }`, or `400 { error: 'unknown_app' }`; `Access-Control-Allow-Origin: *`; cached 300 s |
| other methods on `/summary`       |                                                                       |                                                          | `405`, `Allow: GET`                                                                                                                    |
| any other path                    |                                                                       |                                                          | `404 Not found` (the old `/telemetry/api/events` too)                                                                                  |

The browser origins per app are `TELEMETRY_APP_ORIGINS` (production, `www.` and staging for each app).

## Data and persistence

Two tables, `events` (`0001_events.sql`) and `event_counts` (`0002_event_counts.sql`). No identity, no address, no
owner in either.

| Column                                                               | Type | Written by | Read by |
| -------------------------------------------------------------------- | ---- | ---------- | ------- |
| `events`, one row per event, the record the counts are rebuilt from: |

| Column     | Type                                       | Written by                                   | Read by                                              |
| ---------- | ------------------------------------------ | -------------------------------------------- | ---------------------------------------------------- |
| `app`      | `TEXT NOT NULL`                            | `insertEvents` (the batch's sender)          | `recountDay` (group), the migration's first fill     |
| `category` | `TEXT NOT NULL`                            | `insertEvents`                               | `recountDay` (group), the first fill                 |
| `action`   | `TEXT NOT NULL`                            | `insertEvents`                               | `recountDay` (group), the first fill                 |
| `type`     | `TEXT` (null)                              | `insertEvents` (`e.type ?? null`)            | `recountDay` (group), the first fill                 |
| `ts`       | `INTEGER NOT NULL` (epoch ms, server time) | `insertEvents` (`Date.now()`, one per batch) | `recountDay` (one day's range), `deleteEventsBefore` |

Index: `events_ts_idx (ts)`, for the sweep and the recount. (`events_app_ts_idx (app, ts)` served the summary's raw
query; `0002` drops it.)

`event_counts`, one row per UTC day, app and event, `WITHOUT ROWID`, primary key `(app, day, category, action, type)`:

| Column     | Type                                | Written by                                                    | Read by                                    |
| ---------- | ----------------------------------- | ------------------------------------------------------------- | ------------------------------------------ |
| `app`      | `TEXT NOT NULL`                     | `insertEvents`, `recountDay`, the first fill                  | `dailyCountsSince` (`WHERE app = ?`)       |
| `day`      | `TEXT NOT NULL` (`YYYY-MM-DD`, UTC) | `utcDay(ts)`; SQLite's `date(ts / 1000, 'unixepoch')` in SQL  | `dailyCountsSince` (`day >= ?`), the sweep |
| `category` | `TEXT NOT NULL`                     | the same                                                      | `dailyCountsSince`                         |
| `action`   | `TEXT NOT NULL`                     | the same                                                      | `dailyCountsSince`                         |
| `type`     | `TEXT NOT NULL`, `''` for none      | `type ?? ''`, `COALESCE(type, '')`                            | `dailyCountsSince` (`NULLIF(type, '')`)    |
| `count`    | `INTEGER NOT NULL`                  | the batch's count, added on conflict; `COUNT(*)` on a recount | `dailyCountsSince`                         |

`type` is `''` rather than null because a `WITHOUT ROWID` key column can't be null, and nulls never conflict, so the
upsert couldn't find the row. No event's type is `''` (`TELEMETRY_TYPE_PATTERN` needs 1 to 40 characters).

The summary query (one app: a range of the key, already in order; every app: the day counts sorted, the order the
old grouped query over `events` gave, so rows with equal counts list as before):

```sql
SELECT day, app, category, action, NULLIF(type, '') AS type, count
  FROM event_counts WHERE [app = ? AND] day >= ?
 ORDER BY day, app, category, action, event_counts.type
```

**The first fill** (`0002_event_counts.sql`): `INSERT INTO event_counts SELECT app, date(ts / 1000, 'unixepoch'),
category, action, COALESCE(type, ''), COUNT(*) FROM events GROUP BY …` over every stored event (the table only holds the
60-day window), in one statement, so the summary is the same on the day it ships. That is safe as one statement under
D1's 30-second limit: production held 44,203 events (6,238 day counts) in November 2026, about 30 ms of D1 time to
group, and a local SQLite copy fills 1 million events in 1.4 to 1.9 s stored in time order, 2.2 to 4.0 s stored at random. A failed
migration stops the deploy before the code (CI's "Deploys"), so the old code keeps serving. Events the old code stores
between the migration and the new code have no counts until the next recount (03:17 UTC): until then the dashboard's
today, and the windows holding it, are short by those few seconds' events.

## Errors and edge cases

| Case                                                                                                         | Answer                                                       |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Telemetry off                                                                                                | ingest `204`, nothing stored; summary `{ enabled: false }`   |
| Body over 64 KiB (header or bytes read), no body, not JSON, wrong shape                                      | `204`, nothing stored                                        |
| A key for `liveworkspace.app`, a wrong key, an unset key                                                     | `204`, nothing stored                                        |
| An app page naming another app; a foreign origin                                                             | `204`, nothing stored                                        |
| A localhost page outside development                                                                         | `204`, nothing stored                                        |
| Over the per-network limit                                                                                   | `204`, nothing stored (Workers are never limited)            |
| Events outside the vocabulary; server-only from a browser; non-Explorer, non-settings from liveworkspace.app | dropped, the rest stored                                     |
| More than 100 valid events                                                                                   | the first 100 stored                                         |
| D1 throws on insert                                                                                          | `204`, the batch lost, logged `[telemetry] batch lost`       |
| D1 down on the summary                                                                                       | `503 storage_unavailable` with `Retry-After: 5` and CORS `*` |
| Edge-cached summary (immutable headers)                                                                      | copied before the CORS header is set                         |

## Security and trust

- No identity: no cookies are read, no address stored; the rate-limit key lives only in the limiter.
- The `Origin` check is spoofable by any non-browser client; the bound is the per-network limit (120 a minute, both
  environments) and the closed vocabulary, so a forger adds only plausible counts.
- Keys: one secret per app (`TELEMETRY_KEY_LIVEDIAGRAM`, `_LIVEPLANNER`, `_LIVEDOCUMENTS`, `_LIVEDESIGN`, `_LIVEHUDDLE`), compared
  with `@liveworkspace/index-app/timing-safe` `timingSafeEqual`; a key never speaks for `liveworkspace.app`.
- `compatibility_flags = ["global_fetch_strictly_public"]`; `workers_dev = false` in both environments.

## Performance and limits

- Ingest: one D1 batch per accepted request: at most 100 event rows and at most 100 day-count upserts (one per
  distinct event); nothing on the request path waits for anything else. Dropping `events_app_ts_idx` saves an index
  write per event, against one upsert per distinct event.
- Summary: one read of `event_counts` over at most 59 days, then the edge for 300 s per filter (six cache keys: `all`
  and five apps). Its rows, and its billed row reads, are one per day, app and event, whatever the traffic. Measured on
  a local SQLite copy with 1 million events over 60 days (5 apps, 120 distinct events, 7,200 rows in the window),
  November 2026, the range over three runs, each cell in time order then stored at random:

  | Read                   | Before (grouping `events`)    | After (`event_counts`)        |
  | ---------------------- | ----------------------------- | ----------------------------- |
  | All apps               | 1.5 to 2.0 s, 3.4 to 32.5 s   | 4.7 to 10.4 ms, 6.3 to 8.8 ms |
  | One app                | 0.25 to 0.36 s, 0.40 to 2.6 s | 0.9 to 1.3 ms, 0.8 to 1.8 ms  |
  | Recount one day (cron) |                               | 12 to 19 ms, 25 to 55 ms      |

  Before, the cost grew with every event and neared D1's 30-second limit at about 10 million events in 60 days.

- The fold is linear in rows; `summary.test.ts` "folds a worst-case 59 days of rows quickly" pins it, and `db.test.ts`
  "answers a worst case of day counts inside a CPU-time budget" pins the read and the fold together at 106,200 day
  counts (59 days, six senders, 300 events each).
- Browser: at most one request per app every 10 s, or at 25 buffered events; one retry, never a growing queue.

## Observability

| Level   | Line                                         | Where                                  |
| ------- | -------------------------------------------- | -------------------------------------- |
| `log`   | `{"sweep":"events","rows":<n>,"counts":<n>}` | `index.ts`                             |
| `error` | `events sweep failed`                        | `index.ts`                             |
| `log`   | `{"recount":"yesterday","counts":<n>}`       | `index.ts`                             |
| `error` | `day recount failed`                         | `index.ts`                             |
| `error` | `summary cache put failed`                   | `summary.ts`                           |
| `error` | `[telemetry] batch lost`                     | `ingest.ts`                            |
| `error` | `[d1] unavailable route=<route>`             | `index.ts` (the request-failure guard) |

Ingest logs no refusal, by design: every refusal is silent. A batch D1 failed to store is no refusal, so it is logged.

## Testing

| Test                                             | Pins                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/telemetry/src/index.test.ts`               | ingest then summary by app (`byApp` with liveworkspace.app); `unknown_app` 400; disabled answer; an edge hit with immutable headers; 404 outside the API and on the old `/telemetry/api` path; the 60-day sweep and yesterday's recount, their logs and failures                                                                                                                                                                                                                                                                                                                                              |
| `apps/telemetry/src/db.test.ts`                  | the day counts give the same rows and summary as grouping the events, on random batches; a batch added up first (one upsert per distinct event) and onto the day's count; types and separators kept apart; a failed batch stores nothing; retention by day; the recount heals uncounted events and is idempotent; the migration's first fill equals the old query and drops `events_app_ts_idx`; the summary never reads `events` and its one-app read is a key range; rows stay one per day and event as events grow; a CPU-time budget at 106,200 day counts; 100 distinct events inside D1's parameter cap |
| `apps/telemetry/src/ingest.test.ts`              | server time; each app's own vocabulary; a page speaking for another app refused; liveworkspace.app takes only Explorer events, and an app's settings events, and the shared ones in its own name; no page or key speaks for liveworkspace.app; localhost only in development; a Worker batch only with its own key; vocabulary and server-only drops; the 100 cap and malformed bodies; off stores nothing; pages limited by network, Workers never; the limiter key is `clientRateKey`                                                                                                                       |
| `apps/telemetry/src/env.test.ts`                 | each app its own key, none when unset                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `packages/telemetry/src/summary.test.ts`         | series start; today from UTC midnight; last 7 and last 30 spans; each window equals its trend span; query start; previous windows (inside and before the series); merged rows with per-app shares; the filter named; the worst-case fold                                                                                                                                                                                                                                                                                                                                                                      |
| `packages/telemetry/src/emitter.test.ts`         | one batch per app per flush; early flush at 25; nothing when off or opted out                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `packages/telemetry/src/server.test.ts`          | the keyed post; nothing when off, keyless or empty                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `packages/telemetry/src/apps.test.ts`            | apps by site; origin to app; the platform sender and its origins                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `packages/telemetry/src/explorer-events.test.ts` | known pairs with their own tokens only; every token fits the wire                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `packages/telemetry/src/error-tokens.test.ts`    | PascalCase tokens, no path or id shapes, the 40-character cap, known error names only, page and route labels without ids or share codes                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Constants and configuration

| Constant                   | Value                                           | Where                            | Used by                                      |
| -------------------------- | ----------------------------------------------- | -------------------------------- | -------------------------------------------- |
| `API_PATH`                 | `'/api/telemetry'`                              | `apps/telemetry/src/config.ts`   | `index.ts` routing                           |
| `DAY_MS`                   | `86_400_000`                                    | `config.ts`                      | the sweep, the recount                       |
| `RETENTION_MS`             | `60 * DAY_MS`                                   | `config.ts`                      | the sweep                                    |
| `CORS`                     | `{ 'Access-Control-Allow-Origin': '*' }`        | `config.ts`                      | every events answer                          |
| `MAX_BODY_BYTES`           | `64 * 1024`                                     | `ingest.ts`                      | the body bound                               |
| `CACHE_SECONDS`            | `300`                                           | `summary.ts`                     | `Cache-Control`                              |
| `TELEMETRY_URL`            | `'https://www.liveworkspace.app/api/telemetry'` | `packages/telemetry/src/wire.ts` | the server send's default; the apps' default |
| `TELEMETRY_DASHBOARD_URL`  | `'https://www.liveworkspace.app/telemetry'`     | `wire.ts`                        | the apps' `/telemetry` redirects             |
| `TELEMETRY_EVENTS_PATH`    | `'/events'`                                     | `wire.ts`                        | Worker, engine, server send                  |
| `TELEMETRY_SUMMARY_PATH`   | `'/summary'`                                    | `wire.ts`                        | Worker, dashboards                           |
| `TELEMETRY_BATCH_MAX`      | `100`                                           | `wire.ts`                        | ingest cap                                   |
| `TELEMETRY_KEY_HEADER`     | `'X-Telemetry-Key'`                             | `wire.ts`                        | `senderOf`, the server send                  |
| `TELEMETRY_TYPE_PATTERN`   | `/^[A-Za-z0-9 ._-]{1,40}$/`                     | `wire.ts`                        | every vocabulary's `type` check              |
| `TELEMETRY_WINDOW_DAYS`    | `{ today: 1, last7: 7, last30: 30 }`            | `summary.ts` (package)           | the windows                                  |
| `TELEMETRY_FLUSH_DELAY_MS` | `10_000`                                        | `emitter.ts`                     | the timer                                    |
| `TELEMETRY_MAX_BUFFER`     | `25`                                            | `emitter.ts`                     | early flush, retry cap                       |
| `MAX_TYPE_LENGTH`          | `40`                                            | `error-tokens.ts`                | error tokens                                 |

Worker configuration (`wrangler.toml`):

| Setting               | Production                                                                                  | Staging                                    |
| --------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Name                  | `liveworkspace-telemetry`                                                                   | `liveworkspace-telemetry-staging`          |
| Route                 | `www.liveworkspace.app/api/telemetry*`, `liveworkspace.app/api/telemetry*`                  | `staging.liveworkspace.app/api/telemetry*` |
| D1 `TELEMETRY_DB`     | `liveworkspace-telemetry`                                                                   | `liveworkspace-telemetry-staging`          |
| `EVENTS_RATE_LIMITER` | namespace `1101`, 120 per 60 s                                                              | namespace `2101`, 120 per 60 s             |
| Cron                  | `17 3 * * *`                                                                                | `17 3 * * *`                               |
| `ENVIRONMENT`         | `production`                                                                                | `staging`                                  |
| `TELEMETRY_ENABLED`   | `true`                                                                                      | `true`                                     |
| Secrets               | `TELEMETRY_KEY_LIVEDIAGRAM`, `_LIVEPLANNER`, `_LIVEDOCUMENTS`, `_LIVEDESIGN`, `_LIVEHUDDLE` | the same                                   |

Locally (`.dev.vars.example`): `ENVIRONMENT=development` and `dev-<app>-key` for each key; `wrangler dev --port 8790`.

## Assets and external resources

None beyond D1, the rate-limit binding and `caches.default`.

## Defaults ledger

- `TEL1`: a D1 error on insert loses the batch, logged `[telemetry] batch lost`; ingest still answers `204`.
- `TEL2`: every refusal answers `204` with nothing stored, so a sender learns nothing from the answer.
- `TEL3`: of more than 100 valid events in one batch, the first 100 are stored.
