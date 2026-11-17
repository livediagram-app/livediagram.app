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
                                        daysInMonth, DAY_MS, month and weekday names
packages/items/src/plan-view-gantt.ts   ganttModel, ganttAt, GANTT_* constants
packages/items/src/plan-view-charts.ts  calendarModel, workloadModel, statusMixModel,
                                        priorityMatrixModel
packages/items/src/calendar-move.ts     CalendarField, calendarFieldOf, calendarMove
packages/items/src/view-fields.ts       ViewDates, BUILT_IN_DATES, viewDateOptions, viewDatesOf, viewDateName,
                                        viewMeasureOptions, viewMeasureOf, measureValue, measureNumber,
                                        measureCountLabel, isViewFieldId (fields by role)
packages/project/src/svg-render-plan.ts svgPlanView (a labelled box)
apps/editor/hooks/plan/usePlanStatusNames.ts usePlanStatusPhases -> PlanContext.statusPhases
apps/editor/components/plan/views/        PlanViewView (router), view-frame (ViewFrame, openProps, viewState,
                                        PhaseLegend, PHASE_COLOURS), MetricView, GanttView, CalendarView,
                                        WorkloadView, StatusMixView, PriorityMatrixView; calendar-day
                                        (DayCell, CalendarEntryFace), useCalendarDrag (calendarDayAt)
apps/editor/components/plan/views/ViewFieldSettings.tsx ViewDateOptions, ViewMeasureOptions (Dates, Count By)
apps/editor/components/plan/plan-view-art.tsx           PlanViewArt (one Glyph per visualisation)
apps/editor/components/palette/palette-plan-view-tiles.tsx PLAN_VIEW_TILES, spread through PLAN_TILES
```

## Element model

- `createShape('plan-view')` is 720 × 400 with `planView: { view: 'workload' }`. A view placed
  by the tab actions (`usePlanTabActions`, a Dashboard slot) takes its view's size, `planViewSize(view)` (`packages/items/src/plan-views.ts`;
  metric 260 × 64, Gantt 880 × 420, else 720 × 400), through `hooks/plan/slot-elements.ts`.
- Validation: `planView` must be `{ view }` with `isPlanViewId(view)`, else the `planView` field issue.
- `plan-view` is a Plan shape (`isPlanShape`), self-drawing and self-painting; no quick-connect pluses; it latches
  `usePlanNeeded`; `itemIdsShownOnTab` gives every item to a tab holding one; edit-operations stores `planView`.
- Exports draw `svgPlanView`: a rounded box with the visualisation's name, or "Metric".

## Behaviour and state

- `statusPhasesOf(boards)`: per board (not All Cards or Archive), each done column (`isDoneColumn`) `done`, else the
  first column `todo`, the rest `doing`; first board wins. `phaseOf` reads `todo` for a missing or unknown status.
- `metricBoard(items, phases, types)`: three phase columns (`phase-todo` ...), the done one flagged `done` (and `doneColumnId`) when any
  phase is done; live cards copied with their status mapped; `projectBoard` over them. `MetricView` builds a
  `WidgetContext` with no quick filter, `canEdit: false` and no-op set-up, and draws `BoardWidgetView`.
- `ganttModel`: rows of live items of the chart's types, `mark` `bar | due | start | none`; a bar's ends are the min and max of
  start and due; `overdue` when not done and due is before today; children by the Parent field (`parent`); sorted by `from` then
  key, dateless last. Axis `from = min(dates, today) - 7`, `to = max(max(dates, today) + 7, from + 27)`; Monday
  ticks up to 120 days, else month starts (the first and each January with the year). Labels thin to one per
  52 px of axis.
- Fields by role: `viewDatesOf(settings, types)` maps the roles `start` and `due` to field ids, `startField` /
  `dueField` while a type offers that custom Date field, else `start` / `due`. `ganttModel`, `ganttDrag`,
  `calendarModel`, `calendarMove`, `ganttNewCardDates`, `ganttEligibleTypes` and `viewNeeds` take the map
  (`BUILT_IN_DATES` by default). `viewMeasureOf` reads `measure` (Estimate or a custom Number field);
  `breakdownModel(..., measure)` adds `measureValue` (positive numbers, else 0) in place of 1 and totals the rows.
  The setters (`planViewSettingsModel.setDate`, `setMeasure`) drop the default rather than store it.
- Times and ranges (spec "Dates", "Times and ranges"): `viewDatesOf` also takes custom `datetime` and `daterange`
  fields and answers each role's shape (`ViewDates.shapes`: `date`, `datetime`, `daterange` or `daterange-time`;
  absent for a built-in). Every reader goes through `roleValue(item, dates, role)`
  (a range's start for `start`, its end for `due`) and `dayNumber(value, tz?)` (an instant's day in the viewer's
  zone); every writer through `roleDays(item, dates, { start?, due? }, tz?)` (`view-dates-write.ts`), which keeps an
  instant's wall-clock time (`instantOnDay`) and writes a range as one value. `ganttModel(..., dates)` marks a timed
  Due overdue once `now` passes it, `GanttView` then reading the clock each minute (`useMinute`, one shared
  interval, only while the Due is timed); `GanttDrawRow` and `ganttNewCardDates` (`GanttAddCard.tsx`) write through
  `roleDays`; `calendarModel` sets `at` on a timed card and sorts a day's cards untimed first
  (by key), then by `at`; `calendar-day.tsx` prints `at` before the title in the viewer's clock (`timeOfDayText`).
- Calendar: `calendarModel(items, phases, year, month, field, dates)` (`field` from `calendarFieldOf(view)`: `due` for
  `calendar`, `start` for `start-calendar`; read through `dates[field]`); the month offset is component state. A day shows
  `floor(((height - 62) / weeks - 20) / 16)` entries, the last line kept for "+N more" when more are due.
- Calendar moves: `canMove = plan.planInput && plan.canEditCards`. `useCalendarDrag` starts on an entry's
  pointerdown (button 0), listens on window, and counts a drag past `CALENDAR_DRAG_SLOP_PX` (3 px, Euclidean);
  `calendarDayAt(gridBox, x, y, firstDay, weeks)` reads the day under the pointer from the grid's on-screen box
  (zoom included), and the ghost's place is scaled back by `offsetWidth / box.width`. Pointer-up commits when the
  day differs; Escape (capture-phase, stopped) and pointercancel drop; a moved press calls `swallowNextClick()`.
  `calendarMove(item, field, toDay, dates, tz?)` gives `{ set, days, carried }` (`carried` when the other date moved
  too) or null (no date, same day, not a whole day); the
  other date shifts by `days` only when it would cross, clamped to the moved day. The view writes
  `patchItem(id, { set })`, tracks `('Plan', 'Changed', 'CalendarDue' | 'CalendarStart')` and announces. Alt+Arrow
  on an entry (`CALENDAR_MOVE_KEYS`: ±1, ±7) runs the same move, steps the month offset when the day leaves the
  grid, and refocuses `[data-calendar-item=id]` after render.
- Opening: `openProps(plan, id)`: in Plan input a click opens and pointerdown is kept from the canvas; a
  double-click opens in any mode. "Add a start date" shows only when `plan.canEdit`.

- A Dashboard slot's name (plan-tabs.md "A slot's name"): `name?: string` on the `element`, `sheet-metric` and
  `form-metric` slot contents (`packages/project/src/slot-name.ts` and dashboard.ts, `DASHBOARD_SLOT_NAME_MAX` 80, read trimmed and
  dropped when empty, kept through `remapDashboardElements`; `slotNameOf`, `withSlotName`). `SlotNameField`
  (`components/plan/dashboard/SlotNameField.tsx`) in SlotSection, where `generatedSlotName(content, element)` is not null (a
  `plan-view` element or either figure), saves through `actions.setSlotContent` (one step). `SlotElement` provides
  `SlotName` (`components/plan/dashboard/slot-name-context.ts`) round a plan view: `PlanViewView` reads it before `planView.title` for `ViewTitle`
  and passes it to `MetricView` as the tile's label; `DashboardSheetMetric` and `DashboardFormMetric` read
  `content.name`. Exports: `dashboard-export.ts` places a named view with `planView.title` set to the name (a copy,
  never stored), `metricArt` labels with the title, and the figures' art with the name. Agents: `charts[].name` in
  `DashboardInput` (`dashboard-input.ts`) to `DashboardChartSpec.name` to the slot's content (`dashboardLayoutOf`).

## Interfaces and contracts

- `PlanContextValue.statusPhases: ReadonlyMap<string, StatusPhase>` (from `usePlanStatuses`, signature-keyed, read from every tab's boards, the open tab's first).
- `PlanViewProps = { plan, items, palette, fontFamily, width, height }`.

## Errors and edge cases

| Case                           | Handling                                            |
| ------------------------------ | --------------------------------------------------- |
| Items loading                  | "Loading cards…"                                    |
| No PlanContext (export, share) | Empty state                                         |
| Unknown or missing view        | Status Breakdown (an old `status-mix` still draws)  |
| No Done phase                  | Completion reads "No done column"; nothing done     |
| Start after due                | Bar from the earlier to the later; panel note       |
| Bad date string                | Read as absent (`dayNumber` undefined)              |
| More rows or entries than fit  | Clipped (overflow hidden); calendar shows "+N more" |

## Presentation and UX

- Frame: `rounded-xl border`, `palette.surface`, 40 px header (title, `CountBadge` (`@liveplanner/ui`, `size="md"`) count, aside controls).
- Phase colours: Not Started `#94a3b8`, In Progress `#3b82f6`, Done `#16a34a`; overdue and today `#dc2626`.
- Gantt window: `GANTT_SCALES` (month, quarter, year) and `GANTT_SCALE_DAYS` (35, 91, 365); `ganttFitScale(model)`
  picks the opening scale, `ganttWindow(scale, from)` the window and its ticks, `ganttTodayFrom`,
  `ganttRescaleFrom` (keeps the middle) and `ganttStepDays` (a third) the header's moves. `useGanttWindow` holds the
  viewer's scale and start in component state (null until touched, so it follows the cards), scrolls on a
  non-passive sideways or Shift wheel over the timeline and on a drag of the timeline, and attaches only while the
  chart takes input and is drawn. The timeline carries `data-own-wheel-x` while it takes input, so the canvas
  wheel (useCanvasPinchZoom) leaves it a sideways or Shift wheel. `GanttScaleControls` sits in the frame's aside:
  Today, Earlier, Later, and the scale as pressed `ViewStepButton`s (shared with the Due Calendar's steps);
  a scale change tracks `('Plan', 'Changed', 'GanttScale')`.
- Gantt card types: `planView.types` (card type ids), validated by `isPlanViewSettings` (non-empty, at most
  `GANTT_TYPES_MAX` (32, the catalogue's limit), each `ITEM_TYPE_PATTERN`, none repeated). `ganttEligibleTypes(types)`
  is the catalogue's types offering both `start` and `due`; `ganttShownTypes(settings, types)` the named ones among
  them (every eligible type when the chart names none), which is what
  `GanttView` draws. The menu lists only eligible types, under an `InfoNote` (plan-menu-parts.tsx, a `role="note"` info block).
  `ganttModel(items, phases, now, types)` (types required, no default) keeps live
  cards of those types; children still by the Parent field (`PARENT_FIELD_ID`). A row's colour is its own `itemColourOf`, else its type's
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
  moves `model.from` or the fitted scale never moves the timeline. The pan is one native `pointerdown` on the
  timeline (`trackRef`), skipping targets inside `[data-gantt-handle]` or `[data-gantt-draw]`; it stops the press
  from the canvas, pans only past `PAN_SLOP_PX` (3 px, so a plain press still clicks the row and opens the card),
  and after a pan calls `swallowNextClick()`. The timeline is `touch-none` while it takes input. The pan keeps its window listeners' remover
  in a ref, called on unmount. Handles (`GanttHandle`) are 12 px hit areas with an `ew-resize`
  cursor and a grip shown on row hover; `GanttBarGrab` covers the bar's body with a grab cursor; all rendered only
  when `canEdit && planInput`.
- Gantt names column `min(220px, 33%)` unless `planView.namesWidth` (px) is set, then that width clamped by
  `ganttNamesWidth(width, chartPx)` to `GANTT_NAMES_MIN_PX`..`GANTT_NAMES_MAX_SHARE` of the chart, never past
  `GANTT_NAMES_MAX_PX` (2000, the validator's bound); rows 30 px, lane
  headers 30 px (`LANE_H`), axis 22 px; bar 14 px, project colour at 28 % with the children-done share solid
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
  `laneGroups(by, field, list, items, types, statusNames)` (board-lanes.ts, shared with `projectBoard`) gives the lanes
  the rows fall in, in a board's order, and each item's lane; `ganttLanes(rows, ...)` keeps only lanes with rows,
  rows in the chart's order. `GanttView` lays rows and lane headers out in one pass (`ganttLayout`: each entry's
  top), drawing `GanttLaneHead` and `GanttNameRow` (gantt-rows.tsx). Lane collapse is per person, component state keyed by lane key. Set from `PlanViewMenuSection` (a View
  flyout for a gantt plan view holding two `MenuAccordionSection`s, Card Types and Swimlanes, each with the
  scaffold's `sectionProps` id; the board menu's Swimlanes grid), tracking `('Plan', 'Changed', 'GanttSwimlanes')`.
- Gantt dependency arrows (spec "Dependency arrows"): `ganttArrows(entries, index, isDone)` (items,
  plan-view-gantt-arrows.ts) pairs each row entry's live blockers (`BlockingIndex.blockers`) that are row entries
  too, both with a mark, `done` when the blocker's phase is done; `ganttArrowPath(from, to, rowH)` gives the path
  (out `GANTT_ARROW_STEP` 8 px from the blocker's right end, down or up to the blocked row, in to its left end; back
  along the row gap at `from.top + rowH` or `to.top` when the blocked mark starts left of the step) and the head
  (`GANTT_ARROW_HEAD` 5 px). `GanttArrows` (views/gantt-arrows.tsx) draws them in one `aria-hidden`,
  `pointer-events-none` SVG over the track, `axisPx` wide, x from `ganttAt(view, day) * axisPx`, the dragged row's
  preview dates and lift applied; stroke `palette.muted` at 1.25 px, done at 40% opacity. The index is
  `planBlocking(plan)`. The export (`ganttArt`) draws the same pairs among the rows it fits.
- Gantt dependency clashes (spec "Dependency clashes", "Moving the cards that follow"): `dependency-clash.ts` (items).
  `cardSpan(item, dates)` is a card's `{ from, to }` days as the chart draws it (`roleDay` start and due, the earlier
  first; one alone is both). `ganttClashDays(from, to)` answers, for an arrow's blocker and blocked rows (as shown,
  preview applied), how many days the blocked mark starts before the blocker's right end (`from.to - to.from`, 0 for
  the same day), or null when it does not clash, the blocker or the blocked card is done, or either lacks a mark.
  `clashText(days, blocker)` is "Starts 3 days before #4 Design is due" ("1 day"; "Starts the day #4 Design is due"
  at 0). `clashesOf(item, index, isDone, dates)` lists an item's clashes `{ blocker, days }`, worst (largest) first.
  `followingShifts(items, index, isDone, seeds, dates)` is the walk: the cards reachable from `seeds` through
  `BlockingIndex.blocks` (seeds never move), in-degrees counted among them, a queue of those at 0 (Kahn), each card's
  need the day after the latest `span.to` of its open blockers (moved spans used); a card that is not done, not a
  seed, has a span and starts before its need shifts by `need - from` days, written by `roleDays` for each role it
  holds; a card in a loop never reaches 0 and is left. O(cards + links). Each shift is `{ item, days, set }`.
  Editor: `GanttArrows` draws a clashing arrow in `CLASH_AMBER` (`#d97706`, view-frame.tsx) at full opacity;
  `GanttView` keeps each blocked row's clash texts (from the arrows, preview applied) and `Mark` draws `GanttClashMark`
  (gantt-clash.tsx: a 12 px amber disc with "!", `role="img"`, its label the texts joined by "; ", in a `Tooltip`) at
  the mark's left end. After a date drag or draw commits, `useGanttMoveFollowing` (gantt-clash.tsx) works the shifts
  out over the plan's items with the patch applied; with any, `toast.offer` says "{n} card(s) that follow #3 Design now
  start before it is due." (Move {n} Card(s) / Leave Them). Confirm reads the latest items again (a ref), works the
  shifts out afresh from the moved card and sends them as one `plan.patchItems` (one undo step), tracking `('Plan',
'Changed', 'GanttMoveFollowing')`. Only an editable chart (`plan.canEdit` drags) reaches it.
- Gantt row order: `planView.rowOrder` (card ids), validated by `isPlanViewSettings` (an array of `isValidItemId`
  strings, none repeated, at most `GANTT_ROW_ORDER_MAX` (5000, `ITEMS_MAX`)). `ganttOrderRows(rows, order)` (gantt-row-order.ts)
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
- `Plan · Changed · ViewDates` (a Dates pick) and `Plan · Changed · ViewMeasure` (a Count By pick).

## Flow charts

Derived from spec "Flow charts"; built in parts (Work Tracker 854). Part 1 shipped the data: the daily flow counts
([item-store blueprint](item-store.md#flow-counts), `packages/items/src/flow-counts.ts`, plan schema step V29).

| Spec term        | Identifier                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Cycle Time       | `PlanVisualisation` `'cycle-time'`                                                            |
| Throughput       | `PlanVisualisation` `'throughput'`                                                            |
| Cumulative Flow  | `PlanVisualisation` `'cumulative-flow'`                                                       |
| range            | `PlanViewRef.rangeDays?: 14 \| 90 \| 180` (absent is 30; `FLOW_RANGES`, `FLOW_RANGE_DEFAULT`) |
| finished/started | moves into a `done` / `doing` phase status (`statusPhasesOf`), read from `item_history`       |
| flow day         | `flowDayOf(ms)`; `FlowCountRow`, `flowCountsOf` (part 1)                                      |

- Part 2 (data read, shipped): `packages/items/src/flow-metrics.ts` and the read route ([item-store blueprint](item-store.md#flow-read)).
  - `FLOW_RANGES` = `[14, 30, 90, 180]`, `FLOW_RANGE_DEFAULT` = 30, `FLOW_DAILY_MAX` = 14 (a range this short or
    shorter reads per day); `FlowStep = [at, from, to]` (statuses, null for none), `FlowCard = { id, type,
createdAt, since, moves: FlowStep[] }` (`since`: its oldest kept history entry; `moves` oldest first),
    `CycleTime = { itemId, at, day, days }`.
  - `cycleTimesOf(cards, phases, fromDay, toDay, types?)`: each card's moves in order; a card's
    finish is its last move into a `done` status from one outside `done`, with `flowDayOf(at)` in the range; its
    start the first move into a `doing` status before that finish, else `max(createdAt, since)`; `days` =
    `(finish - start) / DAY_MS` to one decimal, never below 0. A card missing from `cards`, or of a type outside
    `types`, is skipped. Answers `{ cards: CycleTime[] (by at), p50, p85 }`, the percentiles `percentileOf` (nearest
    rank, D111) and null with no card. Linear in moves, plus n log n for the sort; 2,000 cards of 12 moves each
    measure 6 to 8 ms of CPU warm, 18 ms on the first call (a 100 ms budget).
  - `throughputOf(finished, fromDay, toDay, period)`: a period per day or per Monday-started week
    (`weekStartOf(day)` = `day - (day + 3) mod 7`, day 0 a Thursday) from the one holding `fromDay` to the one holding
    `toDay`; each `{ start, cards, running, whole }`, `running` for the one holding `toDay` (today, not over yet), `whole` when it lies
    inside the range and is not running. `average`: the whole periods' cards over their number, to one decimal, null
    with none. `flowPeriodOf(days)`: `'day'` up to `FLOW_DAILY_MAX`, else `'week'`.
- Part 3 (visible, shipped):
  - Ids: `FLOW_VIEWS` (`isFlowView`) in `PLAN_VISUALISATIONS` and `PLAN_PALETTE_VISUALISATIONS`, labelled in
    `PLAN_VISUALISATION_LABELS`; `rangeDays` validated by `isPlanViewSettings` through `isFlowRange` (any of
    `FLOW_RANGES`, 30 accepted, never written); `flowRangeOf(settings)` reads it, else `FLOW_RANGE_DEFAULT`. No
    `VIEW_NEEDS` row: every card type can feed a flow chart.
  - Read: `fetchFlow(scope, days)` (`apps/editor/lib/api/flow.ts`; `'offline'` for a This Browser plan, `tabId` for a
    tab-scoped session, no `types`: every type is read and each chart filters with its own `viewShownTypes`).
    `createFlowStore` (`hooks/plan/plan-flow-store.ts`) keys an entry by `projectId|tabId|shareCode|days`; an entry
    lives while a chart subscribes and is dropped with its last. `want(key, scope, days, version)` (`version`: the
    `plan.items` map) reads at once the first time, else after `FLOW_REFETCH_MS` (2000) from the last change, one timer
    per entry; an older read's answer is dropped (`seq`); a failed refresh keeps the last answer, a failed first read
    is `error`. `usePlanFlow(scope, days, version)` (`useSyncExternalStore`) answers `{ status: 'none' | 'loading' |
'ready' | 'error' | 'offline', data, retry }`.
  - Frame (`apps/editor/components/plan/views/flow-frame.tsx`): `useFlowChart` (range, read, types), `FlowFrame` over `ViewFrame` (title
    `flowTitle`: "Cycle Time · Last 30 Days"; `loadingText` "Loading flow…"; `empty` a `CompactEmptyState` for
    `offline` and `error` (Try Again: `retry`), "Open the plan to see the flow." outside a plan), the summary row
    (`FLOW_SUMMARY_PX` 30), the key row (Cumulative Flow: `flowKeyLines` lines of `FLOW_KEY_LINE_PX` 16 plus 6, at most `FLOW_KEY_LINES_MAX` 3, wrapping, a too-long name truncated), then the plot svg. `flowFrameState` gives
    the state. Body = element less a 41 px header and 2 px border; `flowPlotBox` is null under `FLOW_PLOT_MIN` (200 ×
    140), the summary then centred alone. `FlowAxes`: `niceTicks` gridlines (dashed, the baseline solid) and labels,
    and the foot's day labels (`flowDayTicks`, at least `FLOW_DAY_LABEL_PX` 44 apart, the last day always) or given
    labels, placed by `placeFootLabels` (clamped `FLOW_DAY_LABEL_HALF_PX` inside the plot, centred, walked back from today dropping any nearer than `FLOW_DAY_LABEL_PX` to the next). `FlowTip` is the hover card (flipped left past 60% of the width, opening upward below half the height). `plotPoint` maps a pointer into the svg
    whatever the zoom.
  - Geometry (`apps/editor/components/plan/views/flow-chart-model.ts`): `niceTicks(max)` (1, 2, 5 × 10ⁿ steps, top at least 1),
    `flowDayLabel` ("3 Nov", UTC), `flowX`, `cumulativeFlowModel(counts, phases, statusNames, surface)` (bands bottom
    to top: phase rank done, doing, todo, then the boards' order backwards; `''` is "No status" at the top; colour
    `bandColour(phase, i / (n - 1), surface)` inside a phase: on a light surface `mixHex(PHASE_COLOURS[phase], surface, 1 - t × 0.55)`, on a dark one (`isDarkSurface`, luminance under 0.18) along `DARK_RAMPS` (doing `#60a5fa` to `#93c5fd`, done `#22c55e` to `#15803d`, todo `#64748b` to `#7b8aa0`), so In Progress reads strongest; `tops` stacked; `inProgress` and
    `done` on the last day), `cycleTimeSummary`, `throughputSummary`, `periodLabel`, `daysText`.
  - `CycleTimeView`: `cycleTimesOf(data.cards, phases, fromDay, toDay, types)`; dots (r 4, In Progress blue at 85%,
    a 1.5 px surface ring) in one memoised layer; p85 dashed and p50 solid lines in the text ink, labelled "85%" /
    "50%" at their right ends; hover is the nearest dot within `CYCLE_HIT_PX` (12, `nearestDot`, linear), and a press or click reads its own point (a tap sends no move), drawn
    larger and ringed in the text ink, with a `FlowTip` (#key title, days, finish day). The plot is a focusable
    `role="group"`: ←/→ step (`plan.announce` the dot), Enter opens; a press on a hovered dot opens its card
    (`plan.openItem`, only while the card is in `plan.items`) and stops the canvas taking the press.
  - `ThroughputView`: `throughputOf(cycleTimesOf(...).cards, fromDay, toDay, flowPeriodOf(days))`; a bar per
    period (`BAR_MAX_PX` 56, `BAR_GAP_SHARE` 0.28, top corners rounded 4, `roundedTop`), the running one at 40%; its
    count above it when the bar is at least `FLOW_BAR_LABEL_MIN_PX` (16) wide; the average dashed, "Avg 8" at its
    right end; foot labels the periods' first days, thinned; hovering a period's column shades it and names it.
    `role="img"` with every period spoken.
  - `CumulativeFlowView`: `flowCountsOf(data.counts, fromDay, toDay, types)` into `cumulativeFlowModel`;
    `bandPaths` (one path per band, its top then the band under's top back; the first and last counted days reach
    their days' edges; days before `countedFrom` undrawn), stroked 1 px in the surface; hover a day: a 1 px line and
    a `FlowTip` of each band's count top first (`TIP_ROWS_MAX` 8, then "and N more"). Summary "12 in progress · 30
    done", with "Counting since 15 Nov" while `countedFrom > 0`; empty "No flow counted yet". `role="img"` speaking the
    last day.
  - Settings: `planViewSettingsModel` adds `flow`, `range`, `setRange(days)` (drops 30, tracks `('Plan', 'Changed',
'ViewRange')`); `FlowRangeOptions` (an `OptionRows` single list, "Last N Days") in `PlanViewSettingsPanel`'s
    **Range** section (open first for a flow view) and `PlanViewMenuSection`'s Range accordion.
  - Palette tiles and Start Planning (`VISUALISATION_INFO`), slot previews (`slot-previews.tsx`), glyphs
    (`plan-view-art.tsx`); image exports draw `flowArt` (packages/plan-art): the frame, its name and range, "Open the
    plan to see the flow.".
  - Telemetry: `Plan · Changed · ViewRange`, charted on the site as "Flow Chart Ranges Changed".
  - Help: plan/visualisations "See How Work Flows" and Range, plan/dashboards.
- Part 4 (agents, shipped):
  - Dashboard input (`packages/agent-verbs/src/plan/dashboard-input.ts`): a chart's `rangeDays?: number`; on a view
    outside `FLOW_VIEWS` refused "rangeDays is a flow chart's range (cycle-time, throughput, cumulative-flow), not
    <view>'s."; outside `FLOW_RANGES` refused "No range of <n> days. A flow chart reads 14, 30, 90, 180 days."; kept in
    `settings.rangeDays` unless `FLOW_RANGE_DEFAULT`. The MCP schema (`packages/agent-verbs/src/mcp/schema.ts` `dashboardField.charts`) takes
    `rangeDays: z.literal(FLOW_RANGES)` and names the three views in `view`'s description.
  - The builder (`packages/templates/src/dashboard-builder.ts` `planViewElement`) drops a `rangeDays` of
    `FLOW_RANGE_DEFAULT`, so a REST or CLI replace never stores 30 either.
  - A replace's `dashboard` body (`packages/edit-operations/src/dashboard-body.ts` `dashboardSpecIssue`): a chart's
    `settings.rangeDays` off a flow view or outside `FLOW_RANGES` is "dashboard.charts[i].settings.rangeDays: a flow
    chart's (cycle-time, throughput, cumulative-flow) range, 14, 30, 90, 180 days"; any settings
    `isPlanViewSettings({ ...settings, view })` refuses is "dashboard.charts[i].settings: not settings a <view> chart
    takes".
  - The element format: `PLAN_VIEW_FORMAT` (`packages/edit-operations/src/plan-elements.ts`), read off
    `DASHBOARD_METRIC_KINDS`, `DASHBOARD_CHART_VIEWS`, `FLOW_VIEWS` and `FLOW_RANGES`, is printed by
    `elementFormatText('plan-view')` (`liveplanner schema plan-view`, `GET /api/schema/plan-view`) and the MCP's
    inline `ELEMENT_SCHEMA_HINT` and `elementSchemaDoc`. A plan view element's `planView.rangeDays` is checked by
    `isPlanViewSettings` as any other write (`invalid_result`).
  - The outline (`packages/project-views/src/content-summary.ts`): a flow view's summary is `view=<id>
rangeDays=<flowRangeOf>`, the range always named. `@liveplanner/project` re-exports `FLOW_RANGES`,
    `FLOW_RANGE_DEFAULT`, `FLOW_VIEWS`, `flowRangeOf`, `isFlowView` and `isPlanViewSettings` for the packages above
    it.
  - Roles: no new gate. A chart's settings change by element writes, which `gateEdit` holds for an Editor (changesets
    and tab saves); a tab-scoped edit link's write to another tab is 404 (`deniedEdit`); the flow read is the part 2
    route's.

## Performance and limits

- Each model is linear in the project's items (capped by the item store), memoised on the items map, the phases
  and (calendar) the month; the Gantt recomputes once a day. No timers; a calendar drag adds four window listeners
  only while it runs, one state update per pointer move (the ghost and target ring), and no write until the drop.

## Testing

| Rule                                                 | Test                                                                                                                                                                                                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ids, sizes, phases, metric board                     | packages/items/src/plan-views.test.ts                                                                                                                                                                                                              |
| Gantt rows, marks, axis, ticks, drags, scales        | packages/items/src/plan-view-gantt.test.ts                                                                                                                                                                                                         |
| Calendar, workload, status, priority models          | packages/items/src/plan-view-charts.test.ts                                                                                                                                                                                                        |
| Calendar moves, Start Calendar model                 | packages/items/src/calendar-move.test.ts                                                                                                                                                                                                           |
| Calendar drag, keyboard move, roles, Start Cal       | apps/editor/components/plan/views/CalendarView.test.tsx                                                                                                                                                                                            |
| Element seed, validation, export box                 | packages/project/src/plan-shapes.test.ts                                                                                                                                                                                                           |
| Rendering, empty and loading, opening, metrics       | apps/editor/components/plan/views/PlanViewView.test.tsx                                                                                                                                                                                            |
| Gantt window pin, pan, slop, cleanup                 | apps/editor/components/plan/views/useGanttWindow.test.ts                                                                                                                                                                                           |
| Gantt View flyout (card types, swimlanes)            | apps/editor/components/palette/PlanViewMenuSection.test.tsx                                                                                                                                                                                        |
| Gantt row order (apply, reorder, validation)         | packages/items/src/gantt-row-order.test.ts                                                                                                                                                                                                         |
| Gantt row drag, keyboard move, lanes                 | apps/editor/components/plan/views/GanttRowOrder.test.tsx                                                                                                                                                                                           |
| Palette categories and tiles                         | apps/editor/components/palette/palette-*.test.ts(x)                                                                                                                                                                                                |
| Slot name: read, cap, remap, set and clear           | packages/project/src/slot-name.test.ts                                                                                                                                                                                                             |
| Slot name field: offered, save, Escape, clear, roles | apps/editor/components/plan/dashboard/SlotNameField.test.tsx                                                                                                                                                                                       |
| Slot name shown on a chart, metric and figures       | apps/editor/components/plan/views/PlanViewView.slot-name.test.tsx, apps/editor/components/plan/dashboard/DashboardSheetMetric.test.tsx, apps/editor/components/plan/dashboard/DashboardFormMetric.test.tsx                                         |
| Slot name in exports                                 | packages/plan-art/src/dashboard-export.test.ts, dashboard-card-art.test.ts, plan-view-art.test.ts                                                                                                                                                  |
| Flow store: share, debounce, drop, error, retry      | apps/editor/hooks/plan/plan-flow-store.test.ts                                                                                                                                                                                                     |
| Flow geometry, bands, summaries                      | apps/editor/components/plan/views/flow-chart-model.test.ts                                                                                                                                                                                         |
| Flow charts: states, hover, keys, roles, a full plan | apps/editor/components/plan/views/FlowViews.test.tsx                                                                                                                                                                                               |
| Agent chart names                                    | packages/agent-verbs/src/plan/dashboard-input.test.ts, packages/templates/src/dashboard-builder.test.ts                                                                                                                                            |
| Flow charts for agents: input, body, format, outline | packages/agent-verbs/src/plan/dashboard-input.test.ts, packages/agent-verbs/src/mcp/schema.test.ts, packages/edit-operations/src/dashboard-body.test.ts, element-format.test.ts, index.test.ts, packages/project-views/src/content-summary.test.ts |
| Flow charts through the MCP doors and roles          | apps/mcp/src/flow-charts.test.ts                                                                                                                                                                                                                   |
| Flow chart settings and reads by role, end to end    | apps/api/src/routes/flow-chart-roles.test.ts                                                                                                                                                                                                       |

## Constants and configuration

| Constant                    | Value     | Where               | Safe range    |
| --------------------------- | --------- | ------------------- | ------------- |
| `GANTT_PAD_DAYS`            | 7         | plan-view-gantt.ts  | 0..30         |
| `GANTT_MIN_DAYS`            | 28        | plan-view-gantt.ts  | 7..90         |
| `GANTT_WEEK_TICKS_MAX_DAYS` | 120       | plan-view-gantt.ts  | 60..240       |
| `TICK_LABEL_PX`             | 52        | GanttView.tsx       | 40..80        |
| `GANTT_ROW_ORDER_MAX`       | 5000      | gantt-row-order.ts  | = `ITEMS_MAX` |
| `DRAG_SLOP_PX`              | 3         | gantt-drag.tsx      | 2..8          |
| `CALENDAR_DRAG_SLOP_PX`     | 3         | useCalendarDrag.ts  | 2..8          |
| `GANTT_NAMES_MIN_PX`        | 120       | plan-view-gantt.ts  | 80..200       |
| `GANTT_NAMES_MAX_SHARE`     | 0.6       | plan-view-gantt.ts  | 0.4..0.8      |
| `GANTT_NAMES_STEP_PX`       | 16        | plan-view-gantt.ts  | 4..40         |
| `GANTT_PILL_MIN_COLUMN_PX`  | 160       | GanttView.tsx       | 120..240      |
| `LANE_H`                    | 30        | GanttView.tsx       | 20..32        |
| `PLAN_METRIC_SIZE`          | 260 × 64  | plan-views.ts       |               |
| `PLAN_CHART_SIZE`           | 720 × 400 | plan-views.ts       |               |
| `PLAN_GANTT_SIZE`           | 880 × 420 | plan-views.ts       |               |
| `FLOW_REFETCH_MS`           | 2000      | plan-flow-store.ts  | 500..10000    |
| `FLOW_PLOT_MIN`             | 200 × 140 | flow-chart-model.ts |               |
| `FLOW_DAY_LABEL_PX`         | 44        | flow-chart-model.ts | 36..80        |
| `CYCLE_HIT_PX`              | 12        | CycleTimeView.tsx   | 8..20         |

## Defaults ledger

See DEFAULTS.md D25 to D27, D29 and D30.
