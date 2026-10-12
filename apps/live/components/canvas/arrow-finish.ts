import { useMemo } from 'react';
import {
  ARROW_THICKNESS_PX,
  arrowheadShapeOf,
  arrowheadSizeOf,
  sketchArrow,
  type ArrowElement,
} from '@livediagram/document';
import { useElementFinish } from './CanvasFinishContext';

// An arrow in its finish on the canvas (docs/specs/008-canvas/finish.md): Professional thins an arrow that
// sets no width, Sketch draws its line and its triangle / line heads by hand. The same rules as the export's
// svgArrow (packages/document/src/svg-render-arrows.ts), so the canvas and a download agree.

export type ArrowFinishPaint = {
  /** The line's width before the selected-state bump, px. */
  baseStrokeWidth: number;
  /** The sketched line and heads, or null when the arrow draws as a plain path. */
  sketch: ReturnType<typeof sketchArrow>;
};

export function useArrowFinish(arrow: ArrowElement, pathD: string): ArrowFinishPaint {
  const finish = useElementFinish(arrow.finish);
  const baseStrokeWidth =
    arrow.strokeWidth ?? (finish === 'professional' ? ARROW_THICKNESS_PX.thin : 2);
  const headShape = arrowheadShapeOf(arrow);
  const headSize = arrowheadSizeOf(arrow);
  const ends = arrow.arrowEnds ?? 'to';
  // A flowing line keeps one pass, so its dash and draw maths still read as one stroke.
  const passes = arrow.flow ? 1 : 2;
  // Memoised on the path and what shapes the heads, never on the selection, so selecting or relabelling an
  // arrow redraws nothing (docs/specs/008-canvas/canvas-performance.md).
  const sketch = useMemo(
    () =>
      finish === 'sketch'
        ? sketchArrow(arrow.id, pathD, {
            strokePx: baseStrokeWidth,
            headSize,
            headShape,
            startHead: ends === 'from' || ends === 'both',
            endHead: ends === 'to' || ends === 'both',
            passes,
          })
        : null,
    [finish, arrow.id, pathD, baseStrokeWidth, headSize, headShape, ends, passes],
  );
  return { baseStrokeWidth, sketch };
}
