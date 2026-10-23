// Theme actions for the active tab (docs/specs/011-theme/multicolour-themes.md), lifted out of
// useTabCanvas into a sibling hook: applying a theme with the
// preserve-customs walk. useTabCanvas mounts this and folds the handler
// into its return, so callers are unchanged.

import { withThemeApplied } from '@/lib/tab-theme-apply';
import { themeTelemetryLabel } from '@/lib/theme-telemetry-label';
import type { Tab } from '@livedesign/design';
import { track } from '@/lib/telemetry';

export function useTabTheme(deps: {
  editsBlocked: boolean;
  activeId: string;
  activeTab: Tab;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
}) {
  const { editsBlocked, activeId, commitTabs } = deps;

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
  // Widened to string: a tab's stored id may name no built-in theme, which getTheme resolves to the default.
  const setTheme = (id: string) => {
    if (editsBlocked) return;
    // Telemetry (docs/specs/017-telemetry/telemetry.md): `type` must stay a preset, never user content.
    track('Theme', 'Changed', themeTelemetryLabel(id));
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? withThemeApplied(t, id) : t)));
  };

  return { setTheme };
}
