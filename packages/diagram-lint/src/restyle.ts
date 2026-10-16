// A line's route in another style, for a fix to try before it suggests one: an arrow re-routed without its old bends
// (docs/specs/024-agents/blueprints/diagram-lint.md "Fixes"). A fix that suggested a style blind made things worse,
// and the next lint suggested the style back.

import {
  arrowRoutePoints,
  arrowStyleOf,
  type ArrowElement,
  type Point,
} from '@livediagram/document';
import type { LintContext } from './context';

export const RESTYLES = ['angled', 'curved', 'straight'] as const;
export type Restyle = (typeof RESTYLES)[number];

// The styles other than the arrow's own, each with the route it would draw.
export function restyledRoutes(
  ctx: LintContext,
  arrow: ArrowElement,
): { style: Restyle; route: Point[] }[] {
  return RESTYLES.filter((style) => style !== arrowStyleOf(arrow)).map((style) => {
    const { curvePoints: _bends, curveOffset: _bow, ...plain } = arrow;
    return {
      style,
      route: arrowRoutePoints({ ...plain, arrowStyle: style }, ctx.visible),
    };
  });
}
