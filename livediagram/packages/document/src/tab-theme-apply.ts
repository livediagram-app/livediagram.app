// Applying a theme to one tab (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel" and "Agents",
// docs/specs/011-theme/multicolour-themes.md): the tab's theme id, its backdrop and its elements' colours, as one pure
// transform in a given appearance. The editor runs it in the viewer's appearance (picking a theme or a look), the api's
// `style` changeset in the light half, so a theme lands the same from either.
import {
  DEFAULT_SCHEME_LIGHT,
  getBuiltInTheme,
  switchThemeBackdrop,
  type Appearance,
  type ThemeDefinition,
} from '@liveworkspace/element-model/themes';
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
import { withReadableLabelInks } from './label-backdrop';
import { themeSource } from './tab-as-seen';
import type { Tab } from './tab-type';

/** A theme id in one appearance's half, or undefined when it names no theme a tab can take. */
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
 * new stroke; a label the pick sank into what is behind it gets an ink that reads there. A tab whose theme names nothing
 * known has no baseline to diff against, so it is reset to the new theme outright.
 */
export function tabWithTheme(source: Tab, id: string, appearance: Appearance): Tab {
  const theme = resolveThemeIn(id, appearance) ?? getBuiltInTheme(id, appearance);
  // The tab as the applier sees it (docs/specs/011-theme/light-and-dark.md): its theme colours in the applier's half,
  // so colours written by someone in the other appearance still read as the theme's, not as choices.
  const viewMap = themeColourMap(themeSource(source.theme) ?? DEFAULT_SCHEME_LIGHT, appearance);
  const t = { ...source, elements: source.elements.map((el) => viewElementInTheme(el, viewMap)) };
  // When the tab's PREVIOUS theme can't be resolved (an id no catalogue entry names), its elements carry the dead
  // theme's colours, which match neither the default nor the new theme, so the preserve-customs walk would treat them
  // all as overrides and recolour nothing. Hard-reset instead so a theme always visibly applies. A theme never SET
  // (a fresh document, an added tab, the Blank template) is not that case: its baseline is the default theme, and
  // hard-resetting it wiped hand-picked colours on a first theme pick.
  const prevTheme =
    t.theme === undefined
      ? getBuiltInTheme(undefined, appearance)
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
  // Per-field preserve-customs (switchThemeElement); the graph-aware walk rainbows the branches when either side is a
  // multi-colour theme. Arrows are the exception: they ALWAYS snap to the new theme's stroke, so a pick re-tints every
  // connector instead of leaving hand-coloured ones on the old hue.
  const switched = resetArrowsToTheme(switchThemeElements(t.elements, prevTheme, theme), theme);
  // The backdrop follows the same rule: a deliberately chosen pattern or colour survives the change.
  const backdrop = switchThemeBackdrop(t, prevTheme, theme);
  // docs/specs/011-theme/light-and-dark.md "A theme never sinks a label into what is behind it".
  const elements = [
    ...withReadableLabelInks(
      t.elements,
      viewedCanvas(t.backgroundColor ?? prevTheme.backgroundColor, viewMap),
      switched,
      backdrop.backgroundColor,
    ),
  ];
  return { ...t, elements, theme: id, ...backdrop };
}

// A stored canvas colour as the applier sees it: the theme's, in their half; any other colour as it is.
const viewedCanvas = (colour: string, map: ReadonlyMap<string, string>): string =>
  map.get(colour.toLowerCase()) ?? colour;
