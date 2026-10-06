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
- Gantt names column `min(220px, 33%)`, rows 30 px, axis 22 px; bar 14 px, project colour at 28 % with the
  children-done share solid (green when the project is done).
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

| Rule                                           | Test                                                  |
| ---------------------------------------------- | ----------------------------------------------------- |
| Ids, sizes, phases, metric board               | packages/items/src/plan-views.test.ts                 |
| Gantt rows, marks, axis, ticks                 | packages/items/src/plan-view-gantt.test.ts            |
| Calendar, workload, status, priority models    | packages/items/src/plan-view-charts.test.ts           |
| Element seed, validation, export box           | packages/document/src/plan-shapes.test.ts             |
| Rendering, empty and loading, opening, metrics | apps/live/components/plan/views/PlanViewView.test.tsx |
| Palette categories and tiles                   | apps/live/components/palette/palette-*.test.ts(x)     |

## Constants and configuration

| Constant                    | Value     | Where              | Safe range |
| --------------------------- | --------- | ------------------ | ---------- |
| `GANTT_PAD_DAYS`            | 7         | plan-view-gantt.ts | 0..30      |
| `GANTT_MIN_DAYS`            | 28        | plan-view-gantt.ts | 7..90      |
| `GANTT_WEEK_TICKS_MAX_DAYS` | 120       | plan-view-gantt.ts | 60..240    |
| `TICK_LABEL_PX`             | 52        | GanttView.tsx      | 40..80     |
| `PLAN_METRIC_SIZE`          | 260 × 64  | plan-views.ts      |            |
| `PLAN_CHART_SIZE`           | 720 × 400 | plan-views.ts      |            |
| `PLAN_GANTT_SIZE`           | 880 × 420 | plan-views.ts      |            |

## Defaults ledger

See DEFAULTS.md D25 to D27.
