# Live data: blueprint

Derived from [live-data.md](../live-data.md). The spec decides; this file adds engineering precision. Everything not
named here is as [sheet-sources.md](sheet-sources.md).

## Files

| File                                                     | Role                                                                                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `packages/index-client/src/live-data.ts`                 | The contract: `PlanDataAsk`, `BOARD_COUNT_BYS`, `PLAN_DATA_CARDS`, the listing and reads, `readPlanDataAsk`, guards   |
| `packages/index-client/src/client.ts`                    | `listPlanData(itemId)`, `readPlanData(itemId, ask, {grant?, watch?})`                                                 |
| `packages/app-doors/src/doors.ts`                        | `listPlanData(app, itemId)`, `readPlanData(app, itemId, ask)`                                                         |
| `packages/index-app/src/sheet-source-doors.ts`           | The `plan-data` door (GET list, POST read) beside the sheet doors; handlers `planDataList`, `planData`                |
| `liveworkspace/apps/index/src/live-data.ts`              | `GET` and `POST /items/:id/plan-data`, on `ownSource` and `watcherOf` from `sheet-sources.ts`                         |
| `liveplanner/apps/api/src/plan-room/plan-data-source.ts` | The door handlers: the plan's boards, metrics and filter values; a board's counts; a metric's rows                    |
| `liveplanner/apps/api/src/plan-room/plan-room-wiring.ts` | An `items` or `item-types` broadcast marks the `cards` watch changed                                                  |
| `packages/element-model/src/chart-sheet-source.ts`       | The link: `ChartSheetSource` (the union of the three kinds), `series`, `frozen`, `isChartSheetSource`, `sourceKindOf` |
| `packages/element-model/src/live-data-table.ts`          | A read as a table's cells (`tableCellsFromRead`), bounded                                                             |
| `packages/workbench/src/components/sheet-links/`         | Reads per kind, Freeze, the dialog's three source kinds and Series chips, the live mark, `LiveTableFace` for tables   |

## Contract

```ts
export const BOARD_COUNT_BYS = ['column', 'label', 'assignee', 'priority'] as const;
export type BoardCountFilter = {
  priority?: string;
  label?: string;
  person?: string;
  type?: string;
};
export type PlanDataAsk =
  | { kind: 'board'; boardId: string; by: BoardCountBy; filter?: BoardCountFilter }
  | { kind: 'metric'; metric: string };
export const PLAN_DATA_CARDS = 'cards';
export type PlanDataListing = {
  boards: { id: string; name: string; tabId: string }[];
  metrics: { id: string; label: string }[];
  filters: {
    priorities: { id: string; label: string }[];
    labels: string[];
    people: { id: string; name: string }[];
    types: { id: string; label: string }[];
  };
};
export type PlanDataDoorRead = {
  sourceName: string;
  tabId: string;
  label: string;
  table: SheetChartTable;
};
export type PlanDataRead = PlanDataDoorRead & {
  itemId: string;
  itemName: string;
  kind: 'board' | 'metric';
  readAt: number;
};
```

`readPlanDataAsk(raw)`: `kind` `board` with `boardId` an id, `by` in `BOARD_COUNT_BYS`, `filter` absent or an object of
the four keys, each a string of 1 to 64 characters (others refused); or `kind` `metric` with `metric` a slug of 1 to 32
`[a-z-]`. Anything else is null (`400 invalid_source`). A listing caps each filter list at 100 and boards at 50.

## The link (`chartSheetSource`)

Common fields: `app: 'liveplanner'`, `itemId`, `itemName`, `readAt`, optional `series` (1 to 12 distinct indexes
0 to 11, the read's series in the order they feed the element) and optional `frozen: true`.

- Sheet Range: `kind` absent (every link made before live data) or `'sheet'`, then `sheetId`, `range`, `cols?`,
  `sheetName`, `a1`.
- Board Counts: `kind: 'board'`, `boardId`, `by`, `filter?`, `sourceName`, `label`.
- Dashboard Metric: `kind: 'metric'`, `metric`, `sourceName`, `label`.

Names are at most 200 characters, labels 80. Each product's validator takes it on a chart shape and on a table.

## liveplanner

- **List**: the plan's content tabs; each Board tab with a `plan-board` element is a board (`id` the tab id). Metrics
  are `METRIC_KINDS` with `BOARD_WIDGET_INFO[kind].label`. Filters: `PRIORITY_LABELS`, the cards' labels (most used
  first), assignees and card types, each capped.
- **Board counts**: `projectBoard(setup, items, quick, types, statusNames)` with the filter's priority, person and type
  as the quick filter, then a label filter. By column: each column's name and count, in order. By label, assignee or
  priority: the projected cards counted, largest first (priority in its own order, then "No Priority"; assignee then
  "Unassigned"). One series, "Cards".
- **Metric rows**: `metricModel(kind, metricBoard(...), types, now)`; its bars, split or people rows as categories, a
  ring as Done and Not Done, anything else its figure as one category named by the metric. One series, the metric's
  label.
- **Watch**: a read with a watcher upserts `(watcher, 'cards')` into `sheet_watches`. `roomInternal.sheetChanged` calls
  `sheetWatches.changed('cards')` for a broadcast op of kind `items` or `item-types`.

## The reader (workbench)

- `sheetLinkKey` per kind: a sheet's as before; `board|<plan>|<board>|<by>|<filter json>`; `metric|<plan>|<metric>`. One
  read per key per open item, frozen links skipped.
- A frame's `sheetIds` re-read a sheet source whose `sheetId` is among them, and a board or metric source when `cards`
  is.
- `liveFields(el, table)` applies `series` first (`pickSeries`), then a chart's `chartFieldsFromTable` or a table's
  `tableCellsFromRead`.

## Testing

| Rule                                                                        | File                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Asks parse, malformed refused; listings and reads checked                   | `packages/index-client/src/live-data.test.ts`                 |
| The link's guard for every kind, `series`, `frozen`                         | `packages/element-model/src/chart-sheet-source.test.ts`       |
| A read as table cells, bounded                                              | `packages/element-model/src/live-data-table.test.ts`          |
| The door: list and read, 400, 404                                           | `packages/index-app/src/sheet-source-doors.test.ts`           |
| Index: own access only, share code / delegate 404, tab scope, watch, errors | `liveworkspace/apps/index/src/live-data.test.ts`              |
| liveplanner: counts by each `by`, filters, metrics, the cards watch         | `liveplanner/apps/api/src/plan-room/plan-data-source.test.ts` |
| Reader: keys, frozen skipped, the cards frame, Freeze, tables, roles        | `packages/workbench/src/components/sheet-links/*.test.ts(x)`  |

## Constants

| Name                   | Value | Provenance / safe range      |
| ---------------------- | ----- | ---------------------------- |
| `PLAN_DATA_LIST_MAX`   | 100   | Each filter list; 20 to 500  |
| `PLAN_DATA_BOARDS_MAX` | 50    | Boards listed; 10 to 200     |
| `LIVE_TABLE_ROWS_MAX`  | 501   | A header and 500 categories  |
| `LIVE_TABLE_COLS_MAX`  | 13    | A label column and 12 series |
