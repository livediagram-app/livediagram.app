'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useCoarsePointer } from '@liveworkspace/workbench/hooks/ui/useCoarsePointer';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { TourShield } from '@liveworkspace/workbench/components/tour/TourShield';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';
import { computeViewportCenter } from '@liveworkspace/workbench/lib/viewport';
import { easeNextStyleChange } from '@liveworkspace/workbench/lib/tab-style-ease';
import { pauseTelemetry, resumeTelemetry, track, trackDuringPause } from '@/lib/telemetry';
import { replayStore, useReplayState } from '@/lib/replay/replay-store';
import type { Frame, Point, Waypoint } from '@/lib/replay/topic';
import { TOPICS } from '@/lib/replay/topics';
import type { TopicCard } from '@/lib/replay/curriculum';
import { tourStepTelemetryType } from './tour-steps';
import { ReplayOverlay, type ReplayCursor } from './ReplayOverlay';
import { openMenuPath, resolveTarget, syncOpen, typeInto } from './replay-dom';

// Watch It Built's player (docs/specs/007-editor/watch-it-built.md "The replay", "The player"): loaded when a topic is
// picked, it plays the topic (lib/replay/topics) on a clock from the moment it mounts, drawing the demo through the
// replay store, which ReplayScope shows to the canvas, the element menu and the Theme & canvas dialog only. Nothing it
// does reaches the document. It tells the host how it ended, and the host unmounts it.

type Clock = { index: number; ms: number; playing: boolean; finished: boolean };
const STOPPED: Clock = { index: 0, ms: 0, playing: false, finished: false };

export type ReplayEnd = 'completed' | 'skipped' | 'more';

// A press ripple's length; the cursor shows it pressed this long after it lands.
const PRESS_MS = 420;

// The OS setting or the editor's own Reduce Motion (the `reduce-motion` class on <html>, user-preferences.md). The
// player only ever runs in the browser (it loads with ssr: false).
const reducedMotion = () =>
  document.documentElement.classList.contains('reduce-motion') ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type ScreenMap = { zoom: number; cx: number; cy: number; sx: number; sy: number };

export function WatchItBuiltPlayer({
  card,
  hasMore,
  onEnded,
}: {
  card: TopicCard;
  // Whether the mode has another topic: More Topics shows once this one has played.
  hasMore: boolean;
  onEnded: (how: ReplayEnd) => void;
}) {
  const ctx = useEditorContext();
  const menuOpen = !!useReplayState().menu;
  const touch = useCoarsePointer();
  const topic = TOPICS[card.id]!;
  const chapters = topic.chapters;
  const [clock, setClock] = useState<Clock>(STOPPED);
  const [cursor, setCursor] = useState<ReplayCursor | null>(null);
  const [playerTop, setPlayerTop] = useState(false);
  const active = clock !== STOPPED;
  const layoutRef = useRef<unknown>(null);
  // Where Example was last drawn, and the move it is on: each move starts from where the cursor is, never from a
  // target looked up again (a palette that closed, a menu row an accordion pushed down), so it never jumps.
  const lastPointRef = useRef<Point | null>(null);
  const legRef = useRef<Leg | null>(null);
  const signatureRef = useRef('');
  // What of the real chrome the replay opened, so it can close it again.
  const openedRef = useRef(new Set<string>());
  const mode = ctx.editorMode.mode;
  const startedMode = useRef(mode);

  // Canvas to screen, from the view itself: the canvas scales about the view's centre, so a canvas point sits
  // (point - centre) * zoom from the middle of the canvas's box.
  const screenMap = (): ScreenMap | null => {
    const host = ctx.canvasMainRef.current?.getBoundingClientRect();
    if (!host) return null;
    const view = ctx.viewport.get();
    const centre = computeViewportCenter(host, view.offset);
    return {
      zoom: view.zoom,
      cx: centre.x,
      cy: centre.y,
      sx: host.left + host.width / 2,
      sy: host.top + host.height / 2,
    };
  };
  const toScreen = (p: Point): Point => {
    const m = screenMap();
    return m ? { x: m.sx + (p.x - m.cx) * m.zoom, y: m.sy + (p.y - m.cy) * m.zoom } : p;
  };
  const toCanvas = (p: Point): Point => {
    const m = screenMap();
    return m ? { x: m.cx + (p.x - m.sx) / m.zoom, y: m.cy + (p.y - m.sy) / m.zoom } : p;
  };

  // It starts as it mounts: the host already counted the pick and marked the topic taken.
  const begin = () => {
    const host = ctx.canvasMainRef.current?.getBoundingClientRect();
    const view = ctx.viewport.get();
    const centre = host ? computeViewportCenter(host, view.offset) : { x: 400, y: 300 };
    const size = host
      ? { width: host.width / view.zoom, height: host.height / view.zoom }
      : { width: 1200, height: 800 };
    layoutRef.current = topic.layout({ centre, size, tab: ctx.activeTab });
    pauseTelemetry();
    ctx.closeContextMenu();
    document.documentElement.setAttribute('data-replay', '');
    replayStore.set({
      active: true,
      elements: [],
      menu: null,
      tab: null,
      prefs: null,
      dock: null,
    });
    const reduced = reducedMotion();
    setClock({
      index: 0,
      ms: reduced ? chapters[0]!.ms - 1 : 0,
      playing: !reduced,
      finished: false,
    });
    trackDuringPause(() => track('UI', 'View', tourStepTelemetryType(chapters[0]!.id)));
  };
  const beginRef = useLatest(begin);

  // Everything it opened closed, the demo gone, the canvas back; telemetry runs again.
  const teardown = () => {
    syncOpen([], openedRef.current);
    replayStore.reset();
    document.documentElement.removeAttribute('data-replay');
    resumeTelemetry();
  };
  const teardownRef = useLatest(teardown);
  const end = useCallback(
    (how: ReplayEnd) => {
      teardownRef.current();
      track('UI', 'Ended', how === 'skipped' ? 'TourSkipped' : 'TourCompleted');
      setCursor(null);
      setClock(STOPPED);
      onEnded(how);
    },
    [onEnded, teardownRef],
  );
  const endRef = useLatest(end);

  // Leaving the mode, or the tab, ends it as skipped (watch-it-built.md "It ends").
  const tabId = ctx.activeTab.id;
  const startedOnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active) {
      startedOnRef.current = null;
      return;
    }
    startedOnRef.current ??= tabId;
    if (mode !== startedMode.current || startedOnRef.current !== tabId) endRef.current('skipped');
  }, [active, mode, tabId, endRef]);
  // It begins as it mounts, and leaving the page mid-run leaves nothing behind. One effect does both, so a remount
  // (React's StrictMode mounts, unmounts and mounts again in development) begins again after the teardown instead of
  // playing on with the demo, the fade and the freeze already gone.
  useEffect(() => {
    beginRef.current();
    return () => {
      if (replayStore.get().active) teardownRef.current();
    };
  }, [beginRef, teardownRef]);

  // The clock: one frame loop, only while playing.
  useEffect(() => {
    if (!clock.playing) return;
    let last = performance.now();
    let raf = requestAnimationFrame(function step(now) {
      const dt = now - last;
      last = now;
      setClock((c) => {
        if (!c.playing) return c;
        const ms = c.ms + dt;
        const chapter = chapters[c.index]!;
        if (ms < chapter.ms) return { ...c, ms };
        if (c.index + 1 < chapters.length) {
          trackDuringPause(() =>
            track('UI', 'View', tourStepTelemetryType(chapters[c.index + 1]!.id)),
          );
          return { ...c, index: c.index + 1, ms: 0 };
        }
        return { ...c, ms: chapter.ms, playing: false, finished: true };
      });
      raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [clock.playing, chapters]);

  // Each moment: what the topic learned from the screen, the demo into the replay store, the chrome to match,
  // Example to where it is heading.
  const frameStep = () => {
    if (!active || layoutRef.current === null) return;
    const probe = { find: (t: Waypoint['to']) => resolveTarget(t, toScreen), toCanvas };
    const learned = topic.measure?.(layoutRef.current, clock.index, clock.ms, probe);
    if (learned) layoutRef.current = learned;
    const frame = topic.frame(clock.index, clock.ms, layoutRef.current);
    applyFrame(frame, signatureRef);
    setPlayerTop(frame.player === 'top');
    syncOpen(frame.open ?? [], openedRef.current);
    if (frame.menu) openMenuPath(frame.menu.path);
    if (frame.typed) typeInto(frame.typed.selector, frame.typed.text);
    const point = cursorAt(
      topic.plan(clock.index, layoutRef.current),
      clock.index,
      clock.ms,
      legRef,
      lastPointRef.current,
      frame,
      toScreen,
    );
    lastPointRef.current = point;
    setCursor(point);
  };
  const frameStepRef = useLatest(frameStep);
  useEffect(() => frameStepRef.current(), [active, clock, frameStepRef]);

  // Space, the arrows and Escape (watch-it-built.md "The player").
  const seek = useCallback(
    (index: number) => {
      const i = Math.max(0, Math.min(chapters.length - 1, index));
      const reduced = reducedMotion();
      trackDuringPause(() => track('UI', 'View', tourStepTelemetryType(chapters[i]!.id)));
      setClock({
        index: i,
        ms: reduced ? chapters[i]!.ms - 1 : 0,
        playing: !reduced,
        finished: false,
      });
    },
    [chapters],
  );
  const clockRef = useLatest(clock);
  const toggle = useCallback(() => {
    if (reducedMotion()) {
      // On the last chapter the button reads Done and finishes, as Your Turn does.
      if (clockRef.current.index + 1 >= chapters.length) {
        end('completed');
        return;
      }
      setClock((c) => {
        trackDuringPause(() =>
          track('UI', 'View', tourStepTelemetryType(chapters[c.index + 1]!.id)),
        );
        return { ...c, index: c.index + 1, ms: chapters[c.index + 1]!.ms - 1 };
      });
      return;
    }
    setClock((c) =>
      c.finished
        ? { index: 0, ms: 0, playing: true, finished: false }
        : { ...c, playing: !c.playing },
    );
  }, [clockRef, end, chapters]);
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const handled =
        e.key === 'Escape'
          ? (endRef.current('skipped'), true)
          : e.key === ' '
            ? (toggle(), true)
            : e.key === 'ArrowRight'
              ? (seek(clockRef.current.index + 1), true)
              : e.key === 'ArrowLeft'
                ? (seek(clockRef.current.index - 1), true)
                : false;
      if (!handled) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [active, toggle, seek, endRef, clockRef]);

  if (!active) return null;
  const chapter = chapters[clock.index]!;
  return (
    <>
      <TourShield />
      <ReplayOverlay
        title={card.title}
        chapters={chapters}
        index={clock.index}
        ms={clock.ms}
        playing={clock.playing}
        finished={clock.finished}
        reduced={reducedMotion()}
        touch={touch}
        menuOpen={menuOpen}
        atTop={playerTop}
        say={touch ? chapter.sayTouch : chapter.say}
        cursor={cursor}
        canvasRef={ctx.canvasMainRef}
        onToggle={toggle}
        onChapter={seek}
        onYourTurn={() => end('completed')}
        onMore={hasMore ? () => end('more') : undefined}
      />
    </>
  );
}

// The demo, the look shown and the menu into the replay store, and the replay's selection, only when they changed.
function applyFrame(frame: Frame, signatureRef: { current: string }) {
  const signature = JSON.stringify([
    frame.elements,
    frame.menu?.on ?? null,
    frame.selectedId,
    frame.tab ?? null,
    frame.prefs ?? null,
    frame.dock ?? null,
  ]);
  if (signature === signatureRef.current) return;
  // A new look eases in, as a pick in the Tab Style dialog does.
  const prevTab = replayStore.get().tab;
  if (JSON.stringify(prevTab) !== JSON.stringify(frame.tab ?? null)) easeNextStyleChange();
  signatureRef.current = signature;
  const held = replayStore.get().menu;
  const menu = frame.menu
    ? held?.mode === 'element' && held.elementId === frame.menu.on
      ? held
      : menuBeside(frame.menu.on)
    : null;
  replayStore.set({
    elements: frame.elements,
    menu,
    tab: frame.tab ?? null,
    prefs: frame.prefs ?? null,
    dock: frame.dock ?? null,
  });
  replayStore.selection.setSelection({
    selectedId: frame.selectedId,
    multiSelectedIds: new Set(),
  });
}

// The element menu beside a demo element: to its right, and level with what is above it, so it ends above the player.
function menuBeside(id: string) {
  const r = document.querySelector(elementSelector(id))?.getBoundingClientRect();
  return {
    mode: 'element' as const,
    elementId: id,
    x: r ? r.right + 12 : window.innerWidth / 2,
    y: r ? Math.max(12, r.top - 120) : window.innerHeight / 4,
  };
}

// `start` is when the move began: a move that follows a hold (a carry, a pen stroke) starts from the release, not
// from its waypoint's time, or Example would leap to catch up.
type Leg = { key: string; from: Point; start: number };

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);

// Example between where it was when this move began and the waypoint it is heading to, arriving at that one's time.
// While the frame says it is holding something (a carried shape, a pen drawing) it is there, pressed.
function cursorAt(
  plan: readonly Waypoint[],
  index: number,
  ms: number,
  legRef: { current: Leg | null },
  last: Point | null,
  frame: Frame,
  toScreen: (p: Point) => Point,
): ReplayCursor {
  if (frame.hold) {
    const held = toScreen(frame.hold);
    legRef.current = { key: 'held', from: held, start: ms };
    return { ...held, pressing: false, holding: true };
  }
  const nextAt = plan.findIndex((w) => w.at > ms);
  const prev = nextAt === -1 ? plan[plan.length - 1] : plan[nextAt - 1];
  const next = nextAt === -1 ? null : plan[nextAt]!;
  const key = `${index}:${prev?.at ?? -1}`;
  if (legRef.current?.key !== key) {
    legRef.current = {
      key,
      from: last ?? (prev ? resolveTarget(prev.to, toScreen) : null) ?? fallbackPoint(),
      start: ms,
    };
  }
  const from = legRef.current.from;
  const pressing = !!prev?.press && ms - prev.at < PRESS_MS;
  if (!next) return { ...from, pressing };
  const to = resolveTarget(next.to, toScreen) ?? from;
  const leave = Math.max(prev ? prev.at + 180 : 0, legRef.current.start);
  const p = ms <= leave ? 0 : easeInOut(Math.min(1, (ms - leave) / Math.max(1, next.at - leave)));
  return { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p, pressing };
}

function fallbackPoint() {
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.6 };
}
