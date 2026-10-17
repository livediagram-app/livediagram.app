import type { ElementTourApi } from './element-tour-api';
import {
  addRowStep,
  conceptOutro,
  inTheMenu,
  onGraphic,
  type ConceptTourContext,
} from './concept-element-tour-steps';
import type { TourStepOf } from './tour-step';
import { elementSelector } from '@/lib/canvas-selectors';

// The Hub and Spoke tour (docs/specs/007-editor/element-tours.md "The Hub and Spoke tour"): the hub everything
// touches, its satellites round it from twelve o'clock, the spokes that can go, and Pulse travelling round.
export function hubTourSteps(ctx: ConceptTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  const click = ctx.touch ? 'Tap' : 'Click';
  return [
    onGraphic(
      'hub',
      'One Thing in the Middle',
      `The hub is what everything touches: a service, a team, a product. ${ctx.touch ? 'Double-tap' : 'Double-click'} it to name it.`,
      elementSelector(id, '[data-tour-part="concept-centre"]'),
    ),
    onGraphic(
      'satellites',
      'Round It, Clockwise',
      `Its ${ctx.rows.length} satellites sit evenly round the hub, the first at twelve o'clock and the rest clockwise, each on its spoke.`,
      elementSelector(id),
    ),
    onGraphic(
      'edit',
      'Type Over a Satellite',
      `${click} a satellite's name to type over it. Enter keeps it, Escape puts it back.`,
      elementSelector(id, '[data-concept-row="0"]'),
    ),
    addRowStep(
      'add',
      'Add a Satellite',
      'Add Satellite puts a new one on the ring, up to eight. The rest spread out evenly again.',
      'Add Satellite',
    ),
    ...(ctx.hasMore
      ? [
          inTheMenu(
            'spokes',
            'Spokes or None',
            'In the menu, Spokes turns the lines off, leaving the satellites floating round the hub; Rows reorders them.',
          ),
        ]
      : []),
    onGraphic(
      'animate',
      'Light Them Up',
      'Animation, then Concept: Pulse travels round the satellites, as here. Build brings in the hub, then each satellite with its spoke.',
      elementSelector(id),
      'pulse',
    ),
    conceptOutro(
      'That Is a Hub and Spoke',
      'It exports exactly as drawn, and every change is one undo step.',
    ),
  ];
}
