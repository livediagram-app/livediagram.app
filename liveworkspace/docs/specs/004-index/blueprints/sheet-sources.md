# Sheet sources: blueprint

Derived from [sheet-sources.md](../sheet-sources.md). The spec decides; this file adds engineering precision.

## Files

| File                                                   | Role                                                                                                                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/index-client/src/sheet-sources.ts`           | The contract: `SheetAxisRange`, `SheetRangeAsk`, `SheetChartTable`, `SheetListing`, the answers, the constants, `readSheetRangeAsk`, `isSheetAxisRange`, `isSheetChartTable` |
| `packages/index-client/src/client.ts`                  | `listSheets(itemId)`, `readSheetRange(itemId, ask, {grant?, watch?})` for browsers                                                                                           |
| `packages/index-client/src/app-client.ts`              | `sheetChanged(itemId, sheetIds, watchers)` for the source app's server                                                                                                       |
| `packages/app-doors/src/doors.ts`                      | `listSheets(app, itemId)`, `readSheetRange(app, itemId, ask)`: the platform's client of the doors                                                                            |
| `packages/index-app/src/sheet-source-doors.ts`         | The apps' side of the three doors (`sheets`, `sheet-range`, `source-changed`), wired in `internal.ts`; `tellSourceChanged`, the reader room's frame                          |
| `liveworkspace/apps/index/src/sheet-sources.ts`        | `GET /items/:id/sheets`, `POST /items/:id/sheet-range`, `POST /app/items/:id/sheet-changed`                                                                                  |
| `liveplanner/apps/api/src/plan-room/sheet-source.ts`   | liveplanner's door handlers: its sheet list and one range's read                                                                                                             |
| `liveplanner/apps/api/src/plan-room/sheet-watchers.ts` | The watches in the plan's room and the gathered change signal                                                                                                                |
| `packages/workbench/src/lib/room-client.ts`            | `onSourceChanged` for the `source-changed` frame                                                                                                                             |
| `packages/workbench/src/components/sheet-links/`       | The editors' side, one copy for every reader app: the reads and the quiet save, Link to Sheet, the Data section's Sheet row and the Linked to line                           |

## Domain and naming

| Term         | Identifier                                                                          | Meaning                                                            |
| ------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Source app   | `SHEET_SOURCE_APPS` (`liveplanner`)                                                 | An app whose items hold sheets a chart may read                    |
| Reader app   | `SOURCE_WATCH_APPS` (`livedocuments`, `livediagram`, `livedesign`)                  | An app whose items may watch a source                              |
| Range        | `SheetAxisRange = {r1, c1, r2, c2}`                                                 | Corner row and column ids, each `SHEET_AXIS_ID` (`[a-z0-9]{4,12}`) |
| Ask          | `SheetRangeAsk = {sheetId, range?, a1?, cols?}`                                     | Exactly one of `range` and `a1`                                    |
| Read (door)  | `SheetRangeDoorRead = {sheetName, tabId, range, a1, table}`                         | What the door answers                                              |
| Read (index) | `SheetRangeRead = {itemId, itemName, sheetId, sheetName, range, a1, table, readAt}` | What the browser gets                                              |
| Table        | `SheetChartTable = {categories, series: {name, values}[]}`                          | One category per row, one series per value column                  |
| Watch        | `sheet_watches(watcher, sheet_id, until)`                                           | A row in the plan room's SQLite                                    |

## Behaviour and state

### `readSheetRangeAsk(raw)` (shared by the index route and the door)

Returns an ask or null: `sheetId` a string of 1 to 64 id characters; exactly one of `range` (passes
`isSheetAxisRange`) or `a1` (a string of at most `SHEET_A1_MAX` (24) characters, left to the sheet app to parse);
`cols` absent or 1 to 13 distinct axis ids. Anything else in the object is ignored.

### The index's read (`POST /items/:id/sheet-range`)

1. `caller.person` is required and `caller.share` must be absent; a delegate (`app`, `drive`, `export`) is refused.
   Each refusal answers `404 not_found`.
2. `readSheetRangeAsk(body)`, else `400 invalid_range`. `watch` is `{itemId}` or absent; anything else is ignored.
3. `loadItem(env, id, caller, 'view')`; a refusal answers `404` (a `403` is turned into `404` too), as does an item
   whose app is not in `SHEET_SOURCE_APPS` or access through a public link.
4. The watcher: when `watch.itemId` is an id and `X-Index-Grant` verifies (`verifyOwnGrant`) with `item === watch.itemId`,
   `app` in `SOURCE_WATCH_APPS` and `link` not a public link's code, the door is sent `watcher: watch.itemId`.
   Otherwise the read goes ahead with no watcher.
5. `doors.readSheetRange(app, id, {...ask, watcher})`. A `DoorError` 404 answers `404 not_found`; 409 answers
   `409 range_gone`; 400 answers `400 invalid_range`; anything else (or not configured) `503 source_unavailable`
   and logs `[index] sheet-range door failed` with the status.
6. The read's `tabId` must be the access's `tabId` when that is set, else `404`.
7. Answer `{itemId, itemName: row.title, sheetId, sheetName, range, a1, table, readAt: Date.now()}`.

### The index's list (`GET /items/:id/sheets`)

Steps 1 and 3 above, then `doors.listSheets(app, id)`; a tab-scoped access keeps only its tab's sheets. Answer
`{itemId, itemName, sheets}`. Door failures as above.

### The change signal (`POST /app/items/:id/sheet-changed`)

1. The caller's app key (`callerApp`); the item's row must be that app's (`403 wrong_app`), and the app a source app
   (`403 wrong_app`).
2. Body `{sheetIds: string[1..50], watchers: string[1..SHEET_WATCHERS_MAX]}` of ids, else `400`.
3. One read: `SELECT id, app FROM items WHERE id IN json_each(?) AND purged_at IS NULL` (rows that exist).
4. Each found row whose app is a reader app is told, `SOURCE_SIGNAL_CONCURRENCY` (10) at a time, through `callApp`
   `POST /items/:watcher/source-changed {app, itemId, sheetIds}`. A failed call is logged
   (`[index] source-changed failed`) and not retried: the next change or open catches up.
5. Answer `{gone}`: the watchers not found, or found in an app that is not a reader app.

### The doors (`sheet-source-doors.ts`)

- `GET /api/internal/items/:id/sheets` → handler `listSheets(id)` → `{status: 'ok', sheets} | {status: 'not_found'}`.
- `POST /api/internal/items/:id/sheet-range` → `readSheetRangeAsk(body)` (else `400 invalid_range`), `watcher` an id
  or ignored → handler `sheetRange(id, ask, watcher)` →
  `{status: 'ok', read} | {status: 'not_found'} | {status: 'range_gone'}` → 200 / 404 / 409.
- `POST /api/internal/items/:id/source-changed` → `{app, itemId, sheetIds}` (`app` a source app, ids valid, 1 to 50
  sheets, else `400`) → handler `sourceChanged(id, change)` → `202`. A throw is logged and still `202`.
- A door without its handler is `404`. All three take the index's key (`key`) alone.

### liveplanner (`sheet-source.ts`, `sheet-watchers.ts`)

- `listSheets`: the plan's sheet heads from D1 (`listSheetHeads`), each `{id, name: title, tabId, a1}` with `a1` from
  the sheet's filled extent (`A1` for an empty sheet); `not_found` when the plan is not in `projects`.
- `sheetRange`: the plan's sheets (`listSheets`, the whole plan, so a formula reading another sheet works), a
  `Workbook` in `AGENT_LOCALE`, the asked sheet (else `not_found`); a range of ids must still have its corners
  (`posRangeOf`, else `range_gone`); an `a1` is parsed (`parseRangeText`, else `400`) and turned into ids
  (`idRangeOf`, clamped to the grid); the table is `sheetChartTable`. A watcher is handed to the room
  (`planRoom(env, id).watchSheet(sheetId, watcher)`) off the answer's path.
- Watches: `sheet_watches(watcher TEXT, sheet_id TEXT, until INTEGER, PRIMARY KEY (watcher, sheet_id))` in the room's
  SQLite, made on first use. `watchSheet` upserts `until = now + SHEET_WATCH_TTL_MS`, deletes lapsed rows, and past
  `SHEET_WATCHERS_PER_SOURCE` rows deletes the earliest `until`.
- The signal: the room's broadcast of a `sheets` op (`relaySheets`, every sheet change) calls `noteSheetChanged(sheetId)`.
  A sheet with a live watch joins the pending set, and a timer of `SHEET_CHANGE_SETTLE_MS` (one at a time) sends it:
  the pending sheets' live watchers, `SHEET_WATCHERS_MAX` a call, through `indexAppClient(env).sheetChanged`.
  The `gone` answer deletes those watchers' rows. A failure is logged (`[sheets] sheet-changed failed`) and dropped.

### The reader apps (`tellSourceChanged`)

livedocuments, livediagram and livedesign each wire the door to their item's room: the room's `sourceChanged(itemId, change)`
calls `tellSourceChanged` (`packages/index-app/src/sheet-source-doors.ts`, one copy), which binds the room to its item and
sends `{kind: 'source-changed', app, itemId, sheetIds}` to every socket (`broadcast`). Nothing is stored.

## Interfaces and contracts

```ts
export const SHEET_SOURCE_APPS = ['liveplanner'] as const;
export const SOURCE_WATCH_APPS = ['livedocuments', 'livediagram', 'livedesign'] as const;
export type SheetAxisRange = { r1: string; c1: string; r2: string; c2: string };
export type SheetRangeAsk = {
  sheetId: string;
  range?: SheetAxisRange;
  a1?: string;
  cols?: string[];
};
export type SheetChartTable = {
  categories: string[];
  series: { name: string; values: number[] }[];
};
export type SheetListing = { id: string; name: string; tabId: string; a1: string };
export type SheetRangeDoorRead = {
  sheetName: string;
  tabId: string;
  range: SheetAxisRange;
  a1: string;
  table: SheetChartTable;
};
export type SheetRangeRead = SheetRangeDoorRead & {
  itemId: string;
  itemName: string;
  sheetId: string;
  readAt: number;
};
export type SourceChange = { app: SheetSourceApp; itemId: string; sheetIds: string[] };
```

## Data and persistence

- The index stores nothing new. Watches live in the plan room's SQLite (derived, lapsing; purging the plan drops
  the room's storage with them). The reader stores its source and last values on its own element.

## Errors and edge cases

| #   | Case                                  | Handling                                                |
| --- | ------------------------------------- | ------------------------------------------------------- |
| E1  | The sheet deleted                     | `404 not_found`; the reader keeps its values            |
| E2  | A corner row or column deleted        | `409 range_gone`                                        |
| E3  | Rows inserted inside the range        | Read with them: ids, not positions                      |
| E4  | An A1 range past the grid             | Clamped to the grid; wholly outside is `409 range_gone` |
| E5  | Tab-scoped link, sheet on another tab | `404`                                                   |
| E6  | The person loses access               | The next read is `404`; the reader shows saved values   |
| E7  | The sheet app down                    | `503 source_unavailable`; the reader offers Update      |
| E8  | A watcher purged                      | `gone`; the source forgets it                           |
| E9  | Many quick edits                      | One signal per `SHEET_CHANGE_SETTLE_MS`                 |
| E10 | A watch lapses (no read for a day)    | No more signals until the next read                     |

## Security and trust

- The read checks the person's own access per request (`loadItem`); there is no pass and no cached answer.
- The doors take the app's `INDEX_KEY` only (constant-time compare); never a browser.
- A watch needs the reader item's own grant, verified offline by the index, and a reader app.
- Signals carry ids only. The reader app's frame goes to that item's sessions only.

## Performance and limits

- A read: one index row read (`loadItem`), one door call. On liveplanner one D1 read of the plan's sheet heads and
  one of their cells (the whole plan's, as agents' reads are, bounded by `PROJECT_CELLS_MAX`), the workbook built
  once, the table capped at 500 × 12.
- A signal: at most one per plan per `SHEET_CHANGE_SETTLE_MS`, only when a watch is live; nothing for an unwatched
  sheet beyond one indexed SQLite probe in the room. The index makes one batched row read and at most
  `SHEET_WATCHERS_MAX` door calls, ten at a time.
- Readers re-read on open and on a signal only.

## Observability

`[index] sheet-range door failed {status}`, `[index] source-changed failed {app, status}`,
`[sheets] sheet-changed failed {error}`, `[internal] source changed failed {error}`.

## Testing

| Rule                                                                                                                                            | File                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Asks and ranges parse, malformed refused                                                                                                        | `packages/index-client/src/sheet-sources.test.ts`                                                          |
| Client calls and the app client's signal                                                                                                        | `packages/index-client/src/sheet-sources.test.ts`                                                          |
| Doors: the index key only, 404 without a handler, answers                                                                                       | `packages/index-app/src/sheet-source-doors.test.ts`                                                        |
| app-doors list and read, errors as `DoorError`                                                                                                  | `packages/app-doors/src/doors.test.ts`                                                                     |
| Index: own access only, share code / public / delegate 404, tab scope, watch only with the reader's grant, door errors, signal relay and `gone` | `liveworkspace/apps/index/src/sheet-sources.test.ts`                                                       |
| liveplanner: reads only the range, A1 to ids, range gone, watches and the gathered signal                                                       | `liveplanner/apps/api/src/plan-room/sheet-source.test.ts`, `plan-room/sheet-watchers.test.ts`              |
| Reader apps: the frame                                                                                                                          | `source-changed.test.ts` in livedocuments' and livediagram's `document-room/`, livedesign's `design-room/` |

## Constants and configuration

| Name                        | Value | Provenance / safe range                  |
| --------------------------- | ----- | ---------------------------------------- |
| `SHEET_WATCH_TTL_MS`        | 1 day | Spec; an hour to a week                  |
| `SHEET_WATCHERS_PER_SOURCE` | 50    | Spec; 10 to 500                          |
| `SHEET_WATCHERS_MAX`        | 20    | One call's watchers; 1 to 50             |
| `SHEET_CHANGE_SETTLE_MS`    | 1 500 | Gathers a burst of edits; 250 ms to 10 s |
| `SHEET_CHANGE_SHEETS_MAX`   | 50    | One call's sheets                        |
| `SOURCE_SIGNAL_CONCURRENCY` | 10    | As the workbench close; 1 to 20          |
| `SHEET_A1_MAX`              | 24    | Longest A1 range text taken              |
