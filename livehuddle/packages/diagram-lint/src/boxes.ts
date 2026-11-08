// What the lint calls a box (blueprint "The checks", LN2).

import { type BoxedElement, type Element, isBoxed, isRetiredBackdrop } from '@livehuddle/document';

const NOT_BOXES: ReadonlySet<string> = new Set(['text', 'annotation', 'freehand', 'path']);

const finite = (el: BoxedElement) =>
  [el.x, el.y, el.width, el.height].every((v) => Number.isFinite(v));

// A boxed element that is not text, an annotation, a stroke, a path or a stored backdrop, with a usable rect (LN2). A
// stored lane, stack, boundary or frame paints at the back with boxes drawn over it by design
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3).
export function isLintBox(el: Element): el is BoxedElement {
  return isBoxed(el) && !isRetiredBackdrop(el) && !NOT_BOXES.has(el.type) && finite(el);
}
