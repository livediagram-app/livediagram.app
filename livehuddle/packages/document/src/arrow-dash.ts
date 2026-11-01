// Where an arrow's dashes start (docs/specs/008-canvas/arrow-anchors.md "End at exact anchor"): a pattern runs from the path's
// start, so arrows sharing an end (graph input's bus, `exactEnd`: four services' dashed "publish" lines into one Kafka)
// met it each at its own phase, and their shared stretch drew as several dash patterns over each other, a thick blur,
// not one line. Such an arrow's pattern is anchored at its end instead, so every arrow into the bus is in step along it.
// Both renderers read it, the canvas's ArrowView and the export's svgArrow.

import { arrowPathPolyline } from './arrow-path';
import { arrowStyleOf } from './arrow-style';
import { BORDER_DASH_ARRAY } from '@liveworkspace/model-core/border-style';
import type { ArrowElement } from './index';

// The stroke-dashoffset that puts the dash pattern's start at the arrow's end, or undefined: a solid line, or one
// whose end is its own.
export function arrowDashOffset(
  arrow: ArrowElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
): number | undefined {
  const dash = BORDER_DASH_ARRAY[arrow.strokeStyle ?? 'solid'];
  if (!dash || !arrow.exactEnd) return undefined;
  const period = dash.split(/\s+/).reduce((s, n) => s + Number(n), 0);
  const pts = arrowPathPolyline(
    arrowStyleOf(arrow),
    from,
    to,
    arrow.from,
    arrow.to,
    arrow.curveOffset,
    arrow.elbowOffset,
    arrow.curvePoints,
  );
  const length = pts
    .slice(1)
    .reduce((s, p, i) => s + Math.hypot(p.x - pts[i]!.x, p.y - pts[i]!.y), 0);
  return Math.round(((period - (length % period)) % period) * 100) / 100;
}
