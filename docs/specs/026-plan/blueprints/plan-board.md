# Plan board blueprint

Derived from [Plan board](../plan-board.md). Contract for the `plan-board` and `plan-card` shape kinds and their
editor views.

## Domain and naming

| Spec term    | Identifier                                                                        |
| ------------ | --------------------------------------------------------------------------------- |
| Plan board   | `ShapeKind` `'plan-board'`; set-up field `ShapeElement.planBoard: PlanBoardSetup` |
| Plan card    | `ShapeKind` `'plan-card'`; field `ShapeElement.planCard: { itemId: string }`      |
| board set-up | `PlanBoardSetup` (`@livediagram/items` `board.ts`)                                |
| column       | `PlanColumn`                                                                      |
| swimlane     | `SwimlaneBy` (+ `swimlaneField` for `'field'`) + projected `lanes`, `swimlanes`   |
| lane field   | `LaneField` (`laneFieldsOf`, `laneFieldOf`); a drop's patch is `laneDropPatch`    |
| WIP limit    | `PlanColumn.wipLimit`                                                             |
| unplaced     | projection `unplaced`                                                             |
| quick filter | `QuickFilter` (per person, React state, never stored)                             |
| face-down    | `cardIsFaceDown(item, setup, viewerId)`                                           |
| board preset | `PLAN_BOARD_PRESETS` (`@livediagram/items` `presets.ts`), id `PlanBoardPresetId`  |

## Element model (`packages/document`)

- `shape-kind.ts`: add `'plan-board'`, `'plan-card'` (62 → 64; `shape-kind.test.ts` count, canvas-and-palette prose).
- `element-types.ts` `ShapeElement`: `planBoard?: PlanBoardSetup`, `planCard?: { itemId: string }`.
- `element-fields.ts`: both fields listed.
- `shape-factory.ts`: `SHAPE_DEFAULT_SIZE` board 1120×640, card 240×120; `createShape('plan-board')` seeds the
  `blank` preset set-up; `createShape('plan-card')` seeds `planCard: { itemId: '' }` (the caller sets it).
- `validate-shape.ts`: `planBoard` checked by `validateBoardSetup` (items package: 1..12 columns, unique ids and
  statuses, names ≤ 40, wip 1..99, cardFields known, `cardSize` minimal or compact (absent is detailed), budget
  1..99); `planCard.itemId` by `ITEM_ID_PATTERN` or empty.
- Predicates: `isSelfDrawingShape` (both), `SELF_PAINTING_SHAPES` (both: board paints its own surfaces; card its
  type colour), `isSvgRenderedShape` exclusion (both), `SHAPE_LABELS` ("Plan board", "Plan card"), not markers,
  not containers.
- `svg-render.ts`: `svgBoxed` branches to `svg-render-plan.ts`: `svgPlanBoard(el, items?)`,
  `svgPlanCard(el, items?)`. `SvgRenderOptions.items?: ReadonlyMap<string, Item>`. Without items, columns draw
  with names and empty bodies; a card draws "Item".
- `edit-operations` `SHAPE_KIND_FIELDS`: `plan-board` → `planBoard`, `plan-card` → `planCard`.
- `document-views` `content-summary` / `find`: board → title + column names; card → item id.

## Editor components (`apps/live/components/plan/`)

```
PlanContext.tsx          context: items, types, item types slice, status, self, people, planInput, canEdit,
                         canVote, presence, actions
PlanBoardView.tsx        board body (ShapeContentRouter branch): projection, themed palette, radius and font,
                         columns and rows grid, cards, keyboard, Add card per cell, the card menu
edge-auto-scroll.ts      (hooks/plan) `edgeScrollStep` (quadratic ramp in the edge zone, constant under reduced
                         motion) and `clampScrollStep`; `useEdgeAutoScroll(bodyRef, (maximised || filled) && (drag ||
                         incoming))` follows window pointermove and steps `scrollLeft` once a frame while in a zone
plan-board-columns.ts    the board's column tracks: `minmax(220px·w, w fr)` on the canvas; maximised or filled,
                         `minmax(max(floor, calc((100cqw − 48px) / 5 · w + (w − 1)·12px)), w fr)` in an `@container` body
fill-tab.ts              Fill Tab's pure parts (which board or Sheet fills the tab, what turning it on deletes,
                         the copy)
FocusElementButton.tsx   Focus in a board's or Sheet's header (Focus, below)
SetupFillTabOption.tsx   Setup Board's Fill Tab switch row and its deletion warning (in SetupLayoutStep)
SetupLayoutStep.tsx      Setup Board's step 3, Layout: SwimlaneOptions and CardSizeOptions (shared with the menu,
                         plan-menu-parts.tsx), then SetupFillTabOption; state is a `SetupLayout` (setup-board.ts
                         `setupLayoutOf` / `withSetupLayout`), started from the board so skipping keeps it
OptionRows.tsx           Plan's option list (spec "Option lists"): `kind` single (radiogroup/radio, a tick), multiple
                         (group/checkbox, a box) or action (buttons); `useMenuKind() === 'command'` makes rows
                         menuitemradio/checkbox/menuitem at tabIndex −1; else roving tabindex (the chosen or first
                         enabled row), ArrowUp/Down/Home/End; optional `palette` (board colours); `ariaLabel` per row
SetupStepper.tsx         the wizard stepper: circles joined by lines (`@container`, names under the circles below
                         `@md`), `aria-current="step"`, done steps are buttons "{Step}, done: go back"
PlanColumnHeader.tsx     a column's head: colour bar, name, count, and the cog (PlanColumnPopover)
AddColumnPicker.tsx      the column picker, used by the popover's + Add Column After: one field (TextInput compact, "New
                         column name", autoFocus) and Add Column. With existing statuses the field is a combobox
                         (role=combobox, aria-controls the listbox, aria-activedescendant the highlighted row,
                         aria-autocomplete=list); `narrowStatuses` filters rows by statusKey substring; ArrowDown
                         clamps at the last row, ArrowUp past the first returns to -1 (no highlight); Enter adds the
                         highlighted row, else the typed name (matchStatus). Typing resets the highlight
ExistingStatusList.tsx   the picker's Existing Statuses: heading + count, Add All (two or more, field blank), a
                         role=listbox `ul` (max-h-56, scrolls, the highlighted row kept in view) of role=option rows
                         (`data-status`; swatch, name, `usedOn`, `cardCount` pill); a row's mousedown is prevented so
                         the field keeps focus, mousemove highlights, click adds; colour transitions off under
                         motion-reduce. Without rows: "No existing status matches "{text}"."
AddColumnPickerPopover.tsx the picker hung from + Add Column After (304px wide): a portal at z-popover (`data-add-column-picker`), placed by
                         @livediagram/ui `placeHint` with order right, left, bottom, top (8px gap, 8px margin) and an
                         arrow at its `arrowOffset`; its own capture Escape and outside press close it and refocus the
                         button. PlanColumnPopover's Escape is disabled while it is open, and its outside press treats
                         `[data-add-column-picker]` as inside
                         (column-status-picks.ts: matchStatus, addStatusColumn, addStatusColumns, columnRename; it
                         re-exports statusKey, missingStatuses, pickableStatuses from packages/items)
PlanColumnPopover.tsx    a column's settings popover; while the picker is open it works out `missingBoardStatuses`
                         (setup, pickableStatuses(names, items, types), { items, types, boards: statusBoards }),
                         memoised on those, nothing while closed. A row or a matched name adds with part
                         `ColumnAddedExisting` (Add All too), a new name with `ColumnAdded`; + Add Column After asks the new column's head to open its own
                         (column-settings-request.ts, a one-shot module request read on the head's mount) and
                         closes, and the new popover selects its name (`selectName`)
board-setup-edits.ts     the set-up's edits as pure functions (rename, recolour, WIP, done, move, add, remove)
track-board-setup.ts     Plan · Changed · <part>
PlanBoardCells.tsx       a row's band, one card in a cell (right-click → onMenu), and the drag ghost
PlanBoardHeader.tsx      title, count, progress, unplaced chip and its tray, votes left, quick filter, Only
                         mine, Reveal; a double-click on the title or its own empty space (not a widget or
                         button) renames when `canRename` (`canEdit && planInput`), stopping the event
BoardTitle.tsx           the title, or while renaming an input (`BOARD_TITLE_MAX` 80, selected on open);
                         Enter or blur saves the trimmed non-empty name through onSetup(..., 'Title'),
                         Escape cancels, a `closed` ref keeps the trailing blur from saving a cancel
AddCardButton.tsx        a cell's + Add card; opens AddCardPopover (or when the N key asks)
AddCardPopover.tsx       Add a Card: the board's types as MenuTiles in the shared PortalMenu (BottomSheet on a phone)
PlanCardMenu.tsx         a card's right-click menu on the shared ContextMenu (Open, Duplicate, Move to, Delete) and PlanCardMenuHost
PlanCardFace.tsx         a card face (custom fields as chips where Display places them; its gathered votes read-only)
PlanCardView.tsx         the plan-card element body (themed; a lone card's fill is its face); "Item not found"
PlanModal.tsx            the Plan forms' modal (through Dialog) and SheetRow; fields are the shared TextInput/TextArea `compact`
plan-board-moves.ts      the move a drop makes (boardMoveFor)
PlanSheetsHost.tsx       renders the open item panel or type editor
../palette/PlanBoardMenuSection.tsx  the board's element-menu Board (title, swimlanes) and Cards (fields) flyouts
ItemPanel.tsx            item panel: Dialog size 3xl (60rem), header (type, key, labelled Help, ItemPanelMenu ⋯ of Duplicate / Archive / Delete, close), main column
                         (title, tabs from tabsOf, the tab's fields), Details aside (w-80: detailFieldsOf rows,
                         then made/changed); phone: one column, a Details tab first, sheet 85dvh
ItemPanelLayout.tsx      the panel's shell pieces: ItemTypeBand (h-1, ACCENT_BG + accentVars of the type colour),
                         ItemPanelSection (13px semibold heading, mb-8), ItemDetailsRow (grid 6.5rem/1fr, min-h-9,
                         rounded hover), ItemMeta (11px slate-400 created/edited lines); the aside is m-3 rounded-xl
                         bg-slate-50 ring-1; title 22px semibold tracking-tight
ItemFieldEditor.tsx      one field's editor by kind (FIELD_LABELS, fieldLabel, labelsItsControl)
LinkedCards.tsx          LinkedCardGroup (a Linked as {Field} section) and FilteredCards rows (glyph, #key, title,
                         status, Archived chip)
ItemTrailCrumbs.tsx      the breadcrumb of earlier cards (visibleTrail, folded "…"): in the header on a wide screen,
                         a row above it on a phone (a back chevron, no trailing separator)
item-trail.ts            pure: stepTrail / liveTrail / visibleTrail / childrenOf, ItemOpenVia, ITEM_TRAIL_MAX, ITEM_TRAIL_SHOWN*
ItemDescription.tsx      the description: NoteRichTextEditor (note=false), saved DESCRIPTION_SAVE_MS (800 ms) after
                         typing, on blur and on close as one patch of description + descriptionRich
item-field-editors.tsx   editors for text (debounced), person, priority, labels, number, date, checklist
plan-board-keys.ts       the board's keyboard as a pure function of the projection
plan-palette.ts          re-exports planPalette from @livediagram/document (shared with the SVG export) and
                         planOwnColours(element)
MaximisedPlanLayer.tsx  MaximisableSlot (a board's or view's body through a portal into its own host element,
                         moved between the canvas slot and the overlay), the overlay (portal to document.body,
                         fixed inset-0, z-40, the FLIP open/close), the lifetime hook and the header button
plan-type-glyph.tsx      a type's glyph from the Plan glyph set
plan-tile-art.tsx        a picture per board preset, and the card tile glyph
```

Hooks (`apps/live/hooks/plan/`): `usePlanItems` (store), `usePlanSlice` (composed into `useEditorState`; provides
the `PlanContext` value, the open item and set-up, and `dropPlanCardOnBoard`), `usePlanBoardDrop` (the board's drag and
drop, and the board as a target for cards from other boards through `plan-board-targets.ts`, a registry of the
boards on screen by element id), `usePlanCardDrag` (pointer drag
within, between and out of boards; the drop slot is read from `data-plan-status` / `data-plan-lane` / `data-plan-card`
under the pointer), `usePlanPresence` (the `plan-presence` op), `useItemUndo` (the undo journal), and
`plan-card-drop.ts` (a palette card into the column under the pointer). `maximised-plan.ts` is the maximised board or view, a module store
(`{ id, kind: 'Board' | 'View' } | null`, `maximisePlanElement` / `restorePlanElement` / `releasePlanElement` /
`useMaximisedPlanId`; `kind` names the telemetry), drawn in the canvas area (no zen chrome; the editor's chrome stays). `PlanProvider` wraps the editor view, so the export dialog reads
the items too.

## Card sizes

- `CARD_SIZE_FIELDS`: minimal `[]`; compact key, type, assignee, priority, due, votes; detailed every field.
  `cardFieldsAt(size, fields)` is what a face draws. `CARD_FIELDS` adds `description` (two lines); Parent is a custom
  card field (`CustomCardField` admits `parent`), placed by the type's Display (Task: detailed `body`). The Cards flyout dims a field tile outside the size's set (`disabled`), its setting kept.
- `PlanCardFace` lays out the parts in `plan-card-parts.tsx`: frame `rounded-xl` with a hairline border, rest shadow
  `0 1px 2px / 0 1px 3px` slate at 6 % / 4 %, hover `shadow-md` and `-translate-y-px` (150 ms; none under reduced
  motion); no stripe: the type colour fills `KeyTag` (the #key, text white or `#18181b`, whichever
  `contrastRatio` favours: `keyTextOn`), and Minimal draws `TypeDot` before the title. Minimal: title 13 px semibold, two lines.
  Compact: `TypeChip` (glyph only) beside a two-line title, over an 11 px row (#key, `PrioritySignal`,
  `StartPill`, `DuePill`, votes, `CommentsPill`, avatar right). Detailed: header (`TypeChip`, `KeyTag`, `ColourDot` when the item has its own colour,
  `PrioritySignal` with its name at the end), title 14 px three lines, parent, description two lines, custom
  fields as a name/value grid, `LabelChips` (≤ 4, `labelColour` tints, "+n"), then a footer of `MetaPill`s
  (start, due, estimate, `ChecklistPill`, comments, votes) with the avatar at the end. `DuePill`: `LATE_COLOUR`
  when past and not done, `SOON_COLOUR` within `DUE_SOON_DAYS` (2), else quiet. Pills tint their tone at 14 %
  (`tint`, `color-mix`).

## Behaviour and state

- **Input routing**: `PlanBoardView` receives `interactive = editorMode === 'plan' && !readOnly`. Interactive:
  card pointerdown stops propagation and starts `usePlanCardDrag`; header/border do not stop propagation (the
  generic box drag moves the board). Not interactive: nothing stops propagation; double-click on a card opens it.
- **Card drag states**: `idle → pressed` (pointerdown) `→ dragging` (`isDragTravel`, moved ≥ `PRESS_DRAG_SLOP_PX`) `→ dropped |
cancelled` (Escape, pointercancel). `pressed → idle` on pointerup without moving = open the item.
  - While dragging: a floating copy follows the pointer (screen space, transform only), a placeholder of the
    card's height marks the drop slot: column under the pointer, lane under the pointer, slot by the midpoint of
    the cards under it.
  - Drop inside the board: `moveItem(id, { status, after|before, set: laneField })`, pushed to undo.
  - Drop outside the board's rect: `onCardOut(itemId, canvasPoint)` adds a `plan-card` element there (one
    commit), item unchanged.
- **Plan card onto a board**: in `useEditorDrag`'s drag end, a moved `plan-card` released over a board cell
  (`data-plan-status` under the pointer) → `onPlanCardDroppedOnBoard(card, status)`: the item moves to the end of
  that column and the card element is removed (two undo steps: the removal, then the move).
- **Card types a board shows**: `boardAddTypes(setup, types)` (`packages/items/src/board.ts`) is what Add Card
  offers and what the Cards menu's Card Types shows pressed: `setup.addTypes` filtered to the catalogue, in its
  order, or every type when it is unset or names none still in the catalogue. `boardTakesType(setup, types, id)`
  is the same rule for one type, and `boardShowsType(setup, type, types?)` applies it (or, without a catalogue,
  plain membership) to a palette card's drop and a card dragged from another board. `projectBoard` resolves the
  shown set once per projection, not per card. Deleting a type never rewrites a board's `addTypes`; the next Card
  Types change stores only current ids.
- **Item panel**: `openItemId` in `usePlanSlice`; opening broadcasts presence `viewing`; edits debounce 400 ms
  per field (`ITEM_EDIT_DEBOUNCE_MS`), flushed on close; each flush is one undo step.
- **Card trail**: `itemTrail: string[]` in `usePlanSlice`, beside `openItemId`. `openItem(id)` resets it to
  `[id]`; `openItem(id, via)` with `via: ItemOpenVia` (`'Parent' | 'ChildCard' | 'Breadcrumb'`) applies
  `stepTrail(trail, id)`: an id already in the trail cuts the trail back to it, otherwise it is appended and the
  oldest dropped past `ITEM_TRAIL_MAX`. The host filters the trail to ids still in `items` and not trashed before
  drawing it (`liveTrail`), and a trail not ending on the open card (`showItem`, the tour) draws as that card
  alone; closing the panel leaves the trail stale until the next `openItem` resets it.
- **Panel identity**: `ItemPanel` holds the `Dialog` and renders `ItemPanelContent key={item.id}`, so moving
  between cards keeps the Dialog mounted (no entrance animation again) while each card's tab and clock reset.
- **Linked cards**: `linkedCardsOf(open, items, types)` (card-links.ts), computed in `PlanSheetsHost` for the open
  item only (one pass over the document's items); a Project's Linked as Parent is one of its groups.
- **Maximised board**: `maximised-plan.ts` holds `{ id, kind } | null` (a visualisation maximises through it too,
  `PlanViewView` putting `MaximisePlanButton kind="View"` in every view header through `ViewHeaderEnd`), never synced, saved or journalled.
  `PlanBoardView` with `interactive` shows the header's Maximise Board button; pressed, `maximisePlanElement(id)` and
  `Plan · Toggled · BoardMaximised`. The board always renders inside `MaximisableSlot`: its body goes
  through `createPortal` into one host `div` the slot owns (made once), and only that host moves (`appendChild`):
  into the slot on the canvas, or into `MaximisedPlanLayer`'s box while maximised. The React tree never changes
  shape, so nothing remounts; `PlanContext` and the canvas surface still reach the body. While maximised the slot
  stops the body's pointer, double-click, context-menu and wheel events (they reach it through the portal) and draws
  an empty placeholder of the board's surface. The layer reports its box's untransformed size (`offsetWidth` /
  `offsetHeight`, a `ResizeObserver`) through `onMaximisedSize`, which `PlanViewView` lays a view out at. Restore
  Board, or Escape (a capture-phase `window` listener, so it runs before the editor's deselect, then
  `preventDefault` + `stopPropagation`) with no `[aria-modal="true"]` open, calls `restorePlanElement()` and
  `Plan · Toggled · BoardRestored`. The board unmounting (tab switch, deletion,
  culling) or `interactive` turning false (leaving Plan mode, losing edit input) restores without telemetry.
  The layer is a portal into the slot's closest `[data-canvas-a11y-root]` (the canvas `main`, found by a hidden
  marker's ref, `useCanvasRoot`), `absolute` at `CANVAS_LAYER_Z` (`--z-panel` − 1), its `top/right/bottom/left` from
  `useCanvasLayerInsets(canvas)` (hooks/ui): `apps/live/lib/canvas-layer-insets.ts` reads `[data-toolbar-menu]` (top row),
  `topStripInset` (the Toolbar strip), `[data-layout-chrome]` (MovablePanel `layoutChrome`: the Explorer only, so a passing panel such as the Trash never moves the board; a side by its nearer edge, a sheet
  wider than `WIDE_PANEL_SHARE` of the canvas as top or bottom by its middle); the bottom-right controls are not measured (they float over the board at their own z),
  capped at `MAX_INSET_SHARE` per axis. Measured in one `requestAnimationFrame` after mount and after a
  `ResizeObserver` change (the canvas and each piece of chrome), a chrome element's `style`/`class` change, a
  `transitionend` on chrome, a window `resize`, or a child-list change under the canvas that adds or removes chrome
  (`touchesChrome`; the set is re-observed only when it differs; the strip's children are observed too, as its card
  changes width with the category). No key or press listener.
  The hook returns `CanvasLayout = { insets, band }`. `headerBand(canvas, insets, menu, strip)` (the strip measured as
  the union of `[data-toolbar-palette]`'s children, its root running the canvas width) returns `HeaderBand { height,
left, mid }` in px from the element's box (inside the cover's `COVER_PAD_PX` 12) when the menu and strip are in the
  top half, the canvas is at least `BAND_CANVAS_MIN_PX` 640 wide, the menu ends before the strip, and there are at least
  `BAND_MID_MIN_PX` 140 between them (less `BAND_GAP_PX` 12 each side) and `BAND_RIGHT_MIN_PX` 280 after the strip; the
  insets' top is then 0. `CanvasCover` marks its inner box `data-header-band` and sets `--plan-band-h`, `--plan-band-left`
  and `--plan-band-mid` (`bandVars`). `PlanBoardHeader`, `SheetHeader` and the views' `ViewFrame` read them with their
  own sizes as fallbacks: `h-[var(--plan-band-h,52px)]` (40 px a Sheet's, 2.5rem a view's),
  `pl-[var(--plan-band-left,…)]`, and `max-w-[var(--plan-band-mid,none)]` on the title (and widgets, count) group, the
  trailing controls `ml-auto`; `SheetFindBar` sits at `calc(var(--plan-band-h, 40px) + 6px)`.
  `ViewZoomControls` passes `zoomOff={useCanvasCovered()}`: `ZoomControls` disables Zoom out, Zoom in and Fit, and
  `ZoomMenu` (`offReason`) shows the level disabled with no presets, each hover card reading `ZOOM_OFF_REASON`. Header, tab bar and footer are outside `main`. `zenMode` is not
  touched. The layer is a `CanvasCover` (`data-canvas-cover`, `absolute inset-0` at `CANVAS_LAYER_Z`, `background: inherit`
  from the canvas `main` so it paints the canvas's colour and pattern, stopping
  pointerdown, double-click, context-menu and wheel) holding the element at its insets; `useCanvasSurfaceGestures`'
  capture handler bails for a target inside `[data-canvas-cover]`, and `useEditorKeyboardShortcuts`, while `canvasCovered()`,
  sorts each key by `coveredKeyRole` (run: undo/redo/search/zen/mode/Escape; swallow: Cmd+D/A/Shift+L, z-order, zoom,
  prevented; ignore: the rest) instead of returning early (`getMaximisedPlanId() !== null || fillTabId !== null`, read at the key press). `useCanvasSelectionView` passes `canvasCovered` from `useCanvasCovered()` (`useMaximisedPlanId() !== null ||
fillTabId`; `ViewMinimap` returns null while it is true, hiding the Map; `usePaletteCatalogue`, while `useBoardCovering()`, swaps its categories for
  `coveredPaletteCategories()` (Plan's `plan-cards` alone), and `ToolbarPalette` shows the first offered
  category while the chosen one is not offered, keeping the choice) to `deriveCanvasSelection`, which then shows no popover, plus or multi-selection toolbar.
- **Fill Tab** (`setup.fillTab: true`, normalised exactly-true by `normaliseBoardSetup`, carried by
  `planBoardPatch` as a set-up key): `fill-tab.ts` (pure) gives `fillTabElementOf(elements)` (`{ id, kind: FillTabKind }`
  or null: the first board whose raw `planBoard.fillTab === true`, or Sheet whose `planSheet.fillTab === true`, in
  element order; [Sheet element blueprint](../../029-sheets/blueprints/sheet-element.md#fill-tab)),
  `fillTabSheetElements(elements, id)` / `unfillSheetElements(elements, id)` (a Sheet's Fill Tab on, the rest gone /
  off), `fillTabOthers(elements, id)` (`{ count, locked }`),
  `fillTabElements(elements, id, update)` (the board alone, its set-up `update`d from the one it holds at the commit,
  Fill Tab on), `withFillTab(setup, on)` and the copy (`fillTabWarning`, `fillTabConfirm`).
- **The Plan cover** (`apps/live/hooks/plan/plan-cover-store.ts`, a module store like `maximised-plan.ts`): `{ fillTabId, fillTabKind,
tabElementCount }`, published before paint by `usePlanCoverWiring` (called once from `useEditorState`: it memoises
  `fillTabElementOf(activeTab.elements)`, and returns `canvasCovered` for the keyboard and `readTabElements` for the
  Plan slice). Readers subscribe with selectors, so they re-render only when their answer changes: `useCanvasCovered`
  (maximised or filled: selection chrome, the Map), `useBoardCovering` (a maximised board, not a view, or a filling board: the
  palette), `useFillsTab(id)` (a board or Sheet), `useTabElementCount` (Setup Board's warning only). `isCanvasCovered()` is the
  one covered check, read at a key press too. Neither value is on `PlanContext`, so adding or moving an element never
  changes the context (guarded by `plan-cover-store.test.tsx`: 40 element adds, 0 re-renders).
- **Fill Tab's actions** on `PlanContext` (`usePlanFillTab`, stable callbacks): `tabOthers(id)` (read at a press) and
  `fillTab(id, update)` (one `commit`, so one undo step); `fillTabSheet(sheetElementId, on)` likewise for a Sheet. `PlanBoardView` calls `useBoardMaximised(id, interactive)`:
  `filled` from `useFillsTab(id)`; a store maximise on it is released (`releasePlanElement`, no telemetry) and the
  lifetime hook (Escape) runs only for a store maximise. A filled board hides `MaximisePlanButton` and passes `fill` to
  `MaximisableSlot`, which moves the host into `FilledTabLayer` (the same `CanvasCover` as the maximised layer, at the
  same insets, no grow animation). In any mode (`interactive` only decides what the board itself allows). The menu's
  `PlanFillTabSetting` (Board Setup section, after the title group) offers On Canvas / Fill Tab rows; on: `tabOthers`
  → the menu closes → `useConfirm(fillTabConfirm)` when `count > 0` → `trackFillTab(true)` → `fillTab(id, (current) =>
withFillTab(current, true))`; off: `trackFillTab(false)` → `updateBoard`. The wizard's `SetupFillTabOption` (end of
  the Layout step, `SwitchRow`, a `role="alert"` notice when on and the tab holds others: `useTabElementCount()` − 1)
  feeds `onSetUp(columns, typeIds, layout)`; `PlanBoardView` writes `withSetupLayout(setUpBoard(current, …), layout)`
  through `fillTab` when Fill Tab turns on (from the board at that commit), else `updateBoard`.
- **Reveal**: sets `planBoard.hideWriting = false` (element commit).
- **Set-up edits**: element commits via `updateElement`; removing a column with items opens a choice "Move
  N items to …" (another column) before the commit, the moves pushed with it.
- **Face-down**: `setup.hideWriting && item.createdBy.id !== viewerId` → face shows the author's colour and
  "Hidden until reveal".
- **Presence**: room presence op `plan-presence` `{ tabId, itemId | null, state: 'drag' | 'view' }`, sent on a
  change of what is held (drag start and end, the item panel opening or closing), never stored; peers render a
  ring and first name on that card, a drag outranking a read.

- **Focus** ([spec](../plan-board.md#focus)): `FocusElementButton` (`bounds`, `kind: 'Board' | 'Sheet'`, palette;
  "Focus Board" / "Focus Sheet", a scan-eye glyph with the shared Tooltip) sits left of Maximise; not drawn while
  maximised or filled, or outside an editor's canvas (`useCanvasFocus()` is null). Pressed it sends `Plan · Toggled ·
BoardFocused | SheetFocused` and calls the canvas's Focus: `focusBounds` in `useEditorState` →
  `focusOn(bounds, FOCUS_ZOOM_MAX)` (`hooks/canvas/useEditorViewport.ts`), handed down by `CanvasFocusProvider`
  (`hooks/canvas/useCanvasFocus.tsx`, in `EditorView`). `focusOn` fits the element with the fit-to-screen margin;
  when the view already fits it (zoom within 0.01, offset within 2 px) it fits every boxed element on the tab instead.
  `glideTo(zoom, offset)` eases the offset linearly and the zoom geometrically (cubic in-out) over `FIT_GLIDE_MS`, at
  once under reduced motion; each frame checks the view is still what it last set, so anything else moving it (a
  wheel, a pinch, a pan, another fit) stops the glide where it is. `fitToBounds` and unmount stop it too.
- **Focus on add**: `useFocusNewPlanElement({ tabId, elements, selectedId, focus })` (`hooks/plan`, called from
  `useEditorState`) focuses a board, view or Sheet that appears on the same tab and is this person's selection (their
  own add); a tab switch, a peer's add or an undo (not selected) do not. `isFocusedOnAdd(el)` makes the phone's
  scroll-into-view of a new element (`useEditorViewport`) skip those kinds: one glide, not two.

## Presentation and UX

- Board: rounded 12 px surface, header 52 px, columns min 220 px wide sharing the width, gap 12 px, column body
  scrolls (`overflow-y: auto`, wheel stops propagating only when it can scroll).
- Card face: 8 px radius, 4 px type stripe on the left, glyph + `#key` muted 12 px, title 14 px semibold up to
  3 lines (`line-clamp`), chips row (priority dot, labels, estimate, due, votes, checklist `3/5`), assignee
  avatar bottom right. Done column cards draw at 70% opacity.
- WIP over: count chip uses `--warning` tokens, column head text "Over WIP limit".
- Empty board: first column shows the open add field with "Add your first item".
- Copy: "Add card", "Add your first card", "Add a Card", "Or type a title and press Enter", "Open",
  "Duplicate", "Delete", "Card duplicated", "Card deleted", "Not on this board", "Move to", "Hidden until reveal", "Reveal", "Votes left: 3",
  "Item not found", "Remove card", "Only mine", "Column", "WIP Limit", "Counts as Done",
  "Move Left", "Move Right", "+ Add Column After", "Remove Column", "Move and Remove", "Keep It",
  "Linked as {Field}", "No cards link here as {Field} yet.", "Archived", "Card trail".
- Item panel: a modal through the shared `Dialog` (`size="lg"`, `phoneSheet`: a sheet from the bottom with a grab
  handle below `sm`), max height 44rem, header with type picker + key, title
  input, field rows in the type's order, description textarea, checklist, footer "Created by (disc) X" and "Edited by (disc) Y, 2m", the disc `PersonDisc`.

## Accessibility

- Board is a `region` named by its title; each column a `list` labelled "In Progress, 3 items, WIP limit 4";
  each card a `listitem` containing a `button` named "#12 Fix login, Bug, assigned to Sam, high priority".
- Keyboard per spec (`usePlanBoardKeyboard`); moves announced in a polite live region.
- Drag has the keyboard equivalent (Shift+arrows). Focus ring 2 px, contrast ≥ 3:1; text ≥ 4.5:1 on every
  type colour key fill (the #key text meets 4.5:1 on it).
- Reduced motion: no placeholder animation, no card lift shadow transition.
- Column picker: the field is a `combobox` (`aria-controls` the listbox, `aria-activedescendant` the highlighted
  `option`, `aria-expanded` while rows show); rows are `option`s with `aria-selected`; the list is labelled by its
  Existing Statuses heading; the match note is a `status` the field is described by. ArrowUp/ArrowDown, Enter,
  Escape (closes only the picker), Tab reaches Add Column then Add All.
- Breadcrumb: `nav aria-label="Card trail"` holding an `ol`; each crumb a `button` named "Back to #12 Website
  relaunch"; separators and the fold are `aria-hidden` except the fold's sr-only "3 earlier cards". Linked as: a
  `section` labelled by its heading, an `ul` of `button` rows named "Open #14 Write tests, In Progress".

## Web Experience

- Cards are DOM inside the element; boards render only when the element is in view (existing culling).
- Drag moves a transformed overlay; no layout per pointermove beyond the placeholder slot change (INP).
  `usePlanCardDrag` hit-tests once per animation frame on the latest move (the last unstepped move is stepped
  on pointerup), sets the board's drag state only when `samePlanDragTarget` says the slot, board, outside or
  Trash changed, and hands the pointer's place to `PlanDragGhost` through a small external store
  (`usePlanDragPointer`), so only the floating copy re-renders per frame. Measured on a 14-card board over a
  120-move drag: 250 ms of main-thread script before, about 103 ms after.
- Board size fixed by the element; column scroll never shifts layout (CLS 0).
- Column picker: `missingBoardStatuses` runs only while the picker is open, memoised on the setup, names, items,
  types and boards: one pass over the cards and one over the boards' columns, O(cards + columns). Measured at
  20,000 cards, 200 statuses and 50 boards (`board-status-picks.test.ts` keeps it under a 250 ms budget).

## Errors and edge cases

| Case                                      | Handling                                        |
| ----------------------------------------- | ----------------------------------------------- |
| Items not loaded yet                      | Columns draw with skeleton cards (3 per column) |
| Item store failed to load                 | Header shows "Couldn't load items" + Retry      |
| Drop on the same slot                     | No write                                        |
| Column statuses duplicated by an agent    | Validation rejects; normalise keeps the first   |
| Board narrower than columns × 220         | Columns scroll horizontally inside the board    |
| Picker: board already has every status    | Plain field, no list, as before                 |
| Picker: typed text matches no row         | "No existing status matches" line; Add Column   |
| Fill Tab: two boards set to fill          | The first in element order fills; others hidden |
| Fill Tab: element added while on          | Kept under the board, hidden; counted next time |
| Fill Tab: board deleted                   | `fillTabElementOf` is null; canvas is back      |
| Item moved by someone else during my drag | My drop still applies (last write wins)         |

## Observability

`[plan]` log fingerprints: `plan.drop.board`, `plan.drop.out`, `plan.card.onto-board`, `plan.setup.column-removed`,
`plan.items.load-failed`. Panel navigation sends `Plan · Opened · Parent | ChildCard | Breadcrumb`. Fill Tab sends
`Plan · Toggled · FillTabOn | FillTabOff` (`trackFillTab`, before the write); the column picker's `Plan · Changed ·
ColumnAdded | ColumnAddedExisting`.

## Testing

| Rule                                             | Test                                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Set-up edits                                     | `apps/live/components/plan/board-setup-edits.test.ts`                                                                                                   |
| Column picker statuses, counts, boards           | `packages/items/src/board-status-picks.test.ts`                                                                                                         |
| Fill Tab: which board, deletion, copy            | `apps/live/components/plan/fill-tab.test.ts`                                                                                                            |
| Fill Tab tiles, confirm, telemetry               | `apps/live/components/palette/PlanFillTabSetting.test.tsx`                                                                                              |
| Setup Board Layout step, stepper, Fill Tab       | `apps/live/components/plan/PlanSetupBoard.test.tsx`                                                                                                     |
| Layout read from and written to the board        | `apps/live/components/plan/setup-board.test.ts`                                                                                                         |
| Maximised/filled insets from the chrome          | `apps/live/lib/canvas-layer-insets.test.ts`, `apps/live/hooks/ui/useCanvasLayerInsets.test.ts`                                                          |
| The header band, and the cover's band variables  | `apps/live/lib/canvas-layer-insets.test.ts`, `apps/live/components/plan/MaximisedPlanLayer.test.tsx`                                                    |
| Zoom off while the canvas is covered             | `apps/live/components/chrome/ZoomControls.test.tsx`                                                                                                     |
| Five slots across a maximised board              | `apps/live/components/plan/plan-board-columns.test.ts`                                                                                                  |
| Option list roles, keys, menu items              | `apps/live/components/plan/OptionRows.test.tsx`                                                                                                         |
| Edge auto-scroll math and drag wiring            | `apps/live/hooks/plan/edge-auto-scroll.test.ts`                                                                                                         |
| Map hidden while covered                         | `apps/live/components/canvas/view-readers.minimap.test.tsx`                                                                                             |
| Cover store: re-renders only on a change         | `apps/live/hooks/plan/plan-cover-store.test.tsx`                                                                                                        |
| Palette offers only Cards, then restores         | `apps/live/components/palette/palette-layouts.test.ts`                                                                                                  |
| No selection chrome over a covered canvas        | `apps/live/lib/canvas-selection.test.ts`, `apps/live/hooks/canvas/useCanvasSelectionView.covered.test.ts`                                               |
| Nothing under a covered canvas moves             | `FilledTabLayer.test.tsx`, `apps/live/hooks/canvas/useEditorKeyboardShortcuts.dom.test.tsx`, `apps/live/hooks/canvas/useCanvasSurfaceGestures.test.tsx` |
| No Status swimlanes on a board (All Cards aside) | `board.test.ts`, `apps/live/components/palette/PlanBoardMenuSection.test.tsx`                                                                           |
| Filled layer, maximise released, no Escape       | `apps/live/components/plan/FilledTabLayer.test.tsx`                                                                                                     |
| Fill Tab normalised and patched                  | `board.test.ts`, `packages/document/src/plan-board-patch.test.ts`                                                                                       |
| Column picker combobox, rows, keys, Add All      | `apps/live/components/plan/AddColumnPicker.test.tsx`                                                                                                    |
| Picker adds an existing status's column          | `apps/live/components/plan/PlanColumnHeader.test.tsx`                                                                                                   |
| Factory, validation, size, labels                | `packages/document/src/plan-shapes.test.ts`                                                                                                             |
| SVG render with and without items                | `plan-shapes.test.ts`, `svg-render-coverage.test.ts`                                                                                                    |
| Projection: columns, rows, unplaced, filter      | `packages/items/src/board.test.ts`                                                                                                                      |
| Drop moves, between boards, refusals             | `apps/live/components/plan/plan-board-moves.test.ts`                                                                                                    |
| Keyboard moves and their announcement            | `apps/live/components/plan/plan-board-keys.test.ts`                                                                                                     |
| New card types, deleted-type fallback            | `packages/items/src/archive.test.ts`                                                                                                                    |
| Face-down and votes spent                        | `packages/items/src/board.test.ts`                                                                                                                      |
| A palette card lands only in a column            | `apps/live/hooks/plan/plan-card-drop.test.ts`                                                                                                           |
| Plan templates' boards                           | `apps/live/lib/template-boards.test.ts`                                                                                                                 |
| Card trail steps, cut-back, cap; children        | `apps/live/components/plan/item-trail.test.ts`                                                                                                          |
| Linked as rows, empty state, open                | `apps/live/components/plan/LinkedCards.test.tsx`                                                                                                        |
| Breadcrumb crumbs, fold, step back               | `apps/live/components/plan/ItemTrailCrumbs.test.tsx`                                                                                                    |
| Maximise, restore, Escape, unmount ends it       | `apps/live/hooks/plan/maximised-plan.test.ts`                                                                                                           |
| No remount, maximised size, one Escape           | `apps/live/components/plan/MaximisedPlanLayer.test.tsx`                                                                                                 |
| Drag, Add card, card menu, item panel            | checked by hand against the dev stack (screenshots in the PR)                                                                                           |

## Constants and configuration

| Constant                 | Value           | Provenance / safe range                                          |
| ------------------------ | --------------- | ---------------------------------------------------------------- |
| `CANVAS_LAYER_Z`         | `--z-panel` − 1 | Over the canvas, under its panels                                |
| `MAXIMISED_BOARD_SLOTS`  | 5               | DEFAULTS; slots across a maximised board before it scrolls; 3-8  |
| `EDGE_SCROLL_ZONE_PX`    | 56              | DEFAULTS; capped at a quarter of the viewport; 32-96             |
| `EDGE_SCROLL_MAX_PX`     | 18              | DEFAULTS; px per frame at the edge; 8-30                         |
| `EDGE_SCROLL_REDUCED_PX` | 6               | DEFAULTS; constant under reduced motion; 3-10                    |
| `WIDE_PANEL_SHARE`       | 0.6             | Side panels are 18-24rem; a sheet spans most of a phone; 0.5-0.8 |
| `MAX_INSET_SHARE`        | 0.45            | The element keeps at least 10% per axis; 0.3-0.45                |
| `PRESS_DRAG_SLOP_PX`     | 4               | Shared, apps/live/lib/press-gestures.ts                          |
| `PLAN_COLUMN_MIN_PX`     | 220             | A card's title reads in 3 lines; 180–320                         |
| `PLAN_COLUMNS_MAX`       | 12              | Spec                                                             |
| `ITEM_EDIT_DEBOUNCE_MS`  | 400             | One undo step per pause in typing                                |
| `ITEM_TRAIL_MAX`         | 8               | Spec; bounds the trail's memory; 2–20                            |
| `ITEM_TRAIL_SHOWN`       | 3               | Earlier crumbs that fit a 60rem header                           |
| `ITEM_TRAIL_SHOWN_PHONE` | 1               | Spec                                                             |
| `FIT_GLIDE_MS`           | 420             | Spec ("about 420 ms"); `hooks/canvas/useEditorViewport.ts`       |
| `FOCUS_ZOOM_MAX`         | 1.5             | Spec (150%); `useEditorState.ts`                                 |

- New cards open: `PlanContextValue.openNewItem(id, via?)` (usePlanSlice) opens the card and records it as
  `freshItemId`; `openItem` and `closeItem` clear it. Callers mint the id (`newItemId()`) and pass it to
  `addItem`: Add Card (PlanBoardView), a palette card's `addCard` (usePlanBoardDrop), New {Type}
  (PlanSheetsHost `onAddLinked`). PlanSheetsHost passes `fresh={freshItemId === item.id}` to ItemPanel, whose
  `useTitleFocus` (desktop and `canEdit` only, a frame after the Dialog's `initialFocus="container"` trap)
  focuses the title input with the caret at its end, or selects it when `fresh`.
