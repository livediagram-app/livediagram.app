# Telemetry

Every liveworkspace app sends its anonymous product events to one service, whose API is
**liveworkspace.app/api/telemetry** (every liveworkspace API sits under `/api`). The service stores
them in its own D1 database, and its numbers are published on one public dashboard,
**liveworkspace.app/telemetry**, a page of liveworkspace's static site ([site.md](site.md)). The
dashboard shows every app together, or one app at a time.

```
packages/telemetry                       @liveworkspace/telemetry: the apps, the batch format, the summary
liveworkspace/apps/telemetry             the API Worker: ingest, summary, retention
liveworkspace/apps/site/app/telemetry    the dashboard page, in the static site
```

Before October 2026, each app had its own `/api/events` ingest, its own `events` table, and its own
`/telemetry` dashboard. Those are gone. Each app's `/telemetry` now redirects to the central
dashboard, filtered to that app. Nothing was carried over: the central database started empty, and
the apps' old `events` tables are no longer read or written.

## What an event is

The same three fields as before, plus the app it came from:

| Field      | What it is                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `app`      | The app's site: `livediagram.app`, `liveplanner.app`, `livedocuments.app` or `livedesign.app` (`TELEMETRY_APPS`) |
| `category` | The parent, such as `Document` or `Element`                                                                      |
| `action`   | The verb, such as `Created` or `Added`                                                                           |
| `type`     | Optional. One short reference token, such as `Square`; never user content                                        |
| `ts`       | Stamped by the service when the batch arrives                                                                    |

There is no identity, IP address, owner id or document id. Each app keeps its own closed vocabulary
in its own api-schema (`telemetry-schema.ts`), because its editors and its vocabulary change
together. The service imports each sending app's vocabulary (livediagram's, liveplanner's and
livedocuments'), and only stores an event that its app could have sent.

## Sending events

`POST https://liveworkspace.app/api/telemetry/events` with a JSON body:

```json
{ "app": "livediagram.app", "events": [{ "category": "Document", "action": "Created" }] }
```

The answer is always `204`, whether the batch was stored or not, so telemetry can never surface an
error to the page or Worker that sent it. A batch stores at most 100 events.

**From a browser**, each app's `@<app>/telemetry-client` buffers events and sends them in batches,
with `navigator.sendBeacon` on page hide. It sends the body as `text/plain`, with no cookies, so a
cross-site send needs no CORS preflight. The service stores a browser batch only when its `Origin` is
one of its app's own sites (`TELEMETRY_APP_ORIGINS`), so one site can't post in another's name.
Browser batches are rate-limited per network (120 a minute; the IPv6 /64), and the address is never
stored.

**From a Worker** (the apps' api and mcp Workers report server-side events, such as a sign-up, an
email sent or a 500), the request carries `X-Telemetry-Key` with that app's own secret. A key only
ever speaks for its own app. Worker batches skip the rate limit, and they are the only way to send
the events an app marks as server-only (its `server-emitted-events.ts`), so a stale browser bundle
can't count those twice.

**From a CLI**, which runs on people's machines with no page origin and no key, events go to the
app's own api (`POST /api/events`). The api checks them against its vocabulary and passes them on
under its key, so the service never needs to trust an unsigned, origin-less batch.

Each app configures where to send:

| Where               | Setting                                                                               |
| ------------------- | ------------------------------------------------------------------------------------- |
| Browser builds      | `NEXT_PUBLIC_TELEMETRY_URL` (default `https://liveworkspace.app/api/telemetry`)       |
| api and mcp Workers | `TELEMETRY_URL` var (same default) and the `TELEMETRY_KEY` secret                     |
| Both                | The app's own `TELEMETRY_ENABLED` / `NEXT_PUBLIC_TELEMETRY_ENABLED` gates still apply |

A person's opt-out (the app's user preference) is still honoured in the browser, before anything is
sent.

## The dashboard

`https://liveworkspace.app/telemetry` shows **All apps**. `?app=livediagram.app`,
`?app=liveplanner.app` or `?app=livedocuments.app` opens one app's own dashboard, with all of its tabs, catalogues and
explanations. Picking an app on the page updates the link.

- **All apps** adds every app's events together. It shows the three windows (today, last 7 days,
  last 30 days) and the 30-day trend line, each app's share against the span before it, and the
  busiest events. The same event from two apps counts as one row, added up.
- **One app** shows the dashboard that app had before, unchanged. Each app's catalogue lives in
  `<app>/` in the dashboard's folder, and only loads when that app is picked.

The numbers come from `GET /api/telemetry/summary?app=all|<an app in TELEMETRY_APPS>`, built from
one grouped per-day query over the last 59 days (the last 30, and the 30 before them for the trend
arrows). Each window carries `byApp`, and the daily series carries `byApp` too. The response is
cached at the edge for 5 minutes per filter, so a traffic spike on the public page is answered from
the cache, not D1. In development the cache is off.

## Retention

A daily cron (03:17 UTC) deletes events older than 60 days.

## Running it locally

```sh
cd liveworkspace/apps/telemetry
cp .dev.vars.example .dev.vars
corepack pnpm db:migrate:local
corepack pnpm dev                     # the API, http://localhost:8790/api/telemetry
```

Development accepts events from any `localhost` page. Point an app at it with
`NEXT_PUBLIC_TELEMETRY_URL=http://localhost:8790/api/telemetry` (and `TELEMETRY_URL`, plus the dev key
from `.dev.vars`, for its Workers). The dashboard is the site's: `corepack pnpm dev:workspace` from
the repo root runs the site with this Worker behind it, at http://localhost:3000/telemetry.

## Which apps send

livediagram, liveplanner and livedocuments send events, and each has its own dashboard under
`apps/site/app/telemetry/<app>/` (`livediagram/`, `liveplanner/`, `livedocuments/`). Each folder's
tests read that app's source: every event an emitter can send must be in its vocabulary and have a
chart (`metric-emitters.test.ts`, `computed-emitters.ts`), and every event has an explanation
(`event-explanation.test.ts`).

livedesign is in `TELEMETRY_APPS`, so the dashboard lists it in its own colour, but it doesn't send
yet: the service stores nothing from it (`NOTHING_YET` in `apps/telemetry/src/vocabularies.ts`),
and picking it on the dashboard says there are no events yet. When it does: import its vocabulary
in `vocabularies.ts`, add its dashboard under `apps/site/app/telemetry/livedesign/`, and set its
key.

## First deploy

1. Create the databases and put their ids in `apps/telemetry/wrangler.toml` (they are
   placeholders): `wrangler d1 create liveworkspace-telemetry` (and
   `liveworkspace-telemetry-staging`).
2. Set one key per app, and give each app's api and mcp Workers the same value as `TELEMETRY_KEY`:
   `openssl rand -hex 32`, then `wrangler secret put TELEMETRY_KEY_LIVEDIAGRAM`,
   `TELEMETRY_KEY_LIVEPLANNER` and `TELEMETRY_KEY_LIVEDOCUMENTS` (and `TELEMETRY_KEY_LIVEDESIGN`
   once livedesign sends events).
3. `corepack pnpm db:migrate:remote`, then `corepack pnpm deploy`. The dashboard ships with the
   site ([site.md](site.md)).
4. The Worker takes the route `liveworkspace.app/api/telemetry*` only, so the rest of the zone is
   untouched.

liveplanner's Workers live on a separate Cloudflare account. That's fine: they reach the service over
HTTPS, not a service binding. Only the key has to be copied across.

## Adding an app

1. Add its site to `TELEMETRY_APPS` and its origins to `TELEMETRY_APP_ORIGINS` in
   `packages/telemetry/src/apps.ts`.
2. Add its vocabulary to `apps/telemetry/src/vocabularies.ts`, and a `TELEMETRY_KEY_<APP>` secret to
   `src/env.ts` and `appKey`.
3. Add its dashboard under `apps/site/app/telemetry/<app>/`, with a `Body` the page loads when the
   app is picked.
4. In the app, send batches as above, and allow `https://liveworkspace.app` in its CSP
   `connect-src`.

## Performance

- **Ingest**: one D1 batch insert per request, as before. Rows are 1 column wider (`app`).
- **Summary**: one grouped query per filter, at most once per 5 minutes per edge location. The
  query groups by `app` too, so "All apps" returns up to one set of rows per sending app. Folding them is linear;
  a test folds a worst case (59 days × 2 apps × 1,500 events) inside a time budget.
- **Index**: `(app, ts)` for one app's range, and `(ts)` for every app and for the sweep.
- **Dashboard**: "All apps" loads none of the apps' catalogues. Each app's dashboard is split out and
  loads when picked. Its styles are its own stylesheet, loaded only on `/telemetry`: the site's
  other pages carry 9.5 KB of CSS (gzipped), and the dashboard adds 16.6 KB.
- **Apps**: a browser batch is now cross-site, so it can't reuse the app's own connection; the first
  send on a page opens one more connection, to liveworkspace.app. Sends are batched (every 10
  seconds, and on page hide), so this is one connection per page view, off the critical path.
