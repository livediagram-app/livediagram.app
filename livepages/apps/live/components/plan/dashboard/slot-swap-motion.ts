'use client';

// A phone's Move Up and Move Down glide (docs/specs/026-plan/plan-tabs.md "Dashboard on a phone"): the two slots swap
// what they hold, and each card slides from where the other was to its own place over the long motion token, the one
// that moved drawn above the one it passes, so the eye follows it rather than seeing two cards blink. The moved slot is
// then brought into view. Measured before the swap (FLIP) and played with the Web Animations API on the frame the
// swap draws, so it costs two rects and two animations a tap; under reduced motion the swap is instant.
import { MOTION_MS } from '@livepages/tailwind-config/motion';
import { prefersReducedMotion } from '@/lib/motion-preference';
import { SLOT_ENTER_EASING } from './useSlotEnter';

const slotEl = (id: string) =>
  document.querySelector<HTMLElement>(`[data-dashboard-slot="${CSS.escape(id)}"]`);

function glide(el: HTMLElement, dx: number, dy: number, above: boolean) {
  const z = above ? 2 : 1;
  el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px)`, zIndex: z },
      { transform: 'none', zIndex: z },
    ],
    { duration: MOTION_MS.long, easing: SLOT_ENTER_EASING },
  );
}

// Swaps the slot `fromId` with `toId` by `apply`, gliding both cards; `fromId`'s content ends in `toId`'s slot.
export function swapSlotsWithMotion(fromId: string, toId: string, apply: () => void) {
  const from = slotEl(fromId);
  const to = slotEl(toId);
  const still = prefersReducedMotion() || !from || !to || typeof from.animate !== 'function';
  const a = still ? null : from.getBoundingClientRect();
  const b = still ? null : to.getBoundingClientRect();
  apply();
  // On the frame the swap draws: React has committed the new layout by then.
  requestAnimationFrame(() => {
    const moved = slotEl(toId);
    const other = slotEl(fromId);
    if (a && b && moved && other) {
      glide(moved, a.left - b.left, a.top - b.top, true);
      glide(other, b.left - a.left, b.top - a.top, false);
    }
    moved?.scrollIntoView?.({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
  });
}
