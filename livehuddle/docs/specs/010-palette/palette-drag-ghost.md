# Palette drag ghost + drop preview

Polish on the drag-to-add flow ([Canvas and palette](../008-canvas/canvas-and-palette.md)). When you drag a shape / device /
icon tile out of the palette, the canvas now shows a **live ghost** of what
will land, exactly where it will land, instead of the browser's default
drag image (a snapshot of the tile) and no on-canvas feedback.

## Behaviour

- On `dragstart` of a palette tile, the browser's default drag image is
  suppressed (a 1×1 transparent image) so the only thing the user sees is
  the canvas ghost.
- While dragging over the **canvas** (not over a panel or the strip), a
  translucent, brand-tinted ghost follows the cursor:
  - It is the shape's real silhouette (`ShapeGlyph`: a circle previews as a
    circle, a cylinder as a cylinder) inside a dashed brand footprint.
  - Sized to the shape's `SHAPE_DEFAULT_SIZE` × the current zoom, and
    **centred on the cursor**, matching where `dropPaletteItem` places the
    element (it centres on the drop point).
- Over a panel or the strip (a "changed my mind" drag back to the palette) the
  ghost hides, mirroring the existing `usePaletteDrop` no-drop guard.
- On `drop` / `dragend` / `Escape`, the ghost clears.
- Decorative only: it respects reduce-motion (the global rule collapses its
  fade-in) and dark mode, and is `pointer-events-none` so it never
  intercepts the drop.

## Implementation

- `lib/palette-drag-preview.ts`: a tiny module store
  (`{ kind, iconId?, width, height } | null`) with `useSyncExternalStore`
  access, plus `suppressNativeDragImage(e)`. Drag state is inherently global
  - transient, so a subscribable module store fits better than threading it
    through the editor's prop tree.
- A catalogue tile's drag payload is defined once, in `tileDragStart`
  (`components/palette/palette-tile-drag.ts`): shapes (`kind` or `kind|choice`) and sticky notes on
  the palette mime with the ghost preview, line icons and stickers on their own
  mimes. Every rendering of a tile uses it: the grid tile, the Toolbar strip's tile, and the list
  row, wherever a category body draws them, in the Toolbar strip's More popover, including what a body's own search turns up (Behaviour's rows; the Icons and Stickers
  catalogues' tiles drag on their own mimes). Tiles that arm a gesture (Text, the pens,
  Polygon, Arrow) offer no drag.
- Every drag source clears the preview on `dragend`.
- `components/canvas/PaletteDragGhost.tsx`: an overlay rendered by `Canvas`
  that reads the preview + tracks the cursor via a `dragover` listener and
  paints the ghost at the `z-overlay` rung.

No change to the drop itself (`usePaletteDrop` / `dropPaletteItem`); this is
purely an additive preview layer.

## Where the ghost draws

The ghost follows the cursor, offset by whatever the drag's **snap channel**
(`setPaletteDragSnap`) currently holds: the one number the guides, the ghost
and the drop all read, so the three can't disagree. The **alignment /
distribution snap** publishes into it, latching the footprint onto its
neighbours' edges and even spacing.

## Placed pieces preview themselves

Most of a Space's pieces are **placed, not sized**: a chair, a desk, a bar stool, a plant, an Avatar Pad, a
Portal, a Door. They have a size of their own, so drawing a box for them asks a question nobody needs to answer.
For these (`isPlacedShape` in `@livehuddle/document`: every fixed-size kind, the seating, every grid-drawn office piece but the Rug, the
Avatar Pad, the Portal, the Door and the Focus Button), adding one previews **the piece itself**:

- **While its tile is armed** (tapped, waiting for a click on the canvas) **or dragged from the palette**, the real
  piece, drawn by the same art the canvas draws it with (`PieceArt`), follows the pointer over the canvas at its
  default size and the current zoom, translucent, centred on the pointer, exactly where a click or a drop puts it.
  A drag applies the drag's alignment snap, as the ghost does. A kind the art layer does not draw (a Portal, a mode
  button) shows the dashed footprint and glyph instead.
- **No box to draw.** A press-and-drag with a placed tile armed places the piece at its own size, centred where
  the press began, and the draw-to-size outline never shows. A tap places it centred on the tap, as before. The
  selection's size is not inherited (a placed piece has one size).
- Over a panel or the strip, or off the canvas, the preview hides. It is `pointer-events-none`, listens to the
  pointer only while a placed piece is being added, and moves at most once a frame.
- **The preview is inert** (`inert`), the controls its art draws included: a Pet Bed's sleeping dog (its Pat the
  Dog button lies across the bed's middle, right under the pointer), a Jukebox's or a Notice Board's pill. So the
  press that places the piece always reaches the canvas, never the preview's own control, and nothing in the
  preview takes focus.
- **Space turns a piece that turns** while it is placed, armed or carried, and the preview turns under the pointer;
  **Shift+Space** turns it back ([Turning furniture](../009-elements/furniture-facing.md) "Turning while placing").
  The snap and guides measure the turned piece.
- **A tile of a piece that turns is carried, not dragged.** A browser's own drag hears no keys, so for a mouse or a
  pen the tile is carried by the pointer (`apps/editor/lib/palette-carry.ts`): past four pixels of movement it publishes the same
  drag preview (marked `carried`), the copy cursor shows everywhere, the snap follows pointer moves rather than
  dragovers, and a release over the canvas lands it through the same drop as a dropped tile (`usePaletteDrop`). A
  release over a panel, the palette or off the canvas places nothing, and **Escape** puts it down. The click the
  release makes is the carry's. A touch keeps the browser's drag.
- The Door keeps its wall snap: its preview sits on the wall it would land on
  ([Room Builder and Door](../009-elements/room-builder.md) "Door").
- **Placed pieces are not resized.** Once on the canvas a placed piece shows no resize handles (rotation and moving
  stay), keeps its size through a multi-selection's resize, and its element menu offers no size controls
  (`isFixedSizeElement`). One resized before this rule keeps the size it was given.
- **Sized pieces with art preview themselves too.** A Room, a Stage, Grass, a Garden Path, a Rug, a Fence, a Garden
  Fence and a Pond (every kind `hasPieceArt` draws) are drawn to a size, but a tap or a drop still lands one at its
  default size (`SHAPE_DEFAULT_SIZE`, a Room 480 x 320), centred on the pointer. So while one is armed, and while its
  tile is dragged, the same translucent piece follows the pointer at that default size, exactly as a placed piece's
  does, instead of a dashed footprint (or nothing at all, before the first press). The moment a press-and-drag starts
  drawing a box, the preview steps aside and the draw-to-size box takes over, so the piece is never shown twice.
  The Room is the exception: it draws no box at all (a press-and-drag drops it at its default size, like a placed
  piece, and it is resized after: [Office](../009-elements/office.md) "Dropped, then sized"), so its preview stays.
  (A Room's preview shows the doorway in its front wall where its Door lands: [Office](../009-elements/office.md) "Room".)
- Sized kinds the art layer does not draw (text, stickies, a Lane, the generic shapes) keep the dashed footprint
  while dragged and the draw-to-size box while armed.

Implementation: `isPlacedShape` and `isFixedSizeElement` in `packages/document/src/placed-kinds.ts`;
`components/canvas/collab/PlacementPreview.tsx` (generalised from the Door's preview),
`components/canvas/PieceArt.tsx` (the piece art, shared with `BoxedElementView`); `previewsItself` in
`PlacementPreview.tsx` says which kinds preview themselves (placed kinds and every kind with piece art), and
`PaletteDragGhost` stands aside for them; `buildDrawnBoxed` places placed kinds as a tap.
