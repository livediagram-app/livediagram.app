// A style recipe's slides (docs/specs/011-theme/style-guide.md "Agents"): a recipe made for the stage (keynote) puts its
// slides on its theme's own night canvas, as a keynote deck reads, rather than the light Steel every new slide starts
// on. Agents paint in the light half, where even a dark theme's canvas is light, so the recipe says so itself.
import { tint } from './colors';
import { pageKindOf, pagesOf, type Page, type PageBackground, type PageFill } from './page';
import { PAGE_GRADIENT_ANGLE, sameFill } from './page-paint';
import { defaultPageBackground } from './page-default-background';
import { pagesGivenNewPageBackground } from './pages-background-copy';
import { isThemeOwnFill } from './page-theme-fills';
import { newPageBackgroundOf, withNewPageBackground } from './tab-new-page-background';
import { getBuiltInTheme } from './themes';
import type { Tab } from './index';

// The night canvas lifted this far toward white at the top: a gradient, as Steel is, not a flat slab.
export const DARK_SLIDE_TOP_TINT = 0.12;

const nightFill = (canvas: string): PageFill => ({
  kind: 'gradient',
  from: tint(canvas, DARK_SLIDE_TOP_TINT),
  to: canvas,
  angle: PAGE_GRADIENT_ANGLE,
});

/** A dark slide for a theme: its dark half's canvas, lifted at the top. */
export function darkSlideBackground(themeId: string | undefined): PageBackground {
  return { fill: nightFill(getBuiltInTheme(themeId, 'dark').backgroundColor) };
}

// Any theme's dark slide (its foot a night canvas, its top that lifted), so one made before a theme change counts.
const isNight = (fill: PageFill | undefined): boolean =>
  !!fill && fill.kind === 'gradient' && sameFill(fill, nightFill(fill.to));

/**
 * The tab's slides dressed for its recipe. Dark: every slide still on a default (none, Steel, a fill of the theme's
 * own, an earlier dark slide) and every new one goes onto the theme's dark slide, re-inked. Not dark: the slides a
 * recipe made dark go back to Steel. A slide a person painted keeps its paint; a tab without slides is as it was.
 */
export function withRecipeSlides<T extends Tab>(tab: T, dark: boolean): T {
  if (!pagesOf(tab).some((p) => pageKindOf(p) === 'slide')) return tab;
  const theme = getBuiltInTheme(tab.theme, 'light');
  const steel = defaultPageBackground(theme, 'slide').fill!;
  const night = (p: Page) => pageKindOf(p) === 'slide' && isNight(p.background?.fill);
  if (!dark) {
    if (!isNight(newPageBackgroundOf(tab)?.fill)) return tab;
    const back = pagesGivenNewPageBackground(
      withNewPageBackground(tab, { fill: steel }),
      undefined,
      night,
    );
    return withNewPageBackground(back.tab, null);
  }
  const reaches = (p: Page) => {
    if (pageKindOf(p) !== 'slide') return false;
    const fill = p.background?.fill;
    return !fill || sameFill(fill, steel) || isThemeOwnFill(fill, theme) || isNight(fill);
  };
  return pagesGivenNewPageBackground(
    withNewPageBackground(tab, darkSlideBackground(tab.theme)),
    undefined,
    reaches,
  ).tab;
}

/** Whether the tab's new slides go onto a dark slide (a recipe made them dark). */
export function slidesAreDark(tab: Tab): boolean {
  return isNight(newPageBackgroundOf(tab)?.fill);
}
