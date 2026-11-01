# Offline changes blueprint

Derived from [Offline changes](../offline-changes.md). Implementation detail only; the spec owns every design decision.
Paths are under `apps/editor/` unless they say otherwise.

## Domain and naming

| Term                         | Identifier                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| A waiting change             | `QueuedChange` (`lib/offline-queue/plan-queue.ts`), `store: 'items' \| 'sheets'`                    |
| The queue                    | `PlanQueue`; the page's one per plan and person: `planQueue(projectId, ownerId)`                    |
| When a change was made       | `seq`, from `nextSeq()`                                                                             |
| The banner's count           | `waitingChangeCount()` / `subscribeWaitingChanges` (all of the page's queues)                       |
| "The connection may be back" | `onReconnect(listener)`, fired by the window's `online` event and `signalReconnect()` (room joined) |
| No answer                    | `isConnectionFailure(e)` (`lib/offline-queue/reconnect.ts`)                                         |
| Role gate                    | `itemWriteMayWait(level, write)`, `sheetOpMayWait(rights, op, write)` (`queue-roles.ts`)            |
| Card replay                  | `replayItemQueue(deps)`, `nextItemBatch(changes, splitThrough)`, `alreadyLanded(write, e)`          |
| Card side in the editor      | `useItemQueue` + `withWaitingItems` (`hooks/plan/useItemQueue.ts`), wired in `usePlanItems`         |
| Sheet side                   | `SheetQueueKeeper` (`components/sheets/sheet-store-queue.ts`), owned by `SheetStore`                |

## Constants and configuration

| Constant                   | Value                                                                            | Where                          | Provenance / safe range                  |
| -------------------------- | -------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------- |
| `PLAN_QUEUE_MAX_CHANGES`   | `500`                                                                            | `plan-queue.ts`                | Spec "Bounds"; 100..2000                 |
| `PLAN_QUEUE_MAX_BYTES`     | `1_000_000` (characters of stored JSON)                                          | `plan-queue.ts`                | Spec "Bounds"; 256 KB..2 MB              |
| `PLAN_QUEUE_FULL_MESSAGE`  | "Too many changes are waiting to save. Reconnect, then try again."               | `plan-queue.ts`                | Spec "Bounds"                            |
| Storage key                | `liveplanner:offline-queue:v1:<projectId>:<ownerId>`                             | `planQueueKey`                 | Spec "Kept across a reload"; D66         |
| `OFFLINE_QUEUE_KEY_PREFIX` | `liveplanner:offline-queue:`                                                     | `packages/ui/.../kept-keys.ts` | Repair keeps it (`REPAIR_KEPT_PREFIXES`) |
| Card retry wait            | `retryDelayMs(n)` = min(2 s x 2^n, 60 s)                                         | `reconnect.ts`                 | Spec "Sending them"; 1..10 s, 30..300 s  |
| Unreached statuses         | none (a `TypeError`), 0, 408, 429, 502, 503, 504                                 | `reconnect.ts`                 | Spec "What waits"                        |
| Card batch                 | `ITEM_BULK_MAX` (200) field changes                                              | `@liveplanner/items`           | The api's many-patch limit               |
| Sheet waits                | `sheetWriteRetryMs` (0.5 s doubling to 30 s), `SHEET_WRITE_RETRY_MAX_MS` offline | `sheet-write-retry.ts`         | Sheet store spec, unchanged              |

## Data and persistence

- One `localStorage` key per plan and person: `{ v: 1, changes: QueuedChange[] }`, sorted by `seq`. Written whole on
  every `add` and `remove` (an empty queue removes the key). An unreadable key, another version, or a malformed change
  reads as nothing (the change is dropped from the in-memory list only; D67).
- A card change: `{ id: 'i<seq36>', seq, store: 'items', write: ItemWrite }`. A sheet write: `{ id: <wid>, seq, store:
'sheets', op: 'write', sheetId, write, flags }`; a new sheet: `op: 'create'` with the `SheetCreateRequest`
  (`id: 'c<seq36>'`); a sheet's delete: `op: 'delete'` (`id: 'd<seq36>'`). The sheet write's id is its `wid`, so the
  room's echo and the answer find it.
- `nextSeq()` = max(now x 1000, last + 1): unique within the page and ordered across reloads.
- Repair (`isRepairClearable`) never clears a key under `REPAIR_KEPT_PREFIXES`.

## Behaviour and state

**Cards** (`usePlanItems` `send`, unchanged for a write that may not wait):

1. The store's own check (`applyItemWrite`) runs first; a refusal is told, as before.
2. `queueOf()` is `planQueue(projectId, ownerId)` unless `isOfflineIdSync(projectId)` (Offline Mode: null).
3. A write may wait when the queue exists and `itemWriteMayWait(level, write)`; `level` is `participant.can.level`
   from `useEditorState` (absent: `'view'`, nothing waits).
4. It waits now when `!getOnline()` or `queue.count('items') > 0`: `queue.add` (full: the toast
   `PLAN_QUEUE_FULL_MESSAGE`, nothing applied, `ok: false`), then it is applied and `kick()` runs. Answer `ok: true,
made: []`; the undo step is pushed as for a landed write.
5. Otherwise it is applied and sent; a failure with no landed part where `isConnectionFailure` is true joins the queue
   (same `seq`) and answers `ok: true`; a failed `add` falls through to the old refusal path.
6. `load()` lays the queue over the fetched store: `withWaitingItems(refetchedItemStore(...), queue, by)`, applying
   each waiting write in order and skipping one that no longer applies.

**Card replay** (`useItemQueue`): one replay at a time (`flushingRef`).

- `replayItemQueue`: take `nextItemBatch` (a run of `patch` changes with the same `undo` flag, newer than
  `splitThrough`, up to `ITEM_BULK_MAX`, becomes one `patches` write; anything else goes alone) and send it.
  - Answered: `landed(answer)` (the editor's `settle`), remove the batch's ids.
  - `isConnectionFailure`: stop, `'stalled'`.
  - Refused, batch of more than one: fold in any `landed` part, set `splitThrough` to the batch's last `seq`, loop
    (each change then goes alone). Refused alone: `alreadyLanded` (a create's `item_exists`, a delete's
    `item_not_found` or 404) is dropped quietly; anything else calls `refused` (mark its items unconfirmed, the
    write's failure toast) and is dropped.
- `'done'` resets the attempt count and, when anything was sent, calls `load()` (which takes back what was refused).
- `'stalled'` while online sets a timer for `retryDelayMs(attempt++)`; offline it waits for `onReconnect`.
- Triggers: `kick()` (a change joined, online, no timer pending), the first `status === 'ready'`, and `onReconnect`
  (attempt reset; with nothing waiting it calls `refetch()` instead, so a socket that outlived the outage still
  reads the board again).
- `useEditorState`'s `onRoomJoined` calls `signalReconnect()`.

**Sheets** (`SheetStore` with `deps.queue` and `deps.rights` from `sheetStoreOf`: `{ cells: bridge.canEdit, shape:
bridge.canShape }`):

- `writeAll` gives every part a `wid` and `seq` up front. When `waitsNow()` (queue present and offline, or sheet
  changes waiting) `keepAll` adds every part or none; none: the full toast, return `'write_too_large'`, nothing
  applied.
- `create` and `release` keep their change when `waitsNow()`; past the bound they still go from memory (D68).
- `send`, `createTask`, `deleteTask`: a transient failure `keep`s the change (no-op when held or not allowed by role)
  and `pause(attempt)`s: `waitOrReconnect(online ? sheetWriteRetryMs(n) : SHEET_WRITE_RETRY_MAX_MS)`. Landed,
  refused, or no longer pending (the room confirmed it): `forget(id)`.
- At construction, `restore()` re-enqueues every kept sheet change in order: a create is adopted at once from its
  request and sent; a write joins its sheet's pending list (or `restored` until the sheet loads, where `adopt` takes
  it) and is sent; a delete is sent. `isPending` and `dropPending` look in both places.
- The window's `online` event calls `resync()` (every loaded tab read again; pending writes stay laid over).
- `useSheetsBridge` imports the sheet chunk and makes the store when the plan's queue holds sheet changes, so they go
  before any Sheet is drawn.

**Banner** (`OfflineBanner`): failing tab save online (not read-only) first; else, with changes waiting, `waitingCopy
(online, count)`; else the offline copy by `readOnly`. Waiting changes show for a Participant even though
`readOnly`.

## Interfaces and contracts

- `PlanQueue.add(change): 'ok' | 'full'` (no-op `'ok'` for a held id); `remove(ids)`; `changes(store)`; `count(store?)`
  (O(1)); `size()`; `has(id)`.
- `replayItemQueue({ queue, send, landed, refused }) → { outcome: 'done' | 'stalled', sent }`.
- `usePlanItems({ ..., level?: AccessLevel })`.
- `SheetStoreDeps` gains `queue?: PlanQueue | null`, `rights?: SheetQueueRights`.

## Errors and edge cases

- Storage full or refused: `add` answers `'full'` (the change is not kept), with `[offline-queue] queue.storage-full`.
- No storage at all (private mode refusing it): the queue lives for the page only.
- A sheet write that fails transiently while the queue is full keeps retrying from memory (D68).
- A replayed write whose answer was lost and is sent again: a create answers `item_exists` (landed), a delete
  `item_not_found` (landed), a patch sets the same values; a sheet write lands twice as it would on today's retry
  (risk named in the PR: a repeated row insert).
- Another person signs in on this browser: their key differs, so they neither see nor send the first person's queue,
  which stays until that person returns (D66).
- A restored write for a sheet that no longer exists is refused (`sheet_not_found`), told and dropped.

## Security and trust

- The server is the rule: the role gate only decides what is kept; the api checks every replayed write as it checks
  an online one. A Viewer keeps nothing.
- The queue holds only what this person typed into this plan, under their own owner id; it is never sent with another
  identity.

## Performance and limits

- Online with nothing waiting, a write costs `getOnline()`, `isOfflineIdSync`, one `Map` lookup for the queue and
  `count()`: O(1). `forget` on an empty queue returns before any storage call.
- Each `add`/`remove` writes the queue whole: O(queue bytes), at most 1 MB; measured under 50 ms CPU at the bound
  (`plan-queue.test.ts`).
- Card replay sends ceil(n / 200) requests for a run of n field changes, one request per other change.
- `withWaitingItems` is O(waiting x items) per load, only while changes wait.

## Observability

- `[offline-queue] queue.full`, `queue.storage-full`, `queue.read-failed`, `items.replay` (outcome, sent),
  `items.replay-refused`, `items.replay-failed`, `sheets.restored`; the sheet store's `sheets.create.retrying` and
  `sheets.delete.retrying` beside `sheets.write.retrying`.

## Presentation and UX

- Offline, waiting: "You’re offline. 1 change waits in this browser and saves when you reconnect." / "You’re offline.
  N changes wait in this browser and save when you reconnect."
- Online, waiting: "Saving 1 change made without a connection." / "Saving N changes made without a connection."
- Full: the error toast `PLAN_QUEUE_FULL_MESSAGE`.

## Accessibility

- The banner keeps its `role="status"`, so the count is announced as it changes.

## Testing

| Rule                                           | Test                                            |
| ---------------------------------------------- | ----------------------------------------------- |
| Order, storage, reload, bounds, storage full   | `lib/offline-queue/plan-queue.test.ts`          |
| No answer vs refusal, waits, reconnect         | `lib/offline-queue/reconnect.test.ts`           |
| Roles (Editor, Participant, Viewer)            | `lib/offline-queue/queue-roles.test.ts`         |
| Batching, split on refusal, already landed     | `lib/offline-queue/item-replay.test.ts`         |
| Cards wait, replay, refusal, roles in the hook | `hooks/plan/usePlanItems.offline.test.ts`       |
| Sheets wait, restore, refusal, full, roles     | `components/sheets/sheet-store-queue.test.ts`   |
| The banner's copy                              | `components/chrome/OfflineBanner.test.tsx`      |
| Repair keeps the queue                         | `packages/ui/src/browser-repair/repair.test.ts` |

## Defaults ledger

D66 to D68 in [DEFAULTS.md](DEFAULTS.md).
