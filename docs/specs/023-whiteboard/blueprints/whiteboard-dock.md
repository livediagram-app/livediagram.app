# Whiteboard dock: blueprint

Derived from [Whiteboard](../whiteboard.md) "What a whiteboard shows" and "Shape slots". The dock's
tools, pens, eraser and backgrounds are in [whiteboard-round-one](whiteboard-round-one.md); this
file owns the dock's layout (three groups), its modes, the More shapes search and the shape slots.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) as `Dn`.

Scope, by file (all under `apps/live/` unless stated):

| File                                                 | Role                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `components/canvas/whiteboard/WhiteboardDock.tsx`    | Orchestrates the groups, the one open flyout, the pins-full hint         |
| `components/canvas/whiteboard/DockToolbar.tsx`       | `DockToolbar` (a group: pill, toolbar, roving tab stop), `DockButton`    |
| `components/canvas/whiteboard/DrawingToolsGroup.tsx` | Select, Markers 1 to 3, Eraser, Text, Settings                           |
| `components/canvas/whiteboard/HistoryGroup.tsx`      | Undo, Redo                                                               |
| `components/canvas/whiteboard/ShapesGroup.tsx`       | Sticky note, Path tool, pinned, separator, frequent, Shapes, More shapes |
| `components/canvas/whiteboard/useDockFlyout.ts`      | Which flyout is open, where, hover open and delayed close                |
| `components/canvas/whiteboard/dock-flyouts.tsx`      | Flyout bodies: pen, eraser, Shapes, Settings, slot menu                  |
| `components/canvas/whiteboard/ShapeSearch.tsx`       | More shapes: the field and the results grid                              |
| `components/canvas/whiteboard/useShapeSearch.ts`     | The query, results, active result, arrow keys and Enter                  |
| `components/canvas/whiteboard/ShapePreview.tsx`      | A catalogue shape's own preview                                          |
| `components/canvas/whiteboard/useShapeSlotDrag.ts`   | Dragging a slot across the separator                                     |
| `lib/whiteboard-shape-catalogue.ts`                  | The whiteboard shape catalogue, derived from the palette's shape tiles   |
| `lib/whiteboard-shape-search.ts`                     | Ranked search and grid movement (pure)                                   |
| `lib/whiteboard-shape-slots.ts`                      | Frequent ranking, pick counts, drop targets and outcomes (pure)          |
| `lib/whiteboard-dock-prefs.ts`                       | The dock's synced preferences: parse and write                           |
| `hooks/canvas/useWhiteboardDockPrefs.ts`             | Those preferences as state, written like every synced preference         |
| `hooks/canvas/useWhiteboard.ts`                      | `pickShape`, `pickSearchedShape` and the dock prefs on the dock model    |
| `lib/palette-search.ts`, `lib/search.ts`             | `SHAPE_TILES`, `shapeTileSearchItem`, `paletteRank`, shared              |
| `lib/user-preferences.ts`                            | `whiteboardDockMode`, `whiteboardPinnedShapes`, `whiteboardShapePicks`   |
| `components/primitives/SearchInput.tsx`              | `listboxId`: the box as a combobox over an always-shown listbox          |
| `apps/telemetry/app/event-explanations.ts`           | Sentences for the new tokens                                             |

## Domain and naming

| Term            | Identifier                                           | Meaning                                                            |
| --------------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| Group           | `DockToolbar`, `data-dock-group`                     | One pill: `drawing`, `history` or `shapes`                         |
| Dock mode       | `WhiteboardDockMode` (`simple` / `shapes`)           | Which groups show; Full drawing (`full`) is listed, not selectable |
| Shape catalogue | `WHITEBOARD_SHAPE_CATALOGUE`                         | Every shape a whiteboard arms, keyed by `WhiteboardShapeKey`       |
| Shape key       | `WhiteboardShapeKey`                                 | A dock shape id, a shape kind, or `kind:choice`                    |
| Shape group     | `WHITEBOARD_SHAPE_GROUPS`                            | A palette category the catalogue is grouped by                     |
| Pinned shape    | `pinnedShapes`, `data-pinned-slot`                   | A kind the user pinned left of the separator (up to two)           |
| Frequent slot   | `frequentShapes`, `data-frequent-slot`               | One of two kinds ranked by picks, right of the separator           |
| Pick counts     | `ShapePicks`                                         | Per kind: `[count, lastPickedAt]`                                  |
| Slot outcome    | `SlotOutcome` (`pin` / `unpin` / `refused` / `none`) | What a drop or a slot menu choice does to the pins                 |
| Armed shape     | `armedShape`                                         | The catalogue shape in hand, if a board shape is armed             |

Banned synonyms: "favourite" for a pinned shape (Favourites is the palette's), "recent" for a
frequent slot, "toolbar" for a group in prose (it is a group; `role="toolbar"` is its semantics).

## Behaviour and state

### Groups and modes

- Order: Drawing tools, History, Shapes. `dockMode === 'simple'` renders the first two only.
- **Drawing tools**: `select`, `main`, `second`, `third`, `eraser`, `text`, `settings`, with
  dividers after Select, after the markers and before Settings.
- **History**: `undo`, `redo`; `aria-disabled` (not `disabled`) when `!canUndo` / `!canRedo`, a
  press then does nothing, and the button stays in the arrow-key order.
- **Shapes**: `sticky`, `path`, `pinned:<key>` × 0 to 2, the separator (`data-slot-separator`),
  `frequent:<key>` × 2, `shapes`, `search`.
- Each group is a `DockToolbar`: its own roving tab stop (`focusKey`, the last focused button; while
  none is rendered, the group's first button), ArrowLeft / ArrowRight wrap within the group, Home /
  End jump. Tab moves between groups.
- Switching mode (Settings, Mode): `setDockMode(mode)`; the wrapper re-centres by itself (it is
  centred with `left: 50%` and `translate: -50%`); a flyout whose opener is in the Shapes group
  (`SHAPES_GROUP_FLYOUTS`: `shapes`, `search`, `slot`) closes when that group goes. The Settings
  flyout stays: its opener's offset inside the wrapper does not change.
- Shape keys work in every mode (D15): the dock only hides buttons.

### Flyouts

- One at a time (`useDockFlyout`): `{ kind, hover, left, openerKey, slot? }`, `left` measured once
  from the opener's centre against `[data-whiteboard-dock]`. Kinds: a pen id, `eraser`, `settings`,
  `shapes`, `search`, `slot`.
- Hover opens only the Shapes flyout (pen or mouse; never touch); Settings and More shapes open on a
  press only. The hover rules are round one's.
- Scrolling the groups (narrow screens) closes an open flyout, since its opener moved.
- The flyout focuses, on opening: its field if it has one (More shapes), else its pressed option,
  else its first button; never when hover-opened.

### Settings

- Sections in order: **Mode** (Simple / With shapes / Full drawing), **Background**, **Drawing**,
  **Cursor**. Full drawing is a `FlyoutOption` with `unavailable`: `aria-disabled="true"`, no
  pick, accessible name "Full drawing, coming soon", a "Coming soon" caption under its label.

### More shapes

- Opens on a press; the field (`SearchInput` with `listboxId`, `role="combobox"`) takes focus.
- Empty field: every catalogue entry under its group heading (`WHITEBOARD_SHAPE_GROUPS`, palette
  order). Typed field: one ranked list, `paletteRank` over label and keywords (exact name, name
  prefix, name substring, keyword), ties in catalogue order; nothing matched shows "No shapes match".
- The active result starts at 0 on every query change; ArrowLeft / ArrowRight step the flat order,
  ArrowUp / ArrowDown the visual row (`gridStep`, six columns, groups starting new rows), clamped.
  The active result has `aria-selected`, `aria-activedescendant` on the field, is scrolled into view
  and its name shows under the grid.
- Enter picks the active result; a press on a result picks it (pointerdown is prevented so focus
  stays in the field). A pick calls `pickSearchedShape(key)` and closes the flyout. Escape closes it
  without picking and returns focus to More shapes.

### Shape catalogue

- The six Shapes flyout kinds first, keyed and labelled as the dock names them (`rectangle`,
  `ellipse`, `diamond`, `cylinder`, `line`, `arrow`); the first four take their palette tile's
  keywords (so "square" finds Rectangle), Line and Arrow their own. Then every palette shape tile
  (`SHAPE_TILES`) not in the Components category and not already one of the six, keyed `kind` or
  `kind:choice` (`shapeTileSearchItem`), labelled with the tile's display name.
- Group of an entry: its tile's palette category (`section`, or `toolGroup` inside Tools); Line and
  Arrow file under Draw. Groups sort in `PALETTE_CATEGORIES` order.
- Intent: the six via `whiteboardShapeIntent`; a tile entry `{ type: 'shape', kind, ...choice,
board: true }`. `armedWhiteboardShape(intent)` reads a board intent back to its key.

### Shape slots

- `pickShape(key)` (Shapes flyout, a slot, More shapes, a shape key) arms the entry's intent and
  records a pick: `recordShapePick(picks, key, Date.now())` counts it and keeps at most
  `SHAPE_PICKS_KEPT` kinds, evicting the weakest other kind (lowest count, then oldest).
- `frequentShapes(picks, pinned)`: catalogue keys by count descending, then last pick descending,
  excluding pinned; filled from the fallback (the six in flyout order); never a repeat.
- The frequent slots shown are held while a flyout is open or a slot is dragged
  (`useHeldWhile`), and catch up when both end.
- Pressed state: a slot when `armedShape` is its key; Shapes when a board shape is armed that is
  not on the bar and is one of the six (or not a catalogue shape); More shapes when a catalogue
  shape is armed that is neither on the bar nor one of the six.
- **Drag** (`useShapeSlotDrag`): pointerdown (primary button) arms; travel of `SHAPE_SLOT_DRAG_PX`
  starts the drag and measures the separator and pinned slots once; each move computes
  `slotDropTarget(x, layout)`; release applies `resolveSlotDrop(pinned, source, target)`; the click
  after a drag is swallowed. Escape or pointercancel ends it with no drop.
- `slotDropTarget`: x at or right of the separator's centre is `frequent`; left of it, over a
  pinned slot is `onto` that slot, else an insertion `index`.
- `resolveSlotDrop`: frequent side: a pinned source unpins, a frequent source does nothing. Pinned
  side, pinned source: moves (reorders), or nothing if unchanged. Pinned side, frequent source: with
  fewer than two pinned, inserts at the index (or before the slot it is onto); with two, replaces
  the slot it is onto, else `refused`.
- **Menu** (right-click, touch long-press via `useLongPress`, Shift+F10 or ContextMenu on a focused
  slot): a `slot` flyout titled with the shape's name and one option, "Pin to dock" (`pinFromMenu`:
  appended, `refused` with two) or "Unpin" (`unpinShape`). The release that ends a long-press does
  not pick. Focus returns to the slot's opener key.
- **Refused**: nothing is written; the hint "Two shapes are pinned. Drag one out to swap." shows
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
export const WHITEBOARD_SHAPE_GROUPS: readonly { id: string; label: string }[];
export function whiteboardShapeEntry(key: string): WhiteboardShapeEntry | undefined;
export function isWhiteboardShapeKey(key: unknown): key is WhiteboardShapeKey;
export function armedWhiteboardShape(intent: PendingDraw | null): WhiteboardShapeKey | null;

// lib/whiteboard-shape-search.ts
export function searchWhiteboardShapes(query: string): {
  searching: boolean;
  groups: { id: string; label: string; entries: WhiteboardShapeEntry[] }[];
};
export function gridStep(sizes: readonly number[], cols: number, index: number, dir: GridDirection): number;

// lib/whiteboard-shape-slots.ts
export type ShapePicks = Readonly<Partial<Record<WhiteboardShapeKey, readonly [number, number]>>>;
export function frequentShapes(picks: ShapePicks, pinned: readonly WhiteboardShapeKey[]): WhiteboardShapeKey[];
export function recordShapePick(picks: ShapePicks, key: WhiteboardShapeKey, now: number): ShapePicks;
export function slotDropTarget(x: number, layout: SlotLayout): SlotDropTarget;
export function resolveSlotDrop(pinned: readonly WhiteboardShapeKey[], source: SlotSource, target: SlotDropTarget): SlotOutcome;
export function pinFromMenu(pinned: readonly WhiteboardShapeKey[], key: WhiteboardShapeKey): SlotOutcome;
export function unpinShape(pinned: readonly WhiteboardShapeKey[], key: WhiteboardShapeKey): SlotOutcome;
export function dropIndicatorX(layout: SlotLayout, source: SlotSource, target: SlotDropTarget): number | null;

// lib/whiteboard-dock-prefs.ts
export type WhiteboardDockMode = 'simple' | 'shapes';
export function readWhiteboardDockPrefs(prefs: UserPreferences): { mode; pinned; picks };
export function withWhiteboardDockPrefs(prefs: UserPreferences, patch: Partial<{ mode; pinned; picks }>): UserPreferences;

// The dock model (useWhiteboard) gains
pickShape(key: WhiteboardShapeKey): void; // was the six ids only
pickSearchedShape(key: WhiteboardShapeKey): void;
armedShape: WhiteboardShapeKey | null;
dockMode: WhiteboardDockMode; setDockMode(mode: WhiteboardDockMode): void;
pinnedShapes: WhiteboardShapeKey[]; frequentShapes: WhiteboardShapeKey[];
applySlotOutcome(outcome: SlotOutcome): void;

// WhiteboardDockProps loses showHistory.
```

Parsing (`readWhiteboardDockPrefs`) rejects: a mode other than `simple` / `shapes` (including
`full`) → `shapes`; a pinned list that is not an array → none; a pinned entry that is not a
catalogue key, or a repeat → dropped; beyond two → dropped; picks that are not a plain object →
none; a pick entry whose key is not a catalogue key, or whose value is not `[positive integer,
finite ms >= 0]` → dropped. An unknown key passed to `pickShape` arms nothing and warns.

## Data and persistence

| Field                    | Where                                       | Class           | Travels        |
| ------------------------ | ------------------------------------------- | --------------- | -------------- |
| `whiteboardDockMode`     | user preferences blob (unset = With shapes) | synced per user | across devices |
| `whiteboardPinnedShapes` | user preferences blob (unset = none)        | synced per user | across devices |
| `whiteboardShapePicks`   | user preferences blob (unset = none)        | synced per user | across devices |

Written through `useWhiteboardDockPrefs` off the freshest stored preferences
(`readUserPreferences()`), then `setUserPreferences` and `writeUserPreferences(prefs, ownerId)`
(localStorage cache plus the fire-and-forget PUT), as `useSwatchOverrides` does. A guest's owner id
is its participant id. Default or empty values are removed, not stored. No migration: new optional
keys; an older reader ignores them.

## Errors and edge cases

- A pinned or counted kind the palette no longer offers: dropped on read; its slot refills.
- A stored `full` mode (a newer client): read as With shapes.
- Two pinned and a drop between them: refused with the hint; the dragged slot is where it was.
- A drag that measures no separator: logged, no drag.
- A slot re-ranked away while focused: the group's tab stop falls back to its first button.
- Simple mode set from another device while More shapes is open: the flyout closes.
- The blob's 4 KB cap: at most 12 counts (about 360 bytes) and 2 pins (about 40 bytes).

## Security and trust

Keys come from a closed catalogue and are validated on read; telemetry carries fixed tokens only
(`ShapeSearch`, `ShapePinned`, `ShapeUnpinned`, `ModeSimple`, `ModeShapes`), never a kind.

## Performance and limits

- The catalogue is built once at module load (about 70 entries); search is a linear rank and sort
  per keystroke, well under a millisecond.
- The dock does no layout measurement at rest: flyout placement, the hint and a slot drag measure
  once, on opening or on the drag's start.
- Widest dock: 858 px (two pins, 1600 px desktop, Chromium).

## Presentation and UX

- Wrapper: bottom centre, `bottom-4` from 1680 px wide (D9), lifted above the bottom-right cluster
  below it; groups `gap-3` (12 px) apart inside one horizontal scroller (`-m-3 p-3`, so shadows are
  not clipped), each group the editor's panel surface, buttons 44 × 44 px.
- Flyouts sit above their opener in whichever group; More shapes is `16.5rem` wide with a 15rem
  results area (six 40 px cells per row), so typing never resizes it.
- Search previews: the tile icon (or the dock glyph for the six), 20 px box, in the board's ink.
  Slot icons: the same preview in the dock's own text colour.
- Drag: the slot fades to 40 %, a ghost follows the pointer (portalled to the body), a 2 px brand bar
  marks the insertion point (rose when the drop would be refused), a pinned slot it would replace is
  ringed; the body cursor is `grabbing` or `not-allowed`.
- Copy: groups "Drawing tools", "History", "Shapes"; buttons "Settings", "Undo", "Redo", "Sticky
  note", "Path tool", "Shapes", "More shapes", a slot by its shape's label; Settings "Mode" with
  "Simple", "With shapes", "Full drawing" / "Coming soon"; search placeholder and name "Search
  shapes", clear "Clear the shape search", empty "No shapes match"; slot menu "Pin to dock",
  "Unpin"; hint "Two shapes are pinned. Drag one out to swap."

## Accessibility

- Three `role="toolbar"` groups, each labelled, horizontal, one tab stop, arrow keys within.
- Unavailable controls (Undo, Redo, Full drawing) use `aria-disabled` and stay focusable.
- More shapes: `role="combobox"` field with `aria-controls` / `aria-expanded` /
  `aria-autocomplete="list"` / `aria-activedescendant`; a `role="listbox"` of `role="option"`
  results (`aria-selected`, labelled by name), grouped by `role="group"` under their headings.
- Pinning has a keyboard path (Shift+F10 or ContextMenu, then the menu), not just the drag.
- The refusal is announced through a `role="status"` region.

## Web Experience

- Zero layout shift: picking a tool or opening a flyout never moves a group (measured in Chromium
  and WebKit); only a pin or a mode switch, both the user's own act, changes the dock's width.
- INP: every dock handler sets state; search is synchronous and small.

## Observability

- `Whiteboard · Selected · ShapeSearch`, `Whiteboard · Changed · ShapePinned` / `ShapeUnpinned`
  (a replacement reports `ShapePinned`), `Whiteboard · Changed · ModeSimple` / `ModeShapes`, fired
  before the preference is written.
- Logs: `[whiteboard] unknown shape` (warn), `[whiteboard-dock] slot drag started`, `slot dropped`,
  `slot drag cancelled`, `pin refused: two pinned` (debug), `slot drag: no separator to measure`
  (warn).

## Testing

| Rule                                                    | Test                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| Catalogue scope, keys, groups, intents, armed read-back | `apps/live/lib/whiteboard-shape-catalogue.test.ts`                         |
| Search ranking, grouping, no match, grid movement       | `apps/live/lib/whiteboard-shape-search.test.ts`                            |
| Frequent ranking, counts, drop targets, outcomes        | `apps/live/lib/whiteboard-shape-slots.test.ts`                             |
| Preference parsing and writing                          | `apps/live/lib/whiteboard-dock-prefs.test.ts`                              |
| Picks counted, search pick, mode, pins, telemetry       | `apps/live/hooks/canvas/useWhiteboard.test.tsx`                            |
| Groups, tab stops, arrows, modes, history, settings     | `apps/live/components/canvas/whiteboard/WhiteboardDock.test.tsx`           |
| Shapes flyout, Path tool, slots, menu, drag, holding    | `apps/live/components/canvas/whiteboard/ShapesGroup.test.tsx`              |
| More shapes: focus, groups, ranking, keys, pick, ink    | `apps/live/components/canvas/whiteboard/ShapeSearch.test.tsx`              |
| Telemetry sentences                                     | `apps/telemetry/app/event-explanation.test.ts`                             |
| End to end                                              | Playwright, Chromium and WebKit, dark and light, 1600 × 900 and 820 × 1180 |

## Constants and configuration

| Constant                      | Value   | Provenance              | Safe range    |
| ----------------------------- | ------- | ----------------------- | ------------- |
| `PINNED_SHAPES_MAX`           | 2       | spec                    | 2             |
| `FREQUENT_SHAPE_SLOTS`        | 2       | spec                    | 2             |
| `SHAPE_PICKS_KEPT`            | 12      | D16                     | 4 to 20       |
| `SHAPE_SLOT_DRAG_PX`          | 6       | spec                    | 4 to 10       |
| `SHAPE_SEARCH_COLUMNS`        | 6       | fits the 16.5rem flyout | 5 to 6        |
| `HINT_MS`                     | 4000    | D17                     | 3000 to 6000  |
| Group gap                     | 12 px   | D18                     | 8 to 16       |
| Dock drops beside the cluster | 1680 px | D9 (widest dock 858 px) | at least 1610 |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md): D9, D15 to D19.
