# Explorer Details view: blueprint

Derived from [Explorer Details view](../explorer-details-view.md) and the Preview hint of
[Tooltips, hover cards and popovers](../../004-interface-design/tooltips-hover-cards-popovers.md#preview).
The spec decides; this file adds engineering precision. Defaults are ledgered in
[DEFAULTS.md](DEFAULTS.md) as `D145` to `D153`.

| File                                                        | Role                                                                                    |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `apps/api/migrations/0084_tab_stats.sql`                    | The `tab_stats` table                                                                   |
| `packages/document/src/tab-stats.ts`                        | `tabStatsOf`, `TabStats`: one counting rule for the api and the browser                 |
| `apps/api/src/db/tab-stats.ts`                              | `tabStatsOfData`, `tabStatsStatement`, `documentStatsSql`, `readDocumentStats`          |
| `apps/api/src/tab-stats-backfill.ts`                        | `runTabStatsBackfill`: the cron's bounded count of tabs without stats                   |
| `apps/api/src/db/tabs.ts`, `apps/api/src/db/documents.ts`   | Every tab write batches `tabStatsStatement`; the summary projection selects `doc_stats` |
| `apps/api/src/participant-write.ts`, `qa-board-write.ts`    | Hand `swapTabData` the next body's stats                                                |
| `packages/api-schema/src/index.ts`                          | `DocumentStats`, `DocumentSummary.stats`                                                |
| `packages/ui/src/hint/*`, `packages/ui/src/PreviewHint.tsx` | Hint kind `preview`: delay, per-kind warm-up (`isHintWarm`), look; `PreviewHint`        |
| `apps/live/app/explorer/useExplorerViewMode.ts`             | `ExplorerViewMode` gains `'details'`                                                    |
| `apps/live/app/explorer/ViewToggle.tsx`                     | The third button                                                                        |
| `apps/live/app/explorer/details/DetailsView.tsx`            | The table: header, folder rows, document rows                                           |
| `apps/live/app/explorer/details/DetailsHeader.tsx`          | Sortable column headers                                                                 |
| `apps/live/app/explorer/details/DetailsDocumentRow.tsx`     | One document row: drag source, preview, `⋯`                                             |
| `apps/live/app/explorer/details/DetailsFolderRow.tsx`       | One folder row: drop target, `⋯`                                                        |
| `apps/live/app/explorer/details/details-columns.ts`         | `DETAILS_COLUMNS`, `sortDetailsEntries`, cell values                                    |
| `apps/live/app/explorer/details/details-format.ts`          | `formatObjects`, `formatBytes`, `formatSize`, `formatDateTime`, `formatItems`           |
| `apps/live/app/explorer/details/details-cells.tsx`          | `TypeCell`, `AccessCell`, `DateCell`, `NoValue`, `SHOWN_FROM_CLASS`                     |
| `apps/live/app/explorer/explorer-view-props.ts`             | `documentEntryPropsFor`: the per-document bindings every view shares                    |
| `apps/live/lib/offline/offline-stats.ts`                    | `offlineDocumentStats`: a document in this browser counted from its record              |
| `apps/live/components/panels/TeamSharedDocuments.tsx`       | The team library's Details branch                                                       |
| `apps/live/app/explorer/details/useDetailsSort.ts`          | The device-local sort                                                                   |
| `apps/live/app/explorer/details/useSnapshotPrefetch.ts`     | Asks for a row's snapshot as it nears the viewport                                      |
| `apps/live/lib/document-space.ts`                           | `readerAccessOf`                                                                        |

## Domain and naming

| Term           | Identifier                     | Meaning                                                                     |
| -------------- | ------------------------------ | --------------------------------------------------------------------------- |
| tab stats      | `TabStats`, table `tab_stats`  | One tab's `mode`, `elementCount`, `commentCount`, `dataBytes`, `writtenAt`  |
| document stats | `DocumentStats`                | `{ mode, elements, comments, bytes }`, summed over a document's linked tabs |
| not counted    | `stats: null`                  | No tabs, or a linked tab without a stats row; the cells show `–`            |
| Details view   | `ExplorerViewMode` `'details'` | The third browse layout                                                     |
| column         | `DetailsColumnId`              | `name`, `type`, `comments`, `access`, `size`, `created`, `updated`          |
| sort           | `DetailsSort`                  | `{ column: DetailsColumnId, direction: 'asc' \| 'desc' }`                   |
| reader access  | `readerAccessOf(doc)`          | `AccessLevel`: `edit` unless the row is shared, then its role               |
| preview        | `HintKind` `'preview'`         | The resting-hover snapshot hint                                             |

## Behaviour and state

### Tab stats

- `tabStatsOf(body, data)` (`@livediagram/document`) is pure. `mode = opensInOf(body)`;
  `elementCount = body.elements.length` (0 when not an array); `commentCount` sums
  `commentThread.comments.length` over the elements; `dataBytes` is the UTF-8 length of `data`.
- `tabStatsOfData(data)` (api) parses a stored body and counts it; a body that is not a JSON object
  counts as an empty Diagram tab with its bytes, flagged `corrupt`.
- `tabStatsStatement(env, tabId, stats, writtenAt)` is
  `INSERT INTO tab_stats (...) VALUES (...) ON CONFLICT(tab_id) DO UPDATE SET` every column. It is
  placed in each batch **after** the `tabs` upsert (the foreign key needs the row):
  `tabWriteStatements`, `seedTabs` (per tab), `swapTabData` (with `nextStats`, guarded by
  `ifStoredData` so it lands only when the swap does), `copyDocument` (re-derived from the copied body
  with `tabStatsOfData`, since a Community copy's redaction drops comments).
- `renameTab` writes no stats: a rename is not work in a mode.
- `documentStatsSql(idSql)` is a scalar subquery over `document_tabs LEFT JOIN tab_stats`:
  `NULL` when the document has no linked tab or any linked tab lacks a row, else
  `json_object('mode', <mode of the row with the greatest written_at, ties by order_index>, 'elements',
SUM, 'comments', SUM, 'bytes', SUM)`. It reads no `tabs` column, so no body.
- `readDocumentStats(text)` parses that JSON; a value that fails to parse or carries a mode that
  `parseEditorMode` rejects is `null` with a warning `tab-stats: unreadable doc_stats`.

### Backfill

`runTabStatsBackfill(env, clock)` loops while under `TAB_STATS_BACKFILL_BUDGET_MS` and
`TAB_STATS_BACKFILL_MAX_ROWS`:

1. `SELECT t.id, t.data FROM tabs t WHERE NOT EXISTS (SELECT 1 FROM tab_stats s WHERE s.tab_id = t.id) LIMIT ?`
   with `TAB_STATS_BACKFILL_PAGE_ROWS`.
2. Each body counts through `tabStatsOfData`; a body that fails to parse counts as Diagram with no elements
   and no comments, its bytes measured, and warns `tab-stats: corrupt tab <id> counted empty`.
3. One batch of `INSERT ... ON CONFLICT(tab_id) DO NOTHING`: a write that landed since step 1
   already wrote the newer stats, which stay.
4. A page shorter than the page size ends the loop: `left=none`; otherwise `left=more`.

It logs `tab-stats: backfilled n=<n> left=<more|none>` once per run and returns the count. The
cron runs it in `waitUntil` beside the other sweeps, its failure logged as
`tab-stats: backfill failed`.

### The view

- `useExplorerViewMode` accepts the stored `'details'`; anything else unknown still falls back to
  the default (`card`).
- `useDetailsSort` reads `livediagram:explorer-details-sort` (`"<column>:<asc|desc>"`); an unreadable
  value is the default `updated:desc`. `toggle(column)` returns the column's natural direction
  (`DETAILS_COLUMNS[column].natural`) when it is not the current column, else the opposite one.
- `sortDetailsEntries(folders, documents, sort, ctx)` returns folders then documents, each sorted by
  the column's key; a missing key (`–`) sorts last in both directions; ties fall back to name
  (locale compare, `sensitivity: 'base'`), then id. Folders without the column use name.
- `ExplorerPane` picks `DetailsView` for `'details'` from the same `ExplorerViewProps`; the team
  library does the same.

### Preview hint

- `useHint('preview')`: pointer enter starts `PREVIEW_OPEN_DELAY_MS`, unless `isHintWarm('preview', now)`
  (a preview open, or one closed less than `PREVIEW_WARMUP_MS` ago), then it opens at once. Focus
  opens at once. Touch long press follows the existing rule (visible text: none).
- `releaseHint` records the close time per warm kind (`tooltip`, `preview`).
- `HintSurface` gets the `preview` look: the hover card's colours, `w-80 p-2`, the hover card's gap and
  arrow.
- `PreviewHint({ preview, children })` wraps a trigger like `HoverCard` and renders `preview` in the
  surface.

## Interfaces and contracts

```ts
export type DocumentStats = { mode: EditorMode; elements: number; comments: number; bytes: number };
// DocumentSummary
stats: DocumentStats | null;
```

- `GET /api/documents` and each team library list carry `stats` on every row. Shared-with-you rows
  (`SharedWithItem`) carry none; the client treats them as not counted.
- `DocumentListItem` gains optional `createdAt` and `stats`. The team sweep copies both; offline rows
  carry `offlineDocumentStats(record)`, cached per `id:savedAt`, with the first tab's mode (`D152`).

## Data and persistence

```sql
CREATE TABLE tab_stats (
  tab_id        TEXT    PRIMARY KEY REFERENCES tabs(id) ON DELETE CASCADE,
  mode          TEXT    NOT NULL,
  element_count INTEGER NOT NULL,
  comment_count INTEGER NOT NULL,
  data_bytes    INTEGER NOT NULL,
  written_at    INTEGER NOT NULL
);
```

- Derived data: deleting every row loses nothing the backfill cannot rebuild.
- The migration creates the table only (constant time); no statement reads a body.
- A tab deleted cascades its row away. A document deleted keeps tabs other documents link, and their
  stats.
- The Trash, restore and purge need nothing: stats follow tabs.

## Errors and edge cases

| Case                                 | Handling                                                  |
| ------------------------------------ | --------------------------------------------------------- |
| Document with no tabs                | `stats: null`, cells `–`                                  |
| Some tabs not yet counted            | `stats: null` until the backfill reaches them             |
| Event-storming board                 | Mode Diagram (`opensInOf`)                                |
| Legacy mode `infographic`            | Illustrate (`opensInOf` reads through `parseEditorMode`)  |
| Corrupt tab body in the backfill     | Counted empty, warned                                     |
| Write racing the backfill            | The write's row wins (`DO NOTHING`)                       |
| Shared row                           | No `stats`: `–`; no Created: `–` "Not known" (`D153`)     |
| Offline row                          | Counted in the browser, the first tab's mode (`D152`)     |
| Unknown stored sort or view mode     | Defaults                                                  |
| Folder row in Type, Comments, Access | Type "Folder", the others empty; sorted by name for those |

## Security and trust

- Stats leave the api only on rows the caller may already list; they say nothing a reader of the
  document could not count.
- No new route, no new input.

## Performance and limits

- The list reads, per document, its `document_tabs` rows and their `tab_stats` rows: narrow rows, no
  body, no overflow page.
- A write adds one small statement to a batch it already sends.
- The backfill parses at most `TAB_STATS_BACKFILL_PAGE_ROWS` bodies at once (each at most
  `MAX_TAB_BYTES`), and at most `TAB_STATS_BACKFILL_MAX_ROWS` per run.
- The Details view renders every row of the folder, as the list does; each row's snapshot prefetch
  uses one `IntersectionObserver` per row with the thumbnails' `200px` margin, disconnected after its
  first sighting.

## Presentation and UX

- A `<table>` inside `LIST_CARD`; `<thead>` with `<th scope="col">` cells, each holding a button;
  rows `h-10`, the name cell truncating.
- Type cell: `EDITOR_MODE_ICONS[mode]` at 14 px and `editorModeLabel(mode)`.
- Access cell: `ROLE_PASS[level].Icon` at 14 px in the role's text colour, wrapped in a `Tooltip`
  naming `ROLE_PASS[level].title`, with the name as visually hidden text.
- Numbers right-aligned with tabular figures; dates in `text-xs`.
- `–` cells carry a `Tooltip` "Not counted yet".
- The sorted header shows a 10 px chevron (up ascending, down descending).
- Empty, loading and error states are the pane's own, as for List and Cards.

## Accessibility

- The table has an accessible name: "Folders and documents".
- `aria-sort` on the sorted `th` only. The header button's name is the column's label; a sorted
  column's button adds ", sorted ascending" or ", sorted descending" visually hidden.
- Rows keep the list's interactive parts: the name link, the `⋯` (reveal on hover, row focus or
  keyboard focus of the button; always on a coarse pointer).
- The preview is `role="tooltip"` and does not take focus.

## Web Experience

- No layout shift: the toggle swaps one view for another; the table reserves its column widths;
  the preview floats in a portal.
- The prefetch defers snapshot requests to rows near the viewport, so the first paint fetches only
  what is on screen (LCP unaffected).
- Hover handling is the hint's timer machine, no per-move state (INP unaffected).

## Observability

| Fingerprint                                     | Where                                   |
| ----------------------------------------------- | --------------------------------------- |
| `tab-stats: backfilled n=<n> left=<more\|none>` | Each cron run                           |
| `tab-stats: backfill failed`                    | A run that threw                        |
| `tab-stats: corrupt tab <id> counted empty`     | Backfill on an unparseable body         |
| `tab-stats: unreadable doc_stats`               | A summary row whose stats did not parse |
| `[explorer-drop] …`                             | Drops on Details folder rows            |

## Testing

| Rule                                                     | Test                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| Stats of a body: mode, elements, comments, bytes         | `packages/document/src/tab-stats.test.ts`                     |
| A corrupt body counts empty                              | `apps/api/src/db/tab-stats.test.ts`                           |
| A document in this browser is counted, cached per save   | `apps/live/lib/offline/offline-stats.test.ts`                 |
| The snapshot prefetch asks once, near the viewport       | `apps/live/app/explorer/details/useSnapshotPrefetch.test.tsx` |
| Reader access                                            | `apps/live/lib/document-space.test.ts`                        |
| Warm-up per kind                                         | `packages/ui/src/hint/hint-registry.test.ts`                  |
| Every write path leaves a matching stats row             | `apps/api/src/db/tab-stats-writers.test.ts`                   |
| Document stats sum, latest mode, null when uncounted     | `apps/api/src/db/tab-stats.test.ts`                           |
| Backfill counts, keeps a racing write, logs, stops       | `apps/api/src/tab-stats-backfill.test.ts`                     |
| Preview delay, warm-up, focus                            | `packages/ui/src/hint/useHint.test.tsx`                       |
| Sort: natural direction, toggle, folders first, `–` last | `apps/live/app/explorer/details/details-columns.test.ts`      |
| Formats                                                  | `apps/live/app/explorer/details/details-format.test.ts`       |
| Stored sort and mode read back, defaults                 | `useDetailsSort.test.tsx`, `useExplorerViewMode.test.tsx`     |
| Table renders columns, aria-sort, `–`, menu, drag        | `apps/live/app/explorer/details/DetailsView.test.tsx`         |

## Constants and configuration

| Constant                       | Value                               | Provenance                                                    | Safe range     |
| ------------------------------ | ----------------------------------- | ------------------------------------------------------------- | -------------- |
| `PREVIEW_OPEN_DELAY_MS`        | 600                                 | Spec                                                          | 400-1000       |
| `PREVIEW_WARMUP_MS`            | 500                                 | Spec, as the tooltip's                                        | 300-800        |
| `TAB_STATS_BACKFILL_PAGE_ROWS` | 10                                  | `D147`: 10 bodies of at most `MAX_TAB_BYTES` stay under 20 MB | 1-20           |
| `TAB_STATS_BACKFILL_MAX_ROWS`  | 5000                                | `D148`                                                        | 500-20000      |
| `TAB_STATS_BACKFILL_BUDGET_MS` | 60 000                              | As the image-refs backfill                                    | 10 000-120 000 |
| `DETAILS_SORT_STORAGE_KEY`     | `livediagram:explorer-details-sort` | Beside `livediagram:explorer-view`                            | n/a            |

## Defaults ledger

`D145` to `D153` in [DEFAULTS.md](DEFAULTS.md).
