# Status history: blueprint

Derived from [status.md](../status.md), with the page's checks of [site.md "Status"](../../010-site/site.md). The spec
decides; this file only adds engineering precision, read from the code. Defaults applied where the spec is silent are
ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `STn`. Paths are relative to the repository root.

Scope, by file:

| File                                                   | Role                                                                                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/status/src/index.ts`               | The Worker: `fetch` hands `/api/status*` to `handleRead`, 404 elsewhere; `scheduled` runs `runOnce`                                 |
| `liveworkspace/apps/status/src/config.ts`              | `DAY_MS`, `RETENTION_DAYS`, `RETENTION_MS`, `PROBE_CONCURRENCY`, `CACHE_SECONDS`, `USER_AGENT`                                      |
| `liveworkspace/apps/status/src/env.ts`                 | `Env`: `ENVIRONMENT`, `PLATFORM_ORIGIN`, `STATUS_DB`, `READ_RATE_LIMITER`                                                           |
| `liveworkspace/apps/status/src/run.ts`                 | `runOnce`: probe, one read batch, the fold, one write batch; `probeTargets`, `environmentOfWorker`                                  |
| `liveworkspace/apps/status/src/probe.ts`               | `probeOne` (timeout, never a body), `pooled`, `probeAll`                                                                            |
| `liveworkspace/apps/status/src/rollup.ts`              | `rollupDay`, `percentile` (nearest rank), `uptimeTenths`                                                                            |
| `liveworkspace/apps/status/src/incidents.ts`           | `stepIncidents`: open, extend, close                                                                                                |
| `liveworkspace/apps/status/src/snapshot.ts`            | `buildLatest`, `buildHistory`, `latestEntry`                                                                                        |
| `liveworkspace/apps/status/src/api.ts`                 | `handleRead`, `parseDays`: the two reads, the edge cache, the limiter                                                               |
| `liveworkspace/apps/status/scripts/seed.ts`            | `seed:local`: 90 made-up days through the Worker's own code, into the local D1 only                                                 |
| `liveworkspace/apps/status/migrations/0001_status.sql` | `checks`, `daily`, `incidents`, `snapshots`                                                                                         |
| `liveworkspace/packages/status/src/services.ts`        | `statusGroups`, `allServices`, `probedServices`, `resolveProbeUrl`, `appOrigin`, `mcpOrigin`, `environmentOf`                       |
| `liveworkspace/packages/status/src/judge.ts`           | `SLOW_MS`, `TIMEOUT_MS`, `judgeAnswer`, `stateOf`, `deriveResults`, `worse`                                                         |
| `liveworkspace/packages/status/src/wire.ts`            | Paths, `HISTORY_DAYS`, `INCIDENTS_MAX`, `LETTER`, the wire types, day helpers, `sliceHistory`, `parseStatusHistory`, `emptyHistory` |

## Domain and naming

| Term     | Identifier                                                   | Meaning                                                                          |
| -------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Group    | `ServiceGroup`, id `liveworkspace` or the app's name         | The platform, then each app in `APP_SITES` order                                 |
| Service  | `Service`, id `<group>:<service>`                            | One row on the page                                                              |
| Check    | `Check`: `probe`, `derived` (`same` / `any`) or `skipped`    | How a service's state is found                                                   |
| Probe    | `Probe`: `read` (status in `ok`, JSON if `json`) or `reach`  | One request; `reach` is any 2xx or 3xx on the server                             |
| State    | `CheckState` `up` / `slow` / `down`; letters `u` / `s` / `d` | `down` on any error, `slow` past `SLOW_MS`, else `up`                            |
| Error    | `CheckError` `timeout` / `network` / `status` / `not_json`   | Why a check was down                                                             |
| Run      | `runOnce`, the hourly cron                                   | One pass over every service                                                      |
| Rollup   | `daily` row, `rollupDay`                                     | One service's UTC day                                                            |
| Incident | `incidents` row, `Incident`                                  | Consecutive `down` checks of one service, to the first answered check after them |
| Snapshot | `snapshots` row `latest` or `history`                        | A read API answer, built once a run                                              |

### The services (production)

35 services, 27 probed per run (`services.test.ts` pins 27):

| Group         | Service           | Check                                                                           |
| ------------- | ----------------- | ------------------------------------------------------------------------------- |
| liveworkspace | `site`            | read `HEAD /robots.txt`, 200                                                    |
| liveworkspace | `accounts`        | read `GET /.well-known/openid-configuration`, 200, JSON                         |
| liveworkspace | `index`           | read `GET /api/index/jwks`, 200, JSON                                           |
| liveworkspace | `community`       | read `GET /api/community/facets?app=livediagram.app`, 200, JSON                 |
| liveworkspace | `telemetry`       | read `OPTIONS /api/telemetry/events`, 204 ("Answers; database not checked")     |
| liveworkspace | `media`           | read `GET /api/previews`, 404, JSON ("Answers; storage not checked")            |
| each app      | `api`             | read `GET <app>/api/capabilities`, 200, JSON                                    |
| each app      | `realtime`        | derived `same` from `api`                                                       |
| each app      | `editor`          | reach `HEAD <app>/icon.svg`                                                     |
| each app      | `marketing`       | reach `HEAD <app>/robots.txt`                                                   |
| each app      | `help`            | reach `HEAD <app>/help/robots.txt`                                              |
| livediagram   | `community-pages` | reach `HEAD <app>/community/`                                                   |
| each app      | `mcp`             | read `GET <mcp>/health`, 200, JSON; `skipped` on staging (no public MCP host)   |
| each app      | `router`          | derived `any` from `api`, `editor`, `marketing`, `help` (and `community-pages`) |

`appOrigin(site, env)`: development `http://localhost:<LOCAL_PORTS[site]>`; staging `https://staging.<site>`;
production `https://www.<site>`. `mcpOrigin`: development `http://localhost:<MCP_DEV_PORTS>` (8788, 8888, 8988,
8990), staging none, production `https://mcp.<site>`. Paths starting `/` resolve on `PLATFORM_ORIGIN` (`resolveProbeUrl`).

## Behaviour and state

### One run (`runOnce`), in order

1. Groups for `environmentOfWorker(env)` (`staging` and `development` as named, anything else `production`).
2. Probe every `probedServices` target, `PROBE_CONCURRENCY` (6) at a time, in page order (`pooled`).
   Every target is fetched by URL; the Worker has no service bindings.
3. `deriveResults`: `same` copies the first source's result; `any` takes the fastest answered (`up` or `slow`)
   source, or the fastest source marked `down` when none answered. Results are kept in page order.
4. One read batch:
   1. today's checks so far: `SELECT service, state, ms FROM checks WHERE at >= dayStart(today) AND at < at`;
   2. open incidents: `WHERE ended_at IS NULL`;
   3. the window's earlier days: `daily WHERE day >= today - 89 AND day < today`;
   4. closed incidents: `WHERE ended_at >= dayStart(today - 89) ORDER BY started_at DESC LIMIT 50`.
5. Today's rollup per service: its earlier checks plus this run's, through `rollupDay`.
6. `stepIncidents(open, results, at)`.
7. `buildLatest(at, results)` and `buildHistory({ days: 90, daily: earlier + today, incidents: closed + after })`.
8. One write batch: `INSERT OR REPLACE` each check; upsert each `daily` row (`ON CONFLICT (day, service) DO UPDATE`);
   insert opened incidents; update changed ones; `DELETE FROM checks WHERE at < dayStart(today - 89)`;
   `DELETE FROM daily WHERE day < today - 89`; `DELETE FROM incidents WHERE ended_at < dayStart(today - 89)`;
   `INSERT OR REPLACE` the `latest` and `history` snapshots. D1 runs a batch as one transaction, so a failure writes
   nothing (`run.test.ts` pins it).
9. The report `{ at, checked, up, slow, down, opened, closed, rowsRead, rowsWritten }` (from D1's `meta`) is logged as
   `{"run":"status",…}`; a thrown run logs `status run failed`.

### One probe (`probeOne`)

`new Request(url, { method, redirect: 'follow', headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, */*;q=0.5' }, signal })`,
raced against a `TIMEOUT_MS` (10 s) timer that also aborts. The body is cancelled unread. `judgeAnswer` then
`stateOf(ms, error)`. A throw is `down`, `code: null`, error `timeout` when aborted else `network`, `ms` capped at the
timeout. It never throws.

### Rollup (`rollupDay`)

Counts `up`, `slow`, `down`; `p50` and `p95` are nearest-rank percentiles over the answered checks' `ms` (null when
none answered); `worst` by `down > slow > up`; an empty day is `up` with no times. `uptimeTenths` =
`round((up + slow) * 1000 / checks)`.

### Incidents (`stepIncidents`)

| From | This run's result for the service | To     | Effect                                                          |
| ---- | --------------------------------- | ------ | --------------------------------------------------------------- |
| none | `down`                            | open   | new incident: `startedAt = lastAt = at`, `checks: 1`, its error |
| none | `up` or `slow`                    | none   | nothing (a slow hour is no incident)                            |
| open | `down`                            | open   | `lastAt = at`, `checks + 1`, first error kept                   |
| open | `up` or `slow`                    | closed | `endedAt = at`                                                  |
| open | not checked this run              | open   | untouched                                                       |

`worst` is always `'down'`; the table's `CHECK (worst IN ('slow', 'down'))` allows `slow`, which the code never writes.

### The history snapshot (`buildHistory`)

For each service: `w` is one letter per day (`-` without checks), oldest first; `u` lists `[dayIndex, tenths]` for
days under 1000; `p` is answered over checked across the window, to two decimals. Incidents open or ended inside the
window, newest first, at most `INCIDENTS_MAX` (50), as `[service, started, ended, letter, checks, error]`.

### Reads (`handleRead`)

1. Path `''` or `/` is `latest`, `/history` is `history`, anything else `404 { error: 'not_found' }`.
2. Only `GET` and `HEAD`, else `405`, `Allow: GET, HEAD`.
3. `days` (history only): `parseDays`, empty means 90, 1 to 90 digits only, else `400 { error: 'bad_days' }`.
4. Cache key `<origin><path>[?days=<n>]`. Outside development a `caches.default` hit answers (a HEAD gets its headers
   only).
5. `READ_RATE_LIMITER` on a miss, keyed by `clientRateKey`: over it, `429 { error: 'rate_limited' }`, `Retry-After: 60`.
6. One row: `SELECT body FROM snapshots WHERE key = ?`. D1 itself down (`storageOutageOf`) is rethrown to the
   request-failure guard: `503 storage_unavailable`, nothing cached. Any other read error (no table yet) logs
   `status snapshot read failed` and counts as no row.
7. `latest`: the stored text, or `{ v: 1, at: null, services: {} }`. `history`: the stored text when it parses and
   holds exactly `days`, else `sliceHistory(stored ?? emptyHistory(now), days)`.
8. `Cache-Control: public, max-age=120`; a GET is put in the edge cache in `waitUntil` (failure logs `status cache
put failed`).

`sliceHistory` keeps the last `keep = clamp(days, 1, history.days)` days, re-indexes `u`, recomputes `p` as the mean
of the days' uptimes, and keeps incidents open or ended inside the new window.

## Interfaces and contracts

| Route                                  | Auth | Answers                                                                                                          |
| -------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------- |
| `GET`/`HEAD /api/status`               | none | `200 StatusLatest` `{ v: 1, at, services: { id: [letter, code, ms, error?] } }`                                  |
| `GET`/`HEAD /api/status/history?days=` | none | `200 StatusHistory` `{ v: 1, at, from, days, latest, services: { id: { p, w, u } }, incidents }`; `400 bad_days` |
| either, over the limit after a miss    |      | `429 { error: 'rate_limited' }`, `Retry-After: 60`                                                               |
| other methods                          |      | `405`, `Allow: GET, HEAD`                                                                                        |
| other paths under `/api/status`        |      | `404 { error: 'not_found' }`; outside it `404 Not found`                                                         |

The page (`liveworkspace/apps/site`) reads both from its own origin; `parseStatusHistory` rejects anything not of
this shape, such as a site's HTML 404.

## Data and persistence

| Table       | Key                        | Columns                                                                                                         | Written by                                     | Read by                                       |
| ----------- | -------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| `checks`    | `(at, service)`, no rowid  | `at` INT, `service` TEXT, `state` TEXT (`up`/`slow`/`down`), `code` INT null, `ms` INT, `error` TEXT null       | each run (`INSERT OR REPLACE`); prune by `at`  | each run: today's range                       |
| `daily`     | `(day, service)`, no rowid | `day` TEXT `YYYY-MM-DD`, `service`, `checks`, `up`, `slow`, `down`, `p50` null, `p95` null, `worst`             | each run (upsert today); prune by `day`        | each run: the window's earlier days           |
| `incidents` | `id` INTEGER PK            | `service`, `started_at`, `last_at`, `ended_at` null while open, `worst` (`slow`/`down`), `checks`, `error` null | each run (insert, update); prune by `ended_at` | each run: open ones, and closed in the window |
| `snapshots` | `key` TEXT PK, no rowid    | `key` (`latest`, `history`), `at`, `body` (JSON text)                                                           | each run (`INSERT OR REPLACE`)                 | every read that misses the cache              |

Indexes: `incidents_open_idx ON incidents (service) WHERE ended_at IS NULL`; `incidents_ended_idx ON incidents (ended_at)`.
`checks`' key leads with `at`, so today's read and the prune are both one key range.

## Errors and edge cases

| Case                                           | Behaviour                                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| No run yet                                     | `latest` with `at: null`; an empty 90-day `history`                                                  |
| Stored snapshot not JSON or wrong shape        | rebuilt from `emptyHistory` (or the stored history, sliced); never a 500                             |
| No `snapshots` table (fresh local DB)          | logged, treated as no row                                                                            |
| D1 down on a read                              | `503 storage_unavailable`, `Retry-After: 5`, logged `[d1] unavailable route=Get.Status…`; not cached |
| A probe hangs or ignores its signal            | the timer ends the wait at 10 s: `down`, `timeout`                                                   |
| A service missing from a run                   | its open incident stays open                                                                         |
| A derived service whose sources have no result | no result stored for it this run                                                                     |
| The write batch fails                          | nothing written; the run logs `status run failed`; the next run starts from the stored state         |
| Midnight UTC                                   | yesterday's `daily` row is never rewritten; today starts from this run alone                         |

## Security and trust

Public facts about public addresses: no people, no bodies kept, no secrets. Reads are anonymous; the limiter (60 a
minute per network, both environments) applies only to cache misses. `global_fetch_strictly_public`;
`workers_dev = false`. Every app is on its own custom domains, so every check goes out by URL.

## Performance and limits

Measured in [status.md "Performance"](../status.md#performance): 27 subrequests a run (under the 50 a Worker may make),
six at a time; two D1 batches; about 3,861 rows read and 72 to 110 written a run with 90 days stored; one row per read,
then the edge for 120 s. The worst case (every service down two days in three) keeps `/history` under 24 KB, 4 KB
gzipped (`api.test.ts`); `rollup.test.ts` rolls a worst-case day (24 checks for 35 services) a thousand times quickly.

## Observability

| Level   | Line                             | Where                                  |
| ------- | -------------------------------- | -------------------------------------- |
| `log`   | `{"run":"status", …RunReport}`   | `index.ts`                             |
| `error` | `status run failed`              | `index.ts`                             |
| `error` | `status snapshot read failed`    | `api.ts`                               |
| `error` | `[d1] unavailable route=<route>` | `index.ts` (the request-failure guard) |
| `error` | `status cache put failed`        | `api.ts`                               |

Probes send `User-Agent: liveworkspace-status/1 (+https://www.liveworkspace.app/status)`, so a service's own logs can tell
them apart.

## Testing

| Test                                   | Pins                                                                                                                                                                                                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/status/src/run.test.ts`          | a row per service, the rollup and both snapshots; today re-rolled each run; consecutive non-up checks as one incident closed by the next up; the 90-day prune; midnight; probing when no results are given; one batch, all or nothing                                 |
| `apps/status/src/probe.test.ts`        | up with code and time; slow past 1.5 s; wrong code and HTML-for-JSON down; reach 2xx/3xx up, 4xx/5xx down; network and timeout down with no code; no body read, the method and user agent; six at a time, in order; targets per environment, every app by URL         |
| `apps/status/src/api.test.ts`          | empty before a run; the last run, cacheable; slicing and `bad_days`; repeats from the edge without D1; HEAD from the edge without a body; no cache in development; GET/HEAD and two paths only; bad stored JSON; the per-network limit on misses; the worst-case size |
| `apps/status/src/rollup.test.ts`       | counts, percentiles, worst; empty days; nearest rank; the worst-case speed; incidents open, extend (first error kept), close on slow or up, and untouched when unchecked                                                                                              |
| `packages/status/src/judge.test.ts`    | expected codes and JSON; reach on the server; down, slow, up; state order; derived rooms and router; router down only when nothing answered                                                                                                                           |
| `packages/status/src/services.test.ts` | group order; each app's seven services; unique ids, derived on real checks; read only own origin or CORS routes; addresses per environment; path resolution; 27 requests a round                                                                                      |
| `packages/status/src/wire.test.ts`     | day uptime; UTC days; slicing (never widening, at least a day, null uptime without checks); the parser's accept and reject; the empty window                                                                                                                          |

## Constants and configuration

| Constant              | Value                                                                   | Where                          | Used by                        |
| --------------------- | ----------------------------------------------------------------------- | ------------------------------ | ------------------------------ |
| `DAY_MS`              | `86_400_000`                                                            | `apps/status/src/config.ts`    | `RETENTION_MS`                 |
| `RETENTION_DAYS`      | `90`                                                                    | `config.ts`                    | the prune                      |
| `RETENTION_MS`        | `RETENTION_DAYS * DAY_MS`                                               | `config.ts`                    | (exported for tests)           |
| `PROBE_CONCURRENCY`   | `6`                                                                     | `config.ts`                    | `probeAll`                     |
| `CACHE_SECONDS`       | `120`                                                                   | `config.ts`                    | read `Cache-Control`           |
| `USER_AGENT`          | `'liveworkspace-status/1 (+https://www.liveworkspace.app/status)'`      | `config.ts`                    | every probe                    |
| `SLOW_MS`             | `1500`                                                                  | `packages/status/src/judge.ts` | `stateOf`                      |
| `TIMEOUT_MS`          | `10_000`                                                                | `judge.ts`                     | `probeOne`                     |
| `STATUS_API_PATH`     | `'/api/status'`                                                         | `packages/status/src/wire.ts`  | the Worker's routing, the page |
| `STATUS_HISTORY_PATH` | `'/history'`                                                            | `wire.ts`                      | the read                       |
| `HISTORY_DAYS`        | `90`                                                                    | `wire.ts`                      | the window, `parseDays`        |
| `INCIDENTS_MAX`       | `50`                                                                    | `wire.ts`                      | `buildHistory`                 |
| `MCP_DEV_PORTS`       | livediagram 8788, liveplanner 8888, livedocuments 8988, livedesign 8990 | `services.ts`                  | development MCP checks         |

| Setting             | Production                                                           | Staging                                 |
| ------------------- | -------------------------------------------------------------------- | --------------------------------------- |
| Name                | `liveworkspace-status`                                               | `liveworkspace-status-staging`          |
| Route               | `www.liveworkspace.app/api/status*`, `liveworkspace.app/api/status*` | `staging.liveworkspace.app/api/status*` |
| D1 `STATUS_DB`      | `liveworkspace-status`                                               | `liveworkspace-status-staging`          |
| `READ_RATE_LIMITER` | namespace `1104`, 60 per 60 s                                        | namespace `2104`, 60 per 60 s           |
| Cron                | `7 * * * *`                                                          | `7 * * * *`                             |
| `ENVIRONMENT`       | `production`                                                         | `staging`                               |
| `PLATFORM_ORIGIN`   | `https://www.liveworkspace.app`                                      | `https://staging.liveworkspace.app`     |

Locally: `wrangler dev --port 3010 --test-scheduled --var ENVIRONMENT:development --var PLATFORM_ORIGIN:http://localhost:3000`;
`corepack pnpm seed:local` fills the local database. No secrets.

## Assets and external resources

The addresses in the services table; D1; `caches.default`.

## Defaults ledger

- `ST1`: a probe that hangs is cut at 10 s and counted `down` (`timeout`).
- `ST2`: a service missing from a run keeps its open incident open.
- `ST3`: yesterday's daily row is never rewritten after midnight UTC.
