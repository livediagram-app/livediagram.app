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
  resetArrowsToTheme,
  resetThemeElementsToTheme,
  resolveTheme,
  switchThemeBackdrop,
  switchThemeElements,
  THEMES,
} from '@/lib/themes';
import { isCustomThemeId } from '@/lib/custom-theme-registry';
import {
  autoLayoutElements,
  isBoxed,
  type BackgroundPattern,
  type Element,
  type Tab,
  type TextSize,
} from '@livediagram/diagram';
import { track, titleCaseType } from '@/lib/telemetry';
import { PATTERNS } from '@/components/palette/palette-controls';

// Human-readable names for the activity log, so an entry reads
// "Changed default text size to Medium" rather than leaking the raw
// internal code ("md"). These mirror the labels shown on the controls
// themselves (TabSection tooltips for sizes, `PATTERNS` for patterns).
const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  scale: 'Scale to fit',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
};
// Pattern display name from the single source of truth (`PATTERNS`),
// falling back to the raw id only if a new pattern lands without a
// label entry.
const patternLabel = (pattern: BackgroundPattern): string =>
  PATTERNS.find((p) => p.id === pattern)?.label ?? pattern;

// Slider-edit debounce window for the canvas colour / opacity
// telemetry. Spec/22's noise rule excludes "raw colour tweaks", and
// emitting on every slider tick would absolutely qualify; debouncing
// at ~800ms means one user dragging a slider end-to-end produces one
// event instead of dozens, while still capturing "did they actually
// change the canvas appearance" as a discrete signal. Matches the
// activity-log debounce in spirit (`scheduleTabMetaLog`).
const CANVAS_TELEMETRY_DEBOUNCE_MS = 800;

// The default theme a tab reverts to when its custom theme is deleted —
// the first catalogue entry (brand), matching getTheme's own fallback.
const DEFAULT_THEME_ID = 'brand';

type TabCanvasDeps = {
  // True when edits are disallowed (read-only role / locked tab). Every
  // handler no-ops when set.
  editsBlocked: boolean;
  activeId: string;
  activeTab: Tab;
  // History-aware element mutator (snapshots + emits the log). Used by
  // auto-align, whose before/after diff IS the log entry.
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  // History-pushing tab mutator, for the DISCRETE tab-meta edits (theme
  // / font / pattern picks) — each is one undoable step, paired with an
  // explicit activity-log emit.
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  // Non-history tab mutator + one-shot checkpoint, for the CONTINUOUS
  // slider setters: a commit per onChange tick flooded the bounded undo
  // stack in a single drag, so a gesture checkpoints once (when its
  // debounce window opens) and ticks thereafter.
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  markCheckpoint: () => void;
  // Immediate activity-log entry for one-shot tab-meta edits.
  emitTabMeta: (tabId: string, summary: string) => void;
  // Debounced activity-log entry for the slider-driven appearance
  // edits, keyed so rapid changes collapse to one line. Returns true
  // when the call opened a fresh debounce window (gesture start).
  scheduleTabMetaLog: (key: string, summary: string) => boolean;
};

export function useTabCanvas(deps: TabCanvasDeps) {
  const {
    editsBlocked,
    activeId,
    activeTab,
    commit,
    commitTabs,
    tickTabs,
    markCheckpoint,
    emitTabMeta,
    scheduleTabMetaLog,
  } = deps;

  // Shared body of the four slider setters: one undoable step per
  // gesture (checkpoint when the log's debounce window opens), then
  // history-less ticks for the rest of the drag.
  const patchActiveTabDebounced = (key: string, summary: string, patch: (t: Tab) => Tab) => {
    const startedWindow = scheduleTabMetaLog(key, summary);
    if (startedWindow) markCheckpoint();
    tickTabs((ts) => ts.map((t) => (t.id === activeId ? patch(t) : t)));
  };

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

  // Auto Layout / "Tidy up" (spec/47, GitHub #12): recompute element
  // positions from the arrow graph (layered / tree layout) rather than
  // merely grid-snapping current positions like Auto-align. Pins the laid-out
  // block to the diagram's current top-left so it stays where the user is
  // looking instead of jumping to the origin, and grid-snaps the result (the
  // same final pass the AI-apply path uses). One undoable op via `commit`.
  const autoLayoutTab = () => {
    if (editsBlocked) return;
    const els = activeTab.elements;
    if (els.length === 0) return;
    const boxed = els.filter(isBoxed);
    if (boxed.length === 0) return;
    const originX = Math.min(...boxed.map((b) => b.x));
    const originY = Math.min(...boxed.map((b) => b.y));
    commit((current) => autoAlignElements(autoLayoutElements(current, { originX, originY })));
    track('Tab', 'Aligned');
  };

  // Tab default font (spec/28): every text element without its own
  // `font` renders in this. null clears it back to the editor default.
  const setTabFont = (font: string | null) => {
    if (editsBlocked) return;
    commitTabs((ts) =>
      ts.map((t) => {
        if (t.id !== activeId) return t;
        if (!font) {
          const copy = { ...t };
          delete copy.font;
          return copy;
        }
        return { ...t, font };
      }),
    );
    emitTabMeta(activeId, font ? 'Changed tab font' : 'Cleared tab font');
    track('Tab', 'Changed', 'Font');
  };

  // "Apply to all elements" in the Font category (spec/28): push the tab's
  // font + default size onto every existing text-bearing element, so the whole
  // tab reads in one typeface/size. Clears each element's per-element `font`
  // override (elements with no font inherit the tab font at render) and sets
  // `textSize` to the tab default. One undoable op via `commit`. Per-run
  // rich-text bold/italic/colour is left intact; only the element-level font +
  // size are reset.
  const applyTabFontToAll = () => {
    if (editsBlocked) return;
    if (activeTab.elements.length === 0) return;
    const size: TextSize = activeTab.defaultTextSize ?? 'md';
    commit((els) =>
      els.map((el) => {
        if (!isBoxed(el) && el.type !== 'arrow') return el;
        const next = { ...el, textSize: size } as Element & { font?: string };
        delete next.font;
        return next;
      }),
    );
    track('Tab', 'Changed', 'Font');
  };

  // Tab default text size (spec/28): seeded onto NEW palette elements.
  const setTabDefaultTextSize = (size: TextSize) => {
    if (editsBlocked) return;
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? { ...t, defaultTextSize: size } : t)));
    emitTabMeta(activeId, `Changed default text size to ${TEXT_SIZE_LABELS[size]}`);
    track('Tab', 'Changed', 'DefaultTextSize');
  };

  const setBackgroundPattern = (pattern: BackgroundPattern) => {
    if (editsBlocked) return;
    commitTabs((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, backgroundPattern: pattern } : t)),
    );
    // 'blank' means no pattern at all, so name the effect rather than
    // saying "Changed canvas pattern to Blank".
    emitTabMeta(
      activeId,
      pattern === 'blank'
        ? 'Removed canvas pattern'
        : `Changed canvas pattern to ${patternLabel(pattern)}`,
    );
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
        const prevTheme = resolveTheme(t.theme);
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

  const setBackgroundColor = (color: string) => {
    if (editsBlocked) return;
    patchActiveTabDebounced('backgroundColor', `Changed canvas colour to ${color}`, (t) => ({
      ...t,
      backgroundColor: color,
    }));
    scheduleCanvasTelemetry('backgroundColor', 'BackgroundColor');
  };

  const setBackgroundOpacity = (opacity: number) => {
    if (editsBlocked) return;
    patchActiveTabDebounced(
      'backgroundOpacity',
      `Changed background opacity to ${Math.round(opacity * 100)}%`,
      (t) => ({ ...t, backgroundOpacity: opacity }),
    );
    scheduleCanvasTelemetry('backgroundOpacity', 'BackgroundOpacity');
  };

  const setPatternColor = (color: string) => {
    if (editsBlocked) return;
    patchActiveTabDebounced('patternColor', `Changed pattern colour to ${color}`, (t) => ({
      ...t,
      patternColor: color,
    }));
    scheduleCanvasTelemetry('patternColor', 'PatternColor');
  };

  const setBackgroundPatternScale = (scale: number) => {
    if (editsBlocked) return;
    patchActiveTabDebounced(
      'backgroundPatternScale',
      `Changed pattern size to ${Math.round(scale * 100)}%`,
      (t) => ({ ...t, backgroundPatternScale: scale }),
    );
    scheduleCanvasTelemetry('backgroundPatternScale', 'BackgroundPatternScale');
  };

  return {
    autoAlignTab,
    autoLayoutTab,
    applyTabFontToAll,
    setTabFont,
    setTabDefaultTextSize,
    setBackgroundPattern,
    setTheme,
    resetTabsUsingTheme,
    resetElementsToTheme,
    setBackgroundColor,
    setBackgroundOpacity,
    setPatternColor,
    setBackgroundPatternScale,
  };
}
