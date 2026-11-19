// Applying a theme to one tab (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel", docs/specs/011-theme/
// multicolour-themes.md): the tab's theme id, its backdrop and its elements' colours, as one pure transform. Picking a
// theme (useTabTheme.setTheme) and picking a look (useTabCanvas.applyTabLook) both run it, so a look's theme lands
// exactly as picking that theme does.
import { keepUnchangedElements } from '@liveworkspace/workbench/lib/keep-unchanged-elements';
import { withTabStyleOf } from '@liveworkspace/workbench/lib/tab-style-to-all';
import { viewElementInTheme, type Appearance, type Tab } from '@livedesign/design';
import { withPageBackgroundsFollowingTheme } from './page-theme-follow';
import { getResolvedAppearance } from '@livedesign/ui';
import {
  getTheme,
  resetThemeElementsToTheme,
  resolveTheme,
  switchThemeBackdrop,
  switchThemeElements,
  themeViewMap,
} from '@/lib/themes';

/** How a theme pick treats the elements (docs/specs/011-theme/canvas-and-theme-dialog.md "Element colours"): by
 *  default every colour still on the old theme's takes the new theme's and a colour someone chose stays; with
 *  `keepElementColours` no element changes colour (the theme still sets the tab's backdrop, its pages' theme fills
 *  and the colours new elements take). */
export type ThemeApplyOptions = { keepElementColours?: boolean };

// The tab restyled from scratch: each of its elements a new object (withThemeApplied keeps the unchanged ones).
function themeAppliedAnew(
  source: Tab,
  id: string,
  appearance: Appearance = getResolvedAppearance(),
  options: ThemeApplyOptions = {},
): Tab {
  const theme = getTheme(id, appearance);
  // The tab as the applier sees it (docs/specs/011-theme/light-and-dark.md): its theme colours in the applier's half,
  // so colours written by someone in the other appearance still read as the theme's, not as choices.
  const viewMap = themeViewMap(source.theme, appearance);
  const t = { ...source, elements: source.elements.map((el) => viewElementInTheme(el, viewMap)) };
  // When the tab's PREVIOUS theme can't be resolved (an id that names
  // no built-in theme), there's no baseline to diff against:
  // the elements carry that theme's colours, which match neither
  // the default nor the new theme, so the preserve-customs walk would
  // treat them all as user overrides and recolour nothing — the tab
  // reads as "stuck on the unknown theme". Hard-reset to the new
  // theme instead so picking a theme always visibly applies.
  //
  // A tab whose theme was simply NEVER SET (a fresh design, an
  // added tab, the Blank template) is NOT that case: its baseline
  // is the default theme, and the preserve-customs walk against it
  // works — hard-resetting here wiped a user's hand-picked colours
  // on their FIRST theme pick. Only a named theme that fails to
  // resolve takes the hard-reset branch.
  const prevTheme =
    t.theme === undefined ? getTheme(undefined, appearance) : resolveTheme(t.theme, appearance);
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
  // Per-field, preserve-customs walk. See `switchThemeElement`
  // in lib/themes.ts for the rule (a field is replaced when
  // it's unset or still matches the previous theme's value,
  // and kept when the user has set it to something else). The
  // graph-aware wrapper additionally rainbows the branches when
  // either side is a multi-colour theme (docs/specs/011-theme/multicolour-themes.md).
  // Arrows follow the same rule (docs/specs/011-theme/canvas-and-theme-dialog.md "Element colours"): a design's
  // hand-coloured connector is part of the design, so a theme pick no longer re-tints every arrow as livediagram's
  // does; an arrow still on the old theme's stroke takes the new one.
  const elements = switchThemeElements(t.elements, prevTheme, theme);
  // Backdrop follows the same preserve-customs rule as the
  // elements: a deliberately-chosen pattern / colour survives a
  // theme change instead of being reset to the theme's backdrop.
  const backdrop = switchThemeBackdrop(t, prevTheme, theme);
  // Labels keep their inks: every tab is pages, and a page has its own paper rather than the canvas behind it.
  // Pages on a fill of the old theme's own take the new theme's (page-theme-follow).
  return withPageBackgroundsFollowingTheme(
    { ...t, elements, theme: id, ...backdrop },
    prevTheme,
    theme,
  );
}

/** The tab with theme `id` applied: preserve-customs for shapes, arrows, text and backdrop, or no element recoloured
 *  with `keepElementColours`.
 *  An element the pick leaves as it was is handed back as the same object, so its view does not render again
 *  (keepUnchangedElements; docs/specs/008-canvas/canvas-performance.md "A theme pick on a big board keeps the page
 *  answering"). */
export function withThemeApplied(
  source: Tab,
  id: string,
  appearance?: Appearance,
  options?: ThemeApplyOptions,
): Tab {
  const tab = themeAppliedAnew(source, id, appearance, options);
  return { ...tab, elements: keepUnchangedElements(source.elements, tab.elements) };
}

/** `target` restyled from `source` for Apply to All Tabs (docs/specs/011-theme/canvas-and-theme-dialog.md): `source`'s
 *  theme applied as picking it does under `source`'s Element Colours, then its canvas, text defaults, finish and
 *  Element Colours exactly (withTabStyleOf). */
export function withStyleOfTab(target: Tab, source: Tab): Tab {
  const options = source.keepElementColours ? { keepElementColours: true } : undefined;
  return withTabStyleOf(
    withThemeApplied(target, source.theme ?? 'brand', undefined, options),
    source,
  );
}

/** The options a theme or look pick on `tab` takes when its caller gives none: the tab's own Element Colours. */
export function themeApplyOptionsOf(tab: Tab): ThemeApplyOptions | undefined {
  return tab.keepElementColours ? { keepElementColours: true } : undefined;
}

/** `tab` with Element Colours set: Keep as They Are stored as true, Follow the Theme clearing the key. */
export function withKeepElementColours(tab: Tab, keep: boolean): Tab {
  if (keep) return { ...tab, keepElementColours: true };
  const next = { ...tab };
  delete next.keepElementColours;
  return next;
}
