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
  autoLayoutElements,
  isBoxed,
  type BackgroundPattern,
  type Element,
  type Tab,
  type TextSize,
} from '@livediagram/diagram';
import { track, titleCaseType } from '@/lib/telemetry';
import { AUTO_LAYOUT_CHOICES, type AutoLayoutChoice } from '@/lib/auto-layout-choices';
import { FONTS } from '@/lib/fonts';
import { PATTERNS } from '@/components/palette/palette-controls';
import { useTabTheme } from './useTabTheme';

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
  // debounce window opens) and ticks thereafter. The checkpoint returns
  // its undo-marker token so the debounced log entry can fill the
  // gesture's OWN step (see lib/entry-history).
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  markCheckpoint: () => number;
  // Immediate activity-log entry for one-shot tab-meta edits.
  emitTabMeta: (tabId: string, summary: string) => void;
  // Debounced activity-log entry for the slider-driven appearance
  // edits, keyed so rapid changes collapse to one line. Runs
  // `onWindowStart` once per fresh window (gesture start) and fills
  // the marker of the token it returns.
  scheduleTabMetaLog: (key: string, summary: string, onWindowStart?: () => number) => void;
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
  // gesture (checkpoint when the log's debounce window opens, its
  // token handed to the debouncer so the flushed entry fills THIS
  // gesture's marker), then history-less ticks for the rest of the
  // drag.
  const patchActiveTabDebounced = (key: string, summary: string, patch: (t: Tab) => Tab) => {
    scheduleTabMetaLog(key, summary, markCheckpoint);
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
  // positions from the arrow graph rather than merely grid-snapping current
  // positions like Auto-align. `choice` picks the layout style (spec/47
  // "Layout styles"): the smart layered default, a forced-direction
  // flowchart, tree, or mindmap. Pins the laid-out block to the diagram's
  // current top-left so it stays where the user is looking instead of
  // jumping to the origin, and grid-snaps the result (the same final pass
  // the AI-apply path uses). One undoable op via `commit`.
  const autoLayoutTab = (choice: AutoLayoutChoice = 'smart') => {
    if (editsBlocked) return;
    const els = activeTab.elements;
    if (els.length === 0) return;
    const boxed = els.filter(isBoxed);
    if (boxed.length === 0) return;
    const originX = Math.min(...boxed.map((b) => b.x));
    const originY = Math.min(...boxed.map((b) => b.y));
    const { options, telemetryType } = AUTO_LAYOUT_CHOICES[choice];
    commit((current) =>
      autoAlignElements(autoLayoutElements(current, { ...options, originX, originY })),
    );
    track('Tab', 'Aligned', telemetryType);
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
    // Name the font in the entry ("Changed tab font to Poppins") — a
    // bare "Changed tab font" tells the reader nothing they can act on.
    const fontLabel = font ? (FONTS.find((f) => f.id === font)?.label ?? font) : null;
    emitTabMeta(
      activeId,
      fontLabel ? `Changed the tab font to ${fontLabel}` : 'Reset the tab font to the default',
    );
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

  // Theme switching + the two theme resets — see useTabTheme (mounted
  // here so the caller's return shape is unchanged).
  const { setTheme, resetTabsUsingTheme, resetElementsToTheme } = useTabTheme({
    editsBlocked,
    activeId,
    activeTab,
    commitTabs,
    emitTabMeta,
  });

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
