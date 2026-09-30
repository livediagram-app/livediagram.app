# Path tool: blueprint

Derived from [Path tool](../path-tool.md), with [Whiteboard, round one](whiteboard-round-one.md) for
the dock, keys, ink and board style memory, and [Multi-point line / polygon tool](../../008-canvas/polygon-tool.md)
for the click-to-place gesture it grows from. The spec decides; this file adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Pn`.

Scope, by file:

| File                                                          | Role                                                                          |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/document/src/element-types.ts`                      | `PathElement`, `PathNode`, `PathHandleMode`, `PathPoint`                      |
| `packages/document/src/index.ts`                              | `PathElement` joins `BoxedElement`; re-exports                                |
| `packages/document/src/path-geometry.ts`                      | Pure curve maths: segments, `d`, bounds, split, bend, smooth, nearest         |
| `packages/document/src/path-element.ts`                       | Element ⇄ anchors: `pathAnchors`, `pathGeometry`, `createPath`, `reshapePath` |
| `packages/document/src/validate.ts`                           | `'path'` in `ELEMENT_TYPES`; node, handle, mode and count checks              |
| `packages/document/src/colors.ts`                             | Padding, default stroke and fill, border support for `path`                   |
| `packages/document/src/element-kind-label.ts`                 | `Path`                                                                        |
| `packages/document/src/whiteboard.ts`                         | Ink projection for `path`                                                     |
| `packages/document/src/svg-render*.ts`                        | `svgPathElementShape`: the export twin of the canvas path                     |
| `apps/api/src/openapi/schemas.generated.ts`                   | Regenerated: `PathElement` in `BoxedElement`                                  |
| `packages/api-schema/src/telemetry-schema.ts`                 | (no change: `Whiteboard`, `Element`, `Selected`, `Added`, `Changed` exist)    |
| `apps/live/lib/path-draw.ts`                                  | Pure drawing state machine                                                    |
| `apps/live/lib/path-edit.ts`                                  | Pure edit-mode operations and hit testing                                     |
| `apps/live/lib/draw-mode.ts`                                  | `PendingDraw` `{ type: 'path' }`, banner, cursor                              |
| `apps/live/lib/whiteboard-tool.ts`                            | `WhiteboardTool` gains `path`                                                 |
| `apps/live/lib/quick-style.ts`, `quick-style-tool.ts`         | A path is a quick-style target; "Next path" phantom                           |
| `apps/live/lib/style-memory.ts`                               | Style kind `path` (`board:path` on a whiteboard)                              |
| `apps/live/lib/element-names.ts`                              | "Path, N points" / "Closed path, N points"                                    |
| `apps/live/lib/excalidraw-export.ts`                          | A path as a sampled `line`                                                    |
| `apps/live/components/canvas/path/PathSvg.tsx`                | The canvas renderer, shared by committed and draft paths                      |
| `apps/live/components/canvas/path/usePathDrawGesture.ts`      | Drawing: presses, drags, keys, commit                                         |
| `apps/live/components/canvas/path/usePathEditGesture.ts`      | Edit mode: presses, drags, keys, commit                                       |
| `apps/live/components/canvas/path/usePathTool.ts`             | Composes both for `Canvas`: press intercept, displayed elements, layers       |
| `apps/live/components/canvas/path/PathDraftLayer.tsx`         | The path being drawn, rubber band, rings                                      |
| `apps/live/components/canvas/path/PathEditLayer.tsx`          | Nodes, handles, box, snap guides                                              |
| `apps/live/hooks/canvas/usePathCommits.ts`                    | Editor side: `commitPath`, `commitPathEdit`, telemetry                        |
| `apps/live/hooks/canvas/useWhiteboard.ts`                     | `pickPath`, `pathEditing`, `leavePathEdit`                                    |
| `apps/live/hooks/canvas/editor-shortcut-keys.ts`              | `P` on a whiteboard; `WHITEBOARD_TOOL_KEYS.path`                              |
| `apps/live/components/canvas/whiteboard/WhiteboardDock.tsx`   | The Path tool button; Select's edit-mode glyph                                |
| `apps/live/components/canvas/whiteboard/whiteboard-icons.tsx` | `PathEditGlyph`                                                               |
| `apps/live/components/palette/palette-icons.tsx`              | `ShapePenIcon`: the Shape Pen tile's icon, shared with the dock               |
| `apps/telemetry/app/event-explanations.ts`                    | Sentences for the four events                                                 |
| `apps/help/app/canvas/whiteboards/page.mdx`                   | The Path tool section                                                         |

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
- `cubicAt(seg, t)`, `cubicBounds(seg)`: the extremes from the roots of the derivative per axis
  (quadratic in `t`, roots in (0, 1)), plus `p0`, `p3`. `pathBounds` is their union.
- `pathGeometry(anchors, closed)`: the box is `pathBounds`; a dimension under 1 grows to 1 about its
  centre (a straight horizontal or vertical path). Nodes and handles normalise against it. No
  anchors: a 1 × 1 box at the origin.
- `createPath(anchors, closed)`: `{ id: crypto.randomUUID(), type: 'path', ...pathGeometry, closed }`.
- `reshapePath(el, anchors, closed)`: the element with `pathGeometry(anchors, closed)`; for a rotated
  element, the box is then translated by `t = (c − c′) − R(c − c′)` (`c` the old centre, `c′` the new,
  `R` the rotation) so every node stays where it was on screen.
- `splitSegment(seg, t)`: de Casteljau; returns the two halves. The new node is `mirrored` when the
  segment was curved (its two new handles are collinear), `corner` with no handles when straight.
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

State, local to the canvas: `PathDraft = { anchors, placed, continuing, drag, cursor } | null`, where
`placed` counts the nodes this draft placed (Backspace removes only those) and
`continuing = { id, reversed } | null`.

A **press** with the tool in hand, primary button, not Space-held, at canvas point `p`, in order:

1. Within `PATH_NODE_HIT_PX / zoom` of the draft's **last** node and within `PATH_DOUBLE_PRESS_MS`
   of that node's placement: **finish** (a double-click).
2. Within that radius of the **first** node with `anchors.length >= 2`: a **close press**; the drag
   that follows pulls out node 0's handles (`handleOut` = pointer, `handleIn` its mirror, mode
   `mirrored`). Release: commit closed when `isCommittablePath(anchors, true)` (P3), else nothing.
3. Within that radius of the **last** node (later than a double press): **cusp**: its `handleOut` is
   removed (mode `corner` when it has no `handleIn`). No drag follows.
4. No draft and within that radius of an **end node of an open path** on the tab (unlocked, not on an
   inert layer, not being edited): **continue**. Its anchors, in world px (rotation baked in, P4), are
   the draft, reversed when the start node was pressed; `continuing = { id, reversed }`; `placed = 0`.
5. Otherwise **place** a node at `p` (Shift: `constrain45(last, p)`), mode `corner`, no handles; the
   drag that follows shapes it.

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
nothing selected. Continuing: the element with that id is replaced by `reshapePath` of it with the new
anchors (unrotated, `rotation` dropped), keeping every other field, one `commit`, track
`Element·Added·Path` (P6). A continued id that no longer exists (deleted by a peer): committed as new.

**Announcements** (`announce`): first node "Path started"; each later node "N points"; a close "Path
closed"; a finish "Path finished".

### Edit mode (`path-edit.ts`, `usePathEditGesture`)

- **In**: `beginEdit(id)` on a path sets `editingId` (double-click with Select, Space-tap) and `Enter`
  with exactly one unlocked path selected and nothing editing (the gesture's own keydown listener).
  **Out**: `Escape` with no nodes selected, `Enter`, a click (no drag) on empty space, the dock's
  Select, a tool picked, the path deleted or locked, the tab switched: `onCancelEdit()`.
- `PathEditState = { selected: ReadonlySet<number>, drag, draft }` where `draft` is the anchors while a
  gesture is in flight (null otherwise). The canvas shows the edited element through
  `reshapePath(el, draft ?? anchors)`, so the element renders what the gesture holds.
- **Hit test** (`pathEditHit(anchors, closed, selected, p, zoom)`), in the element's unrotated frame
  (the pointer is rotated by `−rotation` about the box centre), in order: a **visible handle**
  (`PATH_NODE_HIT_PX / zoom`), a **node**, a **segment** (within
  `STROKE_HIT_SCREEN_PX / zoom + strokePx / 2`), else **empty**. Visible handles: both of each
  selected node's, `handleOut` of its previous neighbour and `handleIn` of its next.
- **Press on a node**: Alt: toggle smooth (commit). A press within `PATH_DOUBLE_PRESS_MS` of a press
  on the same node: toggle smooth (commit). Shift: toggle it in the selection. Otherwise, when not
  selected, select only it. A drag then moves every selected node, handles with them (Shift:
  `constrain45` of the delta); snapping applies to the pressed node (below).
- **Press on a handle**: drag it (Shift: `constrain45(node, pointer)`); the partner follows the
  node's mode; Alt at any move: the node becomes `corner` and the partner stays.
- **Press on a segment**: release without a drag inserts a node there (`splitSegment` at the nearest
  `t`) and selects it; a drag bends the segment through the pointer (`bendSegment` at the pressed
  `t`); the end nodes' partner handles follow their modes.
- **Press on empty**: a drag draws the node box (Shift adds to the selection); a release without a
  drag leaves edit mode.
- **Keys** (capture phase while editing): `Escape` clears selected nodes, else leaves; `Enter`
  leaves; `Backspace` / `Delete` delete the selected nodes; arrows nudge them 1 px (Shift 10 px);
  `J` with both end nodes of an open path selected closes it; `Tab` / `Shift+Tab` select the next /
  previous node (P7); `Cmd/Ctrl+A` selects every node (P8).
- **Toggle smooth**: a `corner` node takes `smoothHandles` and `mirrored`; any other loses both
  handles and becomes `corner`.
- **Delete nodes**: the selected nodes go; their neighbours join (a joining segment keeps the
  survivors' facing handles). Closed stays closed. Invalid afterwards: the element is deleted.
  Nothing selected: nothing happens (P9).
- **Snapping** (dragging nodes): per axis, the pressed node's candidate is the nearest `x` (and `y`)
  among the path's unmoved nodes and its own original position, within `PATH_SNAP_PX / zoom`; the
  delta shifts to match and a guide line is shown for each axis that snapped.
- **Commit**: every gesture ends in one `onCommitPathEdit(id, anchors, closed, kind)` → one `commit`
  of `reshapePath` (or the element removed when invalid), `kind` `edit` tracks
  `Element·Changed·PathEdit`, `join` tracks `Element·Changed·PathJoin`. A drag that moved nothing
  commits nothing. Each arrow press is one commit (P10).

### Dock, keys and tool state

- `activeWhiteboardTool`: `pendingDraw.type === 'path'` → `'path'`.
- `useWhiteboard.pickPath()`: `setCanvasTool('select')`, `beginDraw({ type: 'path' })`, track
  `Whiteboard·Selected·Path`. Leaving a whiteboard tab cancels a path intent as it does a pen.
- The dock button: after the markers, before the eraser: key `path`, label "Path tool", shortcut `P`,
  `aria-pressed` when the tool is `path`, icon `ShapePenIcon` at `DOCK_ICON_PX`: the one component
  the Shape Pen palette tile renders at `TILE_GLYPH_PX`, never a redrawn copy.
- `pathEditing` (the edited element is a path): the Select button is pressed, labelled "Select,
  editing a path", icon `PathEditGlyph`; pressing it calls `leavePathEdit`.
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
- Nodes (`PATH_NODE_RADIUS_PX` screen, a filled square for the first node while drawing, circles
  otherwise), handles (a line and a `PATH_HANDLE_RADIUS_PX` dot), rings, the node box and guides are
  drawn in canvas px divided by zoom, in the brand colour with a board-coloured rim, never taking a
  pointer event.

### Style

- Created unpainted: `strokeColor` and `fillColor` absent, so a whiteboard draws it in the ink
  (`inkWhiteboardElement`: `strokeColor ?? ink`, `fillColor ?? 'transparent'`) and a diagram tab in
  `defaultStrokeColor`, unfilled (`defaultFillColor` = `transparent` for a path).
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
- Excalidraw: a `line` with `points` from `samplePath` relative to the first, `strokeColor`,
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
export function svgPathElementShape(el: PathElement, stroke: string, fill: string, origin?: Point): string;

// apps/live
export type PendingDraw = … | { type: 'path' };
export type WhiteboardTool = 'select' | 'pen' | 'path' | 'eraser' | 'sticky' | 'text' | 'shape';
// CanvasProps
onCommitPath: (draft: { anchors: PathAnchor[]; closed: boolean; continuing: { id: string } | null }) => void;
onCommitPathEdit: (id: string, next: { anchors: PathAnchor[]; closed: boolean }, kind: 'edit' | 'join') => void;
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

- A render: `pathD` is O(nodes). `cubicBounds` is O(nodes) with a closed-form quadratic per axis.
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

| Rule                                                  | Test                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| Segments, `d`, bounds from extremes, box of 1         | `packages/document/src/path-geometry.test.ts`                    |
| Split keeps the curve, bend passes through the point  | `packages/document/src/path-geometry.test.ts`                    |
| Smooth handles, 45°, partner by mode, nearest, sample | `packages/document/src/path-geometry.test.ts`                    |
| Anchors ⇄ element, rotation kept by `reshapePath`     | `packages/document/src/path-element.test.ts`                     |
| Validation                                            | `packages/document/src/validate.test.ts`                         |
| Export twin                                           | `packages/document/src/svg-render-shapes.test.ts`                |
| Ink projection                                        | `packages/document/src/whiteboard.test.ts`                       |
| Drawing state machine                                 | `apps/live/lib/path-draw.test.ts`                                |
| Edit operations and hit test                          | `apps/live/lib/path-edit.test.ts`                                |
| Draw gesture: press, drag, keys, commit               | `apps/live/components/canvas/path/usePathDrawGesture.test.tsx`   |
| Edit gesture: select, drag, keys, one commit          | `apps/live/components/canvas/path/usePathEditGesture.test.tsx`   |
| Commit: new, continued, edit, delete, telemetry       | `apps/live/hooks/canvas/usePathCommits.test.tsx`                 |
| Tool derivation                                       | `apps/live/lib/whiteboard-tool.test.ts`                          |
| Dock button, key, edit glyph                          | `apps/live/components/canvas/whiteboard/WhiteboardDock.test.tsx` |
| `pickPath`                                            | `apps/live/hooks/canvas/useWhiteboard.test.tsx`                  |
| Quick style and memory                                | `apps/live/lib/quick-style.test.ts`, `style-memory.test.ts`      |
| Accessible name                                       | `apps/live/lib/element-names.test.ts`                            |
| Excalidraw line                                       | `apps/live/lib/excalidraw-export.test.ts`                        |
| Telemetry vocabulary and sentences                    | `apps/live/lib/telemetry-coverage.test.ts`, `apps/telemetry`     |
| End to end                                            | Playwright, Chromium and WebKit, dark and light                  |

## Constants and configuration

| Constant                 | Value        | Provenance                    | Safe range |
| ------------------------ | ------------ | ----------------------------- | ---------- |
| `PATH_NODE_HIT_PX`       | 12           | spec (24 × 24 targets)        | 12 to 20   |
| `PATH_CLOSE_PX`          | 8            | spec                          | 6 to 12    |
| `PATH_SNAP_PX`           | 8            | spec                          | 4 to 12    |
| `PATH_DRAG_THRESHOLD_PX` | 3            | P12                           | 2 to 6     |
| `PATH_DOUBLE_PRESS_MS`   | 500          | P12 (OS double-click default) | 300 to 600 |
| `PATH_NODE_RADIUS_PX`    | 4            | P13                           | 3 to 6     |
| `PATH_HANDLE_RADIUS_PX`  | 3.5          | P13                           | 3 to 5     |
| `PATH_RING_PX`           | 8            | spec                          | 6 to 12    |
| `MAX_PATH_NODES`         | 5 000        | P14                           | ≥ 1 000    |
| `PATH_COORD_MAX`         | 1e6          | P14                           |            |
| Nearest search           | 24 + 12      | P14                           |            |
| Bend `t` clamp           | 0.05 to 0.95 | P14                           |            |
| Nudge                    | 1 / 10 px    | spec                          |            |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows P1 to P14.
