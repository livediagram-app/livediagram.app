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

// The Pyramid tour (docs/specs/007-editor/element-tours.md "The Pyramid tour"), on a Pyramid or an Inverted pyramid:
// its tiers cut from one triangle, the apex first, the three shapes it switches between, and Build from the base.
export function pyramidTourSteps(
  ctx: ConceptTourContext & { inverted: boolean },
): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  const click = ctx.touch ? 'Tap' : 'Click';
  const base = ctx.rows.length - 1;
  const apex = ctx.inverted
    ? 'The first tier is the widest, along the top'
    : 'The first tier is the apex';
  return [
    onGraphic(
      'tiers',
      'Tiers Cut From One Triangle',
      `${apex}. The tiers always line up as one shape.`,
      elementSelector(id),
    ),
    onGraphic(
      'edit',
      'Type Over a Tier',
      `${click} a tier's name to edit it.`,
      elementSelector(id, '[data-concept-row="0"]'),
    ),
    addRowStep(
      'add',
      'Add a Tier',
      `Add Tier adds one at the ${ctx.inverted ? 'point' : 'base'}, up to six.`,
      'Add Tier',
    ),
    ...(ctx.hasMore
      ? [
          inTheMenu(
            'shape',
            'Pyramid, Inverted or Funnel',
            'In its menu, Shape switches between Pyramid, Inverted and Funnel.',
            ['Tools', 'Pyramid'],
          ),
        ]
      : []),
    onGraphic(
      'colours',
      'From the Accent Down',
      `Colours shade from the ${ctx.inverted ? 'top' : 'apex'} down. Change the colour and they all follow.`,
      elementSelector(id, `[data-concept-row="${Math.max(0, base)}"]`),
    ),
    onGraphic(
      'animate',
      ctx.inverted ? 'Build It Down' : 'Build It Up',
      `Animation › Concept builds the tiers ${ctx.inverted ? 'from the top down' : 'from the base up'}, as here, or pulses through them.`,
      elementSelector(id),
      'build',
    ),
    conceptOutro(
      ctx.inverted ? 'That Is an Inverted Pyramid' : 'That Is a Pyramid',
      'It exports as you see it. Undo takes back any change.',
    ),
  ];
}
