'use client';

// Hover tracking for the chart-family marks. Holds the hovered datum key and
// hands each mark the props that drive it: the chart <svg> is
// pointer-events-none so move/drag bubble to the element wrapper, and each mark
// re-enables pointer events for itself to register hover. The key is generic so
// pie / bar use a numeric index while line uses a { series, point } pair; pass
// `eq` for non-primitive keys (the default Object.is suits the numeric case).
// Shared by PieChartView / BarChartView / LineChartView so the wiring stays in
// lockstep.

import { useState } from 'react';

export function useChartHover<T>(eq: (a: T, b: T) => boolean = Object.is) {
  const [hover, setHover] = useState<T | null>(null);
  const markProps = (key: T) => ({
    style: { pointerEvents: 'auto' as const },
    onPointerEnter: () => setHover(key),
    onPointerLeave: () => setHover((prev) => (prev !== null && eq(prev, key) ? null : prev)),
  });
  return { hover, markProps };
}
