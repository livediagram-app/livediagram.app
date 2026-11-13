'use client';

import { createStripOpenerPanel } from '@liveworkspace/workbench/components/palette/StripOpenerPanel';
import type { PendingDraw } from '@/lib/draw-mode';
import { setPaletteDragPreview } from '@/lib/palette-drag-preview';
import { tileDisplayName, type PaletteTileDef } from './palette-tile-defs';
import { tileHandler, visibleTiles, type PaletteTileActions } from './PaletteTileGrid';
import { tileDragStart } from './palette-tile-drag';

// What a category opener opens on the Toolbar strip, shared by the editors and bound to this one's tiles.
export const StripOpenerPanel = createStripOpenerPanel<
  PaletteTileDef,
  PaletteTileActions,
  PendingDraw
>({
  tileHandler,
  visibleTiles,
  tileDragStart,
  tileDisplayName,
  setPaletteDragPreview,
});
