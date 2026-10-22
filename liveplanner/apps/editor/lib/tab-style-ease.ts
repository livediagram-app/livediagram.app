'use client';

// Tab Style changes ease rather than snap (docs/specs/011-theme/canvas-and-theme-dialog.md "Eased changes"): picking a
// look, a theme, a finish, a typeface, a size or a pattern eases the canvas's colours over a short transition
// (STYLE_TRANSITION_MS). The transition is on only for the moment of the change (a class on the root, scoped to the
// canvas in globals.css), so it costs nothing the rest of the time; Reduce motion turns it off.

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
