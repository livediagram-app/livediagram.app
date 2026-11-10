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

| Field      | What it is                                                                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app`      | The app's site: `livediagram.app`, `liveplanner.app`, `livedocuments.app`, `livedesign.app` or `livehuddle.app` (`TELEMETRY_APPS`), or a held app's (`HELD_TELEMETRY_APPS`, empty today) |
| `category` | The parent, such as `Document` or `Element`                                                                                                                                              |
| `action`   | The verb, such as `Created` or `Added`                                                                                                                                                   |
| `type`     | Optional. One short reference token, such as `Square`; never user content                                                                                                                |
| `ts`       | Stamped by the service when the batch arrives                                                                                                                                            |

There is no identity, IP address, owner id or document id. Each app keeps its own closed vocabulary
in its own api-schema (`telemetry-schema.ts`), because its editors and its vocabulary change
together. The service imports each sending app's vocabulary (livediagram's, liveplanner's,
livedocuments', livedesign's and livehuddle's), and only stores an event that its app could have sent.

## Sending events

`POST https://www.liveworkspace.app/api/telemetry/events` with a JSON body:

```json
{ "app": "livediagram.app", "events": [{ "category": "Document", "action": "Created" }] }
```

The answer is always `204`, whether the batch was stored or not, so telemetry can never surface an
error to the page or Worker that sent it. A batch stores at most 100 events.

**Stored twice, at once.** Each event is kept as a row of its own (`events`), and it adds one to its
day's count (`event_counts`: one row per UTC day, app and event, holding how many arrived). Both are
written in one transaction, so the two never disagree. The dashboard reads only the day counts; the
rows are the record the counts can always be rebuilt from.

**From a browser**, each app buffers events and sends them in batches, with `navigator.sendBeacon`
on page hide. The batching is one engine for every sender, `@liveworkspace/telemetry/emitter`
(`createTelemetryEngine`). The browser side around it (the opt-out rule, the public sites' tracker,
client error tracking, timings, page hide) is `@liveworkspace/telemetry-client`, also shared; each
app's `@<app>/telemetry-client` only binds it to the app: its name here, the key its preferences are
stored under, its vocabulary's types and its error and timing tokens. It sends the body as `text/plain`, with no cookies, so a
cross-site send needs no CORS preflight. The service stores a browser batch only when its `Origin` is
one of its app's own sites (`TELEMETRY_APP_ORIGINS`), so one site can't post in another's name.
Browser batches are rate-limited per network (120 a minute; the IPv4 address or the IPv6 /64, an IPv4-mapped IPv6 address as its IPv4 address, keyed by
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
`?app=liveplanner.app`, `?app=livedocuments.app`, `?app=livedesign.app` or `?app=livehuddle.app` opens one app's own dashboard, with all of
its tabs, catalogues and explanations. Picking an app on the page updates the link.

- **All apps** adds every app's events together. It shows the three windows (today, last 7 days,
  last 30 days) and the 30-day trend line, then **Apps Compared** (its own section, below), then the busiest events.
  The same event from two apps counts as one busiest-events row, added up.
- **One app** shows the dashboard that app had before. Every app's dashboard is the same views, in
  `_shared/` in the dashboard's folder (a private folder, so it is no route), filled from that app's
  data in `<app>/`, which only loads when that app is picked.

```
app/telemetry/_all        All apps' Apps Compared: its figures (apps-compared.ts), charts and tables
app/telemetry/_shared     the views and their logic, once: AppDashboard, the tabs, cards, charts, rankings
app/telemetry/<app>       the app's data: config.ts, its catalogue, event explanations, retired events, tests
```

`<app>/config.ts` is the whole difference between two apps' dashboards (`TelemetryAppConfig` in
`_shared/app.ts`): its name, the noun for what it makes (document, project, design), its accent, its
category colours, how its events read (`createEventExplanation` over its own sentences), its retired
events, its call-to-action vocabulary, and the charts on each tab and section. A section an app has
nothing for is left out rather than shown empty: Community is livediagram's only, and Modes is left
out for liveplanner, which has no canvas modes. `<app>/Body.tsx` hands the config to `AppDashboard`,
which gives it to every view through context. The accent itself is CSS: the page wraps the dashboard in
`data-app="<app>"` and `telemetry.css` sets that app's brand scale under it. Anything portalled out to
`<body>` (a stack's modal) copies the `data-app` of the card that opened it, so it wears the same accent
rather than falling back to the default sky (Work Tracker #588). The views draw with the shared design system,
`@liveworkspace/ui` (buttons, fields, tooltips, hover cards, menus), and import their glyphs (`Glyph`,
`CloseIcon` and the rest, which `@livediagram/ui` re-exports from `@liveworkspace/ui`) and brand marks
through `@livediagram/ui`. The shared views are tested against
every app's config (`_shared/test-apps.ts`).

**The window.** Today, Last 7 days and Last 30 days are the three windows, picked on the panel at the top, and
every number under it follows the one picked. The page holds the window, not each dashboard, so picking another
app (or All apps) keeps it: a switch never starts again at Last 7 days. A reload does, since the window is in
neither the URL nor storage. There is no 90-day window: the events are kept 60 days.

**Loading.** The page never goes blank while numbers load: on the first visit, on picking an app
whose summary hasn't come yet, and while that app's own dashboard code downloads. The header, the
app chips and the closing note stay put, and where the numbers go a skeleton holds their shapes in
the layout they will take: the three window tiles and the trend chart, then for All apps Apps
Compared's charts, tiles and table rows and the busiest-event rows under their real titles, and for one app the tab row and a
grid of metric cards. The skeleton reserves the heights of the panel and tabs above the fold, so
nothing above the cards moves when the data lands. It is static markup with a gentle pulse that
stops under reduced motion, and it is marked busy for assistive tech. An app's earlier numbers are
not kept on screen dimmed in the meantime: the two dashboards are different shapes, and another
app's numbers under the new app's chip would read as the new app's. A summary already fetched shows
at once, and changing the window or tab never fetches, so neither shows the skeleton. A failed fetch
keeps its own message.

The numbers come from `GET /api/telemetry/summary?app=all|<an app in TELEMETRY_APPS>`, built from
one read of the day counts over the last 59 days (the last 30, and the 30 before them for the trend
arrows). It reads one row per day and event, never the events themselves, so its cost follows how
many kinds of event arrive, not how many. Each window carries `byApp`, and the daily series carries `byApp` too. `audience` keeps the five audience
events per app, not merged (`packages/telemetry/src/audience.ts`): each app's 30-day series of each, and each
window's and its previous span's counts, folded in the same pass. The response is
cached at the edge for 5 minutes per filter, so a traffic spike on the public page is answered from
the cache, not D1. In development the cache is off.

### Apps Compared

All apps' comparison of the apps, in place of the per-app cards it had until November 2026. Each block reads the
window above and compares it with the same number of days just before it.

1. **Events by App.** One chart of every app's daily events over the 30 days, each app's line in its own accent,
   with a dashed Total; the window is shaded. A legend entry per line hides or shows it (hiding the Total spreads
   the apps' lines over the chart). Under it, a table: each app's events in the window, its share of them, its
   change against the span before, and its events per visit, then liveworkspace.app's own events (the Explorer and
   Settings on All apps) when it has any, and the Total. An app's name opens its dashboard.
2. **Visitors and Accounts.** For All Apps (every app added up) or one app, picked beside the title: six tiles
   (Avg Daily Visitors, New Visitors, Returning Share, Sign-Ups, Sign-Ins, Sign-Ups per 100 New), each with its
   arrow against the span before where it has one; a chart of new and returning visitors per day and one of
   sign-ups and sign-ins per day, the window shaded; and a table comparing every app, whatever the pick: Avg Daily
   Visitors, New, Returning, Returning Share, Signed In of Returning, Sign-Ups, Sign-Ins and Sign-Ups per New, with
   the Total. A "What These Count" note under it says what each number is, as below.

Every chart hides its drawing from a screen reader and carries the same numbers as a table of its days; its tooltip
(Tooltips, below) lists every line's count for a day. With nothing counted in the 30 days, a block says so instead of drawing flat
lines. On a phone the tiles go two to a row and the tables scroll sideways inside their card; the page itself never
does, so a screen reader's table and caption are clipped inside their card, never by the page.

What the numbers are, all from events every app already sends, per app:

| Number               | From                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New visitor          | `Participant·Created`: a browser new to the app (a guest identity it has not had)                                                                                         |
| Returning visitor    | `Participant·Returned·Anonymous` / `Authenticated`: a browser that has been before, on a later UTC day, at most once a day (`createDailyReturn`), as a guest or signed in |
| Visit                | New plus returning: one browser on one UTC day. A day's visits are the browsers that opened the app that day; over 7 or 30 days a browser counts once a day               |
| Avg Daily Visitors   | Visits over the window's days. Today is a day still running                                                                                                               |
| Returning Share      | Returning visits of all visits                                                                                                                                            |
| Sign-up              | `Session·SignedUp`, from the app's api: an account the app has never seen finishing sign-in (one made on another app counts as new here)                                  |
| Sign-in              | `Session·SignedIn`, from the app's api: any other finished sign-in, never a token refresh                                                                                 |
| Sign-Ups per 100 New | Sign-ups for each 100 new visitors: a rough conversion, which can pass 100, since a returning guest may sign up too                                                       |
| Events per Visit     | The app's events over its visits: how much each visit does                                                                                                                |

The Total adds the apps: a person who joins two apps is two sign-ups, and a browser using two apps is a visitor to
each. Browsers that turned telemetry off or ask sites not to track send no visits, while the apps' servers still
count sign-ups and sign-ins, so the ratios lean high; clearing a browser's storage makes it new again.

**No unique people, by design.** There are no weekly or monthly unique visitors and no DAU/MAU stickiness: telling
two days' visits from the same browser apart from two browsers would need an id kept per person (or per browser)
across days, and events carry no identity (What an event is). Returning Share stands in for stickiness: how much
of the traffic is browsers coming back. Nothing new is collected for this section, and no table is added: the
summary reads these five events from the day counts it already reads.

### Tooltips

Every chart on the dashboard (the window panel's trend line, a metric card's line, a chart stack's lines, Search's
charted metric, Apps Compared's three charts, and a timing card's bucket bars and daily p75 line) answers hover,
touch and the keyboard the same way, through one shared hover model and one tooltip. The events table's
sparklines stay plain: dozens of them sit in a table, and the row already carries its numbers.

Until November 2026 each day was its own hover card: 30 invisible columns per chart, each a separate trigger, so
crossing the chart closed one card and opened the next (a flash at every day), the card hung off the whole column
above or below the chart rather than beside the data, nothing marked which day or point it was about, a
multi-line day was one run-on sentence ("livediagram.app 120 · liveplanner.app 45 · ..."), the columns took no
keyboard focus, and a phone needed a long press on a sliver of the chart.

- **Snapping.** Anywhere over the plot snaps to the nearest day (or, on a bar chart, the column whose band holds
  the pointer); there is no dot to aim at. A thin vertical crosshair runs through the day, and every line shown
  gets a filled dot at that day's value, ringed in the card's background so it reads on any line. On a bar chart
  the hovered column's band is tinted and the others dim slightly.
- **One tooltip per day.** Its heading is the day ("Tue 10 Nov", in the reader's locale, UTC like the axis) or
  the bucket ("100 to 250 ms"). Each line is a row: its colour swatch (dashed for a dashed line), its name, its
  count with thousands separators, and its change against the day before ("+12%", "−5%", "New" from nothing,
  "Flat"), smallest-print grey so the counts lead. Rows are sorted by count, largest first. A chart whose lines
  add up shows a **Total** row under a rule (Events by App's Total line is that row; New and Returning add to
  Visits); a chart whose lines don't (sign-ups and sign-ins, a stack's members) has none. A day without a reading
  (a p75 day with too few timings) says "No Reading".
- **Placement.** The tooltip sits beside the crosshair, to its right, and flips to its left when it would leave
  the viewport, so it never covers the day's points; where neither side has room (a phone) it sits above the
  chart, or below when the chart is at the top of the screen. It is portalled to the page so no card clips it,
  wears the chart's app accent, and moves by transform only, gliding between days (none under reduced motion).
  Moving within one day changes nothing on screen.
- **Pinning.** A click pins the tooltip on its day, so the pointer can move onto it; a second click, a click
  elsewhere or Escape lets it go. A chart inside a card that opens on a click (a chart stack's head) doesn't pin,
  so the click still opens the card.
- **Series emphasis.** Hovering or focusing a legend entry, or hovering a row of a pinned tooltip, emphasises
  that line: its dot grows, its row is bold, and the other lines fade.
- **Touch.** A tap shows the day under the finger; dragging along the chart scrubs day by day while the page
  still scrolls vertically; the tooltip stays after the finger lifts until a tap elsewhere.
- **Keyboard.** Each chart is one tab stop. Focus shows the latest day; Left and Right step a day, Home and End
  go to the first and last, Up and Down move the emphasis through the rows, Escape closes. A screen reader hears
  the focused day read out once per step (a polite live region: "Tue 10 Nov. livediagram.app 120, up 12%. ...
  Total 165."); a chart that carries a table of its days keeps it.
- **Look.** The tooltip is the design system's hover-card surface (white with a slate border, the dark chrome's
  slate 800 in dark mode), the crosshair a slate hairline, every label in Title Case, the counts tabular figures.

## Retention

A daily cron (03:17 UTC) deletes events older than 60 days, and the day counts of every UTC day before
the one 60 days back (that day and older are outside the dashboard's 59). In the same run it counts yesterday again from its events and replaces yesterday's
day counts with that, in one transaction: if anything ever wrote one without the other (the seconds
during a deploy between the migration and the new code, when the old code still writes only events),
the counts heal by the next morning.

## Running it locally

```sh
cd liveworkspace/apps/telemetry
corepack pnpm dev                     # the API, http://localhost:8790/api/telemetry
```

Its `dev` script makes `.dev.vars` from `.dev.vars.example` when there is none (never over one) and applies the
local migrations before it starts ([sign-in.md](../003-accounts/sign-in.md#local-clients)).

Development accepts events from any `localhost` page. Point an app at it with
`NEXT_PUBLIC_TELEMETRY_URL=http://localhost:8790/api/telemetry` (and `TELEMETRY_URL`, plus the dev key
from `.dev.vars`, for its Workers). The dashboard is the site's: `corepack pnpm dev:workspace` from
the repo root runs the site with this Worker behind it, at http://localhost:3000/telemetry.

## Which apps send

livediagram, liveplanner, livedocuments, livedesign and livehuddle send events, and each has its own dashboard
data under `apps/site/app/telemetry/<app>/` (`livediagram/`, `liveplanner/`, `livedocuments/`,
`livedesign/`, `livehuddle/`). Each folder's tests read that app's source: every event an emitter can send must be
in its vocabulary and have a chart (`metric-emitters.test.ts`, `computed-emitters.ts`), and every
event has an explanation (`event-explanation.test.ts`). An event of a removed feature goes in the app's
`retired-events.ts`, and the dashboard drops it before any chart (`_shared/retired-events.ts`). livehuddle's checks also
run the other way round: every chart must count something its source can still send ("every chart has a sender"), so a
feature that leaves takes its charts with it.

The scan (`emitter-scan.ts`) reads a `track('A', 'B', 'C')` call and its forwarding helpers, a shared package's bound
track called on its bindings with the category written out (`avatarBindings.track('UI', 'Changed', 'AvatarStatus')`),
and each Settings catalogue row, including one built by a helper or spread from a shared base, whose kind it reads from
the row's event (an on/off pair is a toggle, a lone `changed` a slider; `emitter-scan-settings.ts`). Each app's scan
adds what the platform sends in its name (`platform-emitters.ts`): the accounts Worker, the Explorer and the Community
page on liveworkspace.app, the shared browser client, editor and UI packages, and the shared help centre. A package
only one product uses lives in that product's folder and its own scan reads it (livehuddle's Avatar mode,
`@livehuddle/avatar`, since Work Tracker #650).

An app whose palette is not the diagram one gives its config `palette.cards`, one ranking card per palette category in
the palette's order, and the shared Palette section shows those (livehuddle's Space categories); without it the
section shows the diagram palette's Shapes, Tools, Components, Devices and Icons.

## Deploys

CI's deploy ships it ([docs/ci.md](../../../../docs/ci.md#deploys) at the repository root): staging on every push to `main`, production through the manual gate, both on the liveworkspace Cloudflare account. The Worker is in the first tier, so its D1 migrations (`apps/telemetry/migrations`) apply before its
code, and it takes the route `liveworkspace.app/api/telemetry*` only, so the rest of the zone is untouched. The
databases are `liveworkspace-telemetry` and `liveworkspace-telemetry-staging`, with their ids in
`apps/telemetry/wrangler.toml`. The dashboard ships with the site ([site.md](../010-site/site.md)).

Secrets are set once per environment with `wrangler secret put` and survive every deploy: one key per app,
`TELEMETRY_KEY_LIVEDIAGRAM`, `TELEMETRY_KEY_LIVEPLANNER`, `TELEMETRY_KEY_LIVEDOCUMENTS`,
`TELEMETRY_KEY_LIVEDESIGN` and `TELEMETRY_KEY_LIVEHUDDLE` (each `openssl rand -hex 32`), with the same value as that app's api and mcp
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

An app registered before its launch ([Registered before launch](../002-architecture/integrating-an-app.md#registered-before-launch))
goes in `HELD_TELEMETRY_APPS` instead of `TELEMETRY_APPS` for step 1: the service stores its events and takes its
key, and the dashboard's app picker and All apps view, which read `TELEMETRY_APPS`, leave it out, so step 3 waits
for its launch. No app is held today. livehuddle was: it launched (Work Tracker #189) before its dashboard was
built, and moved into `TELEMETRY_APPS` with its dashboard (Work Tracker #400). It is checked against its own
api-schema's vocabulary (`@livehuddle/api-schema`). Its dashboard has no MCP or CLI views, and its checks leave
out livehuddle's `apps/mcp`, `apps/cli` and `packages/agent-verbs`: livehuddle drops its MCP server and CLI
(Work Tracker #562, #563), so their events get no charts.

## Performance

- **Ingest**: one D1 batch per request: an insert per event, and one count update per distinct event
  in the batch (the batch's events are added up first, so 100 of the same event are one update).
- **Summary**: one read of the day counts per filter, at most once per 5 minutes per edge location.
  It reads one row per day, app and event, never the events. Until November 2026 it grouped every event
  of the 59 days instead: on a local SQLite copy with 1 million events, All apps took 1.5 to 2.3 s (3.4 to 32.5 s
  when the events were stored out of order) and one app 0.25 to 0.4 s, growing with every event, so it would
  near D1's 30-second limit at about 10 million events in 60 days, and every cache miss was billed a
  row read per event. The counts make it a few milliseconds, whatever the traffic (blueprint
  "Performance and limits" has the numbers). Folding the rows is linear; a test folds a worst case
  (59 days × 2 apps × 1,500 events) inside a time budget.
- **Apps Compared** adds no query, statement or table: the five audience events are found with one map lookup
  per day-count row in the fold the summary already makes, and add about 1,000 numbers (a few KB, before gzip) to
  the All apps answer: six senders (the five apps and liveworkspace.app, whose stay 0), five numbers, 30 days,
  plus three windows twice. The page works them out once per window or scope pick (memoised), and draws three
  charts of at most six 30-point lines.
- **Tooltips**: a pointer move costs one read of the chart's box and one division per animation frame, at most (the
  moves are coalesced on `requestAnimationFrame`; the day is a binary search over the days' centres), and nothing
  re-renders unless the day changes; then only the overlay does (crosshair,
  dots, tooltip), never the chart's lines. Each chart is one overlay instead of 30 hover cards. Numbers measured
  in the blueprint ("Performance and limits"), with a test budget at 365 days by six lines.
- **Index**: `events` keeps `(ts)` for the sweep and for counting a day again; the day counts' key starts
  with the app, so one app's read is a range of it.
- **The counts' first fill**: the migration that adds them counts every event already stored, in one
  statement, so the dashboard shows the same numbers on the day it ships. In production that was
  44,203 events (6,238 day counts) in November 2026, about 30 ms of D1 time.
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
- **Telemetry Worker**: taking settings events from liveworkspace.app bundles the five settings
  catalogues. The first four took it from 112 KiB to 182 KiB (19.4 to 25.0 KiB gzipped); livehuddle's
  adds 9.2 KiB (0.3 KiB gzipped, 228 KiB and 30.2 KiB in all, November 2026). Their events become one
  set per app once per isolate, in about 0.3 ms.
- **Apps**: a browser batch is now cross-site, so it can't reuse the app's own connection; the first
  send on a page opens one more connection, to liveworkspace.app. Sends are batched (every 10
  seconds, and on page hide), so this is one connection per page view, off the critical path.
