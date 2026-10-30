# Plan board blueprint

Derived from [Plan board](../plan-board.md). Contract for the `plan-board` and `plan-card` shape kinds and their
editor views.

## Domain and naming

| Spec term          | Identifier                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan board         | `ShapeKind` `'plan-board'`; set-up field `ShapeElement.planBoard: PlanBoardSetup`                                                                                               |
| Plan card          | `ShapeKind` `'plan-card'`; field `ShapeElement.planCard: { itemId: string }`                                                                                                    |
| board set-up       | `PlanBoardSetup` (`@liveplanner/items` `board.ts`)                                                                                                                              |
| column             | `PlanColumn`                                                                                                                                                                    |
| swimlane           | `SwimlaneBy` (+ `swimlaneField` for `'field'`) + projected `lanes`, `swimlanes`                                                                                                 |
| board sort         | `PlanBoardSetup.sortBy: BoardSortLevel[]` (`{ field, dir: 'asc' \| 'desc' }`, at most `BOARD_SORT_LEVELS_MAX`); fields `boardSortFieldsOf`, order `sortCards` (`board-sort.ts`) |
| lane field         | `LaneField` (`laneFieldsOf`, `laneFieldOf`); a drop's patch is `laneDropPatch`                                                                                                  |
| WIP limit          | `PlanColumn.wipLimit`                                                                                                                                                           |
| done column        | `PlanColumn.done` (a flag); `isDoneColumn`, `doneColumnsOf`, `finishedStatuses`, `isDoneName` (`@liveplanner/items` `done-columns.ts`)                                          |
| unplaced           | projection `unplaced`                                                                                                                                                           |
| quick filter       | `QuickFilter` (per person, React state, never stored)                                                                                                                           |
| face-down          | `cardIsFaceDown(item, setup, viewerId)`                                                                                                                                         |
| board preset       | `PLAN_BOARD_PRESETS` (`@liveplanner/items` `presets.ts`), id `PlanBoardPresetId`                                                                                                |
| suggested statuses | `SUGGESTED_STATUSES`, `suggestedStatuses(taken)`, `suggestionIndex(names, name)` (`@liveplanner/items` `suggested-statuses.ts`), a row `SuggestedStatus`                        |

## Element model (`packages/project`)

- `shape-kind.ts`: add `'plan-board'`, `'plan-card'` (62 → 64; `shape-kind.test.ts` count, canvas-and-palette prose).
- `element-types.ts` `ShapeElement`: `planBoard?: PlanBoardSetup`, `planCard?: { itemId: string }`.
- `element-fields.ts`: both fields listed.
- `shape-factory.ts`: `SHAPE_DEFAULT_SIZE` board 1120×640, card 240×120; `createShape('plan-board')` seeds the
  `blank` preset set-up; `createShape('plan-card')` seeds `planCard: { itemId: '' }` (the caller sets it).
- `validate-shape.ts`: `planBoard` valid when `normaliseBoardSetup` (items package) reads it (1..12 columns, unique ids and
  statuses, names ≤ 40, wip 1..99, cardFields known, `cardSize` minimal (absent is detailed; the retired `compact` and anything else read as absent, `readCardSize`), budget
  1..99); `planCard.itemId` by `ITEM_ID_PATTERN` or empty.
- Predicates: `isSelfDrawingShape` (both), `SELF_PAINTING_SHAPES` (both: board paints its own surfaces; card its
  type colour), `isSvgRenderedShape` exclusion (both), `SHAPE_LABELS` ("Plan board", "Plan card"), not markers,
  not containers.
- `svg-render.ts`: `svgBoxed` branches to `svg-render-plan.ts`: `svgPlanBoard(el, items, surface, itemTypes)`,
  `svgPlanCard(el, items, surface, itemTypes)`. `renderElementsToSvg`'s options carry `items?: ReadonlyMap<string, Item>`
  and `itemTypes?`. Without items, columns draw
  with names and empty bodies; a card draws "Item".
- Card faces: `svg-render-plan-card.ts` `planCardFace(item, x, y, w, ctx, measureOnly)` draws from `typeCardLayout` at
  the board's `cardSize` (slots lead/trail, head/headEnd/body/foot/footEnd), gating built-ins by
  `cardFieldsAt(size, cardFields)`; custom fields as `Label: value` pills via `customFieldText`; the title wraps to 2
  (Minimal) or 3 (Detailed) lines; returns `{ svg, height }`. `ctx.height` pins a Plan card element's frame.
  Card values (`dayLabel`, `customFieldText`, `checklistProgress`) live in `@liveplanner/items` `card-text.ts`.
- Board layout: `plan-board-layout.ts` `planBoardLayout(el, items, types, cardHeight?)` stacks cards at
  `cardHeight(item, width)` (absent: `PLAN_CARD_H`) and, with swimlanes, returns `lanes: PlanLaneSlot[]`, each a
  `PLAN_LANE_HEAD_H` header row plus its fullest column.
- `edit-operations` `SHAPE_KIND_FIELDS`: `plan-board` → `planBoard`, `plan-card` → `planCard`.
- `project-views` `content-summary` / `find`: board → title + column names; card → item id.

## Editor components (`apps/editor/components/plan/`)

```
PlanContext.tsx          context: items, types, item types slice, status, self, people, canEdit,
                         canEditCards, canVote, presence, actions
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
SetupLayoutStep.tsx      Setup Board's step 3, Layout: SwimlaneOptions and CardSizeOptions (shared with the menu,
                         plan-menu-parts.tsx); state is a `SetupLayout` (setup-board.ts
                         `setupLayoutOf` / `withSetupLayout`), started from the board so skipping keeps it
OptionRows.tsx           Plan's option list (spec "Option lists"): `kind` single (radiogroup/radio, a tick), multiple
                         (group/checkbox, a box) or action (buttons); `useMenuKind() === 'command'` makes rows
                         menuitemradio/checkbox/menuitem at tabIndex −1; else roving tabindex (the chosen or first
                         enabled row), ArrowUp/Down/Home/End; optional `palette` (board colours); `ariaLabel` per row
SetupStepper.tsx         the step indicator: circles joined by lines (`@container`, names under the circles below
                         `@md`), `aria-current="step"`, done steps are buttons "{Step}, done: go back", and "Step N
                         of M" under it (a polite live region)
SetupDialog.tsx          the setup dialog Setup Board and Setup Sheet share, on the editor's shared Dialog
                         (@liveworkspace/workbench: backdrop, focus trap, Escape, aria-modal, the modal guard): header,
                         SetupStepper, the step (alone scrolls), sticky footer; Enter presses `onPrimary` unless the
                         target owns Enter (`entersPrimary`); its events stop at it, but Escape (the Dialog's);
                         `useSetupPalette` (the app's light or dark PlanPalette); `returnFocus` a frame after close
SetupPlaceholder.tsx     a board's or Sheet's placeholder while not set up: glyph, title, "Not set up yet", the
                         Set up button (or the viewer's line)
useSetupDialog.ts        one element's dialog life: opens when unset, may edit and placed here; closes with the
                         `setUpElsewhere` toast when it stops being unset without this person's `finish()`
SetupBoardHost.tsx       the board's placeholder while it has no columns, and `PlanSetupBoard` (next/dynamic, its
                         own chunk) while the store has it open, 'new' or 'again'
PlanSetupBoard.tsx       Setup Board's three steps in SetupDialog; a new board's step and picks kept as a draft
lib/setup-dialog-store.ts  (app lib) which setup dialog is open (`openSetup(key, { again })`, `closeSetup`,
                         `useSetupOpen`), the placed-here marks (`markPlacedHere` from useFocusNewPlanElement and a
                         slot's new board; `usePlacedHere`), and drafts (bounded, SETUP_DRAFTS_MAX 20); never on
                         PlanContext and never synced
PlanColumnHeader.tsx     a column's head: colour bar, name, count, and the cog (PlanColumnPopover)
AddColumnPicker.tsx      the column picker, used by the popover's + Add Column After and the board's Columns section
                         (`short`: the button reads Add, aria-label Add Column; no autoFocus there): one field (TextInput compact, "New
                         column name", autoFocus) and Add Column. With existing statuses the field is a combobox
                         (role=combobox, aria-controls the listbox, aria-activedescendant the highlighted row,
                         aria-autocomplete=list); `narrowStatuses` filters rows by statusKey substring; ArrowDown
                         clamps at the last row, ArrowUp past the first returns to -1 (no highlight); Enter adds the
                         highlighted row, else the typed name (matchStatus). Typing resets the highlight
ExistingStatusList.tsx   the picker's Existing Statuses: heading + count, Add All (two or more, field blank), a
                         role=listbox `ul` (max-h-56, scrolls, the highlighted row kept in view) of role=option rows
                         (`data-status`; swatch, name, `usedOn`, `cardCount` pill); a row's mousedown is prevented so
                         the field keeps focus, mousemove highlights, click adds; colour transitions off under
                         motion-reduce. Without rows: `NoMatches`, "No states match “{text}”".
SuggestedStatusList.tsx  Suggested statuses (spec "Suggested statuses"), in Setup Board's Columns step ("Suggested
                         States", the board's `palette`) and the picker ("Suggested Statuses", the menu's colours): a
                         heading, Add All (two or more, `disabled` at the limit), then `OptionRows` kind=action
                         labelled by the heading, a row per `SuggestedStatus` (PlusIcon, name, `hint` as its detail,
                         ariaLabel "Add {Name}"). Nothing renders for an empty list. The picker shows it only while
                         `existing` is empty, over `suggestedStatuses([...board column names, ...statusNames
                         values])`, and hands the names to `onSuggest(names)`; its hosts add them with
                         `addColumnsAfter` (board-setup-edits.ts) and part `ColumnAddedSuggested` (one name moves the
                         settings to its column as a typed name does; Add All closes them). SetupColumnsStep shows it
                         while its own `existing` is empty, over the chosen names and `statusNames` values, appending
                         `{ kind: 'new', name }` columns through `withSuggested` (setup-board.ts: each at `suggestionIndex`, up to
                         `max`) and calling
                         `trackSetup('ColumnAddedSuggested')`
AddColumnPickerPopover.tsx the picker hung from + Add Column After (304px wide): a portal at z-popover (`data-add-column-picker`), placed by
                         @liveplanner/ui `placeHint` with order right, left, bottom, top (8px gap, 8px margin) and an
                         arrow at its `arrowOffset`; its own capture Escape and outside press close it and refocus the
                         button. PlanColumnPopover's Escape is disabled while it is open, and its outside press treats
                         `[data-add-column-picker]` as inside
                         (column-status-picks.ts: matchStatus, addStatusColumn, addStatusColumns, columnRename; it
                         re-exports statusKey, missingStatuses, pickableStatuses from packages/items)
PlanColumnPopover.tsx    a column's settings popover. On top a role=toolbar "Column actions" (bg-slate-50/70, hairline
                         under): Move Left / Move Right as one bordered h-8 segmented control of w-9 icon buttons
                         (`ToolbarButton`, each in the shared Tooltip, disabled at the ends), and at the end (justify-
                         between) Remove: ColumnOffIcon + "Remove", aria-label and tooltip "Remove Column", rose hover;
                         only while another column remains. Below it: + Add Column After and Delete Status rows. While the picker is open it works out `missingBoardStatuses`
                         (setup, pickableStatuses(names, items, types), { items, types, boards: statusBoards }),
                         memoised on those, nothing while closed. A row or a matched name adds with part
                         `ColumnAddedExisting` (Add All too), a new name with `ColumnAdded`; + Add Column After asks the new column's head to open its own
                         (column-settings-request.ts, a one-shot module request read on the head's mount) and
                         closes, and the new popover selects its name (`selectName`)
board-setup-edits.ts     the set-up's edits as pure functions (rename, recolour, WIP, done, move, add, remove;
                         `addColumnsAfter(setup, afterId, names)` adds several new columns in order as one set-up,
                         stopping at the limit, and gives the last one made)
column-move-flip.ts      a column moved left or right glides (FLIP): `captureColumns(root)` notes each `[data-plan-column]`
                         part's offsetLeft (the head in PlanColumnHeader, each cell in PlanBoardView); `playColumnMove`
                         animates each from its old left via `el.animate` translateX → 0 over COLUMN_MOVE_MS (240) on
                         COLUMN_MOVE_EASING; the moved column's parts also carry zIndex 2 and a boxShadow that fades.
                         `useColumnMoveFlip(gridRef, order)` gives `beforeMove(columnId)` (PlanBoardView calls it for a
                         `ColumnReordered` change; nothing under prefersReducedMotion) and `isMoving()`, true until the
                         glide ends, passed to usePlanCardFlip as `hold` so cards are measured but not played.
                         PlanColumnPopover follows: when its column's index changes it re-places itself under the cog
                         each animation frame (style written directly) for COLUMN_MOVE_MS + 40 ms, then setPos; not on a
                         phone
BoardColumnsSection.tsx  the board's Columns section (cog and element menu): InfoNote, "On This Board" + count, an `ol`
                         option list of the columns (number, StatusSwatch, name, WIP n / Done pills, chevron), each row
                         a button "Open {Name} settings" that calls onClose then requestColumnSettings(id); then the
                         inline AddColumnPicker (`short`) adding after `columnsInsertAfter(setup)` (the last column,
                         or the one before a done column that ends the board; null when empty), parts as the popover.
                         `pickableStatuses` and `missingBoardStatuses` run only while `open` (memoised on
                         planBoard). The added column's row is tinted bg-brand-50 for ADDED_TINT_MS (1600) and
                         fades in. At PLAN_COLUMNS_MAX a role=status note replaces the picker. Null without canEdit
track-board-setup.ts     Plan · Changed · <part>
PlanBoardCells.tsx       a row's band, one card in a cell (right-click → onMenu), and the drag ghost
PlanBoardHeader.tsx      title, count, progress, unplaced chip and its tray, votes left, quick filter, Only
                         mine, Reveal; a double-click on the title or its own empty space (not a widget or
                         button) renames when `canRename` (`canEdit && interactive`), stopping the event
BoardTitle.tsx           the title, or while renaming an input (`BOARD_TITLE_MAX` 80, selected on open);
                         Enter or blur saves the trimmed non-empty name through onSetup(..., 'Title'),
                         Escape cancels, a `closed` ref keeps the trailing blur from saving a cancel
AddCardButton.tsx        a cell's + Add card; opens AddCardPopover (or when the N key asks)
BoardCardTypeChips.tsx   the header's card type chips (spec "Card type chips"): one `button` per `boardAddTypes`
                         type, `PlanCardTileArt` (22 px: card outline, a stripe in the type's colour, its glyph) then
                         its label (labels drop above `CHIP_NAMES_MAX` types), each in a `HoverCard` "Add a {Type}"
                         / "Click to add one, or drag it onto the board.", aria-label "Add a {Type}"; a `role="group"`
                         aria-label "Add Cards" row, `overflow-x-auto` without a scrollbar. Pointer down stops
                         propagation (the header would move the board) and hands the press to useCardTypeDrag;
                         a click (or Enter / Space) adds through `chipClickCell` + `plan.addItem` + `openNewItem`.
                         PlanBoardView renders it only when `chipsShown` (card-type-chips.ts) holds, and passes it
                         to PlanBoardHeader as `chips`, which draws it after the title on a canvas, and in a header
                         band (the title portalled into the menu box) first in the header's middle, so it shrinks
                         and scrolls before the widgets and controls do
card-type-chips.ts       pure: `chipsShown({ interactive, canEditCards, phone, simplified, setup, types })` (the
                         role and place gate) and `chipClickCell(setup, projection, type, statusNames)` (the column
                         of the type's `newCardStatus` when the board has it, else the first; the first row; the
                         status `cellStatus`; the row's `laneMove` set; after the cell's last card)
phone-board.ts           boardLook (a phone's Minimal cards, no widgets, one column a screen, body touch-action) + shownQuick
                         In a Dashboard slot and not maximised (`simplified = useInDashboard() && !maximised`,
                         dashboard-context.ts: DashboardContext present) PlanBoardView draws the compact slot board
                         (plan-tabs.md "A board in a slot is simplified"): `setUpHere = canEdit && !simplified`
                         keeps Add New Card Type off; the projection and usePlanBoardDrop run over
                         `slotSetup(setup)` (slot-board.ts: one row, so a lane-free move) with no quick filter (`applied`
                         is NO_QUICK); SlotBoardHeader replaces PlanBoardHeader and SlotColumnHeader replaces
                         PlanColumnHeader; ExampleCardsNotice and each cell's Add card row are not drawn. Maximised
                         from the slot all of it returns, the cog SlotBoardCog (PlanBoardSectionsPanel + slot
                         sections) for an Editor. Cards, drag, the card menu, SetupBoardHost and counts keep
                         `canEdit`/`canEditCards` as on a Board tab
slot-board.ts            `slotSetup(setup)` (swimlaneBy 'none', but an All Cards board's 'status' rows kept; the same
                         object when nothing changes); `slotColumnUnit(bodyPx, columns)`: room = body - 2 x 12 px, the
                         even share (room - (units - 1) x 8) / units while >= SLOT_COLUMN_MIN_PX, else the largest whole
                         count k (units - 1 down to 1) with (room - k x 8) / (k + SLOT_COLUMN_PEEK) >= the floor, else
                         the floor; `slotColumnTemplate`: the 'slot' minmax template while they fit or unmeasured, else
                         each column floor(unit x w + (w - 1) x 8) px; `slotCardSize(size, unit)`: the board's size
                         while unit >= PLAN_COLUMN_MIN_PX, else 'minimal' (cards then `stacked`). The body width is
                         useObservedSize(bodyRef) while simplified and not on a phone
PlanCardFace.tsx         `stacked` (slot boards' Minimal cards): the TypeDot and title (2 lines, 12.5 px) in a row, then
                         the lead and trail bits in one wrapping row under it (`data-card-bits`), none when empty
SlotBoardHeader.tsx      the slot board's 40 px header: BoardTitle (no rename) and a CountBadge of the cards shown,
                         then (`data-slot-board-controls`) Retry when the load failed, Maximise, `slot.cog`; the
                         controls are opacity-0 until `group-hover`/`group-focus-within` of the board, always at
                         `pointer-coarse`, and never `invisible` so Tab reaches them
SlotColumnHeader.tsx     a slot column's sticky head: a colour dot (the column's colour, else the border), its name
                         (12 px semibold, truncated), CountBadge (`n / wip`, warning colours over the limit), then for
                         canEditCards (and not loading, not an Archive board) AddCardButton `compact` (icon only,
                         aria-label "Add a card to {name}", tooltip the same) opening AddCardPopover; `open` follows
                         the N key's adding cell
plan-board-columns.ts    layout 'slot' (inSlot, not a phone, not covering): `minmax(SLOT_COLUMN_MIN_PX * w px, w fr)`,
                         SLOT_COLUMN_MIN_PX 160, the grid's gap 8 px (SLOT_COLUMN_GAP_PX) and the body `scroll-edge-fade`
AddCardPopover.tsx       Add a Card: the board's types as MenuTiles in the shared PortalMenu (BottomSheet on a phone)
PlanCardMenu.tsx         a card's right-click menu on the shared ContextMenu (Open, Duplicate, Move to, Delete) and PlanCardMenuHost
PlanCardFace.tsx         a card face (custom fields as chips where Display places them; its gathered votes read-only)
PlanCardView.tsx         the plan-card element body (themed; a lone card's fill is its face); "Item not found"
PlanModal.tsx            the Plan forms' modal (through Dialog) and SheetRow; fields are the shared TextInput/TextArea `compact`
plan-board-moves.ts      the move a drop makes (boardMoveFor)
PlanSheetsHost.tsx       renders the open item panel or type editor
copy-card-link.ts        Copy Card Link: copyCardLink(link, notify) writes the card's address to the clipboard, toasts
                         LINK_COPIED ("Link copied") or LINK_NOT_COPIED ("Couldn't copy the link"; no clipboard too)
../palette/PlanBoardMenuSection.tsx  the board menu's five flyout rows and the slot cog panel (a board maximised from a slot): PLAN_BOARD_SECTIONS (Board Setup, Columns,
                         Swimlanes, Supported Cards, Card Layout; Columns `shows` only with columns and not All
                         Cards / Archive), each Body given `open` so it can defer work while shut
ItemPanel.tsx            item panel: Dialog size 3xl (60rem), header (type, key, labelled Help, ItemPanelMenu ⋯ of Duplicate / Archive / Delete, Copy Card Link, close), main column
                         (title, tabs from tabsOf, the tab's fields), Details aside (w-80: detailFieldsOf rows,
                         then made/changed); phone: one column, a Details tab first, sheet 85dvh
ItemPanelLayout.tsx      the panel's shell pieces: ItemTypeBand (h-1, ACCENT_BG + accentVars of the type colour),
                         ItemPanelSection (13px semibold heading, mb-8), ItemDetailsRow (grid 6.5rem/1fr, min-h-9,
                         rounded hover), ItemMeta (11px slate-400 created/edited lines); the aside is m-3 rounded-xl
                         bg-slate-50 ring-1; title 22px semibold tracking-tight
ItemFieldEditor.tsx      one field's editor by kind (FIELD_LABELS, fieldLabel, labelsItsControl)
LinkedCards.tsx          LinkedCardGroup (a Linked as {Field} section) and FilteredCards rows (glyph, #key, title,
                         status, Archived chip)
ItemTrailCrumbs.tsx      the breadcrumb: the shared BackBar to the card before (its "#key title"), this card's "#key"
                         as the chip, in a row above the header
item-trail.ts            pure: stepTrail / liveTrail / childrenOf, ItemOpenVia, ITEM_TRAIL_MAX
ItemDescription.tsx      the description: NoteRichTextEditor (note=false), saved DESCRIPTION_SAVE_MS (800 ms) after
                         typing, on blur and on close as one patch of description + descriptionRich
item-field-editors.tsx   editors for text (debounced), priority, labels, number, date, checklist
PersonPicker.tsx         the Assignee picker: No one, the plan's people, then + Custom Assignee (editable only), whose
                         CustomAssigneePopover (AnchoredPopover, a Name TextInput of CUSTOM_ASSIGNEE_NAME_MAX, Cancel,
                         Add) saves personNamed(name, people) and closes
plan-board-keys.ts       the board's keyboard as a pure function of the projection
plan-palette.ts          re-exports planPalette from @liveplanner/project (shared with the SVG export) and
                         planOwnColours(element)
MaximisedPlanLayer.tsx  MaximisableSlot (a board's or view's body through a portal into its own host element,
                         moved between the canvas slot and the overlay), the overlay (portal to document.body,
                         fixed inset-0, z-40, the FLIP open/close), the lifetime hook and the header button
plan-type-glyph.tsx      a type's glyph from the Plan glyph set
plan-tile-art.tsx        a picture per board preset, and the card tile glyph
```

Hooks (`apps/editor/hooks/plan/`): `usePlanItems` (store), `usePlanSlice` (composed into `useEditorState`; provides
the `PlanContext` value, the open item and set-up, and `dropPlanCardOnBoard`), `usePlanBoardDrop` (the board's drag and
drop, and the board as a target for cards from other boards, and for a chip's new card, through `plan-board-targets.ts`, a registry of the
boards on screen by element id), `useCardTypeDrag` (a header chip's press: idle, pressed, carrying, then dropped
or cancelled; past `PRESS_DRAG_SLOP_PX` a ghost card follows the pointer, moved by style per animation frame, never a
React render; each frame `otherPlanBoardAt(x, y, '')` finds the board, its target's `acceptsType` gates it,
`dropSlotAt` and `refuseAt({ type, fields: {} }, slot)` read the cell, and `hover({ itemId: CHIP_DRAG_ID, slot,
height: CHIP_GHOST_HEIGHT_PX, refused })` opens the placeholder, the last hover kept so a still pointer sends none;
pointerup over an open slot calls `addCard(type, slot)`, over a refused one announces the reason, anywhere else adds
nothing; Escape, pointercancel or unmount end it and clear the hover; a press that never travels is the chip's
click), `usePlanCardDrag` (pointer drag
within, between and out of boards; the drop slot is read from `data-plan-status` / `data-plan-lane` / `data-plan-card`
under the pointer), `usePlanPresence` (the `plan-presence` op), `useItemUndo` (the undo journal), and
`maximised-plan.ts` is the maximised board or view, a module store
(`{ id, kind: 'Board' | 'View' } | null`, `maximisePlanElement` / `restorePlanElement` / `releasePlanElement` /
`useMaximisedPlanId`; `kind` names the telemetry), drawn in the canvas area (no zen chrome; the editor's chrome stays). `PlanProvider` wraps the editor view, so the export dialog reads
the items too.

## Done columns (`packages/items/src/done-columns.ts`)

- `DONE_NAMES`: the done-like names of plan-board.md "Done columns". `isDoneName(name)` compares `doneNameKey(name)`
  (lower case, curly apostrophes straight, anything but letters, digits and apostrophes a space, spaces collapsed,
  "wont" read as "won't") against them, whole names only.
- `isDoneColumn(setup, column)`: `column.done` when set; else, on a board where no column has `done` and
  `doneColumnId` names a column (an older board), whether the column is that one or after it; else
  `isDoneName(column.name)`. `doneColumnsOf(setup)` lists them left to right; `finishedStatuses(setup)` their
  statuses; `firstDoneColumn(setup)` the first.
- `settleDoneColumns(before, after)`: the set-up as written. Each column of `after` without `done` keeps what it
  counted as on `before` when `before` is an older board that has it (or `after` is one), else its name decides.
  Then a column stores `done: true` when done, `done: false` when its name is done-like but it is not, and nothing
  otherwise; `doneColumnId` becomes the first done column's id (for older editors), or goes. Pure, idempotent.
- `setColumnDone(setup, id, on)`: settles, then sets that column's `done` (Counts as Done) and settles again.
- Writers settle: the editor's `updateBoard` (`settleDoneColumns(before, setup)`), the agents' `placeBoard` and
  `reshapeBoard`. Presets flag their done columns (`statusColumn(..., { done: true })`) and keep `doneColumnId`.
- `normaliseBoardSetup` keeps a boolean `done` on a column; `plan-board-patch.ts` carries `done` as a column field.

## Card sizes

- `CARD_SIZES` is `['minimal', 'detailed']`; `readCardSize(v)` reads `'minimal'` as Minimal and anything else (the
  retired `'compact'` among them) as Detailed, for set-ups, Plan card elements and agent input alike.
- `CARD_SIZE_FIELDS`: minimal key, priority, due, assignee; detailed every field.
  `cardFieldsAt(size, fields)` is what a face draws. `CARD_FIELDS` adds `description` (two lines); Parent is a custom
  card field (`CustomCardField` admits `parent`), placed by the type's Display (Task: detailed `body`). The Cards flyout dims a field tile outside the size's set (`disabled`), its setting kept.
- `PlanCardFace` lays out the parts in `plan-card-parts.tsx`: frame `rounded-xl` with a hairline border, rest shadow
  `0 1px 2px / 0 1px 3px` slate at 6 % / 4 %, hover `shadow-md` and `-translate-y-px` (150 ms; none under reduced
  motion); no stripe: the type colour fills `KeyTag` (the #key, text white or `#18181b`, whichever
  `contrastRatio` favours: `keyTextOn`), and Minimal draws `TypeDot` before the title. Minimal: title 13 px semibold, two lines.
  Detailed: header (`TypeChip`, `KeyTag`, `ColourDot` when the item has its own colour,
  `PrioritySignal` with its name at the end), title 14 px three lines, parent, description two lines, custom
  fields as a name/value grid, `LabelChips` (≤ 4, `labelColour` tints, "+n"), then a footer of `MetaPill`s
  (start, due, estimate, `ChecklistPill`, comments, votes) with the avatar at the end. `DuePill`: `LATE_COLOUR`
  when past and not done, `SOON_COLOUR` within `DUE_SOON_DAYS` (2), else quiet. Pills tint their tone at 14 %
  (`tint`, `color-mix`).

## Behaviour and state

- **A card's address** (spec "Its address"): `apps/editor/lib/card-address.ts` holds the pure parts:
  `cardHash(tabId, itemId)` is `placeHash({ tabId, cardId })` from `@liveworkspace/explorer` (`#t=<tab>` or
  `#t=<tab>&item=<id>`, the Inbox grammar `parseCollabDeepLink` reads); `hashCardId(hash)` reads `item`;
  `CARD_ENTRY_KEY` (`liveplannerCard`) marks a history entry an opened card pushed (`cardEntryState`,
  `isCardEntry`; the App Router merges its own keys beside it); `cardLink({ origin, projectId, search, tabId,
itemId })` is `<origin>/project/<id>[?s=<code>]` plus `cardHash`, keeping only the `s` query.
  - `app/project/[id]/useCardAddress.ts`, composed in `useEditorState` after `usePlanSlice`, writes the address
    when `hydrated`, `activeId` or `shownId` change. `shownId` is `openItemId` when the item store holds it, else
    null (a card being made, deleted, or out of a tab-scoped share's items is never written). Only on
    `isEditorPath`. With `was` the last written card: equal hash, no write; `shownId && !was` and not arriving,
    `pushState(cardEntryState(true))`; `!shownId && was` on a marked entry, `history.back()`; otherwise
    `replaceState` keeping the mark. `arrivingCardRef` names the card opened from an address (the deep link's
    `openItem` in `useEditorState`, and Forward); it replaces and is cleared once written.
  - Its `popstate` listener (once hydrated): off the editor path, nothing; the hash's card equal to `openItemId`,
    nothing; a card, `arrivingRef = id` then `openItem(id)`; none, `closeItem()`.
  - `useTabEntryEffects`' tab pin replaces with `cardEntryState(isCardEntry(history.state))`, so a tab switch under
    an open card keeps its entry's mark.
  - `useCollabDeepLinkCapture(hydrated)` reads the hash on each commit until it holds a link or the hydration
    commit has run; after that the address is the editor's own, so a card opened later is never read back as a
    link and reopened.
  - Copy Card Link: `usePlanSlice({ cardLink })` puts a stable `cardLink(itemId)` on `PlanContextValue` (read through
    `useLatest`, so the context keeps its identity); `PlanSheetsHost` hands `ItemPanel` `onCopyLink`, which
    `ItemPanelMenu` shows as **Copy Card Link** (lucide `link`, 14 px) before Help for every role.

- **Input routing**: `PlanBoardView` receives `interactive = editorMode === 'plan' && !readOnly`. Interactive:
  card pointerdown stops propagation and starts `usePlanCardDrag`; header/border do not stop propagation (the
  generic box drag moves the board). Not interactive: nothing stops propagation; double-click on a card opens it.
- **Team people** (`useTeamPeople(ownerId, enabled, signedIn, teams, projectTeamId)`, `useEditorState`): the
  token's team whose id is `projectTeamId` (`editor-realtime.ts`, the plan's `team_id`), else none, so a personal,
  This Browser, shared-from-My-Work or guest plan asks for nobody. One `apiTeamMembers` request for that team,
  joined members only (`teamMemberPerson`). The mention list (`useCommentMentions`) picks the same team.
- **Assignable people** (`usePlanSlice` `people`): `planPeople(self, teamPeople, assigned)` from
  `@liveplanner/items` (`plan-people.ts`): self, then team members, then every assignee a card holds
  (`assignedPeople`), once each by id (the first source wins), sorted by name. The assigned list is recomputed when
  the item map changes and the result is kept by a key of its ids and names, so a write that changes no assignee
  hands the context the same array.
- **Person list** (`PersonPicker`): a trigger button (`aria-haspopup="listbox"`, named `Assignee: <name>`, the
  current person's name and a chevron, no mark) over an in-place `role="listbox"`
  (`aria-activedescendant`): `None` (**No one**), the options (the current person first when not among the people,
  then the people), then `CUSTOM_ASSIGNEE_OPTION` (**+ Custom Assignee**) when not disabled. Opens on press, Enter,
  Space, ArrowUp/Down at the current choice; ArrowUp/Down move, Enter picks, Escape (capture, before the panel's)
  and `useClickOutside` close, Tab closes without refocus. `AccountMark` (`components/plan/AccountMark.tsx`):
  `BrandGlyph` from `@liveworkspace/brand` (re-exported by `@liveplanner/ui`) at 12 px in `text-slate-500 dark:text-slate-400`, `role="img"` named `ACCOUNT_MARK_LABEL` ("liveworkspace account"), no Tooltip and no `title` (no visible hover text);
  drawn before the name in each list row whose person id passes `isIdentityPersonId` (`@liveplanner/items`
  person.ts: 24 hex characters, as `itemPersonId` makes; a same-width spacer otherwise), the row's `aria-label`
  then `<name>, liveworkspace account`; nowhere else.
- **Custom assignee**: `PersonPicker`'s last row **+ Custom Assignee** when not disabled; picking it keeps the
  current value and opens `CustomAssigneePopover` under the trigger. Add (or Enter,
  the trimmed name non-empty) calls `onSave(personNamed(name, people))`; Escape, Cancel or a press outside close it
  unsaved. `personNamed` matches an existing person by `statusKey` of the name before minting `n-<slug>`.
- **Cards push**: `cardsPushOf` hands `cardsCollabPush` no assignee for an `n-` id (`isNamedPerson`), so a custom
  assignee is neither listed nor counted in `unmatched`.
- **Card drag states**: `idle → pressed` (pointerdown) `→ dragging` (`isDragTravel`, moved ≥ `PRESS_DRAG_SLOP_PX`) `→ dropped |
cancelled` (Escape, pointercancel). `pressed → idle` on pointerup without moving = open the item.
  - While dragging: a floating copy follows the pointer (screen space, transform only), a placeholder of the
    card's height marks the drop slot: column under the pointer, lane under the pointer, slot by the midpoint of
    the cards under it.
  - Drop inside the board: `moveItem(id, { status, after|before, set: laneField })`, pushed to undo.
  - Drop outside the board's rect: `usePlanCardDrag`'s `onDropOutside` calls `PlanContext.placeCardOut(itemId, x, y)`,
    which adds a `plan-card` element there (one
    commit), item unchanged.
- **Sort Cards** (`board-sort.ts`): `normaliseBoardSort` keeps up to `BOARD_SORT_LEVELS_MAX` levels whose field
  is a built-in (`BOARD_SORT_BUILT_INS`: priority, estimate, start, due) or a custom field id, each once, `dir`
  `'asc'` or `'desc'`. `sortCards(items, sortBy, types)` reads each card's key once per level (`sortKeyOf`: a
  number, or a date string; a Choice its option index; a field the card's type lacks, or of a kind it cannot sort
  by, is no value), then sorts stably, no value last at every level, so the rank order it is given breaks ties.
  `projectBoard` runs it after `byRank` when `sortBy` is set and returns `sorted: true`. `boardSortFieldsOf(types)`
  lists the fields the menu offers (`BoardSortField { id, label, kind }`), built-ins a shown type has first.
  `boardSortLabel(field, dir)` names a direction for the menu and the agents' answers.
- **Sorted drops**: on a sorted board `boardMoveFor` answers null for a drop into the card's own cell, and
  `sortedSlot(projection, item, slot, sortBy, types)` (apps/editor `plan-board-moves.ts`) moves the drop slot's
  `beforeId` to the first card of the cell the dragged card sorts before (its lane's field applied first), so the
  placeholder and the drop agree with the sort. The board target's `place` hands it to `usePlanCardDrag`.
  `planBoardKey` answers `{ kind: 'refuse' }` for Shift+Up/Down on a sorted board.
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
  item only (one pass over the project's items); a Project's Linked as Parent is one of its groups.
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
  `useCanvasLayerInsets(canvas)` (hooks/ui): `apps/editor/lib/canvas-layer-insets.ts` reads `[data-toolbar-menu]` (top row),
  `topStripInset` (the Toolbar strip), `[data-layout-chrome]` (MovablePanel `layoutChrome`: the Explorer only, so a passing panel such as the Trash never moves the board; a side by its nearer edge, a sheet
  wider than `WIDE_PANEL_SHARE` of the canvas as top or bottom by its middle); the bottom-right controls are not measured (they float over the board at their own z),
  capped at `MAX_INSET_SHARE` per axis. Measured in one `requestAnimationFrame` after mount and after a
  `ResizeObserver` change (the canvas and each piece of chrome), a chrome element's `style`/`class` change, a
  `transitionend` on chrome, a window `resize`, or a child-list change under the canvas that adds or removes chrome
  (`touchesChrome`; the set is re-observed only when it differs; the strip's children are observed too, as its card
  changes width with the category). No key or press listener.
  The hook returns `CanvasLayout = { insets, band, row? }`. With no band, `phoneRow(canvas, insets, menu)` returns
  `PhoneRow { height, left }` (px from the element's box inside the cover's `PHONE_COVER_PAD_PX` 8) when the canvas is
  under `BAND_CANVAS_MIN_PX`, the menu is in the top half and inside the element, and at least `PHONE_ROW_MIN_PX` 160
  plus `BAND_GAP_PX` is left after it: `height` the menu's bottom less the element's top, `left` the menu's right plus
  `BAND_GAP_PX`; the insets' top is then 0. `CanvasCover` writes it as `--plan-band-h` and `--plan-band-left` only
  (`rowVars`; no `data-header-band`, so the name stays in the header and the controls card is not drawn) and sets
  `data-band-blend` for it as for a band. `sameLayout` compares `row` by value, a missing one as null. `headerBand(canvas, insets, menu, strip, nameWidth, endWidth)`
  (the strip measured as the union of `[data-toolbar-palette]`'s children, only its width and height used; `nameWidth`
  the menu box's `[data-menu-name-slot]`, `MENU_NAME_SLOT_SELECTOR`; `endWidth` the covering element's controls card,
  `BAND_CONTROLS_SELECTOR` `[data-canvas-cover] [data-band-controls]`, `offsetWidth` plus its header's right padding,
  `BAND_RIGHT_MIN_PX` 280 until measured) returns `HeaderBand { height, left, mid, stripEnd }` in px from the element's
  box (inside the cover's `COVER_PAD_PX` 12) when the menu (and strip) are in the top half, the canvas is at least
  `BAND_CANVAS_MIN_PX` 640 wide, the strip does not start before the menu (a phone), and, with the strip's right edge at
  the element's right less `endWidth` and `BAND_GAP_PX` 12, at least `BAND_MID_MIN_PX` 140 is left between the menu
  (judged without the name) and the strip, less `BAND_GAP_PX` each side; `mid` runs from the menu box as it is to the
  strip (floored at 0), `stripEnd` is the strip's right edge from the canvas's right edge, and the insets' top is 0. Its
  room never reads where the strip is now, so moving it cannot take the band away. `CanvasCover` sets
  `--plan-strip-align: flex-end` and `--plan-strip-end` (`setStripEnd`: `stripEnd` over the strip's computed `zoom`) on
  the canvas `main` it is portalled into while it has a band (`clearStripEnd` on going); `ToolbarPalette`'s root reads
  them as `align-items` and `padding-right` (centre and 0 otherwise). `useCanvasLayerInsets` observes the controls card
  too. **The controls** (`apps/editor/components/plan/band-controls.ts`): `BAND_CONTROLS_CLASS`
  (`[[data-header-band]_&]:` the band card height, p-1, 36 px buttons; no border, fill or shadow) and `bandControlsProps()`
  (`data-band-controls`) on `PlanBoardHeader`'s trailing group, `SheetHeader`'s controls and `ViewFrame`'s aside;
  `BAND_HEADER_END` (`[[data-header-band]_&]:pr-px`) on those three headers, so the last control's edge is 5 px from the
  element's right as the menu's first is from its left; `PlanBoardHeader` also takes `[[data-header-band]_&]:border-b`
  in `palette.border`. The menu box takes `BAND_FLUSH` (`toolbar-surface.ts`: `[[data-band-blend]_&]:` transparent
  fill and border, important) after `BAND_BLEND`; `ToolbarPalette`'s card and `BoardCardsStrip` take `BAND_STRIP_FLUSH`
  (`[[data-strip-in-band]_&]:` transparent fill and border, no shadow), `setStripEnd` setting `data-strip-in-band` on
  the canvas `main` and `clearStripEnd` removing it.
  **The name in the menu box** (`apps/editor/components/plan/menu-name-slot.tsx`): `ToolbarExplorerButton` (not inline,
  not a phone) renders `MenuNameSlot` (`data-menu-name-slot`, `max-w-[16rem]`, a hairline, `empty:hidden`), its node a
  module store (`setMenuNameSlot`, `useMenuNameSlot`). `CanvasCover` calls `announceHeaderBand()` when its band comes or
  goes (and on unmount); `InMenuBox({ render })` keeps a hidden marker in the header, checks
  `marker.closest('[data-header-band]')` in a layout effect on each announcement (the element's DOM is moved into the
  cover, so no context reaches it), and while in a band with a slot portals `render(true)` into the slot, else renders
  `render(false)` in place. `PlanBoardHeader` (its `data-board-title` span with `BoardTitle inBox`), `SheetHeader`
  (`data-sheet-title`) and `ViewFrame` wrap their titles in it; in the box they take `IN_BOX_TITLE_CLASS` and the
  chrome's ink (a rename field `color: inherit`). `CanvasCover` marks its inner box `data-header-band` and sets `--plan-band-h`, `--plan-band-left`
  and `--plan-band-mid` (`bandVars`). `PlanBoardHeader`, `SheetHeader` and the views' `ViewFrame` read them with their
  own sizes as fallbacks: `h-[var(--plan-band-h,52px)]` (40 px a Sheet's, 2.5rem a view's),
  `pl-[var(--plan-band-left,…)]`, and `max-w-[var(--plan-band-mid,none)]` on the title (and widgets, count) group, the
  trailing controls `ml-auto`; `SheetFindBar` sits at `calc(var(--plan-band-h, 40px) + 6px)`.
  `ViewZoomControls` passes `zoomHidden` unless `useSheetCovering()` names a Sheet: `ZoomControls` then leaves out
  Zoom out, the level, Zoom in and Fit (and their dividers), rendering only Zen, or nothing. Header, tab bar and footer are outside `main`. `zenMode` is not
  touched. The layer is a `CanvasCover` (`data-canvas-cover`, `absolute inset-0` at `CANVAS_LAYER_Z`, `background: inherit`
  from the canvas `main` so it paints the canvas's colour and pattern, stopping
  pointerdown, double-click, context-menu and wheel) holding the element at its insets; `useCanvasSurfaceGestures`'
  capture handler bails for a target inside `[data-canvas-cover]`, and `useEditorKeyboardShortcuts`, while `canvasCovered()`,
  sorts each key by `coveredKeyRole` (run: undo/redo/search/zen/mode/Escape; swallow: Cmd+D/A/Shift+L, z-order, zoom,
  prevented; ignore: the rest) instead of returning early (`getMaximisedPlanId() !== null || fillTabId !== null`, read at the key press). `useCanvasSelectionView` passes `canvasCovered` from `useCanvasCovered()` (`useMaximisedPlanId() !== null ||
fillTabId`; `ViewMinimap` returns null while it is true, hiding the Map; `usePaletteCatalogue`, while `useBoardFillingTab()`, swaps its categories for
  `coveredPaletteCategories()` (Plan's `plan-cards` alone), and `ToolbarPalette` shows the first offered
  category while the chosen one is not offered, keeping the choice; while `useSheetCovering()` `ToolbarPalette` hides its root
  (`hidden`), or on a phone (a `leading` menu) renders no card beside the menu; `usePaletteCatalogue`'s tile preamble
  calls `restorePlanElement()` while `getMaximisedPlanId()` is set and `restoresMaximised(action, args)` (any action
  but `cancelDraw` and `addShape('plan-card', …)`; `withTileActionPreamble` hands the preamble the action and its
  arguments)) to `deriveCanvasSelection`, which then shows no popover, plus or multi-selection toolbar.
- **Fill Tab** (`setup.fillTab: true`, normalised exactly-true by `normaliseBoardSetup`, carried by
  `planBoardPatch` as a set-up key): `fill-tab.ts` (pure) gives `fillTabElementOf(elements, tabKind?, dashboard?)`
  (`{ id, kind: FillTabKind }` or null: on a Board or Sheet tab its first board or Sheet; on a Dashboard its one
  filling visualisation, the stored layout read through `readDashboard`; otherwise the first board whose raw
  `planBoard.fillTab === true`, or Sheet whose `planSheet.fillTab === true`, in element order;
  [Sheet element blueprint](../../029-sheets/blueprints/sheet-element.md#fill-tab)).
- **The Plan cover** (`apps/editor/hooks/plan/plan-cover-store.ts`, a module store like `maximised-plan.ts`): `{ fillTabId, fillTabKind,
planKind }`, published before paint by `usePlanCoverWiring` (called once from `useEditorState`: it memoises
  `fillTabElementOf(activeTab.elements, kind, dashboard)`, and returns `canvasCovered` for the keyboard). Readers subscribe with selectors, so they re-render only when their answer changes: `useCanvasCovered`
  (maximised or filled: selection chrome, the Map), `useBoardFillingTab` (a board filling the tab: the palette's Cards alone),
  `useSheetCovering` (a Sheet maximised or filling the tab: the palette hidden), `useFillsTab(id)` (a board or Sheet). `isCanvasCovered()` is the
  one covered check, read at a key press too. Neither value is on `PlanContext`, so adding or moving an element never
  changes the context (guarded by `plan-cover-store.test.tsx`: 40 element adds, 0 re-renders).
- **A filled board**: `PlanBoardView` calls `useBoardMaximised(id, interactive)`:
  `filled` from `useFillsTab(id)`; a store maximise on it is released (`releasePlanElement`, no telemetry) and the
  lifetime hook (Escape) runs only for a store maximise. A filled board hides `MaximisePlanButton` and passes `fill` to
  `MaximisableSlot`, which moves the host into `FilledTabLayer` (the same `CanvasCover` as the maximised layer, at the
  same insets, no grow animation). In any mode (`interactive` only decides what the board itself allows). Nothing in the menu or the wizard sets Fill Tab any more: a Board
  tab's board always fills it (`fillTabElementOf(elements, kind)`, plan-tabs.md), and the wizard's Layout step ends at
  card size; `onSetUp(columns, typeIds, layout)` writes `withSetupLayout(setUpBoard(current, …), layout)` through
  `updateBoard`.
- **Reveal**: sets `planBoard.hideWriting = false` (element commit).
- **Set-up edits**: board commits via `PlanContext.updateBoard(boardId, setup)`; Delete Status on a state that holds
  cards opens `RemoveColumnPopover` first (move them to another column of this board, or to the Trash), the move done
  before the state's column comes off every board.
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
- Cursors (`components/plan/board-cursors.ts`): `planCardCursor(interactive, canEditCards)` is `grab` for an
  Editor or a Participant, `pointer` for a Viewer, nothing out of Plan mode; `planBoardBodyCursor(interactive)`
  sets `default` on the board body, which otherwise inherits the canvas's `cursor-grab`.
- WIP over: count chip uses `--warning` tokens, column head text "Over WIP limit".
- Empty board: first column shows the open add field with "Add your first item".
- Copy: "Add card", "Add your first card", "Add a Card", "Or type a title and press Enter", "Open",
  "Duplicate", "Delete", "Card duplicated", "Card deleted", "Not on this board", "Move to", "Hidden until reveal", "Reveal", "Votes left: 3",
  "Item not found", "Remove card", "Only mine", "Column", "WIP Limit", "Counts as Done",
  "Move Left", "Move Right", "+ Add Column After", "Remove Column", "Remove", "Column actions", "Columns",
  "The board’s columns, left to right. Press one to open its settings.", "On This Board", "WIP {n}", "Done",
  "Open {Name} settings", "Add", "A board holds up to 12 columns.", "Move and Remove", "Keep It",
  "Linked as {Field}", "No cards link here as {Field} yet.", "Archived", "Card trail".
- Item panel: a modal through the shared `Dialog` (`size="lg"`, `phoneSheet`: a sheet from the bottom with a grab
  handle below `sm`), max height 44rem, header with type picker + key, title
  input, field rows in the type's order, description textarea, checklist, footer "Created by (disc) X" and "Edited by (disc) Y, 2m", the disc `PersonDisc`.

## Accessibility

- Board is a `region` named by its title; each column a `list` labelled "In Progress, 3 items, WIP limit 4";
  each card a `listitem` containing a `button` named "#12 Fix login, Bug, assigned to Sam, high priority".
- Keyboard per spec (`planBoardKey` in `plan-board-keys.ts`, read by `PlanBoardView`); moves announced in a polite
  live region.
- Drag has the keyboard equivalent (Shift+arrows). Focus ring 2 px, contrast ≥ 3:1; text ≥ 4.5:1 on every
  type colour key fill (the #key text meets 4.5:1 on it).
- Reduced motion: no placeholder animation, no card lift shadow transition.
- Column picker: the field is a `combobox` (`aria-controls` the listbox, `aria-activedescendant` the highlighted
  `option`, `aria-expanded` while rows show); rows are `option`s with `aria-selected`; the list is labelled by its
  Existing Statuses heading; the match note is a `status` the field is described by. ArrowUp/ArrowDown, Enter,
  Escape (closes only the picker), Tab reaches Add Column then Add All.
- Suggested statuses: a `group` of buttons named by its heading (`OptionRows` kind=action, roving tabindex,
  ArrowUp/ArrowDown/Home/End); each button is named "Add {Name}" and its hint is visible text in it.
- Breadcrumb: `nav aria-label="Card trail"` holding the BackBar, a `button` reading "#12 Website relaunch" then
  its chip "#13". Linked as: a
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
- Suggested statuses: `suggestedStatuses` is one pass over the names taken into a Set of keys, then five lookups,
  O(names); the picker memoises it on its columns and names, Setup Board works it out per render of the Columns step
  (its chosen columns and the project's names). Measured: ten calls over 10,000 names in about 42 ms
  (`suggested-statuses.test.ts` keeps it under a 250 ms budget); a real project has tens of statuses.

## Errors and edge cases

| Case                                          | Handling                                        |
| --------------------------------------------- | ----------------------------------------------- |
| Items not loaded yet                          | Columns draw with skeleton cards (3 per column) |
| Item store failed to load                     | Header shows "Couldn't load items" + Retry      |
| Drop on the same slot                         | No write                                        |
| Column statuses duplicated by an agent        | Validation rejects; normalise keeps the first   |
| Board narrower than columns × 220             | Columns scroll horizontally inside the board    |
| Picker: board already has every status        | Plain field, no list, as before                 |
| Picker: typed text matches no row             | "No states match" empty state; Add Column       |
| Every suggestion's name already taken         | No Suggested section at all                     |
| Suggestion pressed at the column limit        | Setup: rows disabled; picker: no add, no write  |
| Fill Tab: two boards set to fill              | The first in element order fills; others hidden |
| Fill Tab: element added while on              | Kept under the board, hidden; counted next time |
| Fill Tab: board deleted                       | `fillTabElementOf` is null; canvas is back      |
| Item moved by someone else during my drag     | My drop still applies (last write wins)         |
| Address names a deleted or unseen card        | Nothing opens; the address drops the card       |
| Address names a tab gone or out of scope      | The first tab; the card still opens             |
| Card deleted by someone while open            | Its entry is stepped back off                   |
| Clipboard missing or refused (Copy Card Link) | Toast "Couldn't copy the link"                  |

## Observability

`[plan]` log fingerprints: `plan.drop.board`, `plan.drop.out`, `plan.card.onto-board`, `plan.setup.column-removed`,
`plan.items.load-failed`. Sort Cards sends `Plan · Changed · BoardSort`. Panel navigation sends `Plan · Opened · Parent | ChildCard | Breadcrumb` (`ChildCard`: a card opened from a Linked as
section). The column picker sends `Plan · Changed · ColumnAdded | ColumnAddedExisting | ColumnAddedSuggested`;
Setup Board's Suggested States sends `ColumnAddedSuggested` once a press.

## Testing

| Rule                                                           | Test                                                                                                                                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Done columns: names, flags, older boards, settling             | `packages/items/src/done-columns.test.ts`                                                                                                                   |
| Set-up edits                                                   | `apps/editor/components/plan/board-setup-edits.test.ts`                                                                                                     |
| Sort Cards: levels, kinds, no value last, rank ties, read back | `packages/items/src/board-sort.test.ts`, `board.test.ts`                                                                                                    |
| Sort Cards: 1,000 cards a column within budget                 | `packages/items/src/board-sort.test.ts`                                                                                                                     |
| Sorted board: own-cell drop, slot, Shift+Up/Down               | `apps/editor/components/plan/plan-board-moves.test.ts`, `plan-board-keys.test.ts`                                                                           |
| Sort Cards menu, role                                          | `apps/editor/components/palette/PlanBoardMenuSection.test.tsx`                                                                                              |
| change_board sortBy, list_items order                          | `packages/agent-verbs/src/plan/change-board.test.ts`, `plan-listing.test.ts`                                                                                |
| Column picker statuses, counts, boards                         | `packages/items/src/board-status-picks.test.ts`                                                                                                             |
| Cursors per role: card hand, Viewer pointer, body arrow        | `apps/editor/components/plan/board-cursors.test.ts`                                                                                                         |
| Fill Tab: which board, deletion, copy                          | `apps/editor/components/plan/fill-tab.test.ts`                                                                                                              |
| Setup Board Layout step, stepper, Fill Tab                     | `apps/editor/components/plan/PlanSetupBoard.test.tsx`                                                                                                       |
| Setup Board as a dialog: opens, Escape, placeholder, toast     | `apps/editor/components/plan/SetupBoardHost.test.tsx`                                                                                                       |
| Layout read from and written to the board                      | `apps/editor/components/plan/setup-board.test.ts`                                                                                                           |
| Accounts marked in the picker's list only                      | `apps/editor/components/plan/PersonPicker.test.tsx`                                                                                                         |
| Maximised/filled insets from the chrome                        | `apps/editor/lib/canvas-layer-insets.test.ts`, `apps/editor/hooks/ui/useCanvasLayerInsets.test.ts`                                                          |
| The header band, and the cover's band variables                | `apps/editor/lib/canvas-layer-insets.test.ts`, `apps/editor/components/plan/MaximisedPlanLayer.test.tsx`                                                    |
| Zoom off while the canvas is covered                           | `apps/editor/components/chrome/ZoomControls.test.tsx`                                                                                                       |
| Five slots across a maximised board                            | `apps/editor/components/plan/plan-board-columns.test.ts`                                                                                                    |
| Option list roles, keys, menu items                            | `apps/editor/components/plan/OptionRows.test.tsx`                                                                                                           |
| Custom assignee: offered when editable, made, reused, roles    | `apps/editor/components/plan/PersonPicker.test.tsx`, `packages/items/src/plan-people.test.ts`                                                               |
| Cards push skips custom assignees                              | `apps/api/src/plan-room/plan-outbox.test.ts`                                                                                                                |
| Edge auto-scroll math and drag wiring                          | `apps/editor/hooks/plan/edge-auto-scroll.test.ts`                                                                                                           |
| Map hidden while covered                                       | `apps/editor/components/canvas/view-readers.minimap.test.tsx`                                                                                               |
| Cover store: re-renders only on a change                       | `apps/editor/hooks/plan/plan-cover-store.test.tsx`                                                                                                          |
| Palette offers only Cards, then restores                       | `apps/editor/hooks/plan/plan-cover-store.test.tsx`                                                                                                          |
| Palette hidden for a filling Sheet; restore pick               | `apps/editor/hooks/plan/plan-cover-store.test.tsx`                                                                                                          |
| The name rides in the menu box                                 | `apps/editor/components/plan/menu-name-slot.test.tsx`, `apps/editor/lib/canvas-layer-insets.test.ts`                                                        |
| The Plan strip shows only with cards to show                   | `apps/editor/hooks/sheets/card-table-sheets.test.ts`                                                                                                        |
| No selection chrome over a covered canvas                      | `apps/editor/lib/canvas-selection.test.ts`, `apps/editor/hooks/canvas/useCanvasSelectionView.covered.test.ts`                                               |
| Nothing under a covered canvas moves                           | `FilledTabLayer.test.tsx`, `apps/editor/hooks/canvas/useEditorKeyboardShortcuts.dom.test.tsx`, `apps/editor/hooks/canvas/useCanvasSurfaceGestures.test.tsx` |
| No Status swimlanes on a board (All Cards aside)               | `board.test.ts`, `apps/editor/components/palette/PlanBoardMenuSection.test.tsx`                                                                             |
| Filled layer, maximise released, no Escape                     | `apps/editor/components/plan/FilledTabLayer.test.tsx`                                                                                                       |
| Fill Tab normalised and patched                                | `board.test.ts`, `packages/project/src/plan-board-patch.test.ts`                                                                                            |
| Column picker combobox, rows, keys, Add All                    | `apps/editor/components/plan/AddColumnPicker.test.tsx`                                                                                                      |
| Suggested statuses: which, order, place, left out, cap         | `packages/items/src/suggested-statuses.test.ts`, `apps/editor/components/plan/setup-board.test.ts`                                                          |
| Suggestions in Setup Board and the picker; Viewer sees none    | `apps/editor/components/plan/SuggestedStatusList.test.tsx`, `apps/editor/components/plan/BoardColumnsSection.test.tsx`                                      |
| Columns section: list, open, add, place, tint, cap             | `apps/editor/components/plan/BoardColumnsSection.test.tsx`, `apps/editor/components/palette/PlanBoardMenuSection.test.tsx`                                  |
| Column toolbar: order, ends, move                              | `apps/editor/components/plan/PlanColumnPopover.remove.test.tsx`                                                                                             |
| Picker adds an existing status's column                        | `apps/editor/components/plan/PlanColumnHeader.test.tsx`                                                                                                     |
| Factory, validation, size, labels                              | `packages/project/src/plan-shapes.test.ts`                                                                                                                  |
| SVG render with and without items                              | `plan-shapes.test.ts`, `svg-render-coverage.test.ts`                                                                                                        |
| Projection: columns, rows, unplaced, filter                    | `packages/items/src/board.test.ts`                                                                                                                          |
| Drop moves, between boards, refusals                           | `apps/editor/components/plan/plan-board-moves.test.ts`                                                                                                      |
| Keyboard moves and their announcement                          | `apps/editor/components/plan/plan-board-keys.test.ts`                                                                                                       |
| New card types, deleted-type fallback                          | `packages/items/src/archive.test.ts`                                                                                                                        |
| Face-down and votes spent                                      | `packages/items/src/board.test.ts`                                                                                                                          |
| Plan templates' boards                                         | `apps/editor/lib/template-boards.test.ts`                                                                                                                   |
| Card trail steps, cut-back, cap; children                      | `apps/editor/components/plan/item-trail.test.ts`                                                                                                            |
| Linked as rows, empty state, open                              | `apps/editor/components/plan/LinkedCards.test.tsx`                                                                                                          |
| Breadcrumb back bar, step back                                 | `apps/editor/components/plan/ItemTrailCrumbs.test.tsx`                                                                                                      |
| Phone look: Minimal, no widgets, columns, touch                | `apps/editor/components/plan/phone-board.test.ts`, `plan-board-columns.test.ts`                                                                             |
| Simplified in a Dashboard slot, whole maximised, restored      | `apps/editor/components/plan/PlanBoardView.dashboard.test.tsx`                                                                                              |
| Slot board: compact parts, roles, lanes off, card size         | `PlanBoardView.dashboard.test.tsx`, `slot-board.test.ts`, `plan-board-columns.test.ts`, `phone-board.test.ts`                                               |
| Phone's shared top row                                         | `apps/editor/lib/canvas-layer-insets.test.ts` (`phoneRow`)                                                                                                  |
| Empty widget zone keeps its + in a band                        | `apps/editor/components/plan/widgets/BoardWidgetZone.test.tsx`                                                                                              |
| Dashboard Settings steps aside while maximised                 | `apps/editor/components/plan/dashboard/DashboardSettings.test.tsx`                                                                                          |
| Maximise, restore, Escape, unmount ends it                     | `apps/editor/hooks/plan/maximised-plan.test.ts`                                                                                                             |
| No remount, maximised size, one Escape                         | `apps/editor/components/plan/MaximisedPlanLayer.test.tsx`                                                                                                   |
| Card type chips: roles, phone, Archive, slot, labels, click    | `apps/editor/components/plan/card-type-chips.test.ts`, `BoardCardTypeChips.test.tsx`                                                                        |
| Card type chip drag: placeholder, refusal, drop, Escape        | `apps/editor/hooks/plan/useCardTypeDrag.test.tsx`                                                                                                           |
| Card address: hash, link, mark, deep link reads it             | `apps/editor/lib/card-address.test.ts`                                                                                                                      |
| Card address: push, back, replace, arrive, Back/Forward        | `apps/editor/app/project/[id]/useCardAddress.test.tsx`                                                                                                      |
| Capture stops at hydration; tab pin keeps the mark             | `apps/editor/app/project/[id]/useCollabDeepLink.test.tsx`, `useTabEntryEffects.test.tsx`                                                                    |
| Copy Card Link: every role, before Help; toasts                | `apps/editor/components/plan/ItemPanelMenu.test.tsx`, `copy-card-link.test.ts`                                                                              |
| Drag, Add card, card menu, item panel                          | checked by hand against the dev stack (screenshots in the PR)                                                                                               |

## Constants and configuration

| Constant                   | Value              | Provenance / safe range                                                     |
| -------------------------- | ------------------ | --------------------------------------------------------------------------- |
| `CANVAS_LAYER_Z`           | `--z-panel` − 1    | Over the canvas, under its panels                                           |
| `MAXIMISED_BOARD_SLOTS`    | 5                  | DEFAULTS; slots across a maximised board before it scrolls; 3-8             |
| `PHONE_COLUMN_PEEK_PX`     | 48                 | DEFAULTS D44; the next column's peek on a phone, gap included; 32-80        |
| `PHONE_END_CLEARANCE`      | 8.5rem + safe area | DEFAULTS D45; the phone's bottom controls over a covering board; 6-10rem    |
| `PHONE_COVER_PAD_PX`       | 8                  | CanvasCover's p-2 on a phone                                                |
| `PHONE_ROW_MIN_PX`         | 160                | DEFAULTS D46; a short title and Restore and the cog; 120-220                |
| `EDGE_SCROLL_ZONE_PX`      | 56                 | DEFAULTS; capped at a quarter of the viewport; 32-96                        |
| `EDGE_SCROLL_MAX_PX`       | 18                 | DEFAULTS; px per frame at the edge; 8-30                                    |
| `EDGE_SCROLL_REDUCED_PX`   | 6                  | DEFAULTS; constant under reduced motion; 3-10                               |
| `WIDE_PANEL_SHARE`         | 0.6                | Side panels are 18-24rem; a sheet spans most of a phone; 0.5-0.8            |
| `MAX_INSET_SHARE`          | 0.45               | The element keeps at least 10% per axis; 0.3-0.45                           |
| `PRESS_DRAG_SLOP_PX`       | 4                  | Shared, ../packages/workbench/src/lib/press-gestures.ts                     |
| `PLAN_COLUMN_MIN_PX`       | 220                | A card's title reads in 3 lines; 180–320                                    |
| `SLOT_COLUMN_MIN_PX`       | 160                | DEFAULTS D57; a slot board's narrowest column; 140-200                      |
| `SLOT_COLUMN_PEEK`         | 0.4                | DEFAULTS D59; the next column's share at a too-narrow slot's edge; 0.25-0.6 |
| `SLOT_COLUMN_GAP_PX`       | 8                  | A slot board's `gap-2` between columns                                      |
| `PLAN_COLUMNS_MAX`         | 12                 | Spec                                                                        |
| `CHIP_NAMES_MAX`           | 3                  | Spec ("more than three types" drop their names); 2-5                        |
| `CHIP_GHOST_HEIGHT_PX`     | 56                 | A Minimal card's height, the placeholder a carried chip opens; 40-80        |
| `BOARD_SORT_LEVELS_MAX`    | 2                  | Spec (Work Tracker #18): Sort By and Then By                                |
| `SUGGESTED_STATUSES_MAX`   | 5                  | Spec ("up to five"); the list `SUGGESTED_STATUSES` holds exactly five       |
| `ITEM_EDIT_DEBOUNCE_MS`    | 400                | One undo step per pause in typing                                           |
| `CUSTOM_ASSIGNEE_NAME_MAX` | 60                 | Spec; a name on one line of the picker; 30-120                              |
| `ITEM_TRAIL_MAX`           | 8                  | Spec; bounds the trail's memory; 2–20                                       |
| `FIT_GLIDE_MS`             | 420                | Spec ("about 420 ms"); `hooks/canvas/useEditorViewport.ts`                  |
| `FOCUS_ZOOM_MAX`           | 1.5                | Spec (150%); `useEditorState.ts`                                            |

- New cards open: `PlanContextValue.openNewItem(id, via?)` (usePlanSlice) opens the card and records it as
  `freshItemId`; `openItem` and `closeItem` clear it. Callers mint the id (`newItemId()`) and pass it to
  `addItem`: Add Card (PlanBoardView), a chip's click (BoardCardTypeChips), a chip's drop through the target's
  `addCard` (usePlanBoardDrop), New {Type}
  (PlanSheetsHost `onAddLinked`). PlanSheetsHost passes `fresh={freshItemId === item.id}` to ItemPanel, whose
  `useTitleFocus` (desktop and `canEdit` only, a frame after the Dialog's `initialFocus="container"` trap)
  focuses the title input with the caret at its end, or selects it when `fresh`.
