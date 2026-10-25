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

// The Cycle tour (docs/specs/007-editor/element-tours.md "The Cycle tour"): its steps round the ring from twelve
// o'clock, the solid first step, the words in the middle, and Flow sent round its arrows.
export function cycleTourSteps(ctx: ConceptTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  const click = ctx.touch ? 'Tap' : 'Click';
  return [
    onGraphic(
      'loop',
      'A Loop, Clockwise',
      `Its ${ctx.rows.length} steps go clockwise from the top, and the last leads back to the first.`,
      elementSelector(id),
    ),
    onGraphic(
      'first',
      'Where It Starts',
      `The solid step is where it starts. ${click} a step to rename it.`,
      elementSelector(id, '[data-concept-row="0"]'),
    ),
    onGraphic(
      'centre',
      'Name the Loop',
      `${ctx.touch ? 'Double-tap' : 'Double-click'} the middle to name the cycle.`,
      elementSelector(id, '[data-tour-part="concept-centre"]'),
    ),
    addRowStep('add', 'Add a Step', 'Add Step adds one to the loop, up to eight.', 'Add Step'),
    ...(ctx.hasMore
      ? [
          inTheMenu(
            'rows',
            'Reorder in the Menu',
            'In its menu, Tools › Rows lets you rename, reorder or remove steps.',
            ['Tools', 'Rows'],
          ),
        ]
      : []),
    onGraphic(
      'animate',
      'Set It Turning',
      'Animation › Concept sends flow round the arrows or builds it step by step.',
      elementSelector(id),
      'flow',
    ),
    conceptOutro('That Is a Cycle', 'It exports as you see it. Undo takes back any change.'),
  ];
}
