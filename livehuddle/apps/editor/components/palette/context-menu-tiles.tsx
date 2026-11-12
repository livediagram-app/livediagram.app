'use client';

// livehuddle's animation-picker tile grids for the editor context menu (docs/specs/008-canvas/canvas-and-palette.md):
// the icon-animation picker, the icon size and weight grids, plus the TileLabel + SpeedTiles its own pickers reuse. The grids are
// the shared ones (@liveworkspace/workbench/components/palette/context-menu-tiles), made once here around this
// editor's palette tile, animation miniatures and icon primitives.
import { createContextMenuTiles } from '@liveworkspace/workbench/components/palette/context-menu-tiles';
import { SizeButton } from '@/components/palette/palette-controls';
import { AnimationPreviewTile } from '@/components/palette/AnimationPreviewTile';
import { IconAnimationPreview } from '@/components/palette/animation-previews-existing';
import { IconPrims } from '@/components/primitives/icon-glyph';

export {
  NOOP,
  TileLabel,
  useSpeedRowGate,
  withNone,
} from '@liveworkspace/workbench/components/palette/context-menu-tiles';

export const {
  SpeedTiles,
  SpeedAndRepeatRows,
  IconAnimationTiles,
  IconSizeTiles,
  IconWeightTiles,
} = createContextMenuTiles({ SizeButton, AnimationPreviewTile, IconAnimationPreview, IconPrims });
