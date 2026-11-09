// Finding the control a mission strip's ring means (docs/specs/026-plan/plan-tour.md "Names the control", "Never over
// what it names"): the first of a list of selectors drawn on screen and not under another layer. Shared by the ring
// (HintRing) and by the strip's choice of edge on a phone (useDockEdge), so both mean the same control.

// The strip's own layer: never counts as covering a control, as it moves out of the way of what it names.
const STRIP_LAYER = '[data-mission-strip-layer]';

// Whether another layer (a dialog opened over it) covers the target at its centre: the ring would float over that
// layer, ringing a control nobody can press. The ring itself takes no pointer, so it is never what is hit. Off screen,
// nothing is hit and the target counts as clear.
export function covered(el: Element, r: DOMRect): boolean {
  if (typeof document.elementFromPoint !== 'function') return false;
  const x = Math.min(Math.max(r.left + r.width / 2, 0), window.innerWidth - 1);
  const y = Math.min(Math.max(r.top + r.height / 2, 0), window.innerHeight - 1);
  const hit = document.elementFromPoint(x, y);
  return (
    hit !== null &&
    hit !== el &&
    !el.contains(hit) &&
    !hit.contains(el) &&
    hit.closest(STRIP_LAYER) === null
  );
}

// The first of `selectors` drawn on screen and not covered, read again at every measure, so the ring moves on as the
// page changes.
export function firstDrawn(selectors: readonly string[]): DOMRect | null {
  for (const s of selectors) {
    const el = document.querySelector(s);
    const r = el?.getBoundingClientRect();
    if (el && r && (r.width > 0 || r.height > 0) && !covered(el, r)) return r;
  }
  return null;
}
