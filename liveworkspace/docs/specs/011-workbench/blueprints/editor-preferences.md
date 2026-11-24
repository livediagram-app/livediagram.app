# Editor preferences blueprint

Derived from [Editor preferences](../editor-preferences.md).

## Files

Under `packages/workbench/src/lib/preferences/`, each imported by its own subpath (never a barrel, so an editor's first
load takes only what it uses):

| File                   | Subpath                                                      | Holds                                                                                |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `preferences-merge.ts` | `@liveworkspace/workbench/lib/preferences/preferences-merge` | `mergePreferences`, `preferencesPatch`, `rebasePreferences`, `samePreference` (pure) |
| `preferences-fit.ts`   | `@liveworkspace/workbench/lib/preferences/preferences-fit`   | `PREFERENCES_BODY_MAX`, `preferencesBodyLength`, `fitPreferences(prefs, fit)`        |
| `preferences-store.ts` | `@liveworkspace/workbench/lib/preferences/preferences-store` | `createPreferencesStore(config)`                                                     |

Each editor's `lib/preferences-sync.ts` creates one store at module load and exports it as `preferencesStore`, with its
constants (`PREFERENCES_CHANGED_EVENT`, `PREFERENCES_UNSYNCED_KEY`, `PREFERENCES_SERVER_KEY`, its pause) and thin
wrappers (`preferencesUnsynced`, `savePreferences`, `flushPreferences`, `keepPreferencesLocally`,
`__resetPreferencesSync`). Its `lib/user-preferences.ts` keeps the `UserPreferences` type and its read helpers, and
wraps the store as `readUserPreferences`, `writeUserPreferences`, `rebaseUserPreferences`, `commitUserPreferences` and
`fetchUserPreferences`, so no caller changed.

## The binding

`PreferencesStoreConfig<P>`:

| Field          | Type                                                          | Each editor passes                                       |
| -------------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| `storageKey`   | string                                                        | `USER_PREFERENCES_STORAGE_KEY` from its telemetry-client |
| `unsyncedKey`  | string                                                        | `<app>:user-preferences:unsynced`                        |
| `serverKey`    | string                                                        | `<app>:user-preferences:server`                          |
| `changedEvent` | string                                                        | `<app>:preferences-changed`                              |
| `upgrade`      | `(raw) => P`                                                  | its api-schema's `upgradeLegacyPreferences`              |
| `fit`          | `(P) => P`                                                    | `fitPreferences` with its dead keys (below)              |
| `get`          | `(ownerId) => Promise<blob \| 'local' \| null>`               | its `apiGetPreferences`, answers mapped                  |
| `put`          | `(ownerId, patch) => Promise<'saved' \| 'failed' \| 'local'>` | its `apiPutPreferences`, answers mapped                  |
| `confined`     | `() => boolean` (default never)                               | `getWorkbenchConfinement() !== null`; livehuddle none    |
| `debounceMs`   | number (default 0, at once)                                   | 0 in livediagram and livehuddle; 400 in the rest         |

`get` and `put` are passed as arrows calling the api client, so a test's module mock is read at call time.

| Editor        | Dead keys                       | Growable map           | Pause  |
| ------------- | ------------------------------- | ---------------------- | ------ |
| livediagram   | `recentExcludedIds`             | `whiteboardShapePicks` | 0      |
| livehuddle    | `recentExcludedIds`             | `whiteboardShapePicks` | 0      |
| livedesign    | `recentExcludedIds`             | none                   | 400 ms |
| livedocuments | `customSwatches`, `drawPattern` | none                   | 400 ms |
| liveknowledge | `customSwatches`, `drawPattern` | none                   | 400 ms |
| liveplanner   | `customSwatches`                | none                   | 400 ms |

## The merge

`mergePreferences({ local, server, base, unsynced })`, `server` already upgraded:

1. `base` null and `unsynced`: `{ ...server, ...local }`.
2. `base` null otherwise: `{ ...local, ...server }`.
3. Otherwise, for each key of `local ∪ server ∪ base`, with `same` the whole-value comparison (`===`, else equal JSON):
   - `same(local, base)`: the server's value;
   - else `same(server, base)`: the local value;
   - else `unsynced ? local : server`.
     An `undefined` result leaves the key out.

`base` is the stored `{ ownerId, prefs }` at `serverKey` when its `ownerId` is the loading owner; another owner's, or a
malformed record, counts as none.

## The load

`fetch(ownerId)` memoises one promise per owner (`loads`); a second caller chains `read()` on it. A null answer deletes
the entry. `load`:

1. `get`. `'local'`: `keepLocally(ownerId)`, answer null. Null: answer null.
2. The in-memory patch base becomes the raw answer (so a retired key the upgrade drops is nulled on the next save).
3. Merge as above, `fit`, write `serverKey` = `{ ownerId, prefs: upgrade(answer) }`, then `keep` (cache, cookie unless
   confined, change event).
4. `unsynced`: log `[preferences] device copy kept over the server, resending`, then `save` unless confined.

## Writing and saving

- `write(prefs, ownerId)`: `fit`, `keep`; then `save` for an owner other than `'self'` unless confined.
- `unsynced(ownerId)`: the mark is `ownerId`.
- `save`: skip an owner kept locally; set the mark to the owner; `waiting` = the job; pause 0 sends now, else (re)start
  the timer. `flush` sends now when a timer runs. With a pause, `pagehide` and `visibilitychange` to hidden flush.
- `drain`: one at a time (`inFlight`), guarded by `generation` (bumped by `reset`). Each job: skip an owner kept
  locally; patch against the in-memory base for that owner (none: the whole job, no nulls); an empty patch counts as
  saved. `'local'`: `keepLocally`. `'failed'`: warn `[preferences] save-not-confirmed, device copy kept`, the mark
  stays. `'saved'`: the in-memory base and `serverKey` become the job's copy (upgraded); with nothing waiting, the mark
  is cleared.
- `keepLocally(ownerId)`: record it (`preferences-local-only`), drop a waiting job of that owner, clear the timer when
  nothing waits, clear the mark when it is that owner's.

## Constants

| Name                   | Value | Why                                                             |
| ---------------------- | ----- | --------------------------------------------------------------- |
| `PREFERENCES_BODY_MAX` | 4096  | The apps' api cap on `{"prefs":...}`; patches may be twice this |

## Performance

A load reads two `localStorage` keys and writes two, once per page and owner; a confirmed save writes one more key (at
most 4 KB). The merge and the patch are linear in the blob (at most 4,096 characters). The fit drops as many map entries
per pass as the excess needs and measures once per pass; a 20,000-entry map trims under the test's CPU budget.

## Testing

`preferences-merge.test.ts` (every merge rule, the patch, the rebase), `preferences-fit.test.ts` (dead keys in order,
the map's oldest entries, malformed entries, the unfit case, a worst-case CPU budget), `preferences-store.test.ts`
(read, write, the marks, the frame, the cookie, the save queue with and without a pause, every load path: the cleared
key, the unsaved change, the offline change, nothing agreed, another owner, malformed records, retired keys) and
`preferences-store.node.test.ts` (no browser). All four files are held at 100% (`vitest.config.ts` `HELD_AT_100`). Each
editor's own `lib/preferences-sync.test.ts` and `lib/user-preferences.test.ts` drive its binding end to end.
