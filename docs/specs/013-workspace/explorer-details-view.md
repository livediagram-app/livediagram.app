# Explorer Details view

Status: shipped

The Explorer's third way to show a folder: a dense table in the manner of a desktop file manager's
details pane, one row per folder or document, with the facts that tell documents apart at a glance
(what mode it was last worked in, how much talk is on it, what the reader may do with it, how big it
is, and when it was made and last changed). No categories and no grouping: one flat list, sorted
by any column.

## The view toggle

- The browse views' toggle ([List / card view](../006-document/document-snapshots.md#list--card-view))
  holds three choices, in this order: **List**, **Cards**, **Details**. The choice is device-local
  and shared by every browse view and the team library, as before.
- Each button is icon-only with a hover card: Details reads "Details view" over "A sortable table:
  type, comments, access, size and dates."
- Switching emits `UI / Toggled / ExplorerViewDetails` (the List and Card types stay).

## Columns

| Column   | A document shows                                                                 | A folder shows                          |
| -------- | -------------------------------------------------------------------------------- | --------------------------------------- |
| Name     | Its name (a link that opens it), favourite star, Local only and Made by AI pills | Its name (opens it), default marker     |
| Type     | The mode its most recently written tab is in: the mode's icon and name           | "Folder"                                |
| Comments | How many comments its tabs hold, every thread, resolved or not; empty for none   | Empty                                   |
| Access   | The reader's level as the role's icon: Editor, Participant or Viewer             | Empty                                   |
| Size     | "N objects (S)": elements across all its tabs, and the stored size of those tabs | "N items": its subfolders and documents |
| Created  | Date and time it was created                                                     | Date and time it was created            |
| Updated  | Date and time it was last saved                                                  | Date and time it was last changed       |

- **Type** is the mode of the tab written most recently, so a document worked in Draw last week and
  in Plan today reads Plan. An event-storming board's mode is always Diagram. The mode's name and
  icon are the editor's own ([Editor modes](../007-editor/editor-modes.md)).
- **Access** is the reader's own level ([Share roles](share-roles.md)): their own documents, team
  documents and documents in this browser are Editor; a document shared with them is the role their
  link grants. The icon is the Share dialog's role icon; its name is the cell's accessible name and its
  tooltip.
- **Size** counts objects (`1 object`, `12 objects`) and shows the stored size in kilobytes
  (`0.4 KB`, `12 KB`), or megabytes from 1 MB (`1.2 MB`): one decimal below 10, whole numbers above.
- **Created** and **Updated** show date and time in the reader's locale, medium date and short time
  ("10 Oct 2026, 16:02").
- **Not yet counted.** A document whose tabs are not all counted yet (see "Where the numbers come
  from") shows **–** in Type, Comments and Size, with the tooltip "Not counted yet". So does a document
  with no tabs, a document shared with the reader, and a document in this browser, whose tabs never
  reach the api.
- A `⋯` ends every row, shown on hover or keyboard focus (always on touch), opening the same menu
  as the list and card views; a right-click opens it too.

## Sorting

- Every column header is a button that sorts by it. The first press sorts in the column's natural
  direction: Name and Type A to Z; Comments, Access (Editor first) and Size largest first; Created and
  Updated newest first. Pressing the sorted column again reverses it.
- The sorted header carries `aria-sort` (`ascending` / `descending`) and an arrow; the others carry
  none.
- **Default:** Updated, newest first, the order every other view lists documents in.
- **Folders first.** Folders always sit above documents, sorted among themselves by the same column
  where they have it (Name, Size by item count, Created, Updated) and by name otherwise.
- Ties keep the name order (A to Z), then the id, so the order is stable.
- The sort is device-local, like the view choice, and the same for every folder.
- **–** cells sort after every counted cell, whichever the direction.

## Preview on a resting hover

- Resting the pointer on a document row for **600 ms** shows a **preview**: the document's snapshot
  at card size with its name beneath, beside the row. It is a hint
  ([Tooltips, hover cards and popovers](../004-interface-design/tooltips-hover-cards-popovers.md#preview)):
  not interactive, dismissed by Escape, closed by moving away or pressing, one at a time, opening at
  once on keyboard focus of the row's name.
- **Preloaded.** Each row asks for its snapshot as it nears the viewport (the thumbnails' own rule,
  [Document SVG snapshots](../006-document/document-snapshots.md)), so the preview paints at once from
  the page's snapshot cache. Rows show no thumbnail themselves.
- Once a preview has opened, moving to the next row shows its preview without the wait, for as long
  as the pointer arrives within 500 ms of the last one closing.
- A folder row has no preview. An empty document previews its undrawn sketch, like its card.

## Drag and drop

- Document rows drag onto folders exactly as list rows and cards do; folder rows take dropped
  documents ([Folders: standalone page](folders.md#standalone-explorer-page)).

## Narrow screens

- Below `md` the table drops Comments, Access and Created; below `sm` it also drops Type and Size,
  leaving Name, Updated and the `⋯`.
- The header row stays visible and sortable at every width.

## Where the numbers come from

- **Tab stats.** Every tab carries a stats record: its mode, its element count, its comment count,
  the byte size of its stored body, and when it was written. The record is written in the same batch
  as the tab, by every write (a save, a changeset, a seeded create, a participant or Q&A write, a
  duplicate's copied tab), so it never drifts from the tab it describes. It lives apart from the tab
  body so a list reads the numbers without reading any body.
- **A document's stats** are summed over the tabs it links: elements, comments and bytes added, the
  mode taken from the tab written last. `GET /api/documents` and each team library carry them on every
  row as `stats` (`{ mode, elements, comments, bytes }`), or `null` when the document has no tabs or one
  of its tabs has no record yet.
- **Counting the existing tabs.** Tabs written before the stats existed are counted by the daily
  cron, a bounded number per run; a write that lands meanwhile keeps its own count, never overwritten
  by the older one. The api logs
  `tab-stats: backfilled n=<n> left=<more|none>` each run.

## Not in scope

- Grouping and categories (by type, by date): the view is one flat list.
- Choosing, ordering or resizing columns.
- Counting documents in this browser or shared with the reader.
