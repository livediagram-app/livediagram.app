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

// The Timeline tour (docs/specs/007-editor/element-tours.md "The Timeline tour"): milestones read left to right along
// one line, each a name and a when, taking turns above and below, and Build bringing them in in order.
export function timelineTourSteps(ctx: ConceptTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  const click = ctx.touch ? 'Tap' : 'Click';
  return [
    onGraphic(
      'line',
      'Along One Line',
      `Its ${ctx.rows.length} milestones read left to right toward the arrow, taking turns above and below so long names fit.`,
      elementSelector(id),
    ),
    onGraphic(
      'name',
      'What Happens',
      `${click} a milestone's name to type over it.`,
      elementSelector(id, '[data-concept-row="0"]'),
    ),
    onGraphic(
      'when',
      'And When',
      `${click} its when to change it: a date, a quarter, a sprint.`,
      elementSelector(id, '[data-concept-note="0"]'),
    ),
    addRowStep(
      'add',
      'Add a Milestone',
      'Add Milestone adds one at the end, up to eight.',
      'Add Milestone',
    ),
    inTheMenu(
      'rows',
      'Reorder in the Menu',
      'In its menu, Tools › Rows lets you rename, reorder or remove milestones.',
      ['Tools', 'Rows'],
    ),
    onGraphic(
      'animate',
      'Play It in Order',
      'Animation › Concept brings the milestones in left to right, as here, or pulses through them.',
      elementSelector(id),
      'build',
    ),
    conceptOutro('That Is a Timeline', 'It exports as you see it. Undo takes back any change.'),
  ];
}
