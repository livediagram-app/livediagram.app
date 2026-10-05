# Whiteboard dock: blueprint

Derived from [Draw mode](../draw-mode.md) "What a whiteboard shows", "Where the dock sits" and
"Shape slots". The dock's tools, pens, eraser and backgrounds are in
[whiteboard-round-one](whiteboard-round-one.md); this file owns the dock's layout (three groups,
top or bottom in the Toolbar layout, or the Floating layout's Palette panel), the Shapes flyout with its search and the shape slots. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md)
as `Dn`.

Scope, by file (all under `apps/live/` unless stated):

| File                                                 | Role                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `components/canvas/whiteboard/WhiteboardDock.tsx`    | Orchestrates the groups, the one open flyout, the pins-full hint                                        |
| `components/canvas/whiteboard/dock-variant.ts`       | `DockVariant`, `DockVariantContext`, `useDockVariant`                                                   |
| `components/canvas/whiteboard/DockToolbar.tsx`       | `DockToolbar` (a group: pill, tile section or footer row; roving tab stop), `DockButton`, `DockDivider` |
| `components/canvas/whiteboard/DrawingToolsGroup.tsx` | Select, Markers 1 to 3, Text, Sticky note, Path tool, Eraser                                            |
| `components/canvas/whiteboard/ShapesGroup.tsx`       | The pinned shapes, a separator, Shapes; in the panel the pinned shapes then the Shapes menu's items     |
| `components/canvas/whiteboard/SettingsGroup.tsx`     | The cog, alone (the panel's footer row)                                                                 |
| `components/canvas/whiteboard/useDockFlyout.ts`      | Which flyout is open, where, hover open, delayed close, re-anchoring                                    |
| `components/canvas/whiteboard/dock-flyouts.tsx`      | Flyout bodies: pen, eraser, Settings, slot menu                                                         |
| `components/canvas/whiteboard/ShapesFlyout.tsx`      | The Shapes flyout: the field over the six slots or six results                                          |
| `components/canvas/whiteboard/useShapeSearch.ts`     | The query, what it shows, the active entry, arrow keys and Enter                                        |
| `components/canvas/whiteboard/ShapePreview.tsx`      | A catalogue shape's own preview                                                                         |
| `components/canvas/whiteboard/useShapeSlotDrag.ts`   | Dragging a flyout shape onto the pinned side, or a pinned one off it                                    |
| `components/canvas/whiteboard/SlotGhost.tsx`         | The dragged shape under the pointer                                                                     |
| `components/canvas/whiteboard/WhiteboardFlyout.tsx`  | A flyout: portalled, `offDock` / `besidePanel`, its tip, focus in, `restoreFocus` on close              |
| `lib/whiteboard-shape-catalogue.ts`                  | The whiteboard shape catalogue, derived from the palette's shape tiles                                  |
| `lib/whiteboard-shape-search.ts`                     | Ranked search (at most six) and grid movement (pure)                                                    |
| `lib/whiteboard-shape-slots.ts`                      | Default pins, the six slots, pick record, drops, outcomes (pure)                                        |
| `lib/whiteboard-dock-prefs.ts`                       | The dock's synced preferences: parse and write, the dock position                                       |
| `components/canvas/CanvasChrome.tsx`                 | The dock (Toolbar layout only); top corners and stack clear a top dock                                  |
| `components/canvas/useCanvasChromePanels.tsx`        | In Draw mode, the panel variant as `CommandPalette`'s `drawTools`                                       |
| `components/palette/CommandPalette.tsx`              | Renders `drawTools` in place of `PaletteTabBar`, same panel and header                                  |
| `hooks/ui/useStripCrowdsCorners.ts`                  | Whether a top bar (the strip or a top dock) reaches a top corner                                        |
| `components/chrome/TopCenter.tsx`                    | `TopCenterStack` `below`: under the strip or under a top dock                                           |
| `components/dialogs/settings/settings-catalogue.ts`  | Editor › Draw sub-category: the Dock Position row                                                       |
| `hooks/canvas/useWhiteboardDockPrefs.ts`             | Those preferences as state, written like every synced preference                                        |
| `hooks/canvas/useWhiteboard.ts`                      | `pickShape`, `pickSearchedShape`, `openShapes` and the dock prefs                                       |
| `lib/palette-search.ts`, `lib/search.ts`             | `SHAPE_TILES`, `shapeTileSearchItem`; `paletteRank` from `@livediagram/icons`, shared                   |
| `lib/user-preferences.ts`                            | `whiteboardPinnedShapes`, `whiteboardShapePicks`                                                        |
| `components/primitives/SearchInput.tsx`              | `listboxId`: the box as a combobox over an always-shown listbox                                         |
| `apps/telemetry/app/event-explanations.ts`           | Sentences for the new tokens                                                                            |

## Domain and naming

| Term            | Identifier                                                           | Meaning                                                                   |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Group           | `DockToolbar`, `data-dock-group`                                     | One pill: `drawing`, `shapes`, `settings`                                 |
| Shape catalogue | `WHITEBOARD_SHAPE_CATALOGUE`                                         | Every shape a whiteboard arms, keyed by `WhiteboardShapeKey`              |
| Shape key       | `WhiteboardShapeKey`                                                 | A dock shape id, a shape kind, or `kind:choice`                           |
| Pinned shape    | `pinnedShapes`, `data-pinned-slot`                                   | A kind on the bar's pinned side, before the separator (up to seven)       |
| Menu shape      | `itemKey` `menu:<key>`                                               | The panel's tile for one of the Shapes menu's slots, none pinned          |
| Default pins    | `DEFAULT_PINNED_SHAPES`                                              | Arrow, Rectangle, until the user changes them                             |
| Slot            | `slotShapes` (`mostUsed`, `recent`)                                  | One of the Shapes flyout's six: three Most used, three Recent             |
| Pick counts     | `ShapePicks`                                                         | Per kind: `[count, lastPickedAt]`                                         |
| Slot outcome    | `SlotOutcome` (`pin` / `unpin` / `refused` / `none`)                 | What a drop or a slot menu choice does to the pins                        |
| Armed shape     | `armedShape`                                                         | The catalogue shape in hand, if a board shape is armed                    |
| Dock position   | `WhiteboardDockPosition` (`top` / `bottom`)                          | Where the dock sits; `data-dock-position` on the wrapper (dock only)      |
| Variant         | `DockVariant` (`dock` / `panel`), `data-dock-variant`                | The Toolbar layout's floating dock, or the Palette panel's body           |
| Button form     | `ButtonForm` (`icon` / `tile` / `row`), `ButtonFormContext`          | How a group's buttons draw: dock icons, panel tiles, the panel footer row |
| Placement       | `FlyoutPlacement` (`below` / `above` / `beside`), `data-side`        | Where a flyout opens: off a top or bottom dock, or beside the panel       |
| Tip             | `FlyoutTip`, `data-flyout-tip` (`top` / `bottom` / `left` / `right`) | The flyout's point at its opener, on the edge facing it                   |

Banned synonyms: "favourite" for a pinned shape (it is a slot, not a favourite), "frequent slot" (the
slots are Most used and Recent), "More shapes" (merged into Shapes), "toolbar" for a group in prose
(it is a group; `role="toolbar"` is its semantics).

## Behaviour and state

### Groups

- Order: Drawing tools, Shapes, Settings, always all three. The dock carries no Undo or Redo:
  the bottom-right cluster and the keyboard keep them in every mode, so `WhiteboardDock` takes
  only `{ model, ink, variant? }` (`variant` defaults to `'dock'`).
- **Where the groups live** (spec "What a whiteboard shows"): in the Toolbar layout,
  `CanvasChrome` renders the `dock` variant when `toolbarActive && whiteboard && whiteboardDock &&
!readOnly && !chromeHidden`. In the Floating layout, `useCanvasChromePanels` builds
  `<WhiteboardDock variant="panel" />` while `editorMode === 'draw'` and passes it to
  `CommandPalette` as `drawTools`, which renders it in place of `PaletteTabBar`; the panel keeps
  its `MovablePanel` title row (the editor mode switch, help, minimise), drag, docking and
  collapse. `WhiteboardDock` provides its variant through `DockVariantContext`; `DockToolbar`,
  `DockDivider` and `ShapesGroup` read it with `useDockVariant()`. `DockToolbar` turns it into its
  buttons' form (`ButtonFormContext`): `icon` in the dock; in the panel `tile`, or `row` for a group
  marked `footer` (Settings).
- **Drawing tools**: `select`, `main`, `second`, `third`, `text`, `path`, `eraser`, with dividers
  after Select, after the markers and before the eraser. The sticky note is a shape (below), not a
  drawing tool.
- **Shapes** (dock): `pinned:<key>` × 0 to 7, the separator (`data-pinned-separator`), `shapes`
  (key S). The slots live in the Shapes flyout, not on the bar.
- **Shapes** (panel): `pinned:<key>` × 0 to 7, then `menu:<key>` for the Shapes menu's items:
  `model.slotShapes.recent` then `mostUsed`, de-duplicated, minus the pinned, each a tile that
  calls `model.pickShape(key)` (through `pickAndClose`). No Shapes button and no separator.
- **Settings**: `settings` (the cog) alone, last; `DockToolbar footer`, so the panel's footer row.
- Each group is a `DockToolbar`: its own roving tab stop (`focusKey`, the last focused button; while
  none is rendered, the group's first button), ArrowLeft / ArrowRight wrap within the group, Home /
  End jump. In a tile grid ArrowUp / ArrowDown also step a row (`PANEL_COLUMNS`), clamped to the
  first and last tile (D38). Tab moves between groups.
- **S** (`WHITEBOARD_EDIT_KEYS`, not while typing): `openShapes()` raises `shapesRequest` on the
  dock model; the dock answers by opening the Shapes flyout as a hover opens it (`viaKey`, so its
  field takes the focus and closing gives the focus back to the board). With the flyout already
  open it focuses the field. Only Escape, a pick or a press elsewhere closes it: once the field
  has the focus, S types there. The panel renders no `shapes` opener, so there S does nothing
  (the menu's shapes are on show).

### Flyouts

- One at a time (`useDockFlyout`): `{ kind, hover, viaHover, left, openerKey, slot? }`. `left` is
  the opener's centre in screen px from `[data-whiteboard-dock]`'s left edge, measured on opening
  and again by `reanchor()` on scroll; it is only a re-place signal (the flyout's `revision`), as
  the flyout places itself from the opener's own rect. `viaHover` is set by a hover or by S
  (`viaKey`). Kinds: a pen id, `eraser`, `settings`, `shapes`, `slot`.
- Hover opens only the Shapes flyout (pen or mouse; never touch); the rest open on a press. `hover`
  drives the delayed close (`HOVER_CLOSE_MS`); a press on a hover flyout, or working in its field
  (`stick()`), clears it. `viaHover` stays set for the flyout's life.
- The flyout focuses, on opening: its field if it has one (the Shapes flyout, even on a hover), else
  its pressed option, else its first button; a hover-opened flyout without a field never takes the
  focus. It does so once placed (`place` set): it is `visibility: hidden` for its first, unmeasured
  frame, and a browser will not focus a hidden element, which would leave the focus, and so Escape,
  on the opener.
- Closing: Escape returns the focus to the opener, except for a flyout opened by hover, whose field
  took the focus unasked: it closes with `restoreFocus`, which blurs to the board when the focus is
  still inside it or nowhere. A press elsewhere, a pick or the hover close do the same.
- The Shapes button prevents its mousedown's focus move while its flyout is open, so a press on a
  hover-opened flyout leaves the focus in the field.
- **Placement** (`DockFlyoutHost`): every `WhiteboardFlyout` is portalled to the body and
  `position: fixed`, with `anchor={openerKey}`, `placement` (`'beside'` in the panel, else
  `'below'` for a top dock and `'above'` for a bottom one; mirrored as `data-side`) and
  `revision={left}`. A layout effect keyed on `[anchor, placement, revision]` reads the
  `[data-whiteboard-dock]` wrapper's rect, the opener's rect and the flyout's layout size (not
  its rect: the pop-in starts at `scale(0)`), and places it:
  - **Off the dock** (`offDock(dockRect, openerRect, flyoutNode, below, viewport)`): its top
    `OFF_DOCK_GAP_PX` below the dock's bottom (or that gap above its top), centred on the
    opener, clamped `VIEWPORT_MARGIN_PX` inside the viewport (D36).
  - **Beside the panel** (`besidePanel(panelRect, openerRect, flyoutNode, viewport)`): the side of
    the panel with more room (left on a tie), `BESIDE_GAP_PX` from the panel's edge, its top level
    with the opener's top, both clamped `VIEWPORT_MARGIN_PX` inside the viewport.
  - It stays `visibility: hidden` until measured. Neither the dock nor the panel moves for a
    flyout, and a portalled flyout is outside the dock's zoom, so it draws at design size
    whatever the toolbar UI scale.
- **Tip** (`FlyoutTip`): every flyout points at its opener with a 10 px rotated square on the edge
  facing it (`data-flyout-tip`: `top` below a dock, `bottom` above one, `right` or `left` beside the
  panel), the card's border on its two outer sides. Off the dock it sits over the opener's centre
  (`tipLeft`); beside the panel level with it (`tipTop`); either clamped `TIP_INSET_PX` from the
  card's corners (D37).
- Scrolling the groups (narrow screens) moves the openers: an open flyout follows its opener
  (`reanchor()` on scroll updates `left`, so the flyout's `revision` changes and it is placed
  again) rather than closing, so a scroll that brings a button into view never closes the flyout
  it just opened.

### Position

- `readWhiteboardDockPosition(prefs)`: `'bottom'` only for a stored `'bottom'`; anything else
  (unset, junk) is `'top'`. `withWhiteboardDockPosition(prefs, position)` writes it.
- The dock model carries `position` (from the synced preferences); the Settings row writes it
  through the dialog's own preference round-trip, and the editor's `PREFERENCES_CHANGED_EVENT`
  listener re-renders the dock in place, still mounted.
- The position applies to the `dock` variant only; the panel form has no `data-dock-position`.
- `top`: flyouts open `below` and the hint takes `top-full mt-2`; `bottom`: flyouts open `above`
  and the hint takes `bottom-full mb-2`.
- `top`: `CanvasChrome` passes `below="dock"` to the top-centre stack, and measures the dock
  against the top corner stacks (`useStripCrowdsCorners` with `WHITEBOARD_DOCK_SELECTOR`); when
  it reaches one, both top corner stacks start at `toolbarTopClearancePx(scale)` (`CanvasChrome`), the strip's own clearance at the toolbar scale.

### Settings

- Sections, top to bottom: **Background**, **Cursor** (Crosshair + nib first, the default),
  **Drawing**, each a row of switch buttons (one of several).
- Then **Colours**, only while the board has custom colours to snap: `SnapColoursSection`, owned by
  [snap-colours](snap-colours.md).

### The Shapes flyout

- The field (`SearchInput` with `listboxId`, `role="combobox"`) above a three-column grid.
- Empty field: the six slots in two rows with no visible heading, **Recent** on top and **Most
  used** below, each row a `role="group"` named for screen readers only ("Recent shapes", "Most
  used shapes"), each entry with its key badge and `aria-keyshortcuts` where it has one. The slots
  are taken once, as the flyout mounts (`useState(slots)`), so they never change while it is open.
  Typed field: at most `SHAPE_SEARCH_LIMIT` entries (`searchWhiteboardShapes`), `paletteRank` over
  label and keywords, ties in catalogue order; nothing matched shows "No shapes match". Never the
  full list. The grid area has a fixed height (two rows) either way.
- The active entry starts at 0 on every query change; every arrow key walks the grid (`gridStep`,
  `SHAPE_GRID_COLUMNS`, the two rows as two groups), clamped. The active entry has
  `aria-selected`, `aria-activedescendant` on the field, and no name is written under the grid: an
  entry's name is its accessible name and its Tooltip, as on every dock button.
- Any key but Escape or Tab in the field, and any change to it, calls `stick()`: typing keeps a
  hover-opened flyout open until Escape, a pick or a press elsewhere.
- Enter picks the active entry; a press on an entry picks it (pointerdown is prevented so focus
  stays in the field). A slot calls `pickShape(key)`, a typed result `pickSearchedShape(key)`;
  either closes the flyout.
- An entry's menu (right-click, touch long-press, or Shift+F10 / ContextMenu in the field for the
  active entry) shows **Pin to dock** inside the flyout, focused; Escape there returns to the
  field, a press pins (`pinFromMenu`) and closes the flyout.
- An entry can be dragged onto the bar's pinned side (below).

### Shape catalogue

- The six Shapes flyout kinds first, keyed and labelled as the dock names them (`rectangle`,
  `ellipse`, `diamond`, `cylinder`, `line`, `arrow`); the first four take their palette tile's
  keywords (so "square" finds Rectangle), Line and Arrow their own. Then the **sticky note** (key
  `sticky`, label "Sticky note", keywords "sticky note post-it postit memo card" and the palette
  tile's description, group Write, intent the plain `{ type: 'sticky' }`, drawn with the dock's
  sticky glyph in ink: `glyph: 'sticky'`); `pickSticky` (key N) is `pickShape('sticky')`, so N
  counts as a pick and the note joins the slots and the pins like any kind. Then every palette shape tile
  (`SHAPE_TILES`) not in the Components category and not already one of the six, keyed `kind` or
  `kind:choice` (`shapeTileSearchItem`), labelled with the tile's display name.
- An entry's group is its tile's palette category (`section`, or `toolGroup` inside Tools); Line
  and Arrow file under Draw. Groups sort in `PALETTE_CATEGORIES` order; that order is the
  catalogue's, which breaks search ties and extends the slots' fallback.
- Intent: the six via `whiteboardShapeIntent`; a tile entry `{ type: 'shape', kind, ...choice,
board: true }`. `armedWhiteboardShape(intent)` reads a board intent (or the plain sticky intent;
  an Event Storming note, with a fill or a kind, is not it) back to its key.

### Shape slots

- **Pinned side**: `readWhiteboardDockPrefs` gives `DEFAULT_PINNED_SHAPES` (Arrow, Rectangle) until the user changes the pins; then the stored list, even empty.
- `pickShape(key)` (a slot, a pinned shape, a shape key; `pickSearchedShape` for a result) arms the
  entry's intent and records a pick: `recordShapePick(picks, key, Date.now())` counts it and stamps
  it, keeping at most `SHAPE_PICKS_KEPT` kinds by evicting the least recent kind that is not among
  the `SHAPE_PICKS_PROTECTED` most picked (never the kind just picked).
- `shapeSlots(picks, pinned)`: the [Within reach](../../004-interface-design/within-reach.md) set of the
  unpinned kinds picked, by the shared `withinReach(known, SLOTS_PER_ROW, { uses: picks, lastUsedAt: last pick })`
  (`@livediagram/api-schema`): **Most used** first, by picks (ties to the most recent); then **Recent**, the
  unpinned kinds not in Most used, newest first, so a kind that is both shows only in Most used (its icon stays
  put); three each, none twice across pins and slots; an empty slot takes the next fallback kind not already
  showing, Most used filled first (the Shapes flyout order, rectangle to arrow, then the catalogue). With the default pins: Most used Ellipse,
  Diamond, Cylinder; Recent Line, Parallelogram, Hexagon.
- Pressed state on the bar: a pinned shape when `armedShape` is its key; Shapes when a shape (the
  sticky note included) is armed that is not pinned. In the panel, a menu shape tile when
  `armedShape` is its key (there is no Shapes button to press).
- Keys: `shapeShortcut(entry)` gives R, O, D, C, L, A for the flyout six and N for the sticky note;
  a pinned shape and a flyout entry show it bottom right and in `aria-keyshortcuts`. A panel tile
  shows no key letter: the key is in its tooltip (`label · KEY`) and `aria-keyshortcuts`.
- **Drag** (`useShapeSlotDrag`, one for both sources, hosted by the dock): pointerdown (primary
  button) on a flyout entry (`from: 'flyout'`) or a pinned shape (`from: 'pinned'`) arms; travel
  of `SHAPE_SLOT_DRAG_PX` starts the drag, calls `stick()` so the flyout stays open, and measures
  the bar once (its box, the pinned shapes, the separator); each move computes
  `slotDropTarget(x, y, layout)`; release applies `resolveSlotDrop`, closes the flyout for a
  flyout drop that did anything, and swallows the click after it. Escape or pointercancel ends it
  with no drop. The drag is the dock's only: the panel draws no separator (`DockDivider` renders
  nothing there), so `measureBar()` finds none and a pinned tile's drag logs and ends at once
  (Errors and edge cases); a press still picks.
- `slotDropTarget`: outside the bar by more than `SLOT_BAR_REACH_PX` is `off`; at or past the
  separator's centre is `past`; else the pinned side: an insertion `index` (before a pinned shape
  over its left half, after it over its right half, else by the shapes' centres) and, over one,
  `onto` it.
- `resolveSlotDrop`: `past` or `off`: a pinned source unpins (its picks untouched), a flyout
  source does nothing. Pinned side, pinned source: moves to the insertion point (the moved shape
  itself not counted), or nothing if unchanged. Pinned side, flyout source: under seven pinned,
  inserts at the index; with seven, replaces the shape it is `onto`, else `refused`.
- **Pinned shape's menu** (right-click, touch long-press, Shift+F10 or ContextMenu on it): a `slot`
  flyout titled with the shape's name and one option, "Unpin" (`unpinShape`). The release that
  ends a long-press does not pick. Focus returns to the pinned shape. The same in the panel, the
  flyout opening beside it; a menu shape tile has no menu, so the panel never pins.
- **Refused**: nothing is written; the hint "Seven shapes are pinned. Drag one out to swap." shows
  for `HINT_MS` and in a `role="status"` region: on the board side of the Shapes group in the
  dock. `PanelBody` still renders it inline under the groups (`data-side="inside"`), but nothing in
  the panel can be refused (no drag, no Pin to dock), so that path is unreached.

## Interfaces and contracts

```ts
// lib/whiteboard-shape-catalogue.ts
export type WhiteboardShapeKey = WhiteboardShapeId | 'sticky' | ShapeKind | `${ShapeKind}:${string}`;
export type WhiteboardShapeEntry = {
  key: WhiteboardShapeKey;
  label: string;
  keywords: string;
  group: string;
  intent: PendingDraw;
  dockShape?: WhiteboardShapeId;
  tile?: PaletteTileDef;
  glyph?: 'sticky';
};
export const WHITEBOARD_SHAPE_CATALOGUE: readonly WhiteboardShapeEntry[];
export function whiteboardShapeEntry(key: string): WhiteboardShapeEntry | undefined;
export function isWhiteboardShapeKey(key: unknown): key is WhiteboardShapeKey;
export function armedWhiteboardShape(intent: PendingDraw | null): WhiteboardShapeKey | null;

// lib/whiteboard-shape-search.ts
export const SHAPE_SEARCH_LIMIT = 6;
export function searchWhiteboardShapes(query: string): WhiteboardShapeEntry[]; // [] when empty
export function gridStep(
  sizes: readonly number[],
  cols: number,
  index: number,
  dir: GridDirection,
): number;

// lib/whiteboard-shape-slots.ts
export const PINNED_SHAPES_MAX = 7;
export const DEFAULT_PINNED_SHAPES: readonly WhiteboardShapeKey[];
export type ShapePicks = Readonly<Partial<Record<WhiteboardShapeKey, readonly [number, number]>>>;
export type ShapeSlots = { mostUsed: WhiteboardShapeKey[]; recent: WhiteboardShapeKey[] };
export function shapeSlots(picks: ShapePicks, pinned: readonly WhiteboardShapeKey[]): ShapeSlots;
export function recordShapePick(picks: ShapePicks, key: WhiteboardShapeKey, now: number): ShapePicks;
export function slotDropTarget(x: number, y: number, layout: SlotLayout): SlotDropTarget;
export function resolveSlotDrop(pinned: readonly WhiteboardShapeKey[], source: SlotSource, target: SlotDropTarget): SlotOutcome;
export function pinFromMenu(pinned: readonly WhiteboardShapeKey[], key: WhiteboardShapeKey): SlotOutcome;
export function unpinShape(pinned: readonly WhiteboardShapeKey[], key: WhiteboardShapeKey): SlotOutcome;
export function dropIndicatorX(layout: SlotLayout, source: SlotSource, target: SlotDropTarget): number | null;

// lib/whiteboard-dock-prefs.ts
export function readWhiteboardDockPrefs(prefs: UserPreferences): { pinned; picks };
export function withWhiteboardDockPrefs(prefs: UserPreferences, patch: Partial<{ pinned; picks }>): UserPreferences;
export type WhiteboardDockPosition = 'top' | 'bottom';
export const WHITEBOARD_DOCK_POSITIONS: readonly WhiteboardDockPosition[]; // ['top', 'bottom']
export function readWhiteboardDockPosition(prefs: UserPreferences): WhiteboardDockPosition;
export function withWhiteboardDockPosition(prefs: UserPreferences, position: WhiteboardDockPosition): UserPreferences;

// The dock model carries `position: WhiteboardDockPosition`.

// components/canvas/whiteboard/dock-variant.ts
export type DockVariant = 'dock' | 'panel';
export const DockVariantContext: React.Context<DockVariant>; // default 'dock'
export function useDockVariant(): DockVariant;

// WhiteboardDock.tsx
export type WhiteboardDockProps = { model: WhiteboardDockModel; ink: string; variant?: DockVariant };

// DockToolbar.tsx
export function DockToolbar(props: {
  label: string;
  group: string; // data-dock-group
  footer?: boolean; // the panel's footer row (Settings)
  children: ReactNode;
}): JSX.Element;
// DockButtonProps gains `caption?: string`: a tile's or row's text; default the label up to its
// first comma ("Marker 2, blue, medium" shows "Marker 2"). The Path tool passes "Path".
export function DockDivider(props: Record<`data-${string}`, string>): JSX.Element | null; // null in the panel

// WhiteboardFlyout.tsx
export type FlyoutPlacement = 'below' | 'above' | 'beside';
// WhiteboardFlyout props: { id, label, anchor /* the opener's data-dock-item */, placement,
//   revision?: number /* changes when the opener moved: placed again */, onClose,
//   onPointerEnter?, onPointerLeave?, takeFocus?, restoreFocus?, hideTitle?, children }
export function offDock(
  dock: { top: number; bottom: number },
  opener: { left: number; width: number },
  flyout: { offsetWidth: number; offsetHeight: number },
  below: boolean,
  viewport?: { width: number }, // default: the window's inner width
): { left: number; top: number; tipLeft: number };
export function besidePanel(
  panel: { left: number; right: number },
  opener: { top: number; height?: number },
  flyout: { offsetWidth: number; offsetHeight: number },
  viewport?: { width: number; height: number }, // default: the window's inner size
): { left: number; top: number; side: 'left' | 'right'; tipTop: number };

// CommandPalette.types.ts: CommandPaletteProps gains `drawTools?: ReactNode`.
// useStripCrowdsCorners takes the bar's selector (null: no bar, never crowded).
// TopCenterStack's `belowToolbar` becomes `below?: 'toolbar' | 'dock'`.

// useDockFlyout gains stick() and reanchor(); WhiteboardFlyout gains restoreFocus.
// The dock model (useWhiteboard) gains
pickShape(key: WhiteboardShapeKey): void; // was the six ids only
pickSearchedShape(key: WhiteboardShapeKey): void;
armedShape: WhiteboardShapeKey | null;
shapesRequest: number; openShapes(): void; // S
pinnedShapes: WhiteboardShapeKey[]; slotShapes: ShapeSlots;
applySlotOutcome(outcome: SlotOutcome): void;
```

Parsing (`readWhiteboardDockPrefs`) rejects: a pinned value that is absent or not an array → the default pins; a pinned
entry that is not a catalogue key, or a repeat → dropped; beyond seven → dropped; picks that are
not a plain object → none; a pick entry whose key is not a catalogue key, or whose value is not
`[positive integer, finite ms >= 0]` → dropped. An unknown key passed to `pickShape` arms nothing
and warns.

## Data and persistence

| Field                    | Where                                                    | Class           | Travels        |
| ------------------------ | -------------------------------------------------------- | --------------- | -------------- |
| `whiteboardPinnedShapes` | user preferences blob (unset = defaults; `[]` = emptied) | synced per user | across devices |
| `whiteboardShapePicks`   | user preferences blob (unset = none)                     | synced per user | across devices |
| `whiteboardDockPosition` | user preferences blob (unset = top)                      | synced per user | across devices |

Written through `useWhiteboardDockPrefs` off the freshest stored preferences
(`readUserPreferences()`), then `setUserPreferences` and `writeUserPreferences(prefs, ownerId)`
(localStorage cache plus the fire-and-forget PUT), as `useSwatchOverrides` does. A guest's owner id
is its participant id. Empty counts are removed rather than stored; the pins
are stored once changed, even empty. No migration: new optional keys; an older reader ignores them.

## Errors and edge cases

- A pinned or counted kind the palette no longer offers: dropped on read; its slot refills.
- Seven pinned and a drop beside them: refused with the hint; the dragged slot is where it was.
- Every pin unpinned: the side stays empty (`[]` stored); the defaults never return on their own.
- A drag that measures no separator: logged (`shape drag: no Shapes bar to measure`, warn), no
  drag. This is every pinned tile's drag in the panel, which draws no separator: the panel's
  shapes sit in a grid, which `slotDropTarget`'s one horizontal boundary cannot read, so pinning
  by drag is the dock's only.
- S in the Floating layout: no `shapes` opener in the document, so the request is dropped.
- A flyout before its first measure (either placement): hidden for that frame, never flashed at
  the corner. Its opener not found on a measure: the placement is left as it was (hidden if it was
  never placed).
- A slot re-ranked away while focused: the group's tab stop falls back to its first button.
- The blob's 4 KB cap: at most 20 picks (about 600 bytes) and 7 pins (about 110 bytes).
- Two kinds picked at the same millisecond (another device): the catalogue order breaks the tie.

## Security and trust

Keys come from a closed catalogue and are validated on read; telemetry carries fixed tokens only
(`ShapeSearch`, `ShapePinned`, `ShapeUnpinned`), never a kind.

## Performance and limits

- The catalogue is built once at module load (about 70 entries); search is a linear rank and sort
  per keystroke, well under a millisecond.
- The dock does no layout measurement at rest: flyout placement, the hint and a slot drag measure
  once, on opening or on the drag's start; re-anchoring measures one button per scroll event while
  a flyout is open, and the flyout measures again only when that moves its `revision`.
- Widest dock: 858 px (seven pins) with 44 px buttons. Measured at 970 px in Chromium and WebKit
  (1600 px desktop) while the dock had a History group; that group's pill and gap (100 + 12 px,
  from its classes) are gone, and the buttons are 36 px since 2026-10-03, so the widest dock is
  now narrower still; neither width has been re-measured in a browser. At the toolbar UI scale
  it is that width times the scale.
- Measured in a browser: a dock group is the strip card's height, 46 px at 1x and 54.78 px at
  1.25x.

## Presentation and UX

- The `dock` wrapper draws at the **toolbar UI scale**: `uiScaleStyle(useUiScale('toolbar'))`
  (`zoom`, nothing at 1), with a top dock's `top` restated as `toSurfacePx(12, scale)` so it keeps
  12 px from the edge ([UI scale blueprint](../../007-editor/blueprints/ui-scale.md)). Its flyouts
  are portalled out of the zoomed wrapper, so they draw at design size, like every menu opened
  from a scaled surface. The panel form takes no zoom of its own: the Palette panel is scaled as
  a panel.
- Wrapper at the **top** (the default): `top-3`; below `lg` `left-[7.5rem]` with
  `max-w-[calc(100%-8.25rem)]`, clear of the Explorer menu card (the button and the editor mode
  switch, 12 + 98 px, plus an 8 px gap); from `lg` centred with `max-w-[calc(100%-15rem)]`, the
  same clearance both sides (D33). Top corner stacks drop to
  68 px when it reaches them (D34); the top-centre stack starts at `top-[4.25rem]`, as under the strip.
- Wrapper at the **bottom**: bottom centre, `bottom-4` from 1760 px wide (D9), lifted above the
  bottom-right cluster below it.
- Either way: groups `gap-3` (12 px) apart inside one horizontal scroller (`-m-3 p-3`, so shadows are
  not clipped), each group a pill on the editor's panel surface (`rounded-xl border p-1
shadow-md shadow-slate-900/5`, the strip card's), buttons (`DockButton`) 36 × 36 px (`h-9
w-9`, the strip's tile size) with `DOCK_ICON_PX` (18 px) glyphs, so the dock is the strip's
  height (spec "What a whiteboard shows"). The drag's `SlotGhost` is the same 36 px.
- **Panel form** (`variant="panel"`), in the palette's own look: the wrapper is `relative flex
flex-col gap-3 px-2.5 pb-2.5 pt-2`, the groups stacked, no pills, no separators (`DockDivider`
  renders nothing).
  - **Sections** (Drawing tools, Shapes; form `tile`): a `flex flex-col gap-1.5` of a small-caps
    heading (`aria-hidden`, the toolbar's label, `px-1 text-[10px] font-semibold uppercase
tracking-wider text-slate-500 dark:text-slate-400`, the palette's) over the toolbar as `grid
grid-cols-3 gap-1` (`PANEL_COLUMNS`). A tile is `flex w-full min-w-0 flex-col items-center
gap-1 rounded-md px-1 py-2`: the glyph over its caption (`text-[10px] font-medium`, centred,
    truncated); off `text-slate-600 hover:bg-slate-100`, pressed `bg-brand-100 text-brand-700`
    (dark `bg-brand-500/20 text-brand-200`), the palette's chosen tile. No key letter on a tile.
  - **Footer** (Settings; form `row`): `-mx-2.5 -mb-2.5 flex border-t px-2.5 py-1.5`, one
    full-width row button (`flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5
text-xs font-medium`), the cog and "Settings", tinted like a tile.
  - Captions: the label up to its first comma (Select; Marker 1, 2, 3; Text; Eraser; each shape
    by name); the Path tool's is "Path".
- Flyouts sit on the board side of their opener in whichever group, centred on it
  `OFF_DOCK_GAP_PX` off the dock: below a top dock, above a bottom one; so does the pins-full
  hint. In the panel they open beside it (see Flyouts). Each is a `fixed` card (`rounded-xl
border p-3 shadow-lg`, `w-max max-w-[min(20rem,calc(100vw-1.5rem))]`) with its tip. The Shapes
  flyout is `8.5rem` wide with a fixed-height grid (two rows of three 40 px cells), so typing
  never resizes it.
- Flyout previews: the tile icon (or the dock glyph for the six), 20 px box, in the board's ink.
  Pinned shapes: the same preview in the dock's own text colour; one with a shape key (A, R, O, D,
  C, L) shows it bottom right and in `aria-keyshortcuts`, as every dock tool does (in the panel,
  in its tooltip instead). Menu shape tiles: the same preview.
- Drag: the source fades to 40 %, a ghost follows the pointer (portalled to the body), a 2 px brand
  marker shows the insertion point (rose when the drop would be refused), a pinned shape a full
  side would replace is ringed instead; the body cursor is `grabbing` or `not-allowed`.
- Copy: groups "Drawing tools", "Shapes", "Settings" (the panel's section headings too); buttons
  "Settings", "Text", "Sticky note", "Path tool" (caption "Path"), "Shapes", a shape by its label;
  a panel tooltip with a key "<label> · <KEY>"; flyout rows
  named (for screen readers only) "Recent shapes", "Most used shapes";
  search placeholder
  and name "Search shapes", clear "Clear the shape search", empty "No shapes match"; slot menu "Pin
  to dock", "Unpin"; hint "Seven shapes are pinned. Drag one out to swap."
- Settings row: in the **Editor › Draw** sub-category (category id `draw`, `parent: 'editor'`,
  no section), label "Dock Position", options "Top", "Bottom", description "Where Draw mode's dock
  of pens, shapes and tools sits. Top keeps it where the Toolbar layout keeps its tools; Bottom
  puts it closer to hand when drawing on a tablet. Only Draw mode has a dock, so Diagram mode is
  unchanged."

## Accessibility

- Three `role="toolbar"` groups ("Drawing tools", "Shapes", "Settings"), each labelled, one tab
  stop, arrow keys within. Horizontal (`aria-orientation`) in the dock and the panel's footer; a
  panel tile grid sets no orientation, as it walks both ways. The visible section heading is
  `aria-hidden`: the toolbar's label already names it. A tile's caption is inside its button,
  whose accessible name stays the full label.
- The Shapes flyout: `role="combobox"` field with `aria-controls` / `aria-expanded` /
  `aria-autocomplete="list"` / `aria-activedescendant`; a `role="listbox"` ("Shapes", or "Matching
  shapes" while typing) of `role="option"` entries (`aria-selected`, labelled by name, the set's
  with `aria-keyshortcuts`), in two groups named for screen readers ("Recent shapes", "Most used shapes"), unlabelled on screen.
- Hover taking the focus is confined to the Shapes flyout's field, and the focus goes back to the
  board when it closes; a keyboard opening returns to the button on Escape.
- Pinning and unpinning have a keyboard path (Shift+F10 or ContextMenu, then the menu), not just
  the drag.
- The refusal is announced through a `role="status"` region.

## Web Experience

- Zero layout shift: picking a tool or opening a flyout never moves a group (measured in Chromium
  and WebKit); only a pin, the user's own act, changes the dock's width. A flyout is fixed and
  portalled in both forms, so neither the dock nor the panel moves for one. The panel's tiles
  have a fixed grid, so a pressed tile changes only its tint.
- Switching modes never changes the size of the bar at the top: the dock and the strip are the
  same height at the same toolbar scale. Changing the position is
  the user's own act in Settings; the top corner stacks move once, when the dock reaches them.
- INP: every dock handler sets state; search is synchronous and small.

## Observability

- `Whiteboard · Selected · ShapeSearch` (a typed result picked), `Whiteboard · Changed ·
ShapePinned` / `ShapeUnpinned` (a replacement reports `ShapePinned`; a reorder reports nothing),
  fired before the preference is written. `UI · Changed · WhiteboardDockPositionTop` /
  `WhiteboardDockPositionBottom` from the Settings row (`choiceTelemetryType`), as every choice row.
- Logs: `[whiteboard-dock] position` (debug, with the position, on mount and on change), `[whiteboard] unknown shape` (warn), `[whiteboard-dock] Shapes flyout opened by S` (debug), `[whiteboard-dock] shape drag started`, `shape
dropped`, `shape drag cancelled`, `pin refused: side full` (debug), `shape drag: no Shapes bar
to measure` (warn).

## Testing

| Rule                                                      | Test                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| Catalogue scope, keys, order, intents, armed read-back    | `apps/live/lib/whiteboard-shape-catalogue.test.ts`                         |
| Preselected set, six results, ranking, grid movement      | `apps/live/lib/whiteboard-shape-search.test.ts`                            |
| Default pins, the six slots, pick record, drops, outcomes | `apps/live/lib/whiteboard-shape-slots.test.ts`                             |
| Preference parsing and writing, emptied pins kept         | `apps/live/lib/whiteboard-dock-prefs.test.ts`                              |
| Picks counted, search pick, S request, pins, unpin count  | `apps/live/hooks/canvas/useWhiteboard.test.tsx`                            |
| Groups, order, tab stops, arrows, scroll re-anchoring     | `apps/live/components/canvas/whiteboard/WhiteboardDock.test.tsx`           |
| A press focuses the flyout once shown; Escape hands back  | `WhiteboardDock.test.tsx` "takes the focus on a press once it is shown"    |
| Panel form: sections, no separators, cog as footer row    | `WhiteboardDock.test.tsx` "WhiteboardDock in the Palette panel"            |
| Panel form: beside flyout, menu shapes shown, no menu     | `WhiteboardDock.test.tsx` "WhiteboardDock in the Palette panel"            |
| Off the dock: board side, centred, in viewport, tip over  | `WhiteboardDock.test.tsx` "offDock"                                        |
| Panel: keys in the tooltip not on tiles, Path's caption   | `WhiteboardDock.test.tsx` "captions each tile without its key letter"      |
| Panel: ArrowUp / ArrowDown step a row of tiles (D38)      | `WhiteboardDock.test.tsx` "walks a tile grid by rows"                      |
| Beside the panel: side with room, level, tip, viewport    | `WhiteboardDock.test.tsx` "besidePanel"                                    |
| Pinned bar, pressed state, Unpin menu, drags both ways    | `apps/live/components/canvas/whiteboard/ShapesGroup.test.tsx`              |
| Shapes flyout: hover focus, slots, results, menu, closing | `apps/live/components/canvas/whiteboard/ShapesFlyout.test.tsx`             |
| Dock position: parse, write, default top                  | `apps/live/lib/whiteboard-dock-prefs.test.ts`                              |
| Top and bottom wrapper, flyout and hint below or above    | `apps/live/components/canvas/whiteboard/WhiteboardDock.test.tsx`           |
| A top bar (strip or dock) crowding the top corners        | `apps/live/hooks/ui/useStripCrowdsCorners.test.tsx`                        |
| Settings row: Top / Bottom round trip, section, token     | `apps/live/components/dialogs/settings/settings-catalogue.test.ts`         |
| Telemetry sentences                                       | `apps/telemetry/app/event-explanation.test.ts`                             |
| Dock position and snap colours end to end (Toolbar)       | `whiteboard-dock-position.spec.ts`, `whiteboard-snap-colours.spec.ts`      |
| End to end                                                | Playwright, Chromium and WebKit, dark and light, 1600 × 900 and 820 × 1180 |

## Constants and configuration

| Constant                      | Value   | Provenance                | Safe range    |
| ----------------------------- | ------- | ------------------------- | ------------- |
| `PINNED_SHAPES_MAX`           | 7       | spec                      | 7             |
| `DEFAULT_PINNED_SHAPES`       | 2 kinds | spec                      |               |
| `SLOTS_PER_ROW`               | 3       | spec                      | 3             |
| `SHAPE_PICKS_PROTECTED`       | 5       | D16                       | 3 to 8        |
| `SLOT_BAR_REACH_PX`           | 44      | D22                       | 24 to 64      |
| `DockButton` size             | 36 px   | spec (the strip's tile)   | 36            |
| `DOCK_ICON_PX`                | 18 px   | the strip's glyph size    | 18            |
| `BESIDE_GAP_PX`               | 22 px   | panel padding 10 + 12 gap | 16 to 28      |
| `OFF_DOCK_GAP_PX`             | 8 px    | D36                       | 4 to 12       |
| `VIEWPORT_MARGIN_PX`          | 12 px   | the flyouts' clamp margin | 8 to 16       |
| `TIP_INSET_PX`                | 14 px   | D37 (card radius 12 + 2)  | 12 to 20      |
| Tip size                      | 10 px   | D37                       | 8 to 12       |
| `PANEL_COLUMNS`               | 3       | spec (the palette's grid) | 3             |
| `SHAPE_SEARCH_LIMIT`          | 6       | spec                      | 6             |
| `SHAPE_GRID_COLUMNS`          | 3       | six as two rows of three  | 3             |
| `SHAPE_PICKS_KEPT`            | 20      | spec (e.g. 20), D16       | 12 to 30      |
| `SHAPE_SLOT_DRAG_PX`          | 6       | spec                      | 4 to 10       |
| `HINT_MS`                     | 4000    | D17                       | 3000 to 6000  |
| Group gap                     | 12 px   | D18                       | 8 to 16       |
| Dock drops beside the cluster | 1760 px | D9 (widest dock 858 px)   | at least 1720 |
| Top dock's side clearance     | 4.25rem | D33 (menu button 12 + 46) | at least 4rem |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md): D9, D16 to D22, D33, D34, D36 to D38.
