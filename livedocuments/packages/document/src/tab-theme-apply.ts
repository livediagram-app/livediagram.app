// Applying a theme to one tab (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel", docs/specs/011-theme/
// multicolour-themes.md): the tab's theme id, its backdrop, its elements' colours and its pages' theme fills, as one
// pure transform in a given appearance. The editor runs it in the viewer's appearance (picking a theme or a look), the
// MCP's tab_style in the light half, so a theme lands the same from either.
import {
  DEFAULT_SCHEME_ID,
  DEFAULT_SCHEME_LIGHT,
  getBuiltInTheme,
  switchThemeBackdrop,
} from '@liveworkspace/element-model/themes';
import { THEMES } from '@liveworkspace/element-model/retired-uml';
import {
  resetArrowsToTheme,
  resetThemeElementsToTheme,
  switchThemeElements,
} from '@liveworkspace/element-model/theme-graph';
import {
  themeColourMap,
  themeHalf,
  viewElementInTheme,
} from '@liveworkspace/element-model/theme-halves';
import type { Appearance, ThemeDefinition } from '@liveworkspace/element-model/themes';
import { withPageBackgroundsFollowingTheme } from './page-theme-fills';
import type { Tab } from './tab-type';

/** The scheme as written (its native half): undefined for an id that names nothing known. */
function themeSource(id: string | undefined): ThemeDefinition | undefined {
  if (!id) return undefined;
  if (id === DEFAULT_SCHEME_ID) return DEFAULT_SCHEME_LIGHT;
  return THEMES.find((t) => t.id === id);
}

/** A theme id in one appearance's half, or undefined when it names no built-in theme. */
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

/**
 * The tab restyled to theme `id` in `appearance`, each element a new object. Preserve-customs for shapes, text and the
 * backdrop (a field still on the old theme's value takes the new one's; one set by hand stays); arrows always take the
 * new stroke; pages on a fill of the old theme's own take the new theme's. A tab whose theme names nothing known has no
 * baseline to diff against, so it is reset to the new theme outright.
 */
export function tabWithTheme(source: Tab, id: string, appearance: Appearance): Tab {
  const theme = resolveThemeIn(id, appearance) ?? getBuiltInTheme(id, appearance);
  // The tab as the applier sees it (docs/specs/011-theme/light-and-dark.md): its theme colours in the applier's half.
  const viewMap = themeColourMap(themeSource(source.theme) ?? DEFAULT_SCHEME_LIGHT, appearance);
  const t = { ...source, elements: source.elements.map((el) => viewElementInTheme(el, viewMap)) };
  // A theme never set is the default's baseline; only a named theme that fails to resolve resets outright.
  const prevTheme =
    t.theme === undefined
      ? (resolveThemeIn(undefined, appearance) ?? getBuiltInTheme(undefined, appearance))
      : resolveThemeIn(t.theme, appearance);
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
  const switched = resetArrowsToTheme(switchThemeElements(t.elements, prevTheme, theme), theme);
  const backdrop = switchThemeBackdrop(t, prevTheme, theme);
  return withPageBackgroundsFollowingTheme(
    { ...t, elements: switched, theme: id, ...backdrop },
    prevTheme,
    theme,
  );
}
