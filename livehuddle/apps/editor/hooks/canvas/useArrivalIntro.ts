'use client';

// The arrival's overview, run (docs/specs/008-canvas/3d-view.md "Arriving"): the view jumps out to the whole tab, holds
// INTRO_HOLD_MS, then zooms in over INTRO_ZOOM_MS to the view the arrival would have landed on. Any press, wheel, key
// or touch stops it where it is. Called by useAvatarCamera, whose arrival it stands in for.

import { useCallback, useEffect, useRef } from 'react';
import type { ViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import type { ViewPose } from '@liveworkspace/workbench/lib/viewport-glide';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import {
  arrivalIntroPlaying,
  INTRO_HOLD_MS,
  INTRO_ZOOM_MS,
  introPose,
  introStart,
  introWorthPlaying,
} from '@/lib/space-3d/arrival-intro';

type Point = { x: number; y: number };

// The most one frame moves the overview's clock (ms), about two frames at 60.
const MAX_FRAME_MS = 34;

// What a hand does: each one stops the overview where it is. Captured on the window, so nothing can swallow it first.
const STOP_EVENTS = ['pointerdown', 'wheel', 'keydown', 'touchstart', 'gesturestart'] as const;

export function useArrivalIntro({
  viewport,
  canvasMainRef,
  overview,
}: {
  viewport: ViewportStore;
  canvasMainRef: React.RefObject<HTMLElement | null>;
  // The whole tab framed, as Fit frames it; null when there is nothing to frame or no canvas to measure.
  overview: () => ViewPose | null;
}) {
  const stopRef = useRef<(() => void) | null>(null);
  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  /**
   * Plays the overview, ending on `to` with `target` (your character) as the point the eye follows. False when it does
   * not play (reduced motion, nothing to frame, a tab that already fits): the caller lands on `to` itself.
   */
  const play = useCallback(
    (to: ViewPose, target: Point): boolean => {
      stop();
      const node = canvasMainRef.current;
      if (!node || prefersReducedMotion()) return false;
      const fit = overview();
      if (!fit) return false;
      const start = introStart(fit, to);
      if (!introWorthPlaying(start, to)) return false;
      const size = { width: node.offsetWidth, height: node.offsetHeight };
      // The overview first, then the walls layer is told: it chooses its area for the whole Space, and holds it.
      viewport.setView(start);
      arrivalIntroPlaying.set(true);
      // Its own clock, on painted frames, each counting at most MAX_FRAME_MS: a long task (the scene's first draw
      // compiling its shaders on a load) pauses the overview rather than eating the hold or jumping the zoom.
      let raf = 0;
      let last = 0;
      let elapsed = 0;
      let from: ViewPose | null = null;
      const step = (now: number) => {
        if (last !== 0) elapsed += Math.min(MAX_FRAME_MS, Math.max(0, now - last));
        last = now;
        if (elapsed >= INTRO_HOLD_MS) {
          // From wherever the view is as the hold ends: a Map that showed in the hold re-fits it.
          from ??= viewport.get();
          const k = (elapsed - INTRO_HOLD_MS) / INTRO_ZOOM_MS;
          viewport.setView(introPose(from, to, target, size, k));
          if (k >= 1) {
            end();
            return;
          }
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      const cancel = () => stop();
      const end = () => {
        cancelAnimationFrame(raf);
        for (const type of STOP_EVENTS) window.removeEventListener(type, cancel, true);
        arrivalIntroPlaying.set(false);
        if (stopRef.current === end) stopRef.current = null;
      };
      for (const type of STOP_EVENTS)
        window.addEventListener(type, cancel, { capture: true, passive: true });
      stopRef.current = end;
      return true;
    },
    [canvasMainRef, overview, stop, viewport],
  );

  return { play, stop };
}
