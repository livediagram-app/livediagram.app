// Pure placement math for the tour popover (spec/79), split out so the
// side-picking and clamping rules are testable without a DOM. The popover
// prefers sitting beside its target (right, then left), falls back to
// below / above, and finally centres over the viewport when nothing fits
// (tiny windows). Cross-axis position is clamped into the viewport with
// the shared 8px edge margin (packages/ui popover convention).

export type TourRect = { left: number; top: number; width: number; height: number };
type TourSize = { width: number; height: number };
type TourViewport = { width: number; height: number };

type TourPlacement = {
  left: number;
  top: number;
  side: 'right' | 'left' | 'below' | 'above' | 'center';
};

export const TOUR_POPOVER_GAP = 12;
export const TOUR_EDGE_MARGIN = 8;

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), Math.max(min, max));

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
  // Nothing fits (very small viewport): centre it.
  return {
    left: clampX((viewport.width - pop.width) / 2),
    top: clampY((viewport.height - pop.height) / 2),
    side: 'center',
  };
}
