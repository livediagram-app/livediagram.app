# Snap override (free drag)

Holding **Cmd / Ctrl while dragging or resizing** turns off alignment snapping and its
guide lines for that gesture, so an element (or arrow endpoint, or resize handle) follows the
pointer exactly and can be placed or sized off-grid.

## Behaviour

- Default: dragging an element snaps its edges / centres to neighbours and to
  equal spacing (distribution), drawing the faint guide lines that explain the
  match. Unchanged.
- While **Cmd (⌘) / Ctrl** is held during a drag:
  - no alignment or distribution snap is applied; the element tracks the raw
    pointer delta;
  - no guide lines are drawn (they're cleared for the gesture).
- It's a **per-drag override**, read live from the move event, so pressing or
  releasing the key mid-drag flips snapping on the next move. The next drag
  snaps as usual, with nothing to toggle back.
- Applies to a single element, a multi-selection move, a dragged **arrow
  endpoint** (both share the snap sites in `useEditorDrag`), an arrow's **curve
  and elbow handles** and a slid bend (`applyArrowDragMove`), and a **resize**: the
  dragged edge neither snaps to a neighbour's line nor matches its size, and no
  guides draw. (A multi-selection or rotated resize never snaps anyway.) A dragged arrow endpoint over a shape's body
  stays free there instead of pinning to the shape's facing anchor ([Canvas and palette](canvas-and-palette.md)
  "Dropped on a shape"); an end on an anchor itself still pins.

## Implementation

`useEditorDrag`'s `onMove` reads `noSnap = e.metaKey || e.ctrlKey` and gates the
two `snapToAlignment` sites (boxed move + free arrow endpoint) on `!noSnap`, and
passes it to `resolveBoxedResize`, which then keeps the raw resized bounds and draws no guides, and to
`applyArrowDragMove`, whose curve and elbow handles (`resolveArrowControlFrame`) and slid bends skip their snap,
and whose endpoint resolver (`resolveArrowEndpointDrag`) skips the body drop.
Each site's existing `else` branch already clears the guides and falls back to
the raw position, so the override needed no new clearing path. The separate
"alignment guides off" preference (`alignmentGuidesRef`) is unrelated: it hides
the guide lines but keeps snapping; this hides both.

Documented for users in the help centre at `canvas/snapping` ([Help app](../018-help/help-app.md)), with a
`SnappingGuides` illustration.
