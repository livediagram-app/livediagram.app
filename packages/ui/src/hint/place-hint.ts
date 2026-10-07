import { clampIntoRange } from '../popover';

export type HintPlacement = 'top' | 'bottom' | 'right' | 'left';

export type HintLayout = {
  left: number;
  top: number;
  placement: HintPlacement;
  // Distance from the surface's start edge (left for top/bottom, top for
  // right/left) to the trigger's centre: where the pointer triangle sits.
  arrowOffset: number;
};

type Box = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

// Top, then bottom, right, left (or the caller's `order`): the first side whose
// box fits inside the viewport less `margin`; the first in the order when none
// does. The surface centres on the
// trigger and is clamped into the viewport, and the arrow keeps pointing at
// the trigger's centre when the surface slides.
export function placeHint({
  trigger,
  surface,
  viewport,
  gap,
  margin,
  order = ['top', 'bottom', 'right', 'left'],
}: {
  trigger: Box;
  surface: { width: number; height: number };
  viewport: { width: number; height: number };
  gap: number;
  margin: number;
  // The sides tried, in turn (a popover hung beside its row tries right first).
  order?: readonly HintPlacement[];
}): HintLayout {
  const fits: Record<HintPlacement, boolean> = {
    top: trigger.top - surface.height - gap >= margin,
    bottom: trigger.bottom + surface.height + gap <= viewport.height - margin,
    right: trigger.right + surface.width + gap <= viewport.width - margin,
    left: trigger.left - surface.width - gap >= margin,
  };
  const placement = order.find((side) => fits[side]) ?? order[0] ?? 'top';
  const centreX = trigger.left + trigger.width / 2;
  const centreY = trigger.top + trigger.height / 2;

  if (placement === 'top' || placement === 'bottom') {
    const left = clampIntoRange(
      centreX - surface.width / 2,
      margin,
      viewport.width - margin - surface.width,
    );
    const top = placement === 'top' ? trigger.top - surface.height - gap : trigger.bottom + gap;
    return { left, top, placement, arrowOffset: centreX - left };
  }
  const top = clampIntoRange(
    centreY - surface.height / 2,
    margin,
    viewport.height - margin - surface.height,
  );
  const left = placement === 'right' ? trigger.right + gap : trigger.left - surface.width - gap;
  return { left, top, placement, arrowOffset: centreY - top };
}
