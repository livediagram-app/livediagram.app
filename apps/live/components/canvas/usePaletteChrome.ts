'use client';

import { getTheme } from '@/lib/themes';
import type { CanvasChromeProps } from './CanvasChrome';

// The palette's chrome behaviour (docs/specs/008-canvas/canvas-and-palette.md), lifted out of
// useCanvasChromePanels: the active-tab theme tint the tiles preview.
export function usePaletteChrome({ tabThemeId }: { tabThemeId: CanvasChromeProps['tabThemeId'] }) {
  // Theme tint for the palette tiles, so the palette previews the active
  // tab theme: the boxed-shape tiles render filled in the theme's element
  // fill + stroke, line-art tools + icons tint to the stroke. The Basic
  // theme leaves elementStroke null, so we pass nothing and the palette
  // keeps its default slate look. See docs/specs/008-canvas/canvas-and-palette.md.
  const paletteTheme = getTheme(tabThemeId);
  // A per-shape theme (UML / custom, docs/specs/011-theme/canvas-and-theme-dialog.md + docs/specs/011-theme/custom-themes.md) tints each shape
  // tile by its own kind even when the base element stroke is unset, so
  // surface the tint whenever there's a base stroke OR per-shape colours.
  const paletteTint =
    paletteTheme.elementStroke || paletteTheme.shapeColors
      ? {
          stroke: paletteTheme.elementStroke ?? undefined,
          fill: paletteTheme.elementFill ?? undefined,
          shapeColors: paletteTheme.shapeColors,
        }
      : undefined;

  return { paletteTheme, paletteTint };
}
