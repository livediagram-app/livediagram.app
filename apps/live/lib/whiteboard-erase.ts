// One step of the whiteboard eraser (docs/specs/023-draw-mode/draw-mode.md "Eraser"): a brush of radius
// `r` swept from `a` to `b`, in canvas coords. Stroke mode removes the strokes
// whose INK the brush crosses, and the shapes whose drawn outline or visible fill
// it touches (shape-hit.ts, the same outline selecting picks by); Partial cuts strokes. Everything else is the
// gesture's business (checkpoint, cascade): these are pure.
import {
  arrowReferencesAny,
  endpointPosition,
  eraseStrokePart,
  pathTouchesBrush,
  shapeTouchesBrush,
  strokeTouchesBrush,
  type ArrowElement,
  type Element,
  type Endpoint,
  type FreehandElement,
  type ShapeElement,
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
 * (docs/specs/023-draw-mode/path-tool.md "Selecting and erasing").
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

/**
 * Ids of the unprotected shapes the brush touches where they are drawn: along their
 * outline, or on a visible fill (docs/specs/023-draw-mode/draw-mode.md "Eraser").
 */
export function shapesTouched(
  elements: readonly Element[],
  a: Point,
  b: Point,
  r: number,
  isProtected: (el: Element) => boolean,
): string[] {
  return elements
    .filter(
      (el): el is ShapeElement =>
        el.type === 'shape' && !isProtected(el) && shapeTouchesBrush(el, a, b, r),
    )
    .map((el) => el.id);
}

/**
 * The element list with every touched stroke cut, or null when nothing changed. Arrows pinned to a
 * cut stroke follow it in the same step (docs/specs/023-draw-mode/draw-mode.md "Eraser"): a stroke
 * erased whole takes its unprotected pinned arrows with it, as Stroke mode does; a stroke split into
 * pieces turns each end pinned to it into a free end where it was drawn, so no arrow is left pinned
 * to an id that no longer exists.
 */
export function partialEraseStep(
  elements: readonly Element[],
  a: Point,
  b: Point,
  r: number,
  isProtected: (el: Element) => boolean,
  mintId: () => string,
): Element[] | null {
  // Strokes cut this step, by id: erased whole (no pieces) or split (the original, to resolve the
  // ends pinned to it).
  const gone = new Set<string>();
  const split = new Map<string, Element>();
  const out = elements.flatMap((el) => {
    if (el.type !== 'freehand' || isProtected(el)) return [el];
    const pieces = eraseStrokePart(el, a, b, r, mintId);
    if (pieces === null) return [el];
    if (pieces.length === 0) gone.add(el.id);
    else split.set(el.id, el);
    return pieces;
  });
  if (gone.size === 0 && split.size === 0) return null;
  return out.flatMap((el) => {
    if (el.type !== 'arrow') return [el];
    if (gone.size > 0 && !isProtected(el) && arrowReferencesAny(el, gone)) return [];
    if (split.size === 0) return [el];
    return [unpinFrom(el, split)];
  });
}

// `arrow` with every end pinned to one of `split` turned free at the spot it resolved to.
function unpinFrom(arrow: ArrowElement, split: ReadonlyMap<string, Element>): ArrowElement {
  const free = (end: Endpoint): Endpoint =>
    end.kind === 'pinned' && split.has(end.elementId)
      ? { kind: 'free', ...endpointPosition(end, split) }
      : end;
  const from = free(arrow.from);
  const to = free(arrow.to);
  return from === arrow.from && to === arrow.to ? arrow : { ...arrow, from, to };
}
