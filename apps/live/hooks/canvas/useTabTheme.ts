// Theme actions for the active tab (docs/specs/011-theme/multicolour-themes.md + /42 + /44), lifted out of
// useTabCanvas into a sibling hook: applying a theme with the
// preserve-customs walk, the hard reset when a custom theme is deleted,
// and the "Reset elements to theme" button. useTabCanvas mounts this
// and folds the three handlers into its return, so callers are
// unchanged.

import { getTheme, resetThemeElementsToTheme } from '@/lib/themes';
import { withThemeApplied } from '@/lib/tab-theme-apply';
import { themeTelemetryLabel } from '@/lib/custom-theme-registry';
import type { Tab } from '@livediagram/document';
import { track } from '@/lib/telemetry';

// The default theme a tab reverts to when its custom theme is deleted —
// the first catalogue entry (brand), matching getTheme's own fallback.
const DEFAULT_THEME_ID = 'brand';

export function useTabTheme(deps: {
  editsBlocked: boolean;
  activeId: string;
  activeTab: Tab;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
}) {
  const { editsBlocked, activeId, activeTab, commitTabs } = deps;

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
  // Accepts a built-in ThemeId or a custom `custom:<uuid>` id (docs/specs/011-theme/custom-themes.md):
  // getTheme resolves both, so the preserve-customs switch works the same
  // for either. Widened to string for the custom case.
  const setTheme = (id: string) => {
    if (editsBlocked) return;
    // Telemetry (docs/specs/017-telemetry/telemetry.md): `type` must stay a preset, never user content,
    // so a custom theme reports the fixed 'Custom' rather than its name.
    track('Theme', 'Changed', themeTelemetryLabel(id));
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? withThemeApplied(t, id) : t)));
  };

  // Called when a custom theme (docs/specs/011-theme/custom-themes.md) is deleted: every tab in THIS
  // document still pointing at the now-dead `custom:<uuid>` id falls back
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
    track('Theme', 'Changed', 'ResetElements'); // discrete one-shot recolour to theme
    commitTabs((ts) =>
      ts.map((t) => {
        if (t.id !== activeId) return t;
        // Hard reset: blank user overrides too. See `resetThemeElement`
        // in lib/themes.ts for the rule. The graph-aware wrapper
        // re-rainbows the branches for a multi-colour theme (docs/specs/011-theme/multicolour-themes.md).
        const elements = resetThemeElementsToTheme(t.elements, theme);
        return { ...t, elements };
      }),
    );
  };

  return { setTheme, resetTabsUsingTheme, resetElementsToTheme };
}
