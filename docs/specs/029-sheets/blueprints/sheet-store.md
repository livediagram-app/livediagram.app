# Sheet store blueprint

Derived from [Sheet store](../sheet-store.md). Implementation contract for the api's sheet tables and routes, the
room op, the editor's sheet slice, the offline store, copies, the sweep and the agent doors. The pure model and
writes are the engine's ([sheets-engine](sheets-engine.md#writes-storets)); this blueprint stores and moves them.

## Domain and naming

| Spec term    | Identifier                                                              |
| ------------ | ----------------------------------------------------------------------- |
| sheet store  | D1 tables `sheets` + `sheet_cells`; editor `sheet-store-client.ts`      |
| sheet        | `Sheet` (engine), wire `SheetDto` (`packages/api-schema/src/sheets.ts`) |
| cell write   | `SheetWrite` `{ kind: 'cells' }`                                        |
| layout write | `SheetWrite` `{ kind: 'layout' }`                                       |
| sheet rev    | `sheets.rev`, `SheetDto.rev`                                            |
| room op      | `SheetsRoomOp` kind `sheets`; presence `sheet-presence`                 |

## Data and persistence: D1

Migration `apps/api/migrations/0078_sheets.sql`:

```sql
CREATE TABLE sheets (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  tab_id TEXT NOT NULL,
  title TEXT NOT NULL,
  layout TEXT NOT NULL,                -- JSON SheetLayout
  rev INTEGER NOT NULL,
  cell_count INTEGER NOT NULL DEFAULT 0,
  cell_bytes INTEGER NOT NULL DEFAULT 0,
  unframed_since INTEGER,              -- set by the sweep when no element frames it; cleared when one does
  write_nonce TEXT,                    -- the write that last moved rev: guards that write's own statements
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL,            -- JSON SheetPerson
  PRIMARY KEY (document_id, id)
);
CREATE INDEX sheets_tab ON sheets(document_id, tab_id);
CREATE TABLE sheet_cells (
  document_id TEXT NOT NULL,
  sheet_id TEXT NOT NULL,
  row_id TEXT NOT NULL,
  col_id TEXT NOT NULL,
  input TEXT,                          -- JSON CellInput, NULL when the cell holds only a format
  format TEXT,                         -- JSON CellFormat, NULL when none
  PRIMARY KEY (document_id, sheet_id, row_id, col_id),
  FOREIGN KEY (document_id, sheet_id) REFERENCES sheets(document_id, id) ON DELETE CASCADE
);
```

- Field classification: `title`, `input`, `format` are user content (never logged); `updated_by` is display
  identity (a hashed id, `itemPersonId`); the rest is structural.
- Hard delete of a document cascades both tables; `documentRemovalStatements` needs nothing new.
- `apps/api/src/db/sheets.ts`: `listSheets(env, docId, { tabId?, ids? })` (sheets then their cells, two queries),
  `readSheetHead(env, docId, id)` (the row without cells), `readCells(env, docId, sheetId, keys)`,
  `insertSheetStatements`, `cellWriteStatements(env, docId, sheetId, applied)`, `layoutWriteStatement(..., rev)`,
  `deleteSheetStatement`, `copySheetsStatements(env, sourceId, newId, onlyTabIds?)`, `sheetCounts(env, docId)`;
  re-exported from `db/index.ts`. Row ↔ `Sheet` in the same file (`sheetFromRows`).
- **Cell writes by `json_each`**: the changed cells go as one JSON parameter per statement, so a 5,000-cell
  write is a handful of statements whatever D1's 100-parameter cap. From the engine's landed write the api builds
  `sets` (cells whose input is set; `{ r, c, i }`), `fmts` (format patches, `{ r, c, fp }` with `null` keys
  clearing, or `fp: null` to clear all) and `clears` (inputs cleared; `{ r, c }`):

  ```sql
  -- inputs set
  INSERT INTO sheet_cells (document_id, sheet_id, row_id, col_id, input)
  SELECT ?1, ?2, j.value->>'r', j.value->>'c', j.value->>'i' FROM json_each(?3) j WHERE true
  ON CONFLICT (document_id, sheet_id, row_id, col_id) DO UPDATE SET input = excluded.input;
  -- format patches (RFC 7396 json_patch: a null key clears it)
  INSERT INTO sheet_cells (document_id, sheet_id, row_id, col_id, format)
  SELECT ?1, ?2, j.value->>'r', j.value->>'c', json_patch('{}', j.value->>'fp') FROM json_each(?3) j WHERE true
  ON CONFLICT (document_id, sheet_id, row_id, col_id) DO UPDATE SET
    format = CASE WHEN excluded.format IS NULL THEN NULL
                  ELSE json_patch(coalesce(sheet_cells.format, '{}'), excluded.format) END;
  -- inputs cleared
  UPDATE sheet_cells SET input = NULL WHERE document_id = ?1 AND sheet_id = ?2
    AND row_id || ':' || col_id IN (SELECT value FROM json_each(?3));
  -- cells left with nothing
  DELETE FROM sheet_cells WHERE document_id = ?1 AND sheet_id = ?2 AND input IS NULL
    AND (format IS NULL OR format = '{}') AND row_id || ':' || col_id IN (SELECT value FROM json_each(?3));
  ```

  Rows or columns deleted remove their cells with `DELETE ... AND row_id IN (SELECT value FROM json_each(?3))`.

- Every write is one D1 `batch`: `UPDATE sheets SET rev = rev + 1, write_nonce = ?, updated_at = ?, updated_by = ?
[, layout = ?] [, title = ?] WHERE document_id = ? AND id = ? AND rev = ? RETURNING rev`, then the cell statements,
  then the
  recount `UPDATE sheets SET cell_count = (SELECT COUNT(*) ...), cell_bytes = (SELECT COALESCE(SUM(length(input)) +
SUM(length(format)), 0) ...)`. Each later statement runs only `WHERE EXISTS (... write_nonce = ?)`, this write's
  own random nonce, so a write that lost the `rev` race (no row returned) changes nothing even if another write
  reached the same rev number meanwhile; it retries from a fresh read up to `SHEET_WRITE_RETRIES`, then
  `409 sheet_busy`.
- **Caps**: before writing, `cell_count + cellsAddedUpperBound(applied) > SHEET_CELLS_MAX` reads the touched keys'
  existence (`readCells`) for the exact delta; over → `413 sheet_full`. Bytes the same against `cell_bytes`.
  Document totals from `sheetCounts` (one `SUM`) for `DOCUMENT_CELLS_MAX` and `DOCUMENT_SHEETS_MAX`.
- A layout write reads the stored layout, applies with the engine (`applySheetWrite`), and stores the whole layout
  JSON under the rev guard.

## Interfaces and contracts: REST

All under `/documents/:id/sheets`, auth `guest-or-clerk`, token-usable, registered in `openapi/manifest.ts` (tag
`Sheets`, added to `TAGS` in `openapi/document.ts`), DTOs in `packages/api-schema/src/sheets.ts`, words `sheets`
and `writes` added to `API_ROUTE_WORDS`.

| Method | Path                      | Gate | Body                                     | Answers                                      |
| ------ | ------------------------- | ---- | ---------------------------------------- | -------------------------------------------- |
| GET    | `/sheets?tabId=`          | read |                                          | `SheetsResponse { sheets: SheetDto[] }`      |
| GET    | `/sheets?ids=a,b`         | read |                                          | `SheetsResponse` (≤ 50 ids)                  |
| POST   | `/sheets`                 | edit | `SheetCreate`                            | 201 `SheetResponse { sheet }`                |
| POST   | `/sheets/:sheetId/writes` | edit | `{ write: SheetWrite; baseRev?; undo? }` | `SheetWriteResponse { applied, rev, cells }` |
| DELETE | `/sheets/:sheetId`        | edit |                                          | 204                                          |

- `SheetCreate = { id?: string; tabId: string; title: string; layout?: SheetLayout; cells?: CellDto[]; copyOf?:
string }`. `copyOf` copies another sheet of the document server-side (cells and layout), with the new title; the
  create is refused `409 sheet_exists` when `id` is taken, `409 sheet_title_taken` when the tab has the title,
  `413 sheets_full`, `400 { error: SheetRejection }` from `validateSheetCreate`. A create larger than
  `SHEET_WRITE_CELLS_MAX` cells is sent as a create of the layout then cell writes (the editor's `createSheet`).
- `SheetWriteResponse.cells` holds the stored state of every cell the write touched (so the writer reconciles
  exactly), `applied` the landed write, `rev` the new rev.
- A `title` write is refused `409 sheet_title_taken` when another sheet on the tab has it (case-insensitive).
- Tab-scoped grants: GET needs `tabId` equal to the grant's tab (or `ids` all on it); writes need `tabId` in the query
  and the sheet on that tab; a create into that tab is allowed.
- Rejections: `400 { error: SheetRejection, at? }`, `404 sheet_not_found`, `409 sheet_busy`, `409 sheet_exists`,
  `409 sheet_title_taken`, `413 sheet_full`, `413 sheets_full`, plus the document gates' 403/404/410.
- Routes in `apps/api/src/routes/sheet-routes.ts` (dispatch) and `sheet-write-route.ts` (the write), shared parts in
  `sheet-route-kit.ts` (`sheetCaller`, `rejected`, `relaySheet`, `writer` reuse from item-route-kit), dispatched from
  `document-subresource-routes.ts` beside `handleItemRoutes`.
- `POST /documents` create body accepts `sheets?: SheetCreate[]` (sync to cloud, duplicate), read before anything is
  written (`readSeedSheets`) and seeded after the tabs (`seedSheets`), in batches.

## Live: room op

- `packages/api-schema/src/room-messages.ts`: `SheetsRoomOp = { kind: 'sheets'; sheetId; tabId; rev; applied?:
SheetWrite; cells?: CellDto[]; created?: true; deleted?: true; refetch?: true }`, a system kind (in
  `SYSTEM_OP_KINDS`). `relaySheets(env, docId, op)` in `room-client.ts` broadcasts ordered. A relay payload over
  `SHEET_RELAY_BYTES_MAX` is sent as `{ refetch: true }` without `applied`/`cells`.
- `room-scope.ts`: a tab-scoped session gets the op only when `op.tabId` is its tab.
- Presence: `sheet-presence` (`{ tabId, sheetId, ranges: IdRange[] | null, editing: boolean }`) in
  `PRESENCE_OP_KINDS`, ephemeral, relayed like `plan-presence`, re-said when someone new joins and on rejoin.

## Editor slice

- **Gate (cost)**: a Sheet element's content router (`ShapeContentRouter`) loads `PlanSheetView` with
  `next/dynamic`, so the sheet chunk (the grid, the store client and the engine) loads the first time a Sheet is
  drawn. `hasPlanContent` (`apps/live/hooks/plan/usePlanNeeded.ts`) counts `plan-sheet`, so a tab with a Sheet loads
  the document's items once, for the card functions.
- **Bridge** (`apps/live/hooks/sheets/useSheetsBridge.ts`, tiny, in the main bundle): `{ scope, activeTabId, self,
canEdit, locale, peers, pushUndo, toast, notify, sendPresence, commitElements, undo, redo, switchToPlan,
selectElement, attach }`, made in `useEditorState` and provided by `EditorView` (`SheetsBridgeContext`). The room
  hands it `sheets` system ops and `sheet-presence` ops (`useRoomConnection`); the sheet chunk `attach`es its
  handlers, and before it has, every op is dropped (the first load reads the sheets fresh). A rejoin resyncs.
- **Store client** (`apps/live/components/sheets/sheet-store-client.ts`, in the lazy sheet chunk): a module store
  per document (`sheetStoreFor(deps)`), `useSyncExternalStore`-subscribed. State per sheet: the confirmed sheet, the
  pending writes (by write id) and the view (confirmed with the pending laid over it, `rebase`); per-tab load status
  (`idle | loading | ready | error`); one `Workbook` per tab. Actions: `loadTab(tabId)`, `create(create, seed?,
{ onRefused })`, `write(sheetId, write, { undoable })`, `writeAll(edits, { undoable })` (several writes, possibly to several sheets, as one change: all checked first, one undo step), `remove(sheetId)`, `receive(op)`, `resync()`, `settle()`.
  - Optimistic: `write` splits the change with `splitWrite` (at most `SHEET_WRITE_CELLS_MAX` cells and
    `SHEET_WRITE_BYTES_MAX` bytes a part), validates each part against the sheet as the parts before it leave it,
    applies the whole change locally, pushes one undo step (`inverseSheetWrite` from the pre-write sheet), and sends
    the parts in order. On a refusal it toasts by `sheetRefusalMessage(error)`, drops the pending part and refetches
    the sheet.
  - Writes to one sheet are sent one at a time in order (a per-sheet queue), so the server sees them as made.
  - Room ops: `mergeSheetChange`; own ops (matched by write id) confirm the pending part; a gap or `refetch` →
    `refetchSheet` (debounced `SHEET_REFETCH_DEBOUNCE_MS`).
  - The workbook evaluates lazily and is told which cells changed (`updateSheet(sheet, touched)`); a value is worked
    out when it is read, so a change costs what depends on it (no frame slicing). Cards reach it through
    `setCards(cardSourceOf(items, types, ...))` from `useSheetModel` when any formula uses a card function.
- **Model** (`apps/live/components/sheets/useSheetModel.ts`): attaches the store to the room through the bridge
  (reference-counted across the tab's Sheets), loads the tab, makes a placed sheet (`takePlacedSheet`: blank, or
  from a dropped CSV with its file name) or a copy (`copyOf`: from the loaded source, a clipboard seed, or the
  server; a copy whose source the server cannot find is refused with the spec's paste toast and the element
  removed).
- `apps/live/lib/api/sheets.ts`: `fetchSheets(scope, { tabId | ids })`, `createSheet`, `writeSheet`, `deleteSheet`,
  each dispatching `isOfflineId(docId)` to `lib/offline/offline-sheets.ts`.
- Offline record: `OfflineDocumentRecord.sheets?: SheetDto[]`; `offline-sheets.ts` applies `applySheetWrite` inside
  `serializeOfflineWrite`.
- Take offline: `takeCloudOffline` fetches every sheet (`fetchSheets({ all: true })` via `ids` batches from a
  `GET /sheets?tabId=` per tab) and aborts without them. Sync to cloud: `sheets: sheetsAsCreates(rec.sheets)`.
- Duplicate document: cloud body `sheets` (same ids); offline: copied records. Duplicate Tab (`useTabActions`): the
  new tab's Sheet elements get new sheet ids and a `copyOf` create each (`remint-element-ids` keeps `planSheet`
  pointing at the new ids).
- Drive mirror: `DocumentEnvelope.document.sheets?` (optional; file stays version 1), export via `fetchSheets`, import
  via `sheetsAsCreates`.
- Element copy and paste: the canvas clipboard payload gains `sheets?: SheetDto[]` for pasted Sheet elements
  (cut at `SHEET_WRITE_CELLS_MAX` cells: past it, a paste into another document is refused with the spec's toast;
  within the same document it uses `copyOf`).

## Undo

- `useItemUndo`'s journal takes any step; the sheet store client pushes `{ undo, redo }` closures through the
  bridge's `pushUndo`. Undo writes `inverseSheetWrite(before, applied)` with `undo: true` (never refused for a title
  its own undo puts back); redo writes the change again. A change sent in parts (a big paste), or reaching several
  sheets (Insert Cells, a cut whose cells other sheets' formulas read, a replacing CSV import), is one step.

## The sweep

- `apps/api/src/sheet-sweep.ts`, run from the daily `scheduled` handler (`index.ts`): it checks up to
  `SHEET_SWEEP_TABS_MAX` tabs that hold sheets, chosen at random each day (stateless; every tab is seen within days),
  reads each tab's elements (`plan-sheet` → `planSheet.sheetId`, `framedSheetIds`), sets `unframed_since = now` on
  sheets no element frames (where null), clears it on framed ones, and deletes sheets whose `unframed_since` is
  older than `SHEET_UNFRAMED_DAYS` (30). Logs `[sheets] sweep` with counts.

## Agents

- Engine: `packages/agent-verbs/src/sheets/` (`sheet-state.ts` `readSheets`, `resolveSheet` (title case aside, id,
  or an id prefix of 4+; a title two tabs share is `sheet_ambiguous`), `workbookFor` (the tab's sheets, `en-GB`, Plan
  cards when `usesCards()`); `sheet-listing.ts` `listSheets`; `read-sheet.ts` `readSheet` over the engine's
  `readRange`; `sheet-change-build.ts` `buildSheetChange` (each change to writes with the engine's commands:
  `writeRows`, `clearRanges`, `formatRanges`, `insertAxis`, `deleteAxis`, `sortRange`, `sortSheet`, `freeze`);
  `change-sheet.ts` `changeSheet` (each write `POST .../sheets/:id/writes` with a fresh `wid`, split by
  `splitWrite`, the answer's `applied` applied locally so the next change reads what is stored; a refusal stops the
  rest and returns the lines applied); `add-sheet.ts` `addSheet` (create blank, fill by writes, then one changeset
  adding a `createShape('plan-sheet')` element at `placeBeside` from `@livediagram/items`, D31 as boards);
  `sheet-refusals.ts` `SHEET_REFUSAL_WORDS`, one line per `SHEET_ERRORS` code, read by `apiRefusalOf`.
- CLI verbs (`packages/agent-verbs/src/verbs/sheet.ts`, resource `sheet`, named only in the top help): `sheetLs`,
  `sheetGet`, `sheetSet`, `sheetAdd`, `sheetInsertRows`, `sheetInsertCols`, `sheetRmRows`, `sheetRmCols`.
- MCP (`apps/mcp/src/sheet-tools.ts`, registered from `tools.ts`): `list_sheets` (read: `tabId?`), `read_sheet`
  (read: `sheet`, `range?` default the filled range; non-empty cells as `{ at, input, value, display }`, at most
  `AGENT_READ_CELLS_MAX` cells scanned and `SHEET_READ_CHARS_MAX` characters answered, `truncated` + `note`),
  `change_sheet` (destructive: `sheet`, `changes[1..50]` of `set {at, rows}`, `clear {range, what}` (default
  `all`), `format {range, format}`, `insert_rows {at, count, side}`, `insert_cols {at, count, side}`,
  `delete_rows {rows}`, `delete_cols {cols}`, `rename {title}`, `sort {by, range?, descending, header}`,
  `freeze {rows, cols}`), `add_sheet` (write: `tabId?`, `title?`, `rows?` or `csv?`). Schemas in
  `packages/agent-verbs/src/mcp/sheet-schema.ts`; the server instructions in `packages/agent-verbs/src/mcp/schema.ts` mention them.
- Telemetry: `Mcp·Used·ListSheets|ReadSheet|ChangeSheet|AddSheet` and `Cli·Used·Sheet*`, charted in
  `apps/telemetry` (`apps/telemetry/app/catalogue/connections.ts`, `cli-commands.ts`).
- Docs: `docs/specs/015-api/mcp-server.md` §4.9c, read-only table and output table; `docs/specs/015-api/cli.md`.

## Errors and edge cases

| Case                                                | Handling                                                                                       |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Write to a sheet another person deleted             | `404 sheet_not_found`; the store drops it; the element draws "Sheet not found" with **Remove** |
| Element whose sheet is not in the store             | "Sheet not found" face (dashed outline), offering Remove                                       |
| Concurrent writes to one sheet                      | Rev-guarded batch, retried up to 3 times, then `409 sheet_busy` (toast, refetch)               |
| Insert after a row someone deleted                  | The engine resolves to the stored neighbour or the end                                         |
| Room op before the GET answer                       | Held until the load ends, then merged by rev                                                   |
| Offline record without `sheets`                     | Empty store                                                                                    |
| Paste of a sheet into another document over the cap | Refused with the spec toast; nothing is pasted                                                 |
| A create with a taken title (agent)                 | `409 sheet_title_taken`; the editor picks the next free title itself                           |

## Security and trust

- Every route passes the document gate; tab-scoped grants are confined by `sheets.tab_id`.
- Sheets never change from a client socket; `sheets` is a system op; presence carries ids and ranges only.
- Inputs and formats are validated by the engine's `validateWrite` on the server before storage; text is drawn as
  text, never HTML; `HYPERLINK` schemes allow-listed.
- The api evaluates formulas only for renders and agents, under the engine's budgets, so a hostile sheet costs at
  most `RECALC_READS_MAX` reads per render.
- `updated_by` is the hashed person id, never the owner id.

## Performance and limits

- GET of a full sheet: 50,000 cells × typical 40 bytes ≈ 2 MB JSON (worst 4 MB by the bytes cap), one per sheet on
  the tab, only when a tab with a sheet opens. The tab's sheets come in one request.
- A write is one D1 batch of at most 6 statements, independent of its cell count.
- A whole-sheet sort is one layout write (`orderRows`, ≤ 10,000 ids ≈ 70 KB); no cell is rewritten.
- Room op carries only the landed write and the touched cells, capped at `SHEET_RELAY_BYTES_MAX`.

## Observability

Log fingerprints (`[sheets]`): api `sheets.rejected <error>`, `sheets.write.retry`, `sheets.write.busy`,
`sheets.full`, `sheets.created`, `sheets.deleted`, `sheets.sweep`; editor `sheets.refetch.gap`,
`sheets.write.failed <error>`, `sheets.offline.write`, `sheets.recalc.truncated`, `sheets.load.failed`. Never
inputs, formats or titles.

## Testing

| Rule                                                         | Test                                                                                                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Routes: create, list, gates, tab scope, rejections, caps     | `apps/api/src/routes/sheet-routes.test.ts` ("creating and listing sheets", "access")                                                                                                 |
| Write batch: upsert, patch per key, clear, rows, rename      | `apps/api/src/routes/sheet-routes.test.ts` ("writes")                                                                                                                                |
| Rev race retries then busy; huge write relayed as refetch    | `apps/api/src/routes/sheet-routes.test.ts` ("writes")                                                                                                                                |
| Delete; copy a sheet; copy a document; seeds                 | `apps/api/src/routes/sheet-routes.test.ts` ("deleting, copies and seeds")                                                                                                            |
| Sweep marks, clears, deletes                                 | `apps/api/src/sheet-sweep.test.ts`                                                                                                                                                   |
| Room op scoped to the tab                                    | `apps/api/src/room-scope.test.ts`                                                                                                                                                    |
| Store client: optimistic, reconcile, gap, queue, split, undo | `apps/live/components/sheets/sheet-store-client.test.ts`                                                                                                                             |
| Presence: receive, throttle, re-say                          | `apps/live/components/sheets/sheet-presence-store.test.ts`                                                                                                                           |
| Model: attach, load, placed and copied sheets, cards         | `apps/live/components/sheets/useSheetModel.test.tsx`                                                                                                                                 |
| Bridge: room ops, attach, undo journal                       | `apps/live/hooks/sheets/useSheetsBridge.test.tsx`                                                                                                                                    |
| Api client, offline store, clipboard seeds                   | `apps/live/lib/api/sheets.test.ts`, `lib/offline/offline-sheets.test.ts`, `lib/clipboard-payload.sheets.test.ts`                                                                     |
| Agent verbs, MCP tools and output schemas                    | `packages/agent-verbs/src/sheets/sheet-engine.test.ts`, `packages/agent-verbs/src/verbs/sheet.test.ts`, `apps/mcp/src/sheet-tools.test.ts`, `output-schema.test.ts`, `tools.test.ts` |

## Constants and configuration

| Constant                    | Value  | Provenance / safe range                              |
| --------------------------- | ------ | ---------------------------------------------------- |
| `SHEET_WRITE_RETRIES`       | 3      | As items                                             |
| `SHEET_REFETCH_DEBOUNCE_MS` | 400    | As items                                             |
| `SHEET_RELAY_BYTES_MAX`     | 262144 | Default (D5); well under a WebSocket frame's 1 MB    |
| `SHEET_UNFRAMED_DAYS`       | 30     | Spec                                                 |
| `SHEET_SWEEP_TABS_MAX`      | 500    | Default (D6); keeps the cron inside its CPU budget   |
| `SHEET_IDS_PER_GET_MAX`     | 50     | Default (D7)                                         |
| `AGENT_READ_CELLS_MAX`      | 5000   | Default (D8); a read an agent can hold               |
| `SHEET_READ_CHARS_MAX`      | 100000 | Default; about 25,000 tokens of cells a read answers |
