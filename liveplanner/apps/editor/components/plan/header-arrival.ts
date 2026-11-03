import { useLayoutEffect, type CSSProperties, type RefObject } from 'react';

// A board header's fan-in (docs/specs/026-plan/plan-board.md "The header arrives laid out, then fans in"): its card
// type chips, and its widgets and the widget zone's buttons, each fading up one beat after the one before as the
// header mounts. CSS only (globals.css `--animate-header-in` with `.stagger-enter`); reduced motion collapses the
// animation and zeroes the delay.
//
// The items take the animation only while the header is marked arriving (HEADER_ARRIVING_ATTR), set on the DOM as it
// mounts and taken off once the row has landed, never through React state, so it costs no render. A browser restarts
// an element's animation whenever the element is put back in the page, which React does to a widget or chip it
// reorders; outside the arrival the items have no animation to restart, so only a mount ever plays it.

export const HEADER_ARRIVING_ATTR = 'data-header-arriving';

// How long the header stays marked: the whole cascade (at most the 250 ms ceiling) with room for a first frame that
// comes late on a heavy board, so a late start is never cut short.
export const HEADER_ARRIVAL_MS = 600;

// The beat between two items, set on the row as the cascade step; the shared 100 ms cap still holds, so the row lands
// within the 250 ms ceiling (docs/specs/004-interface-design/motion.md "Cascades").
export const HEADER_ARRIVAL_STEP = '25ms';

export const HEADER_ARRIVAL_CLASS = '[[data-header-arriving]_&]:animate-header-in stagger-enter';

// The row's own style: the beat its items stagger by.
export const headerArrivalRow: CSSProperties = {
  ['--motion-cascade-step' as string]: HEADER_ARRIVAL_STEP,
};

// The item's place in the cascade.
export function headerArrivalIndex(i: number): CSSProperties {
  return { ['--stagger-i' as string]: i };
}

// Marks the header arriving from its mount (before its first paint) for HEADER_ARRIVAL_MS.
export function useHeaderArrival(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute(HEADER_ARRIVING_ATTR, '');
    const done = window.setTimeout(
      () => el.removeAttribute(HEADER_ARRIVING_ATTR),
      HEADER_ARRIVAL_MS,
    );
    return () => {
      window.clearTimeout(done);
      el.removeAttribute(HEADER_ARRIVING_ATTR);
    };
  }, [ref]);
}
