// One step of the whiteboard eraser (docs/specs/023-whiteboard/whiteboard.md "Eraser"): a brush of radius
// `r` swept from `a` to `b`, in canvas coords. Stroke mode removes the strokes
// whose INK the brush crosses; Partial cuts them. Everything else is the
// gesture's business (checkpoint, cascade, activity entry): these are pure.
import {
  eraseStrokePart,
  pathTouchesBrush,
  strokeTouchesBrush,
  type Element,
  type FreehandElement,
} from '@livediagram/document';

type Point = { x: number; y: number };

/** Ids of the unprotected strokes the brush touches. */
export function strokesTouched(
  elements: readonly Element[],
  a: Point,
  b: Point,
  r: number,
  isProtected: (el: Element) => boolean,
): string[] {
  return elements
    .filter(
      (el): el is FreehandElement =>
        el.type === 'freehand' && !isProtected(el) && strokeTouchesBrush(el, a, b, r),
    )
    .map((el) => el.id);
}

/**
 * Ids of the unprotected paths the brush touches: a path is erased whole in either mode
 * (docs/specs/023-whiteboard/path-tool.md "Selecting and erasing").
 */
export function pathsTouched(
  elements: readonly Element[],
  a: Point,
  b: Point,
  r: number,
  isProtected: (el: Element) => boolean,
): string[] {
  return elements
    .filter((el) => el.type === 'path' && !isProtected(el) && pathTouchesBrush(el, a, b, r))
    .map((el) => el.id);
}

/** The element list with every touched stroke cut, or null when nothing changed. */
export function partialEraseStep(
  elements: readonly Element[],
  a: Point,
  b: Point,
  r: number,
  isProtected: (el: Element) => boolean,
  mintId: () => string,
): Element[] | null {
  let changed = false;
  const out = elements.flatMap((el) => {
    if (el.type !== 'freehand' || isProtected(el)) return [el];
    const pieces = eraseStrokePart(el, a, b, r, mintId);
    if (pieces === null) return [el];
    changed = true;
    return pieces;
  });
  return changed ? out : null;
}
