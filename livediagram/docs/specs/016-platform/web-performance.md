# Web performance

What every site on livediagram.app loads up front, and the rules that keep it lean. The canvas's own
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
| Editor: `/join`, `/drive/*`, `/oauth/*`      | ~1,500    | 316–354   |
| Editor: `/document/<id>`                     | 1,493 KiB | 1,489 KiB |
| Help: an article                             | 238 KiB   | 207 KiB   |
| Telemetry: the dashboard                     | 287 KiB   | 280 KiB   |
| Marketing: `/` (HTML, gzipped)               | 114 KiB   | 93 KiB    |

Then the document page's own first load (measured 2026-10-11 the same way, on top of the above):

| Page                          | Before    | After     |
| ----------------------------- | --------- | --------- |
| Editor: `/document/<id>`      | 1,489 KiB | 1,240 KiB |
| Marketing: a `/features` page | 221 KiB   | 207 KiB   |

## Rules

### Nothing heavy in what every route ships

The editor app's root layout, its providers and its root `not-found.tsx` ship with **every route**.
Next renders the root not-found slot inside the layout, so its code is part of every page.

- `app/not-found.tsx` renders the editor (that is how a real `/document/<id>` URL reaches it in the
  static export; [New document route](../007-editor/new-document-route.md)), and loads it with
  `next/dynamic`, never a static import. A document URL already has the editor from
  `/document/placeholder`'s own import, so it pays nothing extra; the opening screen covers the one
  tick the import takes.
- The Google Drive mirror's engine loads only in the one tab elected to run it
  ([Drive mirror](../022-drive-mirror/drive-mirror.md)); every other tab, and every person without
  Drive, never downloads it. The token source every signed-in tab needs lives apart from it
  (`lib/drive/browser-tokens.ts`).
- `apps/editor/app/first-load-lazy.test.ts` fails if any of these become static imports again.

### A surface that is not on screen loads when it is

A dialog, panel or view that renders only behind an open flag or a tab is loaded with
`next/dynamic` (`ssr: false`), the way the Explorer's Settings and move picker, and every telemetry dashboard view but the first, load
this way. Where switching to one must stay instant, its code is fetched once the page is idle
(the telemetry dashboard).

### The document page loads what a board may not need on demand

`apps/editor/lib/editor-deferred-code.ts` names every module the editor loads on demand, so a surface's
`next/dynamic` and the prefetch below share one import:

- **Content a board may draw on open**: the Draw dock, tables
  and facilitation panels. Fetched as the editor mounts (`prefetchWhenIdle`), alongside the document
  request, so a board that has one finds its code already in, while the first load does not carry it.
- **Surfaces someone opens**: the Explorer and Layers popovers (mounted from their first opening on,
  then kept, so their state survives), search, the quick style panel, the tool panels, presenting and
  session settings. Fetched once the opened document has rendered and the page is idle.
- **At the press**: the photo import's detection pipeline (and the sticky detector in it) loads when a
  photo is picked; a template's canvas overrides load with its builders when one is applied.
- **What waits for on-demand code.** Starting a deck waits for the presentation overlay's code (with
  the deck's unvisited tabs), and the overlay draws in the first slide's commit, so the deck's keys
  listen from its first frame. The top corners give way to a top Draw dock from the commit the dock is
  first drawn in, measured then rather than before it is on the page.
- A panel whose code cannot load (offline behind the load-error card) draws nothing rather than
  throwing into the screen around it.
- `apps/editor/app/document/[id]/document-lazy-load.test.ts` fails if any of these become static
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
registry's data-free helpers (`@livediagram/help-registry/hrefs`), and a help page's telemetry id
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
further down the document: the help article's sidebar column is a grid track, there before the
sidebar is, where a flex row let the article take the full width until the sidebar was parsed
(a 0.24 layout shift at 6× CPU throttling).

### The first images a visitor sees load first

A gallery's first row (the Community gallery's first four cards) loads its images eagerly with
`fetchpriority="high"`; every other card's image is lazy.

### Ask once

A request whose answer is the same for the whole page load (the api's `/capabilities`) is made once
and shared; a failed answer is not kept, so the next caller asks again.

### Work only when it can change what shows

A timer that re-renders a large tree (the editor's presence clock) skips its tick while the page
is hidden, catching up when it returns, and while it has nothing to update (nobody else has been
seen on the document).

### Per keystroke, the least work

- The Explorer's rows narrow a beat behind the lens field (a deferred value), its shared list is
  filtered through a set (it was quadratic), and the address bar follows the field at most every
  250 ms ([Explorer filters](../013-workspace/explorer-filters.md) "URL and carry-over").
- The rich-text editor keeps its toolbar state object while nothing in it changed, so a keystroke
  renders the editor once.
- The autosave compares a tab's metadata key by key, identity first, never the whole tab serialised.
- Requests several surfaces make at once (a team's library) share one in-flight request.

## The api

- A query that serves one person starts from that person's rows (their visible documents, their
  candidates) and seeks everything else by index. A query led by a table-wide index (all open
  threads, every document in id order, every document-scoped event) slows as the database grows,
  not as the person's work does. `apps/api/src/db/home-plans.test.ts` pins the plans of the Home and
  Inbox reads against the real migrations.
- A public, identity-free read that every visitor makes (the Community's featured posts and facets)
  is answered from the edge cache for its stated lifetime (liveworkspace/apps/community/src/http.ts).
- A check that needs only a document's owner and team reads that row, not the full document.
- A realtime room reads a socket's fixed session facts once, not on every frame.
- The tab save reads its document in one query and fetches the room's ledger alongside its other
  reads ([API](../015-api/api.md) "Tab save"); the timeline's event and its scopes are one batch; the
  guest-to-account migration moves its rows in one batch.
