# Telemetry

Every liveworkspace app sends its anonymous product events to one service, whose API is
**liveworkspace.app/api/telemetry** (every liveworkspace API sits under `/api`). The service stores
them in its own D1 database, and its numbers are published on one public dashboard,
**liveworkspace.app/telemetry**, a page of liveworkspace's static site ([site.md](../010-site/site.md)). The
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
together. The service imports each sending app's vocabulary (livediagram's, liveplanner's,
livedocuments' and livedesign's), and only stores an event that its app could have sent.

## Sending events

`POST https://www.liveworkspace.app/api/telemetry/events` with a JSON body:

```json
{ "app": "livediagram.app", "events": [{ "category": "Document", "action": "Created" }] }
```

The answer is always `204`, whether the batch was stored or not, so telemetry can never surface an
error to the page or Worker that sent it. A batch stores at most 100 events.

**From a browser**, each app buffers events and sends them in batches, with `navigator.sendBeacon`
on page hide. The batching is one engine for every sender, `@liveworkspace/telemetry/emitter`
(`createTelemetryEngine`). The browser side around it (the opt-out rule, the public sites' tracker,
client error tracking, timings, page hide) is `@liveworkspace/telemetry-client`, also shared; each
app's `@<app>/telemetry-client` only binds it to the app: its name here, the key its preferences are
stored under, its vocabulary's types and its error and timing tokens. It sends the body as `text/plain`, with no cookies, so a
cross-site send needs no CORS preflight. The service stores a browser batch only when its `Origin` is
one of its app's own sites (`TELEMETRY_APP_ORIGINS`), so one site can't post in another's name.
Browser batches are rate-limited per network (120 a minute; the IPv4 address or the IPv6 /64, keyed by
`@liveworkspace/api-kit` `clientRateKey` as every api is), and the address is never
stored.

**From a Worker** (the apps' api and mcp Workers report server-side events, such as a sign-up, an
email sent or a 500), the request carries `X-Telemetry-Key` with that app's own secret. A key only
ever speaks for its own app. The accounts Worker holds each app's key too: it counts the onboarding
emails it sends once per account under the app each one speaks for
([accounts.md](../003-accounts/accounts.md#onboarding-emails)), and the team invitation, reminder and answer emails
under the app the inviter signed up through ([accounts.md](../003-accounts/accounts.md#reminders-and-expiry)), and
the expiring-token warnings under the app the token's owner signed up through
([accounts.md](../003-accounts/accounts.md#expiry-warnings)), so
each app's dashboard reads them from `Email·Sent` as before. It also counts what is done to teams and
API tokens on liveworkspace.app, under the app the person acting signed up through (an email's
Decline, which needs no account, under the inviter's): `Team·Created`, `Team·Changed` (a rename, or
`Role`), `Team·Deleted`, `Team·Added·Member` (an invitation sent), `Team·Shared·Link` and
`Team·Removed·Link` (the join link on and off), `Team·Removed·Member` / `Invite` / `Self`,
`Team·Joined`, `Team·Declined·Invite` / `Email`, `Token·Created·Manual` and `Token·Removed`. Each is
reported after the change succeeds and the app is looked up only when the batch goes, after the
response, so a request does no extra query or request for it. One that speaks for liveworkspace.app
itself isn't counted, since no dashboard charts the platform. The dashboard's emitter checks scan
the accounts Worker beside each app (`apps/site/app/telemetry/platform-emitters.ts`). Worker batches skip the rate limit, and they are the only way to send
the events an app marks as server-only (its `server-emitted-events.ts`), so a stale browser bundle
can't count those twice.

**From a CLI**, which runs on people's machines with no page origin and no key, events go to the
app's own api (`POST /api/events`). The api checks them against its vocabulary and passes them on
under its key, so the service never needs to trust an unsigned, origin-less batch.

Each app configures where to send:

| Where               | Setting                                                                               |
| ------------------- | ------------------------------------------------------------------------------------- |
| Browser builds      | `NEXT_PUBLIC_TELEMETRY_URL` (default `https://www.liveworkspace.app/api/telemetry`)   |
| api and mcp Workers | `TELEMETRY_URL` var (same default) and the `TELEMETRY_KEY` secret                     |
| Both                | The app's own `TELEMETRY_ENABLED` / `NEXT_PUBLIC_TELEMETRY_ENABLED` gates still apply |

A person's opt-out (the app's user preference) is still honoured in the browser, before anything is
sent.

## The Explorer on liveworkspace.app

The one Explorer lives on liveworkspace.app ([site.md](../010-site/site.md#the-explorer-explorer)), so the events
each app's own Explorer used to send now come from there: the Timeline, Home and its first run, the
filter lens, the Inbox, the List / Card / Details toggle, Home's banner closed and its Try Again
(`Home·Loaded·Retry`), the Share dialog (links copied and revoked, and each link made by level,
lifetime and tab, extended, rescoped or given a password: `<Noun>·Shared`), folders made,
renamed (`Folder·Renamed`), re-parented and deleted, default folders set and cleared (`Folder·Changed` / `Cleared`, `Kind` or
`Template`), the Trash (`Trash·Restored` / `Deleted` / `Cleared`, `Personal` or `Team`), items moved
into, within and out of a team (`Team·Added` / `Moved` / `Removed` with the item's noun) and a
guest's sign-in banner. They keep the names the apps always gave them, so each app's dashboard keeps
counting them. An app that draws the shared Explorer itself (its panel, its Explorer page, the
Workbench) reports the same events through its own hosts, so each is counted once, where it happened.

**Returning visitors.** Shown on an app's own address (`liveplanner.app/explorer/…`), the Explorer also
counts the app's daily return, `Participant·Returned·Anonymous` / `Authenticated`, once the person is
known, exactly as the app's editor and `/new` do: through the one gate (`createDailyReturn` in
`@liveworkspace/telemetry-client`) and the app's own `<app>:v2:last-active-day` key on that origin, so the
first open of the day wins wherever it happens and a visitor who only opens the Explorer still counts. It
is not one of the Explorer's events: it goes out only from the app's own origin, which the service already
takes the app's whole vocabulary from, so liveworkspace.app itself still can't send it in an app's name
(`apps/site/lib/explorer/daily-return.ts`). On liveworkspace.app, in no app's name, nothing counts it.
New visitors, returns and sign-ups are all per app: a browser that has used livedocuments is still new
to liveplanner on its first visit there.

Settings changed on liveworkspace.app count for their app too. In the Settings panel, a change to an
app's row reports the event the app's own Settings sends for that row; a switch of its Account section
(every app shares it) counts for the app the panel was opened for, and opened for no app it counts
once, for `liveworkspace.app`, with the event the first app with that switch reports
(`sharedCatalogueEvents`). The events come from the app's settings catalogue
(`packages/settings/src/catalogues`, `catalogueEvents`), and a change made in the app's own Settings is
the app's to report, so each change is counted once.

- **Whose they are.** An event counts for the app the page is filtered to, or, filtered to All Apps,
  for `liveworkspace.app` itself (`PLATFORM_TELEMETRY_APP`). A Share dialog's events count for the
  app of the item it shares, and a revoked pass under that app's noun (liveplanner's `Project`, the
  others' `Document`).
- **What it may send.** The Explorer's events, each with its closed set of type tokens:
  `EXPLORER_TELEMETRY_EVENTS` in `packages/telemetry/src/explorer-events.ts`, and in an app's name
  that app's settings events. The site's emitter (`apps/site/lib/explorer/telemetry.ts`) drops any
  other Explorer event before it is kept, and the ingest takes a batch from liveworkspace.app's origin
  (`PLATFORM_TELEMETRY_ORIGINS`) only for these events, in an app's name (and in that app's
  vocabulary) or, for the Explorer's and a shared switch's, in its own. No app's page or Worker key can speak for
  `liveworkspace.app`.
- **Batching.** The same engine as the apps': one request per app every 10 seconds, sooner once 25
  events wait, and a beacon on page hide. Never one request per event.
- **The person's choice.** Signed in, their `telemetryEnabled` setting (the `all` scope every app
  shares, on unless turned off), read with the app's settings once per page; until it is read, a
  few events wait rather than go out unasked. A guest's choice lives in each app's own browser
  storage (`<app>:user-preferences:v1`). On an app's own address the Explorer shares that origin, so
  it reads the guest's `telemetryEnabled` there, as the app's editor does, and sends nothing once it
  is off; a change made in another tab holds from the next event. On liveworkspace.app, which can't
  see that storage, a guest follows the browser. Either way a browser that asks sites not to track
  (Global Privacy Control or Do Not Track) sends nothing.
- **The dashboards.** Each app's checks scan the site's emitter beside the accounts Worker
  (`apps/site/app/telemetry/platform-emitters.ts`), through that app's vocabulary, and read its
  computed types from `EXPLORER_TELEMETRY_EVENTS`; every one has a chart on each app's dashboard.
  All apps adds `liveworkspace.app`'s own events (the Explorer on All Apps) to its totals.

## The dashboard

`https://www.liveworkspace.app/telemetry` shows **All apps**. `?app=livediagram.app`,
`?app=liveplanner.app`, `?app=livedocuments.app` or `?app=livedesign.app` opens one app's own dashboard, with all of
its tabs, catalogues and explanations. Picking an app on the page updates the link.

- **All apps** adds every app's events together. It shows the three windows (today, last 7 days,
  last 30 days) and the 30-day trend line, each app's share against the span before it, and the
  busiest events. The same event from two apps counts as one row, added up.
- **One app** shows the dashboard that app had before. Every app's dashboard is the same views, in
  `_shared/` in the dashboard's folder (a private folder, so it is no route), filled from that app's
  data in `<app>/`, which only loads when that app is picked.

```
app/telemetry/_shared     the views and their logic, once: AppDashboard, the tabs, cards, charts, rankings
app/telemetry/<app>       the app's data: config.ts, its catalogue, event explanations, retired events, tests
```

`<app>/config.ts` is the whole difference between two apps' dashboards (`TelemetryAppConfig` in
`_shared/app.ts`): its name, the noun for what it makes (document, project, design), its accent, its
category colours, how its events read (`createEventExplanation` over its own sentences), its retired
events, its call-to-action vocabulary, and the charts on each tab and section. A section an app has
nothing for is left out rather than shown empty: Community is livediagram's only, and Modes is left
out for liveplanner, which has no canvas modes. `<app>/Body.tsx` hands the config to `AppDashboard`,
which gives it to every view through context. The views draw with the shared design system,
`@liveworkspace/ui` (buttons, fields, tooltips, hover cards, menus), and import their glyphs (`Glyph`,
`CloseIcon` and the rest, which `@livediagram/ui` re-exports from `@liveworkspace/ui`) and brand marks
through `@livediagram/ui`. The shared views are tested against
every app's config (`_shared/test-apps.ts`).

**Loading.** The page never goes blank while numbers load: on the first visit, on picking an app
whose summary hasn't come yet, and while that app's own dashboard code downloads. The header, the
app chips and the closing note stay put, and where the numbers go a skeleton holds their shapes in
the layout they will take: the three window tiles and the trend chart, then for All apps the "By
app" cards and the busiest-event rows under their real titles, and for one app the tab row and a
grid of metric cards. The skeleton reserves the heights of the panel and tabs above the fold, so
nothing above the cards moves when the data lands. It is static markup with a gentle pulse that
stops under reduced motion, and it is marked busy for assistive tech. An app's earlier numbers are
not kept on screen dimmed in the meantime: the two dashboards are different shapes, and another
app's numbers under the new app's chip would read as the new app's. A summary already fetched shows
at once, and changing the window or tab never fetches, so neither shows the skeleton. A failed fetch
keeps its own message.

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

livediagram, liveplanner, livedocuments and livedesign send events, and each has its own dashboard
data under `apps/site/app/telemetry/<app>/` (`livediagram/`, `liveplanner/`, `livedocuments/`,
`livedesign/`). Each folder's tests read that app's source: every event an emitter can send must be
in its vocabulary and have a chart (`metric-emitters.test.ts`, `computed-emitters.ts`), and every
event has an explanation (`event-explanation.test.ts`). An event of a removed feature goes in the app's
`retired-events.ts`, and the dashboard drops it before any chart (`_shared/retired-events.ts`).

## Deploys

CI's deploy ships it ([docs/ci.md](../../../../docs/ci.md#deploys) at the repository root): staging on every push to `main`, production through the manual gate, both on the liveworkspace Cloudflare account. The Worker is in the first tier, so its D1 migrations (`apps/telemetry/migrations`) apply before its
code, and it takes the route `liveworkspace.app/api/telemetry*` only, so the rest of the zone is untouched. The
databases are `liveworkspace-telemetry` and `liveworkspace-telemetry-staging`, with their ids in
`apps/telemetry/wrangler.toml`. The dashboard ships with the site ([site.md](../010-site/site.md)).

Secrets are set once per environment with `wrangler secret put` and survive every deploy: one key per app,
`TELEMETRY_KEY_LIVEDIAGRAM`, `TELEMETRY_KEY_LIVEPLANNER`, `TELEMETRY_KEY_LIVEDOCUMENTS` and
`TELEMETRY_KEY_LIVEDESIGN` (each `openssl rand -hex 32`), with the same value as that app's api and mcp
Workers' `TELEMETRY_KEY`. The apps reach the service over HTTPS, not a service binding.

## Adding an app

1. Add its site to `TELEMETRY_APPS` and its origins to `TELEMETRY_APP_ORIGINS` in
   `packages/telemetry/src/apps.ts`. Its vocabulary must take the Explorer's events
   (`EXPLORER_TELEMETRY_EVENTS`), which its dashboard then charts.
2. Add its vocabulary to `apps/telemetry/src/vocabularies.ts`, and a `TELEMETRY_KEY_<APP>` secret to
   `src/env.ts` and `appKey`.
3. Add its dashboard data under `apps/site/app/telemetry/<app>/`: a `config.ts` (a
   `TelemetryAppConfig`), its catalogue and explanations, and a `Body.tsx` that hands the config to
   `AppDashboard`, which the page loads when the app is picked. Add the config to
   `_shared/test-apps.ts` so the shared views' tests run against it, and its brand scale to
   `telemetry.css`.
4. In the app, send batches as above, and allow `https://www.liveworkspace.app` in its CSP
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
- **One set of views** (October 2026): the four apps' dashboards were near-copies (420 files, 65,261
  lines); with the views shared they are 200 files and 43,705 lines. In the production build, an app's
  dashboard loads 83.6 to 108.6 KiB of JavaScript (gzipped; 96.1 to 113.6 before), and every app's
  together 290.0 KiB, against 415.5, since the views' chunks are now one set the browser caches across
  apps. livediagram's own grew 1.5 KiB (the shared views read the app's config through context).
  The page's first load is unchanged (219 KiB). The dashboard's stylesheet reads only
  `@livediagram/ui` and the other apps' `Brand.tsx` (20.5 KiB gzipped, was 20.7).
- **Accounts' team and token events**: reporting one is an array push on the request; the app it
  counts for is read (one primary-key read each) and the batch sent, one per app, in `waitUntil` after
  the response, bounded at two seconds. No query or request is added to the request itself.
- **Telemetry Worker**: taking settings events from liveworkspace.app bundles the four settings
  catalogues: 112 KiB to 182 KiB (19.4 to 25.0 KiB gzipped). Their 300 events become one set per app
  once per isolate, in about 0.3 ms.
- **Apps**: a browser batch is now cross-site, so it can't reuse the app's own connection; the first
  send on a page opens one more connection, to liveworkspace.app. Sends are batched (every 10
  seconds, and on page hide), so this is one connection per page view, off the critical path.
