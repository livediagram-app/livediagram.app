// A marker loop the Fill tool closed (docs/specs/023-draw-mode/fill-tool.md "What a press fills" and
// "After a fill"): which strokes are loops, the loop closed and filled as the same element, and the fill
// a closed pen stroke draws under its ink. The geometry is shared with livedesign
// (@liveworkspace/model-core/stroke-loop); this file binds it to the freehand element.
import { closeStrokeLoop, isStrokeLoop, loopFillPath } from '@liveworkspace/model-core/stroke-loop';
import type { FreehandElement } from './element-types';
import { freehandCanvasPoints, freehandStrokePoints, packFreehandPoints } from './freehand-points';
import { freehandPenStroke, isPenStroke, penStrokeCentreline } from './pen-stroke';

/** Whether the fill paints anything: a colour that is not "no fill". */
export function isVisibleFill(fill: string | undefined): fill is string {
  return fill !== undefined && fill !== '' && fill !== 'transparent' && fill !== 'none';
}

/** A closed pen stroke with a fill: drawn as its fill under its ink, picked by both. */
export function isFilledPenLoop(el: FreehandElement): boolean {
  return isPenStroke(el) && el.closed && isVisibleFill(el.fillColor);
}

/** An open marker stroke whose ends meet round something: the Fill tool closes it. */
export function isOpenMarkerLoop(el: FreehandElement): boolean {
  // A pen stroke always records its width (isPenStroke).
  return isPenStroke(el) && !el.closed && isStrokeLoop(freehandCanvasPoints(el), el.penWidth!);
}

/**
 * The marker loop closed and filled: the same element (id, ink, layer, comments and the rest), its
 * first point added at its end where the ends did not touch, so the ink closes the outline. The box
 * is the points' own, so rotation keeps its centre.
 */
export function fillStrokeLoop(el: FreehandElement, fillColor: string): FreehandElement {
  const { pressures } = freehandStrokePoints(el);
  const closed = closeStrokeLoop(freehandCanvasPoints(el), pressures);
  return { ...el, ...packFreehandPoints(closed.points, closed.pressures), closed: true, fillColor };
}

/** The fill a closed pen stroke draws under its ink, in canvas px: its streamlined centre line. */
export function penLoopFillPath(
  el: Pick<
    FreehandElement,
    'x' | 'y' | 'width' | 'height' | 'packedPoints' | 'penWidth' | 'streamline'
  >,
  fmt?: (n: number) => number,
): string {
  return loopFillPath(penStrokeCentreline(freehandPenStroke(el, { x: el.x, y: el.y })), fmt);
}
