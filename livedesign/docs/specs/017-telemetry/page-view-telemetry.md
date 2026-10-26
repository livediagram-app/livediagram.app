# Page view telemetry

Status: shipped

## What

Count **every page viewed** across the site, by page: the landing and other
marketing pages, each help article, the Explorer's pages and the editor. A view is recorded whether the page arrived as a
full load (typed URL, shared link, refresh) or as a client-side navigation
inside a Next app (Explorer → a design, one help article → another).

The dashboard's **Pages** section shows page views for the selected
window, broken down by app (`pageViewApp`: Marketing, Live, Help, and Dashboard for a
`/telemetry` path, which livedesign's router redirects to liveworkspace's dashboard).

## Why

The other events ([Telemetry + public transparency dashboard](telemetry.md)) count what people _do_ in the editor and
which help articles get read; page views say which pages people _land on_ and
move between: "is anyone reading the alternatives pages?", "how many people who
hit the landing page reach `/new`?", "is `/explorer/timeline` used?".

## Why the browser, not the router

The router ([Router app](../016-platform/router-app.md)) sees every request, but it is the wrong place to count, for two reasons:

1. **It cannot see client-side navigations.** All three frontends are Next apps.
   Moving between their pages fetches no HTML, so the router sees first loads
   and refreshes only; the Explorer → editor hop, the most interesting one, is
   invisible to it.
2. **It cannot honour the opt-out.** The per-browser telemetry switch ([User preferences](../007-editor/user-preferences.md))
   lives in `localStorage`, which only the page can read.

So each frontend reports its own views through the existing emitter, and the
router stays pure routing.

## The event

A page view is an ordinary [Telemetry + public transparency dashboard](telemetry.md) event: **`Page` · `View` · `<path>`**. The
`type` is the normalised page path, e.g. `/`, `/alternatives/miro`,
`/help/canvas/the-canvas`, `/explorer/recent`, `/design`.

Carrying it as an event rather than a new table or endpoint means it rides the
whole pipeline: the buffered emitter, the page-hide beacon,
the central ingest's abuse controls, liveworkspace's storage and retention, the
summary's per-window counts and per-metric 30-day series, and the dashboard's
ranking cards. One row per view, like every other event.

### The path is normalised before it leaves the browser

The path is the one piece of this event that isn't from a fixed vocabulary, so
it is reduced to _which page_, never _which thing on it_:

- **Query string and hash dropped.** Never sent. This is where invites
  (`/join?token=`), share codes and folder ids live.
- **Ids dropped, not replaced.** `/design/<anything>` becomes `/design`: the
  dashboard shows hits to the design route, not to any one design. Any other
  segment that looks like an id (a UUID, or a long token containing a digit)
  is cut off along with everything after it, since what follows an id is about
  that one thing. There is no `[id]` placeholder either: it read as though an
  id were being stored, so the stored path carries nothing id-shaped at all,
  and the ingest rejects one. A design id never leaves the browser.
- **Canonical form.** Lower-cased, trailing slash and `.html` / `index.html`
  removed, so `/help/tabs/` and `/help/tabs` are one page.
- **Anything else is dropped, not sent.** A segment with characters outside
  `a-z 0-9 - . _`, more than 6 segments, or a result over 120 characters
  emits nothing. The rule is deny-by-default: an odd path is lost, never
  leaked.

The normaliser is one shared function (`pageViewPath` in
`@livedesign/api-schema`, beside the validator it must satisfy) used by every
app, so the rules can't drift per app and the browser can never produce a path
the ingest would drop.

### Server validation

`TELEMETRY_TYPE_PATTERN` (a 40-character token with no `/`) cannot hold a path,
so the `Page·View` pair alone validates its `type` against
`PAGE_VIEW_PATH_PATTERN` instead: the normalised grammar above, at most 120
characters. `Page` is valid only with `View`, and a `Page·View` without a valid
path is dropped. Every other event keeps the existing pattern.

### 404s

A page that doesn't exist is still a page view, and is counted under whatever
path was asked for, within the grammar above. That is useful (it shows broken
links arriving), bounded by the same deny-by-default normaliser, and cannot
carry anything the grammar rejects. The editor's not-found slot renders the
editor ([Dedicated route for new-design creation](../007-editor/new-design-route.md)), so every `/design/...` URL is counted as `/design`
whether or not the design exists.

### Counting

- One view per **path change**, from the shared `PageViewTracker` component
  (`@livedesign/ui`), which reacts to Next's `usePathname`, mounted in each
  app's root layout through a client adapter that hands it a `track()`. The
  public sites (marketing, help) both mount the shared
  `PageViewBoot` from `@livedesign/ui`, wired to their one shared emitter
  (`siteTrack` in `@livedesign/telemetry-client`); the editor mounts its own
  `PageViewBoot` with its own emitter. A query-only change
  (a tab switch in the editor, a folder switch in the Explorer) is not a new
  page and does not count.
- The same path twice in a row is not counted twice. This suppresses React
  StrictMode's dev-only double effect; in production a path can't repeat
  without a navigation in between, and a real reload starts a fresh page.
- `Help·View·<article id>` ([Help app](../018-help/help-app.md)) counts help articles too, keyed by article id,
  and drives the Pages & Help tab's Help section; the two overlap for articles by design.

## Who emits

All three frontends, each through the shared engine with the same policy as the
other emitters: the build-time `NEXT_PUBLIC_TELEMETRY_ENABLED` gate plus the
[User preferences](../007-editor/user-preferences.md) per-browser opt-out, which every app on the origin reads from the same
preferences key.

- **editor** (`apps/live`) and **help centre** (`apps/help`), beside their other events.
- **marketing** (`apps/marketing`): its _only_ event is the page view: it mounts the shared
  `PageViewBoot` and nothing else, and deliberately no error tracking (the
  privacy policy promises page views only). The landing funnel
  ([Landing funnel](../019-marketing/landing-funnel.md)) measures what those pages lead to
  without changing that: each CTA's link names its button, and the editor
  sends the `Cta` events.

The marketing site reports page views and nothing else. They are first-party, sent to
liveworkspace's own telemetry service, anonymous, cookie-free and opt-out-able, and the "0 third-party
trackers" claim stays literally true. The privacy policy and What We Collect
article say so.

## Dashboard

The dashboard is liveworkspace's ([Telemetry + public transparency dashboard](telemetry.md) "Dashboard"). Its **Pages** section (Pages & Help) reads page views **by app**: Marketing, Live (the editor app), Help and Dashboard. The app is derived from the path's first segment using the same live route-segment list the router routes by (`LIVE_ROUTE_SEGMENTS` and `pageViewApp` in `packages/api-schema/src/page-views.ts`), so the dashboard and router can't disagree about which app serves a path.

- **Page Views by App** is a chart stack on the Dashboard: a head plotting each app's line with the combined count, opening into one card per app (a set of paths rather than one type).
- **Top pages.** The ten most-viewed pages across every app, then each app's own top ten, as ranking cards, each row labelled with the raw path (not title-cased) with its share bar and 30-day sparkline.

The page-view helpers live in `../liveworkspace/apps/site/app/telemetry/_shared/page-views.ts`, pure and tested apart from the view. Page views are events, so they also count toward the window totals and Search like any other category.

## Out of scope

- Referrers, entry/exit pages, session paths, time on page. Each needs an
  identifier or a cross-event link, which [Telemetry + public transparency dashboard](telemetry.md) rules out.
- The router. It stays routing only.
