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
      `${apex}. Every tier is cut from one triangle, so their edges line up as one silhouette however many there are.`,
      elementSelector(id),
    ),
    onGraphic(
      'edit',
      'Type Over a Tier',
      `${click} a tier's name to type over it. A name too long for its tier is shortened, never spilling out.`,
      elementSelector(id, '[data-concept-row="0"]'),
    ),
    addRowStep(
      'add',
      'Add a Tier',
      `Add Tier puts a new tier at the ${ctx.inverted ? 'point' : 'base'}, up to six. The triangle is cut again to fit.`,
      'Add Tier',
    ),
    ...(ctx.hasMore
      ? [
          inTheMenu(
            'shape',
            'Pyramid, Inverted or Funnel',
            'In the menu, Shape switches between Pyramid, Inverted and Funnel, keeping every tier; Rows reorders them.',
          ),
        ]
      : []),
    onGraphic(
      'colours',
      'From the Accent Down',
      `The ${ctx.inverted ? 'top' : 'apex'} takes the accent and each tier after it steps toward the fill, its words kept readable.`,
      elementSelector(id, `[data-concept-row="${Math.max(0, base)}"]`),
    ),
    onGraphic(
      'animate',
      ctx.inverted ? 'Build It Down' : 'Build It Up',
      `Animation, then Concept: Build lays the tiers ${ctx.inverted ? 'from the top down' : 'from the base up'}, as here. Pulse lights each in turn.`,
      elementSelector(id),
      'build',
    ),
    conceptOutro(
      ctx.inverted ? 'That Is an Inverted Pyramid' : 'That Is a Pyramid',
      'It exports exactly as drawn, and every change is one undo step.',
    ),
  ];
}
