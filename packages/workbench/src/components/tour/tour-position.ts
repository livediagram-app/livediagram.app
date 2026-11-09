// Pure placement math for the tour popover (docs/specs/007-editor/editor-tour.md "Where the card sits"), split out so
// the side-picking and clamping rules are testable without a DOM. The popover prefers sitting beside its target
// (right, then left), falls back to below / above, and when neither has room for the whole card (a phone, a tall
// card, a target mid-screen) takes the side with more room, capped to that room's height (its words scroll inside):
// never centred over the target it is about. Cross-axis position is clamped into the viewport with the shared 8px
// edge margin (packages/ui popover convention).

import { clamp } from '@liveworkspace/model-core/geometry-primitives';

export type TourRect = { left: number; top: number; width: number; height: number };
type TourSize = { width: number; height: number };
type TourViewport = { width: number; height: number };

type TourPlacement = {
  left: number;
  top: number;
  side: 'right' | 'left' | 'below' | 'above' | 'center';
  // Set when the card is taller than the room it was given: the card caps itself to it and scrolls its words.
  maxHeight?: number;
};

export const TOUR_POPOVER_GAP = 12;
export const TOUR_EDGE_MARGIN = 8;
// The least room worth squeezing the card into beside a target; below it (a target filling the screen) the card
// docks at the bottom edge instead, the one case it can meet its target.
export const TOUR_MIN_ROOM = 120;

export function placeTourPopover(
  target: TourRect,
  pop: TourSize,
  viewport: TourViewport,
): TourPlacement {
  const gap = TOUR_POPOVER_GAP;
  const margin = TOUR_EDGE_MARGIN;
  const right = target.left + target.width;
  const bottom = target.top + target.height;

  const clampY = (top: number) => clamp(top, margin, viewport.height - pop.height - margin);
  const clampX = (left: number) => clamp(left, margin, viewport.width - pop.width - margin);

  // Beside the target, vertically aligned to its top.
  if (right + gap + pop.width + margin <= viewport.width) {
    return { left: right + gap, top: clampY(target.top), side: 'right' };
  }
  if (target.left - gap - pop.width >= margin) {
    return { left: target.left - gap - pop.width, top: clampY(target.top), side: 'left' };
  }
  // Under / over the target, horizontally aligned to its left edge.
  if (bottom + gap + pop.height + margin <= viewport.height) {
    return { left: clampX(target.left), top: bottom + gap, side: 'below' };
  }
  if (target.top - gap - pop.height >= margin) {
    return { left: clampX(target.left), top: target.top - gap - pop.height, side: 'above' };
  }
  // Neither side holds the whole card: the side with more room, the card capped to it.
  const roomBelow = viewport.height - margin - (bottom + gap);
  const roomAbove = target.top - gap - margin;
  if (Math.max(roomBelow, roomAbove) >= TOUR_MIN_ROOM) {
    return roomBelow >= roomAbove
      ? { left: clampX(target.left), top: bottom + gap, side: 'below', maxHeight: roomBelow }
      : { left: clampX(target.left), top: margin, side: 'above', maxHeight: roomAbove };
  }
  // The target fills the screen: dock at the bottom edge, as tall as the card (capped to the window).
  const tall = Math.min(pop.height, viewport.height - margin * 2);
  return {
    left: clampX((viewport.width - pop.width) / 2),
    top: viewport.height - margin - tall,
    side: 'center',
    ...(tall < pop.height ? { maxHeight: tall } : {}),
  };
}

// How far two rects overlap vertically, in px (0 when they don't touch).
function overlapY(a: { top: number; height: number }, b: { top: number; height: number }): number {
  return Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
}

/**
 * The edge a full-width sheet docks at (a phone's tour strip or player) so it never covers its target: `prefer` when
 * the sheet there clears the target (or there is no target), else the other edge when that clears it or covers less
 * of it. `insets` keep the sheet off chrome at each edge (the footer under a bottom sheet).
 */
export function pickDockEdge(
  target: TourRect | null,
  sheetHeight: number,
  viewportHeight: number,
  prefer: 'top' | 'bottom',
  insets: { top?: number; bottom?: number } = {},
): 'top' | 'bottom' {
  if (!target) return prefer;
  const at = {
    top: { top: insets.top ?? 0, height: sheetHeight },
    bottom: { top: viewportHeight - (insets.bottom ?? 0) - sheetHeight, height: sheetHeight },
  };
  const other = prefer === 'top' ? 'bottom' : 'top';
  const here = overlapY(at[prefer], target);
  if (here === 0) return prefer;
  return overlapY(at[other], target) < here ? other : prefer;
}
