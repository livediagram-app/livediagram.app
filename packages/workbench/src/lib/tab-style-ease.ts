'use client';

// Tab Style changes ease rather than snap (docs/specs/011-theme/canvas-and-theme-dialog.md "Eased changes"): picking a
// look, a theme, a finish, a typeface, a size or a pattern eases the canvas's colours over a short transition
// (STYLE_TRANSITION_MS). The transition is on only for the moment of the change (a class on the root, scoped to the
// canvas in globals.css), so it costs nothing the rest of the time; Reduce motion turns it off. On a busy canvas
// (canvasIsBusy, below) only the canvas surface eases and its parts snap, and the ease is an attribute on the surface
// alone (SURFACE_EASE_ATTR), not the root's class: the parts' rule ends in `*`, so the browser restyles every node of
// the page each time the root's class comes or goes, which on a 400-element canvas was a long task of its own at the
// pick and again as the ease ended (docs/specs/008-canvas/canvas-performance.md "A theme pick on a big board").
import { startTransition } from 'react';

/** How long a style change eases its colours (the long motion token). */
const STYLE_TRANSITION_MS = 250;
const TRANSITION_CLASS = 'lvd-style-transition';
/** The busy canvas surface's ease: each editor's globals.css eases `[data-canvas-root][data-style-easing]` itself and
 *  has no rule for its parts under it. */
export const SURFACE_EASE_ATTR = 'data-style-easing';
let transitionTimer: ReturnType<typeof setTimeout> | null = null;
let easing: (() => void) | null = null;

/** Eases the canvas's colours into whatever it draws next. */
export function easeNextStyleChange(): void {
  if (typeof document === 'undefined') return;
  if (transitionTimer) clearTimeout(transitionTimer);
  // A pick during the ease extends it where it is.
  if (!easing) {
    const surface = document.querySelector('[data-canvas-root][data-canvas-busy]');
    if (surface) {
      surface.setAttribute(SURFACE_EASE_ATTR, '');
      easing = () => surface.removeAttribute(SURFACE_EASE_ATTR);
    } else {
      const root = document.documentElement;
      root.classList.add(TRANSITION_CLASS);
      easing = () => root.classList.remove(TRANSITION_CLASS);
    }
  }
  transitionTimer = setTimeout(() => {
    easing?.();
    easing = null;
    transitionTimer = null;
  }, STYLE_TRANSITION_MS + 50);
}

/** Whether a Tab Style change is being drawn (its ease is on). */
export const styleChangeInFlight = (): boolean => easing !== null;

/** A Tab Style setter the canvas eases into, its change drawn as a transition (docs/specs/008-canvas/
 *  canvas-performance.md "A theme pick on a big board"): React draws the restyled elements in slices between frames
 *  instead of one long task, the old style staying on screen until the new one is ready. */
export const easedStyleChange =
  <A>(fn: (a: A) => void) =>
  (a: A): void => {
    easeNextStyleChange();
    startTransition(() => fn(a));
  };

// A busy canvas (docs/specs/008-canvas/canvas-performance.md "A Tab Style change on a busy canvas eases the canvas, not
// its parts", in each editor): above this many elements a Tab Style change eases the canvas's own colour and snaps
// every part inside it. Easing the parts restyles every node of every element on each frame of the ease, so its long
// frames grow with the elements on the tab. Each editor's Canvas marks its `data-canvas-root` surface
// `data-canvas-busy` by this, and its globals.css eases the parts only under `:not([data-canvas-busy])`.
export const BUSY_CANVAS_ELEMENTS = 20;

/** Whether a tab of `count` elements is busy: its Tab Style changes snap the parts, easing only the canvas. */
export const canvasIsBusy = (count: number): boolean => count > BUSY_CANVAS_ELEMENTS;
