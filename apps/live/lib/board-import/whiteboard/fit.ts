// Fitting a board into one tab (docs/specs/020-import-export/blueprints/whiteboard-import.md "Simplify and fit"):
// strokes are simplified to within a fraction of a pixel, then, only when the
// board would not fit the tab's byte budget, progressively coarser. A board
// that still does not fit (or has more elements than a tab holds) is refused,
// never cut short.

import {
  createFreehand,
  simplifyPolyline,
  type Element,
  type FreehandElement,
} from '@livediagram/diagram';
import {
  WHITEBOARD_POINT_DECIMALS,
  WHITEBOARD_SIMPLIFY_GROWTH,
  WHITEBOARD_SIMPLIFY_ROUNDS,
  WHITEBOARD_SIMPLIFY_TOLERANCE_PX,
} from './limits';
import type { Point } from './matrix';

/** A stroke before simplification: its board-px points and the element fields it carries. */
export type StrokeDraft = {
  raw: Point[];
  closed: boolean;
  props: Omit<Partial<FreehandElement>, 'id' | 'type' | 'x' | 'y' | 'width' | 'height' | 'points'>;
};

const SCALE = 10 ** WHITEBOARD_POINT_DECIMALS;
const round = (n: number) => Math.round(n * SCALE) / SCALE;

export const isStrokeDraft = (item: Element | StrokeDraft): item is StrokeDraft =>
  'raw' in item && Array.isArray(item.raw);

/** One stroke at a tolerance: simplified, normalised to its box, rounded. */
export function buildStroke(draft: StrokeDraft, tolerancePx: number): FreehandElement {
  const simplified = simplifyPolyline(draft.raw, tolerancePx);
  const base = createFreehand(simplified, draft.closed);
  return {
    ...base,
    ...draft.props,
    points: base.points.map((p) => ({ nx: round(p.nx), ny: round(p.ny) })),
  };
}

const utf8Bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

export type FitResult = { ok: true; elements: Element[]; rounds: number } | { ok: false };

/** The board's elements at the finest detail that fits the tab, or a refusal. */
export function fitToTab(
  items: (Element | StrokeDraft)[],
  limits: { bytesBudget: number; maxElements: number },
): FitResult {
  if (items.length > limits.maxElements) return { ok: false };
  let tolerance = WHITEBOARD_SIMPLIFY_TOLERANCE_PX;
  for (let round = 1; round <= WHITEBOARD_SIMPLIFY_ROUNDS; round++) {
    const elements = items.map((item) =>
      isStrokeDraft(item) ? buildStroke(item, tolerance) : item,
    );
    const bytes = utf8Bytes(elements);
    console.info('[whiteboard-import]', 'fit', { round, tolerance, bytes });
    if (bytes <= limits.bytesBudget) return { ok: true, elements, rounds: round };
    // A board with no strokes cannot shrink by simplifying.
    if (!items.some(isStrokeDraft)) break;
    tolerance *= WHITEBOARD_SIMPLIFY_GROWTH;
  }
  return { ok: false };
}
