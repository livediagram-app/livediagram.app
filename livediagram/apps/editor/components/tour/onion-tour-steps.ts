import type { ElementTourApi } from './element-tour-api';
import {
  addRowStep,
  conceptOutro,
  inTheMenu,
  onGraphic,
  type ConceptTourContext,
} from './concept-element-tour-steps';
import type { TourStepOf } from './tour-step';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

// The Onion tour (docs/specs/007-editor/element-tours.md "The Onion tour"): rings nested round one core, never
// overlapping, the core first and the rest outward, and Pulse rippling out from the middle.
export function onionTourSteps(ctx: ConceptTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  const click = ctx.touch ? 'Tap' : 'Click';
  const outer = Math.max(0, ctx.rows.length - 1);
  return [
    onGraphic(
      'rings',
      'Nested, Not Overlapping',
      `Its ${ctx.rows.length} rings nest round a core, each wrapping the ones inside.`,
      elementSelector(id),
    ),
    onGraphic(
      'core',
      'The Core',
      `The core sits in the middle. ${click} its name to edit it.`,
      elementSelector(id, '[data-concept-row="0"]'),
    ),
    onGraphic(
      'outer',
      'Outward From There',
      'Each ring sits further out, its name along the top.',
      elementSelector(id, `[data-concept-row="${outer}"]`),
    ),
    addRowStep('add', 'Add a Ring', 'Add Ring adds one round the outside, up to six.', 'Add Ring'),
    ...(ctx.hasMore
      ? [
          inTheMenu(
            'rows',
            'Reorder in the Menu',
            'In its menu, Tools › Rows lets you rename, reorder or remove rings.',
            ['Tools', 'Rows'],
          ),
        ]
      : []),
    onGraphic(
      'animate',
      'Ripple Outward',
      'Animation › Concept ripples outward or builds it ring by ring.',
      elementSelector(id),
      'pulse',
    ),
    conceptOutro('That Is an Onion', 'It exports as you see it. Undo takes back any change.'),
  ];
}
