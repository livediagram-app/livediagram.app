# Path tool: blueprint

Derived from [Path tool](../path-tool.md), with [Whiteboard, round one](whiteboard-round-one.md) for
the dock, keys, ink and board style memory, and [Multi-point line / polygon tool](../../008-canvas/polygon-tool.md)
for the click-to-place gesture it grows from. The spec decides; this file adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Pn`.

Scope, by file:

| File                                                        | Role                                                                                                                              |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/element-types.ts`                    | `PathElement`, `PathNode`, `PathHandleMode`, `PathPoint`                                                                          |
| `packages/document/src/index.ts`                            | `PathElement` joins `BoxedElement`; re-exports                                                                                    |
| `packages/document/src/path-geometry.ts`                    | Pure curve maths: segments, `d`, bounds, split, bend, smooth, nearest                                                             |
| `packages/document/src/path-element.ts`                     | Element ⇄ anchors: `pathAnchors`, `pathWorldAnchors`, `pathGeometry`, `createPath`, `reshapePath`, `continuedPath`, `reversePath` |
| `packages/document/src/validate.ts`                         | `'path'` in `ELEMENT_TYPES`; node, handle, mode and count checks                                                                  |
| `packages/document/src/colors.ts`                           | Padding, default stroke and fill, border support for `path`                                                                       |
| `packages/document/src/element-kind-label.ts`               | `Path`                                                                                                                            |
| `packages/document/src/whiteboard.ts`                       | Ink projection for `path`                                                                                                         |
| `packages/document/src/whiteboard-stroke.ts`                | `pathTouchesBrush`: the eraser touches a path by its line or its fill                                                             |
| `packages/document/src/svg-render*.ts`                      | `svgPathElementShape`: the export twin of the canvas path                                                                         |
| `apps/api/src/openapi/schemas.generated.ts`                 | Regenerated: `PathElement` in `BoxedElement`                                                                                      |
| `packages/api-schema/src/telemetry-schema.ts`               | (no change: `Whiteboard`, `Element`, `Selected`, `Added`, `Changed` exist)                                                        |
| `apps/live/lib/path-draw.ts`                                | Pure drawing state machine                                                                                                        |
| `apps/live/lib/path-edit.ts`                                | Pure edit-mode operations, hit test, node types, open / close, cursors, `toLocal` / `toWorld`                                     |
| `apps/live/lib/path-edit-keys.ts`                           | `pathEditKey`: what one key does in edit mode                                                                                     |
| `apps/live/lib/whiteboard-erase.ts`                         | `pathsTouched`: the eraser takes a path whole                                                                                     |
| `apps/live/lib/export-as-seen.ts`                           | `tabAsSeen`: an export draws stock colours for its canvas                                                                         |
| `apps/live/lib/draw-mode.ts`                                | `PendingDraw` `{ type: 'path' }`, banner, cursor                                                                                  |
| `apps/live/lib/whiteboard-tool.ts`                          | `WhiteboardTool` gains `path`                                                                                                     |
| `apps/live/lib/quick-style.ts`, `quick-style-tool.ts`       | A path is a quick-style target; "Next path" phantom                                                                               |
| `apps/live/lib/style-memory.ts`                             | Style kind `path` (`board:path` on a whiteboard)                                                                                  |
| `apps/live/lib/element-names.ts`                            | "Path, N points" / "Closed path, N points"                                                                                        |
| `apps/live/lib/excalidraw-export.ts`                        | A path as a sampled `line`                                                                                                        |
| `apps/live/components/canvas/path/PathSvg.tsx`              | The canvas renderer, shared by committed and draft paths                                                                          |
| `apps/live/components/canvas/path/usePathDrawGesture.ts`    | Drawing: presses, drags, keys, commit                                                                                             |
| `apps/live/components/canvas/path/usePathEditGesture.ts`    | Edit mode: presses, drags, keys, commit                                                                                           |
| `apps/live/components/canvas/path/usePathTool.ts`           | Composes both for `Canvas`: press intercept, displayed elements, layers                                                           |
| `apps/live/components/canvas/path/PathDraftLayer.tsx`       | The path being drawn, rubber band, rings                                                                                          |
| `apps/live/components/canvas/path/PathEditLayer.tsx`        | Nodes, handles, box, snap guides                                                                                                  |
| `apps/live/components/canvas/path/PathEditToolbar.tsx`      | The edit toolbar: node type, Delete point, Close / Open path, Done                                                                |
| `apps/live/components/canvas/path/path-markers.tsx`         | Node and handle markers, `PATH_OVERLAY_Z`                                                                                         |
| `apps/live/components/canvas/SelectionPopover.tsx`          | Edit points on a selected path                                                                                                    |
| `apps/live/components/canvas/useBoxedElementGestures.ts`    | A double press (a double-tap) opens a path's edit mode                                                                            |
| `apps/live/components/canvas/element-variant.ts`            | `editingLook`: a path in its edit mode takes no text cursor and no lift                                                           |
| `apps/live/hooks/canvas/useEditModeContextMenu.ts`          | No element menu beside a path in its edit mode                                                                                    |
| `apps/live/app/globals.css`                                 | `[data-path-cursor]`: descendants inherit the edit cursor                                                                         |
| `apps/live/components/dialogs/EditorTabDialogs.tsx`         | Exports `tabAsSeen`                                                                                                               |
| `apps/live/hooks/canvas/usePathCommits.ts`                  | Editor side: `commitPath`, `commitPathEdit`, telemetry                                                                            |
| `apps/live/hooks/canvas/useWhiteboard.ts`                   | `pickPath`, `pathEditing`, `leavePathEdit`                                                                                        |
| `apps/live/hooks/canvas/editor-shortcut-keys.ts`            | `P` on a whiteboard; `WHITEBOARD_TOOL_KEYS.path`                                                                                  |
| `apps/live/components/canvas/whiteboard/WhiteboardDock.tsx` | The Path tool button (`ShapePenIcon`); Select's edit-mode glyph (`EditPointsIcon`)                                                |
| `apps/live/components/palette/palette-icons.tsx`            | `ShapePenIcon` (the Shape Pen tile's icon, shared with the dock), `EditPointsIcon`                                                |
| `apps/telemetry/app/event-explanations.ts`                  | Sentences for the four events                                                                                                     |
| `apps/help/app/canvas/draw-mode/page.mdx`                   | The Path tool section                                                                                                             |

## Domain and naming

| Term        | Identifier                                   | Meaning                                                               |
| ----------- | -------------------------------------------- | --------------------------------------------------------------------- |
| Path        | `PathElement`, `type: 'path'`                | An editable Bézier path element                                       |
| Node        | `PathNode` (stored), `PathAnchor` (canvas)   | An anchor point; stored normalised, worked on in canvas px            |
| Handle      | `handleIn`, `handleOut`                      | A node's incoming / outgoing control point; absent = none             |
| Handle mode | `PathHandleMode` (`corner/mirrored/aligned`) | How a node's two handles relate                                       |
| Segment     | `PathSegment`                                | The cubic between node `i` and `i + 1` (and last → first when closed) |
| Closed      | `closed: boolean`                            | The last node joins the first                                         |
| Path tool   | `PendingDraw` `{ type: 'path' }`             | The held pen that places nodes                                        |
| Draft       | `PathDraft`                                  | The path being drawn, not yet committed                               |
| Continue    | `PathDraft.continuing`                       | A draft resumed from an open path's end node                          |
| Edit mode   | `editingId === path.id`                      | A path's own editor; its nodes and handles shown                      |
| Node box    | `PathEditState.box`                          | The drag rectangle that selects nodes in edit mode                    |

Banned synonyms: "vector" for the element, "point" in code for a node (a `PathPoint` is a normalised
coordinate pair, the stored form of a node's position or handle), "anchor" for a node in copy
(copy says "point"), "pen" for the Path tool (the pens are the markers).

## Behaviour and state

### The element

```ts
export type PathHandleMode = 'corner' | 'mirrored' | 'aligned';
export type PathPoint = { nx: number; ny: number };
export type PathNode = PathPoint & {
  mode: PathHandleMode;
  handleIn?: PathPoint;
  handleOut?: PathPoint;
};
export type PathElement = {
  id: ElementId;
  type: 'path';
  layerId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  nodes: PathNode[];
  closed: boolean;
  strokeColor?: string;
  strokeSwatch?: QuickSwatchSlot;
  fillColor?: string;
  fillSwatch?: QuickSwatchSlot;
  strokeWidth?: BorderStroke;
  strokeStyle?: BorderStyle;
  // …the shared boxed-element bag, as FreehandElement declares it (label fields stay
  // declared for the union code paths; a path takes no typed label, P1).
};
```

- Handles are stored as **absolute** normalised positions (not offsets), so a resize scales them with
  the nodes. Normalised values may lie outside 0 to 1 (a handle beyond the drawn curve).
- `PathAnchor = { x, y, mode, handleIn?: Point, handleOut?: Point }` in canvas px, unrotated:
  `x = el.x + nx · max(width, 1)`, the same for handles and `y`.
- **Valid**: `nodes.length >= 2`; closed needs `>= 3`, or 2 with at least one handle
  (`isCommittablePath(anchors, closed)`). Nothing invalid is committed; an edit that would leave an
  invalid path deletes the element.

### Geometry (`path-geometry.ts`, `path-element.ts`)

- `pathSegments(anchors, closed)`: for `i` in `0 … n − 2` (and `n − 1 → 0` when closed) a
  `PathSegment = { from: i, to: j, p0, c1, c2, p3, straight }` with `c1 = handleOut(i) ?? p0`,
  `c2 = handleIn(j) ?? p3`, `straight` when neither handle exists.
- `pathD(anchors, closed, fmt = identity)`: `M p0` then per segment `L p3` (straight) or
  `C c1 c2 p3`; `Z` when closed. No anchors: `''`.
- `cubicAt(seg, t)`; `pathBounds` takes each segment's extremes from the roots of the derivative per axis
  (quadratic in `t`, roots in (0, 1)), plus `p0`, `p3`. `pathBounds` is their union.
- `pathGeometry(anchors, closed)`: the box is `pathBounds`; a dimension under 1 grows to 1 about its
  centre (a straight horizontal or vertical path). Nodes and handles normalise against it. No
  anchors: a 1 × 1 box at the origin.
- `createPath(anchors, closed)`: `{ id: crypto.randomUUID(), type: 'path', ...pathGeometry, closed }`.
- `reshapePath(el, anchors, closed)`: the element with `pathGeometry(anchors, closed)`; for a rotated
  element, the box is then translated by `t = (c − c′) − R(c − c′)` (`c` the old centre, `c′` the new,
  `R` the rotation) so every node stays where it was on screen.
- `splitSegment(seg, t)`: de Casteljau; returns the two halves (`insertNodeAt` makes the new node
  `aligned` when the segment was curved, its two new handles collinear but of their own lengths, and
  `corner` with no handles when straight).
- `nearestOnSegment(seg, p)`: 24 samples, then 12 steps of interval halving about the best;
  `{ t, point, distance }`. `nearestOnPath` takes the best segment.
- `bendSegment(seg, t, target)`: with `D = target − B(t)` and `k = 3t(1 − t)((1 − t)² + t²)`,
  `c1 += D · (1 − t) / k`, `c2 += D · t / k`, so the curve passes through `target` at `t`. `t` clamps
  to [0.05, 0.95]. A straight segment first takes `c1 = p0`, `c2 = p3`.
- `smoothHandles(anchors, i, closed)` (P2): with both neighbours, `v = (next − prev) / 6`,
  `handleOut = node + v`, `handleIn = node − v`; at an open end, towards its one neighbour `q`,
  `v = (q − node) / 3` (out when `q` is next, in when previous), the other handle its mirror.
- `constrain45(from, to)`: `to` rotated to the nearest multiple of 45° about `from`, length kept.
- `partnerHandle(node, moved, mode)`: mirrored → `node − (moved − node)`; aligned → opposite
  direction, the partner's own length; corner → partner unchanged.
- `samplePath(anchors, closed, perSegment = 16)`: a polyline (straight segments: two points).

### Drawing (`path-draw.ts`, `usePathDrawGesture`)

State, local to the canvas: `PathDraft = { anchors, placed, continuing, lastPlacedAt } | null`,
where `placed` counts the nodes this draft placed (Backspace removes only those),
`continuing = { id } | null`, and `lastPlacedAt` the last placement's time (cleared once that press
became a drag, which is never half a double-click).

A **press** with the tool in hand, primary button, not Space-held, at canvas point `p`: Ctrl / Cmd
and Alt first (see [Editing while drawing](#editing-while-drawing-usepathdrawgesture)), then
`classifyPathPress`, in order, the radius being `PATH_CLOSE_PX / zoom` (a finger:
`PATH_TOUCH_HIT_PX / zoom`):

1. Within the radius of the draft's **last** node and within `PATH_DOUBLE_PRESS_MS` of that node's
   placement: **finish** (a double-click).
2. Within that radius of the **first** node with `anchors.length >= 2`: a **close press**; the drag
   that follows pulls out node 0's handles (`handleOut` = pointer, `handleIn` its mirror, mode
   `mirrored`). Release: commit closed when `isCommittablePath(anchors, true)` (P3), else nothing.
3. Within that radius of the **last** node (later than a double press): a drag moves it; a release
   without one makes it a **cusp**: its `handleOut` is removed (mode `corner`).
4. Within that radius of any other placed node: a drag moves it; a click does nothing (P18).
5. No draft and within that radius of an **end node of an open path** on the tab (unlocked, not on an
   inert layer, not being edited): **continue**. Its anchors, in world px (rotation baked in, P4), are
   the draft, reversed when the start node was pressed; `continuing = { id, reversed }`; `placed = 0`.
6. Otherwise **place** a node at `p` (Shift: `constrain45(last, p)`), mode `corner`, no handles; the
   drag that follows shapes it. The first node of a new draft clears the selection.

A **drag** (the pointer moves `PATH_DRAG_THRESHOLD_PX` screen px from the press): the node becomes
`mirrored` with `handleOut` = pointer (Shift: `constrain45(node, pointer)`) and `handleIn` its mirror.
**Alt** at any move: the node becomes `corner` and only `handleOut` follows from then on (its
`handleIn` stays where it was). **Space** held: the move translates the node and both its handles
instead; releasing Space resumes shaping from the node's new place. Release ends the drag.

**Keys** (capture phase, while a draft exists; `preventDefault` + `stopImmediatePropagation`):

- `Enter`: finish (commit open with `>= 2` nodes; with fewer, cancel, P5).
- `Escape`: with `>= 2` nodes finish; else cancel. With no draft the key falls through, and the
  editor's own Escape puts the tool down.
- `Backspace` / `Delete`: remove the last placed node; with `placed === 0`, cancel (a continued path
  is left as it was).
- `Ctrl/Cmd+Z`: **undo while drawing**: the last placed node goes (handles and all, `removeLastPlaced`)
  and is pushed on the draft's redo list; with `placed <= 1` the draft is cancelled. `Ctrl/Cmd+Shift+Z`
  and `Ctrl+Y`: the last node on the redo list goes back on the end (`placed + 1`). Both are claimed
  whenever a draft exists, so the board's history never runs under a draft. Placing a node, or the
  draft ending, empties the redo list. `usePathDrawGesture.history`
  (`{ canUndo: true, canRedo, undo, redo }`, null without a draft) replaces `canUndo` / `canRedo` /
  `onUndo` / `onRedo` on `CanvasChrome`, so the dock's History group and the corner cluster step through
  the draft too.
- Space, Alt, Shift: read from the pointer events and a Space key flag.

**Rubber band**: while not dragging, the last node to `cursor` (Shift: constrained) as a cubic
`last, last.handleOut ?? last, cursor, cursor`, drawn in the draft's style. The cursor follows window
`pointermove`, one render per animation frame.

**Rings**: a closing ring on the first node while the cursor is within the hit radius and
`anchors.length >= 2`; a continue ring on an open path's end node while there is no draft.

**Finish / commit**: `onCommitPath({ anchors, closed, continuing })`. The tool stays in hand; the
draft clears. Picking another tool (the intent leaves `path`) with a draft of `>= 2` nodes commits it
open first; with fewer it is dropped. A tab switch drops the draft.

**Editor side** (`usePathCommits.commitPath`): refused when `editsBlocked` or not committable. New:
`styleNewElement(createPath(anchors, closed))` appended (one `commit`), track `Element·Added·Path`,
and selected (the tool stays in hand; the first node of the next path deselects it). Continuing: the element with that id is replaced by `reshapePath` of it with the new
anchors (unrotated, `rotation` dropped), keeping every other field, one `commit`, track
`Element·Added·Path` (P6). A continued id that no longer exists (deleted by a peer): committed as new.

**Announcements** (`announce`): first node "Path started"; each later node "N points"; a close "Path
closed"; a finish "Path finished".

### Edit mode (`path-edit.ts`, `usePathEditGesture`, `PathEditToolbar`)

- **In**: `beginEdit(id)` on a path sets `editingId`: a double-click (or double-tap: the element's
  press ledger pairs two presses, `useBoxedElementGestures`) with Select, a Space-tap, **Edit
  points** in the selection toolbar (`SelectionPopover.onEditPoints`, a path only), and `Enter`
  with exactly one unlocked path selected and nothing editing (the gesture's own keydown
  listener). A path that lands from the Path tool is selected (the tool stays in hand), so the
  same ways reach it at once; `openPathEdit(id)` (editor side) puts a held Path tool down first.
  **Out**: `Escape` with no nodes selected, `Enter`, **Done**, a click (no drag) on empty space
  (which also deselects, P15), the dock's Select, a tool picked, the path deleted or locked, the tab
  switched: `onCancelEdit()`. Undo and redo keep edit mode open (the path's reopens once the
  editor's undo has run, P16).
- `PathEditState = { selected: ReadonlySet<number>, drag, draft, toolbarAt }` where `draft` is the
  anchors while a gesture is in flight (null otherwise) and `toolbarAt` the node a long-press chose
  (null: the toolbar sits over the path). The canvas shows the edited element through
  `reshapePath(el, draft ?? anchors)`, so the element renders what the gesture holds.
- **Hit test** (`pathEditHit(anchors, closed, selected, p, zoom, strokePx, radiusPx)`), in the
  element's unrotated frame (the pointer is rotated by `−rotation` about the box centre): the
  nearest of the **visible handles** and the **nodes** within `radiusPx / zoom` (a node wins a tie,
  so a handle lying on its node never hides it), else a **segment** (within
  `STROKE_HIT_SCREEN_PX / zoom + strokePx / 2`), else **empty**. `radiusPx` is `PATH_NODE_HIT_PX`
  (12, a 24 x 24 target) for a mouse or pen and `PATH_TOUCH_HIT_PX` (16) for a finger. Visible
  handles: both of each selected node's, `handleOut` of its previous neighbour and `handleIn` of
  its next.
- **Press on a node**: Alt: toggle smooth (commit). A press within `PATH_DOUBLE_PRESS_MS` of a press
  on the same node (a double-click or double-tap): toggle smooth (commit). Shift: toggle it in the
  selection. Otherwise, when not selected, select only it. A drag then moves every selected node,
  handles with them (Shift: `constrain45` of the delta); snapping applies to the pressed node. A
  finger held still on a node for `PATH_LONG_PRESS_MS` selects only it and brings the toolbar to it.
- **Press on a handle**: drag it (Shift: `constrain45(node, pointer)`); the partner follows the
  node's mode; Alt at any move: the node becomes `corner` and the partner stays.
- **Press on a segment**: release without a drag inserts an `aligned` node there (`splitSegment` at
  the nearest `t`; an end with no handle keeps none) and selects it; a drag bends the segment
  through the pointer (`bendSegment` at the pressed `t`); the end nodes' partners follow their modes.
- **Press on empty**: a drag draws the node box (Shift adds to the selection); a release without a
  drag leaves edit mode.
- **Keys** (capture phase while editing): `Escape` clears selected nodes, else leaves; `Enter`
  leaves; `Backspace` / `Delete` delete the selected nodes; arrows nudge them 1 px (Shift 10 px);
  `J` with both end nodes of an open path selected closes it; `Tab` / `Shift+Tab` select the next /
  previous node (P7); `Cmd/Ctrl+A` selects every node (P8); `Cmd/Ctrl+Z` / `Y` fall through to the
  editor's undo and redo.
- **Toggle smooth**: a `corner` node takes `smoothHandles` and `mirrored`; any other loses both
  handles and becomes `corner`.
- **Set node type** (`setNodeType(anchors, selected, type, closed)`), from the toolbar:
  - `corner`: both handles removed.
  - `mirrored`: with both handles, the direction `normalise(normalise(out − node) +
normalise(node − in))` (the handles' averaged angle) and the mean of their lengths, either
    side; with one handle, it and its mirror; with none, `smoothHandles`.
  - `aligned`: with both handles, that same direction, each handle keeping its length; with one,
    the node only changes mode; with none, `smoothHandles`.
    The toolbar shows the type every selected node shares (`sharedNodeType`), else none pressed.
- **Delete nodes**: the selected nodes go; their neighbours join (a joining segment keeps the
  survivors' facing handles). Closed stays closed. Invalid afterwards: the element is deleted.
  Nothing selected: nothing happens (P9).
- **Close / open** (toolbar): **Close path** closes an open path, joining its ends (with any
  selection; `J` asks for both ends selected), kind `join`. **Open path** (a closed path, exactly
  one node selected): `openPathAt(anchors, i)` runs `i, i+1, …, n−1, 0, …, i−1` then a copy of `i`;
  the first keeps only its `handleOut`, the copy only its `handleIn`, both `corner`; kind `edit`.
- **Snapping** (dragging nodes): per axis, the pressed node's candidate is the nearest `x` (and `y`)
  among the path's unmoved nodes and its own original position, within `PATH_SNAP_PX / zoom`; the
  delta shifts to match and a guide line is shown for each axis that snapped.
- **Cursors** (`pathEditCursor`): between gestures a window `pointermove` hit-tests what a press would land on: `move` over a node or handle, `PATH_ADD_CURSOR` (a pen nib with a plus, hotspot at its tip, `copy` fallback) over a segment, `default` over the fill, other elements and empty space; a gesture keeps the cursor of what it pressed. `usePathTool.cursor` sets it on `<main>` and the canvas layer, whose `data-path-cursor` makes every descendant inherit it (`globals.css`, beside `data-pen-in-hand`). A path in its edit mode never takes the typed-label look (`editingLook`: no `cursor-text`, no `zIndex: 10` lift), and the element menu that rides beside a label being typed never opens for it (`useEditModeContextMenu`). `<main>` is `select-none`, so no drag selects text.
- **On top**: `PathEditLayer` and `PathDraftLayer` draw at `zIndex: PATH_OVERLAY_Z` (40) in the canvas layer, above every element, the selection chrome (30) and a lifted label (10), whatever the path's order, layer or fill; the edit toolbar floats in the overlay band above the canvas like the selection toolbar.
- **The edit toolbar** (`PathEditToolbar`, `role="toolbar"`, "Edit path", `data-floating-panel`): in
  screen space above the path's box (or just above the long-pressed node), clamped to the canvas;
  a radio group "Node type" (Corner, Mirrored, Aligned; disabled with no node selected), **Delete
  point** (disabled with none), **Close path** or **Open path** (disabled without exactly one node
  selected), **Done**. Each button carries the house `Tooltip` and its key in `aria-keyshortcuts`
  where it has one (Delete, J, Escape). Presses on it never reach the canvas.
- **Commit**: every gesture ends in one `onCommitPathEdit(id, anchors, closed, kind)` → one `commit`
  of `reshapePath` (or the element removed when invalid), `kind` `edit` tracks
  `Element·Changed·PathEdit`, `join` tracks `Element·Changed·PathJoin`. A drag that moved nothing
  commits nothing. Each arrow press is one commit (P10). A toolbar type change tracks
  `Element·Changed·PathEdit`.

### Editing while drawing (`usePathDrawGesture`)

With the Path tool in hand, the draft is editable (as in Figma):

- **Ctrl (Cmd) held**: the edit pointer. The cursor is the arrow and every placed node's handles
  show. A press hit-tests the draft (`pathEditHit` with all nodes selected, the pointer's radius): a
  node drags (moving its handles), a handle drags (partner by mode, Alt breaks), anything else does
  nothing. No node is placed. Releasing the key resumes drawing from the last node.
- **Alt-press on a placed node**: toggles it corner ↔ smooth (`toggleSmooth` on the draft).
- **Press on a placed node that is neither the first nor the last**: a drag moves it; a click does
  nothing (never a node on top of a node).
- **Press on the last node**: a double press finishes; a drag moves it; a click makes it a cusp.
- A press that becomes a drag is never the first half of a double-click.

### Dock, keys and tool state

- `activeWhiteboardTool`: `pendingDraw.type === 'path'` → `'path'`.
- `useWhiteboard.pickPath()`: `setCanvasTool('select')`, `beginDraw({ type: 'path' })`, track
  `Draw·Selected·Path`. Leaving a whiteboard tab cancels a path intent as it does a pen.
- The dock button, in the Shapes group after the sticky note (the dock's own blueprint places it):
  key `path`, label "Path tool", shortcut `P`,
  `aria-pressed` when the tool is `path`, icon `ShapePenIcon` at `DOCK_ICON_PX`: the one component
  the Shape Pen palette tile renders at `TILE_GLYPH_PX`, never a redrawn copy.
- `pathEditing` (the edited element is a path): the Select button is pressed, labelled "Select,
  editing a path", icon `EditPointsIcon` (the selection toolbar's Edit points glyph); pressing it
  calls `leavePathEdit`.
- `WHITEBOARD_EDIT_KEYS.p` → `pickPath`; `WHITEBOARD_TOOL_KEYS.path = 'P'`. Diagram tabs keep `P` as
  the pencil.
- `typeIntoSelected` returns false for a path (no typed label, P1).

### Rendering (`PathSvg`)

- An svg of class `FREEHAND_SVG_CLASS`, `viewBox="0 0 max(w,1) max(h,1)"`, `preserveAspectRatio="none"`;
  the path `d = pathD(pathAnchors(el, { x: 0, y: 0 }))`, `stroke` the colour,
  `stroke-width = BORDER_STROKE_PX[strokeWidth ?? DEFAULT_BORDER_STROKE]`, dash from
  `BORDER_DASH_ARRAY[strokeStyle]`, round caps and joins, `fill` = the fill colour when closed, else
  `none`.
- Picked by its line (`lineHit` for a path neither selected nor multi-selected, on every tab): a
  transparent twin with `stroke-width = strokePx + 2 · STROKE_HIT_SCREEN_PX / zoom`,
  `pointer-events: stroke`, or `all` when closed and filled (the fill picks it too).
- The draft (`PathDraftLayer`, inside the transformed layer after the elements) is a `div.absolute`
  at the draft element's box holding the same `PathSvg` for the same element (`createPath`, dressed by
  style memory, projected in the ink): release changes no pixel.
- Nodes (`PATH_NODE_RADIUS_PX` screen): a corner node a square, a smooth one (mirrored or aligned) a
  circle, filled when selected, while drawing and in edit mode alike; handles (a line and a `PATH_HANDLE_RADIUS_PX` dot), rings, the node box and guides are
  drawn in canvas px divided by zoom, in the brand colour with a board-coloured rim, never taking a
  pointer event.

### Style

- Created in Ink by name, unfilled: `boardShape(createPath(...))` writes `penColour: 'ink'` and
  `fillColor: 'transparent'` (the Path tool is a Draw mode tool), then the remembered Draw style; it
  looks the same in Diagram mode ([One look](../../007-editor/editor-modes.md#one-look)).
- Quick style: `isQuickStyleTarget` includes an unlocked path. Sections: stroke, width, style (solid,
  dashed, dotted) always; background when `closed`. Apply and clear as for a shape.
- Style memory kind `path` (`board:path` on a whiteboard), fields `strokeColor`, `strokeSwatch`,
  `fillColor`, `fillSwatch`, `strokeWidth`, `strokeStyle`.
- `toolPhantom({ type: 'path' })`: a closed triangle path, so "Next path" offers Background (P11);
  `toolCaption` → "Next path".

### Selecting, erasing, export

- The whiteboard eraser removes a path whole in both modes (Partial splits only freehand strokes).
- SVG export: `svgPathElementShape(el, stroke, fill)` writes `<path d="…" fill stroke stroke-width
stroke-dasharray stroke-linecap="round" stroke-linejoin="round"/>` with `pathD(..., r2)`, inside the
  element's opacity and rotation group, as `svgFreehandShape` is.
- Excalidraw: a `line` with `points` from `samplePath` relative to the element's box (as a freehand's
  are), `strokeColor`,
  `backgroundColor` (closed and filled), `strokeWidth` px.

## Interfaces and contracts

```ts
// packages/document
export function pathAnchors(el: Pick<PathElement, 'x'|'y'|'width'|'height'|'nodes'>, origin?: Point): PathAnchor[];
export function pathGeometry(anchors: readonly PathAnchor[], closed: boolean): PathGeometry;
export function createPath(anchors: readonly PathAnchor[], closed: boolean): PathElement;
export function reshapePath(el: PathElement, anchors: readonly PathAnchor[], closed: boolean): PathElement;
export function isCommittablePath(anchors: readonly PathAnchor[], closed: boolean): boolean;
export function pathSegments(anchors: readonly PathAnchor[], closed: boolean): PathSegment[];
export function pathD(anchors: readonly PathAnchor[], closed: boolean, fmt?: (n: number) => number): string;
export function pathBounds(anchors: readonly PathAnchor[], closed: boolean): Box;
export function splitSegment(seg: PathSegment, t: number): [PathSegment, PathSegment];
export function nearestOnPath(anchors: readonly PathAnchor[], closed: boolean, p: Point): PathNearest | null;
export function bendSegment(seg: PathSegment, t: number, target: Point): { c1: Point; c2: Point };
export function smoothHandles(anchors: readonly PathAnchor[], i: number, closed: boolean): { handleIn?: Point; handleOut?: Point };
export function constrain45(from: Point, to: Point): Point;
export function partnerHandle(node: Point, moved: Point, partner: Point | undefined, mode: PathHandleMode): Point | undefined;
export function samplePath(anchors: readonly PathAnchor[], closed: boolean, perSegment?: number): Point[];
export function svgPathElementShape(el: PathElement, stroke: string, fill: string): string;
export function pathWorldAnchors(el: PathElement): PathAnchor[];
export function continuedPath(el: PathElement, anchors: readonly PathAnchor[], closed: boolean): PathElement;
export function reversePath(anchors: readonly PathAnchor[]): PathAnchor[];
export function pathTouchesBrush(el: PathElement, a: Point, b: Point, r: number): boolean;

// apps/live
export type PendingDraw = … | { type: 'path' };
export type WhiteboardTool = 'select' | 'pen' | 'path' | 'eraser' | 'sticky' | 'text' | 'shape';
export function classifyPathPress(draft: PathDraft | null, p: Point, opts: { zoom: number; now: number; ends: readonly PathEnd[]; radiusPx?: number }): PathPress;
export function pathEditHit(anchors, closed, selected, p, zoom, strokePx, radiusPx?: number): PathEditHit;
export function pathEditCursor(hit: PathEditHit): string; // move | PATH_ADD_CURSOR | default
export function setNodeType(anchors, selected, type: PathHandleMode, closed: boolean): PathAnchor[];
export function sharedNodeType(anchors, selected): PathHandleMode | null;
export function openPathAt(anchors: readonly PathAnchor[], i: number): PathAnchor[];
export function dragNodes(base, moving, pressed, delta: Point, shift: boolean, snapRadius: number): { anchors: PathAnchor[]; guides: PathGuides | null };
export function pathEditKey(key: { key: string; shiftKey: boolean; mod: boolean }, anchors, closed, selected): PathKeyOutcome;
export function toLocal(el, p: Point): Point; export function toWorld(el, p: Point): Point;
export function tabAsSeen(tab: Tab, appearance?: Appearance): Tab; // the tab's Diagram backdrop, stock colours resolved
export function editingLook(element: { type: string }, isEditing: boolean): { raise: boolean; textCursor: boolean };
// CanvasProps
onCommitPath: (draft: { anchors: PathAnchor[]; closed: boolean; continuing: { id: string } | null }) => void;
onCommitPathEdit: (id: string, next: { anchors: PathAnchor[]; closed: boolean }, kind: 'edit' | 'join') => void;
onDressPath?: <T extends Element>(el: T) => T; // style memory, so the draft wears the style it lands with
// SelectionPopover
onEditPoints?: () => void;
```

Validation (`isValidElement`, `t === 'path'`) rejects: `closed` not a boolean; `nodes` not an array
of 2 to `MAX_PATH_NODES`; a node that is not an object, whose `nx` / `ny` is not a finite number of
magnitude up to `PATH_COORD_MAX`, whose `mode` is not a `PathHandleMode`, or whose `handleIn` /
`handleOut` is present and not such a pair; a closed path of 2 nodes without a handle;
`strokeSwatch` / `fillSwatch` not a quick swatch slot. Rejected elements fail the tab as every other
invalid element does.

## Data and persistence

| Field                     | Where                       | Class    | Travels |
| ------------------------- | --------------------------- | -------- | ------- |
| `PathElement.nodes`       | element (normalised)        | document | yes     |
| `PathElement.closed`      | element                     | document | yes     |
| style fields              | element                     | document | yes     |
| `board:path` style memory | `localStorage` style memory | device   | never   |
| draft, edit selection     | canvas component state      | session  | never   |

No migration: a new element type. A build without it rejects a tab holding a path on validation;
paths ship with the validator, the OpenAPI schema and the MCP's type list in one change.

## Errors and edge cases

- Two presses on the same spot beyond the double-press window: a cusp, never a zero-length segment.
- A place press within the hit radius of the last node never adds a node.
- Draft of 1 node, then Enter / Escape / tool change: dropped, nothing committed.
- A close press with 2 nodes and no handle, released without a drag: ignored (P3).
- The continued element deleted or locked by a peer mid-draft: committed as a new path.
- The edited element deleted, locked, or moved to an inert layer by a peer: edit mode leaves.
- A rotated path: edited in its own frame; continuing bakes the rotation in (P4).
- A horizontal or vertical straight path: a 1 px box dimension, nodes normalise against it.
- Zoom or pan mid-draft: every point converts with its event's rect and zoom.
- `pointercancel` mid-drag: the drag ends without a commit (edit) or keeps the placed node (draw).
- Read-only, locked tab, tab loading: the dock hides the tool; commits refuse (`editsBlocked`).
- A path pasted onto a diagram tab: renders, selects, styles and edits; the tool is not offered.

## Security and trust

A path arrives from peers, the API and the MCP like any element: `isValidElement` bounds the node
count (`MAX_PATH_NODES`), every coordinate (finite, `PATH_COORD_MAX`) and the mode vocabulary, so a
hostile payload cannot allocate unbounded memory or inject markup (the `d` string is built from
numbers only).

## Performance and limits

- A render: `pathD` is O(nodes). `pathBounds` is O(nodes) with a closed-form quadratic per axis.
- A draft move: one state update per animation frame; the preview is one svg.
- Edit hit test per press: O(nodes · 36) for the segment search; 5 000 nodes is under 2 ms.
- `MAX_PATH_NODES = 5 000`; a drawn path rarely exceeds 50.

## Presentation and UX

- Cursor while drawing: crosshair with a nib-and-curve glyph (`drawIntentCursor`); over the first node
  with a closing ring shown, over the last node: the same (the ring is the cue).
- Banner copy (screen readers only, the dock button shows the tool in hand): "Click to place points,
  drag to curve".
- Rings: `PATH_RING_PX` screen radius, 1.5 px, brand; the closing ring is filled at 20% brand.
- Edit mode: the path's selection ring is hidden (`isEditing`); nodes and handles as above; the node
  box a dashed 1 px brand rectangle at 8% fill; guides 1 px brand lines.
- Copy: "Path tool", "Select, editing a path", "Next path", "Path started", "N points",
  "Path closed", "Path finished", "Path, N points", "Closed path, N points".

## Accessibility

- The dock button is a toggle (`aria-pressed`), named "Path tool", `aria-keyshortcuts="P"`.
- Announcements through the canvas's polite live region.
- Edit mode from the keyboard: Enter in, Tab walks nodes, arrows move them, Delete removes them,
  Escape and Enter out.
- Hit targets: `PATH_NODE_HIT_PX = 12` screen px radius around nodes and handles (24 × 24).
- Contrast: nodes and handles are brand-600 (light) / brand-300 (dark) with a board-coloured rim, at
  least 3:1 on both boards (non-text contrast).
- No motion.

## Web Experience

- No layout shift: every overlay is absolutely positioned inside the canvas layer.
- INP: a press does O(nodes) work; moves update state once per frame.
- LCP: nothing loads before first paint.

## Observability

- Telemetry per the spec table.
- `console.debug('[path] committed nodes=<n> closed=<yes|no> continued=<yes|no>')` on every path
  commit; `[path] edit <kind> nodes=<n>` on every edit commit; `[path] refused: <reason>` when a
  commit is refused (`blocked`, `too few nodes`); `[path] edit left: <reason>` when edit mode leaves.

## Testing

| Rule                                                                                            | Test                                                                                                            |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Segments, `d`, bounds from extremes, box of 1                                                   | `packages/document/src/path-geometry.test.ts`                                                                   |
| Split keeps the curve, bend passes through the point                                            | `packages/document/src/path-geometry.test.ts`                                                                   |
| Smooth handles, 45°, partner by mode, nearest, sample                                           | `packages/document/src/path-geometry.test.ts`                                                                   |
| Anchors ⇄ element, rotation kept by `reshapePath`                                               | `packages/document/src/path-element.test.ts`                                                                    |
| Validation                                                                                      | `packages/document/src/validate.test.ts`                                                                        |
| Export twin                                                                                     | `packages/document/src/svg-render-shapes.test.ts`                                                               |
| Ink projection                                                                                  | `packages/document/src/whiteboard.test.ts`                                                                      |
| Drawing state machine                                                                           | `apps/live/lib/path-draw.test.ts`                                                                               |
| Edit operations and hit test                                                                    | `apps/live/lib/path-edit.test.ts`                                                                               |
| Draw gesture: press, drag, keys, commit, undo and redo while drawing                            | `apps/live/components/canvas/path/usePathDrawGesture.test.tsx`                                                  |
| Edit gesture: select, drag, keys, one commit                                                    | `apps/live/components/canvas/path/usePathEditGesture.test.tsx`                                                  |
| Commit: new, continued, edit, delete, telemetry                                                 | `apps/live/hooks/canvas/usePathCommits.test.tsx`                                                                |
| Tool derivation                                                                                 | `apps/live/lib/whiteboard-tool.test.ts`                                                                         |
| Dock button, key, edit glyph                                                                    | `apps/live/components/canvas/whiteboard/WhiteboardDock.test.tsx`                                                |
| `pickPath`                                                                                      | `apps/live/hooks/canvas/useWhiteboard.test.tsx`                                                                 |
| Quick style and memory                                                                          | `apps/live/lib/quick-style.test.ts`, `style-memory.test.ts`                                                     |
| Accessible name                                                                                 | `apps/live/lib/element-names.test.ts`                                                                           |
| Excalidraw line                                                                                 | `apps/live/lib/excalidraw-export.test.ts`                                                                       |
| Telemetry vocabulary and sentences                                                              | `apps/live/lib/telemetry-coverage.test.ts`, `apps/telemetry`                                                    |
| Edit keys, Tab on into the toolbar                                                              | `apps/live/lib/path-edit-keys.test.ts`                                                                          |
| Node types, open, cursors, `toWorld`, `dragNodes`                                               | `apps/live/lib/path-edit.test.ts`                                                                               |
| Edit toolbar: radios, keys, disabled states                                                     | `apps/live/components/canvas/path/PathEditToolbar.test.tsx`                                                     |
| Corner squares, smooth circles; overlays on top                                                 | `apps/live/components/canvas/path/PathEditLayer.test.tsx`                                                       |
| Edit points                                                                                     | `apps/live/components/canvas/SelectionPopover.test.tsx`                                                         |
| A double-tap opens edit mode                                                                    | `apps/live/components/canvas/useBoxedElementGestures.path.test.tsx`                                             |
| No text cursor, no lift, no menu in edit mode                                                   | `apps/live/components/canvas/element-variant.test.ts`, `apps/live/hooks/canvas/useEditModeContextMenu.test.tsx` |
| The eraser takes a path whole                                                                   | `packages/document/src/whiteboard-stroke.test.ts`, `apps/live/lib/whiteboard-erase.test.ts`                     |
| Export in the board's ink                                                                       | `apps/live/lib/export-as-seen.test.ts`                                                                          |
| The Shape Pen icon, one component                                                               | `apps/live/components/canvas/whiteboard/WhiteboardDock.test.tsx`                                                |
| End to end (every drawing and editing gesture, touch, cursors, overlay order, SVG / PNG export) | Playwright, Chromium and WebKit, dark and light, on the shared stack                                            |

## Constants and configuration

| Constant                 | Value        | Provenance                             | Safe range |
| ------------------------ | ------------ | -------------------------------------- | ---------- |
| `PATH_NODE_HIT_PX`       | 12           | spec (24 × 24 targets)                 | 12 to 20   |
| `PATH_OVERLAY_Z`         | 40           | above the selection chrome (30)        | > 30       |
| `PATH_TOUCH_HIT_PX`      | 16           | spec (a finger radius)                 | 16 to 24   |
| `PATH_LONG_PRESS_MS`     | 500          | the canvas long-press (`useLongPress`) | 400 to 700 |
| `PATH_CLOSE_PX`          | 8            | spec (a finger: `PATH_TOUCH_HIT_PX`)   | 6 to 12    |
| `PATH_SNAP_PX`           | 8            | spec                                   | 4 to 12    |
| `PATH_DRAG_THRESHOLD_PX` | 3            | P12                                    | 2 to 6     |
| `PATH_DOUBLE_PRESS_MS`   | 500          | P12 (OS double-click default)          | 300 to 600 |
| `PATH_NODE_RADIUS_PX`    | 4            | P13                                    | 3 to 6     |
| `PATH_HANDLE_RADIUS_PX`  | 3.5          | P13                                    | 3 to 5     |
| `PATH_RING_PX`           | 8            | spec                                   | 6 to 12    |
| `MAX_PATH_NODES`         | 5 000        | P14                                    | ≥ 1 000    |
| `PATH_COORD_MAX`         | 1e6          | P14                                    |            |
| Nearest search           | 24 + 12      | P14                                    |            |
| Bend `t` clamp           | 0.05 to 0.95 | P14                                    |            |
| Nudge                    | 1 / 10 px    | spec                                   |            |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows P1 to P20.
