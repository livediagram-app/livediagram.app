# Load recovery blueprint

Derived from [Load recovery](../load-recovery.md). Implementation detail only; the spec owns every
design decision.

## Domain and naming

| Term                      | Identifier                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------- |
| The load                  | `useIdentityBootstrap`'s `load` (`apps/live/app/document/[id]/`)                       |
| A load step               | `LoadStep` (`apps/live/lib/load-progress.ts`)                                          |
| The watchdog              | `armLoadWatchdog(onTimedOut, deps)` → `{ finish }`                                     |
| Self-healing reload       | the watchdog's `claimAutoReload` + `healing: true` in `LoadProgress`                   |
| A late load               | `finish()` returning true                                                              |
| The recovery card         | `LoadRecoveryCard` (`apps/live/components/chrome/`), inside `ApiErrorPage`             |
| The recovery actions      | `BrowserRepairPanel` (`packages/ui/src/browser-repair/`)                               |
| A repair                  | `repairBrowserStorage(win)` → `{ cleared }`                                            |
| Kept / clearable          | `REPAIR_KEPT_KEYS`, `REPAIR_KEPT_PREFIXES`, `isRepairClearable(key)`                   |
| The browser checks        | `runBrowserChecks(win)`, `formatBrowserChecks(checks)`, `probeIndexedDb`               |
| The identity lines        | `readBrowserIdentity(win)`, `formatBrowserIdentity(id, account)`, `signedInFromCookie` |
| The guest identity's keys | `GUEST_IDENTITY_KEYS` (`packages/ui/src/browser-repair/kept-keys.ts`)                  |
| The diagnostics report    | `buildLoadDiagnostics(ownerId)` / pure `formatDiagnostics(input)`                      |
| The help centre's tool    | `BrowserRepairTool` (`apps/help/components/`)                                          |
| Offline store gave up     | `OfflineStoreUnavailableError` (`'timeout' \| 'blocked'`)                              |

## Constants and configuration

| Constant                        | Value                           | Where                          | Provenance                                       |
| ------------------------------- | ------------------------------- | ------------------------------ | ------------------------------------------------ |
| `LOAD_TIMEOUT_MS`               | `30_000`                        | `lib/load-progress.ts`         | Spec: 30 seconds                                 |
| `AUTO_RELOAD_DELAY_MS`          | `1_500`                         | `lib/load-progress.ts`         | Default D63                                      |
| `AUTO_RELOAD_WINDOW_MS`         | `600_000`                       | `lib/load-progress.ts`         | Spec: 10 minutes                                 |
| `AUTO_RELOAD_KEY`               | `livediagram:load-auto-reloads` | sessionStorage                 | Default D64                                      |
| `OFFLINE_STORE_OPEN_TIMEOUT_MS` | `4_000`                         | `lib/offline/offline-store.ts` | Spec: 4 seconds; = `INDEXED_DB_PROBE_TIMEOUT_MS` |
| `SESSION_TOKEN_TIMEOUT_MS`      | `10_000`                        | `lib/api/core.ts`              | Spec: 10 seconds per attempt                     |
| `GUEST_ID_PREFIX_LENGTH`        | `8`                             | `packages/ui/.../identity.ts`  | Spec: first 8 characters                         |
| `COPIED_FOR_MS`                 | `2_000`                         | `BrowserRepairPanel.tsx`       | Default D65                                      |
| `SLOW_AFTER_MS`                 | `10_000`                        | `DocumentLoading.tsx`          | Unchanged                                        |

## Behaviour and state

`LoadProgress = { step, startedAt, timedOut, healing }`, an external store.

1. `armLoadWatchdog` sets `{ step: 'identity', startedAt: now, timedOut: false, healing: false }` and
   starts a `LOAD_TIMEOUT_MS` timer.
2. The load calls `setLoadStep` at `participant` (after the guest identity), `share` or `document`
   (before the fetch), `first-tab` (before `seedFetchedDocument`), `done` (success tail).
3. Timer fires and the load has not finished → `timedOut: true`, warn
   `DocumentLoad.TimedOut.<Step>`, then:
   - `claimReloadIn(sessionStorage, AUTO_RELOAD_KEY, href, now, AUTO_RELOAD_WINDOW_MS)` true → warn
     `DocumentLoad.AutoReload`, `healing: true`, `location.reload()` after `AUTO_RELOAD_DELAY_MS`;
   - false (claimed in the window, or storage unreadable) → `onTimedOut()`: `setLoadError(true)`,
     `setLoadingDocument(false)`.
4. `finish()` is idempotent and leaves `step` where the load reached (only the success tail sets `done`, so a
   failed load's diagnostics name its step). Before the timer: disarm, return false. After it: warn
   `DocumentLoad.Late`; a pending self-healing reload is cancelled (`healing: false`): the late load wins. Return
   true. The success tail calls `setLoadStep('done')`, then `if (watchdog.finish()) setLoadError(false)`.
   Each bootstrap run takes a generation; a run superseded by a later one (auth settling twice: Clerk answering
   after the guest timeout, then a guest migration) has every setter and its seed turned into no-ops.
5. The runner wraps `load()` in try/catch/finally: a throw → `Error·Client·DocumentLoad.<ErrorName>`,
   `setLoadError(true)`, `setLoadingDocument(false)`; `finally` → `finish()`.
6. A password retry re-runs the bootstrap and arms a fresh watchdog.

Invariant: on every path the bootstrap leaves `loadingDocument` false or the watchdog armed.

## Offline

- `lib/online-status.ts`: `getOnline()` (`navigator.onLine !== false`, true without a navigator),
  `getOnlineServer()` (true), `subscribeOnline` (`online` + `offline`); `useOnline()`
  (`hooks/ui/useOnline.ts`) reads it with `useSyncExternalStore`.
- The watchdog takes `deps.online` (default `getOnline`): offline at the deadline skips
  `claimAutoReload` and calls `onTimedOut`, leaving the tab's claim unspent.
- `DocumentLoading`: `!online` renders the offline line ahead of `healing` and `slow`.
- `LoadErrorCard` (`components/chrome/`), the lazy chunk behind the editor's `loadError` branch:
  `ApiErrorPage` with the offline eyebrow / title / message while offline, `LoadRecoveryCard` unless
  `embed`. A ref notes having been offline; the online transition after it calls `reload` once.
- `OfflineBanner` (`components/chrome/`): first child of `TopCenterStack` in `TopCenterChrome`,
  `TopCenterBanner tone="neutral"` with an amber dot, copy by `readOnly`, `role="status"`.
- `useAutosave`: an `online` listener clears a pending retry timer and bumps `retryTick`; nothing
  happens when no retry is pending.
- `editor-persistence`: the `'error'` toast picks the offline copy when `getOnline()` is false.
- `autosaveReadOnly({ canEdit, loadError, documentNotFound })` (`editor-page-helpers.ts`) is the
  `isReadOnly` `useEditorState` hands `useAutosave`, so neither the debounced save nor the unload
  flush writes a document that did not load.
- `recoverFromChunkError` takes `deps.online` (`getOnline` from `recoverInBrowser`): offline it
  returns `'offline'` without claiming the reload guard or marking the error handled.
- `LoadErrorCard` is a static import in `editor-page.tsx`; `LoadRecoveryCard` is its `next/dynamic`
  chunk, rendered only while online.

## Interfaces and contracts

- `BrowserRepairPanelProps`: `buildReport(): Promise<string>`, `onCopied?`, `onRepairStart?` (before
  clearing), `onRepaired(cleared: number)`, `confirmLabel?` (default "Repair and Reload"), `children?`.
- `ApiErrorPage` gains `children?: ReactNode`, rendered under Retry.
- `lib/api/error-report.ts` gains `setApiWarningReporter(fn | null)` and `reportApiWarning(type)`,
  sharing the per-type cap; `ErrorTelemetryBoot` wires it to `track('Error', 'Warning', type)`.
- `local-identity.ts` exports `LOCAL_IDENTITY_KEYS` for the kept-list guard.

## Data and persistence

- Writes one sessionStorage key, `AUTO_RELOAD_KEY` (page → time map, entries older than the window
  dropped by `claimReloadIn`).
- A repair removes keys; it never writes. Scope: keys starting `livediagram:` or `livediagram-`.
  Kept: `REPAIR_KEPT_KEYS` (the four guest-identity keys, `collab-key`, `collab-secret`, `community-key`) and
  `REPAIR_KEPT_PREFIXES` (`livediagram:v2:drive-`, `livediagram:drive-mirror`). IndexedDB and cookies
  are never touched.
- The browser probe opens and deletes its own database, `livediagram-probe`.

## Errors and edge cases

| Case                                      | Handling                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| IndexedDB `open` never settles            | Rejects after 4 s; `storeUnavailable` for the page load                           |
| IndexedDB `blocked`                       | Rejects at once, same as a timeout                                                |
| IndexedDB opens after giving up           | The connection is closed on arrival                                               |
| Token provider never settles              | Each attempt resolves null after 10 s; signed-in → `SessionTokenUnavailableError` |
| Load throws                               | Load-error screen, `DocumentLoad.<ErrorName>`                                     |
| Load lands after the watchdog             | Editor replaces the error screen, `DocumentLoad.Late`                             |
| Load lands while the healing reload pends | The reload is cancelled; the editor shows                                         |
| sessionStorage unreadable                 | No self-healing reload; error screen at once                                      |
| Clipboard refused                         | `execCommand('copy')`, then a read-only textarea                                  |
| A storage blocked during repair           | Skipped; the other storage still repairs                                          |
| One key will not remove                   | Skipped; the rest clear                                                           |
| Late not-found or password result         | The error screen stays (it renders first); Retry reloads                          |

## Security and trust

- The report never carries a share code (`?s=` reduced to "share link: yes") or a full guest id
  (8-character prefix, cut inside `readBrowserIdentity` so no caller sees the whole id). A
  signed-in account id is not a credential on its own and is included by the editor only.
- `__client_uat` is read as a hint (value > 0 means signed in; any `__client_uat_<suffix>`
  counts); it is never sent anywhere but the copied report.
- The repair cannot sign anyone out or remove identity; the kept list is guarded by a test against
  `LOCAL_IDENTITY_KEYS`.
- Telemetry types are fixed tokens; the step is a closed enum.

## Performance and limits

- Nothing runs on page load beyond one `setTimeout` per load and a handful of store notifications.
- The report and checks run on press (or on the help page's open): one IndexedDB probe, at most 4 s.
- `withTokenTimeout` adds one timer per token request, cleared on settle.
- The offline-store limit bounds the worst case of a broken store to 4 s once per page load (two
  checks per load collapse to one wait via `storeUnavailable`).

## Presentation and UX

- Opening screen: the healing line "Still working on it. Trying a fresh start." replaces the slow
  message while `healing`.
- Recovery card: top border under Retry, "Still not loading?", one line of explanation, the panel,
  then "Troubleshooting steps" (`HelpArticleLink variant="text"`).
- Panel: Copy Diagnostics (Copy icon, "Copied" with a check for 2 s) and Repair This Browser
  (Refresh icon, `aria-expanded`); the inline confirm lists what is kept.
- Help tool: a bordered box titled "This browser" with the check lines, then the panel; after a
  repair "Done. Open your document again." and "Go to your documents".

## Accessibility

- The confirm is a labelled `region`, controlled by the toggle's `aria-controls`/`aria-expanded`; the
  go button takes focus when it opens.
- The check list and the done line are `aria-live="polite"` / `role="status"`.
- All controls are the shared `Button`; colours are the shared slate / brand ramps in both themes.

## Observability

Console fingerprints: `[load] timed out after … at step …`, `[load] finished after its watchdog`,
`[load] the document load threw`, `[offline-store] unavailable: …`, `[api] session token timed out
after …`, `[browser-repair] cleared N keys`. Telemetry as listed in the spec.

## Testing

| Spec rule                                  | Test                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Watchdog, self-healing reload, late load   | `apps/live/lib/load-progress.test.ts`                                                                              |
| Load ends on hang, throw; late load wins   | `apps/live/app/document/[id]/useIdentityBootstrap.recovery.test.tsx`                                               |
| Offline store open limit                   | `apps/live/lib/offline/offline-store-timeout.test.ts`                                                              |
| Session token limit                        | `apps/live/lib/api/core.test.ts` "session token limit"                                                             |
| Diagnostics contents and redaction         | `apps/live/lib/load-diagnostics.test.ts`                                                                           |
| Kept list covers the guest identity        | `apps/live/lib/local-identity-repair.test.ts`                                                                      |
| Clear / keep rules, blocked storage        | `packages/ui/src/browser-repair/repair.test.ts`                                                                    |
| Browser checks                             | `packages/ui/src/browser-repair/checks.test.ts`                                                                    |
| Identity lines, cookie hint, not-yet-moved | `packages/ui/src/browser-repair/identity.test.ts`                                                                  |
| Copy, fallback, confirm, cancel            | `packages/ui/src/browser-repair/BrowserRepairPanel.test.tsx`                                                       |
| Opening screen messages                    | `apps/live/components/chrome/DocumentLoading.test.tsx`                                                             |
| Offline: opening screen, card, banner      | `apps/live/components/chrome/DocumentLoading.test.tsx`, `LoadErrorCard.test.tsx`, `OfflineBanner.test.tsx`         |
| Offline: no phantom tab, no stale reload   | `apps/live/app/document/[id]/editor-page-helpers.test.ts` `autosaveReadOnly`, `apps/live/lib/stale-chunks.test.ts` |
| Offline: no auto reload, save on reconnect | `apps/live/lib/load-progress.test.ts`, `apps/live/app/document/[id]/useAutosave.test.tsx`                          |
| Recovery card contents                     | `apps/live/components/chrome/LoadRecoveryCard.test.tsx`                                                            |
