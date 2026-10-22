import { useMemo } from 'react';
import {
  arrowheadShapeOf,
  arrowheadSizeOf,
  finishArrowWidthPx,
  handDrawnArrow,
  type ArrowElement,
  type HandDrawnArrow,
} from '@livedocuments/document';
import { useElementFinish } from './CanvasFinishContext';

// An arrow in its finish on the canvas (docs/specs/008-canvas/finish.md): Professional thins an arrow that
// sets no width, Marker draws it at a marker's nib, and Sketch and Marker draw its line and its triangle / line heads
// by hand. The same rules as the export's svgArrow (packages/document/src/svg-render-arrows.ts), so the canvas and a
// download agree.

type ArrowFinishPaint = {
  /** The line's width before the selected-state bump, px. */
  baseStrokeWidth: number;
  /** The hand-drawn line and heads, or null when the arrow draws as a plain path. */
  sketch: HandDrawnArrow | null;
};

export function useArrowFinish(arrow: ArrowElement, pathD: string): ArrowFinishPaint {
  const finish = useElementFinish(arrow.finish);
  const baseStrokeWidth = finishArrowWidthPx(arrow.strokeWidth, finish);
  const headShape = arrowheadShapeOf(arrow);
  const headSize = arrowheadSizeOf(arrow);
  const ends = arrow.arrowEnds ?? 'to';
  // A flowing line keeps one stroke, so its dash and draw maths still read as one line.
  const flowing = !!arrow.flow;
  // Memoised on the path and what shapes the heads, never on the selection, so selecting or relabelling an
  // arrow redraws nothing (docs/specs/008-canvas/canvas-performance.md).
  const sketch = useMemo(
    () =>
      handDrawnArrow(finish, arrow.id, pathD, {
        strokePx: baseStrokeWidth,
        headSize,
        headShape,
        startHead: ends === 'from' || ends === 'both',
        endHead: ends === 'to' || ends === 'both',
        flowing,
      }),
    [finish, arrow.id, pathD, baseStrokeWidth, headSize, headShape, ends, flowing],
  );
  return { baseStrokeWidth, sketch };
}
