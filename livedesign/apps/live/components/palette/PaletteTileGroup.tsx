'use client';

import { createPaletteTileGroup } from '@liveworkspace/workbench/components/palette/PaletteTileGroup';
import type { PendingDraw } from '@/lib/draw-mode';
import { PaletteToolRows } from './PaletteToolRows';
import type { PaletteTileDef } from './palette-tile-defs';
import type { PaletteTileActions } from './PaletteTileGrid';

// A titled, collapsible group of the Tools tab's rows, shared by the editors and bound to this one's rows.
export const PaletteTileGroup = createPaletteTileGroup<PaletteTileDef, PaletteTileActions, PendingDraw>({
  PaletteToolRows,
});
