# Web performance

What every site on livediagram.app loads up front, and the rules that keep it lean. The canvas's own
hot paths (drag, pan, zoom on large boards) are a separate subject:
[Canvas performance](../008-canvas/canvas-performance.md).

## Measuring

The number that matters for a page is its **first-load JavaScript**: the gzipped size of every
script its static-export HTML references. It is measured from a production build (`next build` in
the app), summing the `<script src=".../_next/static/...js">` files a page's HTML names. A change
that could grow it is measured against `main` the same way before it ships.

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
- `apps/live/app/first-load-lazy.test.ts` fails if any of these become static imports again.

### A surface that is not on screen loads when it is

A dialog, panel or view that renders only behind an open flag or a tab is loaded with
`next/dynamic` (`ssr: false`), the way the editor's Dashboard page and Sheets host already are.
The Explorer's Settings and move picker, and every telemetry dashboard view but the first, load
this way. Where switching to one must stay instant, its code is fetched once the page is idle
(the telemetry dashboard).

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

## The api

- A query that serves one person starts from that person's rows (their visible documents, their
  candidates) and seeks everything else by index. A query led by a table-wide index (all open
  threads, every document in id order, every document-scoped event) slows as the database grows,
  not as the person's work does. `apps/api/src/db/home-plans.test.ts` pins the plans of the Home and
  Inbox reads against the real migrations.
- Cells named by key are matched as `(row_id, col_id)` pairs, so the primary key seeks each one
  (`apps/api/src/db/sheets-plans.test.ts`).
- A public, identity-free read that every visitor makes (the Community's featured posts and facets)
  is answered from the edge cache for its stated lifetime (`apps/api/src/edge-cache.ts`).
- A check that needs only a document's owner and team reads that row, not the full document.
- A realtime room reads a socket's fixed session facts once, not on every frame.
