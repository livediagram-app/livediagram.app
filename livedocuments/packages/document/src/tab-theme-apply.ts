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
import { canvasSurface } from '@liveworkspace/element-model/colour-math';
import type { Element } from './element-union';
import { layOutPages, pagesOf } from './page';
import { elementPageTones } from './page-content';
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

// The theme the tab was on, in one half: undefined only for a named theme that resolves to nothing (reset outright).
function previousThemeIn(
  themeId: string | undefined,
  appearance: Appearance,
): ThemeDefinition | undefined {
  // A theme never set is the default's baseline.
  return themeId === undefined
    ? (resolveThemeIn(undefined, appearance) ?? getBuiltInTheme(undefined, appearance))
    : resolveThemeIn(themeId, appearance);
}

// Every element restyled from the tab's theme to `id` in one half: first drawn as that half shows it, then each theme
// colour switched to the new theme's (or reset, with no baseline). `tones` are the filled pages under the elements, so
// a label is read against its page as the canvas draws it.
function elementsRestyledIn(
  source: Tab,
  id: string,
  half: Appearance,
  tones: ReadonlyMap<string, string>,
): Element[] {
  const theme = resolveThemeIn(id, half) ?? getBuiltInTheme(id, half);
  const viewMap = themeColourMap(themeSource(source.theme) ?? DEFAULT_SCHEME_LIGHT, half);
  const seen = source.elements.map((el) => viewElementInTheme(el, viewMap, tones.get(el.id)));
  const prevTheme = previousThemeIn(source.theme, half);
  if (!prevTheme) return resetThemeElementsToTheme(seen, theme);
  return resetArrowsToTheme(switchThemeElements(seen, prevTheme, theme), theme);
}

/**
 * The tab restyled to theme `id` in `appearance`, each element a new object. Preserve-customs for shapes, text and the
 * backdrop (a field still on the old theme's value takes the new one's; one set by hand stays); arrows always take the
 * new stroke; pages on a fill of the old theme's own take the new theme's. A tab whose theme names nothing known has no
 * baseline to diff against, so it is reset to the new theme outright.
 *
 * An element on a page with a fill of its own takes the theme in the half that page draws it in, not the applier's
 * (docs/specs/011-theme/light-and-dark.md "A page's own paper"): a dark slide's words get the dark half's light text,
 * so a later re-inking (a stage recipe's night slides moving to the new theme's night) finds them reading and keeps
 * them the theme's, rather than baking the light half's dark words into a dim colour of their own.
 */
export function tabWithTheme(source: Tab, id: string, appearance: Appearance): Tab {
  const theme = resolveThemeIn(id, appearance) ?? getBuiltInTheme(id, appearance);
  // Each element's half: its filled page's surface, else the applier's (docs/specs/011-theme/light-and-dark.md).
  const tones = elementPageTones(source.elements, layOutPages(pagesOf(source)));
  const halfOf = (elId: string): Appearance => {
    const tone = tones.get(elId);
    return tone ? canvasSurface(tone) : appearance;
  };
  const halves = new Set<Appearance>([appearance, ...[...tones.values()].map(canvasSurface)]);
  // The whole list restyled once per half in use (a hierarchy's branch colours read the whole tab), each element then
  // taken from its own half's pass: one pass for a tab with no filled page or only pages of the applier's surface.
  const byHalf = new Map<Appearance, Element[]>();
  for (const half of halves) byHalf.set(half, elementsRestyledIn(source, id, half, tones));
  const elements =
    halves.size === 1
      ? byHalf.get(appearance)!
      : source.elements.map((el, i) => byHalf.get(halfOf(el.id))![i]!);
  const prevTheme = previousThemeIn(source.theme, appearance);
  if (!prevTheme) {
    return {
      ...source,
      elements,
      theme: id,
      backgroundColor: theme.backgroundColor,
      backgroundPattern: theme.backgroundPattern,
      patternColor: theme.patternColor,
      backgroundOpacity: theme.backgroundOpacity,
    };
  }
  const backdrop = switchThemeBackdrop(source, prevTheme, theme);
  return withPageBackgroundsFollowingTheme(
    { ...source, elements, theme: id, ...backdrop },
    prevTheme,
    theme,
  );
}
