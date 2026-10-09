# Plan views blueprint

Derived from [Plan views](../plan-views.md).

## Domain and naming

| Spec term     | Identifier                                                                  |
| ------------- | --------------------------------------------------------------------------- |
| plan view     | `ShapeKind` `'plan-view'`; element field `planView: PlanViewRef`            |
| view kind     | `PlanViewId` (`PLAN_VIEW_IDS`, packages/items `plan-views.ts`)              |
| metric        | `PlanViewId` `metric:<kind>`; `MetricKind` (`METRIC_KINDS`)                 |
| visualisation | `PlanVisualisation` (`PLAN_VISUALISATIONS`, `PLAN_VISUALISATION_LABELS`)    |
| status phase  | `StatusPhase` `'todo' \| 'doing' \| 'done'` (`STATUS_PHASES`, `..._LABELS`) |
| start         | `ItemFieldId` `'start'`, kind `date`; `CardField` `'start'`                 |

## Files

```
packages/items/src/plan-views.ts        ids, sizes, liveCards, statusPhasesOf, phaseOf, metricBoard
packages/items/src/plan-view-dates.ts   dayNumber, todayNumber, dayParts, dayKey, monthStart, shiftMonth,
                                        daysInMonth, DAY_MS, month and weekday names (also the timeline's
                                        month grid, packages/ui/src/timeline/monthCells.ts)
packages/items/src/plan-view-gantt.ts   ganttModel, ganttAt, GANTT_* constants
packages/items/src/plan-view-charts.ts  calendarModel, workloadModel, statusMixModel,
                                        priorityMatrixModel
packages/document/src/svg-render-plan.ts svgPlanView (a labelled box)
apps/live/hooks/plan/usePlanStatusNames.ts usePlanStatusPhases -> PlanContext.statusPhases
apps/live/components/plan/views/        PlanViewView (router), view-frame (ViewFrame, openProps, viewState,
                                        PhaseLegend, PHASE_COLOURS), MetricView, GanttView, CalendarView,
                                        WorkloadView, StatusMixView, PriorityMatrixView
apps/live/components/plan/plan-view-art.tsx           PlanViewArt (one Glyph per visualisation)
apps/live/components/palette/palette-plan-view-tiles.tsx PLAN_VIEW_TILES, spread through PLAN_TILES
```

## Element model

- `createShape('plan-view')` is 720 × 400 with `planView: { view: 'status-mix' }`. A tile's `plan` choice is the
  view id: `buildDrawnBoxed` and the drop path set `planView` and, on a tap or drop, `planViewSize(view)`
  (metric 260 × 64, Gantt 880 × 420, else 720 × 400). The drag ghost uses the same size.
- Validation: `planView` must be `{ view }` with `isPlanViewId(view)`, else the `planView` field issue.
- `plan-view` is a Plan shape (`isPlanShape`), self-drawing and self-painting; no quick-connect pluses; it latches
  `usePlanNeeded`; `itemIdsShownOnTab` gives every item to a tab holding one; edit-operations stores `planView`.
- Exports draw `svgPlanView`: a rounded box with the visualisation's name, or "Metric".

## Behaviour and state

- `statusPhasesOf(boards)`: per board (not All Cards or Archive), first column `todo`, the done column and later
  `done`, the rest `doing`; first board wins. `phaseOf` reads `todo` for a missing or unknown status.
- `metricBoard(items, phases, types)`: three phase columns (`phase-todo` ...), the done one `doneColumnId` when any
  phase is done; live cards copied with their status mapped; `projectBoard` over them. `MetricView` builds a
  `WidgetContext` with no quick filter, `canEdit: false` and no-op set-up, and draws `BoardWidgetView`.
- `ganttModel`: rows of live `project` items, `mark` `bar | due | start | none`; a bar's ends are the min and max of
  start and due; `overdue` when not done and due is before today; children by `parent`; sorted by `from` then
  key, dateless last. Axis `from = min(dates, today) - 7`, `to = max(max(dates, today) + 7, from + 27)`; Monday
  ticks up to 120 days, else month starts (the first and each January with the year). Labels thin to one per
  52 px of axis.
- Calendar: `calendarModel(items, phases, year, month)`; the month offset is component state. A day shows
  `floor(((height - 62) / weeks - 20) / 16)` entries, the last line kept for "+N more" when more are due.
- Opening: `openProps(plan, id)`: in Plan input a click opens and pointerdown is kept from the canvas; a
  double-click opens in any mode. "Add a start date" shows only when `plan.canEdit`.

## Interfaces and contracts

- `PlanContextValue.statusPhases: ReadonlyMap<string, StatusPhase>` (from `usePlanStatuses`, signature-keyed, read from every tab's boards, the open tab's first).
- `PlanViewProps = { plan, items, palette, fontFamily, width, height }`.

## Errors and edge cases

| Case                           | Handling                                            |
| ------------------------------ | --------------------------------------------------- |
| Items loading                  | "Loading cards…"                                    |
| No PlanContext (export, share) | Empty state                                         |
| Unknown or missing view        | Status Breakdown                                    |
| No Done phase                  | Completion reads "No done column"; nothing done     |
| Start after due                | Bar from the earlier to the later; panel note       |
| Bad date string                | Read as absent (`dayNumber` undefined)              |
| More rows or entries than fit  | Clipped (overflow hidden); calendar shows "+N more" |

## Presentation and UX

- Frame: `rounded-xl border`, `palette.surface`, 40 px header (title, `CountBadge` (`@livediagram/ui`, `size="md"`) count, aside controls).
- Phase colours: Not Started `#94a3b8`, In Progress `#3b82f6`, Done `#16a34a`; overdue and today `#dc2626`.
- Gantt window: `GANTT_SCALES` (month, quarter, year) and `GANTT_SCALE_DAYS` (35, 91, 365); `ganttFitScale(model)`
  picks the opening scale, `ganttWindow(scale, from)` the window and its ticks, `ganttTodayFrom`,
  `ganttRescaleFrom` (keeps the middle) and `ganttStepDays` (a third) the header's moves. `useGanttWindow` holds the
  viewer's scale and start in component state (null until touched, so it follows the cards), scrolls on a
  non-passive sideways or Shift wheel over the timeline and on a drag of the axis strip, and attaches only while the
  chart takes input and is drawn. The timeline carries `data-own-wheel-x` while it takes input, so the canvas
  wheel (useCanvasPinchZoom) leaves it a sideways or Shift wheel. `GanttScaleControls` sits in the frame's aside:
  Today, Earlier, Later, and the scale as pressed `ViewStepButton`s (shared with the Due Calendar's steps);
  a scale change tracks `('Plan', 'Changed', 'GanttScale')`.
- Gantt card types: `planView.types` (card type ids), validated by `isPlanViewSettings` (non-empty, at most
  `GANTT_TYPES_MAX` (32, the catalogue's limit), each `ITEM_TYPE_PATTERN`, none repeated); `ganttTypesOf(settings)`
  reads it, `GANTT_DEFAULT_TYPES` (`['project']`) when absent. `ganttEligibleTypes(types)` is the catalogue's types
  offering both `start` and `due`; `ganttShownTypes(settings, types)` the named ones among them, which is what
  `GanttView` draws. The menu lists only eligible types, under `GanttTypesNote` (a `role="note"` info block).
  `ganttModel(items, phases, now, types)` keeps live
  cards of those types; children still by `parent`. A row's colour is its own `itemColourOf`, else its type's
  colour (`typeIn`), lifted by `accentOn`. Header "Gantt Chart", count `N cards`, empty "No cards of these types
  yet.". Set from `PlanViewMenuSection`'s Card Types row (`CardTypeOptions`, plan-menu-parts.tsx, shared with the
  board's Card Types), which drops the setting when it is exactly Project, tracking
  `('Plan', 'Changed', 'GanttTypes')`.
- Gantt date drags: `ganttDayShift(model, dx, axisPx)` rounds pixels to whole days over the axis width;
  `ganttDrag(row, edge, days)` gives the new ends and the one field write (`start` or `due`, whichever the end
  shows; a diamond its own; `bar` shifts both by the same days and writes both), clamped so a bar's end never
  passes the other, null for no change.
  `useGanttDrag` (gantt-drag.tsx) previews on window pointer moves, commits on pointer-up through
  `patchItem` and `track('Plan', 'Changed', 'GanttDates')`, drops on Escape or pointer-cancel, and swallows the
  click after a move past `DRAG_SLOP_PX`: on the handle (`swallowClick`) and, wherever the release lands,
  through `swallowNextClick()` (a one-shot capture-phase window `click` listener, given up after
  `SWALLOW_CLICK_MS`, 400 ms); a draw across days swallows it the same way. A drag or draw beginning calls
  `useGanttWindow`'s `pin()` (`onBegin`), which sets the window's start and scale to what is shown, so a commit that
  moves `model.from` or the fitted scale never moves the timeline. The axis pan keeps its window listeners' remover
  in a ref, called on unmount. Handles (`GanttHandle`) are 12 px hit areas with an `ew-resize`
  cursor and a grip shown on row hover; `GanttBarGrab` covers the bar's body with a grab cursor; all rendered only
  when `canEdit && planInput`.
- Gantt names column `min(220px, 33%)` unless `planView.namesWidth` (px) is set, then that width clamped by
  `ganttNamesWidth(width, chartPx)` to `GANTT_NAMES_MIN_PX`..`GANTT_NAMES_MAX_SHARE` of the chart, never past
  `GANTT_NAMES_MAX_PX` (2000, the validator's bound); rows 30 px, lane
  headers 24 px (`LANE_H`), axis 22 px; bar 14 px, project colour at 28 % with the children-done share solid
  (green when the project is done).
- Gantt names separator (`GanttNamesResizer`, gantt-names-resize.tsx): a 6 px `col-resize` strip over the column's
  right edge, `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow` (px), `aria-valuemin`,
  `aria-valuemax`; a 2 px line on hover and drag. Pointer drags preview locally (component state) and commit once
  on pointer-up through `plan.updateView(id, { ...planView, namesWidth })` (an element edit: synced, one undo
  step); Escape and pointer-cancel drop the preview. ←/→ step `GANTT_NAMES_STEP_PX` and commit at once. Every
  press stops propagation (the canvas never takes it). Only when `canEdit && planInput`.
- Gantt status pill (`GanttStatusPill`): the row status named by `statusLabel(status, plan.statusNames)`, tinted by
  `phaseOf` through `PHASE_COLOURS` with `tint`; under `GANTT_PILL_MIN_COLUMN_PX` (160) of names column it is an
  8 px dot in a Tooltip naming the status.
- Gantt swimlanes: `planView.swimlaneBy` (`SWIMLANE_BY`) and `swimlaneField`, validated in validate-shape.ts.
  `laneGroups(by, field, list, items, types, statusNames)` (board.ts, shared with `projectBoard`) gives the lanes
  the rows fall in, in a board's order, and each item's lane; `ganttLanes(rows, ...)` keeps only lanes with rows,
  rows in the chart's order. `GanttRows` lays rows and lane headers out in one pass (`ganttLayout`: each entry's
  top). Lane collapse is per person, component state keyed by lane key. Set from `PlanViewMenuSection` (a View
  flyout for a gantt plan view holding two `MenuAccordionSection`s, Card Types and Swimlanes, each with the
  scaffold's `sectionProps` id; the Board flyout's Swimlanes grid), tracking `('Plan', 'Changed', 'GanttSwimlanes')`.
- Gantt row order: `planView.rowOrder` (card ids), validated by `isPlanViewSettings` (an array of `isValidItemId`
  strings, none repeated, at most `GANTT_ROW_ORDER_MAX` (2000)). `ganttOrderRows(rows, order)` (gantt-row-order.ts)
  puts named rows first in the order's sequence and the rest after in their date order (stable). `ganttReorder(
rowIds, laneIds, id, toIndex)` returns the next full order: `id` taken out of the chart's current row ids and put
  before the lane's row now at `toIndex` (after the lane's last row past its end), so it never leaves its lane; only
  live row ids survive. `useGanttRowReorder` (useGanttRowReorder.ts) runs the drag: pointer down on a row's grip
  (`GanttRowGrip`, gantt-rows.tsx; shown on the row's hover or focus-within, editors only, while `planInput`) stops
  propagation and records the lane and index; window pointer moves turn the vertical travel (screen px over the
  row's on-screen height, so any zoom) into a target index clamped to the lane; the name row and timeline row
  translate by the travel and a 2 px drop line marks the target gap; pointer up writes `rowOrder` once through
  `plan.updateView` when the index changed; Escape or pointer cancel drops it. Alt+↑/↓ on a name row moves it one
  place and announces "Moved #key Title to position i of n". `PlanViewMenuSection` shows **Sort by Date**
  (`MenuActionRow`, calendar glyph) while `rowOrder` is set; it drops the key. All track
  `('Plan', 'Changed', 'GanttRowOrder')`.
- Status colours cycle the tab theme's chart palette (`themeChartPalette`, the pie chart's `chartPalette`,
  `PIE_PALETTE` without one); No status is `palette.muted`. Donut is a conic gradient.

## Accessibility

- Gantt rows and calendar entries are buttons named "#key title" (with progress or "done"); month steps are named
  buttons with Tooltips. Donut is `role="img"` with every slice spoken; the matrix is `role="table"` with
  named cells; workload rows carry an `aria-label` of their counts; a metric is a named `group`.

## Observability

- Placing a plan view sends `Element · Added · PlanView` (`SHAPE_TOKENS`); `PlanView` is in
  `PALETTE_TELEMETRY_TYPES.shapes`.

## Performance and limits

- Each model is linear in the document's items (capped by the item store), memoised on the items map, the phases
  and (calendar) the month; the Gantt recomputes once a day. No timers, no listeners.

## Testing

| Rule                                           | Test                                                      |
| ---------------------------------------------- | --------------------------------------------------------- |
| Ids, sizes, phases, metric board               | packages/items/src/plan-views.test.ts                     |
| Gantt rows, marks, axis, ticks, drags, scales  | packages/items/src/plan-view-gantt.test.ts                |
| Calendar, workload, status, priority models    | packages/items/src/plan-view-charts.test.ts               |
| Element seed, validation, export box           | packages/document/src/plan-shapes.test.ts                 |
| Rendering, empty and loading, opening, metrics | apps/live/components/plan/views/PlanViewView.test.tsx     |
| Gantt window pin, pan cleanup                  | apps/live/components/plan/views/useGanttWindow.test.ts    |
| Gantt View flyout (card types, swimlanes)      | apps/live/components/palette/PlanViewMenuSection.test.tsx |
| Gantt row order (apply, reorder, validation)   | packages/items/src/gantt-row-order.test.ts                |
| Gantt row drag, keyboard move, lanes           | apps/live/components/plan/views/GanttRowOrder.test.tsx    |
| Palette categories and tiles                   | apps/live/components/palette/palette-*.test.ts(x)         |

## Constants and configuration

| Constant                    | Value     | Where              | Safe range |
| --------------------------- | --------- | ------------------ | ---------- |
| `GANTT_PAD_DAYS`            | 7         | plan-view-gantt.ts | 0..30      |
| `GANTT_MIN_DAYS`            | 28        | plan-view-gantt.ts | 7..90      |
| `GANTT_WEEK_TICKS_MAX_DAYS` | 120       | plan-view-gantt.ts | 60..240    |
| `TICK_LABEL_PX`             | 52        | GanttView.tsx      | 40..80     |
| `GANTT_ROW_ORDER_MAX`       | 2000      | gantt-row-order.ts | 500..5000  |
| `DRAG_SLOP_PX`              | 3         | gantt-drag.tsx     | 2..8       |
| `GANTT_NAMES_MIN_PX`        | 120       | plan-view-gantt.ts | 80..200    |
| `GANTT_NAMES_MAX_SHARE`     | 0.6       | plan-view-gantt.ts | 0.4..0.8   |
| `GANTT_NAMES_STEP_PX`       | 16        | plan-view-gantt.ts | 4..40      |
| `GANTT_PILL_MIN_COLUMN_PX`  | 160       | GanttView.tsx      | 120..240   |
| `LANE_H`                    | 24        | GanttView.tsx      | 20..32     |
| `PLAN_METRIC_SIZE`          | 260 × 64  | plan-views.ts      |            |
| `PLAN_CHART_SIZE`           | 720 × 400 | plan-views.ts      |            |
| `PLAN_GANTT_SIZE`           | 880 × 420 | plan-views.ts      |            |

## Defaults ledger

See DEFAULTS.md D25 to D27, D29 and D30.
