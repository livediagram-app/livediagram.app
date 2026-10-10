# Sheet store blueprint

Derived from [Sheet store](../sheet-store.md). Implementation contract for the api's sheet tables and routes, the
room op, the editor's sheet slice, the offline store, copies, deleting a sheet and the agent doors. The pure model and
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
  unframed_since INTEGER,              -- renamed unreferenced_since by 0079
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

Migration `apps/api/migrations/0079_sheet_refs.sql` (Deleting a sheet):

```sql
ALTER TABLE sheets RENAME COLUMN unframed_since TO unreferenced_since;
ALTER TABLE sheets ADD COLUMN delete_when_unreferenced INTEGER;  -- 1: deleted with its element; gone once unreferenced
CREATE TABLE sheet_refs (
  tab_id TEXT NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  sheet_id TEXT NOT NULL,             -- a planSheet.sheetId or planSheet.copyOf on the tab
  PRIMARY KEY (tab_id, sheet_id)
);
CREATE INDEX sheet_refs_sheet ON sheet_refs(sheet_id);
CREATE INDEX sheets_unreferenced ON sheets(unreferenced_since) WHERE unreferenced_since IS NOT NULL;
CREATE TRIGGER sheet_refs_removed AFTER DELETE ON sheet_refs ...  -- settle step 1 then 2, for OLD.sheet_id
CREATE TRIGGER sheet_refs_added AFTER INSERT ON sheet_refs ...    -- settle step 3, for NEW.sheet_id
```

The triggers find the sheet's document through `document_tabs` for the row's tab, and stamp
`CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)` (milliseconds, SQLite's clock).

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
| DELETE | `/sheets/:sheetId`        | edit | `?whenUnreferenced=true`                 | 204                                          |

- `SheetCreate = { id?: string; tabId: string; title: string; layout?: SheetLayout; cells?: CellDto[]; copyOf?:
string; restore?: true }`. `copyOf` copies another sheet of the document server-side (cells and layout), with the new title; the
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
    the parts in order. On a refusal (an `ApiError` other than status 0, 408, 429 or 5xx) it toasts by
    `sheetRefusalMessage(error)`, drops the pending part and refetches the sheet.
  - Transient failures (`isTransientWriteError`, `sheet-write-retry.ts`: no `ApiError` at all, or status 0, 408,
    429, 5xx) keep the part pending and send it again after `sheetWriteRetryMs(attempt)` (`SHEET_WRITE_RETRY_MS`
    500 ms doubling to `SHEET_WRITE_RETRY_MAX_MS` 30 s), inside the sheet's queue so later writes wait behind it;
    before each resend it stops if the part is no longer pending (the room confirmed it, the answer having been
    lost, or the sheet went). The wait is injectable (`SheetStoreDeps.wait`) for tests.
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

## Template starts

([Spec](../sheet-store.md#template-starts).) `PlanSheetRef.start` (validated by `isPlanSheetRef`:
`PLAN_SHEET_START_PATTERN`, kebab-case) names a template start. `@livediagram/sheets` `template-starts.ts`:
`TEMPLATE_STARTS` (`budget-planner`, `timesheet`, `contact-list`, `task-tracker`), `isTemplateStart`,
`templateStart(id, now)` (title and `SheetStarter`, dates from `now`) and `templateSheet({ id, tabId, start, now, dark,
rand })` (an `emptySheet`, `setupWrite` with the Header look, the header frozen and the default size, applied with
`applySheetWrite`, as `{ id, tabId, title, layout, cells }`). `@livediagram/templates`: `hasTemplateSheets(tabs)`
(engine-free, in the index) and, at the `@livediagram/templates/template-sheets` subpath so only a caller making sheets
bundles the engine, `materialiseTemplateSheets(tabs, now, rand)` (`{ tabs, sheets: SheetCreateRequest[] }`, tinted dark
when the tab's `backgroundColor` is not `isLightColor`, the mark dropped from each Sheet made). Callers:

- `POST /api/documents` (`routes/documents.ts`): after the tabs validate, the made sheets are appended to the body's
  seed sheets and go through `readSeedSheets` / `seedSheets`; log `[documents] template sheets made`.
- Changesets (`apps/api/src/changesets/template-sheets.ts` `makeTemplateSheets`, from `submitChangeset` for a `replace`): each sheet
  inserted with `insertSheetStatements` unless it exists, the tab is full (`DOCUMENT_SHEETS_MAX`,
  `DOCUMENT_CELLS_MAX`: log `[changeset] template sheet skipped`) or it does not validate; only the Sheets made lose
  the mark; never a refusal.
- The wizard's Local only create (`apps/live/lib/template-sheets.ts` `withTemplateSheets`, which imports the subpath
  only when `hasTemplateSheets`), stored as the record's `sheets` by `offlineCreateDocument`.
- The editor (`useSheetModel`): a Sheet still carrying a known `start`, its sheet absent once the tab is `ready`, for
  someone who may edit: `templateSheet` (`dark` from the canvas surface), `store.create` (on `sheet_exists`, `resync`),
  then `tickElements` drops the mark (no undo step). `PlanSheetView` shows Opening Sheet, never "no longer in this
  document", while `start` (as `copyOf`) is set.
- `freshCopyFields` copies a Sheet with `start` as `{ sheetId: new, start }`.

## Undo

- `useItemUndo`'s journal takes any step; the sheet store client pushes `{ undo, redo }` closures through the
  bridge's `pushUndo`. Undo writes `inverseSheetWrite(before, applied)` with `undo: true` (never refused for a title
  its own undo puts back); a change holding a row or column deletion has its layout half worked out when Undo is
  pressed (`inverseLayoutChanges` against the sheet's view, each sheet's later parts against what the earlier ones
  leave), so the undo merges into the sheet as it is then; redo writes the change again. A change sent in parts (a big paste), or reaching several
  sheets (Insert Cells, a cut whose cells other sheets' formulas read, a replacing CSV import), is one step.

## Deleting a sheet

- **Reference index** (`apps/api/src/db/sheet-refs.ts`):
  - `sheetRefIds(elements)`: every `plan-sheet` shape's `planSheet.sheetId` and `planSheet.copyOf`, deduplicated.
  - `REFERENCED` (SQL fragment): `EXISTS (SELECT 1 FROM sheet_refs r JOIN document_tabs dt ON dt.tab_id = r.tab_id
WHERE r.sheet_id = sheets.id AND dt.document_id = sheets.document_id)`. A sheet id is unique only in its
    document (a copied document keeps them), so a reference counts only through a tab of the sheet's document.
  - `sheetRefReplaceStatements(env, tabId, ids)`: `DELETE FROM sheet_refs WHERE tab_id = ?1 AND sheet_id NOT IN
(json_each(?2))`, then `INSERT OR IGNORE ... SELECT ?1, value FROM json_each(?2)` when `ids` is non-empty.
  - `sheetSettleStatements(env, documentId, now)`, in order:
    1. `DELETE FROM sheets WHERE document_id = ?1 AND delete_when_unreferenced = 1 AND NOT REFERENCED`;
    2. `UPDATE sheets SET unreferenced_since = ?2 WHERE document_id = ?1 AND unreferenced_since IS NULL AND NOT
REFERENCED`;
    3. `UPDATE sheets SET unreferenced_since = NULL WHERE document_id = ?1 AND unreferenced_since IS NOT NULL AND
REFERENCED`.
       Each is bounded by the document's sheets (`DOCUMENT_SHEETS_MAX`, the `sheets` primary key prefix), and is one
       index probe that matches nothing for a document without sheets.
  - `sheetRefCopyStatement(env, fromTabId, toTabId)`: `INSERT INTO sheet_refs SELECT ?2, sheet_id FROM sheet_refs
WHERE tab_id = ?1` (a copied document's tabs, without a parse).
- **Where it runs**: `tabWriteStatements` (every editor save and every changeset) appends
  `sheetRefReplaceStatements` after the tabs and `document_tabs` upserts (the FK and the triggers read them). The
  settling runs in the triggers, per reference added or removed, so a write whose references are unchanged settles
  nothing. `seedTabs`
  appends `sheetRefReplaceStatements` per tab (its sheets are seeded after). The document copy appends
  `sheetRefCopyStatement` per tab. `deleteTabRow` runs `sheetSettleStatements` after unlinking: the link the triggers
  find the document by is gone first (the tab's rows go by the FK cascade, or stop counting through the join). `swapTabData` changes no element, so it
  adds nothing. A create stores `unreferenced_since = CASE WHEN REFERENCED THEN NULL ELSE now END`, so a sheet whose
  element never reaches the api expires too.
- **Delete when unreferenced**: `DELETE /sheets/:sheetId?whenUnreferenced=true` runs one batch: `UPDATE sheets SET
delete_when_unreferenced = 1 WHERE document_id = ? AND id = ?`, then `DELETE FROM sheets WHERE document_id = ? AND
id = ? AND NOT REFERENCED RETURNING id`. A row returned relays `{ deleted: true }`; otherwise the tab write that
  removes the last reference deletes it (settle step 1) without a relay: nothing in the document shows it. 204
  either way; `404 sheet_not_found` when there is no such sheet.
- **Restore**: `SheetCreate.restore?: true` (the editor's undo). When the id is stored on the same tab, the create
  sets `delete_when_unreferenced = NULL` and answers 200 with the stored sheet; otherwise it creates as usual. A
  restore takes up to `SHEET_CELLS_MAX` cells in one request (as a seed does).
- **Expiry** (`apps/api/src/sheet-sweep.ts` `runSheetExpiry`, from the daily `scheduled` handler): repeatedly reads
  `SELECT document_id, id, cell_count FROM sheets WHERE unreferenced_since < ?cutoff ORDER BY unreferenced_since
LIMIT SHEET_EXPIRY_BATCH` (the partial index), deletes them in one batch (cells by cascade), taking sheets in
  order while the batch holds at most `SHEET_EXPIRY_BATCH_CELLS` cells (always at least one), and stops when none are
  left or the cells deleted reach `SHEET_EXPIRY_CELLS_MAX`; the rest waits a day. Cost follows what expired, not
  how many tabs or sheets exist. Logs `[sheets] sheets.expired { sheets, cells, more }`.
- **Editor**:
  - `apps/live/lib/sheet-references.ts` `sheetsDeletedWith(tabs, activeTabId, targetIds)`: the sheet ids of the
    targets' Sheet elements (not a copy not yet made: it has no sheet) that no element outside the targets, on any
    tab, references by `sheetId` or `copyOf`.
  - `apps/live/hooks/sheets/useSheetDeleteGuard.ts`: `guard(targetIds)` answers `null` when no sheet goes (delete at
    once) or a promise of `{ release }` (confirmed) or `null` (cancelled), after `useConfirm` with the spec's copy
    (title by `sheetTitle` from the bridge, falling back to `Sheet`). When the sheet chunk has not attached, it
    answers `null`: the sheet is then left as a Cut's.
  - `useElementSelectionActions`: `deleteSelected(opts?)` and `deleteMultiSelected(opts?)` take `{ cut: true }` (Cut
    and the context menu's Cut skip the guard); a pending guard deletes the targets it was asked about when confirmed,
    then calls `release()`.
  - Bridge: `SheetsHandlers.release(ids)` and `SheetsHandlers.title(id)`; the bridge's `releaseSheets(ids)` and
    `sheetTitle(id)` answer false / undefined before the chunk attaches.
  - Store client: `release(ids)` keeps each sheet's view as a session snapshot (`released`), drops it, and sends
    `deleteSheet(scope, id, { whenUnreferenced: true })`. `useSheetModel`, finding its sheet missing on a loaded tab,
    first calls `restoreReleased(id, tabId)`: a snapshot is created again (`restore: true`, the next free title if its
    own is taken) and the snapshot dropped. Redo removes the element without a guard.
  - Offline: `offlineDeleteSheet` deletes at once (the editor established nothing references the sheet); a restore
    of an id still stored keeps it.

## Agents

- Engine: `packages/agent-verbs/src/sheets/` (`sheet-state.ts` `readSheets`, `resolveSheet` (title case aside, id,
  or an id prefix of 4+; a title two tabs share is `sheet_ambiguous`), `workbookFor` (the tab's sheets, `en-GB`, Plan
  cards when `usesCards()`); `sheet-listing.ts` `listSheets`; `read-sheet.ts` `readSheet` over the engine's
  `readRange`; `sheet-change-build.ts` `buildSheetChange` (each change to writes with the engine's commands:
  `writeRows`, `clearRanges`, `formatRanges`, `insertAxis`, `deleteAxis`, `sortRange`, `sortSheet`, `freeze`);
  `change-sheet.ts` `changeSheet` (each write `POST .../sheets/:id/writes` with a fresh `wid`, split by
  `splitWrite`, the answer's `applied` applied locally so the next change reads what is stored; each change is
  first checked whole by `capsRefusal` (`writesCapsProblem` against the document's cells from `readSheets`), so a
  change past a cap sends nothing; a refusal stops the rest and returns the lines applied, a change whose later
  part was refused as `partly <line>: <n> of its <m> cells landed before the refusal`); `add-sheet.ts` `addSheet`
  (the first cells checked by `capsRefusal` before the create, then create blank, fill by writes, then one changeset
  adding a `createShape('plan-sheet')` element at `placeBeside` from `@livediagram/items`, D31 as boards; a fill
  that fails, or a placing changeset the api refuses, deletes the sheet (`DELETE .../sheets/:id`, log
  `[sheets] add_sheet failed; unplaced sheet deleted`); a placing request that never answered keeps it);
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
| Delete with element, removal not saved yet          | Marked `delete_when_unreferenced`; the tab write removing the last reference deletes it        |
| Undo before the delete lands                        | The restore keeps the stored sheet and clears the mark (200)                                   |
| Redo of a confirmed delete                          | The element goes without asking; its sheet waits as a Cut's (30 days)                          |
| Restored title now taken on the tab                 | `uniqueSheetTitle` (the next free title) before the restore is sent                            |
| Delete before any Sheet has drawn                   | No dialog; the sheet waits as a Cut's                                                          |
| A sheet whose element never reached the api         | Noted at create (`sheetNoteUnreferencedStatement`), so it expires                              |
| Agent change past a sheet or document cap           | `capsRefusal` before any part is sent: the cap's code, "none of it was written"                |
| Agent change whose later part the api refuses       | The landed parts kept and reported as a `partly` line, then the refusal                        |
| add_sheet fill or placing refused                   | The made sheet deleted, so a retry does not spend the document's cells again                   |
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
- Deleting a sheet adds one statement to every tab write (two when the tab has a Sheet): measured on the test
  harness's SQLite, 0.055 ms a write with no sheets and 0.066 ms at `DOCUMENT_SHEETS_MAX`, flat in the number of
  sheets; the settling triggers run only for references added or removed. It rides the write's existing batch (no
  extra D1 round trip). The daily expiry reads only expired rows by the partial index.

## Observability

Log fingerprints (`[sheets]`): api `sheets.rejected <error>`, `sheets.write.retry`, `sheets.write.busy`,
`sheets.full`, `sheets.created`, `sheets.deleted`, `sheets.delete.deferred`, `sheets.restored`, `sheets.expired`; editor `sheets.refetch.gap`,
`sheets.write.failed <error>`, `sheets.write.retrying <attempt, status>`, `sheets.offline.write`, `sheets.recalc.truncated`, `sheets.load.failed`. Never
inputs, formats or titles.

## Testing

| Rule                                                            | Test                                                                                                                                                                                                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes: create, list, gates, tab scope, rejections, caps        | `apps/api/src/routes/sheet-routes.test.ts` ("creating and listing sheets", "access")                                                                                                                                                          |
| Write batch: upsert, patch per key, clear, rows, rename         | `apps/api/src/routes/sheet-routes.test.ts` ("writes")                                                                                                                                                                                         |
| Rev race retries then busy; huge write relayed as refetch       | `apps/api/src/routes/sheet-routes.test.ts` ("writes")                                                                                                                                                                                         |
| Delete; copy a sheet; copy a document; seeds                    | `apps/api/src/routes/sheet-routes.test.ts` ("deleting, copies and seeds")                                                                                                                                                                     |
| Template starts: build, materialise, create, changeset, editor  | `packages/sheets/src/template-starts.test.ts`, `packages/templates/src/template-sheets.test.ts`, `apps/api/src/routes/sheet-routes.test.ts`, `apps/api/src/changesets/submit.test.ts`, `apps/live/components/sheets/useSheetModel.test.tsx`   |
| Reference index: sheetId and copyOf, marks, clears, settles     | `apps/api/src/db/sheet-refs.test.ts`                                                                                                                                                                                                          |
| Delete when unreferenced, now or on the last reference; restore | `apps/api/src/routes/sheet-routes.test.ts` ("deleting with the element")                                                                                                                                                                      |
| Expiry deletes past 30 days, bounded by cells                   | `apps/api/src/sheet-sweep.test.ts`                                                                                                                                                                                                            |
| Which sheets a delete takes (duplicates, copies, other tabs)    | `apps/live/lib/sheet-references.test.ts`                                                                                                                                                                                                      |
| Confirm, cancel, Cut skips, release, undo restores              | `apps/live/hooks/sheets/useSheetDeleteGuard.test.tsx`, `hooks/canvas/useElementSelectionActions.test.ts`, `components/sheets/sheet-store-client.test.ts`, `components/sheets/useSheetModel.test.tsx`, `hooks/sheets/useSheetsBridge.test.tsx` |
| Offline restore keeps a stored sheet; delete query              | `apps/live/lib/offline/offline-sheets.test.ts`, `lib/api/sheets.test.ts`                                                                                                                                                                      |
| Room op scoped to the tab                                       | `apps/api/src/room-scope.test.ts`                                                                                                                                                                                                             |
| Store client: optimistic, reconcile, gap, queue, split, undo    | `apps/live/components/sheets/sheet-store-client.test.ts`                                                                                                                                                                                      |
| Transient write failures resent with backoff, refusals dropped  | `apps/live/components/sheets/sheet-store-client.test.ts`, `components/sheets/sheet-write-retry.test.ts`                                                                                                                                       |
| Undo of a deletion merges into the sheet as it is               | `packages/sheets/src/store-inverse-delete.test.ts`, `apps/live/components/sheets/sheet-store-client.test.ts`                                                                                                                                  |
| Presence: receive, throttle, re-say                             | `apps/live/components/sheets/sheet-presence-store.test.ts`                                                                                                                                                                                    |
| Model: attach, load, placed and copied sheets, cards            | `apps/live/components/sheets/useSheetModel.test.tsx`                                                                                                                                                                                          |
| Bridge: room ops, attach, undo journal                          | `apps/live/hooks/sheets/useSheetsBridge.test.tsx`                                                                                                                                                                                             |
| Api client, offline store, clipboard seeds                      | `apps/live/lib/api/sheets.test.ts`, `lib/offline/offline-sheets.test.ts`, `lib/clipboard-payload.sheets.test.ts`                                                                                                                              |
| Agent verbs, MCP tools and output schemas                       | `packages/agent-verbs/src/sheets/sheet-engine.test.ts`, `packages/agent-verbs/src/verbs/sheet.test.ts`, `apps/mcp/src/sheet-tools.test.ts`, `output-schema.test.ts`, `tools.test.ts`                                                          |

## Constants and configuration

| Constant                    | Value  | Provenance / safe range                                   |
| --------------------------- | ------ | --------------------------------------------------------- |
| `SHEET_WRITE_RETRIES`       | 3      | As items                                                  |
| `SHEET_REFETCH_DEBOUNCE_MS` | 400    | As items                                                  |
| `SHEET_RELAY_BYTES_MAX`     | 262144 | Default (D5); well under a WebSocket frame's 1 MB         |
| `SHEET_UNFRAMED_DAYS`       | 30     | Spec                                                      |
| `SHEET_EXPIRY_BATCH`        | 25     | Default (D6); expired sheets read per query               |
| `SHEET_EXPIRY_BATCH_CELLS`  | 100000 | Default (D6); cells one D1 batch deletes, 2 full sheets   |
| `SHEET_EXPIRY_CELLS_MAX`    | 500000 | Default (D6); cells one daily run deletes, 10 full sheets |
| `SHEET_IDS_PER_GET_MAX`     | 50     | Default (D7)                                              |
| `AGENT_READ_CELLS_MAX`      | 5000   | Default (D8); a read an agent can hold                    |
| `SHEET_READ_CHARS_MAX`      | 100000 | Default; about 25,000 tokens of cells a read answers      |
