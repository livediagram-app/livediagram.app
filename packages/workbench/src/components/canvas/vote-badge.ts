'use client';

// The vote stepper's badge fold (docs/specs/012-collaboration/session-tools.md "On a small note when zoomed out it
// folds to a badge"): the stepper keeps its size on screen, so on a small element at a zoomed-out view it would
// cover the text people are choosing between. Shared by every product whose canvas carries the dot-vote stepper.

import { useEffect, useRef, useState, type RefObject } from 'react';

// The stepper's size on screen: two 24 px buttons, the count, gaps, padding and border.
export const VOTE_STEPPER_PX = { width: 84, height: 34 } as const;

// Does the stepper fold to a badge on this element at this zoom? Only zoomed out (at 100% and above nothing changes),
// and only when the element on screen is narrower than twice the stepper or shorter than three times it.
export function voteStepperCollapses(
  box: { width: number; height: number } | undefined,
  zoom: number,
): boolean {
  if (!box || zoom >= 1) return false;
  return (
    box.width * zoom < VOTE_STEPPER_PX.width * 2 || box.height * zoom < VOTE_STEPPER_PX.height * 3
  );
}

// The badge's size on screen (24 px, `h-6 min-w-[24px]`), its footprint on the element's corner (the badge and the
// third of it hung off, 32 px), and the dot it shrinks to.
export const VOTE_BADGE_PX = 24;
export const VOTE_BADGE_FOOTPRINT_PX = VOTE_BADGE_PX + VOTE_BADGE_PX / 3;
export const VOTE_DOT_PX = 8;

// Does the badge (or the read-only count) shrink to a dot on this element at this zoom (docs/specs/012-collaboration/
// session-tools.md "Smaller still it shrinks to a dot")? Only zoomed out, and only when the element on screen is
// narrower or shorter than the badge's footprint: below that the badge covers most of its note and its hung corner
// reaches the next one, as at a phone's full Fit of a large board (about 0.13 zoom, 23 px notes). Arithmetic on the element's
// stored size and the zoom alone, with no layout read, as every shown stepper on a large board runs it per zoom.
export function voteBadgeShrinks(
  box: { width: number; height: number } | undefined,
  zoom: number,
): boolean {
  if (!box || zoom >= 1) return false;
  return Math.min(box.width, box.height) * zoom < VOTE_BADGE_FOOTPRINT_PX;
}

// A folded stepper's open state. Opening it is the badge's tap; a press outside `ref`, Escape, or the fold lifting
// closes it. The listeners exist only while one is open, so a board of badges adds none.
export function useVoteBadge(collapsed: boolean): {
  ref: RefObject<HTMLDivElement | null>;
  open: boolean;
  setOpen: (open: boolean) => void;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const shown = open && collapsed;
  useEffect(() => {
    if (!shown) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [shown]);
  // The fold lifting (a zoom in) closes it, so a later zoom out starts folded again. Set while rendering, React's
  // way to adjust state to a prop, so no extra commit runs first.
  if (!collapsed && open) setOpen(false);
  return { ref, open: shown, setOpen };
}
