'use client';

// Hover tracking for the chart-family marks (pie slices / bars). Holds the
// hovered datum index and hands each mark the props that drive it: the chart
// <svg> is pointer-events-none so move/drag bubble to the element wrapper, and
// each mark re-enables pointer events for itself to register hover. Shared by
// PieChartView + BarChartView so the tooltip wiring stays in lockstep.

import { useState } from 'react';

export function useChartHover() {
  const [hover, setHover] = useState<number | null>(null);
  const markProps = (i: number) => ({
    style: { pointerEvents: 'auto' as const },
    onPointerEnter: () => setHover(i),
    onPointerLeave: () => setHover((prev) => (prev === i ? null : prev)),
  });
  return { hover, markProps };
}
