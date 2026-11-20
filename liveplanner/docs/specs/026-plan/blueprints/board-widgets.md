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
packages/items/src/board-setup.ts        PlanBoardSetup.widgets; normaliseBoardSetup keeps it via readBoardWidgets
packages/plan-art/src/board-widget-info.ts            BOARD_WIDGET_INFO (label, description)
apps/editor/components/plan/plan-tile-art.tsx           BoardWidgetArt (one Glyph per kind)
packages/plan-art/src/widget-stats.ts                 boardItems, boardPeople, boardTypeCounts, overWipColumns,
                                                      dueCounts (pure)
apps/editor/components/plan/widgets/BoardWidgetView.tsx one pill per kind (WIDGET_PILL, 28 px), picking the kind
apps/editor/components/plan/widgets/board-widget-parts.tsx   WIDGET_PILL, WidgetContext, Lead, Figure, toggle
apps/editor/components/plan/widgets/board-widget-filters.tsx Only Mine, People, Not on Board, Types
apps/editor/components/plan/widgets/board-widget-measures.tsx WIP, Due, Points, Time, Priorities, Unassigned,
                                                              Top Voted, Stale
apps/editor/components/plan/widgets/BoardWidgetZone.tsx the zone: order, reorder drag, keys, ×, the + and its picker
apps/editor/components/plan/widgets/zone-overflow.ts    a too-full zone: fitWidgets (which widgets the row holds,
                                                        pure), useZoneFit (measured by ResizeObserver), pressedIn,
                                                        PINNED_WIDGET, rowWidgets, slotInList, nudgeInRow
apps/editor/components/plan/widgets/ZoneMore.tsx        More and its More Widgets panel (AnchoredPopover)
apps/editor/components/plan/widgets/CompactBoardFilter.tsx the compact Filter: one button, its panel the whole Filter
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
apps/editor/components/plan/widgets/WidgetGalleryRail.tsx    the rail's sections, on GalleryRail
apps/editor/components/plan/widgets/WidgetGalleryTile.tsx    a tile's live preview and On Board, on GalleryTile
apps/editor/components/plan/gallery/                         the frame, rail, tile and keys shared with Add Field
                                                             (item-types blueprint "Add Field")
apps/editor/components/plan/widgets/use-seen.ts              one IntersectionObserver per gallery (useSeenRoot, useSeen)
apps/editor/components/plan/widgets/kept-stat.ts             keptStat: a widget's count kept per card list and key
apps/editor/components/plan/useDrawnSetup.ts                 the set-up without its filter, one object across filter
                                                             changes (useDrawnSetup, drawnSetupKey)
apps/editor/components/plan/FilterEmptyHint.tsx              the hint when the filter hides every card, narrowingCount
```

## Behaviour and state

- `widgetsOf(setup)`: `setup.widgets` when present (an empty list is a board with none), else the default set.
- `placeWidget(list, kind, index)`: removes `kind` if present, inserts it before the widget at `index` of the
  list as it was (`index - 1` when it came from before `index`), clamped to the ends.
- Reorder: pointerdown on a wrapper (not an input) starts a press; past `REORDER_THRESHOLD_PX` it is a drag;
  `widgetSlotAt(zone, x, kind)` gives the slot; pointerup commits `placeWidget` when the order changed, and the
  click that follows is swallowed. Pointercancel drops it.
- Keys on a focused wrapper: Alt+←/→ `nudgeWidget`; Delete/Backspace `removeWidget`.
- Focus after a removal: `remove` notes the removed kind, its index and which control held the focus (the × or the
  wrapper), and the layout effect on `widgets` that refocuses an Alt+arrow move puts it on the same control of the
  widget now at `min(index, length - 1)`. Once none is left, `emptied` shows the zone's **+** (Add a widget) to this
  person and the focus goes to it. Not `useFocusAfterRemoval` (packages/explorer, keyed to Explorer rows) nor
  `focusRowAfterRemove` (workbench, which looks back before forward): the zone already owns this effect.
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
- A Breakdown or Donut value is a `ValueButton` (field-value-press.tsx, its press worked out by `valuePress`):
  `fieldValueFilter` makes its chip
  (`f:"value"`, `f:p:<id>` for a person), `toggleFieldFilter` adds, replaces or removes it on `quick.filters`
  (packages/items card-search.ts). Labels and Multiple Choice match every value a card holds: `laneGroups`'
  `everyValue`, set only by `cardsMatchingFilters` and `searchValues`, never a board's swimlanes.
- The "+n" of a Breakdown (past `BREAKDOWN_NAMED` = 2) or a Donut (past its first) is `MoreValues`
  (field-value-press.tsx): a `PRESSABLE` button, `aria-haspopup="dialog"`, `aria-expanded`, opening an
  `AnchoredPopover` (`pointer`, `MORE_VALUES_PX` = 240 wide, named "Severity values") of `ValueRow`s, one per
  `summary.values`, each `aria-pressed` and disabled at the chip cap as `ValueButton` is, `pointer-coarse:min-h-11`.
  Pressing a row calls `onQuick` and leaves the popover open. While a value past the named ones is pressed, "+n"
  wears the pressed outline and its name adds ", 1 pressed". The trigger and the panel stop `pointerdown`, so a
  press never starts a widget reorder or a canvas pan.
- Item Count while `narrowed(quick)`: a button "`shown` of `total` · Show all" that sets `{}`.
- Completion with no done column (`doneColumnsOf(setup)` empty) and `canEdit`: "Set Done Column" flags the last
  column (`setColumnDone`, `DoneColumn`).
- Reorder captures the pointer only once a press passes `REORDER_THRESHOLD_PX`, so a still press is a click on
  the widget's control.
- The + toggles `BoardWidgetPicker` (an `AnchoredPopover`, `GALLERY_WIDTH` 720, on `GalleryFrame`: a `@container`
  with a searchbox "Find a widget" and a close cross; `moveAmongTiles` for the keys, ↑ off the top row to the search) listing every
  widget: For You, `WIDGET_GROUPS`, then a section per card type of its fields (`gallerySections`); a tile toggles
  (see Add above). The rail's entry scrolls its section to the list's top (smooth unless reduced motion); a scroll
  marks the last section whose top has passed as current. A search resets to the top only when its text changes.
  All three are `components/plan/gallery/use-gallery-spy.ts` (`useGallerySpy`), shared with Add Field's rail.
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
| More widgets than fit              | The rest go into More; the Filter pinned at the zone's start         |
| Not even the Filter and More fit   | Both stay (the row clips past the zone, never wraps): `shown` is 0   |
| A widget in More holds a press     | More reads pressed and names the value (`pressedIn`)                 |
| Everything fits while More is open | More and its panel close (`hidden.length === 0`)                     |
| The zone not laid out (room 0)     | No change: the last fit stays (jsdom, a hidden tab)                  |
| A +n legend opened in the row      | `AnchoredPopover preventScroll`: nothing in the header moves         |

## Presentation and UX

- Pill: `h-7 rounded-md border px-2 text-[12px] font-medium`, border `palette.border`, text `palette.muted`,
  figures `palette.text`; WIP over: `palette.warning` on `palette.warningBg`.
- Reorder bar: 2 × 24 px, `palette.focus`.
- A too-full zone (`useZoneFit`, `fitWidgets`; Work Tracker 880): the zone (`data-widget-zone`, never scrolls, one
  row) holds, while anything overflows, the pinned Filter (`data-widget-pin`, `role="group"` "Filter widget",
  `aria-keyshortcuts="Delete"`, no drag), then the list (`data-widget-row`) of the widgets that fit, then More
  (`ZoneMore`), then the + and Edit Widgets. The widgets that do not fit are drawn in a **measuring layer**
  (`data-widget-measure`: `absolute` 0 × 0 `overflow-hidden`, `invisible`, `aria-hidden`, `inert`) at their natural
  width, so every widget's width stays known and live wherever it is drawn; a ghost More (unpressed, two-digit count)
  sits there too, for its width, and while anything overflows a compact Filter ghost (`data-widget-compact-ghost`),
  plus the whole Filter (`data-widget-measure-only`, never in More) while the pinned one is compact.
- `fitWidgets({ order, widths, room, controls, more, compact, pressed })` is pure: with every widget, its `ZONE_GAP_PX` gaps and
  the controls within `room`, nothing overflows. Otherwise the Filter (when the board has it) pins and the rest fill
  in order: the most `shown` such that the Filter, the first `shown` of the rest, More and the controls fit, More
  counted at its measured width plus `MORE_LABEL_MAX_PX` when any widget it would hold has a press (so a pressed
  value's label never feeds back into the fit). Widgets are never skipped to fill a gap: the row keeps the board's
  order. With the widths the same, the answer is the same, so nothing flips. When not even none of the rest fit beside
  the whole Filter, the steps go on, each tried only when the one before fits nothing: the Filter pinned at its
  `compact` width (`filter: 'compact'`), More naming its press; compact with More's dot (`named: false`, counted at
  `MORE_DOT_PX` in place of `MORE_LABEL_MAX_PX`); then the Filter in More with the rest (`filter: 'more'`, `pinned:
false`), More named, then dotted. Each step is one linear pass, at most five, so the fit stays linear.
- A refit in the same room with the same widgets keeps the row (Work Tracker 1087, spec "A press never reshuffles
  the row"): `useZoneFit` records `{ room, key }` of each fit and, when both match, tries `keptFit(input, prev)` first:
  the previous `pinned`, `filter` and `shown` with the widths as they are now, More counted with
  `MORE_LABEL_MAX_PX` when it names a held press, else `MORE_DOT_PX` (`named: false`); null when even that overflows,
  and then `fitWidgets` runs afresh. A fit made before the zone first read its presses (`pressed` null) is never
  recorded, so a board mounting with a press fits afresh. Each fit also writes `data-widget-zone-min` on the zone:
  `zoneMinWidth` (compact Filter, More, its dot, the controls and their gaps; no Filter, More, dot and controls;
  never more than every widget), what the header's card type chips may not take from it (plan-board.md
  blueprint, use-chips-fit.ts). The compact Filter ghost is drawn whenever the board has a Filter, for that width.
- Room: the zone's `clientWidth`. The zone is `flex-1` (the canvas header, filling the room it has) and carries
  `width: <every widget's need>px`, so in a header band, whose span is sized by its content up to
  `max-w-[min(56vw,46rem)]`, the zone asks for what every widget needs and the cap gives the room, however many are
  in More.
- Measuring: one `ResizeObserver` on the zone, each widget wrapper (row, pinned and measuring layer), the controls
  and the ghost More, re-observed when the fit changes; each callback reads the widths (`offsetWidth`, layout fresh
  in the callback) and sets state only when `{ overflow, pinned, filter, shown, named }` changes. Presses are read in a layout
  effect after every render (`pressedIn`: `[data-widget-pressed]` inside each `[data-widget]` of the zone, a
  `querySelectorAll`, no layout read). Room 0 (not laid out) keeps the last fit.
- `data-widget-pressed="<label>"` marks, only while on, each part of a widget that narrows the board: Only Mine
  ("Only Mine"), a person (their name), a type (its label), a priority ("High priority"), a due count ("Overdue",
  "Due soon"), Unassigned ("Unassigned"), a field value ("Severity: High") and a field widget's "+n" while a value it
  leaves out is pressed (that value). More names the first in the order the widgets it holds come, with "+n" for the
  rest.
- More (`ZoneMore`): a 28 px `WIDGET_PILL` button, "More", a `CountBadge` of the widgets it holds (min two digits
  wide), a chevron; pressed: `palette.focus` border and text on a 12% tint, `font-semibold`, the label (max
  `MORE_LABEL_MAX_PX`, `truncate`) in place of "More", or, with `named` false, a 6 px `palette.focus` dot
  (`data-widget-more-dot`) before "More". It opens an `AnchoredPopover` (`align="end"`, its width the
  widest widget it holds plus 16 px, from `MORE_PANEL_MIN_PX` to `MORE_PANEL_MAX_PX`, `preventScroll`), named "More
  Widgets", the panel drawn on `palette.surface` with `palette.border`, a small "More Widgets" caption, then a list
  (`role="list"` "More widgets") of the widgets one to a line, each the zone's own wrapper (`data-widget`,
  `data-widget-more`, ×, Delete, Alt+arrows) so the focus rules and edit mode hold there too. A press in the panel
  is inside the zone for edit mode (`data-widget-more-panel`).
- A drag's slot (`widgetSlotAt` over the row's list) and a nudge are in the row's order (`slotInList`, `nudgeInRow`);
  a removal's refocus finds the next widget by id, in the row or the More panel.
- Empty zone for an editor (`BoardWidgetZone`, `widgets.length === 0 && canEdit`): one `ZoneButton` with its words,
  **+** "Add Widgets" (accessible name the same), opening the picker as the **+** does; selected or not, in a header
  band or on the canvas. The last widget taken off moves the focus to it.
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
- More: `aria-haspopup="dialog"`, `aria-expanded`, named "More widgets, <n> more" and, while a widget it holds has a
  press, ", pressed: <label>"; `aria-pressed` is not used (it opens a panel, it does not toggle). The measuring
  layer is `aria-hidden` and `inert`, so its copies are never read or reached.
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
  over 2,000 cards: 12 ms CPU measured, 15 ms over 5,000 (field-widget-stats.perf.test.ts, budget 60 ms).
- **A filter change** (a teammate's arrives as a whole new set-up off the wire): `PlanBoardView` projects, counts and
  draws from `useDrawnSetup(setup)`, the set-up without `filter`, matched by a JSON key so it keeps one identity while
  only the filter changes. `usePlanBoardProjection` keeps the unfiltered projection (and `shownItems`, the widgets'
  cards) on that set-up and the items, and makes the filtered one only while a filter narrows: one projection per
  filter change, none with no filter. The built-in widget counts go through `keptStat` (per card list, keyed by what
  else they read: done columns, day, type order; at most `KEPT_PER_LIST` 32 per list), and field summaries already
  key on the list, so a filter change recounts nothing. Writers (column heads, reorder, widgets) still spread the full
  set-up, so they keep the filter.
- **Measured** on 2,000 cards (kanban, assignee lanes, filter on priority; Node, the projection path alone): before,
  two projections plus `boardItems` and four widget counts, 1.93 to 2.28 ms per filter change; after, the key and one
  projection, 0.59 to 0.60 ms. The whole board in jsdom (dev build, `PlanBoardView.filter.perf.test.tsx`): before, 2
  projections and every widget recounted per change; after, 1 projection and 0 recounts, and a change that shows the
  same cards draws 0 card faces. What remains of a change that swaps hundreds of cards (667 here, 540 to 760 ms in
  jsdom dev; 1,667 at 5,000 cards, 1.3 to 1.9 s, against a 3,000 ms budget) is drawing the newly shown cards
  themselves, not the projection or the counts.
- **Measured in a browser** (production build, Chromium at 4x CPU throttle, 2,000 cards over five columns, a
  Participant's board watching the owner change the shared filter; main-thread time over the change, two runs): a
  change that shows the same cards (the projection alone) 27 to 47 ms in all, against 56 ms for the same window with
  no change, and no long task; hiding every card 35 to 52 ms; swapping 667 cards for another 667 160 to 174 ms, showing
  all 2,000 from none 205 to 206 ms, both split into tasks under 50 ms. The columns draw only the cards in view (84 to
  96 card faces of the 667 or 2,000 shown), so drawing never scales with the cards a change shows. One change crossed
  50 ms: narrowing all 2,000 to 667 ran one 51 to 53 ms task.
- **The narrowing task** (Work Tracker 909). Profiled (same set-up, three runs, a Participant's board at 4x watching
  the owner type the filter): narrowing ran 199 to 256 ms of main thread, with one long task each run (80, 55 and
  51 ms). The long task was the whole re-render and commit in one go: React's render and commit of the board, then
  the layout the run reveal reads as the new runs mount (`getBoundingClientRect` in `useCardRunReveal`'s `attach`,
  the one forced layout of the commit) and the card flip's place reads (`placeWithin`, `checkVisibility`). None of
  those is wasted work: the layout is read once for every run, and the flip reads only the near runs. So
  `PlanBoardView` hands the projection `useDeferredValue(applied)`: the filter bar and the filter state take the
  change at once, and the cards' projection and draw follow as a deferred render React yields in every few ms.
  After, three runs: narrowing 210 to 301 ms of main thread with **no long task**; swapping 667 145 to 206 ms, hiding
  all 37 to 56 ms and showing all 2,000 210 to 227 ms, all with no long task; the same 104, 96, 0 and 92 card faces
  drawn as before. A teammate's filter arriving takes the same path. The cost is the risk the card named: the cards
  may show the old filter for one frame after the filter bar shows the new one.
- **The fit** (Work Tracker 880): one `ResizeObserver` per zone, no scroll or window listener, no per-frame work.
  A callback reads each widget's `offsetWidth` inside the observer's delivery (layout already fresh, so no forced
  layout; one forced read before paint when the widgets, the presses or the fit change, so the first paint is already
  right) and runs `fitWidgets`, linear in the widgets (1,000 widgets × 100 fits within a 200 ms CPU budget,
  zone-overflow.test.ts); state is set only when the fit changes. The press read after each render is a
  `querySelectorAll` with no layout read. A widget in More is drawn twice only while the More Widgets panel is open
  (the measuring layer's copy and the panel's); otherwise every widget is drawn once.
- The gallery computes For You only on open, and draws a tile's preview only once `useSeen` reports it near view
  (`SEEN_MARGIN`); `fields` is memoised on `addTypes` and the types, so adding a widget never rebuilds sections.

## Testing

| Rule                                                            | Test                                                           |
| --------------------------------------------------------------- | -------------------------------------------------------------- |
| Known kinds once, default set, place/nudge/remove               | packages/items/src/board-widgets.test.ts                       |
| Counts behind People, Types, WIP, Due                           | packages/plan-art/src/widget-stats.test.ts                     |
| Slot math, the + picker offering only the missing               | apps/editor/components/plan/widgets/BoardWidgetZone.test.tsx   |
| Edit Widgets: × on every widget, Done, Escape, outside, roles   | apps/editor/components/plan/widgets/BoardWidgetZone.test.tsx   |
| A too-full zone: More, Filter pinned, keys, slots, roles        | BoardWidgetZone.overflow.test.tsx                              |
| fitWidgets: fit, order, pressed reserve, 1,000 widgets in CPU   | zone-overflow.test.ts                                          |
| Narrow rooms (364, 300 px): compact Filter, dot, Filter in More | zone-overflow.test.ts, BoardWidgetZone.overflow.test.tsx       |
| A press at 990 px keeps the row (keptFit); zoneMinWidth         | zone-overflow.test.ts                                          |
| The compact Filter: count, name, its panel, a Viewer            | CompactBoardFilter.test.tsx                                    |
| +n opens and closes without scrolling its row (preventScroll)   | packages/workbench AnchoredPopover.focus.test.tsx              |
| Field shapes, views, keys, cap, boardFields, state, toggle      | packages/items/src/field-widgets.test.ts                       |
| Each shape's summary, caching, fills, number text               | packages/plan-art/src/field-widget-stats.test.ts               |
| A full board (ITEMS_MAX) × 10 fields within the CPU budget      | packages/plan-art/src/field-widget-stats.perf.test.ts          |
| For You scores, reasons, cap, empty board, plural names         | packages/plan-art/src/widget-suggestions.test.ts               |
| Pressing a value: chips, roles, toggling, cap, 500-card cost    | FieldWidgetView.test.tsx, packages/items card-search.test.ts   |
| Every value: the "+n" popover, its rows, staying open, phone    | FieldWidgetView.test.tsx                                       |
| Each view's pill, gone states, Remove by role                   | apps/editor/components/plan/widgets/FieldWidgetView.test.tsx   |
| Gallery sections, rail, On Board, cap, search, keys, empty      | apps/editor/components/plan/widgets/BoardWidgetPicker.test.tsx |
| labelOf, fields kept, Calculated reader, lazy previews          | apps/editor/components/plan/widgets/use-field-widgets.test.tsx |

## Constants and configuration

| Constant                  | Value | Where                      | Safe range    |
| ------------------------- | ----- | -------------------------- | ------------- |
| `REORDER_THRESHOLD_PX`    | 4     | BoardWidgetZone.tsx        | 2..10         |
| `ZONE_GAP_PX`             | 6     | zone-overflow.ts (gap-1.5) | 6 (the class) |
| `MORE_LABEL_MAX_PX`       | 120   | zone-overflow.ts           | 80..180       |
| `MORE_DOT_PX`             | 12    | zone-overflow.ts           | 8..16         |
| `COMPACT_FILTER_PANEL_PX` | 380   | CompactBoardFilter.tsx     | 320..480      |
| `MORE_PANEL_MIN_PX`       | 200   | ZoneMore.tsx               | 160..240      |
| `MORE_PANEL_MAX_PX`       | 420   | ZoneMore.tsx               | 320..520      |
| `PEOPLE_SHOWN`            | 5     | board-widget-parts.tsx     | 3..8          |
| `TYPES_SHOWN`             | 3     | board-widget-parts.tsx     | 3..8          |
| `DUE_SOON_DAYS`           | 7     | widget-stats.ts            | 1..30         |
| `FIELD_WIDGETS_MAX`       | 12    | field-widgets.ts           | 6..20         |
| `SPREAD_BINS`             | 8     | field-widget-stats.ts      | 5..12         |
| `TIMELINE_WEEKS`          | 4     | field-widget-stats.ts      | 2..8          |
| `SUGGESTIONS_MAX`         | 6     | widget-suggestions.ts      | 4..8          |
| `FILTER_SUGGEST_CARDS`    | 20    | widget-suggestions.ts      | 10..50        |
| `BREAKDOWN_NAMED`         | 2     | FieldWidgetView.tsx        | 1..3          |
| `GALLERY_WIDTH`           | 720   | gallery/GalleryFrame.tsx   | 600..800      |
| `SEEN_MARGIN`             | 160px | use-seen.ts                | 0..400px      |

## Defaults ledger

See DEFAULTS.md D17 to D19, and D74 to D79 for field widgets and the gallery.

## The board's filter (board-widgets.md "The board's filter")

- **Naming**: `BoardFilter` (`board-filter.ts`, packages/items): a `SavedBoardFilter` without its id and name (`text?`,
  `mine?: true`, `filters?`, `person?`, `type?`, `priority?`, `due?: 'overdue' | 'soon'`), kept as
  `PlanBoardSetup.filter?: BoardFilter`. The editor's `QuickFilter` is it resolved for this viewer and today.
- **Pure helpers** (`board-filter.ts`): `isBoardFilter(v)` (the same field checks as a saved filter's,
  `savedFilterFieldsValid`: words up to `SAVED_FILTER_TEXT_MAX` 200, at most `CARD_SEARCH_FILTERS_MAX` 8 chips);
  `readBoardFilter(v)` (normaliseBoardSetup keeps a valid one that narrows, else drops it); `boardFilterFrom(quick)`
  (the words kept as typed, so a trailing space survives the round trip, cut to 200; Only Mine as a flag; a due window
  as `overdue`/`soon`; undefined when nothing narrows); `resolveBoardFilter(filter, opts)` (as `resolveSavedFilter`);
  `boardFilterKey(filter)` (a comparable string).
- **Contracts**: `validate-shape.ts`' `planBoard` rule refuses a `filter` that `isBoardFilter` rejects;
  `plan-board-patch.ts` SETUP_KEYS gains `filter` (it travels whole); the participant content rule
  (`participant-content.ts`, `PARTICIPANT_BOARD_FIELDS = ['filter']`) takes `planBoard.filter` from a Participant's
  update of a `plan-board` and keeps every other set-up field as stored, so a Participant's board change can only move
  the filter (refused `invalid` when the result fails validation); a Viewer's ops never pass `room-op-gate.ts`.
  `field-filter-removal.ts` `boardWithoutFieldFilters` strips the field's clauses from `filter` too (an emptied filter
  goes).
- **Write**: `usePlanElementWrites.setBoardFilter(boardId, filter | undefined)` (on `PlanContext`) sets or clears only
  `planBoard.filter` on the stored set-up as it is (never the normalised copy), so a Participant's commit passes
  `participantTabChange` untouched.
- **State** (`components/plan/useBoardFilter.ts`): `useBoardFilter({ stored, mine, today, finished, canChange,
write })` answers `{ quick, setQuick, showAll }`: `quick` is the stored filter resolved (memoised on its key, the viewer, the
  day and the done statuses) or, while typing waits, the local draft. `setQuick(q)` does nothing without `canChange`;
  a change of the words alone waits `BOARD_FILTER_TYPING_MS` (400) after the last key, anything else writes at once
  (flushing waiting words first); unmounting flushes. `showAll()` clears the filter at once (no typing pause). `PlanBoardView` passes `canChange = interactive &&
canEditCards`, `write = plan.setBoardFilter(element.id, ·)`.
- **Read-only** (a Viewer): `WidgetContext.canFilter` and `FilterPress.canFilter` false disable every narrowing press
  (Only Mine, People, Unassigned, Card Types, Due Soon, Priorities, field values, saved filter chips) and hide Show all;
  `BoardFilterField` passes `readOnly` to `FilterSearchBox` (workbench), which makes the words `readOnly`, drops the
  chips' crosses and Clear, and the field draws no Add Filter.
- **Taking a widget off**: `PlanBoardHeader` hands the trimmed filter with the widgets (`onWidgets(next, kept)`), one
  set-up write, so the second write never puts back the filter the first cleared.
- **Phone and slot**: `shownQuick` still applies none there.
- **Hides every card** (board-widgets.md "When the filter hides every card"): `usePlanBoardProjection` answers
  `hidesAll` (a filter narrows, the projection holds cards, and no column or lane shows one); `PlanBoardView` sets
  `filterHidesAll` off a phone, a slot and loading; `PlanBoardGrid` draws `FilterEmptyHint` in the first open column's
  first open lane, before its Add Card row, with `onShowAll = showAll` only when `canFilter`. Built on
  `CompactEmptyState` and `noMatchTitle` with the board palette as its ink.
- **Testing**: `board-filter.test.ts` (checks, read, from, resolve, key), `participant-content.board-filter.test.ts`
  (a Participant's filter lands, other set-up fields stay, a bad filter is refused), `validate-shape` and
  `plan-board-patch` cases, `useBoardFilter.test.tsx` (two clients over one store converge, a remount restores, typing
  debounced and flushed on unmount, Show All at once, a Viewer cannot change it), widget role tests (Viewer disabled,
  Participant presses), `PlanBoardView.filter-empty.test.tsx` (the hint for an Editor and a Participant with Show
  All, a Viewer without it, per viewer, one card, never on an empty board, a phone or a slot),
  `PlanBoardView.filter.perf.test.tsx` (`ITEMS_MAX` cards: one projection, no widget recount, within the CPU budget),
  `useDrawnSetup.test.ts`, `kept-stat.test.ts`.

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
- **Roles**: `canEdit` (an Editor's set-up) shows Save Filter and each chip's chevron; `canFilter` (an Editor or a
  Participant) applies; a Viewer's chips are disabled.
- **Errors**: a name taken says "A saved filter already has this name."; an empty name keeps Save disabled; at 8,
  Save Filter hides; a filter whose field or value is gone matches nothing.
- **Telemetry**: `Plan` · `Used` / `Added` / `Renamed` / `Changed` / `Removed` · `SavedFilter`.
- **Testing**: `saved-filters.test.ts` (validation bounds, read, from and resolve, Only Mine for another viewer, the
  window counted from today with the clock pinned, list edits), `board.test.ts` (chips narrow a projection, on an
  Archive board), `plan-board-patch.test.ts` (the key travels), validate-shape's test (refusals),
  `BoardFilterField.test.tsx` (chips, Add Filter, Backspace, Clear), `SavedFilterChips.test.tsx` (apply, press again,
  save, rename, update, delete, name taken, the cap; Editor sees the controls, Participant and Viewer apply only).
