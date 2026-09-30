# Resize blueprint

Derived from [Canvas and palette](../canvas-and-palette.md) "Resize", "Aspect ratio lock",
"Rotation" and "Adding elements", for the resize of boxed elements and multi-selections, the
Shift constraint on draw-to-size, and where every selection grip draws ("The handles are always on
top"). Reshaping a recognised whiteboard shape is owned by the
[whiteboard blueprint](../../023-whiteboard/blueprints/whiteboard-round-one.md).

## Domain and naming

- **Handle**: a `DragMode` other than `move`: corners `resize-nw | resize-ne | resize-sw | resize-se`,
  edges `resize-n | resize-e | resize-s | resize-w`. `snapModeOf(mode)` strips the prefix
  (`ResizeSnapMode`); `cornerOf(mode)` is the corner letter or null for an edge.
- **Constrained**: the resize keeps the start ratio. `constrain = dragAspectLocked || shiftHeld`
  for one element; a multi-selection adds `anyAspectLocked` (any member with `aspectLocked`).
- **Leading axis** (`ResizeAxis`, `'x' | 'y'`): `leadingAxis(mode, dx, dy)`. An edge handle's own axis;
  a corner's axis with the larger `|dx|` or `|dy|` in canvas px, `x` on a tie.
- **Anchor**: the corner opposite a corner handle; for an edge handle the opposite edge, with the
  other axis centred on it (`anchoredBounds`).
- **Uniform-scale floor**: `minUniformScale({ width, height })`, the largest of `MIN_SIZE / side` over
  the sides of at least `MIN_SIZE`, and `1` for any side below it.
- **Union**: `unionRects(startBounds)` of a multi-selection's boxed members at the press.
- **Grip**: anything drawn to operate a selection rather than to show content: corner and edge
  handles (`ResizeHandles`, `EdgeResizeHandle`), union handles and their dashed border, a free
  arrow's frame (`FreeArrowSelection`), an arrow's end, curve and elbow grips
  (`SelectedArrowHandles`), the quick-connect pluses (`QuickConnectPluses`) and the next-note
  buttons.
- **Grips layer**: `SelectionGripsLayer`, the one `[data-selection-grips]` layer that holds every grip.
- **Grips frame**: `[data-grips-for="<id>"]`, an element's own handles standing on its box.

## Behaviour and state

- The press (`useBoxedDragHandlers.beginDrag`) captures `startBounds` for every member and
  `aspectLocked` of the pressed element into `DragState`; nothing else is latched.
- Every pointer move (`useEditorDrag`, coalesced to one per frame) reads `e.shiftKey` afresh and calls
  `resolveBoxedResize` with the full delta from the press, so pressing or releasing Shift takes effect
  on the next move and releasing it restores the free size for the same pointer.
- `nextBounds(start, mode, dx, dy, aspectLocked)`: free, each moving side is `max(MIN_SIZE, side ±
delta)` and an edge handle changes its own axis only; constrained, it returns
  `constrainedBounds(start, mode, dx, dy)`.
- `constrainedBounds(start, mode, dx, dy, minScale = minUniformScale(start))`: scale `s` =
  `(side + sign * delta) / side` on the leading axis, `s = max(minScale, s)`, both sides times `s`,
  laid out by `anchoredBounds`. A start box with a zero side resizes free.
- One element, unrotated (`resolveBoxedResize`): free, `snapResizeBounds(raw, snapMode, ...)`
  snaps every moving edge; constrained, `snapLeadingAxis(raw, snapMode, lead, snapEdge, floor)`
  snaps the leading edge only (`snapResizeBounds` in single-edge mode) and re-derives the other side
  from the ratio around the same anchor, `floor = minUniformScale(start) * start.width / raw.width`.
  Guides come from `alignmentGuides(next, ...)` either way.
- One element, rotated: the delta is projected into the local frame, `nextBounds(..., constrain)`
  sizes it, and the point `FIXED_SIGN[mode]` (the corner or edge midpoint opposite the handle) keeps
  its world position. No snap, no guides.
- Multi-selection (corners only): constrained, `constrainedBounds(union, mode, dx, dy,
unionMinScale)` where `unionMinScale` is the largest `minUniformScale` of the resizable members
  (fixed-size members set none); free, `nextBounds(union, mode, dx, dy, false)`. Each member maps
  through `unionResizeMember` around the union anchor; fixed-size members move but keep their size.
  No snap, `guides: null`.
- `unionResizeMember` floors each side at `min(MIN_SIZE, the side at the press)`, so a member that
  began thinner than `MIN_SIZE` is never bumped up.
- Draw-to-size (`useCanvasDrawGesture.nextDrawDrag`): with `e.shiftKey` the end point becomes the
  square of side `max(|dx|, |dy|)` in the drag's direction, then `snapLeadingAxis(box, corner, lead,
snapEdge)` with `lead` from the raw pointer, so the square survives the snap; without Shift each
  moving edge snaps on its own.
- Whiteboard: `useCanvasSurfaceGestures` turns a Shift press into an additive marquee unless the
  target is inside `[data-canvas-handle]`. `ResizeHandles`, `EdgeResizeHandle` and
  `UnionResizeHandles` all carry `data-canvas-handle`, so every handle reaches its resize with Shift.

- Grips layer: `CanvasElementsLayer` draws it last in the transformed world, after every element,
  the remote cursors and the laser, at `z-index: SELECTION_GRIPS_Z_INDEX`, `pointer-events: none`,
  `inset: 0` (canvas coordinates). Inside it, in paint order: the canvas's own grips (next-note
  buttons, quick-connect pluses, union border, union handles), an `<svg>` whose `<g>` hosts SVG
  grips, then a `<div>` host for HTML grips.
- The layer hands its two hosts to `SelectionGripsContext` from a layout effect, so the first commit
  re-renders synchronously and the grips fill before the first paint; on unmount the hosts go null.
- An element view renders its grips where it always did, wrapped in `BoxGripsPortal` (HTML) or
  `ArrowGripsPortal` (SVG). The DOM lands in the layer; the React event path stays the element's,
  so a press, double-press, context menu and pointer-up on a grip reach the same handlers as
  before, and every grip still stops its own press so the element body never sees it.
- `SelectionChromeLayer` draws a grips frame at the element's `x`, `y`, `width`, `height`,
  `transform: translateX(shiftX) rotate(rotation)` (each part only when non-zero), origin centre:
  the element's resting box, turned and shifted as the wrapper is. The frame is
  `pointer-events: none`; each grip re-enables them, so the body beneath stays draggable.
- The element's own content keeps its paint order; nothing about selection raises it.
- A grip is not affected by the element's opacity, a layer's opacity, a vote's dimming or a looping
  animation's motion: it draws opaque on the resting box.

## Interfaces and contracts

- `apps/live/lib/resize-geometry.ts` (re-exported from `lib/canvas.ts`): `nextBounds`,
  `constrainedBounds`, `leadingAxis`, `minUniformScale`, `snapLeadingAxis(candidate, handle, lead,
snapEdge, minScale = 0)`, `unionResizeMember`, `ResizeAxis`. All pure.
- `apps/live/components/canvas/SelectionGripsLayer.tsx`: `SelectionGripsLayer({ onHosts, isoDepth,
children })`, `SelectionGripsContext` (`SelectionGripHosts | null`, `{ box: HTMLElement; arrows:
SVGGElement }`), `BoxGripsPortal({ children })`, `ArrowGripsPortal({ arrowId, children })` (wraps
  its children in `<g transform="translate(shiftX 0)">` from `useInsertShift().xFor(arrowId)`),
  `SELECTION_GRIPS_Z_INDEX`.
- `SelectionChromeLayer({ elementId, box, zoom, rotation, shiftX?, showHandles, showAnchors,
onBeginDrag })` in `element-parts.tsx`.
- `MenuFlyoutSection` treats a press inside `[data-grips-for]` as a press on the element, as it
  treats `[data-element-id]`, so an open flyout stays open when a handle is pressed.
- `apps/live/hooks/canvas/boxed-drag-resolve.ts`: `resolveBoxedResize({ elements, startBounds,
primaryId, mode, dx, dy, shiftHeld, dragAspectLocked, guidesOn })` returns `{ boundsById, guides }`
  or null for `move`, a missing start box, or a multi-selection without a corner.

## Errors and edge cases

- Zero-width or zero-height start box: no ratio; `constrainedBounds` resizes free and
  `snapLeadingAxis` returns the candidate unchanged.
- A side below `MIN_SIZE` at the press (a straight pen stroke, 2 px tall): the constrained floor is 1,
  so it only grows, ratio intact.
- A pointer dragged past the anchor: the scale goes negative and is clamped to the floor; the box
  never flips.
- A tie between `|dx|` and `|dy|` on a corner leads with `x`.
- No grips layer mounted (a portal rendered outside `CanvasElementsLayer`): the portal renders
  nothing. `CanvasElementsLayer` is the only renderer of element views, and it always mounts one.
- An element on a hidden layer is not drawn, so its grips are not either; a layer-preview solo draws
  only that band's elements and so only their grips.
- Isometric view: painting goes by depth, not z-index, so `[data-iso] [data-selection-grips]` takes
  `translate: 0 0 calc(2px + var(--iso-z) * 0.01px)` with `--iso-z` one past the top element's
  paint index (above the arrows' `1px` nudge).
- A later element that forms its own stacking context, or a descendant with its own z-index (a
  lane's gutter and a face's settings button, both `z-10`), stays under the layer.
- Remote cursors (`z-index: 40`) stay above the grips.

## Performance and limits

- Per move: O(1) geometry plus one `snapResizeBounds` pass (O(n) over the tab's elements), the same
  as the free path; constrained single-edge snapping scans one axis. A multi-selection adds one
  O(members) pass for `unionMinScale`.

## Presentation and UX

- Handles as the spec describes; the Shift hint pill reads "Proportions locked" while resizing
  (`ModifierHintBanner`). Edge handles keep `aria-label` "Resize width" / "Resize height".

## Testing

- `lib/resize-geometry.test.ts`: constrained edges (anchor and centring), the floor, a thin stroke,
  `leadingAxis`, `minUniformScale`, `snapLeadingAxis`, `unionResizeMember` never bumping.
- `hooks/canvas/boxed-drag-resolve.resize.test.ts`: leading-axis snap and its guide, every edge
  handle, the aspect lock on an edge, rotated edge and corner, multi uniform scale, hard shrink,
  anchor, free multi.
- `hooks/canvas/useEditorDrag.shift-resize.test.tsx`: every boxed kind from a corner and an edge,
  every tab kind, Shift pressed and released mid-drag.
- `components/canvas/useCanvasDrawGesture.test.tsx` "with Shift": square, leading-axis snap, up-left,
  mid-drag toggle.
- `hooks/canvas/useCanvasSurfaceGestures.whiteboard-handles.test.tsx`: Shift press on corner, edge
  and union handles does not start a marquee.
- `components/canvas/SelectionGripsLayer.test.tsx`: the layer draws last and above; a box's eight
  handles land in the layer and none in the element; the frame's box, rotation and shift; cursor
  and counter-scale kept; a handle press starts the resize without reaching the element body; an
  arrow's end grips land in the layer's `<svg>`; nothing renders outside a layer.
- `e2e/grips-on-top.spec.ts`: in a real browser, no element covers any handle of a rotated, faded,
  animated or note-covered element, nor an arrow's end grip under a later box
  (`document.elementFromPoint` at each grip's centre).

## Constants and configuration

- `MIN_SIZE = 20` (canvas px, `resize-geometry.ts`), the spec's 20x20 floor.
- `SELECTION_GRIPS_Z_INDEX = 30` (`SelectionGripsLayer.tsx`): above element descendants that carry
  `z-10` and an element being edited (`10`), below remote cursors (`40`). Safe range 11 to 39.
- `ALIGN_SNAP_THRESHOLD` for resize snaps; draw-to-size uses `6 / viewportZoom` with a 1 px floor.

## Defaults ledger

- D54, D55, D56 in [DEFAULTS.md](DEFAULTS.md).
