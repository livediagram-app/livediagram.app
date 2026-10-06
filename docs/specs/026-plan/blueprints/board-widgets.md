# Board widgets blueprint

Derived from [Board widgets](../board-widgets.md).

## Domain and naming

| Spec term     | Identifier                                                        |
| ------------- | ----------------------------------------------------------------- |
| widget kind   | `BoardWidgetKind` (`BOARD_WIDGET_KINDS`, packages/items)          |
| a board's set | `PlanBoardSetup.widgets?: BoardWidgetKind[]`; read by `widgetsOf` |
| default set   | `DEFAULT_BOARD_WIDGETS` (+ `votes` when `voting.on`)              |
| widget zone   | `BoardWidgetZone` (`data-widget-zone`), in `[data-board-header]`  |
| widget        | `BoardWidgetView` inside a `[data-widget=<kind>]` wrapper         |
| Widgets tile  | `PaletteTileDef` with `action: { type: 'plan-widget', widget }`   |

## Files

```
packages/items/src/board-widgets.ts      kinds, default set, readBoardWidgets, widgetsOf, placeWidget,
                                         nudgeWidget, removeWidget (pure)
packages/items/src/board.ts              PlanBoardSetup.widgets; normaliseBoardSetup keeps it via readBoardWidgets
apps/live/components/plan/board-widget-catalogue.ts   BOARD_WIDGET_INFO (label, description), PLAN_WIDGET_MIME
apps/live/components/plan/plan-tile-art.tsx           BoardWidgetArt (one Glyph per kind)
apps/live/components/plan/widgets/widget-stats.ts     boardItems, boardPeople, boardTypeCounts, overWipColumns,
                                                      dueCounts (pure)
apps/live/components/plan/widgets/BoardWidgetView.tsx one pill per kind (WIDGET_PILL, 28 px)
apps/live/components/plan/widgets/BoardWidgetZone.tsx the zone: order, reorder drag, keys, ×, drop bar
apps/live/components/plan/PlanBoardHeader.tsx         title, zone, Reveal / Retry, the unplaced list
apps/live/hooks/plan/plan-widget-drop.ts              widgetSlotAt, planWidgetDragOver, dropPlanWidgetAt,
                                                      dropPlanWidgetFromPalette, addPlanWidgetToBoard,
                                                      setPlanWidgetEditor
apps/live/hooks/plan/plan-board-targets.ts            target fields canEditWidgets, widgetHover, placeWidget;
                                                      planBoardIds
apps/live/hooks/plan/usePlanBoardDrop.ts              registers them; returns widgetSlot
apps/live/hooks/canvas/usePaletteDrop.ts              routes PLAN_WIDGET_MIME drags and drops
apps/live/components/palette/palette-plan-tiles.tsx   a tile per kind, section `plan-widgets`
```

## Behaviour and state

- `widgetsOf(setup)`: `setup.widgets` when present (an empty list is a board with none), else the default set.
- `placeWidget(list, kind, index)`: removes `kind` if present, inserts it before the widget at `index` of the
  list as it was (`index - 1` when it came from before `index`), clamped to the ends.
- Reorder: pointerdown on a wrapper (not an input) starts a press; past `REORDER_THRESHOLD_PX` it is a drag;
  `widgetSlotAt(zone, x, kind)` gives the slot; pointerup commits `placeWidget` when the order changed, and the
  click that follows is swallowed. Pointercancel drops it.
- Keys on a focused wrapper: Alt+←/→ `nudgeWidget`; Delete/Backspace `removeWidget`.
- Palette drag: `usePaletteDrop` calls `planWidgetDragOver` (the board under the point via
  `otherPlanBoardAt`, inside its header's vertical span, editable) which sets that board's `widgetSlot`;
  `dropEffect` is `copy` there and `none` elsewhere. Drop calls `dropPlanWidgetFromPalette`. Any `dragend` clears
  the marker.
- Tap: `addPlanWidgetToBoard(kind)`: the selected element when it is a registered board, else the only
  registered board, else the notice; places at the end.
- Taking Filter off clears `quick.text`; taking Only Mine off clears `quick.mine`.

## Narrowing and feedback

- `QuickFilter` gains `person` (`UNASSIGNED = '-'` for nobody), `type`, `due` (a `QuickDueWindow`
  `{ from?, to, doneStatus? }`, YYYY-MM-DD, both ends inclusive, the done status excluded, so a Due Soon count
  narrows to exactly the cards it counts) and `priority`; `quickFilterMatches` applies each.
  `toggle(quick, key, value)` sets one or clears it when equal (compared by value).
- Item Count while `narrowed(quick)`: a button "`shown` of `total` · Show all" that sets `{}`.
- Completion with no `doneColumnId` and `canEdit`: "Set Done Column" sets the last column's id (`DoneColumn`).
- Reorder captures the pointer only once a press passes `REORDER_THRESHOLD_PX`, so a still press is a click on
  the widget's control.
- `placeWidget(kind, slot, { tap })` returns `added | moved | already | refused`; a kind the board has sets
  `flashWidget` for `WIDGET_FLASH_MS` (1400 ms): a 2 px `palette.focus` ring, pulsing (none with reduced motion).
  A tap on one it has returns `already`, said as "<Label> is already on this board".
- New kinds and their stats (`widget-stats.ts`): `points` (`boardPoints`), `priorities` (`priorityCounts`),
  `unassigned` (`unassignedCount`), `top-voted` (`topVoted`), `stale` (`staleCount`, `STALE_DAYS` 14). Presets
  carry their own `widgets` (presets.ts); Blank keeps the default set.
- Counts render through `CountBadge` from `@livediagram/ui` at `size="md"` (an 18 px pill with
  `text-optical-centre`) painted with the board's `background`/`color`, shared with column heads.

## Interfaces and contracts

- Stored shape: `widgets` is an array of kind strings. `readBoardWidgets` drops unknown kinds and repeats; a
  non-array is absent. No new D1 column: it rides in the element's `planBoard`.
- `PlanBoardTarget` gains `canEditWidgets(): boolean`, `widgetHover(slot | null)`, `placeWidget(kind, slot)`.

## Errors and edge cases

| Case                                 | Handling                                                    |
| ------------------------------------ | ----------------------------------------------------------- |
| Dropped off any header               | Nothing placed; toast "Drop a widget into a board’s header" |
| Tapped with no board to choose       | Toast "Select a board to add the widget to"                 |
| A viewer who may not edit            | Zone has no ×, no drag, no keys; drops are refused          |
| Kind the board already has           | Moves to the drop place (tap: to the end)                   |
| Completion with no done column       | "No done column"                                            |
| Votes Left on a board without voting | Renders nothing                                             |
| Items of a type the catalogue lost   | Counted under the type they read as (`typeIn`)              |
| More widgets than fit                | The zone scrolls sideways                                   |

## Presentation and UX

- Pill: `h-7 rounded-md border px-2 text-[12px] font-medium`, border `palette.border`, text `palette.muted`,
  figures `palette.text`; WIP over: `palette.warning` on `palette.warningBg`.
- Drop / reorder bar: 2 × 24 px, `palette.focus`. A zone under a palette drag: 1.5 px dashed `palette.focus`.
- Empty zone copy for an editor: "Drag Widgets here from the palette".
- × : 16 px disc at the wrapper's top right, shown only while the board is selected (`selected`, from `PlanBoardHeader`), on any pointer; otherwise `display: none`, so it is out of the tab order too (Delete still removes a focused widget).

## Accessibility

- Zone `role="list"`, `aria-label="Board widgets"`; wrapper `role="listitem"`, focusable for editors, named
  "<Label> widget", `aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Delete"`; × named "Remove <Label>".
- Completion and People are `role="img"` with a spoken summary; Only Mine is `aria-pressed`.

## Observability

- Every place, move and removal sends `track('Plan', 'Changed', 'Widgets')` through `trackSetup`.
- A palette placement announces "<Label> added to the board" through `plan.announce`.

## Performance and limits

- `boardItems(projection)` reads the cards an unfiltered projection placed (so archived cards stay off an
  ordinary board's counts and All Cards and Archive boards count what they show), memoised on the setup and items; widget stats are linear in the board's items (≤ the
  document's item cap). At most `BOARD_WIDGET_KINDS.length` (10) widgets per board.

## Testing

| Rule                                              | Test                                                   |
| ------------------------------------------------- | ------------------------------------------------------ |
| Known kinds once, default set, place/nudge/remove | packages/items/src/board-widgets.test.ts               |
| Counts behind People, Types, WIP, Due             | apps/live/components/plan/widgets/widget-stats.test.ts |
| Slot math, drag-over marker, drop, misses         | apps/live/hooks/plan/plan-widget-drop.test.ts          |
| Widgets category and its ten tiles                | apps/live/components/palette/palette-*.test.ts         |

## Constants and configuration

| Constant               | Value | Where               | Safe range |
| ---------------------- | ----- | ------------------- | ---------- |
| `REORDER_THRESHOLD_PX` | 4     | BoardWidgetZone.tsx | 2..10      |
| `PEOPLE_SHOWN`         | 5     | BoardWidgetView.tsx | 3..8       |
| `TYPES_SHOWN`          | 5     | BoardWidgetView.tsx | 3..8       |
| `DUE_SOON_DAYS`        | 7     | widget-stats.ts     | 1..30      |

## Defaults ledger

See DEFAULTS.md D17 to D19.
