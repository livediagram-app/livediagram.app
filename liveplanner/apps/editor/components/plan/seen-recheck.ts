// A second look for useSeen (use-image-url.ts; docs/specs/026-plan/item-types.md "Image fields"). An
// IntersectionObserver reports only crossings: a tile mounted inside a panel that is still sliding in gets its first
// entry while it is off screen, and when the slide runs on the compositor the browser can finish it without
// computing the crossing, so the tile waits on its placeholder for good (Work Tracker 826). So every element still
// waiting is also measured by its own rectangle once the motion settles: on the next `transitionend` or
// `animationend` anywhere, and SEEN_RECHECK_MS after it began waiting. One set of listeners for every waiting element,
// one measure pass a frame, and nothing at all once none waits.

// How far past the viewport an element already counts as seen, as the observer's rootMargin.
export const SEEN_MARGIN_PX = 200;
// How long after an element starts waiting it is measured anyway: past any panel's opening motion.
export const SEEN_RECHECK_MS = 800;

const waiting = new Map<Element, () => void>();
let frame: number | null = null;
let listening = false;

function onScreen(el: Element): boolean {
  if (!el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  return (
    r.bottom >= -SEEN_MARGIN_PX &&
    r.right >= -SEEN_MARGIN_PX &&
    r.top <= h + SEEN_MARGIN_PX &&
    r.left <= w + SEEN_MARGIN_PX
  );
}

// Measure every waiting element now; the ones on screen are told and stop waiting.
export function recheckSeen(): void {
  frame = null;
  for (const [el, onSeen] of [...waiting]) {
    if (!onScreen(el)) continue;
    waiting.delete(el);
    onSeen();
  }
  if (waiting.size === 0) stopListening();
}

function schedule(): void {
  if (frame !== null) return;
  frame = requestAnimationFrame(recheckSeen);
}

function startListening(): void {
  if (listening) return;
  listening = true;
  document.addEventListener('transitionend', schedule, true);
  document.addEventListener('animationend', schedule, true);
}

function stopListening(): void {
  if (!listening) return;
  listening = false;
  document.removeEventListener('transitionend', schedule, true);
  document.removeEventListener('animationend', schedule, true);
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
}

// Wait for `el` to be found on screen by a recheck; answers the function that stops waiting.
export function awaitSeen(el: Element, onSeen: () => void): () => void {
  waiting.set(el, onSeen);
  startListening();
  const timer = setTimeout(schedule, SEEN_RECHECK_MS);
  return () => {
    clearTimeout(timer);
    if (waiting.get(el) === onSeen) waiting.delete(el);
    if (waiting.size === 0) stopListening();
  };
}

// How many elements wait (tests).
export function seenWaiting(): number {
  return waiting.size;
}
