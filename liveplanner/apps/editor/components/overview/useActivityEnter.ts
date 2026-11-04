'use client';

// Recent Activity's entrance (docs/specs/026-plan/plan-overview.md "Recent Activity" Motion): when the Overview opens,
// and when See All shows more, the entries fan in, each fading and rising a few pixels one beat after the one above;
// an entry that arrives while the page is open slides down in at the top. Driven from a layout effect with the Web
// Animations API on the entry's first frame, opacity and transform only, never under reduced motion. The cascade
// keeps the motion budget (docs/specs/004-interface-design/motion.md): each entry runs at `micro` and its delay
// stops growing at the cascade cap, so the last lands by the 250ms ceiling.
import { useLayoutEffect, type RefObject } from 'react';
import { MOTION_CASCADE_CAP_MS, MOTION_MS } from '@liveworkspace/style-guards/motion';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import { ACTIVITY_SHOWN } from './overview-activity';

// The beat between two entries: the first eight spread across the cascade cap.
export const ACTIVITY_ENTER_STEP_MS = Math.floor(MOTION_CASCADE_CAP_MS / (ACTIVITY_SHOWN - 1));

const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const FAN_IN: Keyframe[] = [
  { opacity: 0, transform: 'translateY(6px) scale(0.98)' },
  { opacity: 1, transform: 'none' },
];
const ARRIVE: Keyframe[] = [
  { opacity: 0, transform: 'translateY(-8px)' },
  { opacity: 1, transform: 'none' },
];

export type ActivityEnter = { keyframes: Keyframe[]; duration: number; delay: number };

// How the entry at `index` (0 the newest shown) enters. `late` is whether the list was already on screen when it
// mounted: then it was either revealed by See All (below the first eight, fanning in from the first of them) or
// is new, at the top.
export function activityEnterOf(index: number, late: boolean): ActivityEnter {
  if (late && index < ACTIVITY_SHOWN)
    return { keyframes: ARRIVE, duration: MOTION_MS.short, delay: 0 };
  const beat = late ? index - ACTIVITY_SHOWN : index;
  return {
    keyframes: FAN_IN,
    duration: MOTION_MS.micro,
    delay: Math.min(Math.max(0, beat) * ACTIVITY_ENTER_STEP_MS, MOTION_CASCADE_CAP_MS),
  };
}

export function useActivityEnter(
  ref: RefObject<HTMLElement | null>,
  index: number,
  listShown: RefObject<boolean>,
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function' || prefersReducedMotion()) return;
    const { keyframes, duration, delay } = activityEnterOf(index, listShown.current);
    el.animate(keyframes, { duration, delay, easing: EASE_OUT, fill: 'backwards' });
    // Mount only: an entry that stays put never animates again.
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);
}
