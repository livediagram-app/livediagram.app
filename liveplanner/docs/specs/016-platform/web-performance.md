# Web performance

What every site on liveplanner.app loads up front, and the rules that keep it lean. The canvas's own
hot paths (drag, pan, zoom on large boards) are a separate subject:
[Canvas performance](../008-canvas/canvas-performance.md).

## Measuring

The number that matters for a page is its **first-load JavaScript**: the gzipped size of every
script its static-export HTML references. It is measured from a production build (`next build` in
the app), summing the `<script src=".../_next/static/...js">` files a page's HTML names. A change
that could grow it is measured against `main` the same way before it ships.

Why a page carries what it does is read from the Turbopack bundle analyzer (`next analyze`): its route
summary, its table of the largest contributors, and its diff against an earlier snapshot.

Measured 2026-10-11 (gzip level 9), before and after the changes that set these rules:

| Page                                         | Before    | After     |
| -------------------------------------------- | --------- | --------- |
| Editor: `/sign-in`, `/get-started`           | 1,546 KiB | 362 KiB   |
| Editor: `/explorer/home` (and most sections) | 1,780 KiB | 570 KiB   |
| Editor: `/new`                               | 1,877 KiB | 669 KiB   |
| Editor: `/join`, `/oauth/*`                  | ~1,500    | 316–354   |
| Editor: `/project/<id>`                      | 1,493 KiB | 1,489 KiB |
| Help: an article                             | 238 KiB   | 207 KiB   |
| Telemetry: the dashboard                     | 287 KiB   | 280 KiB   |
| Marketing: `/` (HTML, gzipped)               | 114 KiB   | 93 KiB    |

Then the project page's own first load (measured 2026-10-11 the same way, on top of the above):

| Page                          | Before    | After     |
| ----------------------------- | --------- | --------- |
| Editor: `/project/<id>`       | 1,489 KiB | 1,240 KiB |
| Marketing: a `/features` page | 221 KiB   | 207 KiB   |

## Rules

### Nothing heavy in what every route ships

The editor app's root layout, its providers and its root `not-found.tsx` ship with **every route**.
Next renders the root not-found slot inside the layout, so its code is part of every page.

- `app/not-found.tsx` renders the editor (that is how a real `/project/<id>` URL reaches it in the
  static export; [New project route](../007-editor/new-project-route.md)), and loads it with
  `next/dynamic`, never a static import. A project URL already has the editor from
  `/project/placeholder`'s own import, so it pays nothing extra; the opening screen covers the one
  tick the import takes.
- `apps/editor/app/first-load-lazy.test.ts` fails if any of these become static imports again.

### A surface that is not on screen loads when it is

A dialog, panel or view that renders only behind an open flag or a tab is loaded with
`next/dynamic` (`ssr: false`), the way the editor's Dashboard page and Sheets host already are.
The Explorer's Settings and move picker, and every telemetry dashboard view but the first, load
this way. Where switching to one must stay instant, its code is fetched once the page is idle
(the telemetry dashboard).

### The project page loads what a board may not need on demand

`apps/editor/lib/editor-deferred-code.ts` names every module the editor loads on demand, so a surface's
`next/dynamic` and the prefetch below share one import:

- **Content a board may draw on open**: the Draw dock, tables
  and facilitation panels. Fetched as the editor mounts (`prefetchWhenIdle`), alongside the project
  request, so a board that has one finds its code already in, while the first load does not carry it.
- **Surfaces someone opens**: the Explorer popover (mounted from its first opening on, then kept, so its
  state survives), search and session settings. Fetched once the opened project has rendered and the page is
  idle. Only what Plan can open is prefetched: the Layers panel, the quick style panel and the Format tool's
  panel were dropped from the list in October 2026 (about 60 KB of JavaScript, 22 KB gzipped, no longer
  fetched on every editor open), and their code went with them.
- **At the press**: a template's canvas overrides load with its builders when one is applied.
- **What waits for on-demand code.** Starting a deck waits for the presentation overlay's code (with
  the deck's unvisited tabs), and the overlay draws in the first slide's commit, so the deck's keys
  listen from its first frame.
- A panel whose code cannot load (offline behind the load-error card) draws nothing rather than
  throwing into the screen around it.
- `apps/editor/app/project/[id]/project-lazy-load.test.ts` fails if any of these become static
  imports again.

### A page loads only the scene it shows

A features page plays one hero scene; the scene catalogue keeps its data apart from the boards
(`hero-scene-data.ts`), so the page loads that scene's board alone.

### Rendering server-side is not free in a static export

Next writes a server component's output into the page's RSC payload as well as its HTML, so moving
content from a client component to a server one moves its bytes from the JavaScript into the HTML
rather than removing them. Measured on the FAQ: 9 KiB less JavaScript, 15 KiB more HTML. Such a move
is made only where it measurably wins.

### A catalogue a page only searches loads when the search does

The help centre's search runs over the whole article registry; the box loads it on the reader's
first focus, hover or keystroke, not with every page. Code that only builds links imports the
registry's data-free helpers (`@liveworkspace/help-registry/hrefs`), and a help page's telemetry id
is worked out from its path, never by finding the article.

### Nothing cross-origin holds up first paint

The editor's Google Fonts stylesheet is linked `media="print"` and switched to `all` once loaded
([Fonts](../004-interface-design/fonts.md) "Loading"), so it never blocks render. Text paints in
the fallback face until the faces land, and the canvas re-measures each time they do
(`useFontEpoch`).

### Markup nobody can see is not drawn yet

- The home page hero draws a window's board only once the stage is at or next to it, or slides
  past it ([Marketing site](../019-marketing/marketing-site.md) "Hero").
- The features pages' looping illustrations sit in frames with `content-visibility: auto`, so the
  browser skips rendering and animating the ones off screen. Each frame's size is fixed, so this
  never moves layout.

### Layout never shifts after first paint

Content is in its final structure in the static HTML. The help centre groups an article's
sections while rendering, never by rewriting the DOM after hydration, and the reading-time row
holds its height before the time is counted.

A slow device paints a page while it is still parsing it, so a layout never depends on markup
further down the project: the help article's sidebar column is a grid track, there before the
sidebar is, where a flex row let the article take the full width until the sidebar was parsed
(a 0.24 layout shift at 6× CPU throttling).

### The first images a visitor sees load first

A gallery's first row loads its images eagerly with
`fetchpriority="high"`; every other card's image is lazy.

### Ask once

A request whose answer is the same for the whole page load (the api's `/capabilities`) is made once
and shared; a failed answer is not kept, so the next caller asks again.

### Work only when it can change what shows

A timer that re-renders a large tree (the editor's presence clock) skips its tick while the page
is hidden, catching up when it returns, and while it has nothing to update (nobody else has been
seen on the project).

### Per keystroke, the least work

- The Explorer's rows narrow a beat behind the lens field (a deferred value), its shared list is
  filtered through a set (it was quadratic), and the address bar follows the field at most every
  250 ms ([Explorer filters](../013-workspace/explorer-filters.md) "URL and carry-over").
- The rich-text editor keeps its toolbar state object while nothing in it changed, so a keystroke
  renders the editor once.
- The autosave compares a tab's metadata key by key, identity first, never the whole tab serialised.
- Requests several surfaces make at once (a team's library) share one in-flight request.

## The api

- A query that serves one person starts from that person's rows (their visible projects, their
  candidates) and seeks everything else by index. A query led by a table-wide index (all open
  threads, every project in id order, every project-scoped event) slows as the database grows,
  not as the person's work does. (The Home and Inbox reads this rule was written for moved to liveworkspace's index.)
- Cells named by key are matched as `(row_id, col_id)` pairs, so the primary key seeks each one
  (`apps/api/src/db/sheets-plans.test.ts`).
- A check that needs only a project's owner and team reads that row, not the full project.
- A realtime room reads a socket's fixed session facts once, not on every frame.
- The tab save reads its project in one query and fetches the room's ledger alongside its other
  reads ([API](../015-api/api.md) "Tab save").
