# Sheet sources

A **sheet source** lets an item in one app draw from a range of a sheet in another: a chart in a livedocuments
document keeps its slices or series in step with a range of a liveplanner Sheet (Work Tracker 940), and so does a chart
in a livediagram document, a livedesign design or a liveknowledge page (Work Tracker 1133). [Live data](live-data.md)
grows this into board counts and dashboard metrics, Freeze and tables, on the same rules (Work Tracker 1368). The chart stays the item's own element, drawn in
the item's theme and exported with it; only its numbers come from the sheet.

The platform holds the part every app would otherwise build again: a door into the sheet app that reads one range and
nothing else, a read on the index that checks the reader's own access first, and the signal that tells an open item
the sheet changed. What the reading item shows (the chart) is each reader app's own spec
([livedocuments](../../../../livedocuments/docs/specs/009-elements/pie-chart.md#charts-linked-to-a-liveplanner-sheet),
[livediagram](../../../../livediagram/docs/specs/009-elements/pie-chart.md#charts-linked-to-a-liveplanner-sheet) and
[livedesign](../../../../livedesign/docs/specs/009-elements/pie-chart.md#charts-linked-to-a-liveplanner-sheet) 009-elements,
"Charts linked to a liveplanner sheet"), and the editor's side of it is one copy in `@liveworkspace/workbench`.

## Names

- The **source** is the item holding the sheet (a liveplanner plan); the **reader item** is the item whose element
  draws from it (a livedocuments or livediagram document, a livedesign design). Source apps: liveplanner
  (`SHEET_SOURCE_APPS`). Reader apps: livedocuments, livediagram, livedesign and liveknowledge (`SOURCE_WATCH_APPS`).
- A **range** is a rectangle of a sheet named by its corners' stable row and column ids (`{r1, c1, r2, c2}`), so it
  grows with rows inserted inside it and follows moves, as liveplanner's own charts name theirs. `cols` may pick some
  of its columns. Typed by a person, a range is A1 text (`B2:E9`), turned into ids by the sheet app when it is read.
- A **read** is what one range holds now, as a chart reads it: categories (a first column of text labels them) and
  up to 12 series (a first row of names heads them), the same rules as liveplanner's charts
  (`sheetChartTable`, liveplanner sheet.md "Charts").
- A **watch** is the sheet app's note that a reader item draws from one of its sheets, so a change to that sheet is
  told to it. Kept by the source, a day at most after its last read.

## Reading a range: each reader's own grant

Owner decision (Work Tracker 940): a chart reads its sheet with **each reader's own access**, never with a pass the
link made. A person who can open the plan sees live values; anyone else sees the values last saved on the element.

- `GET /api/index/items/:id/sheets`, with the person's token: the plan's name and its Sheets
  (`{id, name, tabId, a1}`, `a1` the sheet's filled extent, as the default range to offer). A tab-scoped link the
  person holds lists only that tab's sheets.
- `POST /api/index/items/:id/sheet-range` `{sheetId, range | a1, cols?, watch?}`, with the person's token: the read,
  `{itemId, itemName, sheetId, sheetName, range, a1, table, readAt}`. `range` is the ids (an A1 asked for comes back
  as ids, which is what the reader stores), `a1` the range as it stands now, `readAt` the index's clock.
- The index checks the person's own access to the plan (its owner, a joined team member, or a live link they opened,
  the access rule), at any level. Nothing else opens it: a request carrying a share code (`X-Share-Code`), access
  through a public (Community) link, and an app acting for a person (an API token's, the Drive mirror, the data
  export) answer `404`, as an item the caller cannot reach does. A tab-scoped link reads only sheets on its tab: any
  other sheet is `404`.
- Answers are `Cache-Control: no-store`. They are never written to the index.

| Answer                   | When                                                                            |
| ------------------------ | ------------------------------------------------------------------------------- |
| `200` the read           | the person can open the plan and the sheet and range are there                  |
| `400 invalid_range`      | the body is not a sheet id with a range of ids or A1 text                       |
| `404 not_found`          | no such plan, the person cannot reach it, or the sheet is gone or off their tab |
| `409 range_gone`         | a corner row or column of the range was deleted                                 |
| `503 source_unavailable` | the sheet app did not answer (its doors unset, down or slow)                    |

## The door

The sheet app serves two internal doors, on **its own index key** (`INDEX_KEY`, the one the index already calls it
with) and no other key: not the media, Drive, data export, migration or Community key.

- `GET /api/internal/items/:id/sheets` → `{sheets: [{id, name, tabId, a1}]}`; `404` for a plan it does not have.
- `POST /api/internal/items/:id/sheet-range` `{sheetId, range | a1, cols?, watcher?}` →
  `{sheetName, tabId, range, a1, table}`; `404 not_found` for a missing plan or sheet, `409 range_gone` when a
  corner is gone, `400 invalid_range` for a malformed ask.

The door reads **only the asked range**: the categories and series it holds, under the chart caps (500 categories,
12 series), never a cell outside it, a formula's text, a format or a comment. Cells inside it that hold formulas give
their worked-out values. The platform's one client for it is `@liveworkspace/app-doors` (`listSheets`,
`readSheetRange`), which the index calls with `APP_ORIGIN_<APP>` and `INDEX_KEY_<APP>`.

## Keeping in step: the change signal

A reader item refreshes when its sheet changes, never by polling:

1. A read that names `watch: {itemId}` (the reader item) and carries that item's grant (`X-Index-Grant`) asks the
   source to watch: the index checks the grant is its own, for that item, in a reader app, and not a public link's,
   then passes `watcher: <itemId>` to the door. The source keeps `(watcher, sheet)` for `SHEET_WATCH_TTL_MS` (a day)
   from the last read, at most `SHEET_WATCHERS_PER_SOURCE` (50) per plan, the oldest going first.
2. Any change to a watched sheet (a cell, a row or column, a sort, a rename, from a person, a form or an agent) is
   gathered for `SHEET_CHANGE_SETTLE_MS` (1.5 s) and then sent once: `POST /api/index/app/items/:id/sheet-changed`
   `{sheetIds, watchers}` with the sheet app's key (at most 50 sheets and `SHEET_WATCHERS_MAX` (20) watchers a call).
3. The index checks the plan is the calling app's, then tells each watcher that is a live item of a reader app, ten at
   a time: `POST /api/internal/items/:watcher/source-changed` `{app, itemId, sheetIds}` with that app's key. It
   answers `{gone}`: watchers that are no longer items (purged) or not a reader app's, which the source forgets.
4. The reader app's room sends `{kind: "source-changed", app, itemId, sheetIds}` to every session with the item open.
   The frame carries ids only, never values: each session that draws from that sheet reads it again with its own
   grant, so a reader without access learns nothing new.

A missed signal costs only freshness: every open of the reader item reads again.

## Freezing

- The reader keeps the last read on its element, so anything that cannot read the sheet (an export, a thumbnail, a
  preview, a reader without access, an agent) draws those values.
- **Exports and Community copies freeze them**: a file export, a copy made through a Community link and a Community
  visitor's read carry the values and no source, so they never read the sheet again and carry no plan id.
- **Unlink** removes the source and keeps the last values.

## Security

- **No new pass.** The read is the person's own access, checked by the index for each read. The saved values on the
  element are seen by every reader of the reader item: that copy is what an Editor chose to put in the document,
  as typing the numbers in would. The Link to Sheet dialog says so.
- **Narrow door.** The door is on the app's own key, answers one range of one sheet of one plan, and is never
  reachable from a browser. The index builds its URL from the registry and the stored ids.
- **Signals carry nothing.** A change signal names ids, never values, and goes only to items whose own grant asked
  to watch, in a reader app. A watch outlives its last read by at most a day.
- **Limits.** Reads are bounded by the chart caps; watches by `SHEET_WATCHERS_PER_SOURCE`; signals are gathered per
  plan and capped per call.

## Agents and the CLI

Agents read a linked chart's saved values and its source (the plan's and sheet's names, the range), never live
values. An agent may write a link with the plan's ids ([live-data.md](live-data.md) "Agents"): its values stand until
an Editor who can open the plan opens the item and reads it with their own access.
