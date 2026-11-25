// The colours a page design draws in (docs/specs/011-theme/page-designs.md "Theme-driven colour"): its own three, else
// the theme's accent and second and third colours, worked out for the page they land on. Pure.
import { tint } from '@liveworkspace/element-model/colour-math';
import type { ThemeDefinition } from '../index';
import type { Page } from '../page';
import { pageFillTone, pageIsDark } from '../page-content';
import { themeAccent, themeSecondaries } from '../page-default-background';
import type { DesignPalette } from './draw-kit';

// On a dark page each colour is lifted this far toward white, so it glows rather than sinks.
const DARK_LIFT = 0.15;
export const DESIGN_INK_ON_DARK = '#ffffff';
export const DESIGN_INK_ON_LIGHT = '#0f172a';
const PAPER_LIGHT = '#ffffff';
const PAPER_DARK = '#0f172a';

export type DesignTheme = Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>;

/** The palette for a page: `colors` (the design's own) else the theme's. `paperDark` is the tone of a page without a
 *  fill (the paper is dark on screen in dark chrome, light in an export). */
export function designPalette(
  theme: DesignTheme,
  page: Pick<Page, 'background'>,
  paperDark: boolean,
  colors?: readonly [string, string, string],
): DesignPalette {
  const fill = page.background?.fill;
  const dark = fill ? pageIsDark(page) : paperDark;
  const own = colors ?? [themeAccent(theme), ...themeSecondaries(theme)];
  const [a, b, c] = own.map((x) => (dark ? tint(x, DARK_LIFT) : x).toLowerCase()) as [
    string,
    string,
    string,
  ];
  return {
    a,
    b,
    c,
    ink: dark ? DESIGN_INK_ON_DARK : DESIGN_INK_ON_LIGHT,
    base: fill ? pageFillTone(fill) : dark ? PAPER_DARK : PAPER_LIGHT,
    dark,
  };
}
