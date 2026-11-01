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

## Files

```
packages/items/src/board-widgets.ts      kinds, default set, readBoardWidgets, widgetsOf, placeWidget,
                                         nudgeWidget, removeWidget (pure)
packages/items/src/board.ts              PlanBoardSetup.widgets; normaliseBoardSetup keeps it via readBoardWidgets
packages/plan-art/src/board-widget-info.ts            BOARD_WIDGET_INFO (label, description)
apps/editor/components/plan/plan-tile-art.tsx           BoardWidgetArt (one Glyph per kind)
packages/plan-art/src/widget-stats.ts                 boardItems, boardPeople, boardTypeCounts, overWipColumns,
                                                      dueCounts (pure)
apps/editor/components/plan/widgets/BoardWidgetView.tsx one pill per kind (WIDGET_PILL, 28 px)
apps/editor/components/plan/widgets/BoardWidgetZone.tsx the zone: order, reorder drag, keys, ×, the + and its picker
apps/editor/components/plan/PlanBoardHeader.tsx         title, zone, Reveal / Retry, the unplaced list
apps/editor/hooks/plan/widget-slot.ts                   widgetSlotAt (the reorder's landmark)
apps/editor/components/plan/widgets/BoardWidgetPicker.tsx  the + popover: the widgets the board lacks, a row each
```

## Behaviour and state

- `widgetsOf(setup)`: `setup.widgets` when present (an empty list is a board with none), else the default set.
- `placeWidget(list, kind, index)`: removes `kind` if present, inserts it before the widget at `index` of the
  list as it was (`index - 1` when it came from before `index`), clamped to the ends.
- Reorder: pointerdown on a wrapper (not an input) starts a press; past `REORDER_THRESHOLD_PX` it is a drag;
  `widgetSlotAt(zone, x, kind)` gives the slot; pointerup commits `placeWidget` when the order changed, and the
  click that follows is swallowed. Pointercancel drops it.
- Keys on a focused wrapper: Alt+←/→ `nudgeWidget`; Delete/Backspace `removeWidget`.
- Add: widgets are not in the palette; the zone's + opens `BoardWidgetPicker` and a pick places at the end (see
  below).
- Taking Filter off clears `quick.text`; taking Only Mine off clears `quick.mine`.

## Narrowing and feedback

- `QuickFilter` gains `person` (`UNASSIGNED = '-'` for nobody), `type`, `due` (a `QuickDueWindow`
  `{ from?, to, doneStatus? }`, YYYY-MM-DD, both ends inclusive, the done status excluded, so a Due Soon count
  narrows to exactly the cards it counts) and `priority`; `quickFilterMatches` applies each.
  `toggle(quick, key, value)` sets one or clears it when equal (compared by value).
- Item Count while `narrowed(quick)`: a button "`shown` of `total` · Show all" that sets `{}`.
- Completion with no done column (`doneColumnsOf(setup)` empty) and `canEdit`: "Set Done Column" flags the last
  column (`setColumnDone`, `DoneColumn`).
- Reorder captures the pointer only once a press passes `REORDER_THRESHOLD_PX`, so a still press is a click on
  the widget's control.
- The + toggles `BoardWidgetPicker` (a `PortalMenu`, `below-start`, wide) offering `BOARD_WIDGET_KINDS` minus the
  board's; a pick calls `onChange(placeWidget(widgets, kind, widgets.length))` and closes it.
- New kinds and their stats (`widget-stats.ts`): `points` (`boardPoints`), `priorities` (`priorityCounts`),
  `unassigned` (`unassignedCount`), `top-voted` (`topVoted`), `stale` (`staleCount` over `staleItems`, `STALE_DAYS` 14), `time` (`boardTime` over `timeFieldOf(type)`: the first Time Spent field, else the first Duration; minutes, cards counted and timers running); `dueCounts`, `staleItems` and the Due Soon narrowing (`QuickDueWindow.finished`) leave out `finishedStatuses(setup)`, every done column's status (`isDoneColumn`); `boardPoints` counts points in any of them as done. Presets
  carry their own `widgets` (presets.ts), Blank included, per board-widgets.md "Defaults"; a guard test keeps
  Completion off any preset or template board without a done column and WIP Alerts off any without a `wipLimit`.
- Counts render through `CountBadge` from `@liveplanner/ui` at `size="md"` (an 18 px pill with
  `text-optical-centre`) painted with the board's `background`/`color`, shared with column heads.

## Interfaces and contracts

- Stored shape: `widgets` is an array of kind strings. `readBoardWidgets` drops unknown kinds and repeats; a
  non-array is absent. No new column: it rides in the element's `planBoard`.

## Errors and edge cases

| Case                               | Handling                                               |
| ---------------------------------- | ------------------------------------------------------ |
| A viewer who may not edit          | Zone has no +, no Edit Widgets, no ×, no drag, no keys |
| Kind the board already has         | Left out of the + picker                               |
| Completion with no done column     | "No done column"                                       |
| Items of a type the catalogue lost | Counted under the type they read as (`typeIn`)         |
| More widgets than fit              | The zone scrolls sideways                              |

## Presentation and UX

- Pill: `h-7 rounded-md border px-2 text-[12px] font-medium`, border `palette.border`, text `palette.muted`,
  figures `palette.text`; WIP over: `palette.warning` on `palette.warningBg`.
- Reorder bar: 2 × 24 px, `palette.focus`.
- Empty zone copy for an editor, only while the board is selected (`BoardWidgetZone` `selected`): "Add widgets to
  this board" and its **+**; unselected, the empty zone draws nothing.
- Edit Widgets: after the **+**, while `widgets.length > 0` and `canEdit`, a 28 px button (a pencil, `lucideGlyph(lucidePencil, 14)` drawn at 10, `Tooltip`
  "Edit Widgets", `aria-pressed={false}`); in edit mode it is `CheckIcon` drawn at 12 in `palette.focus` on a tint of it, named
  "Done Editing Widgets", `aria-pressed`. Both glyphs are sized by their ink to match the **+** (14 px box, ink 14 of 24 units) and take its stroke weight. Its state (`editing`) lives in `BoardWidgetZone`, never saved; it ends on
  Done, Escape or a capture-phase `pointerdown` outside the zone (listened only while editing), and when the
  widgets run out.
- × : 16 px disc at the wrapper's top right, rendered for every widget only while `editing` (no hover, focus or tap
  reveal, and no `selected` gate), so out of edit mode it is out of the tab order too (Delete still removes a focused
  widget).

## Accessibility

- Zone `role="list"`, `aria-label="Board widgets"`; wrapper `role="listitem"`, focusable for editors, named
  "<Label> widget", `aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Delete"`; × named "Remove <Label>".
- Completion and People are `role="img"` with a spoken summary; Only Mine is `aria-pressed`.

## Observability

- Every place, move and removal sends `track('Plan', 'Changed', 'Widgets')` through `trackSetup`.

## Performance and limits

- `boardItems(projection)` reads the cards an unfiltered projection placed (so archived cards stay off an
  ordinary board's counts and All Cards and Archive boards count what they show), memoised on the setup and items; widget stats are linear in the board's items (≤ the
  project's item cap). At most `BOARD_WIDGET_KINDS.length` (10) widgets per board.

## Testing

| Rule                                                          | Test                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| Known kinds once, default set, place/nudge/remove             | packages/items/src/board-widgets.test.ts                     |
| Counts behind People, Types, WIP, Due                         | packages/plan-art/src/widget-stats.test.ts                   |
| Slot math, the + picker offering only the missing             | apps/editor/components/plan/widgets/BoardWidgetZone.test.tsx |
| Edit Widgets: × on every widget, Done, Escape, outside, roles | apps/editor/components/plan/widgets/BoardWidgetZone.test.tsx |

## Constants and configuration

| Constant               | Value | Where               | Safe range |
| ---------------------- | ----- | ------------------- | ---------- |
| `REORDER_THRESHOLD_PX` | 4     | BoardWidgetZone.tsx | 2..10      |
| `PEOPLE_SHOWN`         | 5     | BoardWidgetView.tsx | 3..8       |
| `TYPES_SHOWN`          | 3     | BoardWidgetView.tsx | 3..8       |
| `DUE_SOON_DAYS`        | 7     | widget-stats.ts     | 1..30      |

## Defaults ledger

See DEFAULTS.md D17 to D19.

## Filter field and saved filters (board-widgets.md "The Filter widget", "Saved filters")

- **Naming**: `QuickFilter.filters?: CardSearchFilter[]` (the field chips, packages/items `board.ts`);
  `SavedBoardFilter { id; name; text?; mine?: true; filters?: CardSearchFilter[]; person?; type?; priority?;
  due?: 'overdue' | 'soon' }` and `PlanBoardSetup.savedFilters?: SavedBoardFilter[]` (`saved-filters.ts`).
- **Matching**: `projectBoard` matches the chips once per projection: `cardsMatchingFilters(cards, filters, all,
  types, statusNames)` (card-search.ts, the core `searchCards` now shares; it never drops archived cards, so an
  Archive board filters too) answers an id set each card is then checked against, beside `quickFilterMatches`. The
  projection is memoised on the quick filter, so chips do not rescan on a render that changes nothing.
- **Widget** (`widgets/BoardFilterField.tsx`): `FilterSearchBox` with `compact` and `tone` (the board palette's
  border, ink, muted and focus), chips labelled by `searchFilterLabel`, Add Filter from `searchFields` over the cards
  the board shows under the other narrowings and `searchValues` for a field's values, memoised on `[items, quick,
  types]`. `widgets/SavedFilterChips.tsx` draws the chips, Save Filter and each chip's menu; the name popover is
  `widgets/SavedFilterNamePopover.tsx`.
- **Pure helpers** (`saved-filters.ts`): `SAVED_FILTERS_MAX = 8`, `SAVED_FILTER_NAME_MAX = 40`,
  `SAVED_FILTER_TEXT_MAX = 200`; `isSavedBoardFilters(v)` (the api's check, via validate-shape), `readSavedFilters(v)`
  (normaliseBoardSetup keeps the valid ones, at most 8); `savedFilterFrom(quick, name, id)` (a due window with no
  `from` is `overdue`, else `soon`; `mine` kept as a flag, never the saver's id); `resolveSavedFilter(saved, { mine,
  today, soonDays, finished })` (the viewer's id or none; the window from today); `quickNarrows(quick)`;
  `savedFilterNameTaken(list, name, exceptId?)`; `addSavedFilter`, `renameSavedFilter`, `updateSavedFilter`,
  `removeSavedFilter` (each a new list).
- **State**: `PlanBoardView` keeps `activeSaved: string | null` beside `quick`: applying sets both, any other
  `onQuick` clears it, applying the active one again clears both; a saved filter deleted meanwhile clears it.
- **Contracts**: `plan-board-patch.ts` SETUP_KEYS gains `savedFilters` (a set-up delta, like `widgets`);
  `validate-shape.ts`' `planBoard` rule also refuses a stored `savedFilters` that `isSavedBoardFilters` rejects
  (more than 8, a bad id or name, words past 200, chips past 8 or malformed, an unknown due window or priority).
- **Roles**: `canEdit` (an Editor's set-up) shows Save Filter and each chip's chevron; everyone applies.
- **Errors**: a name taken says "A saved filter already has this name."; an empty name keeps Save disabled; at 8,
  Save Filter hides; a filter whose field or value is gone matches nothing.
- **Telemetry**: `Plan` · `Used` / `Added` / `Renamed` / `Changed` / `Removed` · `SavedFilter`.
- **Testing**: `saved-filters.test.ts` (validation bounds, read, from and resolve, Only Mine for another viewer, the
  window counted from today with the clock pinned, list edits), `board.test.ts` (chips narrow a projection, on an
  Archive board), `plan-board-patch.test.ts` (the key travels), validate-shape's test (refusals),
  `BoardFilterField.test.tsx` (chips, Add Filter, Backspace, Clear), `SavedFilterChips.test.tsx` (apply, press again,
  save, rename, update, delete, name taken, the cap; Editor sees the controls, Participant and Viewer apply only).
