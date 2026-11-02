// Where an arrow's ends are drawn: its stored ends, each nudged along the face it meets by the converging-fan offset
// (arrow-endpoint-spread.ts). Pure, read by the canvas and every export so the two agree.

import type { ArrowElement, Element } from './index';
import { arrowEndpointSpread } from './arrow-endpoint-spread';
import { endpointPosition, type ElementIndex, type Point } from './geometry';

/** The arrow as drawn and its two ends. */
export function finishArrowEnds(
  arrow: ArrowElement,
  elements: Element[] | ElementIndex,
): { arrow: ArrowElement; from: Point; to: Point } {
  const from = endpointPosition(arrow.from, elements);
  const to = endpointPosition(arrow.to, elements);
  const fromSpread = arrowEndpointSpread(arrow.id, 'from', elements);
  const toSpread = arrowEndpointSpread(arrow.id, 'to', elements);
  return {
    arrow,
    from: { x: from.x + fromSpread.x, y: from.y + fromSpread.y },
    to: { x: to.x + toSpread.x, y: to.y + toSpread.y },
  };
}
