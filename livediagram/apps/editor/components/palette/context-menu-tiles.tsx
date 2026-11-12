'use client';

// livediagram's animation-picker tile grids for the editor context menu (docs/specs/008-canvas/canvas-and-palette.md):
// the arrow Flow and icon-animation pickers, the chart legend placement and the icon size and weight grids, plus the TileLabel + SpeedTiles its own pickers reuse. The grids are
// the shared ones (@liveworkspace/workbench/components/palette/context-menu-tiles), made once here around this
// editor's palette tile, animation miniatures and icon primitives.
import {
  createContextMenuTiles,
  createFlowTiles,
} from '@liveworkspace/workbench/components/palette/context-menu-tiles';
import { SizeButton } from '@/components/palette/palette-controls';
import { AnimationPreviewTile } from '@/components/palette/AnimationPreviewTile';
import {
  ArrowFlowPreview,
  IconAnimationPreview,
} from '@/components/palette/animation-previews-existing';
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
  LegendPositionTiles,
  IconSizeTiles,
  IconWeightTiles,
} = createContextMenuTiles({ SizeButton, AnimationPreviewTile, IconAnimationPreview, IconPrims });

export const FlowTiles = createFlowTiles({
  AnimationPreviewTile,
  ArrowFlowPreview,
  SpeedAndRepeatRows,
});
