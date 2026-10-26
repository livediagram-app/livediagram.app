# Explorer Home view: blueprint

Derived from [Explorer Home](../explorer-home.md) "Opens" and [Offline Mode](../../006-design/offline-mode.md). Home
itself is the shared Explorer's view over liveworkspace's index
([one-explorer.md](../../../../../liveworkspace/docs/one-explorer.md)); the index counts a cloud design's opens. This
blueprint covers the one part livedesign keeps: the opens of a design stored only in this browser. The spec
decides; this file only adds engineering precision.

## Scope, by file

| File                                     | Role                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| `apps/live/lib/offline/offline-opens.ts` | `localOpensOf`, `nextLocalOpens`, `offlineRecordOpen`, `offlineListOpens`       |
| `apps/live/lib/offline/offline-store.ts` | `LocalOpens`, `StoredLocalOpens`, the record's `opens` field                    |
| `apps/live/lib/api/tabs.ts`              | `apiLoadTab(..., { open: true })` counts the editor's first-tab read as an open |
| `../packages/api-schema/src/home.ts`     | `WITHIN_REACH_USE_WINDOW_DAYS`, `windowStartOf`, `utcDay`                       |

## Local opens

The server never sees an Offline Mode design, so this browser counts its opens by the server's own rule.

- **What counts.** Only the editor's marked first-tab read (`apiLoadTab` with `{ open: true }`). Every other read of
  the same tab counts nothing, and nothing reaches the network.
- **What is kept.** `LocalOpens = { days: string[]; lastOpenedAt: number }` on the design's own record: the UTC days
  (`YYYY-MM-DD`, newest first) with an open inside the use window, and the last open.
- **One open.** `nextLocalOpens(prev, now)` puts today first (once), drops days before `windowStartOf(now)` and moves
  `lastOpenedAt` forwards (`Math.max`). `savedAt` is left alone: an open is not an edit.
- **Reading.** `localOpensOf(raw)` reads the current shape, or the older `{ lastOpenDay, lastOpenedAt, ... }` shape as
  one day; anything unreadable is never opened. The next open rewrites it in the current shape.
- **Listing.** `offlineListOpens()` answers every live (not trashed) local design that has been opened, with its
  opens, as `LocalOpenDesign`.
- **Where it goes.** The record carries it, so it follows the record into the local Trash, a purge or Sync Design,
  and never leaves the browser.

## Errors and edge cases

- A trashed or missing record: no write.
- A failed write: `offlineRecordOpen` never throws; it logs `[home] local-open-failed` and the load goes on.
- Writes run through `serializeOfflineWrite`, so two opens in one browser never lose a day.

## Observability

| Fingerprint                           | Where             |
| ------------------------------------- | ----------------- |
| `[home] local-open-recorded days=<n>` | editor (debugLog) |
| `[home] local-open-failed`            | editor (warn)     |

## Testing

| Rule                                                      | Test                                          |
| --------------------------------------------------------- | --------------------------------------------- |
| A marked load counts; other reads don't; no network       | `apps/live/lib/api/tabs-local-open.test.ts`   |
| Day order, window, older shape, trashed records, failures | `apps/live/lib/offline/offline-opens.test.ts` |

## Constants and configuration

| Constant                       | Value | Provenance                      |
| ------------------------------ | ----- | ------------------------------- |
| `WITHIN_REACH_USE_WINDOW_DAYS` | 90    | The server's use window, shared |
