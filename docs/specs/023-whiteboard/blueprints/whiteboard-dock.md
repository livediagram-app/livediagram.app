# Whiteboard dock: blueprint

Derived from [Whiteboard](../whiteboard.md) "What a whiteboard shows" and "Shape slots". The dock's
tools, pens, eraser and backgrounds are in [whiteboard-round-one](whiteboard-round-one.md); this
file owns the dock's layout (four groups), its modes, the Shapes flyout with its search and the
shape slots. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md)
as `Dn`.

Scope, by file (all under `apps/live/` unless stated):

| File                                                 | Role                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `components/canvas/whiteboard/WhiteboardDock.tsx`    | Orchestrates the groups, the one open flyout, the pins-full hint       |
| `components/canvas/whiteboard/DockToolbar.tsx`       | `DockToolbar` (a group: pill, toolbar, roving tab stop), `DockButton`  |
| `components/canvas/whiteboard/DrawingToolsGroup.tsx` | Select, Markers 1 to 3, Text, Sticky note, Path tool, Eraser           |
| `components/canvas/whiteboard/ShapesGroup.tsx`       | The pinned shapes, a separator, Shapes                                 |
| `components/canvas/whiteboard/HistoryGroup.tsx`      | Undo, Redo                                                             |
| `components/canvas/whiteboard/SettingsGroup.tsx`     | The cog, alone                                                         |
| `components/canvas/whiteboard/useDockFlyout.ts`      | Which flyout is open, where, hover open, delayed close, re-anchoring   |
| `components/canvas/whiteboard/dock-flyouts.tsx`      | Flyout bodies: pen, eraser, Settings, slot menu                        |
| `components/canvas/whiteboard/ShapesFlyout.tsx`      | The Shapes flyout: the field over the six slots or six results         |
| `components/canvas/whiteboard/useShapeSearch.ts`     | The query, what it shows, the active entry, arrow keys and Enter       |
| `components/canvas/whiteboard/ShapePreview.tsx`      | A catalogue shape's own preview                                        |
| `components/canvas/whiteboard/useShapeSlotDrag.ts`   | Dragging a flyout shape onto the pinned side, or a pinned one off it   |
| `components/canvas/whiteboard/SlotGhost.tsx`         | The dragged shape under the pointer                                    |
| `components/canvas/whiteboard/WhiteboardFlyout.tsx`  | A flyout: placement, focus in, `restoreFocus` to the board on closing  |
| `lib/whiteboard-shape-catalogue.ts`                  | The whiteboard shape catalogue, derived from the palette's shape tiles |
| `lib/whiteboard-shape-search.ts`                     | Ranked search (at most six) and grid movement (pure)                   |
| `lib/whiteboard-shape-slots.ts`                      | Default pins, the six slots, pick record, drops, outcomes (pure)       |
| `lib/whiteboard-dock-prefs.ts`                       | The dock's synced preferences: parse and write                         |
| `hooks/canvas/useWhiteboardDockPrefs.ts`             | Those preferences as state, written like every synced preference       |
| `hooks/canvas/useWhiteboard.ts`                      | `pickShape`, `pickSearchedShape` and the dock prefs on the dock model  |
| `lib/palette-search.ts`, `lib/search.ts`             | `SHAPE_TILES`, `shapeTileSearchItem`, `paletteRank`, shared            |
| `lib/user-preferences.ts`                            | `whiteboardDockMode`, `whiteboardPinnedShapes`, `whiteboardShapePicks` |
| `components/primitives/SearchInput.tsx`              | `listboxId`: the box as a combobox over an always-shown listbox        |
| `apps/telemetry/app/event-explanations.ts`           | Sentences for the new tokens                                           |

## Domain and naming

| Term            | Identifier                                           | Meaning                                                             |
| --------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| Group           | `DockToolbar`, `data-dock-group`                     | One pill: `drawing`, `shapes`, `history`, `settings`                |
| Dock mode       | `WhiteboardDockMode` (`simple` / `shapes`)           | Which groups show; Full drawing (`full`) is listed, not selectable  |
| Shape catalogue | `WHITEBOARD_SHAPE_CATALOGUE`                         | Every shape a whiteboard arms, keyed by `WhiteboardShapeKey`        |
| Shape key       | `WhiteboardShapeKey`                                 | A dock shape id, a shape kind, or `kind:choice`                     |
| Pinned shape    | `pinnedShapes`, `data-pinned-slot`                   | A kind on the bar's pinned side, before the separator (up to seven) |
| Default pins    | `DEFAULT_PINNED_SHAPES`                              | Arrow, Rectangle, until the user changes them                       |
| Slot            | `slotShapes` (`mostUsed`, `recent`)                  | One of the Shapes flyout's six: three Most used, three Recent       |
| Pick counts     | `ShapePicks`                                         | Per kind: `[count, lastPickedAt]`                                   |
| Slot outcome    | `SlotOutcome` (`pin` / `unpin` / `refused` / `none`) | What a drop or a slot menu choice does to the pins                  |
| Armed shape     | `armedShape`                                         | The catalogue shape in hand, if a board shape is armed              |

Banned synonyms: "favourite" for a pinned shape (Favourites is the palette's), "frequent slot" (the
slots are Most used and Recent), "More shapes" (merged into Shapes), "toolbar" for a group in prose
(it is a group; `role="toolbar"` is its semantics).

## Behaviour and state

### Groups and modes

- Order: Drawing tools, Shapes, History, Settings. `dockMode === 'simple'` renders every group but
  Shapes.
- **Drawing tools**: `select`, `main`, `second`, `third`, `text`, `sticky`, `path`, `eraser`, with
  dividers after Select, after the markers and before the eraser.
- **Shapes**: `pinned:<key>` × 0 to 7, the separator (`data-pinned-separator`), `shapes`. The
  slots live in the Shapes flyout, not on the bar.
- **History**: `undo`, `redo`; `aria-disabled` (not `disabled`) when `!canUndo` / `!canRedo`, a
  press then does nothing, and the button stays in the arrow-key order.
- **Settings**: `settings` (the cog) alone, last.
- Each group is a `DockToolbar`: its own roving tab stop (`focusKey`, the last focused button; while
  none is rendered, the group's first button), ArrowLeft / ArrowRight wrap within the group, Home /
  End jump. Tab moves between groups.
- Switching mode (Settings, Mode): `setDockMode(mode)`; the wrapper re-centres by itself (it is
  centred with `left: 50%` and `translate: -50%`); a flyout whose opener is in the Shapes group
  (`SHAPES_GROUP_FLYOUTS`: `shapes`, `slot`) closes when that group goes. The Settings flyout stays
  open; its cog moves (Shapes sat before it), so a layout effect on `dockMode` calls
  `reanchor()`, which measures the opener again and moves the flyout's centre onto it before paint.
- The shape keys (R, O, D, C, L, A) work in every mode (D15): the dock only hides buttons.

### Flyouts

- One at a time (`useDockFlyout`): `{ kind, hover, viaHover, left, openerKey, slot? }`, `left`
  measured once from the opener's centre against `[data-whiteboard-dock]` (and again by
  `reanchor()`). Kinds: a pen id, `eraser`, `settings`, `shapes`, `slot`.
- Hover opens only the Shapes flyout (pen or mouse; never touch); the rest open on a press. `hover`
  drives the delayed close (`HOVER_CLOSE_MS`); a press on a hover flyout, or working in its field
  (`stick()`), clears it. `viaHover` stays set for the flyout's life.
- The flyout focuses, on opening: its field if it has one (the Shapes flyout, even on a hover), else
  its pressed option, else its first button; a hover-opened flyout without a field never takes the
  focus.
- Closing: Escape returns the focus to the opener, except for a flyout opened by hover, whose field
  took the focus unasked: it closes with `restoreFocus`, which blurs to the board when the focus is
  still inside it or nowhere. A press elsewhere, a pick or the hover close do the same.
- The Shapes button prevents its mousedown's focus move while its flyout is open, so a press on a
  hover-opened flyout leaves the focus in the field.
- Scrolling the groups (narrow screens) moves the openers: an open flyout follows its opener
  (`reanchor()` on scroll) rather than closing, so a scroll that brings a button into view never
  closes the flyout it just opened.

### Settings

- Sections, top to bottom: **Background**, **Cursor** (Crosshair + nib first, the default),
  **Drawing**, **Mode** (Simple / With shapes / Full drawing). Full drawing is a `FlyoutOption` with
  `unavailable`: `aria-disabled="true"`, no pick, accessible name "Full drawing, coming soon", a
  "Coming soon" caption under its label.

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
  keywords (so "square" finds Rectangle), Line and Arrow their own. Then every palette shape tile
  (`SHAPE_TILES`) not in the Components category and not already one of the six, keyed `kind` or
  `kind:choice` (`shapeTileSearchItem`), labelled with the tile's display name.
- An entry's group is its tile's palette category (`section`, or `toolGroup` inside Tools); Line
  and Arrow file under Draw. Groups sort in `PALETTE_CATEGORIES` order; that order is the
  catalogue's, which breaks search ties and extends the slots' fallback.
- Intent: the six via `whiteboardShapeIntent`; a tile entry `{ type: 'shape', kind, ...choice,
board: true }`. `armedWhiteboardShape(intent)` reads a board intent back to its key.

### Shape slots

- **Pinned side**: `readWhiteboardDockPrefs` gives `DEFAULT_PINNED_SHAPES` (Arrow, Rectangle) until the user changes the pins; then the stored list, even empty.
- `pickShape(key)` (a slot, a pinned shape, a shape key; `pickSearchedShape` for a result) arms the
  entry's intent and records a pick: `recordShapePick(picks, key, Date.now())` counts it and stamps
  it, keeping at most `SHAPE_PICKS_KEPT` kinds by evicting the least recent kind that is not among
  the `SHAPE_PICKS_PROTECTED` most picked (never the kind just picked).
- `shapeSlots(picks, pinned)`: **Most used** first, the unpinned kinds by picks (ties to the most
  recent); then **Recent**, the unpinned kinds not in Most used, newest first, so a kind that is both
  shows only in Most used (its icon stays put); three each, none twice across pins
  and slots; an empty slot takes the next fallback kind not already showing (the Shapes flyout
  order, rectangle to arrow, then the catalogue). With the default pins: Most used Ellipse,
  Diamond, Cylinder; Recent Line, Parallelogram, Hexagon.
- Pressed state on the bar: a pinned shape when `armedShape` is its key; Shapes when a board shape
  is armed that is not pinned.
- **Drag** (`useShapeSlotDrag`, one for both sources, hosted by the dock): pointerdown (primary
  button) on a flyout entry (`from: 'flyout'`) or a pinned shape (`from: 'pinned'`) arms; travel
  of `SHAPE_SLOT_DRAG_PX` starts the drag, calls `stick()` so the flyout stays open, and measures
  the bar once (its box, the pinned shapes, the separator); each move computes
  `slotDropTarget(x, y, layout)`; release applies `resolveSlotDrop`, closes the flyout for a
  flyout drop that did anything, and swallows the click after it. Escape or pointercancel ends it
  with no drop.
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
  ends a long-press does not pick. Focus returns to the pinned shape.
- **Refused**: nothing is written; the hint "Seven shapes are pinned. Drag one out to swap." shows
  above the Shapes group for `HINT_MS` and in a `role="status"` region.

## Interfaces and contracts

```ts
// lib/whiteboard-shape-catalogue.ts
export type WhiteboardShapeKey = WhiteboardShapeId | ShapeKind | `${ShapeKind}:${string}`;
export type WhiteboardShapeEntry = {
  key: WhiteboardShapeKey;
  label: string;
  keywords: string;
  group: string;
  intent: PendingDraw;
  dockShape?: WhiteboardShapeId;
  tile?: PaletteTileDef;
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
export type WhiteboardDockMode = 'simple' | 'shapes';
export function readWhiteboardDockPrefs(prefs: UserPreferences): { mode; pinned; picks };
export function withWhiteboardDockPrefs(prefs: UserPreferences, patch: Partial<{ mode; pinned; picks }>): UserPreferences;

// useDockFlyout gains stick() and reanchor(); WhiteboardFlyout gains restoreFocus.
// The dock model (useWhiteboard) gains
pickShape(key: WhiteboardShapeKey): void; // was the six ids only
pickSearchedShape(key: WhiteboardShapeKey): void;
armedShape: WhiteboardShapeKey | null;
dockMode: WhiteboardDockMode; setDockMode(mode: WhiteboardDockMode): void;
pinnedShapes: WhiteboardShapeKey[]; slotShapes: ShapeSlots;
applySlotOutcome(outcome: SlotOutcome): void;
```

Parsing (`readWhiteboardDockPrefs`) rejects: a mode other than `simple` / `shapes` (including
`full`) → `shapes`; a pinned value that is absent or not an array → the default pins; a pinned
entry that is not a catalogue key, or a repeat → dropped; beyond seven → dropped; picks that are
not a plain object → none; a pick entry whose key is not a catalogue key, or whose value is not
`[positive integer, finite ms >= 0]` → dropped. An unknown key passed to `pickShape` arms nothing
and warns.

## Data and persistence

| Field                    | Where                                                    | Class           | Travels        |
| ------------------------ | -------------------------------------------------------- | --------------- | -------------- |
| `whiteboardDockMode`     | user preferences blob (unset = With shapes)              | synced per user | across devices |
| `whiteboardPinnedShapes` | user preferences blob (unset = defaults; `[]` = emptied) | synced per user | across devices |
| `whiteboardShapePicks`   | user preferences blob (unset = none)                     | synced per user | across devices |

Written through `useWhiteboardDockPrefs` off the freshest stored preferences
(`readUserPreferences()`), then `setUserPreferences` and `writeUserPreferences(prefs, ownerId)`
(localStorage cache plus the fire-and-forget PUT), as `useSwatchOverrides` does. A guest's owner id
is its participant id. The default mode and empty counts are removed rather than stored; the pins
are stored once changed, even empty. No migration: new optional keys; an older reader ignores them.

## Errors and edge cases

- A pinned or counted kind the palette no longer offers: dropped on read; its slot refills.
- A stored `full` mode (a newer client): read as With shapes.
- Seven pinned and a drop beside them: refused with the hint; the dragged slot is where it was.
- Every pin unpinned: the side stays empty (`[]` stored); the defaults never return on their own.
- A drag that measures no separator: logged, no drag.
- A slot re-ranked away while focused: the group's tab stop falls back to its first button.
- Simple mode set from another device while the Shapes flyout is open: the flyout closes.
- The blob's 4 KB cap: at most 20 picks (about 600 bytes) and 7 pins (about 110 bytes).
- Two kinds picked at the same millisecond (another device): the catalogue order breaks the tie.

## Security and trust

Keys come from a closed catalogue and are validated on read; telemetry carries fixed tokens only
(`ShapeSearch`, `ShapePinned`, `ShapeUnpinned`, `ModeSimple`, `ModeShapes`), never a kind.

## Performance and limits

- The catalogue is built once at module load (about 70 entries); search is a linear rank and sort
  per keystroke, well under a millisecond.
- The dock does no layout measurement at rest: flyout placement, the hint and a slot drag measure
  once, on opening or on the drag's start; re-anchoring measures one button per mode switch or
  scroll event while a flyout is open.
- Widest dock: 983 px (seven pins, 1600 px desktop, Chromium and WebKit).

## Presentation and UX

- Wrapper: bottom centre, `bottom-4` from 1760 px wide (D9), lifted above the bottom-right cluster
  below it; groups `gap-3` (12 px) apart inside one horizontal scroller (`-m-3 p-3`, so shadows are
  not clipped), each group the editor's panel surface, buttons 44 × 44 px.
- Flyouts sit above their opener in whichever group. The Shapes flyout is `8.5rem` wide with a
  fixed-height grid (two rows of three 40 px cells), so typing never resizes it.
- Flyout previews: the tile icon (or the dock glyph for the six), 20 px box, in the board's ink.
  Pinned shapes: the same preview in the dock's own text colour; one with a shape key (A, R, O, D,
  C, L) shows it bottom right and in `aria-keyshortcuts`, as every dock tool does.
- Drag: the source fades to 40 %, a ghost follows the pointer (portalled to the body), a 2 px brand
  marker shows the insertion point (rose when the drop would be refused), a pinned shape a full
  side would replace is ringed instead; the body cursor is `grabbing` or `not-allowed`.
- Copy: groups "Drawing tools", "Shapes", "History", "Settings"; buttons "Settings",
  "Undo", "Redo", "Text", "Sticky note", "Path tool", "Shapes", a shape by its label; flyout rows
  named (for screen readers only) "Recent shapes", "Most used shapes";
  Settings "Mode" with "Simple", "With shapes", "Full drawing" / "Coming soon"; search placeholder
  and name "Search shapes", clear "Clear the shape search", empty "No shapes match"; slot menu "Pin
  to dock", "Unpin"; hint "Seven shapes are pinned. Drag one out to swap."

## Accessibility

- Four `role="toolbar"` groups ("Drawing tools", "Shapes", "History", "Settings"), each labelled, horizontal, one tab stop, arrow keys within.
- Unavailable controls (Undo, Redo, Full drawing) use `aria-disabled` and stay focusable.
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
  and WebKit); only a pin or a mode switch, both the user's own act, changes the dock's width.
- INP: every dock handler sets state; search is synchronous and small.

## Observability

- `Whiteboard · Selected · ShapeSearch` (a typed result picked), `Whiteboard · Changed ·
ShapePinned` / `ShapeUnpinned` (a replacement reports `ShapePinned`; a reorder reports nothing),
  `Whiteboard · Changed · ModeSimple` / `ModeShapes`, fired before the preference is written.
- Logs: `[whiteboard] unknown shape` (warn), `[whiteboard-dock] shape drag started`, `shape
dropped`, `shape drag cancelled`, `pin refused: side full` (debug), `shape drag: no Shapes bar
to measure` (warn).

## Testing

| Rule                                                      | Test                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| Catalogue scope, keys, order, intents, armed read-back    | `apps/live/lib/whiteboard-shape-catalogue.test.ts`                         |
| Preselected set, six results, ranking, grid movement      | `apps/live/lib/whiteboard-shape-search.test.ts`                            |
| Default pins, the six slots, pick record, drops, outcomes | `apps/live/lib/whiteboard-shape-slots.test.ts`                             |
| Preference parsing and writing, emptied pins kept         | `apps/live/lib/whiteboard-dock-prefs.test.ts`                              |
| Picks counted, search pick, mode, pins, unpin keeps count | `apps/live/hooks/canvas/useWhiteboard.test.tsx`                            |
| Groups, order, tab stops, arrows, modes, re-anchoring     | `apps/live/components/canvas/whiteboard/WhiteboardDock.test.tsx`           |
| Pinned bar, pressed state, Unpin menu, drags both ways    | `apps/live/components/canvas/whiteboard/ShapesGroup.test.tsx`              |
| Shapes flyout: hover focus, slots, results, menu, closing | `apps/live/components/canvas/whiteboard/ShapesFlyout.test.tsx`             |
| Telemetry sentences                                       | `apps/telemetry/app/event-explanation.test.ts`                             |
| End to end                                                | Playwright, Chromium and WebKit, dark and light, 1600 × 900 and 820 × 1180 |

## Constants and configuration

| Constant                          | Value   | Provenance               | Safe range    |
| --------------------------------- | ------- | ------------------------ | ------------- |
| `PINNED_SHAPES_MAX`               | 7       | spec                     | 7             |
| `DEFAULT_PINNED_SHAPES`           | 2 kinds | spec                     |               |
| `MOST_USED_SLOTS`, `RECENT_SLOTS` | 3, 3    | spec                     | 3             |
| `SHAPE_PICKS_PROTECTED`           | 5       | D16                      | 3 to 8        |
| `SLOT_BAR_REACH_PX`               | 44      | D22                      | 24 to 64      |
| `SHAPE_SEARCH_LIMIT`              | 6       | spec                     | 6             |
| `SHAPE_GRID_COLUMNS`              | 3       | six as two rows of three | 3             |
| `SHAPE_PICKS_KEPT`                | 20      | spec (e.g. 20), D16      | 12 to 30      |
| `SHAPE_SLOT_DRAG_PX`              | 6       | spec                     | 4 to 10       |
| `HINT_MS`                         | 4000    | D17                      | 3000 to 6000  |
| Group gap                         | 12 px   | D18                      | 8 to 16       |
| Dock drops beside the cluster     | 1760 px | D9 (widest dock 983 px)  | at least 1735 |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md): D9, D15 to D22.
