'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bestAnchorTowards,
  createShape,
  shapeColorPresets,
  type ArrowElement,
  type ShapeElement,
} from '@livediagram/document';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useCoarsePointer } from '@liveworkspace/workbench/hooks/ui/useCoarsePointer';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { TourShield } from '@liveworkspace/workbench/components/tour/TourShield';
import { clickTour, findTour } from '@liveworkspace/workbench/components/tour/tour-dom';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';
import { deriveNewBoxedColours, getTheme } from '@/lib/themes';
import { applyColorPresetToEl } from '@/lib/style-presets';
import { pauseTelemetry, resumeTelemetry, track, trackDuringPause } from '@/lib/telemetry';
import { computeViewportCenter } from '@liveworkspace/workbench/lib/viewport';
import { replayStore, useReplayState } from '@/lib/replay/replay-store';
import {
  ADD,
  CHAPTERS,
  DEMO_IDS,
  cursorPlan,
  demoAt,
  type CursorTarget,
  type DemoFrame,
  type ReplayLayout,
} from '@/lib/replay/watch-it-built-script';
import { tourStepTelemetryType } from './tour-steps';
import { ReplayOverlay, type ReplayCursor } from './ReplayOverlay';

// Watch It Built's player (docs/specs/007-editor/watch-it-built.md "The replay", "The player"): loaded on the press
// WatchItBuiltHost offers, it plays the script (watch-it-built-script.ts) on a clock from the moment it mounts, drawing
// the demo through the replay store, which ReplayScope shows to the canvas and the element menu only. Nothing it does
// reaches the document. It tells the host when it has ended, and the host unmounts it.

type Clock = { index: number; ms: number; playing: boolean; finished: boolean };
const STOPPED: Clock = { index: 0, ms: 0, playing: false, finished: false };

// The OS setting or the editor's own Reduce Motion (the `reduce-motion` class on <html>, user-preferences.md). The
// player only ever runs in the browser (it loads with ssr: false).
const reducedMotion = () =>
  document.documentElement.classList.contains('reduce-motion') ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function WatchItBuiltPlayer({ onEnded }: { onEnded: () => void }) {
  const ctx = useEditorContext();
  const menuOpen = !!useReplayState().menu;
  const touch = useCoarsePointer();
  const [clock, setClock] = useState<Clock>(STOPPED);
  const [cursor, setCursor] = useState<ReplayCursor | null>(null);
  const active = clock !== STOPPED;
  const layoutRef = useRef<ReplayLayout | null>(null);
  // Screen to canvas, measured from A where it waits unseen (the script's first frames).
  const mapRef = useRef<{ zoom: number; left: number; top: number } | null>(null);
  // Where Example was last drawn, and the move it is on: each move starts from where the cursor is, never from a
  // target looked up again (a palette that closed, a menu row an accordion pushed down), so it never jumps.
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const legRef = useRef<Leg | null>(null);
  const signatureRef = useRef('');
  const inDiagram = ctx.editorMode.mode === 'diagram';

  // The demo's two shapes and arrow, round the middle of the view, in the tab's colours.
  const buildLayout = (): ReplayLayout => {
    const host = ctx.canvasMainRef.current?.getBoundingClientRect();
    const { x: cx, y: cy } = host
      ? computeViewportCenter(host, ctx.viewport.get().offset)
      : { x: 400, y: 300 };
    const tab = ctx.activeTab;
    const shape = (
      id: string,
      label: string,
      width: number,
      height: number,
      y: number,
    ): ShapeElement => {
      const base = createShape('square', 0, 0);
      const colours = deriveNewBoxedColours(base, {
        backgroundColor: tab.backgroundColor,
        patternColor: tab.patternColor,
        theme: tab.theme,
      });
      return { ...base, ...colours, id, label, width, height, x: cx - width / 2, y };
    };
    // Far enough apart that B's selection toolbar sits clear of A, and high enough that the menu clears the player.
    const a = shape(DEMO_IDS.a, 'Order received', 200, 56, cy - 250);
    const b = shape(DEMO_IDS.b, '', 200, 64, cy - 50);
    const stroke = a.strokeColor ?? getTheme(tab.theme).elementStroke ?? undefined;
    const arrow: ArrowElement = {
      id: DEMO_IDS.arrow,
      type: 'arrow',
      from: {
        kind: 'pinned',
        elementId: a.id,
        anchor: bestAnchorTowards(a, { x: b.x + b.width / 2, y: b.y }),
      },
      to: {
        kind: 'pinned',
        elementId: b.id,
        anchor: bestAnchorTowards(b, { x: a.x + a.width / 2, y: a.y + a.height }),
      },
      ...(stroke ? { strokeColor: stroke } : {}),
    };
    // The Style chapter's pick: the menu's own Success preset, as a press on it would apply it.
    const success = shapeColorPresets(getTheme(tab.theme)).find((p) => p.id === 'success');
    const green = (success ? applyColorPresetToEl(b, success) : b) as ShapeElement;
    return { a, b, arrow, green, tile: null };
  };

  // It starts as it mounts: the host's press already counted the start and marked the tour taken.
  const begin = () => {
    layoutRef.current = buildLayout();
    pauseTelemetry();
    ctx.closeContextMenu();
    document.documentElement.setAttribute('data-replay', '');
    replayStore.set({ active: true, elements: [], menu: null });
    const reduced = reducedMotion();
    setClock({
      index: 0,
      ms: reduced ? CHAPTERS[0]!.ms - 1 : 0,
      playing: !reduced,
      finished: false,
    });
    trackDuringPause(() => track('UI', 'View', tourStepTelemetryType(CHAPTERS[0]!.id)));
  };
  const beginRef = useLatest(begin);
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    beginRef.current();
  }, [beginRef]);

  const end = useCallback(
    (how: 'completed' | 'skipped') => {
      if (findTour('palette-category-menu')) clickTour('palette-category');
      replayStore.reset();
      document.documentElement.removeAttribute('data-replay');
      resumeTelemetry();
      track('UI', 'Ended', how === 'completed' ? 'TourCompleted' : 'TourSkipped');
      setCursor(null);
      setClock(STOPPED);
      onEnded();
    },
    [onEnded],
  );
  const endRef = useLatest(end);

  // Leaving Diagram, or the tab, ends it as skipped (watch-it-built.md "It ends").
  const tabId = ctx.activeTab.id;
  const startedOnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active) {
      startedOnRef.current = null;
      return;
    }
    startedOnRef.current ??= tabId;
    if (!inDiagram || startedOnRef.current !== tabId) endRef.current('skipped');
  }, [active, inDiagram, tabId, endRef]);
  // Leaving the page mid-run leaves nothing behind.
  useEffect(
    () => () => {
      if (!replayStore.get().active) return;
      replayStore.reset();
      document.documentElement.removeAttribute('data-replay');
      resumeTelemetry();
    },
    [],
  );

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
        const chapter = CHAPTERS[c.index]!;
        if (ms < chapter.ms) return { ...c, ms };
        if (c.index + 1 < CHAPTERS.length) {
          trackDuringPause(() =>
            track('UI', 'View', tourStepTelemetryType(CHAPTERS[c.index + 1]!.id)),
          );
          return { ...c, index: c.index + 1, ms: 0 };
        }
        return { ...c, ms: chapter.ms, playing: false, finished: true };
      });
      raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [clock.playing]);

  // Each moment: the demo into the replay store, the palette to match, Example to where it is heading.
  useEffect(() => {
    if (!active || !layoutRef.current) return;
    // Measured again on every frame until the first carry: A's first frames can still be settling (its entrance
    // scales it), and one early reading would put the palette's tile, and the carried shape with it, off the screen.
    const settling = clock.index === 0 && clock.ms < ADD.drag1[0];
    calibrate(mapRef, layoutRef, settling);
    const frame = demoAt(clock.index, clock.ms, layoutRef.current);
    applyFrame(frame, signatureRef);
    if (frame.paletteOpen !== !!findTour('palette-category-menu')) clickTour('palette-category');
    if (frame.paletteOpen) captureTile(mapRef, layoutRef, settling);
    if (frame.menuOnB) openMenuTo(frame.menuDepth);
    const point = cursorAt(
      clock.index,
      clock.ms,
      legRef,
      lastPointRef.current,
      frame,
      mapRef.current,
      !!layoutRef.current.tile,
    );
    lastPointRef.current = point;
    setCursor(point);
  }, [active, clock]);

  // Space, the arrows and Escape (watch-it-built.md "The player").
  const seek = useCallback((index: number) => {
    const i = Math.max(0, Math.min(CHAPTERS.length - 1, index));
    const reduced = reducedMotion();
    trackDuringPause(() => track('UI', 'View', tourStepTelemetryType(CHAPTERS[i]!.id)));
    setClock({
      index: i,
      ms: reduced ? CHAPTERS[i]!.ms - 1 : 0,
      playing: !reduced,
      finished: false,
    });
  }, []);
  const clockRef = useLatest(clock);
  const toggle = useCallback(() => {
    if (reducedMotion()) {
      // On the last chapter the button reads Done and finishes, as Your Turn does.
      if (clockRef.current.index + 1 >= CHAPTERS.length) {
        end('completed');
        return;
      }
      setClock((c) => {
        trackDuringPause(() =>
          track('UI', 'View', tourStepTelemetryType(CHAPTERS[c.index + 1]!.id)),
        );
        return { ...c, index: c.index + 1, ms: CHAPTERS[c.index + 1]!.ms - 1 };
      });
      return;
    }
    setClock((c) =>
      c.finished
        ? { index: 0, ms: 0, playing: true, finished: false }
        : { ...c, playing: !c.playing },
    );
  }, [clockRef, end]);
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
  const chapter = CHAPTERS[clock.index]!;
  return (
    <>
      <TourShield />
      <ReplayOverlay
        index={clock.index}
        ms={clock.ms}
        playing={clock.playing}
        finished={clock.finished}
        reduced={reducedMotion()}
        touch={touch}
        menuOpen={menuOpen}
        say={touch ? chapter.sayTouch : chapter.say}
        cursor={cursor}
        canvasRef={ctx.canvasMainRef}
        onToggle={toggle}
        onChapter={seek}
        onYourTurn={() => end('completed')}
      />
    </>
  );
}

// The demo into the replay store and the replay's selection, only when it changed.
function applyFrame(frame: DemoFrame, signatureRef: { current: string }) {
  const signature = JSON.stringify([frame.elements, frame.menuOnB, frame.selectedId]);
  if (signature === signatureRef.current) return;
  signatureRef.current = signature;
  const menu = frame.menuOnB ? (replayStore.get().menu ?? menuBesideB()) : null;
  replayStore.set({ elements: frame.elements, menu });
  replayStore.selection.setSelection({
    selectedId: frame.selectedId,
    multiSelectedIds: new Set(),
  });
}

function menuBesideB() {
  const r = document.querySelector(elementSelector(DEMO_IDS.b))?.getBoundingClientRect();
  return {
    mode: 'element' as const,
    elementId: DEMO_IDS.b,
    x: r ? r.right + 12 : window.innerWidth / 2,
    // Level with A rather than B, so the menu ends above the player.
    y: r ? Math.max(12, r.top - 120) : window.innerHeight / 4,
  };
}

// A button in the element menu or its flyout by the words on it: the exact words first, then a tile whose words end
// its text (a preset's swatch draws an "A" before its name).
function menuButton(name: string): HTMLElement | null {
  const want = name.toLowerCase();
  const buttons = [
    ...document.querySelectorAll<HTMLElement>(
      '[data-context-menu] button, [data-menu-flyout] button',
    ),
  ];
  const text = (b: HTMLElement) => (b.textContent ?? '').trim().toLowerCase();
  return (
    buttons.find((b) => text(b) === want) ?? buttons.find((b) => text(b).endsWith(want)) ?? null
  );
}

// The menu opened as far as this moment has gone: its Style flyout, then the flyout's Presets. Each opens with a
// click on the menu's own button, so a seek back past it (which closes the menu) starts it fresh.
function openMenuTo(depth: DemoFrame['menuDepth']) {
  const steps = ['Style', 'Presets'].slice(0, depth);
  for (const name of steps) {
    const button = menuButton(name);
    if (button && button.getAttribute('aria-expanded') !== 'true') button.click();
  }
}

// Screen to canvas, from A's rect where it waits unseen: its width says the zoom, its corner the origin.
function calibrate(
  mapRef: { current: { zoom: number; left: number; top: number } | null },
  layoutRef: { current: ReplayLayout | null },
  again: boolean,
) {
  if ((mapRef.current && !again) || !layoutRef.current) return;
  const a = layoutRef.current.a;
  const r = document.querySelector(elementSelector(a.id))?.getBoundingClientRect();
  if (!r || r.width === 0) return;
  const zoom = r.width / a.width;
  mapRef.current = { zoom, left: r.left - a.x * zoom, top: r.top - a.y * zoom };
}

// Where the palette's first shape sits, in canvas coordinates, for a carried shape to start from.
function captureTile(
  mapRef: { current: { zoom: number; left: number; top: number } | null },
  layoutRef: { current: ReplayLayout | null },
  again: boolean,
) {
  const map = mapRef.current;
  const layout = layoutRef.current;
  if (!map || !layout || (layout.tile && !again)) return;
  const point = tilePoint();
  if (!point) return;
  layoutRef.current = {
    ...layout,
    tile: { x: (point.x - map.left) / map.zoom, y: (point.y - map.top) / map.zoom },
  };
}

function centreOf(el: Element | null | undefined) {
  const r = el?.getBoundingClientRect();
  return r && r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}

function tilePoint() {
  const menu = findTour('palette-category-menu');
  return centreOf(menu?.querySelector('button, [draggable="true"]') ?? null);
}

function resolve(to: CursorTarget): { x: number; y: number } | null {
  switch (to.kind) {
    case 'category':
      return centreOf(findTour('palette-category'));
    case 'tile':
      return tilePoint() ?? centreOf(findTour('palette-category'));
    case 'element': {
      const r = document.querySelector(elementSelector(to.id))?.getBoundingClientRect();
      if (!r || r.width === 0) return null;
      const x = r.left + r.width / 2;
      if (to.at === 'bottom') return { x, y: r.bottom + 14 };
      if (to.at === 'top') return { x, y: r.top };
      return { x, y: r.top + r.height / 2 };
    }
    case 'menu':
      return centreOf(menuButton(to.name));
  }
}

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);

type Point = { x: number; y: number };
type Leg = { key: string; from: Point };
type ScreenMap = { zoom: number; left: number; top: number };

// Example between where it was when this move began and the waypoint it is heading to, arriving at that one's time.
function cursorAt(
  index: number,
  ms: number,
  legRef: { current: Leg | null },
  last: Point | null,
  frame: DemoFrame,
  map: ScreenMap | null,
  carriesFromTile: boolean,
): ReplayCursor {
  const plan = cursorPlan(index);
  const nextAt = plan.findIndex((w) => w.at > ms);
  const prev = nextAt === -1 ? plan[plan.length - 1] : plan[nextAt - 1];
  const next = nextAt === -1 ? null : plan[nextAt]!;
  // Carrying a shape out of the palette, Example holds it: the cursor is the carried shape's centre, pressed, so the
  // two never part. Taken from the frame itself, not the DOM, which is still a frame behind as the carry starts. With
  // no tile seen the shape just drops where it lands, so Example eases there like any other move.
  if (prev?.to.kind === 'tile' && next?.to.kind === 'element' && carriesFromTile) {
    const held = heldPoint(frame, next.to.id, map);
    if (held) {
      legRef.current = { key: 'held', from: held };
      return { ...held, pressing: true };
    }
  }
  const key = `${index}:${prev?.at ?? -1}`;
  if (legRef.current?.key !== key) {
    legRef.current = { key, from: last ?? (prev ? resolve(prev.to) : null) ?? fallbackPoint() };
  }
  const from = legRef.current.from;
  const pressing = !!prev?.press && ms - prev.at < 260;
  if (!next) return { ...from, pressing };
  const to = resolve(next.to) ?? from;
  const leave = prev ? prev.at + 180 : 0;
  const p = ms <= leave ? 0 : easeInOut(Math.min(1, (ms - leave) / Math.max(1, next.at - leave)));
  return { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p, pressing };
}

// A demo shape's centre on the screen, from where this frame puts it on the canvas.
function heldPoint(frame: DemoFrame, id: string, map: ScreenMap | null): Point | null {
  const el = frame.elements.find((e) => e.id === id);
  if (!map || !el || !('width' in el)) return null;
  const shape = el as { x: number; y: number; width: number; height: number };
  return {
    x: map.left + (shape.x + shape.width / 2) * map.zoom,
    y: map.top + (shape.y + shape.height / 2) * map.zoom,
  };
}

function fallbackPoint() {
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.6 };
}
