# Board widgets blueprint

Derived from [Board widgets](../board-widgets.md).

## Domain and naming

| Spec term      | Identifier                                                                     |
| -------------- | ------------------------------------------------------------------------------ |
| widget kind    | `BoardWidgetKind` (`BOARD_WIDGET_KINDS`, packages/items)                       |
| field widget   | `FieldWidgetKey` `field:<view>:<fieldId>` (field-widgets.ts)                   |
| widget view    | `FieldWidgetView` (`FIELD_WIDGET_VIEWS`); a field's by `viewsOfField`          |
| widget id      | `BoardWidgetId` = `BoardWidgetKind \| FieldWidgetKey`                          |
| a board's set  | `PlanBoardSetup.widgets?: BoardWidgetId[]`; read by `widgetsOf`                |
| board's fields | `BoardField` `{ def, types }` from `boardFields(setup, types)`                 |
| default set    | `DEFAULT_BOARD_WIDGETS` (+ `votes` when `voting.on`)                           |
| widget zone    | `BoardWidgetZone` (`data-widget-zone`), in `[data-board-header]`               |
| widget         | `BoardWidgetView` / `FieldWidgetView` inside a `[data-widget=<id>]` wrapper    |
| widget gallery | `BoardWidgetPicker` (`AnchoredPopover` "Add a Widget"), `gallerySections`      |
| For You        | `suggestWidgets` (packages/plan-art widget-suggestions.ts), `WidgetSuggestion` |

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
apps/editor/components/plan/widgets/BoardWidgetPicker.tsx  the + gallery: search, rail, sections of tiles, keys, live
                                                            announcements
packages/items/src/field-widgets.ts      field shapes and views, keys (fieldWidgetKey, parseFieldWidget),
                                         FIELD_WIDGETS_MAX, boardFields, fieldWidgetState (pure)
packages/plan-art/src/field-widget-stats.ts   fieldSummary per shape, fieldSummaryOf (kept per list), fieldFills,
                                              fieldNumberText, typeNamesText (pure)
packages/plan-art/src/widget-suggestions.ts   suggestWidgets: For You, scored with reasons (pure)
apps/editor/components/plan/widgets/FieldWidgetView.tsx      a field widget's pill per view, and the gone pill
apps/editor/components/plan/widgets/field-widget-charts.tsx  Ring, SplitBar, MiniBars, Stars (inline SVG)
apps/editor/components/plan/widgets/use-field-widgets.ts     fields, Calculated reader, labelOf, suggest
apps/editor/components/plan/widgets/widget-gallery-model.ts  WIDGET_GROUPS, gallerySections, sectionSize (pure)
apps/editor/components/plan/widgets/WidgetGalleryRail.tsx    the rail (a chip row under 600 px)
apps/editor/components/plan/widgets/WidgetGalleryTile.tsx    a tile: live preview (FitWidth), name, line, On Board
apps/editor/components/plan/widgets/use-seen.ts              one IntersectionObserver per gallery (useSeenRoot, useSeen)
```

## Behaviour and state

- `widgetsOf(setup)`: `setup.widgets` when present (an empty list is a board with none), else the default set.
- `placeWidget(list, kind, index)`: removes `kind` if present, inserts it before the widget at `index` of the
  list as it was (`index - 1` when it came from before `index`), clamped to the ends.
- Reorder: pointerdown on a wrapper (not an input) starts a press; past `REORDER_THRESHOLD_PX` it is a drag;
  `widgetSlotAt(zone, x, kind)` gives the slot; pointerup commits `placeWidget` when the order changed, and the
  click that follows is swallowed. Pointercancel drops it.
- Keys on a focused wrapper: Alt+←/→ `nudgeWidget`; Delete/Backspace `removeWidget`.
- Add: widgets are not in the palette; the zone's + opens `BoardWidgetPicker` and a tile calls
  `onChange(toggleWidget(widgets, id))`: added at the end, or taken off when the board has it; a field widget past
  `FIELD_WIDGETS_MAX` is refused (its tile is `aria-disabled`). The gallery stays open; the + or Escape closes it.
- Field widgets: `PlanBoardHeader` dispatches an id to `FieldWidgetView` when `isFieldWidgetKey`, with a
  `FieldWidgetContext` (fields, the board's cards before its quick filter, set-up, palette, `now`, the Calculated
  reader, `canEdit`, `onRemove`). `fieldWidgetState` gives `ok`, `removed` (no board type offers the field) or
  `changed` (the view is not in `viewsOfField`); the last two draw the dashed pill with Remove for editors.
- For You: `suggest()` runs once, on the + press, and the gallery freezes its result, so adding one marks it On
  Board rather than reshuffling. Fields score `1 + share` past half filled, else `0.4 + 0.5 * share`; built-ins
  0.5 to 0.9; ties keep fields first; top `SUGGESTIONS_MAX`.
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
- The + toggles `BoardWidgetPicker` (an `AnchoredPopover`, `GALLERY_WIDTH` 720, a `@container`) listing every
  widget: For You, `WIDGET_GROUPS`, then a section per card type of its fields (`gallerySections`); a tile toggles
  (see Add above). The rail's entry scrolls its section to the list's top (smooth unless reduced motion); a scroll
  marks the last section whose top has passed as current. A search resets to the top only when its text changes.
- New kinds and their stats (`widget-stats.ts`): `points` (`boardPoints`), `priorities` (`priorityCounts`),
  `unassigned` (`unassignedCount`), `top-voted` (`topVoted`), `stale` (`staleCount` over `staleItems`, `STALE_DAYS` 14), `time` (`boardTime` over `timeFieldOf(type)`: the first Time Spent field, else the first Duration; minutes, cards counted and timers running); `dueCounts`, `staleItems` and the Due Soon narrowing (`QuickDueWindow.finished`) leave out `finishedStatuses(setup)`, every done column's status (`isDoneColumn`); `boardPoints` counts points in any of them as done. Presets
  carry their own `widgets` (presets.ts), Blank included, per board-widgets.md "Defaults"; a guard test keeps
  Completion off any preset or template board without a done column and WIP Alerts off any without a `wipLimit`.
- Counts render through `CountBadge` from `@liveplanner/ui` at `size="md"` (an 18 px pill with
  `text-optical-centre`) painted with the board's `background`/`color`, shared with column heads.

## Interfaces and contracts

- Stored shape: `widgets` is an array of kind strings and `field:<view>:<fieldId>` keys. `readBoardWidgets` drops
  unknown kinds, malformed keys (a view not in `FIELD_WIDGET_VIEWS`, a field id off `CUSTOM_FIELD_ID_PATTERN`),
  repeats and field keys past `FIELD_WIDGETS_MAX`; a non-array is absent. A key naming a field the board no longer
  offers is kept (it draws as gone). No new column: it rides in the element's `planBoard`; the API's generated
  OpenAPI schema (`schemas.generated.ts`) carries the wider union.

## Errors and edge cases

| Case                               | Handling                                                             |
| ---------------------------------- | -------------------------------------------------------------------- |
| A viewer who may not edit          | Zone has no +, no Edit Widgets, no ×, no drag, no keys               |
| Widget the board already has       | Its tile shows On Board; pressing takes it off                       |
| Field widget past the cap          | Tile `aria-disabled`, Tooltip "A board holds up to 12 field widgets" |
| Field gone from the board's types  | Dashed pill "This field was removed", Remove for editors             |
| Field kind no longer fits the view | Dashed pill "This field changed kind", Remove for editors            |
| Field with no values               | "<Field>: no values yet"                                             |
| Suggested field gone before open   | Dropped from For You (`gallerySections`)                             |
| Completion with no done column     | "No done column"                                                     |
| Items of a type the catalogue lost | Counted under the type they read as (`typeIn`)                       |
| More widgets than fit              | The zone scrolls sideways                                            |

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
- A field widget is `role="img"` named "<Title>: <spoken>" ("Budget Sum, on Feature cards: £4,000 over 2 cards").
- Gallery: the search is `autoFocus`, ArrowDown from it focuses the first tile; arrows move between tiles by layout
  (`stepFrom`); each tile is one button named "Add <Name>" / "Remove <Name>", `aria-pressed`; the rail is
  `nav` "Widget sections" with `aria-current`; an `aria-live="polite"` line says "<Name> added" / "taken off the
  board".

## Observability

- Every place, move and removal sends `track('Plan', 'Changed', 'Widgets')` through `trackSetup`.

## Performance and limits

- `boardItems(projection)` reads the cards an unfiltered projection placed (so archived cards stay off an
  ordinary board's counts and All Cards and Archive boards count what they show), memoised on the setup and items; widget stats are linear in the board's items (≤ the
  project's item cap). At most `BOARD_WIDGET_KINDS.length` built-in widgets and `FIELD_WIDGETS_MAX` field widgets
  per board.
- Field summaries: one pass per field over the board's cards, kept in a `WeakMap` keyed by the card list and checked
  against the field's definition, its types, the reader, the day and the done columns, so re-renders and a field's
  several views cost nothing more. `fieldFills` reads every field in one pass for For You. Ten fields and For You
  over 2,000 cards: 12 ms CPU measured (field-widget-stats.perf.test.ts, budget 60 ms).
- The gallery computes For You only on open, and draws a tile's preview only once `useSeen` reports it near view
  (`SEEN_MARGIN`); `fields` is memoised on `addTypes` and the types, so adding a widget never rebuilds sections.

## Testing

| Rule                                                          | Test                                                           |
| ------------------------------------------------------------- | -------------------------------------------------------------- |
| Known kinds once, default set, place/nudge/remove             | packages/items/src/board-widgets.test.ts                       |
| Counts behind People, Types, WIP, Due                         | packages/plan-art/src/widget-stats.test.ts                     |
| Slot math, the + picker offering only the missing             | apps/editor/components/plan/widgets/BoardWidgetZone.test.tsx   |
| Edit Widgets: × on every widget, Done, Escape, outside, roles | apps/editor/components/plan/widgets/BoardWidgetZone.test.tsx   |
| Field shapes, views, keys, cap, boardFields, state, toggle    | packages/items/src/field-widgets.test.ts                       |
| Each shape's summary, caching, fills, number text             | packages/plan-art/src/field-widget-stats.test.ts               |
| 2,000 cards × 10 fields within the CPU budget                 | packages/plan-art/src/field-widget-stats.perf.test.ts          |
| For You scores, reasons, cap, empty board                     | packages/plan-art/src/widget-suggestions.test.ts               |
| Each view's pill, gone states, Remove by role                 | apps/editor/components/plan/widgets/FieldWidgetView.test.tsx   |
| Gallery sections, rail, On Board, cap, search, keys, empty    | apps/editor/components/plan/widgets/BoardWidgetPicker.test.tsx |
| labelOf, fields kept, Calculated reader, lazy previews        | apps/editor/components/plan/widgets/use-field-widgets.test.tsx |

## Constants and configuration

| Constant               | Value | Where                 | Safe range |
| ---------------------- | ----- | --------------------- | ---------- |
| `REORDER_THRESHOLD_PX` | 4     | BoardWidgetZone.tsx   | 2..10      |
| `PEOPLE_SHOWN`         | 5     | BoardWidgetView.tsx   | 3..8       |
| `TYPES_SHOWN`          | 3     | BoardWidgetView.tsx   | 3..8       |
| `DUE_SOON_DAYS`        | 7     | widget-stats.ts       | 1..30      |
| `FIELD_WIDGETS_MAX`    | 12    | field-widgets.ts      | 6..20      |
| `SPREAD_BINS`          | 8     | field-widget-stats.ts | 5..12      |
| `TIMELINE_WEEKS`       | 4     | field-widget-stats.ts | 2..8       |
| `SUGGESTIONS_MAX`      | 6     | widget-suggestions.ts | 4..8       |
| `FILTER_SUGGEST_CARDS` | 20    | widget-suggestions.ts | 10..50     |
| `BREAKDOWN_NAMED`      | 2     | FieldWidgetView.tsx   | 1..3       |
| `GALLERY_WIDTH`        | 720   | BoardWidgetPicker.tsx | 600..800   |
| `SEEN_MARGIN`          | 160px | use-seen.ts           | 0..400px   |

## Defaults ledger

See DEFAULTS.md D17 to D19. The field widget and gallery defaults below join DEFAULTS.md once the open import work
there (#1168) lands:

| Default                                 | Value                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------- |
| Field widgets a board holds             | 12, beside the built-ins                                                   |
| A number field's suggested view         | Sum (Percent: Average; Rating: Average Stars)                              |
| When a field outranks the built-ins     | Filled on more than half the cards offered it                              |
| Where a field shared by types is listed | Under the first of the board's types offering it, "Also on" the others     |
| A Timeline's horizon                    | Overdue, then the next 4 weeks                                             |
| Whether field widgets follow the filter | No: like every widget, they read the board's cards before its quick filter |

## Filter field and saved filters (board-widgets.md "The Filter widget", "Saved filters")

- **Naming**: `QuickFilter.filters?: CardSearchFilter[]` (the field chips, packages/items `board.ts`);
  `SavedBoardFilter { id; name; text?; mine?: true; filters?: CardSearchFilter[]; person?; type?; priority?;
due?: 'overdue' | 'soon' }` and `PlanBoardSetup.savedFilters?: SavedBoardFilter[]` (`saved-filters.ts`).
- **Matching**: `projectBoard` matches the chips once per projection: `cardsMatchingFilters(cards, filters, all,
types, statusNames)` (card-search.ts, the core `searchCards` now shares; it never drops archived cards, so an
  Archive board filters too) answers an id set each card is then checked against, beside `quickFilterMatches`. The
  projection is memoised on the quick filter, so chips do not rescan on a render that changes nothing.
- **Widget** (`components/plan/widgets/BoardFilterField.tsx`): `FilterSearchBox` with `compact` and `tone` (the board palette's
  border, ink, muted and focus), chips labelled by `searchFilterLabel`, Add Filter from `searchFields` over the cards
  the board shows under the other narrowings and `searchValues` for a field's values, memoised on `[items, quick,
types]`. `components/plan/widgets/SavedFilterChips.tsx` draws the chips, Save Filter and each chip's menu; the name popover is
  `components/plan/widgets/SavedFilterNamePopover.tsx`.
- **Pure helpers** (`saved-filters.ts`): `SAVED_FILTERS_MAX = 8`, `SAVED_FILTER_NAME_MAX = 40`,
  `SAVED_FILTER_TEXT_MAX = 200`; `isSavedBoardFilters(v)` (the api's check, via validate-shape), `readSavedFilters(v)`
  (normaliseBoardSetup keeps the valid ones, at most 8); `savedFilterFrom(quick, name, id)` (a due window with no
  `from` is `overdue`, else `soon`; `mine` kept as a flag, never the saver's id); `resolveSavedFilter(saved, { mine,
today, soonDays, finished })` (the viewer's id or none; the window from today); `quickNarrows(quick)`;
  `savedFilterNameTaken(list, name, exceptId?)`; `addSavedFilter`, `renameSavedFilter`, `updateSavedFilter`,
  `removeSavedFilter` (each a new list).
- **State**: nothing beside `quick`. The pressed chip is derived: each saved filter is resolved for this viewer and
  today (memoised on the saved list, the set-up, the viewer and the day) and compared with the quick filter by
  `quickKey` (keys sorted, empty words and lists left out). So any change to a narrowing unpresses it, applying the
  pressed one again sets `{}`, and a deleted filter simply has no chip. `PlanBoardHeader` passes the plan's items and
  status names into the widget context (`planItems`, `statusNames`) for the chips' names and counts.
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
