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

// The Funnel tour (docs/specs/007-editor/element-tours.md "The Funnel tour"): a Pyramid in its Funnel variant, its
// stages narrowing down, the number each band carries, and Build from the top.
export function funnelTourSteps(ctx: ConceptTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  const click = ctx.touch ? 'Tap' : 'Click';
  const valued = ctx.rows.findIndex((r) => !!r.note);
  const last = ctx.rows.length - 1;
  return [
    onGraphic(
      'stages',
      'Narrowing Stage by Stage',
      'Each band is a stage, narrowing down so the drop-off is easy to see.',
      elementSelector(id),
    ),
    onGraphic(
      'edit',
      'Type Over a Stage',
      `${click} a stage's name to type over it. Enter keeps it, Escape puts it back.`,
      elementSelector(id, '[data-concept-row="0"]'),
    ),
    ...(valued >= 0
      ? [
          onGraphic(
            'values',
            'A Number on Each Band',
            `Add a number to each band, like sign-ups. ${click} it to edit.`,
            elementSelector(id, `[data-concept-note="${valued}"]`),
          ),
        ]
      : []),
    addRowStep('add', 'Add a Stage', 'Add Tier adds a band at the bottom, up to six.', 'Add Tier'),
    ...(ctx.hasMore
      ? [
          inTheMenu(
            'shape',
            'Funnel, Pyramid or Inverted',
            'In its menu, Shape switches between Funnel, Pyramid and Inverted.',
            ['Tools', 'Pyramid'],
          ),
        ]
      : []),
    onGraphic(
      'colours',
      'From the Accent Down',
      'The colours shade from the top band down. Change the colour and they all follow.',
      elementSelector(id, `[data-concept-row="${Math.max(0, last)}"]`),
    ),
    onGraphic(
      'animate',
      'Pour It In',
      'Animation › Concept builds the bands in from the top down, as here, or pulses through them.',
      elementSelector(id),
      'build',
    ),
    conceptOutro('That Is a Funnel', 'It exports as you see it. Undo takes back any change.'),
  ];
}
