'use client';

import { createPaletteDragGhost } from '@liveworkspace/workbench/components/canvas/PaletteDragGhost';
import { ShapeGlyph } from '@/components/primitives/shape-icon';
import { usePaletteDragPreview, usePaletteDragSnap } from '@/lib/palette-drag-preview';

// Drag-to-add ghost (docs/specs/010-palette/palette-drag-ghost.md), shared by the editors and bound to this one's
// drag preview and shape glyphs.
export const PaletteDragGhost = createPaletteDragGhost({
  usePaletteDragPreview,
  usePaletteDragSnap,
  ShapeGlyph,
});
