// Applying a theme to one tab (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel", "Agents",
// docs/specs/011-theme/multicolour-themes.md): the tab's theme id, its backdrop, its elements' colours and its pages'
// theme fills, as one pure transform in a given appearance. The editor runs it in the viewer's appearance (picking a
// theme or a look, apps/live/lib/tab-theme-apply.ts), the agents' tab_style in the light half, so a theme lands the
// same from either.
import {
  DEFAULT_SCHEME_ID,
  DEFAULT_SCHEME_LIGHT,
  getBuiltInTheme,
  resetThemeElementsToTheme,
  switchThemeBackdrop,
  switchThemeElements,
  THEMES,
  themeColourMap,
  themeHalf,
  viewElementInTheme,
  type Appearance,
  type Tab,
  type ThemeDefinition,
} from './index';
import { withPageBackgroundsFollowingTheme } from './page-theme-follow';

/** How a theme pick treats the elements (docs/specs/011-theme/canvas-and-theme-dialog.md "Element colours"): by
 *  default every colour still on the old theme's takes the new theme's and a colour someone chose stays; with
 *  `keepElementColours` no element changes colour (the theme still sets the tab's backdrop, its pages' theme fills
 *  and the colours new elements take). */
export type ThemeApplyOptions = { keepElementColours?: boolean };

/** The scheme as written (its native half, before tuning): what its light / dark halves and its colour map are built
 *  from. Undefined for an id that names nothing known. */
function themeSource(id: string | undefined): ThemeDefinition | undefined {
  if (!id) return undefined;
  if (id === DEFAULT_SCHEME_ID) return DEFAULT_SCHEME_LIGHT;
  return THEMES.find((t) => t.id === id);
}

/** A theme id in one appearance's half, or undefined when it names no built-in theme (a retired theme, or any other
 *  id a stored tab carries). */
export function resolveThemeIn(
  id: string | undefined,
  appearance: Appearance,
): ThemeDefinition | undefined {
  const source = themeSource(id);
  return source ? themeHalf(source, appearance) : undefined;
}

/** Whether an id names a theme a tab can take. */
export function isTabThemeId(id: string): boolean {
  return themeSource(id) !== undefined;
}

/** The tab restyled to theme `id` in `appearance`, each element a new object (the editor's withThemeApplied keeps
 *  the unchanged ones as they were). */
export function tabWithTheme(
  source: Tab,
  id: string,
  appearance: Appearance,
  options: ThemeApplyOptions = {},
): Tab {
  const theme = resolveThemeIn(id, appearance) ?? getBuiltInTheme(id, appearance);
  // The tab as the applier sees it (docs/specs/011-theme/light-and-dark.md): its theme colours in the applier's half,
  // so colours written by someone in the other appearance still read as the theme's, not as choices.
  const viewMap = themeColourMap(themeSource(source.theme) ?? DEFAULT_SCHEME_LIGHT, appearance);
  const t = { ...source, elements: source.elements.map((el) => viewElementInTheme(el, viewMap)) };
  // When the tab's PREVIOUS theme can't be resolved (an id that names no built-in theme), there's no baseline to
  // diff against: the elements carry that theme's colours, which match neither the default nor the new theme, so the
  // preserve-customs walk would treat them all as user overrides and recolour nothing, the tab reading as "stuck on
  // the unknown theme". Hard-reset to the new theme instead so picking a theme always visibly applies.
  //
  // A tab whose theme was simply NEVER SET (a fresh design, an added tab, the Blank template) is NOT that case: its
  // baseline is the default theme, and the preserve-customs walk against it works; hard-resetting here wiped a
  // user's hand-picked colours on their FIRST theme pick. Only a named theme that fails to resolve takes the
  // hard-reset branch.
  const prevTheme =
    t.theme === undefined
      ? (resolveThemeIn(undefined, appearance) ?? getBuiltInTheme(undefined, appearance))
      : resolveThemeIn(t.theme, appearance);
  if (options.keepElementColours) {
    // The elements as they are; the backdrop and the pages still follow the theme.
    const kept = { ...source, theme: id };
    if (!prevTheme)
      return {
        ...kept,
        backgroundColor: theme.backgroundColor,
        backgroundPattern: theme.backgroundPattern,
        patternColor: theme.patternColor,
        backgroundOpacity: theme.backgroundOpacity,
      };
    return withPageBackgroundsFollowingTheme(
      { ...kept, ...switchThemeBackdrop(source, prevTheme, theme) },
      prevTheme,
      theme,
    );
  }
  if (!prevTheme) {
    return {
      ...t,
      elements: resetThemeElementsToTheme(t.elements, theme),
      theme: id,
      backgroundColor: theme.backgroundColor,
      backgroundPattern: theme.backgroundPattern,
      patternColor: theme.patternColor,
      backgroundOpacity: theme.backgroundOpacity,
    };
  }
  // Per-field, preserve-customs walk (switchThemeElement's rule: a field is replaced when it's unset or still matches
  // the previous theme's value, and kept when someone set it to something else). The graph-aware wrapper also
  // rainbows the branches when either side is a multi-colour theme (docs/specs/011-theme/multicolour-themes.md).
  // Arrows follow the same rule (docs/specs/011-theme/canvas-and-theme-dialog.md "Element colours"): a design's
  // hand-coloured connector is part of the design, so a theme pick no longer re-tints every arrow as livediagram's
  // does; an arrow still on the old theme's stroke takes the new one.
  const elements = switchThemeElements(t.elements, prevTheme, theme);
  // The backdrop follows the same preserve-customs rule: a deliberately chosen pattern or colour survives.
  const backdrop = switchThemeBackdrop(t, prevTheme, theme);
  // Labels keep their inks: every tab is pages, and a page has its own paper rather than the canvas behind it.
  // Pages on a fill of the old theme's own take the new theme's (page-theme-follow).
  return withPageBackgroundsFollowingTheme(
    { ...t, elements, theme: id, ...backdrop },
    prevTheme,
    theme,
  );
}
