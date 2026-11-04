// A template's page backgrounds (docs/specs/008-canvas/canvas-and-palette.md "Templates on pages"):
// always the theme's own (a Theme gradient, an animated background in a theme colouring, or the
// plain paper), never a colour of the template's own, so they follow the theme. Written against the
// Default theme's light half; withBlankPageThemed carries them to the theme the template lands in.
import {
  getBuiltInTheme,
  motionFill,
  themeGradientFill,
  type PageBackground,
  type PageMotion,
  type PageMotionColouringId,
  type ThemeGradientName,
} from '@livedocuments/document';

// The theme every template's backgrounds are written in.
export const TEMPLATE_THEME = getBuiltInTheme(undefined, 'light');

/** A page on one of the theme's gradients. */
export function themeGradientBackground(name: ThemeGradientName): PageBackground {
  return { fill: themeGradientFill(TEMPLATE_THEME, name) };
}

/** A slide on an animated background in one of the theme's colourings. */
export function themeMotionBackground(
  motion: PageMotion,
  colouring: PageMotionColouringId,
): PageBackground {
  return { fill: motionFill(TEMPLATE_THEME, motion, colouring) };
}
