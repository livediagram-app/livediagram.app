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

// The Cycle tour (docs/specs/007-editor/element-tours.md "The Cycle tour"): its steps round the ring from twelve
// o'clock, the solid first step, the words in the middle, and Flow sent round its arrows.
export function cycleTourSteps(ctx: ConceptTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  const click = ctx.touch ? 'Tap' : 'Click';
  return [
    onGraphic(
      'loop',
      'A Loop, Clockwise',
      `Its ${ctx.rows.length} steps sit round a ring, the first at twelve o'clock and the rest clockwise. Each arrow runs to the next, and the last back to the start.`,
      elementSelector(id),
    ),
    onGraphic(
      'first',
      'Where It Starts',
      `The first step is solid in the accent, so the loop shows where it begins. ${click} a step's name to type over it.`,
      elementSelector(id, '[data-concept-row="0"]'),
    ),
    onGraphic(
      'centre',
      'Name the Loop',
      `${ctx.touch ? 'Double-tap' : 'Double-click'} the middle to say what turns: a weekly loop, a flywheel, PDCA.`,
      elementSelector(id, '[data-tour-part="concept-centre"]'),
    ),
    addRowStep(
      'add',
      'Add a Step',
      'Add Step puts a new step at the end of the loop, up to eight. The ring spaces them evenly again.',
      'Add Step',
    ),
    ...(ctx.hasMore
      ? [
          inTheMenu(
            'rows',
            'Reorder in the Menu',
            'Under Tools, Rows lists every step: rename one, move it round the loop, or remove it (three stay).',
          ),
        ]
      : []),
    onGraphic(
      'animate',
      'Set It Turning',
      'Animation, then Concept: Flow sends dashes round the arrows, as here. Build draws it step by step; Pulse lights each in turn.',
      elementSelector(id),
      'flow',
    ),
    conceptOutro(
      'That Is a Cycle',
      'It exports exactly as drawn, and every change is one undo step.',
    ),
  ];
}
