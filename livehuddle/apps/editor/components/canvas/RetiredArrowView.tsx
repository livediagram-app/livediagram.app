'use client';

// A retired arrow on the canvas (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4;
// docs/specs/002-project-scope/blueprints/element-engine.md D21): a stored arrow or line draws as a faint dashed
// straight line between its resolved ends, with the placeholder card (RETIRED_ARROW_CARD_WIDTH by _HEIGHT) centred on
// the line's middle. The line takes no press. The card is drawn by the boxed element view, as every retired element's
// placeholder is (lib/retired-arrow-card), so it selects, takes comments, shows its indicators, opens the context menu and holds an Editor's
// Delete button the same way; it never moves or resizes, and a press on it only selects. Nothing here writes to the
// arrow: its ends are worked out each time it is drawn (retiredArrowEnds), so a pinned end follows its element.

import { memo, useMemo, type ComponentProps, type PointerEvent as ReactPointerEvent } from 'react';
import {
  RETIRED_ARROW_DASH,
  RETIRED_ARROW_OPACITY,
  RETIRED_ARROW_STROKE_WIDTH,
  RETIRED_PLACEHOLDER_COLOURS,
  type Point,
  type RetiredArrowElement,
} from '@livehuddle/document';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { SelectableBoxedView } from '@/components/canvas/selection-aware-views';
import { retiredArrowCardElement } from '@/lib/retired-arrow-card';

type CardViewProps = ComponentProps<typeof SelectableBoxedView>;

export type RetiredArrowViewProps = Omit<
  CardViewProps,
  'element' | 'onBeginDrag' | 'movable' | 'resizable'
> & {
  arrow: RetiredArrowElement;
  // Where its ends resolve to now (retiredArrowEnds), against the board or a drag preview.
  ends: { from: Point; to: Point };
  // The card's press: selects it (useCanvasSelectHandlers' handleArrowSelect), never a drag.
  onSelect: (id: string, e: ReactPointerEvent, paired?: boolean) => void;
};

/** Props equal for drawing: every prop by identity, except the ends, which compare by value. The list works the ends
 *  out afresh each time it walks the board, so by identity every arrow would draw again for any edit anywhere. */
export function retiredArrowViewPropsEqual(
  prev: RetiredArrowViewProps,
  next: RetiredArrowViewProps,
): boolean {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]) as Set<
    keyof RetiredArrowViewProps
  >;
  for (const key of keys) {
    if (key === 'ends') continue;
    if (!Object.is(prev[key], next[key])) return false;
  }
  const a = prev.ends;
  const b = next.ends;
  return a.from.x === b.from.x && a.from.y === b.from.y && a.to.x === b.to.x && a.to.y === b.to.y;
}

export const RetiredArrowView = memo(function RetiredArrowView({
  arrow,
  ends,
  onSelect,
  layerOpacity,
  ...cardProps
}: RetiredArrowViewProps) {
  const colours = RETIRED_PLACEHOLDER_COLOURS[useCanvasSurface()];
  const { from, to } = ends;
  // By value: a fresh ends object each render must not hand the card view a new element.
  const { x: fromX, y: fromY } = from;
  const { x: toX, y: toY } = to;
  const card = useMemo(
    () => retiredArrowCardElement(arrow, { from: { x: fromX, y: fromY }, to: { x: toX, y: toY } }),
    [arrow, fromX, fromY, toX, toY],
  );
  const opacity = (arrow.opacity ?? 1) * (layerOpacity ?? 1);
  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        data-retired-arrow={arrow.id}
        aria-hidden
        style={{ overflow: 'visible', ...(opacity < 1 ? { opacity } : {}) }}
      >
        <line
          data-retired-arrow-line=""
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={colours.stroke}
          strokeWidth={RETIRED_ARROW_STROKE_WIDTH}
          strokeDasharray={RETIRED_ARROW_DASH}
          strokeOpacity={RETIRED_ARROW_OPACITY}
          fill="none"
        />
      </svg>
      <SelectableBoxedView
        {...cardProps}
        element={card}
        layerOpacity={layerOpacity}
        movable={false}
        resizable={false}
        // A press selects the card alone; nothing drags it (D21). The card view has already settled what a press
        // on a selected card or a Shift press means (its click and Shift rules), so this only selects.
        onBeginDrag={(id, _mode, e) => {
          if (!e.shiftKey) onSelect(id, e, true);
        }}
      />
    </>
  );
}, retiredArrowViewPropsEqual);
