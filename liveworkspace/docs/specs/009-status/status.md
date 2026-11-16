# Status history

The status page on liveworkspace.app (`/status`, [site.md](../010-site/site.md#status-status)) checks every service live from
the visitor's browser. That shows what _this visitor_ sees, and only while the page is open. The **status Worker**
(`apps/status`, `liveworkspace-status`) adds what a browser can't: a check of every service from Cloudflare once an
hour, kept for 90 days, so the page can show when each service was last checked, a bar per day and the incidents of
the last 90 days. The Explorer index is checked signed in, every 5 minutes ([The signed-in check](#the-signed-in-check)).

```
apps/status            the Worker: the hourly checks and the 5-minute signed-in check (Cron Triggers), the read API at /api/status
packages/status        @liveworkspace/status: the one list of services, how an answer is judged, the wire shapes
```

The page and the Worker check the same services, from the same list (`@liveworkspace/status`), so the two can't
drift: a service added there is checked by both.

## The hourly run

A Cron Trigger runs at minute 7 of every hour (`"7 * * * *"`), in production and staging.

1. **Check.** Every service with a check of its own is checked at once, with a 10 second timeout each. A Worker may
   wait on at most six answers at a time, so the checks go out six at a time and each is timed from when its own
   request leaves, never from when it was queued. The Explorer index is checked signed in, with its own timings
   ([below](#the-signed-in-check)): three requests in place of one. That is 33 requests in all in production, well
   under the 50 subrequests a free Worker may make per run (a test keeps it under 40).
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
     it. The signed-in Explorer check opens one only on its second down check in a row, starting at the first
     ([below](#the-signed-in-check)). A service taken off the list (its app retired, say) is never checked again, so its open incident closes with
     the first run that no longer lists it, and is pruned like any other; the read API sends only the incidents of
     services on the list. A slow hour is no incident: it shows in the day's bar, not in the list;
   - pruning: checks, days and closed incidents older than 90 days go.
5. **Snapshot.** The two answers of the read API are built once here and stored as two rows of `snapshots`, so
   reading them is one row, however many people have the page open.

Nothing alerts anyone. That may come later; the incidents table is where it would read from.

## The signed-in check

The Explorer index's anonymous check (`GET /api/index/jwks`) never reads a token, so it can't see the index's token
check failing. On 2026-11-13 every signed-in `/api/index/*` call took 10 s and answered 401 for half an hour while the
index waited on accounts' key set, and the page stayed green. So the status Worker also checks the index as a person
uses it, signed in, every 5 minutes. A visitor's browser can't: it would need the credential. So the page's live line
for **Explorer index** stays the anonymous check, and its stored history (liveworkspace's last check, the bars and the
incidents) is the signed-in check's. The catalogue marks it as a check only the Worker makes (`worker` on the
service, `@liveworkspace/status`), which the page never runs.

**The credential is a guest's**, one that never makes anything, so a leak reaches only an empty guest with no account,
team or item behind it:

- `STATUS_GUEST_COOKIE`, a secret on the status Worker alone (production and staging each have their own), holds a
  signed `lw_guest` cookie value (`guest_<uuid>.<signature>`, [accounts.md "Guests"](../003-accounts/accounts.md)).
  It is never in the repository, the catalogue, a stored check or the page.
- Each check mints a fresh guest token the way an app's page does. `GET https://www.livediagram.app/api/auth/guest?state=<random>`
  (no cookie; livediagram's address in the environment, as on the page) answers a redirect to accounts' hand-off.
  The Worker follows it only when it is on `PLATFORM_ORIGIN`, and only then sends the cookie. Accounts answers a
  redirect back to the app with a 45-day `guest_token` and the same `state` in the fragment; the cookie keeps naming
  the same guest, and the hand-off marks it seen, so the guest is never swept. Each check so exercises the app's
  door, accounts' hand-off and its token signing.
- Then `GET /api/index/placement-defaults` with the token as the Bearer: the index checks it against accounts' keys
  (the check that failed on 2026-11-13) and reads the guest's one empty, indexed list. Up when it answers 200 and
  JSON.

**Judged**: each hand-off step gives up after 5 s. The index call is slow past 1.5 s, as every check, and down when it
hasn't answered in 5 s (`SIGNED_IN_TIMEOUT_MS`), half the others' 10 s: a signed-in Explorer list that takes 5 s is
broken for the person waiting on it. The 10 s answers of 2026-11-13 are down either way (a timeout, or the 401). The
time stored is the index call's; a hand-off that gives no token is down with the error `sign_in` and the hand-off's
time.

**Cadence**: a second Cron Trigger, at minutes 2, 12, 17, 22, 27, 32, 37, 42, 47, 52 and 57, runs this check alone,
and the hourly run at minute 7 makes it as part of the round, so it runs every 5 minutes; everything else stays
hourly. A cold isolate's first key fetch can be slow, so one down check opens no incident: the second in a row does,
starting at the first, and an answer closes it as usual. A 30-minute outage is then an incident within 10 minutes.

**Without the secret** (before it is set, or on a dev server), the hourly run checks the index anonymously as before,
and the 5-minute run checks nothing and logs `{"run":"status-signed-in","skipped":"no_secret"}`: never a false red.

**The 5-minute run** reads one batch (the service's open incident, its check before this one, today's `daily` row and
the two snapshots) and writes one: the check, today's row with this check added (the hourly run works the day's
medians out again from every check), the incident it opened, extended or closed, and both snapshots with this
service's entry, today's bar and its incidents patched in. The snapshots' `at`, the uptimes and the earlier days stay
the hourly run's. Its bar and uptime count every 5-minute check; in its group's and the page's uptime each counts as a
twelfth, so the service weighs there as an hourly one does.

## The read API

Both are `GET` only, public and anonymous, cached for 2 minutes (`Cache-Control: public, max-age=120`, and the
Worker's edge cache), and read one stored row. The page is on the same origin, so there is no CORS. With the
database itself down they answer `503 storage_unavailable`, never an empty status that would then be cached as the
truth ([When a request fails](../002-architecture/architecture.md#when-a-request-fails)).

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
bar per day and its uptime over the window, each group's uptime and the whole page's, plus the incidents in the
window, newest first (at most 50). `days` is 1 to 90 (90 when left out). The page reads the whole 90 days; a
shorter window is cut from the stored one, its uptimes worked out again as the mean of its days' uptimes (the
cut window has only those).

```json
{
  "v": 1,
  "at": 1761390420000,
  "from": "2026-07-28",
  "days": 90,
  "latest": { "liveworkspace:site": ["u", 200, 84] },
  "services": { "liveworkspace:site": { "p": 99.98, "w": "uu-sd", "u": [[4, 958]] } },
  "uptime": { "all": 99.97, "groups": { "liveworkspace": 99.98, "livediagram": 99.95 } },
  "incidents": [["livediagram:api", 1761300420000, 1761304020000, "d", 2, "timeout"]]
}
```

- `p`: the uptime over the days with checks, in percent to two places (null with no checks yet);
- `w`: each day's worst state as one letter (`u`, `s`, `d`), oldest first, `-` for a day without checks;
- `u`: the days under 100%, as `[day's index, uptime in tenths of a percent]`. Only a day with a down check can be
  under (a slow answer still answered), so every other day with checks is 100% and isn't sent. This keeps the answer
  small: most days of most services are fully up;
- `uptime`: the window's uptime per group (`groups`, keyed by the group's id, the part of each service's id before
  the colon) and over every service on the page (`all`). It pools the checks: the answered checks (up or slow) of
  every service in the group over all of their checks across the window's days, so a group's figure says the same
  thing as its services' `p` and its bars, weighted by how many checks each service had. Derived services (the
  realtime rooms, the router) count like the rest, as their rows and bars do. A group with no checks in the window
  is null, never 100. It comes from the `daily` rollups the run already reads, so it keeps every past day's
  non-green bars even when incidents are deleted, and needs no read of its own. An answer stored before this field
  has none, and the page then shows no figure;
- rounding, for `p` and `uptime` alike: percent to two places, and `100` only when every check answered. Short of
  that it is at most `99.99`, so one down check among 75,000 still reads `99.99`, never a rounded-up `100`;
- an incident is `[service, started, ended or null while open, worst, checks, error]`.

Before the first run, or with no database, both answer `{"v":1,"at":null,…}` with nothing in them, and the page
shows its live checks only.

The wire shapes and a reader for them are in `@liveworkspace/status` (`wire.ts`).

## Where the checks go

From the Worker, liveworkspace's own services are fetched at `PLATFORM_ORIGIN`, `https://www.liveworkspace.app` (or
`staging.`), as a visitor's browser does. A Worker on a route can't fetch another Worker on the same zone unless it
has the `global_fetch_strictly_public` compatibility flag, which sends the request out to the internet and back in
through the zone's routes, so the status Worker has that flag. Each app is fetched at its live address
(`https://www.<app>`, `https://mcp.<app>/health`), or its `staging.` one from staging, where the MCP servers aren't
checked. Every app, livediagram included, is on its own custom domains, so the Worker has no service bindings to
any app. Locally (`ENVIRONMENT = "development"`) everything is fetched on this machine's ports: the site on 3000 and
each app's router and MCP Worker.

The MCP server is optional per app: an app is checked for one only when it ships one (it has an MCP Worker's local
port in `MCP_DEV_PORTS`). An app without one has no MCP row at all, rather than a row that is always down or
skipped. Every app ships one except livehuddle, which removed its MCP server (owner, Work Tracker #562), and every
launched app is on the page, livehuddle's group last. A held app
([Registered before launch](../002-architecture/integrating-an-app.md#registered-before-launch)) is not on the page
until it launches; none is held today. One round is 31 requests in production (27 on staging, which has no public
MCP host), plus two for the signed-in Explorer check's hand-off, under a Worker's 50 subrequests.

## The database

`liveworkspace-status` (production) and `liveworkspace-status-staging`, bound as `STATUS_DB`. The schema is
`apps/status/migrations/0001_status.sql`:

| Table       | Rows                                                         | Kept                   |
| ----------- | ------------------------------------------------------------ | ---------------------- |
| `checks`    | one per service per hour, and the Explorer's every 5 minutes | 90 days, about 112,000 |
| `daily`     | one per service per UTC day                                  | 90 days, about 3,150   |
| `incidents` | one per outage (a spell of down checks)                      | 90 days after closing  |
| `snapshots` | two: `latest` and `history`                                  | replaced every run     |

## Running it locally

```sh
cd liveworkspace/apps/status
corepack pnpm db:migrate:local
corepack pnpm dev                       # http://localhost:3010/api/status, with /__scheduled
curl 'http://localhost:3010/__scheduled?cron=7+*+*+*+*'   # one run, now
curl 'http://localhost:3010/__scheduled?cron=2,12,17,22,27,32,37,42,47,52,57+*+*+*+*'   # the signed-in check alone
corepack pnpm seed:local                # 90 days of made-up history, for a look at the page
```

`dev` runs `wrangler dev --test-scheduled` on port 3010, in liveworkspace's block. The site's dev server forwards
`/api/status*` to it (`STATUS_DEV_ORIGIN` to point elsewhere), so http://localhost:3000/status shows the stored
history. Locally the edge cache is off. The seed (`scripts/seed.ts`) writes only to the local database and is not
part of the Worker.

## Deploys

CI's deploy ships it ([docs/ci.md](../../../../docs/ci.md#deploys) at the repository root): staging on every push to `main`, production through the manual gate, both on the liveworkspace Cloudflare account. The status Worker is in the first tier, so its D1 migrations (`apps/status/migrations`) apply before its
code; the databases are `liveworkspace-status` and `liveworkspace-status-staging`, with their ids in
`apps/status/wrangler.toml`. Its one secret is `STATUS_GUEST_COOKIE` ([The signed-in check](#the-signed-in-check)),
set by the owner with `wrangler secret put` on each environment; no deploy sets or reads it. A first run fills the
page within the hour; before it, the page shows its live checks alone.

## Performance

Measured locally (`wrangler dev`, D1's own `rows_read` and `rows_written`, October 2026):

- **A run**: 27 subrequests, at most six at a time. Two D1 batches: one read (today's checks so far, the open
  incidents, the window's 89 earlier days of `daily` and its closed incidents) and one write (35 checks, 35 days, the
  incidents that changed, three prunes, two snapshots). With 90 days stored a run read 3,861 rows and wrote 72;
  most of the reads are the 3,115 `daily` rows the snapshot is built from. In production each run also prunes the
  hour's 35 checks from 90 days before, and once a day 35 days, so about 110 rows written a run. That is about
  93,000 rows read and 2,600 written a day per environment, well inside D1's free allowance.
- **Rows**: 35 checks an hour, 840 a day, about 75,600 kept; 35 `daily` rows a day, 3,150 kept.
- **Uptime**: each group's and the page's are summed from the same `daily` rows the snapshot already reads, in the
  same pass, so they add no query, no row read and no index; about 200 bytes to the stored answer (seven numbers).
- **A read**: one row by primary key, then the edge cache for 2 minutes. `/api/status/history` for every service
  over 90 days is 7,435 bytes (956 gzipped) with the local seed's realistic history; `/api/status` is 1,265 (346).
  The worst case, every service down two days in three, stays under 24 KB (4 KB gzipped), tested in `api.test.ts`.
- **The page**: one request on load and one every 5 minutes while visible, nothing per service.
- **The signed-in check**: three requests every 5 minutes (the app's door, accounts' hand-off, one index read of an
  empty list by its key), 288 a day of each per environment; accounts writes the guest's seen stamp at most once a
  day. A 5-minute run reads about 45 rows and writes six at most: the open incident by its index, one `daily` row by
  its key, two snapshots, and the last 15 minutes of `checks` by `checks`' key, at most 41 rows (measured with 90
  days stored at this volume, 112,320 checks; every query a key or index search). That is about 13,000 rows read and
  1,700 written a day. It never rebuilds the history from `daily`; the hourly run does. Its own work is 0.2 ms of
  CPU locally (the hourly run's 12 ms), patching a 7 KB history. The hourly run's read gains the same one look back.

The edge cache is the Worker's `caches.default`, on the `liveworkspace.app` zone. A miss is the one D1 row; the
snapshot is what keeps that cheap.
