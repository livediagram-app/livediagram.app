# 150 — Page view telemetry

Status: shipped

## What

Count **every page viewed** across the site, by page: the landing and other
marketing pages, each help article, the Explorer's pages, the editor, and the
`/telemetry` dashboard itself. A view is recorded whether the page arrived as a
full load (typed URL, shared link, refresh) or as a client-side navigation
inside a Next app (Explorer → a diagram, one help article → another).

The dashboard gets a **Pages** tab of page views for the selected
window, broken down by app (Marketing, Live, Help, Dashboard).

## Why

The existing telemetry (spec/22) counts what people _do_ in the editor and
which help articles get read, but nothing says which pages people _land on_ or
move between. "Is anyone reading the alternatives pages?", "how many people who
hit the landing page reach `/new`?", "is `/explorer/timeline` used?" had no
answer.

## Why the browser, not the router

The router (spec/08) sees every request, so it looked like the cheap place to
count. It is the wrong one, for two reasons:

1. **It cannot see client-side navigations.** All four frontends are Next apps.
   Moving between their pages fetches no HTML, so the router sees first loads
   and refreshes only; the Explorer → editor hop, the most interesting one, is
   invisible to it.
2. **It cannot honour the opt-out.** The per-browser telemetry switch (spec/20)
   lives in `localStorage`, which only the page can read.

So each frontend reports its own views through the existing emitter, and the
router stays pure routing.

## The event

A page view is an ordinary spec/22 event: **`Page` · `View` · `<path>`**. The
`type` is the normalised page path, e.g. `/`, `/alternatives/miro`,
`/help/canvas/the-canvas`, `/explorer/recent`, `/diagram`.

Carrying it as an event rather than a new table or endpoint means it rides the
whole existing pipeline unchanged: the buffered emitter, the page-hide beacon,
the ingest's abuse controls, the events table, the 60-day retention sweep, the
summary's per-window counts and per-metric 30-day series, and the dashboard's
ranking cards. One row per view, like every other event.

### The path is normalised before it leaves the browser

The path is the one piece of this event that isn't from a fixed vocabulary, so
it is reduced to _which page_, never _which thing on it_:

- **Query string and hash dropped.** Never sent. This is where invites
  (`/join?token=`), share codes and folder ids live.
- **Ids dropped, not replaced.** `/diagram/<anything>` becomes `/diagram`: the
  dashboard shows hits to the diagram route, not to any one diagram. Any other
  segment that looks like an id (a UUID, or a long token containing a digit)
  is cut off along with everything after it, since what follows an id is about
  that one thing. There is no `[id]` placeholder either: it read as though an
  id were being stored, so the stored path carries nothing id-shaped at all,
  and the ingest rejects one. A diagram id never leaves the browser.
- **Canonical form.** Lower-cased, trailing slash and `.html` / `index.html`
  removed, so `/help/tabs/` and `/help/tabs` are one page.
- **Anything else is dropped, not sent.** A segment with characters outside
  `a-z 0-9 - . _`, more than 6 segments, or a result over 120 characters
  emits nothing. The rule is deny-by-default: an odd path is lost, never
  leaked.

The normaliser is one shared function (`pageViewPath` in
`@livediagram/api-schema`, beside the validator it must satisfy) used by every
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
editor (spec/14), so every `/diagram/...` URL is counted as `/diagram`
whether or not the diagram exists.

### Counting

- One view per **path change**, from the shared `PageViewTracker` component
  (`@livediagram/ui`), which reacts to Next's `usePathname`, mounted in each
  app's root layout through a client adapter that hands it a `track()`. The
  public sites (marketing, help, the dashboard) all mount the shared
  `PageViewBoot` from `@livediagram/ui`, wired to their one shared emitter
  (`siteTrack` in `@livediagram/telemetry-client`); the editor mounts its own
  `PageViewBoot` with its own emitter. A query-only change
  (a tab switch in the editor, a folder switch in the Explorer) is not a new
  page and does not count.
- The same path twice in a row is not counted twice. This suppresses React
  StrictMode's dev-only double effect; in production a path can't repeat
  without a navigation in between, and a real reload starts a fresh page.
- `Help·View·<slug>` (spec/55) stays. It predates this, is keyed by slug and
  drives the Help tab; the two overlap for articles by design.

## Who emits

All four frontends, each through the shared engine with the same policy as the
existing emitters: the build-time `NEXT_PUBLIC_TELEMETRY_ENABLED` gate plus the
spec/20 per-browser opt-out, which every app on the origin reads from the same
preferences key.

- **editor** (`apps/live`) and **help centre** (`apps/help`): already emitting.
- **marketing** (`apps/marketing`) and **the dashboard** (`apps/telemetry`):
  new emitters. Their _only_ event is the page view: they mount the shared
  `PageViewBoot` and nothing else, and deliberately no error tracking (the
  privacy policy promises page views only). The landing funnel
  ([spec/153](153-landing-funnel.md)) measures what those pages lead to
  without changing that: each CTA's link names its button, and the editor
  sends the `Cta` events.

This changes spec/22's "never the static marketing site" rule: the marketing
site now reports page views, and nothing else. It is still first-party, sent to
our own api, anonymous, cookie-free and opt-out-able, and the "0 third-party
trackers" claim stays literally true. The privacy policy and What We Collect
article say so.

## Dashboard

A **Pages** tab (`PagesView`) reads page views **by app**: Marketing, Live
(the editor app), Help and Dashboard. The app is derived from the path's first
segment using the same live route-segment list the router routes by (shared
from `@livediagram/api-schema`, so the dashboard and router can't disagree
about which app serves a path). Top to bottom:

- **Views by app** now lives on **Dashboard** as the **Page Views by App**
  chart stack (spec/22): a head plotting each app's line with the combined
  count, opening into one card per app (the shared metric card, matching a set
  of paths rather than one type). The per-card "N% of page views" line went
  with the move, since catalogue charts are fixed definitions and the share
  depends on the selected window; each app's count sits in the head's legend.
- **Top pages.** The ten most-viewed pages across every app, then each app's
  own top ten, as ranking cards, each row labelled with the raw path (not
  title-cased) with its share bar and 30-day sparkline, balanced across two
  independent columns (spec/22 `CardColumns`): apps serve very different
  numbers of pages, and grid rows stretched each short card to the tallest
  beside it.

Removed in September 2026: an **Insights** row (landing, wizard, explorer,
sign-up and help rates plus pages per visitor, each counted from the day page
views began), a **Rising pages** card (biggest gain over the
last 7 days against the 7 before), and the **All pages** list of every page
(Search still reaches any single page; the Raw tab that also did was removed). The ten most-viewed
pages were briefly a stack opening into the per-app lists; a set of rankings
read side by side on the page is not a stack.

The page-view helpers live in `apps/telemetry/app/page-views.ts`, pure and
tested apart from the view.

Page views are events, so they also count toward the window totals and Search
like any other category.

## Out of scope

- Referrers, entry/exit pages, session paths, time on page. Each needs an
  identifier or a cross-event link, which spec/22 rules out.
- The router. It stays routing only.
