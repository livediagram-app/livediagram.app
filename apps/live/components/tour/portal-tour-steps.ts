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
      'Link two portals for a shortcut across the canvas or to another tab.',
      elementSelector(id),
    ),
    ctx.linked
      ? onGraphic(
          'travel',
          'Step Through',
          `${pressWord(ctx)} it to jump to the other end. Dragging just moves it.`,
          elementSelector(id),
        )
      : onGraphic(
          'unlinked',
          'Not Linked Yet',
          'A dim portal is not linked yet. Link it and it lights up.',
          elementSelector(id),
        ),
    menuStep(
      ctx,
      'menu',
      'Link It',
      'Tools › Portal names it and picks where it leads. Create Portal makes its partner.',
    ),
    onGraphic(
      'walk',
      'Walk Into It',
      'In Avatar mode, walk into a portal to come out of the other.',
      elementSelector(id),
    ),
    conceptOutro('That Is a Portal', 'Undo takes back any change.'),
  ];
}
