'use client';

// One Moon Mail run on this screen (docs/specs/009-elements/social-pieces.md "The panel", "Controls", "Reduced
// motion"; blueprint "The panel"): the run's phase, the strip under the screen, the keys, the taps and pausing, and
// one requestAnimationFrame loop that plays the model (lib/arcade/moon-mail) and paints it through the canvas's ref.
//
// React hears of a phase change (start, pause, game over) and of the strip when its score, streak or shields
// change; never of a frame. The loop runs only while a run plays: paused, over, hidden or closed, nothing runs.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { claimAvatarKeys, type ClaimedKey } from '@liveworkspace/avatar/key-claims';
import { isEnterActivatedTarget, isTypingTarget } from '@liveworkspace/workbench/lib/typing-target';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { PREFERS_REDUCED_MOTION, prefersReducedMotion, useMediaQuery } from '@livehuddle/ui';
import {
  advance,
  hop,
  hopForTap,
  newRun,
  SHIELDS,
  streakFor,
  type MoonMailRun,
} from '@/lib/arcade/moon-mail';
import { createMoonMailPainter } from '@/lib/arcade/moon-mail-paint';

export type MoonMailPhase = 'ready' | 'playing' | 'paused' | 'over';
export type MoonMailStrip = { score: number; streak: number; shields: number };

/** The backing store is at most twice the CSS size: sharper buys nothing on a screen this small. */
const MAX_DPR = 2;

const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S', ' ', 'Enter', 'p', 'P']);
const isGameKey = (e: ClaimedKey) => !e.metaKey && !e.ctrlKey && !e.altKey && GAME_KEYS.has(e.key);

/** A fresh seed for a run: the run itself is deterministic from it. */
function freshSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! | 0;
}

const stripOf = (run: MoonMailRun): MoonMailStrip => ({
  score: run.score,
  streak: streakFor(run.streak),
  shields: run.shields,
});

export function useMoonMail({
  playable,
  onEnd,
}: {
  // Whether this screen may play (an Editor or a Participant): a Viewer's panel runs nothing.
  playable: boolean;
  // A run ended, by Game Over or by closing the panel mid-run: once per run.
  onEnd: (run: MoonMailRun) => void;
}) {
  const reduced = useMediaQuery(PREFERS_REDUCED_MOTION) || prefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenRef = useRef<HTMLDivElement | null>(null);
  // The run on show at rest, before the first Start.
  const [restingRun] = useState(() => newRun(freshSeed()));
  const runRef = useRef<MoonMailRun>(restingRun);
  const endedRef = useRef(false);
  const pxRef = useRef(0);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [painter] = useState(() => createMoonMailPainter());
  const [phase, setPhaseState] = useState<MoonMailPhase>('ready');
  const phaseRef = useRef<MoonMailPhase>('ready');
  const [strip, setStrip] = useState<MoonMailStrip>(() => stripOf(restingRun));
  const stripRef = useRef(strip);
  const onEndRef = useLatest(onEnd);
  const reducedRef = useLatest(reduced);

  const setPhase = useCallback((p: MoonMailPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const syncStrip = useCallback((run: MoonMailRun) => {
    const was = stripRef.current;
    const streak = streakFor(run.streak);
    if (was.score === run.score && was.streak === streak && was.shields === run.shields) return;
    stripRef.current = { score: run.score, streak, shields: run.shields };
    setStrip(stripRef.current);
  }, []);

  const paintNow = useCallback(() => {
    const canvas = canvasRef.current;
    const run = runRef.current;
    if (!canvas || !run || pxRef.current === 0) return;
    ctxRef.current ??= canvas.getContext('2d');
    const ctx = ctxRef.current;
    if (!ctx) return;
    painter.paint(ctx, run, {
      now: performance.now(),
      px: pxRef.current,
      reduced: reducedRef.current,
    });
  }, [painter, reducedRef]);

  const end = useCallback(
    (run: MoonMailRun) => {
      if (endedRef.current) return;
      endedRef.current = true;
      onEndRef.current(run);
    },
    [onEndRef],
  );

  const start = useCallback(() => {
    if (!playable) return;
    const run = newRun(freshSeed());
    runRef.current = run;
    endedRef.current = false;
    syncStrip(run);
    setPhase('playing');
    screenRef.current?.focus({ preventScroll: true });
  }, [playable, setPhase, syncStrip]);

  const pause = useCallback(() => {
    if (phaseRef.current === 'playing') setPhase('paused');
  }, [setPhase]);

  const resume = useCallback(() => {
    if (phaseRef.current !== 'paused') return;
    setPhase('playing');
    screenRef.current?.focus({ preventScroll: true });
  }, [setPhase]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === 'playing') pause();
    else resume();
  }, [pause, resume]);

  const doHop = useCallback((dir: 'out' | 'in') => {
    if (phaseRef.current !== 'playing' || !runRef.current) return;
    hop(runRef.current, dir);
  }, []);

  // The screen's size: the backing store follows it (times the device's pixel ratio), and a still frame repaints.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const css = canvas.clientWidth;
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      const px = Math.max(1, Math.round(css * dpr));
      if (px === pxRef.current) return;
      pxRef.current = px;
      canvas.width = px;
      canvas.height = px;
      ctxRef.current = null;
      if (phaseRef.current !== 'playing') paintNow();
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paintNow, playable]);

  // The loop: one requestAnimationFrame while a run plays; any other phase paints one still frame.
  useEffect(() => {
    if (phase !== 'playing') {
      paintNow();
      return;
    }
    const run = runRef.current;
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      advance(run, now - last);
      last = now;
      syncStrip(run);
      paintNow();
      if (run.over) {
        end(run);
        setPhase('over');
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, reduced, paintNow, syncStrip, end, setPhase]);

  // A run pauses by itself when the tab or the window is hidden or loses focus, and never resumes by itself.
  useEffect(() => {
    if (phase !== 'playing') return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', pause);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', pause);
    };
  }, [phase, pause]);

  // The keys, while the panel is open: the game's, never the walk's, the action keys' or the message box's.
  const keysRef = useLatest({ start, togglePause, resume, doHop });
  useEffect(() => {
    if (!playable) return;
    const release = claimAvatarKeys(isGameKey);
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isGameKey(e) || isTypingTarget(e.target)) return;
      const activates = e.key === ' ' || e.key === 'Enter';
      // A focused button (Close, Pause, Play Again) keeps its own Space and Enter.
      if (activates && isEnterActivatedTarget(e.target)) return;
      e.preventDefault();
      if (e.repeat) return;
      const k = keysRef.current;
      const p = phaseRef.current;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') k.doHop('out');
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') k.doHop('in');
      else if (e.key === 'p' || e.key === 'P') {
        if (p === 'playing' || p === 'paused') k.togglePause();
      } else if (p === 'ready' || p === 'over') k.start();
      else if (p === 'paused') k.resume();
      else if (e.key === ' ') k.togglePause();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      release();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [playable, keysRef]);

  // Closing the panel (or leaving its tab) during a run ends it, and its score counts as at Game Over.
  useEffect(
    () => () => {
      const run = runRef.current;
      const p = phaseRef.current;
      if (run && (p === 'playing' || p === 'paused') && run.ms > 0) end(run);
    },
    [end],
  );

  /** A press on the screen: starts, resumes, or hops out or in by where it lands against the ship's orbit. */
  const onScreenPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!playable) return;
      e.preventDefault();
      const p = phaseRef.current;
      if (p === 'ready' || p === 'over') return start();
      if (p === 'paused') return resume();
      const box = e.currentTarget.getBoundingClientRect();
      if (box.width <= 0 || !runRef.current) return;
      const x = (e.clientX - box.left) / box.width;
      const y = (e.clientY - box.top) / box.height;
      doHop(hopForTap(runRef.current, x, y));
    },
    [playable, start, resume, doHop],
  );

  return {
    phase,
    strip,
    reduced,
    canvasRef,
    screenRef,
    start,
    pause,
    resume,
    togglePause,
    onScreenPointerDown,
    shieldsMax: SHIELDS,
  };
}

export type MoonMailGame = ReturnType<typeof useMoonMail>;
