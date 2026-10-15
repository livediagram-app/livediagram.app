'use client';

// A slot added to a Dashboard settles into place (docs/specs/026-plan/plan-tabs.md "Dashboard tab"): it fades up from
// a little low and a little small, as a dialog does, at the long motion token; a row of new slots cascades left to
// right. Only once the page is up (DashboardPage marks it `data-dashboard-ready`), so opening a Dashboard draws it
// still; never under reduced motion. Driven from a layout effect with the Web Animations API, so it runs on the
// slot's first frame and costs nothing after.
import { useLayoutEffect, type RefObject } from 'react';
import { MOTION_MS, cascadeDelayMs } from '@livediagram/tailwind-config/motion';
import { prefersReducedMotion } from '@/lib/motion-preference';

export const SLOT_ENTER_KEYFRAMES: Keyframe[] = [
  { opacity: 0, transform: 'translateY(8px) scale(0.96)' },
  { opacity: 1, transform: 'none' },
];
export const SLOT_ENTER_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

export function useSlotEnter(ref: RefObject<HTMLElement | null>, index: number) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') return;
    if (!el.closest('[data-dashboard-ready]') || prefersReducedMotion()) return;
    // A cascade item runs at micro after its delay, so the row lands by the motion ceiling.
    const delay = cascadeDelayMs(index);
    el.animate(SLOT_ENTER_KEYFRAMES, {
      duration: delay > 0 ? MOTION_MS.micro : MOTION_MS.long,
      delay,
      easing: SLOT_ENTER_EASING,
      fill: 'backwards',
    });
    // Mount only: a slot that stays put never animates again.
    // oxlint-disable-next-line react-hooks-js/exhaustive-deps
  }, []);
}
