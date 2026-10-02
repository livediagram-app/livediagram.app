# Stale builds blueprint

Derived from [Stale builds](../stale-builds.md).

## Domain and naming

| Term              | Identifier                              | Meaning                                                        |
| ----------------- | --------------------------------------- | -------------------------------------------------------------- |
| Build id          | `NEXT_PUBLIC_BUILD_ID`, `BUILD_ID`      | The deploy's commit, in the editor build and the api worker    |
| Build header      | `BUILD_ID_HEADER`                       | `X-Livediagram-Build`, on every api response beside the format |
| Editor build      | `EDITOR_BUILD_ID`                       | The id this page was built with                                |
| Server build      | `serverBuild()`                         | The latest id the server release signal carried                |
| Stale             | `runningStaleBuild()`                   | Both known and different                                       |
| Navigation intent | `navigationIntents`                     | Where the app was last asked to go, and when                   |
| Chunk failure     | `isChunkLoadError`                      | A code chunk or module that could not be fetched               |
| Recovery          | `recoverFromChunkError`                 | A full page load of the destination, guarded                   |
| Unsaved work      | `registerUnsavedWork`, `hasUnsavedWork` | What a full page load the app starts waits for                 |

## Modules

| File                                                    | Responsibility                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `packages/api-schema/src/build-id.ts`                   | `BUILD_ID_HEADER`, `parseBuildId`                                                |
| `packages/api-schema/src/room-messages.ts`              | `FormatMessage.build?`                                                           |
| `apps/api/src/server-release-header.ts`                 | `withServerRelease(response, env.BUILD_ID)`                                      |
| `apps/api/src/document-room.ts`                         | The room's `format` message carries `build`                                      |
| `.github/workflows/deploy-reusable.yml`                 | One commit id to `NEXT_PUBLIC_BUILD_ID` and the api's `BUILD_ID`                 |
| `apps/live/lib/server-release.ts`                       | The server release store: format and build, `runningStaleBuild`                  |
| `apps/live/lib/stale-chunks.ts`                         | Pure core: detection, loop guard, intents, recovery                              |
| `apps/live/lib/stale-build-navigation.ts`               | Browser wiring: clicks, back and forward, chunk failures, `navigateTo`           |
| `apps/live/lib/unsaved-work.ts`                         | The unsaved work registry                                                        |
| `apps/live/components/providers/StaleBuildBoot.tsx`     | Installs the wiring from the root layout, hands over the router                  |
| `apps/live/hooks/navigation/useAppNavigation.ts`        | `push` / `replace` for the app's programmatic navigations                        |
| `apps/live/components/primitives/AreaErrorBoundary.tsx` | Recovers a chunk failure an area caught                                          |
| `apps/live/app/global-error.tsx`                        | The root error boundary: recovers, else a calm page                              |
| `apps/live/app/document/[id]/EditorView.tsx`            | Registers the autosave's `hasUnsavedChanges`                                     |
| `apps/telemetry/app/catalogue/health.ts`                | The Stale Build Reloads card                                                     |
| `apps/router/src/cache-policy.ts`                       | The caching rules: `cacheRule`, `applyCachePolicy`, `isBuildAsset`               |
| `apps/router/src/index.ts`                              | Applies the caching rules to every site's response (the api's excepted)          |
| `apps/live/lib/stale-html-guard.ts`                     | `STALE_HTML_GUARD_SCRIPT`: the pre-boot guard, first script in the layout's head |
| `apps/live/lib/api/base.ts`                             | `API_BASE`, browser-free, for the guard                                          |
| `scripts/e2e-stack.mjs`                                 | Production's caching, the router's rules, and the deploy simulation              |

## Interfaces and contracts

```ts
// packages/api-schema/src/build-id.ts
export const BUILD_ID_HEADER = 'X-Livediagram-Build';
export function parseBuildId(value: unknown): string | null; // /^[A-Za-z0-9._-]{1,64}$/

// apps/live/lib/server-release.ts (beside the format number)
export const EDITOR_BUILD_ID: string | null;
export function noteServerBuild(value: unknown): void; // notifies on change
export function serverBuild(): string | null;
export function isStaleBuild(editor: string | null, server: string | null): boolean;
export function runningStaleBuild(): boolean;
export function subscribeServerRelease(listener: () => void): () => void;

// apps/live/lib/stale-chunks.ts
export const STALE_CHUNK_RELOAD_WINDOW_MS = 60_000;
export const NAVIGATION_INTENT_MS = 10_000;
export function isChunkLoadError(error: unknown): boolean;
export function claimChunkReload(destination: string, storage: Storage, now: number): boolean;
export function createNavigationIntents(): {
  note(url: string, now: number): void;
  destination(now: number, currentUrl: string): string;
  clear(): void;
};
export type ChunkRecovery =
  'reloading' | 'gave-up' | 'unsaved' | 'not-a-chunk-error' | 'already-recovering';
export function recoverFromChunkError(
  error: unknown,
  deps: ChunkRecoveryDeps,
): Promise<ChunkRecovery>;

// apps/live/lib/stale-build-navigation.ts
export function browserNavigationDeps(): NavigationDeps;
export function installStaleBuildNavigation(deps: NavigationDeps): () => void;
export function navigateTo(url: string, replace: boolean, deps: NavigationDeps): Promise<void>;
export function recoverInBrowser(error: unknown, deps: NavigationDeps): Promise<ChunkRecovery>;
export function fullPageLoad(
  url: string,
  replace: boolean,
  deps: NavigationDeps,
): Promise<'reloaded' | 'unsaved'>;
export function setClientNavigator(
  navigate: ((url: string, replace: boolean) => void) | null,
): void;
```

- `isChunkLoadError`: an `Error` named `ChunkLoadError`, or whose message matches webpack's
  "Loading (CSS) chunk … failed", Turbopack's "Failed to load chunk", Chrome's "Failed to fetch
  dynamically imported module", Safari's "Importing a module script failed" or Firefox's "error
  loading dynamically imported module".
- `claimChunkReload`: a `sessionStorage` map `livediagram:stale-chunk-reloads` of destination to
  time; true (and recorded) when the destination has no entry inside the window; entries older than
  the window are pruned on write; junk restarts the map; a storage that throws refuses.

## Behaviour and state

- **Install order:** `StaleBuildBoot`'s effect installs the listeners before the client router's
  `Router` effect registers its `popstate` listener (child effects run first).
- **Click** (capture phase on `window`): a plain left click on an in-app `a[href]` without
  `target`/`download` notes the intent; while stale and not a same-page hash link,
  `preventDefault` + `stopPropagation` (the app's link handler never runs), then `fullPageLoad`;
  `unsaved` falls back to the client navigator.
- **Back and forward:** notes the intent (the new location); while stale,
  `stopImmediatePropagation`, then `fullPageLoad(location, replace)`; `unsaved` re-dispatches the
  `popstate` (skipped by this listener) for the router.
- **Programmatic:** `useAppNavigation` → `navigateTo`: notes the intent; while stale, full load,
  else (or `unsaved`) the router.
- **Chunk failure** (window `error` / `unhandledrejection`, `AreaErrorBoundary.componentDidCatch`,
  `global-error.tsx`): `recoverInBrowser` → `recoverFromChunkError`: once per error object; claims
  the destination (intent within `NAVIGATION_INTENT_MS`, else the current URL); unclaimed → `gave-up`
  (the error shows); claimed → `reloadWhenSaved`, then `track('Error', 'Client',
'StaleChunkReload')` and `location.assign(destination)`.

- **Caching rules** (router, every response but the api's and a 101): `cacheRule(pathname, status,
contentType)`: a build asset (`^(/[a-z-]+)?/_next/static/`) with 2xx or 304 is `immutable`, with
  404 `missing-asset` (replaced by `Not found`, `text/plain`, `no-store`, `nosniff`), else
  unchanged; any other `text/html` response `no-store`; the rest unchanged.
- **Pre-boot guard** (`STALE_HTML_GUARD_SCRIPT`, inline, first script of the layout's head; the
  framework's hoisted stylesheet and async chunk tags precede it): a capture-phase window `error`
  on a `SCRIPT` / `LINK` under `/_next/static/` → `reloadOnce`; at `DOMContentLoaded`, a
  `link[rel="stylesheet"]` under it without a `sheet`, or a resource timing entry under it with
  `responseStatus >= 400` → `reloadOnce`; `pageshow` with `persisted` and a `livediagram-build`
  meta → one `fetch(API_BASE + '/capabilities', { cache: 'no-store' })`, and a different
  `X-Livediagram-Build` → `reloadOnce`. `reloadOnce`: once per page (later failures of the same
  doomed page are ignored); once per `pathname + search` within `STALE_HTML_RELOAD_WINDOW_MS` in
  `sessionStorage` key `livediagram:stale-html-reloads`; storage that throws refuses; then
  `location.reload()`.

## Presentation and UX

- Nothing shows for a stale build or a recovery: the page simply loads.
- `global-error.tsx`: centred "This page couldn't load" heading, "Reload to try again." and a
  primary Reload button, on the app's background, light and dark.

## Accessibility

- The error page is a `main` with a heading and a real button; keyboard reachable; the app's
  contrast in both themes.

## Web experience

- A full page load replaces a client transition only while stale (after a deploy), never otherwise;
  no request is added (the build id rides existing api responses), so no LCP, INP or CLS cost.

## Errors and edge cases

| Case                                           | Handling                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| No build id on either side                     | Never stale; the safety net still works                              |
| Deploy window, or one deploy failed            | Full page loads until the ids match; slower, never broken            |
| Second chunk failure for a destination         | The normal error (area panel, or the calm root page)                 |
| Same failure seen by a boundary and the window | Recovered once                                                       |
| Unsaved editor work that will not settle       | No full load; client transition (navigation) or the error (recovery) |
| sessionStorage blocked                         | Recovery refused: the error shows, no loop                           |
| Modified click, new tab, download, off-site    | Untouched                                                            |

## Security and trust

The build id grants nothing; a forged value can only make navigations full page loads.

## Observability

- `console.info('[stale-html] <reason>; reloading', detail)` and
  `console.warn('[stale-html] already reloaded this page; leaving it', detail)` from the guard.
- `console.info('[stale-build] newer build live; loaded in full', { url })`.
- `console.info('[stale-chunks] a chunk from an earlier build is gone; loading the page in full', { destination })`.
- `console.warn('[stale-chunks] already reloaded for this page, showing the error', { destination })`.
- `console.error('[global-error] the page failed', error)`.
- Telemetry: the failure's `Uncaught.<Page>.ChunkLoadError` / `Render.<Area>.ChunkLoadError` stays;
  `StaleChunkReload` counts recoveries (a recovery type, its own dashboard card).

## Testing

| Rule                                                                              | Test                                                                    |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Build id parsing                                                                  | `packages/api-schema/src/build-id.test.ts`                              |
| Build header on responses, CORS                                                   | `apps/api/src/server-release-header.test.ts`                            |
| Room format message carries the build                                             | `apps/api/src/document-room.test.ts`                                    |
| Store: build kept, stale only when both known and differ                          | `apps/live/lib/server-release.test.ts`                                  |
| `apiFetch` and the room client note the build                                     | `apps/live/lib/api/core.test.ts`, `apps/live/lib/api/room.test.ts`      |
| Detection, loop guard, intents, recovery, unsaved                                 | `apps/live/lib/stale-chunks.test.ts`                                    |
| Links, back and forward, programmatic, window failures                            | `apps/live/lib/stale-build-navigation.test.ts`                          |
| Unsaved work registry                                                             | `apps/live/lib/unsaved-work.test.ts`                                    |
| Root error page recovers and shows the calm page                                  | `apps/live/app/global-error.test.tsx`                                   |
| Recovery is a recovery, not an exception                                          | `apps/telemetry/app/ranking-rules.test.ts`                              |
| A stale build in the browser (Playwright)                                         | `apps/live/e2e/stale-builds.spec.ts`                                    |
| Caching rules: pages, build assets, missing assets, the api untouched             | `apps/router/src/cache-policy.test.ts`, `apps/router/src/index.test.ts` |
| Pre-boot guard: failed assets, look-back at DOMContentLoaded, bfcache, loop guard | `apps/live/lib/stale-html-guard.test.ts`                                |
| Back after a deploy, real browser cache (Playwright)                              | `apps/live/e2e/stale-html.spec.ts`                                      |

## Constants and configuration

| Constant                       | Value                                 | Provenance                                                            | Safe range        |
| ------------------------------ | ------------------------------------- | --------------------------------------------------------------------- | ----------------- |
| `STALE_CHUNK_RELOAD_WINDOW_MS` | 60,000                                | Long enough to catch a reload loop, short enough to retry after a fix | 10,000 to 600,000 |
| `NAVIGATION_INTENT_MS`         | 10,000                                | A navigation's chunks load within seconds                             | 2,000 to 30,000   |
| `STALE_HTML_RELOAD_WINDOW_MS`  | 60,000                                | As the chunk recovery's window                                        | 10,000 to 600,000 |
| `IMMUTABLE_CACHE_CONTROL`      | `public, max-age=31536000, immutable` | A year: the longest a cache keeps anything; names change with content | fixed             |
| `HTML_CACHE_CONTROL`           | `no-store`                            | The only directive history traversal honours                          | fixed             |
| `RELOAD_SAVE_WAIT_MS`          | 10,000                                | Shared with the new version prompt                                    | as there          |

## Defaults ledger

See [DEFAULTS.md](./DEFAULTS.md), rows D4 to D6.
