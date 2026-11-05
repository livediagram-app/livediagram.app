import type { Element } from '@livehuddle/document';

// The element under a walking click (docs/specs/008-canvas/avatar-mode.md "Clicking a piece"). While walking the
// canvas layer is pointer-inert, so the DOM cannot say what a click landed on unless it hit a face's own button: the
// topmost element whose box, turned by its rotation, holds the click's canvas point is the one clicked. One pass over
// the tab's elements per click (later elements draw on top), never per frame.

type Point = { x: number; y: number };

/**
 * The topmost boxed element under a canvas point, or null for the bare floor. Arrows have no box and never hit.
 * `painted` can turn down a box the point is inside but nothing is drawn at (a text's empty run past its words), so
 * the click goes to whatever is under it.
 */
export function elementAt(
  elements: readonly Element[],
  point: Point,
  painted: (el: Element) => boolean = () => true,
): Element | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]!;
    if (el.type === 'arrow') continue;
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const r = (((el as { rotation?: number }).rotation ?? 0) * Math.PI) / 180;
    const dx = point.x - cx;
    const dy = point.y - cy;
    const lx = dx * Math.cos(r) + dy * Math.sin(r);
    const ly = -dx * Math.sin(r) + dy * Math.cos(r);
    if (Math.abs(lx) <= el.width / 2 && Math.abs(ly) <= el.height / 2 && painted(el)) return el;
  }
  return null;
}

// How far round a line of words a click still counts as on it, in screen px.
const WORDS_PAD = 6;

/**
 * Whether a screen point is on a text element's painted words. A text box is often far wider than its words (a
 * template's subtitle runs the board's width with a short left-aligned line), and a click on the empty run is a click
 * on the floor. Reads the rendered lines of the element's text nodes, so it matches what is drawn at any zoom or
 * rotation's bounds; with no node or no layout (a test), the box stands. Runs only for a text under a click.
 */
export function onPaintedText(elementId: string, clientX: number, clientY: number): boolean {
  if (typeof document === 'undefined') return true;
  const node = document.querySelector(`[data-element-id="${CSS.escape(elementId)}"]`);
  if (!node || typeof document.createRange !== 'function') return true;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let measured = false;
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    if (!text.textContent?.trim()) continue;
    range.selectNodeContents(text);
    if (typeof range.getClientRects !== 'function') return true;
    for (const r of range.getClientRects()) {
      measured = true;
      if (
        clientX >= r.left - WORDS_PAD &&
        clientX <= r.right + WORDS_PAD &&
        clientY >= r.top - WORDS_PAD &&
        clientY <= r.bottom + WORDS_PAD
      )
        return true;
    }
  }
  return !measured;
}
