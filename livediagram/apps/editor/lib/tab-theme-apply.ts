// Applying a theme to one tab (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel", docs/specs/011-theme/
// multicolour-themes.md): the tab's theme id, its backdrop and its elements' colours, as one pure transform. Picking a
// theme (useTabTheme.setTheme) and picking a look (useTabCanvas.applyTabLook) both run it, so a look's theme lands
// exactly as picking that theme does.
import {
  viewElementInTheme,
  withReadableLabelInks,
  type Appearance,
  type Tab,
} from '@livediagram/document';
import { getResolvedAppearance } from '@livediagram/ui';
import {
  getTheme,
  resetArrowsToTheme,
  resetThemeElementsToTheme,
  resolveTheme,
  switchThemeBackdrop,
  switchThemeElements,
  themeViewMap,
} from '@/lib/themes';

/** The tab with theme `id` applied: preserve-customs for shapes, text and backdrop; arrows always re-tinted. */
export function withThemeApplied(
  source: Tab,
  id: string,
  appearance: Appearance = getResolvedAppearance(),
): Tab {
  const theme = getTheme(id, appearance);
  // The tab as the applier sees it (docs/specs/011-theme/light-and-dark.md): its theme colours in the applier's half,
  // so colours written by someone in the other appearance still read as the theme's, not as choices.
  const viewMap = themeViewMap(source.theme, appearance);
  const t = { ...source, elements: source.elements.map((el) => viewElementInTheme(el, viewMap)) };
  // When the tab's PREVIOUS theme can't be resolved (an id no catalogue
  // entry names), there's no baseline to diff against:
  // the elements carry the dead theme's colours, which match neither
  // the default nor the new theme, so the preserve-customs walk would
  // treat them all as user overrides and recolour nothing — the tab
  // reads as "stuck on the deleted theme". Hard-reset to the new
  // theme instead so picking a theme always visibly applies.
  //
  // A tab whose theme was simply NEVER SET (a fresh document, an
  // added tab, the Blank template) is NOT that case: its baseline
  // is the default theme, and the preserve-customs walk against it
  // works — hard-resetting here wiped a user's hand-picked colours
  // on their FIRST theme pick. Only a named theme that fails to
  // resolve takes the hard-reset branch.
  const prevTheme =
    t.theme === undefined ? getTheme(undefined, appearance) : resolveTheme(t.theme, appearance);
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
  // Per-field, preserve-customs walk. See `switchThemeElement`
  // in lib/themes.ts for the rule (a field is replaced when
  // it's unset or still matches the previous theme's value,
  // and kept when the user has set it to something else). The
  // graph-aware wrapper additionally rainbows the branches when
  // either side is a multi-colour theme (docs/specs/011-theme/multicolour-themes.md).
  // Arrows are the exception to preserve-customs: they ALWAYS snap
  // to the new theme's stroke (resetArrowsToTheme), so a theme pick
  // re-tints every connector instead of leaving hand-coloured ones
  // on the old hue. Shapes / text keep their customisations.
  const switched = resetArrowsToTheme(switchThemeElements(t.elements, prevTheme, theme), theme);
  // Backdrop follows the same preserve-customs rule as the
  // elements: a deliberately-chosen pattern / colour survives a
  // theme change instead of being reset to the theme's backdrop.
  const backdrop = switchThemeBackdrop(t, prevTheme, theme);
  // A label the pick sank into what is behind it gets an ink that reads there (docs/specs/011-theme/light-and-dark.md
  // "A theme never sinks a label into what is behind it").
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
