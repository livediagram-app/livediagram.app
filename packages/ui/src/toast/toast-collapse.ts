// A leaving toast collapsing into the footer's bell (liveworkspace/docs/specs/016-notifications/toasts.md "Collapsing
// into the bell"): it shrinks and slides to the bell's centre over `long`, fading as it arrives, and the bell gives one
// small pulse. Script-driven (the Web Animations API), because where it goes is measured: the bell's place depends on
// the bar it sits in. No bell on screen, no `animate` (a test environment) or reduced motion: null, and the toast
// leaves by its CSS `toast-out` where it is.

import { prefersReducedMotion } from '../motion-preference';

/** The `long` motion token (motion.md), the chrome ceiling. */
export const TOAST_COLLAPSE_MS = 250;
/** The bell's pulse on arrival, at `short`. */
export const TOAST_BELL_PULSE_MS = 200;
/** What the footer's bell carries, so a toast finds where to go without sharing a React tree with it. */
export const TOAST_BELL_ATTR = 'data-toast-bell';

type Rect = { left: number; top: number; width: number; height: number };

/** Where the card's centre moves and how far it shrinks, to end at the bell's size (pure, for the test). */
export function collapseTarget(card: Rect, bell: Rect): { dx: number; dy: number; scale: number } {
  const dx = bell.left + bell.width / 2 - (card.left + card.width / 2);
  const dy = bell.top + bell.height / 2 - (card.top + card.height / 2);
  const fit = Math.min(
    bell.width / Math.max(card.width, 1),
    bell.height / Math.max(card.height, 1),
  );
  return { dx, dy, scale: Math.min(1, Math.max(0.04, fit)) };
}

/** The bell on screen, if any: the first that has a size and lies inside the window. */
export function findToastBell(doc: Document = document): HTMLElement | null {
  const view = doc.defaultView;
  if (!view) return null;
  for (const bell of doc.querySelectorAll<HTMLElement>(`[${TOAST_BELL_ATTR}]`)) {
    const r = bell.getBoundingClientRect();
    if (
      r.width > 0 &&
      r.height > 0 &&
      r.bottom > 0 &&
      r.right > 0 &&
      r.top < view.innerHeight &&
      r.left < view.innerWidth
    ) {
      return bell;
    }
  }
  return null;
}

/** Start the collapse of `card` into the bell; null when it leaves the plain way instead. */
export function collapseIntoBell(card: HTMLElement): Animation | null {
  if (typeof card.animate !== 'function' || prefersReducedMotion()) return null;
  const bell = findToastBell(card.ownerDocument);
  if (!bell) return null;
  const { dx, dy, scale } = collapseTarget(
    card.getBoundingClientRect(),
    bell.getBoundingClientRect(),
  );
  const motion = card.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { opacity: 0.9, offset: 0.6 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 },
    ],
    { duration: TOAST_COLLAPSE_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
  );
  motion.finished.then(
    () => {
      if (typeof bell.animate !== 'function') return;
      bell.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
        { duration: TOAST_BELL_PULSE_MS, easing: 'ease-out' },
      );
    },
    () => {},
  );
  return motion;
}
