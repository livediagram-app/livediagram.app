'use client';

import { createPaletteToolRows } from '@liveworkspace/workbench/components/palette/PaletteToolRows';
import { setPaletteDragPreview } from '@/lib/palette-drag-preview';
import type { PendingDraw } from '@/lib/draw-mode';
import type { PaletteTileDef } from './palette-tile-defs';
import { tileDragStart } from './palette-tile-drag';
import { tileActive, tileHandler, visibleTiles, type PaletteTileActions } from './PaletteTileGrid';

// The Tools tab's list layout (docs/specs/008-canvas/canvas-and-palette.md), shared by the editors and bound to this
// one's tiles.
export const { PaletteToolRow, PaletteToolRows } = createPaletteToolRows<
  PaletteTileDef,
  PaletteTileActions,
  PendingDraw
>({ tileActive, tileHandler, visibleTiles, tileDragStart, setPaletteDragPreview });
