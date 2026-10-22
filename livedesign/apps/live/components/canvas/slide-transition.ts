// The slide transition's moving parts (docs/specs/012-collaboration/presentation-mode.md "Motion"), for
// PresentationHost. A move runs as a React View Transition typed by its direction: the canvas <main> sits in a
// <ViewTransition> whose `update` animates for these types alone (SLIDE_VIEW_TRANSITION_UPDATE), so the browser
// animates a picture of the surface before and after, with no copy in the DOM. The first slide waits for the screen
// to settle (`whenScreenSettles`): going fullscreen resizes the canvas, and the refit that follows used to land
// mid-entrance, the card arriving and then jumping.

import type { SlideTransition } from '@/lib/presentation-config';

// Longest the first slide waits for fullscreen to land before it arrives anyway (a refused request).
export const SETTLE_FAILSAFE_MS = 600;

const SLIDE_TRANSITION_TYPES = ['slide-in', 'slide-forward', 'slide-back', 'slide-fade'] as const;
type SlideTransitionType = (typeof SLIDE_TRANSITION_TYPES)[number];

/** The surface's View Transition classes, by transition type: the slide types animate, nothing else does. */
export const SLIDE_VIEW_TRANSITION_UPDATE: Record<SlideTransitionType | 'default', string> = {
  'slide-in': 'slide-in',
  'slide-forward': 'slide-forward',
  'slide-back': 'slide-back',
  'slide-fade': 'slide-fade',
  default: 'none',
};

/** The type a move from slide `from` to slide `to` runs as, or null when it does not animate (None, or no move). */
export function slideTransitionType(
  transition: SlideTransition,
  from: number,
  to: number,
): Exclude<SlideTransitionType, 'slide-in'> | null {
  if (transition === 'none' || from === to) return null;
  if (transition === 'fade') return 'slide-fade';
  return to > from ? 'slide-forward' : 'slide-back';
}

/** Calls `ready` once the screen has settled for the first slide: at once where there is no fullscreen to wait for,
 *  else after the fullscreen change (or its refusal, or the failsafe) and the refit it sets off. Returns a cancel. */
export function whenScreenSettles(ready: () => void): () => void {
  const root = document.documentElement;
  if (typeof root.requestFullscreen !== 'function' || document.fullscreenElement) {
    ready();
    return () => {};
  }
  let cancelled = false;
  let frame = 0;
  const settle = () => {
    cleanup();
    // Two frames: the resize lands, then the refit it sets off paints.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (!cancelled) ready();
      });
    });
  };
  const failsafe = window.setTimeout(settle, SETTLE_FAILSAFE_MS);
  document.addEventListener('fullscreenchange', settle);
  document.addEventListener('fullscreenerror', settle);
  function cleanup() {
    window.clearTimeout(failsafe);
    document.removeEventListener('fullscreenchange', settle);
    document.removeEventListener('fullscreenerror', settle);
  }
  return () => {
    cancelled = true;
    cleanup();
    cancelAnimationFrame(frame);
  };
}
