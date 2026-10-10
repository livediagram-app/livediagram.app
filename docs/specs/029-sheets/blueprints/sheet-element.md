# Sheet element blueprint

Derived from [Sheet](../sheet.md). Implementation contract for the `plan-sheet` element: its document model, the
Sheet palette category (under the Spreadsheets band), placement, Setup Sheet, the canvas and static renders, the editor components and hooks, maximise,
presence, CSV, telemetry and help. The model and pure behaviour are the engine's
([sheets-engine](sheets-engine.md)); the data is the store's ([sheet-store](sheet-store.md)).

## Domain and naming

| Spec term      | Identifier                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Sheet element  | `ShapeElement` with `shape: 'plan-sheet'` and `planSheet: PlanSheetRef`                                  |
| `PlanSheetRef` | `{ sheetId: string }` (`packages/document/src/element-types.ts`)                                         |
| Spreadsheets   | the palette band heading (`group: 5`, `PaletteTabBar.tsx`)                                               |
| Sheet category | palette category id `plan-sheets`, label `Sheet`                                                         |
| Sheet tile     | tile id `plan:sheet`, label `Add Sheet`, caption `Sheet`, action `{ type: 'shape', kind: 'plan-sheet' }` |
| the grid       | `SheetGrid` (component), `GridWindow` (visible rows and columns)                                         |
| selection      | engine `Selection`; editor `SheetController.selection` (`sheet-controller.tsx`)                          |
| card table     | `CardTable` in `layout.cardTables` (sheets-engine blueprint)                                             |
| Fill Tab       | `planSheet.fillTab: true`; `FillTabKind` `'Sheet'` (`components/plan/fill-tab.ts`)                       |
| maximised      | `MaximisedKind` `'Sheet'`                                                                                |

## Document model (`packages/document`)

- `shape-kind.ts`: `ShapeKind` adds `'plan-sheet'`; `validate.ts` known kinds list adds it.
- `element-types.ts`: `planSheet?: PlanSheetRef` on `ShapeElement`; `PlanSheetRef = { sheetId; copyOf?; fillTab?: true }`
  beside `PlanViewRef`; the kind in `UNTYPED_SHAPES`.
- `validate-shape.ts`: rule `{ field: 'planSheet', valid: isPlanSheetRef }` (`isPlanSheetRef` in `element-types.ts`:
  `sheetId` matches `SHEET_ID_PATTERN`, duplicated as a local regex to avoid importing the engine into the document
  package; `copyOf` likewise; `fillTab` absent or `true`; no other keys).
- `chart-source.ts`: `ChartSource` (a chart element's `chartSource`: the sheet and the range by row and column ids),
  `isChartSource`, `chartFieldsFromTable`, `relinkCopiedCharts` and `copiedSheetId` (a chart copied with its Sheet
  reads the copy).
- `element-fields.ts`: known field `planSheet`.
- `shape-factory.ts`: `SHAPE_DEFAULT_SIZE['plan-sheet'] = { width: 960, height: 560 }`; `createShape` leaves
  `planSheet` to the caller (it needs a store id).
- `data-shapes.ts` `isPlanShape`, `colors.ts` `SELF_PAINTING_SHAPES`, `session.ts` `NON_VOTABLE_SHAPES`,
  `svg-render-describe.ts` label exclusion, `element-kind-label.ts` `SHAPE_LABELS['plan-sheet'] = 'Sheet'`.
- `packages/edit-operations/src/element-format.ts`: `'plan-sheet': ['planSheet']`.
- `packages/document-views/src/content-summary.ts`: `case 'plan-sheet'` → `Sheet "<title>"` when a title source is
  given, else `Sheet`.
- `remint-element-ids` (apps/live, Duplicate Tab and paste): a `planSheet` is reminted to a new sheet id with a
  `copyOf` create queued (sheet-store blueprint "Editor slice").

## Palette (`apps/live`)

- `palette-tile-defs.tsx`: category union adds `'plan-sheets'`; `palette-categories.tsx` entry `{ id: 'plan-sheets',
label: 'Sheet', group: 5 (the band headed "Spreadsheets" in `PaletteTabBar.tsx`), description: 'A spreadsheet tab: cells, formulas, formatting, sort and filter,
worked on like a board.', icon: <SheetArt size={18} /> }` after `plan-visualisations`.
- `palette-layouts.ts`: the Plan layout's categories add `{ id: 'plan-sheets' }` after Visualisations.
- `whiteboard-shape-catalogue.ts` `EXCLUDED_CATEGORIES` adds it.
- `components/palette/palette-plan-sheet-tiles.tsx`: `PLAN_SHEET_TILES = [{ id: 'plan:sheet', section:
'plan-sheets', label: 'Add Sheet', caption: 'Sheet', ..., action: { type: 'shape', kind: 'plan-sheet' }, icon: <SheetArt size={18} /> }]`,
  spread into `PLAN_TILES`. `SheetArt` (`components/sheets/sheet-art.tsx`, main bundle) is a small grid with a
  filled header row and one cell ringed, on the 22-unit grid of the other Plan glyphs.
- `palette-tile-keywords.ts`: `plan-sheet`: `spreadsheet sheet excel google sheets table grid cells formula budget
csv`.
- Placement: `draw-commit.ts` and `useElementCreation.ts` call `placeNewSheet()` (`lib/sheet-seeds.ts`): a new
  sheet id, the element with `planSheet: { sheetId }`, the placement remembered. `useSheetModel` takes it
  (`takePlacedSheet`) as the Sheet first draws and makes the store `create` with `title: nextSheetTitle(titles)`
  (`Sheet N`, or the CSV's file name made unique) and an empty 100 × 26 layout, with `setupPending: true` unless it
  came with a CSV (optimistic: the store has the sheet at once).
- Telemetry `element-telemetry.ts` `SHAPE_TOKENS['plan-sheet'] = 'PlanSheet'`; `telemetry-schema.ts`
  `PALETTE_TELEMETRY_TYPES` adds `PlanSheet`.

## Canvas render routing

- `ShapeContentRouter.tsx`: `PlanSheetView = dynamic(() => import('@/components/sheets/PlanSheetView'))`, branch
  `element.shape === 'plan-sheet'`.
- `shape-svg-overlay.tsx` box overlay exclusion, `canvas-selection.ts` no quick-connect, `ElementDataSections.tsx`
  no data section (Sheet Settings holds it).

## Editor components (`apps/live/components/sheets/`, the lazy chunk)

```
PlanSheetView.tsx        the element body: model, controller, MaximisableSlot, faces, the Switch to Plan hint,
                         Import CSV, focus tracking, the Setup Sheet card while setupPending; lays out header /
                         toolbar / formula bar / grid / status bar
SheetFace.tsx            the frame: loading (SheetBuildAnimation, "Opening Sheet", LoadingSweep), or skeleton grid
                         lines with Couldn't load (Try Again) or not found (Remove)
SheetHeader.tsx          title (in-place edit), FocusElementButton kind="Sheet", MaximisePlanButton kind="Sheet"
                         (neither while the Sheet fills its tab), the Sheet Settings cog (plan/SettingsCog.tsx, shared
                         with BoardSettingsButton)
SheetMenuSection.tsx     The element menu's Sheet flyout: SheetSettingsPanel with the Sheet's controller, read from
                         sheet-settings-registry.ts (usePublishSheetSettings in PlanSheetView, useSheetSettingsEntry)
SheetSettingsPanel.tsx   Sheet Settings' sections (BoardSettingsSection): Sheet Setup, Sheet Options (with Fill Tab's
                         OptionRows), Cells, Freeze (editors), Calculations, Named Ranges (SheetNamedRanges.tsx); options through actions.setOptions (LayoutChange
                         k 'options')
SheetSetup.tsx           Setup Sheet: the SetupCard wizard (Start From, Cards, Columns, Style), Create Sheet as one
                         write that ends setupPending
SheetSetupStart.tsx      Start From's option list, and Plan Cards' Cards (CardSearchControls) and Columns steps
                         (columnsForCards, CARD_COLUMNS_REQUIRED)
SheetSetupStyle.tsx      Style's looks (LOOKS, drawn previews), Cell Size and Freeze Header Row
SheetColourSwatches.tsx  Text Colour's and Fill Colour's toolbar swatches (TOOLBAR_SWATCHES) and the full picker
SheetMergeConfirm.tsx    the merge confirm, shared by the toolbar and the cell menu
sheet-charts.ts          Insert Chart: chartRangeOf (selection, or regionAround one cell), placeSheetChart (a chart
                         element with chartSource, through bridge.placeElement), SHEET_CHART_KINDS
SheetLinkedChart.tsx     a chart with chartSource: reads sheetChartTable live from the store (sheetStoreOf) and draws
                         through canvas/DataChartView; ticks the last read onto the element (bridge.tickElements)
card-table-sync.ts       card tables: pullChanges (cards to rows) and pushPlan (a write to patches, new cards, trash),
                         reading field names through items' resolveFields / resolveType
useCardTableSync.ts      runs them while the Sheet is drawn: pull quietly (undoable: false), push via the
                         controller's onWrote, linking a new row's card with a cardTable change
SheetCardRows.tsx        a card table's draft tint, Open Card / Save / Cancel strip, and the active cell's dropdown
card-field-options.ts    cardFieldChoice: a column's set values (Type, State, Priority, Assignee, choice) or a date
SheetBordersPicker.tsx   the Borders menu: a 4 x 2 grid of drawn borders and drawn line swatches
sheet-rename.ts          renameSheet: trim, unchanged, unique on the tab (TITLE_TAKEN toast); header and settings
sheet-status-pick.ts     the viewer's totals pick (localStorage, useSyncExternalStore), status bar and settings
SheetToolbar.tsx         the category switcher (PaletteDropdown) and the category's buttons, labelled when they
                         all fit (never on a phone), folding into More when narrow (TOOLBAR_PX)
sheet-toolbar-categories.tsx the six categories (Text, Cells, Numbers, Data, Charts, Functions) and their
                         buttons
SheetToolbarMenus.tsx    number format, colours, font size, borders, merge (with its confirm), alignment, wrap,
                         sort, freeze, functions, more
SheetFreezeRows.tsx      Freeze's rows, in the toolbar's Freeze menu
SheetFormulaBar.tsx      name box + fx (edits through useFormulaInput, as the cell editor does)
SheetGrid.tsx            the scroll container, sticky viewport, keys (sheet-keys.ts), overlays, Add Rows footer
SheetCells.tsx           the visible cells in four regions (frozen corner, rows, columns, body), overflow, fit
SheetHeaders.tsx         column letters and row numbers, selection tint, unhide arrows
SheetSelectionLayer.tsx  selection, fill handle, copy and cut marquee, reference / presence / Find outlines,
                         peer name tags, filter buttons
SheetCellEditor.tsx      in-place editor (textarea + coloured overlay), FunctionAssist (list and argument hint),
                         parse error line
SheetMenus.tsx           header menus (with Resize…), the filter menu and the Sort Range dialog
SheetCellMenu.tsx        the cell menu: MenuHeader (the selection, its cell count), a MenuToolbar (Cut, Copy, Paste,
                         Paste Values, Clear Contents, Clear Formatting), plain MenuActionRows grouped by
                         MenuGroupSeparator (insert either side, delete, merge or unmerge) and plain
                         MenuFlyoutSections (Sort, Shift Cells, Hide, Paste Special, Insert Chart)
sheet-cell-menu-labels.ts the rows' words for a selection (cellMenuLabels: "Insert 3 Rows Above", "Delete Columns B to C")
SheetFindBar.tsx         Find and Replace
SheetStatusBar.tsx       Sum / Average / Count / Min / Max of the selection (the pick is the viewer's)
SheetAddRows.tsx         Add [100] more rows at the bottom
sheet-controller.tsx     the controller in context: selection (and selectionNow), editing, scroll, menus, focus,
                         write (telemetry), Tab runs, kept selections
sheet-geometry.ts        offsets, hit testing, windows, reveal
sheet-keys.ts            the keyboard map (the spec's table) as commands
sheet-pointing.ts        the formula being written, for pointing from another Sheet of the tab
sheet-csv.ts             CSV text out (Download CSV, through lib/download-blob.ts) and in (Import CSV, a dropped file)
sheet-store-client.ts, sheet-presence-store.ts (sheet-store blueprint)
sheet-icons.tsx, sheet-art.tsx (toolbar glyphs; the palette tile's art)
hooks: useSheetModel.ts, useSheetActions.ts (every command), useFormulaInput.ts, useSheetPointer.ts,
useSheetClipboard.ts, useFollowLayout.ts (edits and selections follow rows others move)
```

Beside it, in the main bundle:

```
hooks/sheets/useSheetsBridge.ts      the bridge
hooks/sheets/useSheetCsvDrop.ts      a CSV dropped on the canvas in Plan mode
lib/sheet-seeds.ts                   placed sheets (placeNewSheet, takePlacedSheet) and clipboard seeds
lib/download-blob.ts                 downloadBlob, the shared file save (Download CSV)
components/plan/FocusElementButton.tsx  Focus in a board's or Sheet's header (plan-board blueprint "Focus")
components/plan/SetupCard.tsx        the setup card and wizard stepper Setup Board and Setup Sheet share
components/plan/CardSearchControls.tsx  the Cards panel's search and field filters (useCardSearch), reused by
                                     Setup Sheet's Cards step
components/plan/fill-tab.ts          Fill Tab for boards and Sheets: fillTabElementOf (the first filling board or
                                     Sheet, with its FillTabKind), fillTabSheetElements, unfillSheetElements
hooks/plan/useFocusNewPlanElement.ts a board, view or Sheet just added is glided into view (isFocusedOnAdd)
hooks/canvas/useCanvasFocus.tsx      the canvas's Focus (CanvasFocusProvider), read by FocusElementButton
components/primitives/NumberStepper.tsx  the − / + number field (the toolbar's Font Size)
components/canvas/DataChartView.tsx  a chart drawn from a table (SheetLinkedChart draws through it)
```

In packages: `packages/document/src/chart-source.ts` (above), `packages/items/src/card-source.ts` (`builtInFieldOf`,
`isCardDateField`: card field names as the card functions read them), `packages/ui/src/SheetBuildAnimation.tsx`
(the loader's table filling in), `packages/ui/src/build-animation-kit.tsx` (the cursor, easing and loop phase it
shares with DiagramBuildAnimation) and `packages/ui/src/LoadingSweep.tsx` (the progress sweep).

### Setup Sheet

- `layout.setupPending` (sheets-engine blueprint) marks a sheet awaiting setup. `PlanSheetView` shows `SheetSetup`
  in place of the grid while it is set, the sheet has no cells, Plan mode is on and the person may edit; any cell
  arriving clears it (`{ k: 'options', setupPending: false }`), and Sheet Settings' **Setup Sheet** sets it again.
- Create Sheet builds the start's starter (`sheetStarter`, or `cardsStarter` for Plan Cards) and writes it with the
  look, freeze and sizes through the engine's `setupWrite`, as one change; Clear Sheet (`useSheetActions`) writes
  `resetSheetWrite`. Telemetry `Sheet · Created · <Start>`.

### Layout

- Header 40 px; toolbar 44 px (36 px buttons, 20 px glyphs, so they read at the canvas's zoom); formula bar 28 px (to 3 lines); status bar 24 px (only with a multi-number
  selection); grid takes the rest. Not in Plan mode or without edit: no toolbar, the formula bar read-only (still
  shown in Plan mode), no status bar actions.
- The grid is a scroll container (`overflow: auto`, `overscroll-behavior: contain`) whose inner size is the sum of
  visible row heights × column widths; frozen rows and columns are drawn in sticky panes (top, left, corner).
- `visibleWindow(geometry, scroll, view)` (`sheet-geometry.ts`) binary-searches the offset prefix sums (rebuilt on
  layout change) for the first and last visible row and column. Only those cells render.
- Cells are absolutely positioned `div`s (`role="gridcell"`), text in the tab's font at the cell's size; wrapped
  cells use `white-space: pre-wrap`; overflow runs are drawn by giving a left-aligned text cell a width spanning
  its empty neighbours (computed per row from the window).
- Canvas zoom: the element's body is inside the canvas transform; pointer to cell maps `clientX/Y` through the
  grid's `getBoundingClientRect` and `scale = rect.width / offsetWidth`.

### Input by mode

- `interactive = plan.planInput` (Plan mode) as boards; `canEdit` from the bridge. Not interactive: the grid's
  `pointer-events: none`, so the element moves and selects as any; a double-click opens the hint popover
  ("Switch to Plan to edit this sheet", **Switch to Plan** calls `bridge.switchToPlan()`).
- In Plan mode the header drags the element (as the board header); the grid takes pointer and wheel (wheel
  `stopPropagation` while the grid can scroll that way, else the canvas pans).

### Keyboard and focus

- The grid has one tab stop: the grid container (`tabIndex=0`, `role="grid"`, `aria-rowcount`, `aria-colcount`,
  `aria-activedescendant` the active cell's id, `aria-multiselectable`). Keys while it has focus go through
  `sheetKey` (`sheet-keys.ts`, the spec's table), and the grid stops propagation so canvas shortcuts do not fire;
  Escape ends the copy marquee, then Find, then restores a maximised sheet, then (nothing else open) blurs to the
  canvas with the element selected (`bridge.selectElement`). Commands act on `selectionNow()`, the selection as
  last set, so a key pressed in the frame after a drag acts on the dragged range.
- The canvas's Undo/Redo are called (not re-implemented) for Ctrl+Z / Shift+Z / Y.
- Editing focuses `SheetCellEditor`: a textarea with a coloured overlay, for predictable caret handling.
- Announcements through the editor's live region: the active cell on move ("B4, 1,250.00"), "Copied 3 by 4
  cells", "Sorted A to Z", "Row 5 inserted".

### Pointer

- `useSheetPointer`: down on a cell selects (Shift extends, Ctrl/⌘ adds); drag extends with auto-scroll at the
  edges (`AUTOSCROLL_EDGE_PX`, speed by distance); down on the fill handle starts a fill drag; on headers selects
  axes or, near an edge (`RESIZE_HIT_PX`), resizes; down inside a selected header range and moved past
  `DRAG_START_PX` moves the rows/columns; down on the frozen edge's bar in the headers (within `FREEZE_GRAB_PX`)
  drags the freeze to the nearest line (up to the freeze limits); down while editing a formula at a
  reference-able caret inserts a reference (and drags extend it); down on a cell while another Sheet of the tab is
  writing a formula (`sheet-pointing.ts`) puts this sheet's reference, sheet-qualified, in that formula and hands
  the caret back to it. Window listeners for a drag are stable functions calling the render's handlers.
- Panning (`useSheetPan.ts`, `PAN_START_PX` 4): `useSheetPointer`'s press hands it the middle button, the right
  button (pans once it moves; `rightPending` / `afterRightClick` hold the menu until an unmoved release), the left
  button with Space held (`onKeyDown` / `onKeyUp` in SheetGrid; an unused Space types a space on release), and one
  finger while not maximised (a second finger ends
  it for the pinch; `swallowClick` drops the tap that follows a pan). Maximised, a finger scrolls natively.
- Touch: a tap selects a cell; a double-tap edits.

### Commands

`useSheetActions()` (on the sheet controller, `useSheetController()`) maps every toolbar button, menu row and shortcut
to an engine command builder (`commands.ts`) and then the controller's write (`store.write`, plus `track('Sheet',
'Changed', kind)`); e.g. `bold()` → `formatRange(sel,
{ b: !activeBold || null })`; `insertRowsAbove(n)` → layout `insertRows` after the row above with new ids;
`sortColumn(dir)` → `sortSheetRows`; `merge('all')` → layout `merge` plus cleared cells after a confirm when any
non-top-left cell holds an input.

### Clipboard

- `useSheetClipboard` listens to `copy`, `cut`, `paste` events on the grid (not the canvas's): writes
  `text/plain` and `text/html` with `event.clipboardData`, plus the sheet clip under the custom type; also keeps the
  clip in a module variable, used when the custom type is unavailable and the plain text still matches it.
- Paste Values Only uses `navigator.clipboard.readText()` (or the last clip); Paste Formatting Only uses the clip.

### Maximise

- `hooks/plan/maximised-plan.ts`: `MaximisedKind = 'Board' | 'View' | 'Sheet'`.
- `PlanSheetView` uses `useBoardMaximised(element.id, interactive)` → `{ maximised, filled }` (the store's maximise and
  its lifetime, ended when the Sheet fills its tab), `MaximisableSlot` (the whole body, `fill={filled}`, with
  `onMaximisedSize` so the grid window follows the overlay's size) and `MaximisePlanButton kind="Sheet"` in the
  header.
- Escape order inside the grid: close a menu or the Find bar, else cancel the edit, else (nothing open)
  `restorePlanElement()` when maximised, else blur. The grid handles Escape before the layer's own Escape listener
  (it stops propagation when it consumed it).
- `apps/telemetry/app/computed-emitters.ts` and `apps/telemetry/app/catalogue/content.ts` add `SheetMaximised` and `SheetRestored`.

### Fill Tab

- Stored as `planSheet.fillTab: true` (validated by `isPlanSheetRef`). `fill-tab.ts`: `fillTabElementOf(elements)`
  returns the first board or Sheet in element order with Fill Tab on, with its `FillTabKind` (`'Board' | 'Sheet'`);
  `fillTabSheetElements(elements, id)` sets it and drops every other element; `unfillSheetElements(elements, id)`
  clears it.
- `usePlanCoverWiring` publishes `{ fillTabId, fillTabKind, tabElementCount }` to `plan-cover-store.ts`; `useFillsTab(id)`
  reads whether an element fills its tab.
- `usePlanFillTab().fillTabSheet(sheetElementId, on)` commits either as one change and one undo step.
- Sheet Settings' Sheet Options holds Fill Tab as `OptionRows` (**On Canvas**, **Fill Tab**, the hint `SHEET_FILL_TAB_HINT`);
  turning it on with other elements on the tab asks `fillTabConfirm` first. Telemetry `Plan · Toggled ·
SheetFillTabOn` / `SheetFillTabOff`.
- Filled: `useBoardMaximised` gives `filled`, the slot draws over the canvas area, `SheetHeader` hides Focus and
  Maximise (`useFillsTab`), and Escape does not restore.

### Focus

- `FocusElementButton kind="Sheet"` in the header (left of Maximise) calls the canvas's Focus (`useCanvasFocus`); the
  glide is the plan-board blueprint's (**Focus** in [Behaviour and state](../../026-plan/blueprints/plan-board.md#behaviour-and-state)). A Sheet just placed is
  glided into view by `useFocusNewPlanElement`, and the phone's scroll-into-view of a new element skips it
  (`isFocusedOnAdd`).

### Card tables

- `card-table-sync.ts`: `pullChanges` (cards to rows, a date field written as a date serial) and `pushPlan` (a row's
  write to card patches, new cards and trash), field names resolved through `builtInFieldOf` / `isCardDateField`
  (`packages/items/src/card-source.ts`). A cleared Type, Title or State cell is skipped (`KEPT_WHEN_CLEARED`): the
  card keeps its value and the next pull writes it back.
- `saveCardRow` (`useCardTableSync.ts`) is async: it resolves only once the card write lands, and a row already saving (a module `saving`
  set, keyed by sheet, table and row) is refused, so a second Save while one is on its way does nothing. A refused
  write keeps the row a draft, with the spec's toast.
- `useCardTableSync` runs while the Sheet is drawn, for someone who may edit: pulls quietly (`undoable: false`),
  pushes through the controller's `onWrote`, and links a new row's card with a `cardTable` change.
- Deleting rows or columns prunes the tables in the engine (`store-layout.ts`, `deleteRows` / `deleteCols`), and the
  inverse puts the deleted rows' links and drafts back into each table as it is at the undo
  (`store-inverse-delete.ts`), so Undo keeps links and drafts made since.
- Draft ownership: a module `ownDrafts` set (`sheet:table:row`) records the drafts this client's own writes made
  (`setPush`); only those are checked against their card's revision, so the "changed elsewhere" put-back runs on
  the drafting client alone. Save (once it lands) and Cancel forget the key.
- `pushPlan` reads a write's cells top to bottom; `tableOfRow` takes a row directly under the header, a linked row,
  a draft row, or a row this write already drafted into the table.
- `SheetCardRows`: the draft tint and the Save / Cancel strip (`STRIP_PX`, in the Controls column when there is one)
  draw for someone who may edit; Open Card in Plan mode; the active cell's dropdown (`cardFieldChoice`,
  `card-field-options.ts`) for an editor. On a date field the arrow calls `openDatePicker` on a hidden `DateInput`
  (`@livediagram/ui`) laid over the cell, and a picked day before `DATE_YEAR_MIN` (1900) is dropped. Nothing is
  drawn over the frozen rows or columns a row has scrolled under.

### Charts

- `sheet-charts.ts`: `chartRangeOf` (the selection's last range, or `regionAround` a single cell; nothing to chart says
  `NOTHING_TO_CHART`) and `placeSheetChart` (a chart element with `chartSource`, through `bridge.placeElement`).
- `SheetLinkedChart` reads `sheetChartTable` live from the store and draws through `canvas/DataChartView`; the read it
  keeps on the element is made in `AGENT_LOCALE` (en-GB) and ticked on quietly (`bridge.tickElements`), while the
  person sees a read in their own locale, so editors in different locales never rewrite it.

### Headers and status bar

- `SheetHeaders` draws the unhide markers between the neighbours of hidden lines even with headers hidden (at the
  grid's own edge then), so hidden lines can always come back.
- The status bar's totals pick opens in the shared `AnchoredPopover` (`STATS_MENU_PX` wide).

### Presence

- `SheetPresence` (`sheet-presence-store.ts`, one per store through `sheetPresenceFor`) sends `sheet-presence` on
  selection change (throttled `PRESENCE_THROTTLE_MS`) and on edit start and end, `null` on blur or unmount; hears
  others', which `SheetSelectionLayer` draws as outlines and name tags (tag hidden after `PEER_TAG_MS` still). Re-sends on a newcomer and on rejoin as `usePlanPresence` does.

### Find

- `SheetFindBar` over the grid's top right: input, count "3 of 12", previous/next, Match Case, Match Entire Cell,
  Also Search Formulas, Replace with, Replace, Replace All; highlight matches in the window; `track('Sheet',
'Opened', 'Find')`.

### CSV

- Sheet Settings **Import CSV…**: `<input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values">`, read as text
  (UTF-8, BOM stripped), `parseCsv`, then Replace Sheet (a write clearing the filled range then the cells) or Insert
  at Selection, split into writes; toast when truncated; `track('Sheet', 'Imported', 'Csv')`.
- Canvas drop: the editor's file drop handler, in Plan mode, for `text/csv` / `.csv`, places a sheet at the drop
  point with the file's cells (title: file name without extension, made unique).
- Sheet Settings **Download CSV**: `toCsv` of displayed values up to the filled extent, saved through the shared download helper
  as `<title>.csv`; `track('Sheet', 'Exported', 'Csv')`.

## Static render (exports, thumbnails, images)

- `packages/document/src/svg-render-plan-sheet.ts`: `svgPlanSheet(el, model: SheetRenderModel | undefined, surface)`
  draws the header (title), column letters, row numbers, grid lines and each cell's display text with its format
  (bold, italic, colours, alignment, borders, merges), clipped to the element; no model → the header and an empty
  grid. `SheetRenderModel` is a structural type defined in `packages/document` (the engine's `renderWindow`
  returns it), passed as `opts.sheets: ReadonlyMap<sheetId, SheetRenderModel>`.
- Callers build the models: live export (`lib/export` dynamically imports the engine and the store's sheets),
  `apps/api/src/thumbnail.ts` and `apps/mcp/src/image-result.ts` (load the tab's sheets and, when a card function
  is used, the items).

## Presentation and UX

- Empty sheet: the grid with nothing in it; no extra empty state.
- Loading: `SheetFace` with `loading`: the header with the title (from the store when known, else "Sheet"), then
  `SheetBuildAnimation`, **Opening Sheet** and `LoadingSweep` centred in the grid area (`role="status"`); reduced
  motion shows the finished table, still.
- Error loading: `SheetFace` over skeleton grid lines, "Couldn't load this sheet" with **Try Again**.
- Not found: `SheetFace` over skeleton grid lines, "This sheet is no longer in this document", **Remove** for
  editors.
- Final copy is the spec's; toolbar tooltips are Title Case ("Fewer Decimals", "Merge Cells").

## Accessibility

- Grid semantics as above; each visible cell `role="gridcell"`, `aria-rowindex`/`aria-colindex` (1-based, layout
  position), `aria-selected`, its accessible name the displayed value; headers `role="columnheader"` /
  `role="rowheader"`.
- Every toolbar button is a `button` with an `aria-label` and the shared Tooltip; menus follow the menu pattern
  (roving focus, Escape returns focus).
- Contrast: grid lines are decorative; text and selection border meet 4.5:1 / 3:1 against the surface (the board
  palette's ink rules). Error ink red is the theme's danger colour.
- Reduced motion: the maximise animation and auto-scroll easing switch off; selection moves have no animation.
- Every action is reachable by keyboard (menus by the context-menu key or Shift+F10 on the active cell).

## Web Experience

- LCP: the sheet chunk and engine load only when a Sheet element is drawn (`next/dynamic`), never on a document
  without one; the main bundle gains only the bridge and the gate (< 2 KB gzip, measured in the PR).
- INP: a keystroke in a cell touches only the editor; a save recalculates only dependents (sliced over frames);
  scrolling renders only the window (target: under 4 ms of script per scroll frame at 900 visible cells).
- CLS: the element's frame is fixed by the element size; the loading face reserves the header and grid.

## Observability

Editor logs (`[sheets]`): `sheets.load.failed`, `sheets.write.failed <error>`, `sheets.refetch.gap`,
`sheets.recalc.truncated`, `sheets.paste.truncated`, `sheets.csv.import <rows>x<cols>` (counts only).

## Testing

| Rule                                                        | Test                                                                                                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Element validation, factory size, labels; static SVG render | `packages/document/src/plan-sheet.test.ts`                                                                                                     |
| Palette category, tile, layout order, keywords              | `apps/live/components/palette/palette-tile-defs.test.tsx`, `palette-layouts.test.ts`                                                           |
| Placement names a new sheet; placed and copied sheets made  | `apps/live/lib/draw-commit.test.ts`, `lib/sheet-seeds.test.ts`, `components/sheets/useSheetModel.test.tsx`                                     |
| A CSV dropped in Plan mode places a filled Sheet            | `apps/live/hooks/sheets/useSheetCsvDrop.test.ts`                                                                                               |
| Geometry: offsets, frozen, hidden, merges, hit testing      | `apps/live/components/sheets/sheet-geometry.test.ts`                                                                                           |
| Keyboard map: every row of the spec's table                 | `apps/live/components/sheets/sheet-keys.test.ts`, `SheetGrid.test.tsx`                                                                         |
| Pointer: select, drag, fill, resize, move, freeze, pointing | `apps/live/components/sheets/useSheetPointer.test.tsx`, `sheet-pointing.test.ts`                                                               |
| Cells drawn with formats, overflow, fit, pending, errors    | `apps/live/components/sheets/SheetCells.test.tsx`, `SheetHeaders.test.tsx`, `SheetSelectionLayer.test.tsx`                                     |
| Editing: Enter/Tab/Escape/Alt+Enter/Ctrl+Enter, F4, assist  | `apps/live/components/sheets/SheetCellEditor.test.tsx`, `useFormulaInput.test.tsx`, `formula-assist.test.ts`                                   |
| Commands on the live selection; Tab runs                    | `apps/live/components/sheets/useSheetActions.test.tsx`, `sheet-controller.test.tsx`                                                            |
| Edits and selections follow rows others move                | `apps/live/components/sheets/useFollowLayout.test.tsx`                                                                                         |
| Toolbar acts on the selection; overflow; menus              | `apps/live/components/sheets/SheetToolbar.test.tsx`, `SheetMenus.test.tsx`, `SheetHeader.test.tsx`                                             |
| Formula bar, Find and Replace, status bar, Add Rows         | `SheetFormulaBar.test.tsx`, `SheetFindBar.test.tsx`, `SheetStatusBar.test.ts`, `SheetAddRows.test.tsx`                                         |
| Clipboard events write the three forms; paste reads them    | `apps/live/components/sheets/useSheetClipboard.test.tsx`                                                                                       |
| Faces, mode gating, Switch to Plan, Import CSV, maximise    | `apps/live/components/sheets/PlanSheetView.test.tsx`, `SheetFace.test.tsx`                                                                     |
| Escape order with menus and Sheet owners; maximise kinds    | `apps/live/hooks/plan/maximised-plan.test.ts`                                                                                                  |
| CSV out and in                                              | `apps/live/components/sheets/sheet-csv.test.ts`                                                                                                |
| The bridge                                                  | `apps/live/hooks/sheets/useSheetsBridge.test.tsx`                                                                                              |
| Setup Sheet: steps, starts, looks, Plan Cards, Create Sheet | `apps/live/components/sheets/SheetSetup.test.tsx`                                                                                              |
| Fill Tab on a Sheet: confirm, delete the rest, On Canvas    | `apps/live/components/sheets/SheetFillTab.test.tsx`                                                                                            |
| Card tables: pull, push, kept fields, drafts, Controls      | `card-table-sync.test.ts`, `useCardTableSync.test.tsx`, `SheetCardRows.test.tsx`, `card-controls-column.test.ts`, `card-field-options.test.ts` |
| Enter / Tab cycle only a selection larger than its merge    | `packages/sheets/src/selection.test.ts` (`selectsSeveral`)                                                                                     |
| Insert Chart: range, region, placement                      | `apps/live/components/sheets/sheet-charts.test.tsx`                                                                                            |
| End to end: place, type, formula, stored, maximise, restore | `apps/live/e2e/plan-sheet.spec.ts`                                                                                                             |

## Assets and external resources

- `SheetArt` and the toolbar glyphs (borders, merge, wrap, freeze, decimals, sort, filter,
  functions) are vendored Lucide glyphs where the set has one, else hand-drawn on the same 24-unit grid, in
  `apps/live/components/sheets/sheet-icons.tsx` (the palette tile's art in `sheet-art.tsx`), drawn through the
  shared `Glyph` with `currentColor`; the repo's MIT licence (Lucide's ISC); no external files or fonts.
- No third-party libraries: the engine, CSV and clipboard parsing are the package's own.

## Constants and configuration

| Constant                   | Value                                                                                     | Provenance / safe range                         |
| -------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Default element size       | 960 × 560                                                                                 | Spec                                            |
| `HEADER_PX`                | 40                                                                                        | As the board header                             |
| `TOOLBAR_PX`               | 44                                                                                        | Default (D9)                                    |
| `FORMULA_BAR_PX`           | 28                                                                                        | Default (D9)                                    |
| `STATUS_BAR_PX`            | 24                                                                                        | Default (D9)                                    |
| `ROW_HEADER_PX`            | 46                                                                                        | Default (D10); fits `10000`                     |
| `COL_HEADER_PX`            | 22                                                                                        | Default (D10)                                   |
| `GRID_OVERSCAN`            | 4                                                                                         | Rows and columns each side                      |
| `RESIZE_HIT_PX`            | 4                                                                                         | Default (D11)                                   |
| `DRAG_START_PX`            | 4                                                                                         | As board widgets' reorder                       |
| `AUTOSCROLL_EDGE_PX`       | 24                                                                                        | Default (D12)                                   |
| `PRESENCE_THROTTLE_MS`     | 120                                                                                       | Default (D13)                                   |
| `PEER_TAG_MS`              | 3000                                                                                      | Spec                                            |
| `FREEZE_GRAB_PX`           | 3                                                                                         | Default (D22)                                   |
| `ADD_ROWS_PX`              | 44                                                                                        | The Add Rows footer's room                      |
| `ADD_ROWS_DEFAULT`         | 100                                                                                       | Spec; Default (D17)                             |
| `FIND_HIGHLIGHTS_MAX`      | 2000                                                                                      | Default (D18)                                   |
| `CELLS_MAX` (status)       | 100000                                                                                    | Default (D19)                                   |
| `SHEET_CSV_DROP_BYTES_MAX` | 8 MB                                                                                      | Default (D20)                                   |
| `KEPT_SELECTIONS_MAX`      | 200                                                                                       | Default (D21)                                   |
| `DATE_YEAR_MIN`            | 1900                                                                                      | Spec (`SheetCardRows.tsx`)                      |
| `STRIP_PX`                 | 52                                                                                        | Save / Cancel strip width (`SheetCardRows.tsx`) |
| `SEPARATOR_PX`             | 17                                                                                        | A divider's room (`SheetToolbar.tsx`)           |
| `CHEVRON_PX`               | 12                                                                                        | A menu button's chevron (`SheetToolbar.tsx`)    |
| `STATS_MENU_PX`            | 208                                                                                       | Totals pick width (`SheetStatusBar.tsx`)        |
| `SHEET_FILL_TAB_HINT`      | "The sheet always fills this tab, for everyone, so the rest of the canvas can’t be used." | Spec (`SheetSettingsPanel.tsx`)                 |
