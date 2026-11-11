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
} from '@livehuddle/document';
import { track, titleCaseType } from '@/lib/telemetry';
import { withTidyEngine, type TidyEngine } from '@/lib/tidy-engine';
import { useTabTheme } from './useTabTheme';
import { tabLookById, withLookApplied, type TabLook } from '@/lib/tab-looks';
import {
  withTabFinish,
  withTabFont,
  withTabPattern,
  withTabTextSize,
} from '@/lib/tab-style-transforms';
import { useDebouncedCanvasTelemetry } from '@liveworkspace/workbench/hooks/canvas/useDebouncedCanvasTelemetry';

type TabCanvasDeps = {
  // True when edits are disallowed (read-only role / a tab still loading). Every
  // handler no-ops when set.
  editsBlocked: boolean;
  // Shows a short notice (a toast): a tidier refused because it would change nothing or damage
  // the drawing says so rather than doing nothing silently.
  notify?: (message: string) => void;
  activeId: string;
  activeTab: Tab;
  // History-aware element mutator. Used by auto-align.
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

  // An Auto-align that would change nothing or damage the drawing is refused with a notice
  // (docs/specs/008-canvas/layout-cleanup.md "A tidy never trashes the work"), judged here on the live tab. The
  // tidier loads on demand (lib/tidy-engine.ts), fetched at the press.
  const refused = (engine: TidyEngine): boolean => {
    const verdict = engine.assessCleanup(activeTab.elements);
    const notice = engine.verdictNotice('Auto-align', verdict);
    if (notice) notify?.(notice);
    return notice !== null;
  };

  const autoAlignTab = () => {
    if (editsBlocked) return;
    if (activeTab.elements.length === 0) return;
    withTidyEngine((engine) => {
      if (refused(engine)) return;
      // `commit` snapshots the pre-align state, so undo restores it.
      commit((els) => engine.cleanupElements(els));
      track('Tab', 'Aligned');
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

  // Theme switching — see useTabTheme (mounted here so the caller's
  // return shape is unchanged).
  const { setTheme } = useTabTheme({
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

  return {
    autoAlignTab,
    setTabFont,
    setTabDefaultTextSize,
    setTabFinish,
    applyTabLook,
    setBackgroundPattern,
    setTheme,
    setBackgroundColor,
    setBackgroundOpacity,
    setPatternColor,
    setBackgroundPatternScale,
  };
}
