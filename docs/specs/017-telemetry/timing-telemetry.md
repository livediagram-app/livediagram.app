# Timing telemetry

Status: shipped

## What

How long the key moments of the experience take, measured in real browsers and reported as anonymous
[Telemetry + public transparency dashboard](telemetry.md) events: opening a document, switching to a tab,
an autosave, the live room connecting and reconnecting, and the three Core Web Vitals (LCP, INP, CLS) of
every app. The dashboard gets a **Timings** tab that shows each one as a distribution with its median,
75th and 95th percentile.

Timings are about the **overall experience**, not activity. A timing is recorded for a moment a person
waits on, a handful of times per session, never for something that happens constantly (adding an
element, dragging, typing).

## Why

The existing events say what people do and what fails ([Load recovery](../007-editor/load-recovery.md)
counts loads that pass 10 seconds or time out), but nothing says how fast the product feels when it
works. "Did that release make documents open slower?", "how long does a save take for most people?",
"is the landing page's LCP good?" had no answer.

## The event

A timing is an ordinary telemetry event: **`Timing` · `Measured` · `<Metric>.<Bucket>`**, e.g.
`Timing·Measured·DocumentLoad.Under1000ms`, `Timing·Measured·Lcp.Marketing.Under2500ms`.

The duration is **bucketed in the browser**; the raw number never leaves it. Carrying it in the `type`
rather than a new numeric column means it rides the whole existing pipeline unchanged (the buffered
emitter, the opt-out, the ingest's abuse controls, the events table, the 60-day retention, the summary's
per-window counts and per-metric 30-day series), and a bucket is a closed token, so nothing about a
timing can identify a person or a device.

- **`Timing` is a closed vocabulary.** The ingest accepts `Timing` only with `Measured`, and only a
  `type` that is a known metric followed by one of that metric's own buckets (`isTimingType` in
  `@livediagram/api-schema`), the same way `Cta` accepts only its own sources. Anything else is dropped.
- **One definition.** The metrics, their scales and their buckets live in
  `packages/api-schema/src/timing-telemetry.ts`, shared by every emitter, the ingest validator and the
  dashboard, so a bucket the dashboard does not know cannot be sent.

### Buckets

Each metric reads on one **scale**, a list of upper bounds; a value falls in the first bucket whose bound
it is under (`Under<bound>`), or past the last (`Over<last bound>`). Bounds are ascending, and the
Web Vitals scales put a bound exactly on Google's "good" and "poor" thresholds so the dashboard can rate
them without guessing.

| Scale      | Bounds                                                    | Used by                            |
| ---------- | --------------------------------------------------------- | ---------------------------------- |
| `Duration` | 100, 250, 500, 1000, 2000, 4000, 8000, 15000, 30000 ms    | the editor's own timings           |
| `Lcp`      | 500, 1000, 1500, 2500 (good), 4000 (poor), 6000, 10000 ms | Largest Contentful Paint           |
| `Inp`      | 50, 100, 200 (good), 300, 500 (poor), 1000 ms             | Interaction to Next Paint          |
| `Cls`      | 0.01, 0.05, 0.1 (good), 0.25 (poor), 0.5                  | Cumulative Layout Shift (unitless) |

Bucket tokens spell the bound with its unit: `Under500ms`, `Over30000ms`; a CLS bound writes its point as
`p` because the dot separates the token's parts: `Under0p1`, `Over0p5`.

## The metrics

Every timing is **skipped when the page was hidden** at any point while it ran (a background tab, a
sleeping laptop): the browser throttles hidden pages, so the number would measure the throttling, not the
product. Every timing is also skipped when it ends in failure; failures are already counted by
[the `Error` category](telemetry.md).

### Editor (`apps/live`)

- **`DocumentLoad`**: opening an existing document, from when the person asked for it to the first frame
  painted after the load finished (the load's `done` step, [Load recovery](../007-editor/load-recovery.md)).
  "Asked for it" is the page's navigation start when the document page is the page the browser loaded
  (a typed URL, a shared link, a refresh: the number includes downloading the app), or the start of the
  load when the person arrived in-app (from the Explorer). Once per load. Not recorded for a password
  retry, whose time is a person typing. A load that finishes after its watchdog still records
  (`Over30000ms`), because that wait was real.
- **`TabLoad`**: switching to a tab whose content has not been fetched yet, from the fetch starting to
  the first frame painted with the content in place. The same loads that count `Tab·Loaded`: never the
  search panel's background sweep or the side by side pane's fetch.
- **`Save`**: an autosave, from the save starting ("Saving") to every write in it succeeding ("Saved").
  The 600 ms debounce before it is not included. **Sampled**: at most one save timing per page every
  60 seconds (`SAVE_TIMING_INTERVAL_MS`), so a long editing session sends a steady trickle rather than one
  event per save; the first save of a page is always eligible.
- **`RoomConnect`**: the live room ([Live app](../007-editor/live-app.md)), from the first socket attempt
  to the first roster frame: the moment other people's presence appears. Once per room connection.
- **`RoomReconnect`**: a live room that dropped by itself (not closed by the editor, not a trashed
  document or a changed share), from the drop to the first roster frame on the new socket, back-off waits
  included: the outage a person felt. Once per drop. A reconnect that never lands records nothing.

### Every app: Core Web Vitals

- **`Lcp.<App>`**, **`Inp.<App>`**, **`Cls.<App>`**: the page's Core Web Vitals as Google's `web-vitals`
  library computes them (the copy bundled with Next.js, `next/web-vitals`), one of each per full page
  load, `<App>` being the app that served it (`pageViewApp`: `Marketing`, `Live`, `Help`, `Dashboard`,
  `Community`). INP is only recorded when the person interacted with the page. LCP, INP and CLS describe
  a full page load, so an in-app navigation records none of them.
- The reporter is a lazily loaded client chunk (`WebVitalsBoot` in `@livediagram/ui`), so the library
  (about 3 KB gzipped) never sits on a page's critical path; its observers are buffered, so it still sees
  the paints and shifts that happened before it loaded.
- INP and CLS finalise when the page is hidden, which is the moment the emitter flushes. So the emitter
  sends any event tracked while the page is hidden straight away by beacon, rather than buffering it
  behind a flush that has already run.

## Dashboard: the Timings tab

A **Timings** tab in the dashboard's Detail bar, after Exceptions.

- **Editor timings**: one card per editor metric (Document Load, Tab Switch, Save, Live Connect, Live
  Reconnect). Each card's big number is the **p75** for the selected window, with the median (p50) and
  p95 beside it, how many timings it is drawn from, and a bar chart of the window's buckets. A card under
  `TIMING_MIN_SAMPLES` (20) timings says so instead of a percentile, because a percentile of a handful of
  timings misleads.
- **Core Web Vitals**: one card per app, a row each for LCP, INP and CLS with its p75 and a rating
  against Google's thresholds (Good, Needs Work, Poor), coloured green, amber and red with the word
  always shown.
- **Percentiles are estimates.** A percentile is found by walking the buckets to the one holding it and
  interpolating linearly inside that bucket, so it reads "about 0.8 s". A percentile that falls in the
  open last bucket reads "over 30 s", never a made-up number. The tab says this in a line under its
  heading.
- **Every timing has a chart** in the dashboard's own sense ([Telemetry](telemetry.md) "Every event has a
  chart"): each metric is a `Timing·Measured` metric whose `typeIn` takes that metric's buckets, so the
  emitter coverage tests see every bucket counted, and Search finds each bucket on its own.

## Privacy

Unchanged by timings: three fields, a closed vocabulary, no id, no content. A bucket says "this page
opened in under a second somewhere", never which page instance, which document or whose browser. The
per-user opt-out ([User preferences](../007-editor/user-preferences.md)) and the server
`TELEMETRY_ENABLED` gate stop timings exactly as they stop every other event.

## Next ideas

Not built yet; each fits the same `Timing·Measured` event with a new metric on an existing scale.

- **Explorer first load**: opening the Explorer to its first list rendered (Home, Recent).
- **Time to first edit**: finishing the `/new` wizard to the first element placed, the clearest
  "how quickly does someone get going" number.
- **Export**: PNG, SVG and PDF export, from the click to the file handed over, typed by format.
- **AI Ask answer**: asking the AI panel to the first token of its answer.
- **Sign-in round trip**: submitting the sign-in or sign-up code to the editor signed in.
- **Image upload**: dropping an image to it showing on the canvas from the server.
- **Server-side api latency**: the api worker timing its own document reads and writes, reported with
  `reportServerEvent`, to separate a slow network from a slow worker.
