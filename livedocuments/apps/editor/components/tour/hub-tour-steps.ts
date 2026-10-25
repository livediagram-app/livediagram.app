import type { ElementTourApi } from '@liveworkspace/workbench/components/tour/element-tour-api';
import {
  addRowStep,
  conceptOutro,
  inTheMenu,
  onGraphic,
  type ConceptTourContext,
} from './concept-element-tour-steps';
import type { TourStepOf } from '@liveworkspace/workbench/components/tour/tour-step';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

// The Hub and Spoke tour (docs/specs/007-editor/element-tours.md "The Hub and Spoke tour"): the hub everything
// touches, its satellites round it from twelve o'clock, the spokes that can go, and Pulse travelling round.
export function hubTourSteps(ctx: ConceptTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  const click = ctx.touch ? 'Tap' : 'Click';
  return [
    onGraphic(
      'hub',
      'One Thing in the Middle',
      `The hub is what everything connects to. ${ctx.touch ? 'Double-tap' : 'Double-click'} it to name it.`,
      elementSelector(id, '[data-tour-part="concept-centre"]'),
    ),
    onGraphic(
      'satellites',
      'Round It, Clockwise',
      `Its ${ctx.rows.length} satellites sit evenly round the hub, clockwise from the top.`,
      elementSelector(id),
    ),
    onGraphic(
      'edit',
      'Type Over a Satellite',
      `${click} a satellite's name to type over it. Enter keeps it, Escape puts it back.`,
      elementSelector(id, '[data-concept-row="0"]'),
    ),
    addRowStep('add', 'Add a Satellite', 'Add Satellite adds one, up to eight.', 'Add Satellite'),
    ...(ctx.hasMore
      ? [
          inTheMenu('spokes', 'Spokes or None', 'In its menu, Spokes turns the lines on or off.', [
            'Tools',
            'Hub and Spoke',
          ]),
        ]
      : []),
    onGraphic(
      'animate',
      'Light Them Up',
      'Animation › Concept pulses round the satellites or builds them in.',
      elementSelector(id),
      'pulse',
    ),
    conceptOutro(
      'That Is a Hub and Spoke',
      'It exports as you see it. Undo takes back any change.',
    ),
  ];
}
