# Telemetry: blueprint

Derived from [telemetry.md](../telemetry.md). The spec decides; this file only adds engineering precision, read from
the code. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `TELn`.
Paths are relative to the repository root.

Scope, by file:

| File                                                      | Role                                                                                                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/telemetry/src/index.ts`               | The Worker: `fetch` routes `/api/telemetry/events` and `/api/telemetry/summary`, 404 for every other path; `scheduled` sweeps                   |
| `liveworkspace/apps/telemetry/src/config.ts`              | `API_PATH`, `RETENTION_MS`, `CORS` (kept out of the entry, which may export only its handler)                                                   |
| `liveworkspace/apps/telemetry/src/env.ts`                 | `Env`; `appKey(env, app)` maps each app to its own `TELEMETRY_KEY_<APP>` secret                                                                 |
| `liveworkspace/apps/telemetry/src/ingest.ts`              | `handleIngest`: body bounds, `senderOf`, the rate limit, the vocabulary filters, the insert; always `204`                                       |
| `liveworkspace/apps/telemetry/src/vocabularies.ts`        | `VOCABULARIES` (each sender's `isValid` and `isServerOnly`), `isSiteSettingsEvent`                                                              |
| `liveworkspace/apps/telemetry/src/summary.ts`             | `handleSummary`: the app filter, the edge cache, the one query, `buildTelemetrySummary`                                                         |
| `liveworkspace/apps/telemetry/src/db.ts`                  | `insertEvents`, `dailyCountsSince`, `deleteEventsBefore`: the only three statements                                                             |
| `liveworkspace/apps/telemetry/src/test-env.ts`            | An in-memory `TELEMETRY_DB` for the tests (`env.rows`)                                                                                          |
| `liveworkspace/apps/telemetry/migrations/0001_events.sql` | The `events` table and its two indexes                                                                                                          |
| `liveworkspace/apps/telemetry/wrangler.toml`              | Routes, D1, the rate limiter, the cron, vars, per environment                                                                                   |
| `liveworkspace/apps/telemetry/.dev.vars.example`          | Local `ENVIRONMENT=development` and four dev keys                                                                                               |
| `packages/telemetry/src/apps.ts`                          | `TELEMETRY_APPS`, `TELEMETRY_APP_ORIGINS`, `PLATFORM_TELEMETRY_APP`, `PLATFORM_TELEMETRY_ORIGINS`, the guards                                   |
| `packages/telemetry/src/wire.ts`                          | `TELEMETRY_URL`, the two paths, `TelemetryWireEvent`, `TelemetryBatch`, `TELEMETRY_BATCH_MAX`, `TELEMETRY_KEY_HEADER`, `TELEMETRY_TYPE_PATTERN` |
| `packages/telemetry/src/summary.ts`                       | `TelemetrySummary` and friends, `TELEMETRY_WINDOW_DAYS`, `metricKey`, `telemetrySeriesStart`, `telemetryQueryStart`, `buildTelemetrySummary`    |
| `packages/telemetry/src/emitter.ts`                       | `createTelemetryEngine`: the browser's buffer, timer, one retry, per-app batches, page-hide beacon                                              |
| `packages/telemetry/src/server.ts`                        | `postServerEvents`: an app Worker's keyed send                                                                                                  |
| `packages/telemetry/src/explorer-events.ts`               | `EXPLORER_TELEMETRY_EVENTS`, `isExplorerTelemetryEvent`, `TEAM_ITEM_TYPES`                                                                      |
| `packages/telemetry/src/error-tokens.ts`                  | `pascalToken`, `errorTypeToken`, `errorNameToken`, `errorPageToken`, `createApiRouteLabel`: error events' `type` tokens                         |
| `packages/telemetry-client/src/*`                         | The browser side every app binds: opt-out, errors, timings, daily return, page hide                                                             |

## Domain and naming

| Term            | Identifier                                                     | Meaning                                                                           |
| --------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Event           | `TelemetryWireEvent` `{ category, action, type? }`             | Three short fields from a closed vocabulary; never user content                   |
| Batch           | `TelemetryBatch` `{ app, events }`                             | What one `POST /events` carries                                                   |
| App             | `TelemetryApp`, one of `TELEMETRY_APPS`                        | `livediagram.app`, `liveplanner.app`, `livedocuments.app`, `livedesign.app`       |
| Platform sender | `PLATFORM_TELEMETRY_APP` = `'liveworkspace.app'`               | The Explorer and Settings on liveworkspace.app, speaking for an app or for itself |
| Sender          | `TelemetrySender` = app or platform; `TELEMETRY_SENDERS`       | What a batch may name in `app`                                                    |
| Sender kind     | `'server' \| 'browser' \| 'platform'` (`senderOf`)             | How the batch proved who it is                                                    |
| Filter          | `TelemetryAppFilter` = app or `ALL_TELEMETRY_APPS` (`'all'`)   | What the summary is asked for                                                     |
| Window          | `TelemetryWindowKey` `today` / `last7` / `last30`              | 1, 7 or 30 UTC calendar days ending today (`TELEMETRY_WINDOW_DAYS`)               |
| Metric key      | `metricKey(category, action, type)` = `category\|action\|type` | One event's series key; `type` null is `''`                                       |
| Server-only     | `isServerEmittedEvent` (each app's `api-schema`)               | Events only the app's Workers may count (a sign-up, an email sent)                |

## Behaviour and state

### Ingest, in order (`handleIngest`)

Every exit answers `204` with `Access-Control-Allow-Origin: *`, stored or not.

1. `TELEMETRY_ENABLED !== 'true'`: stop.
2. `Content-Length` over `MAX_BODY_BYTES` (64 KiB): stop. Read the body as text; over 64 KiB, or not JSON: stop.
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
7. `insertEvents(env, app, valid, Date.now())`: one prepared `INSERT` per event in one `batch`. A thrown D1 error is
   swallowed (TEL1).

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
4. One query: `dailyCountsSince(env, telemetryQueryStart(now), app)` (null for `all`).
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

The one cron (`17 3 * * *`, both environments) runs, in `waitUntil`, `DELETE FROM events WHERE ts < now - RETENTION_MS`
(60 days) and logs `{"sweep":"events","rows":<n>}`; a failure logs `events sweep failed`.

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

`events` (`0001_events.sql`), the only table. No identity, no address, no owner.

| Column     | Type                                       | Written by                                   | Read by                                                                              |
| ---------- | ------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| `app`      | `TEXT NOT NULL`                            | `insertEvents` (the batch's sender)          | `dailyCountsSince` (`WHERE app = ?`, group)                                          |
| `category` | `TEXT NOT NULL`                            | `insertEvents`                               | `dailyCountsSince` (group)                                                           |
| `action`   | `TEXT NOT NULL`                            | `insertEvents`                               | `dailyCountsSince` (group)                                                           |
| `type`     | `TEXT` (null)                              | `insertEvents` (`e.type ?? null`)            | `dailyCountsSince` (group)                                                           |
| `ts`       | `INTEGER NOT NULL` (epoch ms, server time) | `insertEvents` (`Date.now()`, one per batch) | `dailyCountsSince` (`ts >= ?`, `date(ts / 1000, 'unixepoch')`), `deleteEventsBefore` |

Indexes: `events_app_ts_idx (app, ts)` for one app's range, `events_ts_idx (ts)` for every app's range and the sweep.

The summary query:

```sql
SELECT date(ts / 1000, 'unixepoch') AS day, app, category, action, type, COUNT(*) AS count
  FROM events WHERE [app = ? AND] ts >= ?
 GROUP BY day, app, category, action, type
```

## Errors and edge cases

| Case                                                                                                         | Answer                                                     |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Telemetry off                                                                                                | ingest `204`, nothing stored; summary `{ enabled: false }` |
| Body over 64 KiB (header or text), not JSON, wrong shape                                                     | `204`, nothing stored                                      |
| A key for `liveworkspace.app`, a wrong key, an unset key                                                     | `204`, nothing stored                                      |
| An app page naming another app; a foreign origin                                                             | `204`, nothing stored                                      |
| A localhost page outside development                                                                         | `204`, nothing stored                                      |
| Over the per-network limit                                                                                   | `204`, nothing stored (Workers are never limited)          |
| Events outside the vocabulary; server-only from a browser; non-Explorer, non-settings from liveworkspace.app | dropped, the rest stored                                   |
| More than 100 valid events                                                                                   | the first 100 stored                                       |
| D1 throws on insert                                                                                          | `204`, the batch lost                                      |
| Edge-cached summary (immutable headers)                                                                      | copied before the CORS header is set                       |

## Security and trust

- No identity: no cookies are read, no address stored; the rate-limit key lives only in the limiter.
- The `Origin` check is spoofable by any non-browser client; the bound is the per-network limit (120 a minute, both
  environments) and the closed vocabulary, so a forger adds only plausible counts.
- Keys: one secret per app (`TELEMETRY_KEY_LIVEDIAGRAM`, `_LIVEPLANNER`, `_LIVEDOCUMENTS`, `_LIVEDESIGN`), compared
  with `@liveworkspace/index-app/timing-safe` `timingSafeEqual`; a key never speaks for `liveworkspace.app`.
- `compatibility_flags = ["global_fetch_strictly_public"]`; `workers_dev = false` in both environments.

## Performance and limits

- Ingest: one D1 batch per accepted request, at most 100 rows; nothing on the request path waits for anything else.
- Summary: one grouped query over at most 59 days, then the edge for 300 s per filter (five cache keys: `all` and four
  apps). The fold is linear in rows; `summary.test.ts` "folds a worst-case 59 days of rows quickly" pins it.
- Browser: at most one request per app every 10 s, or at 25 buffered events; one retry, never a growing queue.

## Observability

| Level   | Line                            | Where        |
| ------- | ------------------------------- | ------------ |
| `log`   | `{"sweep":"events","rows":<n>}` | `index.ts`   |
| `error` | `events sweep failed`           | `index.ts`   |
| `error` | `summary cache put failed`      | `summary.ts` |

Ingest logs nothing, by design: every refusal is silent.

## Testing

| Test                                             | Pins                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/telemetry/src/index.test.ts`               | ingest then summary by app (`byApp` with liveworkspace.app); `unknown_app` 400; disabled answer; an edge hit with immutable headers; 404 outside the API and on the old `/telemetry/api` path; the 60-day sweep                                                                                                                                                                                                                                                                         |
| `apps/telemetry/src/ingest.test.ts`              | server time; each app's own vocabulary; a page speaking for another app refused; liveworkspace.app takes only Explorer events, and an app's settings events, and the shared ones in its own name; no page or key speaks for liveworkspace.app; localhost only in development; a Worker batch only with its own key; vocabulary and server-only drops; the 100 cap and malformed bodies; off stores nothing; pages limited by network, Workers never; the limiter key is `clientRateKey` |
| `apps/telemetry/src/env.test.ts`                 | each app its own key, none when unset                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `packages/telemetry/src/summary.test.ts`         | series start; today from UTC midnight; last 7 and last 30 spans; each window equals its trend span; query start; previous windows (inside and before the series); merged rows with per-app shares; the filter named; the worst-case fold                                                                                                                                                                                                                                                |
| `packages/telemetry/src/emitter.test.ts`         | one batch per app per flush; early flush at 25; nothing when off or opted out                                                                                                                                                                                                                                                                                                                                                                                                           |
| `packages/telemetry/src/server.test.ts`          | the keyed post; nothing when off, keyless or empty                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `packages/telemetry/src/apps.test.ts`            | apps by site; origin to app; the platform sender and its origins                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `packages/telemetry/src/explorer-events.test.ts` | known pairs with their own tokens only; every token fits the wire                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `packages/telemetry/src/error-tokens.test.ts`    | PascalCase tokens, no path or id shapes, the 40-character cap, known error names only, page and route labels without ids or share codes                                                                                                                                                                                                                                                                                                                                                 |

## Constants and configuration

| Constant                   | Value                                           | Where                            | Used by                                      |
| -------------------------- | ----------------------------------------------- | -------------------------------- | -------------------------------------------- |
| `API_PATH`                 | `'/api/telemetry'`                              | `apps/telemetry/src/config.ts`   | `index.ts` routing                           |
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

| Setting               | Production                                                                   | Staging                                    |
| --------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| Name                  | `liveworkspace-telemetry`                                                    | `liveworkspace-telemetry-staging`          |
| Route                 | `www.liveworkspace.app/api/telemetry*`, `liveworkspace.app/api/telemetry*`   | `staging.liveworkspace.app/api/telemetry*` |
| D1 `TELEMETRY_DB`     | `liveworkspace-telemetry`                                                    | `liveworkspace-telemetry-staging`          |
| `EVENTS_RATE_LIMITER` | namespace `1101`, 120 per 60 s                                               | namespace `2101`, 120 per 60 s             |
| Cron                  | `17 3 * * *`                                                                 | `17 3 * * *`                               |
| `ENVIRONMENT`         | `production`                                                                 | `staging`                                  |
| `TELEMETRY_ENABLED`   | `true`                                                                       | `true`                                     |
| Secrets               | `TELEMETRY_KEY_LIVEDIAGRAM`, `_LIVEPLANNER`, `_LIVEDOCUMENTS`, `_LIVEDESIGN` | the same                                   |

Locally (`.dev.vars.example`): `ENVIRONMENT=development` and `dev-<app>-key` for each key; `wrangler dev --port 8790`.

## Assets and external resources

None beyond D1, the rate-limit binding and `caches.default`.

## Defaults ledger

- `TEL1`: a D1 error on insert is swallowed and the batch lost; ingest still answers `204`.
- `TEL2`: every refusal answers `204` with nothing stored, so a sender learns nothing from the answer.
- `TEL3`: of more than 100 valid events in one batch, the first 100 are stored.
