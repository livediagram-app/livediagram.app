'use client';

import { useEffect, type RefObject } from 'react';
import {
  countFrame,
  parseCountable,
  STAT_COUNT_DELAY_MS,
  STAT_COUNT_MS,
} from '@livedocuments/document';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';

// A stat's count-up (docs/specs/009-elements/stat-row.md "Count-up when presented"): while `active`, the value counts
// up from zero over STAT_COUNT_MS, written straight into `ref`'s text so React never renders a frame of it. It plays
// when `active` turns on (a slide mounting while presenting, or Present starting), and not at all for a value that
// does not read as a number or under reduced motion. Any exit (unmount, `active` off, a new value) lands the value.
export function useCountUp(ref: RefObject<HTMLElement | null>, value: string, active: boolean) {
  useEffect(() => {
    const node = ref.current;
    if (!node || !active) return;
    const countable = parseCountable(value);
    if (!countable || prefersReducedMotion()) return;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now + STAT_COUNT_DELAY_MS;
      const t = Math.max(0, now - start) / STAT_COUNT_MS;
      if (t >= 1) {
        node.textContent = value;
        return;
      }
      node.textContent = countFrame(countable, t);
      frame = requestAnimationFrame(tick);
    };
    node.textContent = countFrame(countable, 0);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      node.textContent = value;
    };
  }, [ref, value, active]);
}
