// The view rests on a page (docs/specs/007-editor/pages-mode.md "Getting around the pages"): while
// Pages mode is on, the moment a pan or a zoom lets go (a canvas gesture closing) the view glides
// onto a page (lib/page-snap.ts), and the same once anything else that moved it (the zoom
// cluster, the Map, the arrow keys) has rested VIEW_REST_MS with no pointer held. A hand on the
// canvas is never fought: nothing snaps while a gesture is open or a pointer is down, and a
// gesture opening stops a glide under way.
import { useEffect } from 'react';
import type { LaidOutPage } from '@livedocuments/document';
import { canvasGestureNow, subscribeCanvasGesture } from '@/lib/canvas-gesture';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { pageInView } from '@/lib/page-contents';
import { pageSnap, type SnapBand, type SnapFrame } from '@/lib/page-snap';
import { track } from '@/lib/telemetry';
import type { View } from '@liveworkspace/workbench/lib/viewport-store';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

// How long a view moved by anything but a gesture rests before it snaps: past a held arrow key's
// repeat and a glide's frames, short of feeling like a second, separate move.
export const VIEW_REST_MS = 250;
// A pan's last this-many ms of movement give its speed as the hand lets go.
export const FLICK_WINDOW_MS = 80;

export type SnapMeasure = {
  screen: { width: number; height: number };
  band: SnapBand;
};

type Sample = { t: number; x: number };

/** The content's sideways speed (screen px per ms) over the last FLICK_WINDOW_MS before `now`;
 *  0 when it had stopped (a wheel pan's settle, a finger held still before lifting). */
export function flickVelocity(samples: readonly Sample[], now: number): number {
  const recent = samples.filter((s) => now - s.t <= FLICK_WINDOW_MS);
  if (recent.length < 2) return 0;
  const first = recent[0]!;
  const last = recent.at(-1)!;
  const dt = last.t - first.t;
  return dt > 0 ? (last.x - first.x) / dt : 0;
}

export function usePageSnap(deps: {
  on: boolean;
  pages: readonly LaidOutPage[];
  viewport?: { get: () => View; subscribe: (listener: () => void) => () => void };
  // The canvas's size and what shows of it; null while it is not mounted.
  measure: () => SnapMeasure | null;
  // A page's own fit, as its label frames it.
  fitOf: (page: LaidOutPage) => SnapFrame;
  // `pageId`: the page the view rests on (a stack of flashcards flips to it instead).
  glideTo: (frame: SnapFrame, pageId: string) => void;
  cancelGlide: () => void;
  // Following someone or presenting: the view is not this person's to move.
  suspended: () => boolean;
  // An article's writing has the caret: a view moved by anything but a hand was moved for the caret
  // (kept in sight, above a phone's keyboard), and is left where it is. A gesture still snaps.
  writing?: () => boolean;
}): void {
  const latest = useLatest(deps);
  const { on, viewport } = deps;
  useEffect(() => {
    if (!on || !viewport) return;
    let gesture = canvasGestureNow();
    // The page in view as the gesture began, whether it panned, and the pan's recent travel.
    let from: string | undefined;
    let panned = false;
    let samples: Sample[] = [];
    // A gesture that closed while a pointer was still down: settled once the last one lifts.
    let owed: boolean | null = null;
    const pointers = new Set<number>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;

    const hereNow = () => {
      const m = latest.current.measure();
      if (!m) return undefined;
      const { screen, band } = m;
      return pageInView(latest.current.pages, viewport.get(), screen, {
        left: band.left,
        right: screen.width - band.right,
      });
    };
    const snap = (swipe: boolean) => {
      clearTimeout(timer);
      const d = latest.current;
      if (d.suspended() || canvasGestureNow() !== 'idle' || pointers.size > 0) return;
      const m = d.measure();
      if (!m) return;
      const view = viewport.get();
      const result = pageSnap({
        pages: d.pages,
        view,
        screen: m.screen,
        band: m.band,
        fitOf: d.fitOf,
        ...(swipe ? { from, velocity: flickVelocity(samples, performance.now()) } : {}),
      });
      samples = [];
      if (!result) return;
      if (result.swiped) track('UI', 'Used', 'PageSwipe');
      debugLog('[page] snapped', {
        page: result.pageId,
        swiped: result.swiped,
        from: view.zoom,
        to: result.frame.zoom,
      });
      d.glideTo(result.frame, result.pageId);
    };
    const settleSoon = () => {
      clearTimeout(timer);
      if (latest.current.writing?.()) return;
      timer = setTimeout(() => snap(false), VIEW_REST_MS);
    };
    // A frame later, so the gesture's own last move (and its pointerup) has landed.
    const snapNextFrame = (swipe: boolean) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => snap(swipe));
    };

    const offGesture = subscribeCanvasGesture(() => {
      const was = gesture;
      gesture = canvasGestureNow();
      if (was === 'idle' && gesture !== 'idle') {
        clearTimeout(timer);
        cancelAnimationFrame(raf);
        latest.current.cancelGlide();
        from = hereNow();
        panned = false;
        owed = null;
        samples = [];
      }
      if (gesture === 'pan') panned = true;
      if (gesture === 'idle' && was !== 'idle') {
        if (pointers.size > 0) owed = panned;
        else snapNextFrame(panned);
      }
    });
    const offView = viewport.subscribe(() => {
      if (gesture === 'idle') {
        settleSoon();
        return;
      }
      const { zoom, offset } = viewport.get();
      samples.push({ t: performance.now(), x: offset.x * zoom });
      if (samples.length > 32) samples = samples.slice(-16);
    });

    const down = (e: PointerEvent) => {
      pointers.add(e.pointerId);
      clearTimeout(timer);
    };
    const up = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId) || pointers.size > 0) return;
      if (owed !== null) {
        const swipe = owed;
        owed = null;
        snapNextFrame(swipe);
      } else settleSoon();
    };
    // A release the window never saw (the pointer let go outside it, the tab hidden) must not hold
    // the snap off for good.
    const lost = () => {
      pointers.clear();
      owed = null;
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    window.addEventListener('blur', lost);
    document.addEventListener('visibilitychange', lost);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      offGesture();
      offView();
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      window.removeEventListener('blur', lost);
      document.removeEventListener('visibilitychange', lost);
    };
  }, [on, viewport, latest]);
}
