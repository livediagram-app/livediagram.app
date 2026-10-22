'use client';

import { useEffect, useRef } from 'react';
import { haptic } from '@/lib/haptics';

// A tick when a drag catches an alignment snap (lib/haptics): on the change from no guide to a
// guide, not on every frame a guide stays up, so a slow drag along a line ticks once.
export function useSnapHaptic(snapped: boolean): void {
  const was = useRef(false);
  useEffect(() => {
    if (snapped && !was.current) haptic('snap');
    was.current = snapped;
  }, [snapped]);
}
