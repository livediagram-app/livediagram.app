// A second look for useSeen (use-image-url.ts; docs/specs/026-plan/item-types.md "Image fields"). An
// IntersectionObserver reports only crossings: a tile mounted inside a panel that is still sliding in gets its first
// entry while it is off screen, and when the slide runs on the compositor the browser can finish it without
// computing the crossing, so the tile waits on its placeholder for good (Work Tracker 826). So an element just
// mounted is also measured by its own rectangle once the motion settles: on any `transitionend` or `animationend` in
// its first SEEN_RECHECK_MS, and once more at its end, after which the observer alone watches it (a scroll is a
// crossing the observer never misses). Only elements mounted in the last SEEN_RECHECK_MS wait, so a hover's
// transition on a big board measures a handful, never every card; one set of listeners, one measure pass a frame, and
// nothing at all once none waits.

// How far past the viewport an element already counts as seen, as the observer's rootMargin.
export const SEEN_MARGIN_PX = 200;
// How long an element waits for a recheck after it mounts: past any panel's opening motion (about 300 ms).
export const SEEN_RECHECK_MS = 800;

type Waiter = { onSeen: () => void; last: boolean };
const waiting = new Map<Element, Waiter>();
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

// Measure every waiting element now: the ones on screen are told, and those at their last look stop waiting.
export function recheckSeen(): void {
  frame = null;
  for (const [el, waiter] of [...waiting]) {
    if (onScreen(el)) {
      waiting.delete(el);
      waiter.onSeen();
    } else if (waiter.last) waiting.delete(el);
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

// Wait for `el` to be found on screen by a recheck, for SEEN_RECHECK_MS; answers the function that stops waiting.
export function awaitSeen(el: Element, onSeen: () => void): () => void {
  const waiter: Waiter = { onSeen, last: false };
  waiting.set(el, waiter);
  startListening();
  const timer = setTimeout(() => {
    waiter.last = true;
    schedule();
  }, SEEN_RECHECK_MS);
  return () => {
    clearTimeout(timer);
    if (waiting.get(el) === waiter) waiting.delete(el);
    if (waiting.size === 0) stopListening();
  };
}

// How many elements wait (tests).
export function seenWaiting(): number {
  return waiting.size;
}
