'use client';

// The coach dock's pointer (docs/specs/007-editor/coach-dock.md "The pointer"): a ring around the step's real
// control, with no dim around it, and the step's number on a badge at its top-left corner, the same number the dock
// reads ("1 of 4"), so the two read as one. Neither takes a press. The ring glides between steps as the engine's
// target moves; the badge stays inside the window.
import { GlyphDisc, Portal } from '@livediagram/ui';
import type { TourTargetRect } from '../useTourEngine';
import { BADGE_SIZE_PX, RING_PAD_PX } from './coach-dock-copy';

export function CoachPointer({
  rect,
  n,
  layerClass,
}: {
  rect: TourTargetRect;
  // The step's number, as the dock counts it.
  n: number;
  // The ring's stacking layer: the overlay's, or just above a dialog or an open menu (TourStage's rule).
  layerClass: string;
}) {
  const ring = {
    left: rect.left - RING_PAD_PX,
    top: rect.top - RING_PAD_PX,
    width: rect.width + RING_PAD_PX * 2,
    height: rect.height + RING_PAD_PX * 2,
  };
  const half = BADGE_SIZE_PX / 2;
  const badge = { left: Math.max(4, ring.left - half), top: Math.max(4, ring.top - half) };
  const glide =
    'transition-all duration-long ease-out motion-reduce:transition-none motion-reduce:animate-none';
  return (
    <Portal>
      <div
        aria-hidden
        data-coach-ring=""
        className={`pointer-events-none fixed animate-fade-in rounded-xl border-2 border-brand-600 shadow-[0_0_0_4px_rgb(2_132_199/0.2)] dark:border-brand-400 dark:shadow-[0_0_0_4px_rgb(56_189_248/0.22)] ${glide} ${layerClass}`}
        style={ring}
      />
      <GlyphDisc
        aria-hidden
        data-coach-badge=""
        size={BADGE_SIZE_PX}
        className={`pointer-events-none fixed animate-fade-in bg-brand-700 text-[11px] font-semibold tabular-nums text-white shadow-sm ring-2 ring-white dark:bg-brand-400 dark:text-slate-900 dark:ring-slate-900 ${glide} ${layerClass}`}
        style={badge}
      >
        {n}
      </GlyphDisc>
    </Portal>
  );
}
