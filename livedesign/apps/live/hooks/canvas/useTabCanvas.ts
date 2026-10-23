// Tab-level appearance + layout actions, lifted out of
// editor-page.tsx: theme switching, the background controls (pattern /
// colour / opacity / pattern-colour), reset-elements-to-theme, and
// auto-align. They all mutate the *active tab* rather than a selected
// element. Structural one-shot edits (theme, pattern, reset) commit one
// undo step each, while the high-frequency slider edits (background
// colour / opacity / pattern colour) take one step per burst through
// `checkpointBurst` (see useBurstCheckpoint).

import {
  type BackgroundPattern,
  type Finish,
  type Element,
  type Tab,
  type TextSize,
} from '@livedesign/design';
import { track, titleCaseType } from '@/lib/telemetry';
import { AUTO_LAYOUT_CHOICES, type AutoLayoutChoice } from '@/lib/auto-layout-choices';
import type { CleanupKind } from '@/lib/tab-cleanup';
import { withTidyEngine, type TidyEngine } from '@/lib/tidy-engine';
import { useTabTheme } from './useTabTheme';
import { tabLookById, withLookApplied, type TabLook } from '@/lib/tab-looks';
import {
  withTabFinish,
  withTabFont,
  withTabPattern,
  withTabTextSize,
} from '@/lib/tab-style-transforms';
import { useDebouncedCanvasTelemetry } from './useDebouncedCanvasTelemetry';

type TabCanvasDeps = {
  // True when edits are disallowed (read-only role / locked tab). Every
  // handler no-ops when set.
  editsBlocked: boolean;
  // Shows a short notice (a toast): a tidier refused because it would change nothing or damage
  // the drawing says so rather than doing nothing silently.
  notify?: (message: string) => void;
  activeId: string;
  activeTab: Tab;
  // History-aware element mutator. Used by auto-align and auto-layout.
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  // History-pushing tab mutator, for the DISCRETE tab-meta edits (theme
  // / font / pattern picks); each is one undoable step.
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  // Non-history tab mutator + per-burst checkpoint, for the CONTINUOUS
  // slider setters: a commit per onChange tick flooded the bounded undo
  // stack in a single drag, so a gesture checkpoints once (when its
  // burst opens, see useBurstCheckpoint) and ticks thereafter.
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  checkpointBurst: (key: string) => void;
};

export function useTabCanvas(deps: TabCanvasDeps) {
  const {
    editsBlocked,
    activeId,
    activeTab,
    commit,
    commitTabs,
    tickTabs,
    checkpointBurst,
    notify,
  } = deps;

  // Shared body of the slider setters: one undoable step per gesture
  // (checkpoint when its burst opens), then history-less ticks for the
  // rest of the drag.
  const patchActiveTabDebounced = (key: string, patch: (t: Tab) => Tab) => {
    checkpointBurst(key);
    tickTabs((ts) => ts.map((t) => (t.id === activeId ? patch(t) : t)));
  };

  // Debounced Canvas·Changed emits for the slider setters, flushed on
  // unmount / page hide so the last drag isn't lost (docs/specs/017-telemetry/telemetry.md).
  const scheduleCanvasTelemetry = useDebouncedCanvasTelemetry();

  // A tidier that would change nothing or damage the drawing is refused with a notice
  // (docs/specs/008-canvas/layout-cleanup.md "A tidy never trashes the work"). The Tidy Up popover
  // judges first and greys such a tidier out, so its presses arrive `judged`; the command palette's
  // are judged here, on the live tab (no preview is on screen there). The tidiers load on demand
  // (lib/tidy-engine.ts): already there after the popover opens, fetched at the press otherwise.
  const refused = (engine: TidyEngine, kind: CleanupKind, judged: boolean | undefined): boolean => {
    if (judged) return false;
    const verdict = engine.assessCleanup(activeTab.elements, kind, activeTab.layers);
    const name = kind === 'align' ? 'Auto-align' : AUTO_LAYOUT_CHOICES[kind].tileName;
    const notice = engine.verdictNotice(name, verdict);
    if (notice) notify?.(notice);
    return notice !== null;
  };

  const autoAlignTab = (opts: { judged?: boolean } = {}) => {
    if (editsBlocked) return;
    if (activeTab.elements.length === 0) return;
    withTidyEngine((engine) => {
      if (refused(engine, 'align', opts.judged)) return;
      // `commit` snapshots the pre-align state, so undo restores it.
      commit((els) => engine.cleanupElements(els, 'align', activeTab.layers));
      track('Tab', 'Aligned');
    });
  };

  // Auto Layout / "Tidy up" (docs/specs/008-canvas/layout-cleanup.md, GitHub #12): recompute element
  // positions from the arrow graph rather than merely grid-snapping current
  // positions like Auto-align. `choice` picks the layout style (docs/specs/008-canvas/layout-cleanup.md
  // "Layout styles"): the smart layered default, a forced-direction
  // flowchart, tree, or mindmap. The tidy profile lands the laid-out block
  // where the shapes were, clear of what it does not move, with centres on the
  // grid. One undoable op via `commit`.
  const autoLayoutTab = (choice: AutoLayoutChoice = 'smart', opts: { judged?: boolean } = {}) => {
    if (editsBlocked) return;
    if (activeTab.elements.length === 0) return;
    withTidyEngine((engine) => {
      if (refused(engine, choice, opts.judged)) return;
      // Everything the layout needs, including the origin it pins to, is read
      // inside the updater from the elements it is given: a commit taken while a
      // hover preview is on screen (docs/specs/008-canvas/layout-cleanup.md) composes after the preview's revert,
      // so `current` is the true pre-hover state and undo returns there.
      commit((current) => engine.cleanupElements(current, choice, activeTab.layers));
      track('Tab', 'Aligned', AUTO_LAYOUT_CHOICES[choice].telemetryType);
    });
  };

  // Tab default font (docs/specs/004-interface-design/fonts.md): every text element without its own
  // `font` renders in this. null clears it back to the editor default.
  const setTabFont = (font: string | null) => {
    if (editsBlocked) return;
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? withTabFont(t, font) : t)));
    track('Tab', 'Changed', 'Font');
  };

  // The tab's finish (docs/specs/008-canvas/finish.md): how every element without its own is drawn. Flexible
  // is stored when picked, like any other value; one undo step.
  const setTabFinish = (finish: Finish) => {
    if (editsBlocked) return;
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? withTabFinish(t, finish) : t)));
    track('Tab', 'Changed', 'Finish');
  };

  // A look (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): the tab's theme, finish, font and pattern at
  // once, as one undo step. The theme lands exactly as picking it does (withThemeApplied).
  // A named look comes by id; the Mashup card's random look (lib/look-mashup.ts) comes whole.
  const applyTabLook = (lookOrId: string | TabLook) => {
    if (editsBlocked) return;
    const look = typeof lookOrId === 'string' ? tabLookById(lookOrId) : lookOrId;
    if (!look) return;
    track(
      'Tab',
      'Changed',
      look.id === 'mashup' ? 'Mashup' : look.season ? 'SeasonalLook' : 'Look',
    );
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? withLookApplied(t, look) : t)));
  };

  // Tab default text size (docs/specs/004-interface-design/fonts.md): seeded onto NEW palette elements.
  const setTabDefaultTextSize = (size: TextSize) => {
    if (editsBlocked) return;
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? withTabTextSize(t, size) : t)));
    track('Tab', 'Changed', 'DefaultTextSize');
  };

  const setBackgroundPattern = (pattern: BackgroundPattern) => {
    if (editsBlocked) return;
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? withTabPattern(t, pattern) : t)));
    // Telemetry (docs/specs/017-telemetry/telemetry.md): `type` is the pattern preset, never content.
    track('Canvas', 'Changed', titleCaseType(pattern));
  };

  // Theme switching + the two theme resets — see useTabTheme (mounted
  // here so the caller's return shape is unchanged).
  const { setTheme, resetTabsUsingTheme } = useTabTheme({
    editsBlocked,
    activeId,
    activeTab,
    commitTabs,
  });

  const setBackgroundColor = (color: string) => {
    if (editsBlocked) return;
    patchActiveTabDebounced('backgroundColor', (t) => ({
      ...t,
      backgroundColor: color,
    }));
    scheduleCanvasTelemetry('backgroundColor', 'BackgroundColor');
  };

  const setBackgroundOpacity = (opacity: number) => {
    if (editsBlocked) return;
    patchActiveTabDebounced('backgroundOpacity', (t) => ({ ...t, backgroundOpacity: opacity }));
    scheduleCanvasTelemetry('backgroundOpacity', 'BackgroundOpacity');
  };

  const setPatternColor = (color: string) => {
    if (editsBlocked) return;
    patchActiveTabDebounced('patternColor', (t) => ({
      ...t,
      patternColor: color,
    }));
    scheduleCanvasTelemetry('patternColor', 'PatternColor');
  };

  const setBackgroundPatternScale = (scale: number) => {
    if (editsBlocked) return;
    patchActiveTabDebounced('backgroundPatternScale', (t) => ({
      ...t,
      backgroundPatternScale: scale,
    }));
    scheduleCanvasTelemetry('backgroundPatternScale', 'BackgroundPatternScale');
  };

  // Motion rate for an animated background pattern (docs/specs/008-canvas/canvas-and-palette.md): 1 = the
  // pattern's own tuned pace, 2 = twice as fast. Only offered while an
  // animated pattern is active (the Speed slider is gated in
  // CanvasStyleControls); a static pattern simply ignores the field.
  const setBackgroundAnimationSpeed = (speed: number) => {
    if (editsBlocked) return;
    patchActiveTabDebounced('backgroundAnimationSpeed', (t) => ({
      ...t,
      backgroundAnimationSpeed: speed,
    }));
    scheduleCanvasTelemetry('backgroundAnimationSpeed', 'BackgroundAnimationSpeed');
  };

  return {
    autoAlignTab,
    autoLayoutTab,
    setTabFont,
    setTabDefaultTextSize,
    setTabFinish,
    applyTabLook,
    setBackgroundPattern,
    setTheme,
    resetTabsUsingTheme,
    setBackgroundColor,
    setBackgroundOpacity,
    setPatternColor,
    setBackgroundPatternScale,
    setBackgroundAnimationSpeed,
  };
}
