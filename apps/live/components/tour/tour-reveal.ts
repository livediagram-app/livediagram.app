// Bringing a tour step's target into view (docs/specs/007-editor/editor-tour.md "Mechanics"): a target below the fold
// of a scrolling panel (a long form's Add bar, a dialog's lower section) is scrolled to before the ring lands, so the
// highlight and its popover never point off-screen. Only real scroll containers move (overflow auto or scroll), each
// by the least that shows the target: never an overflow:hidden box such as the canvas, whose pan is its own, and
// never `scrollIntoView`, which also nudges the page under the fixed header.

// The room kept between a revealed target and its scroller's edge: the ring's pad plus a little air.
export const REVEAL_MARGIN_PX = 16;

export type RevealBlock = 'nearest' | 'start';

type Box = { top: number; bottom: number; left: number; right: number };

const scrolls = (overflow: string) =>
  overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay';

// How far to scroll one axis so [from, to] sits inside [min, max]: 0 when it already does; aligned to the start when
// asked, or when it is too big to fit; else the nearest edge.
function delta(from: number, to: number, min: number, max: number, block: RevealBlock): number {
  if (block === 'start' || to - from > max - min) return from - min;
  if (from < min) return from - min;
  if (to > max) return to - max;
  return 0;
}

// The visible part of a scroller: its box, clipped to the viewport (a scroller taller than the window shows only part).
function visibleBox(node: Element): Box {
  const r = node.getBoundingClientRect();
  return {
    top: Math.max(r.top, 0),
    bottom: Math.min(r.bottom, window.innerHeight),
    left: Math.max(r.left, 0),
    right: Math.min(r.right, window.innerWidth),
  };
}

// Scrolls `el` into view within each scrolling ancestor, innermost first, then the page if it scrolls. Returns whether
// anything moved. Smooth unless motion is reduced; the engine's tracker re-measures, so the ring follows the scroll.
export function revealInScrollers(el: HTMLElement, block: RevealBlock = 'nearest'): boolean {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
  const r = el.getBoundingClientRect();
  // Where the target will be once the scrolls so far have run: a smooth scroll has not moved it yet.
  const at: Box = { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  let moved = false;
  const scrollBy = (node: Element, box: Box, canY: boolean, canX: boolean) => {
    const m = REVEAL_MARGIN_PX;
    const dy = canY ? delta(at.top, at.bottom, box.top + m, box.bottom - m, block) : 0;
    const dx = canX ? delta(at.left, at.right, box.left + m, box.right - m, 'nearest') : 0;
    if (!dy && !dx) return;
    node.scrollBy?.({ top: dy, left: dx, behavior });
    at.top -= dy;
    at.bottom -= dy;
    at.left -= dx;
    at.right -= dx;
    moved = true;
  };
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    const canY = scrolls(style.overflowY) && node.scrollHeight > node.clientHeight;
    const canX = scrolls(style.overflowX) && node.scrollWidth > node.clientWidth;
    if (canY || canX) scrollBy(node, visibleBox(node), canY, canX);
  }
  // The page, only where it scrolls for the person too (the editor pins it: a hidden overflow is left alone).
  const page = document.scrollingElement ?? document.documentElement;
  const locked = (axis: 'overflowY' | 'overflowX') =>
    [document.documentElement, document.body].some((n) =>
      /hidden|clip/.test(getComputedStyle(n)[axis]),
    );
  const canY = !locked('overflowY') && page.scrollHeight > window.innerHeight;
  const canX = !locked('overflowX') && page.scrollWidth > window.innerWidth;
  if (canY || canX) {
    const viewport = { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
    scrollBy(page, viewport, canY, canX);
  }
  return moved;
}
