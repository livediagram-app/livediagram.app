// Mirror's merge on release (docs/specs/007-editor/logo-pages.md "Mirror"): a drawing and its twins
// become one element. An area (a shape, a closed path, a closed stroke) is united with its twin
// into one path, two islands where they do not touch; an open line (a path, a pencil or marker
// stroke) becomes one path of two open contours in the line's colour and width, so Tidy Up can
// still take it. The result keeps the drawn element's id, so what
// the draw selected stays selected. Pure, and at once: the union needs the engine already loaded
// (Mirror preloads it); without it, null, and the pair stays two elements.
import {
  freehandCanvasPoints,
  pathOfContours,
  pathWorldAnchors,
  pathContours,
  type BoxedElement,
  type FreehandElement,
  type PathAnchor,
} from '@livediagram/document';
import { combineElementsNow } from './combine/combine';
import { simplifyLine } from './simplify-line';
import { lineStyle } from './stroke-tidy';
import { isCombinable } from './combine/outline';

// A stroke's points become corners no further than this from the drawn line, in canvas px.
const STROKE_TOLERANCE_PX = 0.75;

// An open stroke as corner anchors in canvas px.
function strokeAnchors(el: FreehandElement): PathAnchor[] {
  return simplifyLine(freehandCanvasPoints(el), STROKE_TOLERANCE_PX).map((p) => ({
    x: p.x,
    y: p.y,
    mode: 'corner' as const,
  }));
}

// An open line's contours in canvas px, rotation applied.
function lineContours(el: BoxedElement): PathAnchor[][] | null {
  if (el.type === 'path' && !el.closed)
    return pathContours(el).map((nodes) => pathWorldAnchors(el, nodes));
  // A marker's stroke joins as a line too (in its colour and width), so it stays tidyable.
  if (el.type === 'freehand' && !el.closed && el.pen !== 'highlighter') return [strokeAnchors(el)];
  return null;
}

/** The drawing and its twins as one element (with the drawing's id), or null to keep them all. */
export function mergeWithTwins(
  el: BoxedElement,
  twins: readonly BoxedElement[],
): BoxedElement | null {
  const all = [el, ...twins];
  const lines = all.map(lineContours);
  if (lines.every((l): l is PathAnchor[][] => l !== null)) {
    return pathOfContours(
      { id: el.id, type: 'path', closed: false, ...lineStyle(el) },
      lines.flat(),
    );
  }
  if (all.every(isCombinable)) {
    const r = combineElementsNow(all, 'unite', el.id);
    return r?.ok ? r.path : null;
  }
  return null;
}

/** The drawing and one twin as one element, or null to keep both. */
export const mergeWithTwin = (el: BoxedElement, twin: BoxedElement) => mergeWithTwins(el, [twin]);
