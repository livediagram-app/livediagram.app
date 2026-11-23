# Live data

**Live data** lets a chart or a table in livedocuments, livedesign, livediagram or liveknowledge take its numbers from a
liveplanner plan and keep them in step with it (Work Tracker 1368). A status report, a slide or a chart on a diagram is
usually a copy of numbers from a plan, stale the day after; a [live embed](live-embeds.md) shows a whole item, and
nothing linked the numbers themselves. Live data grows [sheet sources](sheet-sources.md) (a chart reading one range of
a Sheet) into three sources and two kinds of element, on the same rules: each reader's own access, the source app's
narrow door, the index's change signal, and the values saved on the element.

What the element shows in each host is that app's spec (`<app>/docs/specs/009-elements/pie-chart.md` "Live data from a
plan"); the editor's side is one copy in `@liveworkspace/workbench` (`components/sheet-links/`).

## Names

- The **source** is the plan; the **reader item** is the document, diagram, design or knowledgebase whose element draws
  from it. Source apps: liveplanner (`SHEET_SOURCE_APPS`). Reader apps: livedocuments, livediagram, livedesign and
  liveknowledge (`SOURCE_WATCH_APPS`).
- A **source kind** is what of the plan feeds the element:
  - **Sheet Range**: a range of a Sheet, with its first row as series names and its first column as labels
    ([sheet-sources.md](sheet-sources.md), unchanged);
  - **Board Counts**: a Board tab's cards counted by **column**, **label**, **assignee** or **priority**, optionally
    filtered by priority, label, assignee and card type;
  - **Dashboard Metric**: one of the metrics liveplanner's Dashboard tabs already work out (Cards, Progress, People,
    Card Types, Priorities, Due, Unassigned, Points, Top Voted, Stale), as the rows its tile draws.
- The **link** is what the element keeps: `chartSheetSource`, the plan and what of it is read, the names as last read,
  when (`readAt`), which of the read's series feed the element (`series`, in order) and whether it is **frozen**. Its
  first name is kept for every source kind and for tables, so every copy and export rule that drops it already does.
- The **snapshot** is the element's own data fields, the last read: a chart's slices or series, a table's cells. It
  holds only what the element draws.

## The element

- **Linking.** On a chart or a table, the Data section's **From a Plan…** opens the dialog: the person's plans (most
  recent first, with a search), then the source kind (**Sheet Range**, **Board Counts**, **Dashboard Metric**), then the
  source itself (a Sheet and a range; a board, what to count by and its filters; a metric). A preview shows what the
  element will draw, and for a read with several series, **Series** chips say which feed the element and in what order
  (a pie, doughnut, column or bar draws the first alone). **Link** writes the read and the link as one undo step.
- **The live mark.** A linked element shows a small dot at its top-right corner (green while live, still, so a page of
  linked charts costs no animation; hidden while the element is selected, where it would sit on the resize handle and the
  line says the same) and, on hover or selection, a quiet line below it:
  "Live from Launch Plan · updated 2 min ago". Its Data section says the same with the source under it ("Roadmap ·
  Cards per column", "Budget · B2:E9", "Dashboard · Progress") and offers **Open Plan** (the plan in liveplanner, a new
  tab), **Update**, **Freeze**, **Change…** and **Unlink**.
- **Freeze** keeps the numbers as they are and stops updating: for a report that must not change after it is sent.
  The link stays (frozen), the line says "From Launch Plan · frozen 12 Nov", and **Unfreeze** reads again. A frozen element is
  never read, so it costs no reads and no watches.
- **Tables.** A linked table's cells are the read: a header row (the label column's heading, then each series' name)
  and a row per category. The heading names what a board is counted by ("Priority"); it is blank for a range, and for a
  metric, whose one series already carries the metric's name. Its cells are not typed into while linked (the next read
  would overwrite them); its look, widths and header styles stay the Editor's. Unlink keeps the cells.
- **Keeping in step**, **the first read waits for sign-in**, **the range breaks** and **Unlink** are as
  [sheet-sources.md](sheet-sources.md) and each app's chart spec already set them, for every source kind.

## Each reader's own access

Unchanged from sheet sources (Work Tracker 940): every read is the reader's own. A person who can open the plan sees
live numbers; anyone else, a share-code visitor, a Community visitor and an app acting for a person see the snapshot
only, never the live source. Linking needs read access to the plan (the dialog lists only plans the person can open,
and Link reads once more with their own access). The person who links consents that the snapshot, which holds only what
the element draws, is seen by every reader of the item; the dialog says so.

## Reading a board or a metric

- `GET /api/index/items/:id/plan-data`, with the person's token: the plan's name, its Board tabs and its metrics, and
  the values its filters can take: `{itemId, itemName, boards: [{id, name, tabId}], metrics: [{id, label}],
filters: {priorities, labels, people, types}}`. A tab-scoped link lists only its tab's board.
- `POST /api/index/items/:id/plan-data` `{kind: 'board', boardId, by, filter?} | {kind: 'metric', metric}`, optionally
  `watch: {itemId}` with that item's grant (`X-Index-Grant`): `{itemId, itemName, kind, sourceName, tabId, label, table,
readAt}`. `sourceName` is the board tab's name ("Dashboard" for a metric), `label` the words for what was read
  ("Cards per column", "Progress").
- Access is checked as for a range read: the person's own, any level; a share code, a public link and a delegate answer
  `404`; a board off a tab-scoped link's tab is `404`, and so is any metric on a tab-scoped link (a metric reads the
  whole plan). Answers are `no-store` and never written to the index.

| Answer                   | When                                                                              |
| ------------------------ | --------------------------------------------------------------------------------- |
| `200` the read           | the person can open the plan and the board or metric is there                     |
| `400 invalid_source`     | the body is not a board ask (a known `by`, a filter of short strings) or a metric |
| `404 not_found`          | no such plan, the person cannot reach it, or the board is gone or off their tab   |
| `503 source_unavailable` | the plan's app did not answer                                                     |

The door: `GET` and `POST /api/internal/items/:id/plan-data` on the plan app's own index key alone, as the sheet doors.
It reads only the counts asked for: category names and numbers, never a card's title, text, comments or fields beyond
the one counted. A count by assignee names each person as the plan shows them (their display name), which is what the
element draws.

## Keeping in step

Board and metric sources watch the plan's **cards** (the watch id `cards`, one per plan): any change to a card (a move,
an edit, a new or deleted card, from a person, a rule, a form or an agent) or to the card types marks it changed, and
the plan's room gathers it with Sheet changes for 1.5 s and tells the index once, as for sheets. The reader's room
frame carries `sheetIds` with `cards` among them; each open session re-reads its board and metric sources of that plan
with its own access. A board's own setup (a column renamed) is caught up on the next open or Update.

## Bounds

- A read: at most 500 categories by 12 series (the chart caps); a board count by label or assignee keeps the 500
  largest. A table takes at most 501 rows by 13 columns from a read, inside the table caps.
- **One subscription per source per open item**: every element on the open tab that reads the same source (the same
  plan, kind and ask) shares one read and one watch; a frozen element reads nothing.
- Signals are gathered per plan (1.5 s) and capped per call (50 ids, 20 watchers), so a popular plan changing often
  costs each watching item one frame per burst, and each open session one read per source.

## Offline, exports and copies

Offline Mode, exports (SVG, PNG, PDF, PPTX, the item's file), thumbnails and Community copies draw the snapshot:
an export prints the numbers as of the export and carries no link. A duplicate, copy-paste or tab copy within the app
keeps the link, frozen or not.

## Agents

Agents read a linked element's snapshot and its link (the plan's name, the source kind and what is read, frozen or
not) through each reader app's MCP read. An agent links one by writing `chartSheetSource` onto a chart or table with
the plan's ids (from liveplanner's own tools); its values are what the agent wrote until an Editor who can open the
plan opens the item, whose first read replaces them. Agents never read live values through the index: an app acting
for a person is refused there.

## Who may

Linking, Update, Freeze, Unfreeze, Change and Unlink are an Editor's (`can.level === 'edit'`). A Participant and a
Viewer see the live mark and the live numbers on their own access, or the snapshot; they never write.

## Telemetry

`Element·Changed·<event>` through the product's own `track`: `ChartSheetLink` (a chart linked to a range),
`ChartBoardLink`, `ChartMetricLink`, `TableLiveLink` (a table linked to any source), `ChartSheetUnlink`,
`LiveDataFreeze` and `LiveDataUnfreeze`, charted together as **Live Data** in each reader app's Element Editing on the
liveworkspace site's metrics (Elements Changed leaves them out).

## Help

[Live Data From a Plan](../../../apps/help/app/palette/tools/data-elements/live-data/page.mdx) in the help centre, for
livediagram, livedocuments and livedesign; the chart articles, the data elements index and the plan's Sheets article
point to it. liveknowledge's help has no chart articles yet.
