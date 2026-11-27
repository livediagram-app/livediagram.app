// Applying a theme, a finish and a font to one tab (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel",
// docs/specs/011-theme/multicolour-themes.md): pure transforms in a given appearance, whatever the tab's kind. The
// editor runs them in the viewer's appearance (picking a theme, a look, a finish or a font), the api's style
// changeset in the light half (docs/specs/024-agents/agent-changesets.md "Style"), so a theme lands the same from
// either.
import { supportsFinish, type Finish } from '@liveworkspace/element-model/finish';
import {
  viewElementInTheme,
  themeColourMap,
  themeHalf,
} from '@liveworkspace/element-model/theme-halves';
import { isBoxed, type Element } from './element-union';
import { withReadableLabelInks } from './label-backdrop';
import type { Tab } from './tab-type';
import { resetArrowsToTheme, resetThemeElementsToTheme, switchThemeElements } from './theme-graph';
import {
  DEFAULT_SCHEME_ID,
  DEFAULT_SCHEME_LIGHT,
  THEMES,
  getBuiltInTheme,
  switchThemeBackdrop,
  type Appearance,
  type ThemeDefinition,
} from './themes';

/** The scheme as written (its native half, before tuning): what its light / dark halves and its colour map are built
 *  from. Undefined for an id that names nothing known. THEMES here is this product's catalogue, board themes
 *  included. */
export function themeSourceOf(id: string | undefined): ThemeDefinition | undefined {
  if (!id) return undefined;
  if (id === DEFAULT_SCHEME_ID) return DEFAULT_SCHEME_LIGHT;
  return THEMES.find((t) => t.id === id);
}

/** A theme id in one appearance's half, or undefined when it names nothing known. */
export function resolveThemeIn(
  id: string | undefined,
  appearance: Appearance,
): ThemeDefinition | undefined {
  const source = themeSourceOf(id);
  return source ? themeHalf(source, appearance) : undefined;
}

/** Whether an id names a theme a tab can take. */
export function isTabThemeId(id: string): boolean {
  return themeSourceOf(id) !== undefined;
}

// A stored canvas colour as the applier sees it: the theme's, in their half; any other colour as it is.
const viewedCanvas = (colour: string, map: ReadonlyMap<string, string>): string =>
  map.get(colour.toLowerCase()) ?? colour;

/**
 * The tab restyled to theme `id` in `appearance`, each element a new object. Preserve-customs for shapes, text and the
 * backdrop (a field still on the old theme's value takes the new one's; one set by hand stays); arrows always take the
 * new stroke; a label the pick sank into what is behind it gets an ink that reads there.
 */
export function tabWithTheme(source: Tab, id: string, appearance: Appearance): Tab {
  const theme = resolveThemeIn(id, appearance) ?? getBuiltInTheme(id, appearance);
  // The tab as the applier sees it (docs/specs/011-theme/light-and-dark.md): its theme colours in the applier's half,
  // so colours written by someone in the other appearance still read as the theme's, not as choices.
  const viewMap = themeColourMap(themeSourceOf(source.theme) ?? DEFAULT_SCHEME_LIGHT, appearance);
  const t = { ...source, elements: source.elements.map((el) => viewElementInTheme(el, viewMap)) };
  // A tab whose PREVIOUS theme names nothing known has no baseline to diff against: its elements carry the dead
  // theme's colours, which the preserve-customs walk would keep as hand-set, so the pick would change nothing. It is
  // reset to the new theme outright. A theme never SET (a fresh project, an added tab) is not that case: its baseline
  // is the default theme, and a hard reset there wiped a person's hand-picked colours on their first pick.
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
  // Arrows are the exception to preserve-customs: they always take the new theme's stroke, so a pick re-tints every
  // connector. The graph-aware switch rainbows the branches when either side is a multi-colour theme.
  const switched = resetArrowsToTheme(switchThemeElements(t.elements, prevTheme, theme), theme);
  // The backdrop follows the same preserve-customs rule: a chosen pattern or colour survives.
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

// Every element that carries text of its own (a font or a size): boxed elements and arrows.
const carriesText = (el: Element) => isBoxed(el) || el.type === 'arrow';

/** The tab lettered in `font` (null: the editor's default), every element following it again (its own font
 *  cleared). */
export function withTabFont(tab: Tab, font: string | null): Tab {
  const elements = tab.elements.map((el) => {
    if (!carriesText(el) || !('font' in el)) return el;
    const next = { ...el };
    delete next.font;
    return next;
  });
  const next: Tab = { ...tab, elements };
  if (font) next.font = font;
  else delete next.font;
  return next;
}

/** The tab drawn in `finish`, every element following it again (its own finish cleared). */
export function withTabFinish(tab: Tab, finish: Finish): Tab {
  const elements = tab.elements.map((el) => {
    if (!supportsFinish(el) || !('finish' in el)) return el;
    const next = { ...el } as Element & { finish?: Finish };
    delete next.finish;
    return next;
  });
  return { ...tab, finish, elements };
}

/** A tab's style as one change: any of its theme, finish and font. */
export type TabStyle = { theme?: string; finish?: Finish; font?: string };

/** The tab with `style` applied as the editor's pickers apply each part: the theme first, then the finish and the
 *  font. A part left out stays as it is. */
export function tabWithStyle(source: Tab, style: TabStyle, appearance: Appearance): Tab {
  let tab = style.theme ? tabWithTheme(source, style.theme, appearance) : source;
  if (style.finish) tab = withTabFinish(tab, style.finish);
  if (style.font) tab = withTabFont(tab, style.font);
  return tab;
}
