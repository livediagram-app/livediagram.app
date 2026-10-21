# Stale builds

A tab keeps running the editor build it loaded. Every deploy renames the editor's code chunks
(their names are content hashes) and the old files are gone, so a tab from an earlier build that
navigates within the app asks for chunks that no longer exist. Without care, that navigation ends
on the framework's crash page ("This page couldn't load"), as going back from a whiteboard to the
Explorer did after a deploy.

Two layers handle it: the app **learns when a newer build is live** and stops navigating in-app
until reloaded, and a **safety net** turns any chunk that still fails to load into a full page
load of where the user was going.

A third failure comes before any of that code runs: the browser itself brings back an **old page**.
Pressing back or forward is a history traversal, and browsers deliberately reuse a cached page for
it even when that copy is stale (`max-age=0, must-revalidate` does not stop them; only `no-store`
does). The earlier build's HTML names chunk files the deploy removed, so the page dies (a white
screen, styles refused as `text/html`) before React starts. Three more layers handle that:
**caching rules** that never let a page be served stale, **immutable assets** with an honest 404, and
a **pre-boot guard** in the page's head for whatever stale HTML still slips through.

## Caching rules

One policy, applied by the router to every response it passes on, so all five sites (marketing,
editor, help, telemetry, community) follow it from one place; the api's own responses are left as the api
sets them.

| Response                                                       | `Cache-Control`                       |
| -------------------------------------------------------------- | ------------------------------------- |
| An HTML document (`Content-Type: text/html`)                   | `no-store`                            |
| A hashed build asset (a path containing `/_next/static/`), 2xx | `public, max-age=31536000, immutable` |
| A hashed build asset that is missing                           | `no-store`, and the body below        |
| Anything else (icons, fonts at fixed names, the api)           | unchanged                             |

- **Local development keeps the dev servers' own asset caching.** Under `wrangler dev --env local`
  (`DEPLOY_ENV = "local"`) the router fronts `next dev`, whose `/_next/static/` chunks keep their
  names while their content changes with every edit, and which marks them
  `no-cache, must-revalidate` for that reason. Marking them immutable there would make every reload
  run the code from before the edit until the browser cache was cleared, so locally a `2xx` build
  asset passes with the dev server's own `Cache-Control`. Pages and missing assets follow the table
  as everywhere else. The e2e stack serves production builds, so it keeps immutable assets.
- **A missing asset is an honest 404:** status 404, `Content-Type: text/plain`, body `Not found`,
  never the site's HTML 404 page, so a browser never tries a page as a script or a stylesheet.
- **Why `no-store`, and what it costs.** It is the only directive that keeps an HTML page out of
  the history-traversal cache. The cost is the back/forward cache (bfcache), which restores a whole
  live page instantly:
  - **Chrome** has, since the spring of 2025, kept `no-store` pages in bfcache when that is safe:
    it evicts them on a cookie change (signing in or out, Clerk's session refresh), on a `no-store`
    fetch response, and after three minutes instead of ten. So a Chrome user mostly keeps bfcache.
  - **Firefox and Safari** may still refuse bfcache for a `no-store` page; there, back reloads the
    page from the network (a fresh, current page).
  - The trade is deliberate: a slower back in some browsers against a white screen after every
    deploy in all of them. Immutable assets make that reload cheap (only the HTML travels).
- **Immutable assets** never revalidate: their names change whenever their content does, so every
  repeat visit loads them from the browser's cache.

## The pre-boot guard

A small inline script, the first script the editor's layout puts in its `<head>`, for stale HTML
that still slips through (a bfcache restore, a proxy that ignores `no-store`). The framework hoists
its own stylesheet and async chunk tags above every inline script, so a build asset can fail before
the guard runs; it therefore both listens and, once the document is parsed, looks back:

- **A build asset that fails to load:** a capture-phase `error` listener on the window sees a
  `<script>` or `<link rel="stylesheet">` under `/_next/static/` fail; at `DOMContentLoaded` it
  also checks for one that failed before it ran (a stylesheet left without its sheet, a resource
  timing entry with a 4xx or 5xx status). Either way: one reload of the current URL.
- **A page restored from bfcache** (`pageshow` with `persisted`): it asks the api once (a single
  request, `cache: 'no-store'`) for the live build id from the server release signal; when that
  differs from the page's own `livediagram-build`, one reload.
- **One reload guard** (below): its reload claims the shared allowance; a second failure inside the
  window leaves the page as it is.
- **It stands down once the app runs:** when the editor's own chunk recovery is installed, failures
  are left to it, because the app waits for unsaved work before it reloads and this script cannot.
- It logs `[stale-html]` with the reason as a warning (`console.warn`): an inline script cannot reach `debugLog`, and a stale page is something gone wrong; it sends no telemetry (it runs before telemetry exists).
- **Content Security Policy:** none is sent today. When one is, this script is allowed by its
  hash, never by `unsafe-inline`.

## One reload guard

Every reload the editor starts on its own after a deploy, the pre-boot guard's and the chunk
recovery's alike, claims one shared allowance: **one reload per page** (path and query, the hash
ignored) **within `RELOAD_GUARD_WINDOW_MS`** (one minute), remembered in `sessionStorage`.
Whichever path fires first takes it, so a failure that persists is reloaded exactly once, then
shown. One module defines the rule and the claim; the pre-boot guard embeds that same claim, so the
two paths cannot drift apart. Storage that cannot be read refuses the reload.

## Knowing which build is live

- **The build id** is the commit the deploy built (the build job's checkout), baked into the editor's static export as
  `NEXT_PUBLIC_BUILD_ID` (and exposed in every page as `<meta name="livediagram-build">`) and given to the api worker as `BUILD_ID`, in the same deploy run. A build
  without one (local development, a self-host that sets neither) disables this layer; the safety
  net still works.
- **The running app learns the live one** from the server release signal it already hears for the
  document format number ([New version prompt](./new-version-prompt.md)): every api response
  carries `X-Livediagram-Build: <id>` beside `X-Livediagram-Format`, and the realtime room's
  `format` message carries `build`. No request is made for it and nothing polls.
- **Stale** means both ids are known and differ. One mechanism, two responses: a newer document
  format offers a reload (the prompt); a newer build changes how the app navigates (below), and
  shows nothing.
- An id is a short token (letters, digits, `.`, `_`, `-`, at most 64 characters); anything else is
  ignored.

## Navigating while stale

Once the app knows it is stale, its next in-app navigation is a **full page load** of the
destination instead of a client transition, so the new build is fetched and no old chunk name is
ever requested:

- a click on an in-app link (left button, no modifier keys, same origin, no `target`, no
  `download`);
- back and forward (the address bar already shows the destination, which is loaded);
- the app's own programmatic navigations (`navigateTo`, used where the app calls the router).

Leaving the editor this way first waits for its unsaved changes to be saved, as the reload prompt
does: at most `RELOAD_SAVE_WAIT_MS`, checking locally. If they are still unsaved then, the
navigation is a client transition as before (the safety net remains), so unsaved work is never
thrown away.

## The safety net

When a chunk fails to load during navigation or rendering (`ChunkLoadError`, or the equivalent
"failed to load / import" error a browser raises for a missing module), wherever it surfaces: an
uncaught error or rejection, an area error boundary, or the app's root error boundary:

- **Recover:** after unsaved editor changes are saved (as above), the app does a full page load of
  the destination: the URL being navigated to when that is known (a back or forward, a link or a
  programmatic navigation in the last `NAVIGATION_INTENT_MS`), otherwise the current URL.
- **Not while offline:** a chunk that fails while the browser says it is offline is the connection,
  not an earlier build. The recovery stands down (no reload, no claim) and the normal error shows;
  the same failure reported once back online still recovers ([Load recovery](../007-editor/load-recovery.md) "Offline").
- **One reload guard** (below): the recovery claims the shared allowance. A second failure inside
  the window shows the normal error, so a genuinely broken deploy can never reload forever.
- **The root error boundary** (the editor app's `global-error.tsx`) is the app's own: it runs the recovery, and
  when the guard stops it, shows a calm page ("This page couldn't load. Reload to try again.")
  with a Reload button, in the app's look, light and dark.

## Telemetry

- The failure keeps its event, as today: `Error·Client·Uncaught.<Page>.ChunkLoadError` or
  `Error·Client·Render.<Area>.ChunkLoadError`.
- A recovery adds `Error·Client·StaleChunkReload` (the failure's own event names the page): a recovery, charted beside realtime
  resyncs, not counted as an exception.

## Deploy window and failure modes

- The api and the editor deploy in parallel. In the seconds between, ids differ and navigations are
  full page loads; harmless.
- If one of the two deploys fails, every navigation stays a full page load until they match again:
  slower, never broken.
