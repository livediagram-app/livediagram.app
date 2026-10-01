# Stale builds

A tab keeps running the editor build it loaded. Every deploy renames the editor's code chunks
(their names are content hashes) and the old files are gone, so a tab from an earlier build that
navigates within the app asks for chunks that no longer exist. Without care, that navigation ends
on the framework's crash page ("This page couldn't load"), as going back from a whiteboard to the
Explorer did after a deploy.

Two layers handle it: the app **learns when a newer build is live** and stops navigating in-app
until reloaded, and a **safety net** turns any chunk that still fails to load into a full page
load of where the user was going.

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
- **Loop guard:** at most one such reload per destination within `STALE_CHUNK_RELOAD_WINDOW_MS`,
  remembered in `sessionStorage`. A second failure inside the window shows the normal error, so a
  genuinely broken deploy can never reload forever.
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
