'use client';

// Tab Style changes ease rather than snap (docs/specs/011-theme/canvas-and-theme-dialog.md "Eased changes"): picking a
// look, a theme, a finish, a typeface, a size or a pattern eases the canvas's colours over a short transition
// (STYLE_TRANSITION_MS). The transition is on only for the moment of the change (a class on the root, scoped to the
// canvas in globals.css), so it costs nothing the rest of the time; Reduce motion turns it off. On a busy canvas
// (canvasIsBusy, below) only the canvas surface eases and its parts snap.

/** How long a style change eases its colours (the long motion token). */
const STYLE_TRANSITION_MS = 250;
const TRANSITION_CLASS = 'lvd-style-transition';
let transitionTimer: ReturnType<typeof setTimeout> | null = null;

/** Eases the canvas's colours into whatever it draws next. */
export function easeNextStyleChange(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.add(TRANSITION_CLASS);
  if (transitionTimer) clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => {
    root.classList.remove(TRANSITION_CLASS);
    transitionTimer = null;
  }, STYLE_TRANSITION_MS + 50);
}

// A busy canvas (docs/specs/008-canvas/canvas-performance.md "A Tab Style change on a busy canvas eases the canvas, not
// its parts", in each editor): above this many elements a Tab Style change eases the canvas's own colour and snaps
// every part inside it. Easing the parts restyles every node of every element on each frame of the ease, so its long
// frames grow with the elements on the tab. Each editor's Canvas marks its `data-canvas-root` surface
// `data-canvas-busy` by this, and its globals.css eases the parts only under `:not([data-canvas-busy])`.
export const BUSY_CANVAS_ELEMENTS = 20;

/** Whether a tab of `count` elements is busy: its Tab Style changes snap the parts, easing only the canvas. */
export const canvasIsBusy = (count: number): boolean => count > BUSY_CANVAS_ELEMENTS;
