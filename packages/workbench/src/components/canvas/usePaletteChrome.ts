'use client';

// The palette's chrome behaviour (docs/specs/008-canvas/canvas-and-palette.md), lifted out of
// useCanvasChromePanels: the active-tab theme tint the tiles preview.

/** A theme as the palette's tint reads it; each editor's ThemeDefinition carries more. */
export type PaletteChromeTheme = {
  elementStroke: string | null;
  elementFill: string | null;
  elementText: string | null;
  shapeColors?: unknown;
};

/** The palette chrome hook, made once per editor at module scope around its theme lookup (lib/themes getTheme). */
export function createUsePaletteChrome<Id, T extends PaletteChromeTheme>(getTheme: (id: Id) => T) {
  function usePaletteChrome({ tabThemeId }: { tabThemeId: Id }) {
    // Theme tint for the palette tiles, so the palette previews the active
    // tab theme: the boxed-shape tiles render filled in the theme's element
    // fill + stroke, line-art tools + icons tint to the stroke. The Basic
    // theme leaves elementStroke null, so we pass nothing and the palette
    // keeps its default slate look. See docs/specs/008-canvas/canvas-and-palette.md.
    const paletteTheme = getTheme(tabThemeId);
    // A per-shape theme (UML, docs/specs/011-theme/canvas-and-theme-dialog.md) tints each shape
    // tile by its own kind even when the base element stroke is unset, so
    // surface the tint whenever there's a base stroke OR per-shape colours.
    const paletteTint =
      paletteTheme.elementStroke || paletteTheme.shapeColors
        ? {
            stroke: paletteTheme.elementStroke ?? undefined,
            fill: paletteTheme.elementFill ?? undefined,
            text: paletteTheme.elementText ?? undefined,
            shapeColors: paletteTheme.shapeColors as T['shapeColors'],
          }
        : undefined;

    return { paletteTheme, paletteTint };
  }

  return usePaletteChrome;
}
