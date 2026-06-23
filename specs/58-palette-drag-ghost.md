# 58 — Palette drag ghost + drop preview

Polish on the drag-to-add flow (spec/09). When you drag a shape / device /
icon tile out of the palette, the canvas now shows a **live ghost** of what
will land, exactly where it will land, instead of the browser's default
drag image (a snapshot of the tile) and no on-canvas feedback.

## Behaviour

- On `dragstart` of a palette tile, the browser's default drag image is
  suppressed (a 1×1 transparent image) so the only thing the user sees is
  the canvas ghost.
- While dragging over the **canvas** (not over a floating panel), a
  translucent, brand-tinted ghost follows the cursor:
  - It is the shape's real silhouette (`ShapeGlyph` — a circle previews as a
    circle, a cylinder as a cylinder) inside a dashed brand footprint.
  - Sized to the shape's `SHAPE_DEFAULT_SIZE` × the current zoom, and
    **centred on the cursor** — matching where `dropPaletteItem` places the
    element (it centres on the drop point).
- Over a floating panel (a "changed my mind" drag back to the palette) the
  ghost hides, mirroring the existing `usePaletteDrop` no-drop guard.
- On `drop` / `dragend` / `Escape`, the ghost clears.
- Decorative only: it respects reduce-motion (the global rule collapses its
  fade-in) and dark mode, and is `pointer-events-none` so it never
  intercepts the drop.

## Implementation

- `lib/palette-drag-preview.ts` — a tiny module store
  (`{ kind, iconId?, width, height } | null`) with `useSyncExternalStore`
  access, plus `suppressNativeDragImage(e)`. Drag state is inherently global
  - transient, so a subscribable module store fits better than threading it
    through the editor's prop tree.
- Palette tiles (`IconButton` in `palette-controls`, icon tiles in
  `CommandPalette`) set the preview on `dragstart` (alongside the existing
  `setData`) and clear it on `dragend`.
- `components/canvas/PaletteDragGhost.tsx` — an overlay rendered by `Canvas`
  that reads the preview + tracks the cursor via a `dragover` listener and
  paints the ghost at the `z-overlay` rung.

No change to the drop itself (`usePaletteDrop` / `dropPaletteItem`); this is
purely an additive preview layer.
