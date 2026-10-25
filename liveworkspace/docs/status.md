# Status history

The status page on liveworkspace.app (`/status`, [site.md](site.md#status-status)) checks every service live from
the visitor's browser. That shows what _this visitor_ sees, and only while the page is open. The **status Worker**
(`apps/status`, `liveworkspace-status`) adds what a browser can't: a check of every service from Cloudflare once an
hour, kept for 90 days, so the page can show when each service was last checked, a bar per day and the incidents of
the last 90 days.

```
apps/status            the Worker: the hourly checks (a Cron Trigger) and the read API at /api/status
packages/status        @liveworkspace/status: the one list of services, how an answer is judged, the wire shapes
```

The page and the Worker check the same services, from the same list (`@liveworkspace/status`), so the two can't
drift: a service added there is checked by both.

## The hourly run

A Cron Trigger runs at minute 7 of every hour (`"7 * * * *"`), in production and staging.

1. **Check.** Every service with a check of its own is checked at once, with a 10 second timeout each. A Worker may
   wait on at most six answers at a time, so the checks go out six at a time and each is timed from when its own
   request leaves, never from when it was queued. That is 27 requests in all, well under the 50 subrequests a free
   Worker may make per run (a test keeps it under 40).
2. **Judge.** Each answer is **up** (the answer expected, in 1.5 s or less), **slow** (expected, after more than
   1.5 s) or **down** (no answer in 10 s, a network error, or the wrong answer), with its HTTP code, how long it took
   and a short error code (`timeout`, `network`, `status`, `not_json`). The server can read every answer, so the app
   pages the browser can only call "Reached" get a true state here: up when they answer 2xx or 3xx. No response
   body is ever stored.
3. **Derive.** The realtime rooms take the API's result, and the router is up when any check through it answered,
   as on the page.
4. **Store**, in one D1 batch (one transaction, one round trip):
   - one row per service in `checks`;
   - today's row per service in `daily` (UTC days), worked out again from today's checks: how many, how many up,
     slow and down, the uptime (up and slow both count as answered), the median and 95th percentile answer time
     and the worst state;
   - incidents: outages only. A run of consecutive down checks is one incident, from its first down check to the
     first check after it that answered (up, or slow: a slow answer is still an answer), with how many checks it
     spanned and its first error. A down service opens one or extends its open one; one that answers again closes
     it. A slow hour is no incident: it shows in the day's bar, not in the list;
   - pruning: checks, days and closed incidents older than 90 days go.
5. **Snapshot.** The two answers of the read API are built once here and stored as two rows of `snapshots`, so
   reading them is one row, however many people have the page open.

Nothing alerts anyone. That may come later; the incidents table is where it would read from.

## The read API

Both are `GET` only, public and anonymous, cached for 2 minutes (`Cache-Control: public, max-age=120`, and the
Worker's edge cache), and read one stored row. The page is on the same origin, so there is no CORS.

**`GET /api/status`**: the latest run.

```json
{
  "v": 1,
  "at": 1761390420000,
  "services": {
    "liveworkspace:site": ["u", 200, 84],
    "livediagram:api": ["d", null, 10000, "timeout"]
  }
}
```

Each service is `[state, HTTP code or null, ms, error?]`, the state `u`, `s` or `d`.

**`GET /api/status/history?days=90`**: everything the page shows, in one answer: the latest run, and per service a
bar per day and its uptime over the window, plus the incidents in the window, newest first (at most 50). `days` is
1 to 90 (90 when left out).

```json
{
  "v": 1,
  "at": 1761390420000,
  "from": "2026-07-28",
  "days": 90,
  "latest": { "liveworkspace:site": ["u", 200, 84] },
  "services": { "liveworkspace:site": { "p": 99.98, "w": "uu-sd", "u": [[4, 958]] } },
  "incidents": [["livediagram:api", 1761300420000, 1761304020000, "d", 2, "timeout"]]
}
```

- `p`: the uptime over the days with checks, in percent to two places (null with no checks yet);
- `w`: each day's worst state as one letter (`u`, `s`, `d`), oldest first, `-` for a day without checks;
- `u`: the days under 100%, as `[day's index, uptime in tenths of a percent]`. Only a day with a down check can be
  under (a slow answer still answered), so every other day with checks is 100% and isn't sent. This keeps the answer
  small: most days of most services are fully up;
- an incident is `[service, started, ended or null while open, worst, checks, error]`.

Before the first run, or with no database, both answer `{"v":1,"at":null,…}` with nothing in them, and the page
shows its live checks only.

The wire shapes and a reader for them are in `@liveworkspace/status` (`wire.ts`).

## Where the checks go

From the Worker, liveworkspace's own services go through a service binding to the gateway (`PLATFORM`,
[gateway.md](gateway.md)): a Worker can't fetch another Worker's `workers.dev` address on the same account, and
the gateway is where `liveworkspace.app` lives until the zone moves. Each app is fetched at its live address
(`https://www.<app>`, `https://mcp.<app>/health`), or its `staging.` one from staging, where the MCP servers aren't
checked. An app standing in on a `workers.dev` address on this account (`STAND_INS` in `@liveworkspace/sites`,
livediagram until livediagram.app moves; livediagram/docs/specs/016-platform/stand-in-addresses.md) is reached the
same way as liveworkspace's own services, through service bindings to its Workers: `LIVEDIAGRAM_ROUTER` for its router's
address and `LIVEDIAGRAM_MCP` for its MCP server's. The bindings drop when the domain moves. Locally (`ENVIRONMENT =
"development"`) everything is fetched on this machine's ports: the site on 3000 and
each app's router and MCP Worker.

When liveworkspace.app moves to this account, a Worker on a route can't fetch another Worker on the same zone either,
unless it has the `global_fetch_strictly_public` compatibility flag, which sends the request out to the internet and
back in through the zone's routes. So the move gives the status Worker that flag and drops the binding
([gateway.md](gateway.md#when-liveworkspaceapp-moves)); the checks then read `https://liveworkspace.app` as a
visitor's browser does.

## The database

`liveworkspace-status` (production) and `liveworkspace-status-staging`, bound as `STATUS_DB`. The schema is
`apps/status/migrations/0001_status.sql`:

| Table       | Rows                                    | Kept                  |
| ----------- | --------------------------------------- | --------------------- |
| `checks`    | one per service per hour (35 an hour)   | 90 days, about 75,600 |
| `daily`     | one per service per UTC day             | 90 days, about 3,150  |
| `incidents` | one per outage (a spell of down checks) | 90 days after closing |
| `snapshots` | two: `latest` and `history`             | replaced every run    |

## Running it locally

```sh
cd liveworkspace/apps/status
corepack pnpm db:migrate:local
corepack pnpm dev                       # http://localhost:3010/api/status, with /__scheduled
curl 'http://localhost:3010/__scheduled?cron=7+*+*+*+*'   # one run, now
corepack pnpm seed:local                # 90 days of made-up history, for a look at the page
```

`dev` runs `wrangler dev --test-scheduled` on port 3010, in liveworkspace's block. The site's dev server forwards
`/api/status*` to it (`STATUS_DEV_ORIGIN` to point elsewhere), so http://localhost:3000/status shows the stored
history. Locally the edge cache is off. The seed (`scripts/seed.ts`) writes only to the local database and is not
part of the Worker.

## First deploy

The databases exist and their ids are in `apps/status/wrangler.toml`. From `liveworkspace/apps/status`:

```sh
corepack pnpm db:migrate:remote                     # production: wrangler d1 migrations apply liveworkspace-status --remote
corepack pnpm deploy                                # wrangler deploy
corepack pnpm db:migrate:remote:staging             # staging: … liveworkspace-status-staging --env staging --remote
corepack pnpm deploy:staging                        # wrangler deploy --env staging
```

Then redeploy the gateway (`apps/gateway`, `corepack pnpm deploy` and `wrangler deploy --env staging`), which
routes `/api/status*` here, and the site, whose page reads it. There are no secrets. The first run fills the page
within the hour; until then it shows its live checks only.

## Performance

Measured locally (`wrangler dev`, D1's own `rows_read` and `rows_written`, October 2026):

- **A run**: 27 subrequests, at most six at a time. Two D1 batches: one read (today's checks so far, the open
  incidents, the window's 89 earlier days of `daily` and its closed incidents) and one write (35 checks, 35 days, the
  incidents that changed, three prunes, two snapshots). With 90 days stored a run read 3,861 rows and wrote 72;
  most of the reads are the 3,115 `daily` rows the snapshot is built from. In production each run also prunes the
  hour's 35 checks from 90 days before, and once a day 35 days, so about 110 rows written a run. That is about
  93,000 rows read and 2,600 written a day per environment, well inside D1's free allowance.
- **Rows**: 35 checks an hour, 840 a day, about 75,600 kept; 35 `daily` rows a day, 3,150 kept.
- **A read**: one row by primary key, then the edge cache for 2 minutes. `/api/status/history` for every service
  over 90 days is 7,435 bytes (956 gzipped) with the local seed's realistic history; `/api/status` is 1,265 (346).
  The worst case, every service down two days in three, stays under 24 KB (4 KB gzipped), tested in `api.test.ts`.
- **The page**: one request on load and one every 5 minutes while visible, nothing per service.

The edge cache is the Worker's `caches.default`. On `workers.dev` (the gateway, until the zone moves) that cache may
not keep anything, so every read is the one D1 row; the snapshot is what keeps that cheap.
