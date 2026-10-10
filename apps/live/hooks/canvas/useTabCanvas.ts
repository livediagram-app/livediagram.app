// Tab-level appearance + layout actions, lifted out of
// editor-page.tsx: theme switching, the background controls (pattern /
// colour / opacity / pattern-colour), reset-elements-to-theme, and
// auto-align. They all mutate the *active tab* rather than a selected
// element. Structural one-shot edits (theme, pattern, reset) commit one
// undo step each, while the high-frequency slider edits (background
// colour / opacity / pattern colour) take one step per burst through
// `checkpointBurst` (see useBurstCheckpoint).

import {
  isBoxed,
  type BackgroundPattern,
  type Element,
  type Tab,
  type TextSize,
} from '@livediagram/document';
import { track, titleCaseType } from '@/lib/telemetry';
import { AUTO_LAYOUT_CHOICES, type AutoLayoutChoice } from '@/lib/auto-layout-choices';
import { cleanupElements } from '@/lib/tab-cleanup';
import { useTabTheme } from './useTabTheme';
import { useDebouncedCanvasTelemetry } from './useDebouncedCanvasTelemetry';

type TabCanvasDeps = {
  // True when edits are disallowed (read-only role / locked tab). Every
  // handler no-ops when set.
  editsBlocked: boolean;
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
  const { editsBlocked, activeId, activeTab, commit, commitTabs, tickTabs, checkpointBurst } = deps;

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

  const autoAlignTab = () => {
    if (editsBlocked) return;
    if (activeTab.elements.length === 0) return;
    // `commit` snapshots the pre-align state, so undo restores it.
    commit((els) => cleanupElements(els, 'align', activeTab.layers));
    track('Tab', 'Aligned');
  };

  // Auto Layout / "Tidy up" (docs/specs/008-canvas/layout-cleanup.md, GitHub #12): recompute element
  // positions from the arrow graph rather than merely grid-snapping current
  // positions like Auto-align. `choice` picks the layout style (docs/specs/008-canvas/layout-cleanup.md
  // "Layout styles"): the smart layered default, a forced-direction
  // flowchart, tree, or mindmap. Pins the laid-out block to the diagram's
  // current top-left so it stays where the user is looking instead of
  // jumping to the origin, and grid-snaps the result (the same final pass
  // the AI-apply path uses). One undoable op via `commit`.
  const autoLayoutTab = (choice: AutoLayoutChoice = 'smart') => {
    if (editsBlocked) return;
    if (activeTab.elements.length === 0) return;
    // Everything the layout needs, including the origin it pins to, is read
    // inside the updater from the elements it is given: a commit taken while a
    // hover preview is on screen (docs/specs/008-canvas/layout-cleanup.md) composes after the preview's revert,
    // so `current` is the true pre-hover state and undo returns there.
    commit((current) => cleanupElements(current, choice, activeTab.layers));
    track('Tab', 'Aligned', AUTO_LAYOUT_CHOICES[choice].telemetryType);
  };

  // Tab default font (docs/specs/004-interface-design/fonts.md): every text element without its own
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
    track('Tab', 'Changed', 'Font');
  };

  // "Apply to all elements" in the Font category (docs/specs/004-interface-design/fonts.md): push the tab's
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

  // Tab default text size (docs/specs/004-interface-design/fonts.md): seeded onto NEW palette elements.
  const setTabDefaultTextSize = (size: TextSize) => {
    if (editsBlocked) return;
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? { ...t, defaultTextSize: size } : t)));
    track('Tab', 'Changed', 'DefaultTextSize');
  };

  const setBackgroundPattern = (pattern: BackgroundPattern) => {
    if (editsBlocked) return;
    commitTabs((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, backgroundPattern: pattern } : t)),
    );
    // Telemetry (docs/specs/017-telemetry/telemetry.md): `type` is the pattern preset, never content.
    track('Canvas', 'Changed', titleCaseType(pattern));
  };

  // Theme switching + the two theme resets — see useTabTheme (mounted
  // here so the caller's return shape is unchanged).
  const { setTheme, resetTabsUsingTheme, resetElementsToTheme } = useTabTheme({
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
    setBackgroundAnimationSpeed,
  };
}
