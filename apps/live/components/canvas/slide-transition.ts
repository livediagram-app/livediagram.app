// The slide transition's moving parts (docs/specs/012-collaboration/presentation-mode.md "Motion"), as DOM helpers
// PresentationHost drives. Kept apart so the host stays the "a deck is running" switchboard and these stay testable.
//
// Three things make a deck feel smooth rather than janky, each learnt from watching it:
// - The outgoing slide LEAVES while the incoming one arrives. There is one canvas, so the outgoing slide is a
//   snapshot of the surface taken just before the move (`snapshotOutgoing`), animated away and removed.
// - A move restarts its animation even when it travels the same way as the last (`restartMove`). Setting an
//   attribute to the value it already holds starts nothing, so a quick second press used to cut without motion.
// - The first slide waits for the screen to settle (`whenScreenSettles`): going fullscreen resizes the canvas, and
//   the refit that follows used to land mid-entrance, the card arriving and then jumping.

// The node the transition animates: the canvas surface.
export const SLIDE_SURFACE_SELECTOR = '[data-canvas-a11y-root]';

// Under the presentation's click catcher (z-60) and HUD, over the editor the surface sits in.
const GHOST_Z = 59;
// Longest a snapshot may stay if its animation never ends (a hidden tab): past any transition speed.
const GHOST_FAILSAFE_MS = 1500;
// Longest the first slide waits for fullscreen to land before it arrives anyway (a refused request).
export const SETTLE_FAILSAFE_MS = 600;

export type SlideMove = 'in' | 'forward' | 'back';

/** Sets the move on the root so its animation starts afresh, even if the last move travelled the same way. */
export function restartMove(root: HTMLElement, surface: Element | null, move: SlideMove): void {
  root.removeAttribute('data-slide-move');
  // Reading layout here makes the browser drop the old animation before the attribute comes back.
  if (surface instanceof HTMLElement) void surface.offsetWidth;
  root.setAttribute('data-slide-move', move);
}

/** A copy of the surface as it is now, fixed where it stands, to animate the outgoing slide away. Null when there
 *  is nothing to copy or the transition does not move (None). */
export function snapshotOutgoing(surface: Element | null, transition: string): HTMLElement | null {
  if (!(surface instanceof HTMLElement) || transition === 'none') return null;
  const rect = surface.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const ghost = surface.cloneNode(true) as HTMLElement;
  // Not the surface: no selector, focus or reader may find it.
  ghost.removeAttribute('data-canvas-a11y-root');
  ghost.setAttribute('data-slide-ghost', '');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    pointerEvents: 'none',
    zIndex: String(GHOST_Z),
  });
  return ghost;
}

/** Puts the snapshot on screen leaving the way the deck moves, and removes it once it has gone. */
export function sendOff(ghost: HTMLElement, move: 'forward' | 'back'): () => void {
  ghost.setAttribute('data-slide-leave', move);
  document.body.appendChild(ghost);
  let gone = false;
  const remove = () => {
    if (gone) return;
    gone = true;
    ghost.remove();
    window.clearTimeout(failsafe);
  };
  const onEnd = (e: Event) => {
    if (e.target === ghost) remove();
  };
  ghost.addEventListener('animationend', onEnd);
  ghost.addEventListener('animationcancel', onEnd);
  const failsafe = window.setTimeout(remove, GHOST_FAILSAFE_MS);
  return remove;
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
