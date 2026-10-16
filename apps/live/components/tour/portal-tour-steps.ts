import { conceptOutro, onGraphic } from './concept-element-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import { menuStep, pressWord, type MenuTourEnv } from './menu-tour-step';
import type { TourStepOf } from './tour-step';
import { elementSelector } from '@/lib/canvas-selectors';

// The Portal tour (docs/specs/007-editor/element-tours.md "The Portal tour"), on a selected portal: a shortcut to the
// portal it is linked to, stepping through (or, unlinked, why it is dim), linking it from its menu, and walking an
// Avatar-mode character in. It never travels itself: arriving on another tab ends the tour.

type PortalTourContext = MenuTourEnv & {
  // A link out of it, or one into it from another portal on this tab.
  linked: boolean;
};

export function portalTourSteps(ctx: PortalTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  return [
    onGraphic(
      'portal',
      'A Way Through',
      'Two linked portals are a shortcut: across a big canvas, or to another tab of this document.',
      elementSelector(id),
    ),
    ctx.linked
      ? onGraphic(
          'travel',
          'Step Through',
          `${pressWord(ctx)} it to come out of the portal it leads to, on this tab or another. Dragging it only moves it.`,
          elementSelector(id),
        )
      : onGraphic(
          'unlinked',
          'Not Linked Yet',
          'A dim ring leads nowhere. Link it to another portal and it lights up.',
          elementSelector(id),
        ),
    menuStep(
      ctx,
      'menu',
      'Link It',
      'Tools, then Portal: give it a Name, pick where it Leads To (a link works both ways), or Create Portal for a linked partner beside it.',
    ),
    onGraphic(
      'walk',
      'Walk Into It',
      'In Avatar mode, walk your character into a portal and it steps out of the other one.',
      elementSelector(id),
    ),
    conceptOutro(
      'That Is a Portal',
      'Recolour one orange for the classic pair. Every change is one undo step.',
    ),
  ];
}
