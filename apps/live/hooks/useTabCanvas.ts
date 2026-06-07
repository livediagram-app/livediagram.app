// Tab-level appearance + layout actions, lifted out of
// editor-page.tsx: theme switching, the background controls (pattern /
// colour / opacity / pattern-colour), reset-elements-to-theme, and
// auto-align. They all mutate the *active tab* rather than a selected
// element, and share the same activity-log policy: structural one-shot
// edits (theme, pattern, reset) emit immediately via `emitTabMeta`,
// while the high-frequency slider edits (background colour / opacity /
// pattern colour) debounce through `scheduleTabMetaLog`.
//
// `scheduleTabMetaLog` is passed in rather than created here because
// the same debounce hook also feeds `scheduleElementChangeLog` to
// useElementStyle — one debounce instance, two consumers.

import { useRef } from 'react';
import { autoAlignElements } from '@/lib/auto-align';
import {
  getTheme,
  resetThemeElement,
  switchThemeBackdrop,
  switchThemeElement,
  THEMES,
  type ThemeId,
} from '@/lib/themes';
import { type BackgroundPattern, type Element, type Tab } from '@livediagram/diagram';
import { track, titleCaseType } from '@/lib/telemetry';

// Slider-edit debounce window for the canvas colour / opacity
// telemetry. Spec/22's noise rule excludes "raw colour tweaks", and
// emitting on every slider tick would absolutely qualify; debouncing
// at ~800ms means one user dragging a slider end-to-end produces one
// event instead of dozens, while still capturing "did they actually
// change the canvas appearance" as a discrete signal. Matches the
// activity-log debounce in spirit (`scheduleTabMetaLog`).
const CANVAS_TELEMETRY_DEBOUNCE_MS = 800;

type TabCanvasDeps = {
  // True when edits are disallowed (read-only role / locked tab). Every
  // handler no-ops when set.
  editsBlocked: boolean;
  activeId: string;
  activeTab: Tab;
  // History-aware element mutator (snapshots + emits the log). Used by
  // auto-align, whose before/after diff IS the log entry.
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  // Tab mutator that does NOT push history — the appearance setters
  // pair it with an explicit activity-log emit instead.
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  // Immediate activity-log entry for one-shot tab-meta edits.
  emitTabMeta: (tabId: string, summary: string) => void;
  // Debounced activity-log entry for the slider-driven appearance
  // edits, keyed so rapid changes collapse to one line.
  scheduleTabMetaLog: (key: string, summary: string) => void;
};

export function useTabCanvas(deps: TabCanvasDeps) {
  const { editsBlocked, activeId, activeTab, commit, commitTabs, emitTabMeta, scheduleTabMetaLog } =
    deps;

  // Per-setter debounce timers for the canvas colour / opacity
  // telemetry emits. Keyed by setter name so a colour drag and an
  // opacity drag debounce independently and one doesn't cancel the
  // other. Refs (not state) because changing them mustn't re-render.
  const telemetryTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const scheduleCanvasTelemetry = (key: string, type: string) => {
    const timers = telemetryTimersRef.current;
    const existing = timers.get(key);
    if (existing !== undefined) clearTimeout(existing);
    const id = setTimeout(() => {
      timers.delete(key);
      track('Canvas', 'Changed', type);
    }, CANVAS_TELEMETRY_DEBOUNCE_MS);
    timers.set(key, id);
  };

  const autoAlignTab = () => {
    if (editsBlocked) return;
    if (activeTab.elements.length === 0) return;
    // `commit` snapshots the pre-align state (so undo restores it)
    // AND fires emitChange for the activity log. Adding emitTabMeta
    // on top would duplicate the entry without adding undo coverage;
    // the diff-based summary from emitChange is the canonical line.
    commit((els) => autoAlignElements(els));
    track('Tab', 'Aligned');
  };

  const setBackgroundPattern = (pattern: BackgroundPattern) => {
    if (editsBlocked) return;
    commitTabs((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, backgroundPattern: pattern } : t)),
    );
    emitTabMeta(activeId, `Changed canvas pattern to ${pattern}`);
    // Telemetry (spec/22): `type` is the pattern preset, never content.
    track('Canvas', 'Changed', titleCaseType(pattern));
  };

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
  const setTheme = (id: ThemeId) => {
    if (editsBlocked) return;
    const theme = getTheme(id);
    const themeLabel =
      THEMES.find((t) => t.id === id)?.label ?? id.charAt(0).toUpperCase() + id.slice(1);
    emitTabMeta(activeId, `Changed theme to ${themeLabel}`);
    // Telemetry (spec/22): `type` is the theme label, a preset.
    track('Theme', 'Changed', themeLabel);
    commitTabs((ts) =>
      ts.map((t) => {
        if (t.id !== activeId) return t;
        const prevTheme = getTheme(t.theme);
        // Per-field, preserve-customs walk. See `switchThemeElement`
        // in lib/themes.ts for the rule (a field is replaced when
        // it's unset or still matches the previous theme's value,
        // and kept when the user has set it to something else).
        const elements = t.elements.map((el) => switchThemeElement(el, prevTheme, theme));
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

  // Force-apply the current theme's element colours to every shape /
  // text / arrow on the tab, OVERWRITING whatever's currently set —
  // even custom per-element colours. The standalone counterpart to
  // setTheme's preserve-customs behaviour; surfaces as a "Reset
  // elements to theme" button under the Theme accordion.
  const resetElementsToTheme = () => {
    if (editsBlocked) return;
    const theme = getTheme(activeTab.theme);
    const themeLabel = THEMES.find((t) => t.id === activeTab.theme)?.label ?? 'theme';
    emitTabMeta(activeId, `Reset elements to ${themeLabel}`);
    commitTabs((ts) =>
      ts.map((t) => {
        if (t.id !== activeId) return t;
        // Hard reset: blank user overrides too. See `resetThemeElement`
        // in lib/themes.ts for the rule.
        const elements = t.elements.map((el) => resetThemeElement(el, theme));
        return { ...t, elements };
      }),
    );
  };

  const setBackgroundColor = (color: string) => {
    if (editsBlocked) return;
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? { ...t, backgroundColor: color } : t)));
    scheduleTabMetaLog('backgroundColor', `Changed canvas colour to ${color}`);
    scheduleCanvasTelemetry('backgroundColor', 'BackgroundColor');
  };

  const setBackgroundOpacity = (opacity: number) => {
    if (editsBlocked) return;
    commitTabs((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, backgroundOpacity: opacity } : t)),
    );
    scheduleTabMetaLog('backgroundOpacity', `Changed opacity to ${Math.round(opacity * 100)}%`);
    scheduleCanvasTelemetry('backgroundOpacity', 'BackgroundOpacity');
  };

  const setPatternColor = (color: string) => {
    if (editsBlocked) return;
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? { ...t, patternColor: color } : t)));
    scheduleTabMetaLog('patternColor', `Changed pattern colour to ${color}`);
    scheduleCanvasTelemetry('patternColor', 'PatternColor');
  };

  return {
    autoAlignTab,
    setBackgroundPattern,
    setTheme,
    resetElementsToTheme,
    setBackgroundColor,
    setBackgroundOpacity,
    setPatternColor,
  };
}
