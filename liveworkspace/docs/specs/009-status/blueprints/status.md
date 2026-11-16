# Status history: blueprint

Derived from [status.md](../status.md), with the page's checks of [site.md "Status"](../../010-site/site.md). The spec
decides; this file only adds engineering precision, read from the code. Defaults applied where the spec is silent are
ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `STn`. Paths are relative to the repository root.

Scope, by file:

| File                                                   | Role                                                                                                                                                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/status/src/index.ts`               | The Worker: `fetch` hands `/api/status*` to `handleRead`, 404 elsewhere; `scheduled` runs `runSignedIn` on `SIGNED_IN_CRON`, else `runOnce`                                                         |
| `liveworkspace/apps/status/src/signed-in.ts`           | `signedInCheck`, `mintGuestToken`, `signedInTarget`: the guest hand-off and the signed-in index call                                                                                                |
| `liveworkspace/apps/status/src/signed-in-run.ts`       | `runSignedIn`: the 5-minute run, one read batch, one write batch, snapshots patched                                                                                                                 |
| `liveworkspace/apps/status/src/environment.ts`         | `environmentOfWorker`                                                                                                                                                                               |
| `liveworkspace/apps/status/src/config.ts`              | `DAY_MS`, `RETENTION_DAYS`, `RETENTION_MS`, `PROBE_CONCURRENCY`, `CACHE_SECONDS`, `SIGNED_IN_CRON`, `HANDOFF_TIMEOUT_MS`, `SIGNED_IN_LOOKBACK_MS`, `USER_AGENT`                                     |
| `liveworkspace/apps/status/src/env.ts`                 | `Env`: `ENVIRONMENT`, `PLATFORM_ORIGIN`, `STATUS_DB`, `STATUS_GUEST_COOKIE` (secret, optional), `READ_RATE_LIMITER`                                                                                 |
| `liveworkspace/apps/status/src/run.ts`                 | `runOnce`: probe, one read batch, the fold, one write batch; `probeTargets`, `signedInServices`, `perHourOf`, the shared SQL                                                                        |
| `liveworkspace/apps/status/src/probe.ts`               | `withTimeout`, `probeOne` (timeout, never a body), `pooled`, `probeAll` (a target's `run` in place of a plain probe)                                                                                |
| `liveworkspace/apps/status/src/rollup.ts`              | `rollupDay`, `addToDay`, `percentile` (nearest rank), `uptimeTenths`                                                                                                                                |
| `liveworkspace/apps/status/src/incidents.ts`           | `stepIncidents`: open, extend, close; `confirm` for second-down-in-a-row services                                                                                                                   |
| `liveworkspace/apps/status/src/snapshot.ts`            | `buildLatest`, `buildHistory` (`perHour`), `latestEntry`, `patchLatest`, `patchHistory`                                                                                                             |
| `liveworkspace/apps/status/src/api.ts`                 | `handleRead`, `parseDays`: the two reads, the edge cache, the limiter                                                                                                                               |
| `liveworkspace/apps/status/scripts/seed.ts`            | `seed:local`: 90 made-up days through the Worker's own code, into the local D1 only                                                                                                                 |
| `liveworkspace/apps/status/migrations/0001_status.sql` | `checks`, `daily`, `incidents`, `snapshots`                                                                                                                                                         |
| `liveworkspace/packages/status/src/services.ts`        | `statusGroups`, `allServices`, `probedServices`, `workerServices`, `handoffOrigin`, `resolveProbeUrl`, `appOrigin`, `mcpOrigin`, `environmentOf`, `SIGNED_IN_TIMEOUT_MS`, `SIGNED_IN_EVERY_MINUTES` |
| `liveworkspace/packages/status/src/judge.ts`           | `SLOW_MS`, `TIMEOUT_MS`, `judgeAnswer`, `stateOf`, `deriveResults`, `worse`                                                                                                                         |
| `liveworkspace/packages/status/src/wire.ts`            | Paths, `HISTORY_DAYS`, `INCIDENTS_MAX`, `LETTER`, the wire types, day helpers, `uptimePercent`, `poolUptime`, `groupOfService`, `sliceHistory`, `parseStatusHistory`, `emptyHistory`                |

## Domain and naming

| Term         | Identifier                                                             | Meaning                                                                               |
| ------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Group        | `ServiceGroup`, id `liveworkspace` or the app's name                   | The platform, then each app in `APP_SITES` order                                      |
| Service      | `Service`, id `<group>:<service>`                                      | One row on the page                                                                   |
| Check        | `Check`: `probe`, `derived` (`same` / `any`) or `skipped`              | How a service's state is found                                                        |
| Probe        | `Probe`: `read` (status in `ok`, JSON if `json`) or `reach`            | One request; `reach` is any 2xx or 3xx on the server                                  |
| Worker probe | `Service.worker`: `WorkerProbe` `signed-in`                            | A check only the Worker makes, in place of `check`, with its secret; never the page's |
| State        | `CheckState` `up` / `slow` / `down`; letters `u` / `s` / `d`           | `down` on any error, `slow` past `SLOW_MS`, else `up`                                 |
| Error        | `CheckError` `timeout` / `network` / `status` / `not_json` / `sign_in` | Why a check was down (`sign_in`: the guest hand-off gave no token)                    |
| Run          | `runOnce`, the hourly cron                                             | One pass over every service                                                           |
| 5-minute run | `runSignedIn`, `SIGNED_IN_CRON`                                        | The signed-in checks alone, between hourly runs                                       |
| Rollup       | `daily` row, `rollupDay`                                               | One service's UTC day                                                                 |
| Incident     | `incidents` row, `Incident`                                            | Consecutive `down` checks of one service, to the first answered check after them      |
| Snapshot     | `snapshots` row `latest` or `history`                                  | A read API answer, built once a run                                                   |

### The services (production)

35 services, 27 probed per run (`services.test.ts` pins 27):

| Group         | Service           | Check                                                                                                                                               |
| ------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| liveworkspace | `site`            | read `HEAD /robots.txt`, 200                                                                                                                        |
| liveworkspace | `accounts`        | read `GET /.well-known/openid-configuration`, 200, JSON                                                                                             |
| liveworkspace | `index`           | read `GET /api/index/jwks`, 200, JSON; Worker: `signed-in` `GET /api/index/placement-defaults`, 200, JSON, 5 s, every 5 min, via livediagram's door |
| liveworkspace | `community`       | read `GET /api/community/facets?app=livediagram.app`, 200, JSON                                                                                     |
| liveworkspace | `telemetry`       | read `OPTIONS /api/telemetry/events`, 204 ("Answers; database not checked")                                                                         |
| liveworkspace | `media`           | read `GET /api/previews`, 404, JSON ("Answers; storage not checked")                                                                                |
| each app      | `api`             | read `GET <app>/api/capabilities`, 200, JSON                                                                                                        |
| each app      | `realtime`        | derived `same` from `api`                                                                                                                           |
| each app      | `editor`          | reach `HEAD <app>/icon.svg`                                                                                                                         |
| each app      | `marketing`       | reach `HEAD <app>/robots.txt`                                                                                                                       |
| each app      | `help`            | reach `HEAD <app>/help/robots.txt`                                                                                                                  |
| livediagram   | `community-pages` | reach `HEAD <app>/community/`                                                                                                                       |
| app with MCP  | `mcp`             | read `GET <mcp>/health`, 200, JSON; `skipped` on staging (no public MCP host)                                                                       |
| each app      | `router`          | derived `any` from `api`, `editor`, `marketing`, `help` (and `community-pages`)                                                                     |

`appOrigin(site, env)`: development `http://localhost:<LOCAL_PORTS[site]>`; staging `https://staging.<site>`;
production `https://www.<site>`. `mcpOrigin`: development `http://localhost:<MCP_DEV_PORTS>` (8788, 8888, 8988,
8990; livehuddle has none), staging none, production `https://mcp.<site>`. `hasMcp(site)`: whether the app has an entry in
`MCP_DEV_PORTS`; an app without one gets no `mcp` row, and `mcpOrigin` is null for it in every
environment. `appGroup(site, env)` is exported for one app's group; `statusGroups` lists `APP_SITES` only, so a held
app is never on the page. Paths starting `/` resolve on `PLATFORM_ORIGIN` (`resolveProbeUrl`).

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

### The signed-in check (`signedInCheck`)

With `STATUS_GUEST_COOKIE` set, `signedInServices` is `workerServices(groups)` (only `liveworkspace:index`); unset, it is
empty and every service keeps its `check` (`RunReport.signedIn: 'no_secret'`; the 5-minute run returns
`{ skipped: 'no_secret' }`). `probeTargets` swaps such a service's target for one whose `run` is:

1. `mintGuestToken`, each step a `GET` with `redirect: 'manual'`, the user agent and `HANDOFF_TIMEOUT_MS` (5 s)
   through `withTimeout`, its body cancelled:
   1. `<handoffOrigin(probe, env)>/api/auth/guest?state=<32 hex>`, no cookie; a 3xx `Location`, resolved against it;
   2. only when that URL's origin is `PLATFORM_ORIGIN`'s: it, with `Cookie: lw_guest=<secret>`; a 3xx `Location`;
   3. its fragment's `state` must equal ours, and its `guest_token` is the token.

   Any other answer is null; a timeout or network error rejects. Either way the result is `down`, `code: null`,
   `error: 'sign_in'`, `ms` since the start.

2. `probeOne({ kind: 'read', url: probe.url, method: 'GET', ok: probe.ok, json: true })` on `PLATFORM_ORIGIN`, its
   fetch copying each request with `Authorization: Bearer <token>`, timeout `probe.timeoutMs` (5 s).

`stepIncidents(..., confirm)` gets each signed-in service's previous check
(`SELECT at, state, error FROM checks WHERE at >= at - 15 min AND at < at AND service = ? ORDER BY at DESC LIMIT 1`):
a down result with no open incident opens one only when that check was down too, `startedAt` its `at`, `checks: 2`,
its error (else this one's). `buildHistory`'s `perHour` divides such a service's totals by `60 / everyMinutes` (12)
before `poolUptime`; its own `p` is unweighted.

### The 5-minute run (`runSignedIn`)

1. No signed-in services: `{ skipped: 'no_secret' }`, no D1 call.
2. Each service's `signedInCheck` (or the handed-in `results`).
3. One read batch: per service its open incident, its previous check (as above) and today's `daily` row by key; then
   `SELECT key, body FROM snapshots WHERE key IN ('latest', 'history')`.
4. `stepIncidents` per service with `confirm`; `addToDay(row, check)`: counts and `worst` move, `p50` and `p95` kept
   (a new row, or one with none, takes this check's `ms` when it answered).
5. One write batch: `INSERT OR REPLACE` the check, upsert the day (absolute values), insert or update the incident,
   then `patchLatest` (the entry; `at` kept) and `patchHistory` (the entry; when `addDays(from, days - 1)` is today,
   the last letter of `w` and today's `u`; the service's incidents, open and restated ones replaced by `after`,
   newest first, at most 50; `at`, `p` and `uptime` kept). A snapshot missing or unreadable (`parseStatusHistory`, a
   `v: 1` latest) isn't written; the hourly run rebuilds it.
6. Logged as `{"run":"status-signed-in",…SignedInReport}`; a thrown run logs `status signed-in run failed`.

### One probe (`probeOne`)

`new Request(url, { method, redirect: 'follow', headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, */*;q=0.5' }, signal })`,
raced through `withTimeout` against a `TIMEOUT_MS` (10 s) timer that also aborts. The body is cancelled unread. `judgeAnswer` then
`stateOf(ms, error)`. A throw is `down`, `code: null`, error `timeout` when aborted else `network`, `ms` capped at the
timeout. It never throws.

### Rollup (`rollupDay`)

Counts `up`, `slow`, `down`; `p50` and `p95` are nearest-rank percentiles over the answered checks' `ms` (null when
none answered); `worst` by `down > slow > up`; an empty day is `up` with no times. `uptimeTenths` =
`round((up + slow) * 1000 / checks)`.

### Incidents (`stepIncidents`)

| From | This run's result for the service       | To     | Effect                                                                                |
| ---- | --------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| none | `down`                                  | open   | new incident: `startedAt = lastAt = at`, `checks: 1`, its error                       |
| none | `up` or `slow`                          | none   | nothing (a slow hour is no incident)                                                  |
| open | `down`                                  | open   | `lastAt = at`, `checks + 1`, first error kept                                         |
| open | `up` or `slow`                          | closed | `endedAt = at`                                                                        |
| open | not checked this run                    | open   | untouched                                                                             |
| open | no longer on the list                   | closed | `endedAt = at`, left out of `after`                                                   |
| none | `down`, in `confirm`, previous not down | none   | nothing yet: its first down in a row                                                  |
| none | `down`, in `confirm`, previous down     | open   | `startedAt` = previous `at`, `lastAt = at`, `checks: 2`, previous error or this one's |

`worst` is always `'down'`; the table's `CHECK (worst IN ('slow', 'down'))` allows `slow`, which the code never writes.

### The history snapshot (`buildHistory`)

For each service: `w` is one letter per day (`-` without checks), oldest first; `u` lists `[dayIndex, tenths]` for
days under 1000; `p` is `uptimePercent(answered, checked)` across the window. `uptime` is `poolUptime` of the same
per-service totals: `groups[groupOfService(id)]` and `all` each sum `answered` and `checks` over their services, then
`uptimePercent`. `uptimePercent(a, n)` is null when `n` is 0, `100` when `a >= n`, else
`min(99.99, round(a * 10000 / n) / 100)`. Incidents of the listed services
open or ended inside the window, newest first, at most `INCIDENTS_MAX` (50), as `[service, started, ended, letter,
checks, error]`.

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
of the days' uptimes (`uptimePercent(sum of tenths, days * 1000)`), recomputes `uptime` the same way with each day of
each service as 1000 checks and its tenths answered, and keeps incidents open or ended inside the new window.

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

| Table       | Key                        | Columns                                                                                                         | Written by                                                     | Read by                                                         |
| ----------- | -------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| `checks`    | `(at, service)`, no rowid  | `at` INT, `service` TEXT, `state` TEXT (`up`/`slow`/`down`), `code` INT null, `ms` INT, `error` TEXT null       | each run and 5-minute run (`INSERT OR REPLACE`); prune by `at` | each run: today's range; the previous check (a 15-minute range) |
| `daily`     | `(day, service)`, no rowid | `day` TEXT `YYYY-MM-DD`, `service`, `checks`, `up`, `slow`, `down`, `p50` null, `p95` null, `worst`             | each run (upsert today); prune by `day`                        | each run: the window's earlier days                             |
| `incidents` | `id` INTEGER PK            | `service`, `started_at`, `last_at`, `ended_at` null while open, `worst` (`slow`/`down`), `checks`, `error` null | each run (insert, update); prune by `ended_at`                 | each run: open ones, and closed in the window                   |
| `snapshots` | `key` TEXT PK, no rowid    | `key` (`latest`, `history`), `at`, `body` (JSON text)                                                           | each run (`INSERT OR REPLACE`)                                 | every read that misses the cache                                |

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
| `STATUS_GUEST_COOKIE` unset                    | the index keeps its anonymous check; the 5-minute run checks nothing (`skipped: 'no_secret'`)        |
| The hand-off redirects off `PLATFORM_ORIGIN`   | the cookie is never sent; `down`, `sign_in`                                                          |
| A 5-minute run after midnight, before 00:07    | the history's bars are left alone (its window ends yesterday); the day's row is still written        |
| Midnight UTC                                   | yesterday's `daily` row is never rewritten; today starts from this run alone                         |

## Security and trust

Public facts about public addresses: no people, no bodies kept. One secret, `STATUS_GUEST_COOKIE` (an empty guest's
signed `lw_guest` cookie), read only in `signed-in.ts`, sent only to accounts' hand-off on `PLATFORM_ORIGIN`, never
stored, logged or put in the catalogue the page reads (`services.test.ts` and the site's `probe.test.ts` pin it); a
leak reaches an empty guest. Reads are anonymous; the limiter (60 a
minute per network, both environments) applies only to cache misses. `global_fetch_strictly_public`;
`workers_dev = false`. Every app is on its own custom domains, so every check goes out by URL.

## Performance and limits

Measured in [status.md "Performance"](../status.md#performance): 27 subrequests a run (under the 50 a Worker may make),
six at a time; two D1 batches; about 3,861 rows read and 72 to 110 written a run with 90 days stored; one row per read,
then the edge for 120 s. The worst case (every service down two days in three) keeps `/history` under 24 KB, 4 KB
gzipped (`api.test.ts`); `rollup.test.ts` rolls a worst-case day (24 checks for 35 services) a thousand times quickly.

## Observability

| Level   | Line                                          | Where                                  |
| ------- | --------------------------------------------- | -------------------------------------- |
| `log`   | `{"run":"status", …RunReport}`                | `index.ts`                             |
| `error` | `status run failed`                           | `index.ts`                             |
| `log`   | `{"run":"status-signed-in", …SignedInReport}` | `index.ts`                             |
| `error` | `status signed-in run failed`                 | `index.ts`                             |
| `error` | `status snapshot read failed`                 | `api.ts`                               |
| `error` | `[d1] unavailable route=<route>`              | `index.ts` (the request-failure guard) |
| `error` | `status cache put failed`                     | `api.ts`                               |

Probes send `User-Agent: liveworkspace-status/1 (+https://www.liveworkspace.app/status)`, so a service's own logs can tell
them apart.

## Testing

| Test                                    | Pins                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/status/src/run.test.ts`           | signed in: the index checked signed in within 40 requests, anonymous without the secret, second-down incidents, `perHour` pooling, the extra read; a row per service, the rollup and both snapshots; each group's and the page's uptime; today re-rolled each run; consecutive non-up checks as one incident closed by the next up; a retired service's incident closed and unsent; the 90-day prune; midnight; probing when no results are given; one batch, all or nothing |
| `apps/status/src/probe.test.ts`         | up with code and time; slow past 1.5 s; wrong code and HTML-for-JSON down; reach 2xx/3xx up, 4xx/5xx down; network and timeout down with no code; no body read, the method and user agent; six at a time, in order; targets per environment, every app by URL                                                                                                                                                                                                                |
| `apps/status/src/api.test.ts`           | empty before a run; the last run, cacheable; slicing and `bad_days`; repeats from the edge without D1; HEAD from the edge without a body; no cache in development; GET/HEAD and two paths only; bad stored JSON; the per-network limit on misses; the worst-case size                                                                                                                                                                                                        |
| `apps/status/src/signed-in.test.ts`     | the three hops and the Bearer; the cookie to accounts alone, never off `PLATFORM_ORIGIN`; every refusal `sign_in` without an index call; a stalled key fetch down at 5 s (fake timers); the 401 down, slow past 1.5 s; a stalled hand-off step; fresh states; no target without the secret                                                                                                                                                                                   |
| `apps/status/src/signed-in-run.test.ts` | skipped without the secret; the 2026-11-13 incident opened on the second stalled check, extended, closed; one slow fetch no incident; the day row and both snapshots patched, `at` kept; no snapshot before an hourly run; midnight; probing itself; unreadable snapshots left; others' incidents kept; the crons in `wrangler.toml`                                                                                                                                         |
| `apps/status/src/rollup.test.ts`        | counts, percentiles, worst; empty days; nearest rank; the worst-case speed; `addToDay`; incidents open, extend (first error kept), close on slow or up, untouched when unchecked, closed once unlisted, opened only on a confirmed second down                                                                                                                                                                                                                               |
| `packages/status/src/judge.test.ts`     | expected codes and JSON; reach on the server; down, slow, up; state order; derived rooms and router; router down only when nothing answered                                                                                                                                                                                                                                                                                                                                  |
| `packages/status/src/services.test.ts`  | group order; each app's seven services; unique ids, derived on real checks; read only own origin or CORS routes; addresses per environment; path resolution; 27 requests a round                                                                                                                                                                                                                                                                                             |
| `packages/status/src/wire.test.ts`      | day uptime; UTC days; the uptime rounding (never a rounded-up 100, null without checks); pooled group and page uptime; slicing (never widening, at least a day, null uptime without checks, group uptime recomputed); the parser's accept, reject and a bad `uptime` dropped; the empty window                                                                                                                                                                               |

## Constants and configuration

| Constant                  | Value                                                                                     | Where                          | Used by                        |
| ------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------ |
| `DAY_MS`                  | `86_400_000`                                                                              | `apps/status/src/config.ts`    | `RETENTION_MS`                 |
| `RETENTION_DAYS`          | `90`                                                                                      | `config.ts`                    | the prune                      |
| `RETENTION_MS`            | `RETENTION_DAYS * DAY_MS`                                                                 | `config.ts`                    | (exported for tests)           |
| `PROBE_CONCURRENCY`       | `6`                                                                                       | `config.ts`                    | `probeAll`                     |
| `CACHE_SECONDS`           | `120`                                                                                     | `config.ts`                    | read `Cache-Control`           |
| `USER_AGENT`              | `'liveworkspace-status/1 (+https://www.liveworkspace.app/status)'`                        | `config.ts`                    | every probe                    |
| `SIGNED_IN_CRON`          | `'2,12,17,22,27,32,37,42,47,52,57 * * * *'`                                               | `config.ts`                    | `scheduled`                    |
| `HANDOFF_TIMEOUT_MS`      | `5_000`                                                                                   | `config.ts`                    | each hand-off step             |
| `SIGNED_IN_LOOKBACK_MS`   | `15 * 60_000`                                                                             | `config.ts`                    | the previous check             |
| `SIGNED_IN_TIMEOUT_MS`    | `5_000`                                                                                   | `services.ts`                  | the index call                 |
| `SIGNED_IN_EVERY_MINUTES` | `5`                                                                                       | `services.ts`                  | `perHour`                      |
| `SLOW_MS`                 | `1500`                                                                                    | `packages/status/src/judge.ts` | `stateOf`                      |
| `TIMEOUT_MS`              | `10_000`                                                                                  | `judge.ts`                     | `probeOne`                     |
| `STATUS_API_PATH`         | `'/api/status'`                                                                           | `packages/status/src/wire.ts`  | the Worker's routing, the page |
| `STATUS_HISTORY_PATH`     | `'/history'`                                                                              | `wire.ts`                      | the read                       |
| `HISTORY_DAYS`            | `90`                                                                                      | `wire.ts`                      | the window, `parseDays`        |
| `INCIDENTS_MAX`           | `50`                                                                                      | `wire.ts`                      | `buildHistory`                 |
| `MCP_DEV_PORTS`           | livediagram 8788, liveplanner 8888, livedocuments 8988, livedesign 8990 (livehuddle none) | `services.ts`                  | which apps have an MCP row     |

| Setting             | Production                                                           | Staging                                 |
| ------------------- | -------------------------------------------------------------------- | --------------------------------------- |
| Name                | `liveworkspace-status`                                               | `liveworkspace-status-staging`          |
| Route               | `www.liveworkspace.app/api/status*`, `liveworkspace.app/api/status*` | `staging.liveworkspace.app/api/status*` |
| D1 `STATUS_DB`      | `liveworkspace-status`                                               | `liveworkspace-status-staging`          |
| `READ_RATE_LIMITER` | namespace `1104`, 60 per 60 s                                        | namespace `2104`, 60 per 60 s           |
| Cron                | `7 * * * *`, `SIGNED_IN_CRON`                                        | the same                                |
| Secret              | `STATUS_GUEST_COOKIE` (the owner, `wrangler secret put`)             | its own, `--env staging`                |
| `ENVIRONMENT`       | `production`                                                         | `staging`                               |
| `PLATFORM_ORIGIN`   | `https://www.liveworkspace.app`                                      | `https://staging.liveworkspace.app`     |

Locally: `wrangler dev --port 3010 --test-scheduled --var ENVIRONMENT:development --var PLATFORM_ORIGIN:http://localhost:3000`;
`corepack pnpm seed:local` fills the local database. No secret locally, so the signed-in check is skipped.

## Assets and external resources

The addresses in the services table; D1; `caches.default`.

## Defaults ledger

- `ST1`: a probe that hangs is cut at 10 s and counted `down` (`timeout`).
- `ST2`: a service missing from a run keeps its open incident open.
- `ST3`: yesterday's daily row is never rewritten after midnight UTC.
- `ST4`: a previous check older than 15 minutes isn't "in a row" for the signed-in check.
