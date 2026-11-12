// The editor parts the shared palette tile grids (StylePresets, context-menu-tiles) are made around.
// Each editor keeps its own and hands them in once, at module scope, so the grids render its controls.
import type { PointerEvent, ReactNode } from 'react';

/** The editor's palette tile (its components/palette/palette-controls SizeButton), as the grids use it. */
export type PaletteTileProps = {
  active: boolean;
  onClick: () => void;
  onPointerEnter?: (e: PointerEvent) => void;
  onPointerLeave?: (e: PointerEvent) => void;
  label?: string;
  children: ReactNode;
};

/** The editor's animation-picker tile (its components/palette/AnimationPreviewTile), a frozen miniature. */
export type AnimationPreviewTileProps = {
  active: boolean;
  label: string;
  frame: number;
  onClick: () => void;
  onPreview?: () => void;
  onPreviewEnd?: () => void;
  children: ReactNode;
};
