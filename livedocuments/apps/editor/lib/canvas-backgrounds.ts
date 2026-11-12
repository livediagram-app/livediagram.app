// livedocuments's canvas pattern + backdrop builders (docs/specs/008-canvas/canvas-and-palette.md "Canvas"): the shared ones
// (@liveworkspace/workbench/lib/canvas-backgrounds), bound once over this editor's patterns and seasonal motifs.
import type { BackgroundPattern } from '@livedocuments/document';
import { createCanvasBackgrounds } from '@liveworkspace/workbench/lib/canvas-backgrounds';
import { seasonalPatternTile } from '@/lib/seasonal-patterns';

export { safeCssColor, worldPatternOrigin } from '@liveworkspace/workbench/lib/canvas-backgrounds';

export const { tabBackgroundStyle, backgroundPatternTile } =
  createCanvasBackgrounds<BackgroundPattern>({
    seasonalPatternTile,
  });
