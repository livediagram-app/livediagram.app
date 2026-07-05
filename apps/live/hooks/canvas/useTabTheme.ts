// Theme actions for the active tab (spec/29 + /42 + /44), lifted out of
// useTabCanvas into a sibling hook: applying a theme with the
// preserve-customs walk, the hard reset when a custom theme is deleted,
// and the "Reset elements to theme" button. useTabCanvas mounts this
// and folds the three handlers into its return, so callers are
// unchanged.

import {
  getTheme,
  resetArrowsToTheme,
  resetThemeElementsToTheme,
  resolveTheme,
  switchThemeBackdrop,
  switchThemeElements,
  THEMES,
} from '@/lib/themes';
import { isCustomThemeId } from '@/lib/custom-theme-registry';
import type { Tab } from '@livediagram/diagram';
import { track } from '@/lib/telemetry';

// The default theme a tab reverts to when its custom theme is deleted —
// the first catalogue entry (brand), matching getTheme's own fallback.
const DEFAULT_THEME_ID = 'brand';

export function useTabTheme(deps: {
  editsBlocked: boolean;
  activeId: string;
  activeTab: Tab;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  emitTabMeta: (tabId: string, summary: string) => void;
}) {
  const { editsBlocked, activeId, activeTab, commitTabs, emitTabMeta } = deps;

  // Applying a theme swaps backdrop colours/pattern, records the theme
  // id (so future element-create calls in `addBoxed` inherit the theme),
  // AND retroactively recolours shape + text + arrow elements on the
  // tab to match — UNLESS the user has previously set a custom colour
  // on a specific field, in which case that field stays untouched.
  // Heuristic for "custom": the current value differs from what the
  // PREVIOUS theme would have set. Anything still equal to the
  // previous theme's value (or undefined) is treated as
  // theme-controlled and gets the new theme's value; anything else is
  // the user's choice and survives. Sticky notes are skipped entirely
  // — the amber palette is iconic.
  // Accepts a built-in ThemeId or a custom `custom:<uuid>` id (spec/44):
  // getTheme resolves both, so the preserve-customs switch works the same
  // for either. Widened to string for the custom case.
  const setTheme = (id: string) => {
    if (editsBlocked) return;
    const theme = getTheme(id);
    // theme.label is the built-in label or the custom theme's name.
    emitTabMeta(activeId, `Changed theme to ${theme.label}`);
    // Telemetry (spec/22): `type` must stay a preset, never user content,
    // so a custom theme reports the fixed 'Custom' rather than its name.
    track('Theme', 'Changed', isCustomThemeId(id) ? 'Custom' : theme.label);
    commitTabs((ts) =>
      ts.map((t) => {
        if (t.id !== activeId) return t;
        // When the tab's PREVIOUS theme can't be resolved (a custom theme
        // that was deleted, spec/44), there's no baseline to diff against:
        // the elements carry the dead theme's colours, which match neither
        // the default nor the new theme, so the preserve-customs walk would
        // treat them all as user overrides and recolour nothing — the tab
        // reads as "stuck on the deleted theme". Hard-reset to the new
        // theme instead so picking a theme always visibly applies.
        //
        // A tab whose theme was simply NEVER SET (a fresh diagram, an
        // added tab, the Blank template) is NOT that case: its baseline
        // is the default theme, and the preserve-customs walk against it
        // works — hard-resetting here wiped a user's hand-picked colours
        // on their FIRST theme pick. Only a named theme that fails to
        // resolve takes the hard-reset branch.
        const prevTheme = t.theme === undefined ? getTheme(undefined) : resolveTheme(t.theme);
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
        // either side is a multi-colour theme (spec/29).
        // Arrows are the exception to preserve-customs: they ALWAYS snap
        // to the new theme's stroke (resetArrowsToTheme), so a theme pick
        // re-tints every connector instead of leaving hand-coloured ones
        // on the old hue. Shapes / text keep their customisations.
        const elements = resetArrowsToTheme(
          switchThemeElements(t.elements, prevTheme, theme),
          theme,
        );
        // Backdrop follows the same preserve-customs rule as the
        // elements: a deliberately-chosen pattern / colour survives a
        // theme change instead of being reset to the theme's backdrop.
        const backdrop = switchThemeBackdrop(t, prevTheme, theme);
        return {
          ...t,
          elements,
          theme: id,
          ...backdrop,
        };
      }),
    );
  };

  // Called when a custom theme (spec/44) is deleted: every tab in THIS
  // diagram still pointing at the now-dead `custom:<uuid>` id falls back
  // to the default theme — backdrop AND element colours — so the deletion
  // is visible immediately instead of stranding the old colours on a dead
  // id. A hard reset (not preserve-customs): the deleted theme is gone, so
  // there's no baseline left to tell user overrides from theme colours.
  const resetTabsUsingTheme = (deletedId: string) => {
    const fallback = getTheme(DEFAULT_THEME_ID);
    commitTabs((ts) =>
      ts.map((t) =>
        t.theme === deletedId
          ? {
              ...t,
              theme: DEFAULT_THEME_ID,
              elements: resetThemeElementsToTheme(t.elements, fallback),
              backgroundColor: fallback.backgroundColor,
              backgroundPattern: fallback.backgroundPattern,
              patternColor: fallback.patternColor,
              backgroundOpacity: fallback.backgroundOpacity,
            }
          : t,
      ),
    );
  };

  // Force-apply the current theme's element colours to every shape /
  // text / arrow on the tab, OVERWRITING whatever's currently set —
  // even custom per-element colours. The standalone counterpart to
  // setTheme's preserve-customs behaviour; surfaces as a "Reset
  // elements to theme" button under the Theme accordion.
  const resetElementsToTheme = () => {
    if (editsBlocked) return;
    const theme = getTheme(activeTab.theme);
    const themeId = activeTab.theme ?? 'brand';
    const themeLabel =
      THEMES.find((t) => t.id === themeId)?.label ??
      themeId.charAt(0).toUpperCase() + themeId.slice(1);
    track('Theme', 'Changed', 'ResetElements'); // discrete one-shot recolour to theme
    emitTabMeta(activeId, `Reset element colours to the ${themeLabel} theme`);
    commitTabs((ts) =>
      ts.map((t) => {
        if (t.id !== activeId) return t;
        // Hard reset: blank user overrides too. See `resetThemeElement`
        // in lib/themes.ts for the rule. The graph-aware wrapper
        // re-rainbows the branches for a multi-colour theme (spec/29).
        const elements = resetThemeElementsToTheme(t.elements, theme);
        return { ...t, elements };
      }),
    );
  };

  return { setTheme, resetTabsUsingTheme, resetElementsToTheme };
}
