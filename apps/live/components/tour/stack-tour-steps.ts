import { conceptOutro, onGraphic } from './concept-element-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import { menuStep, type MenuTourEnv } from './menu-tour-step';
import type { TourStepOf } from './tour-step';
import { elementSelector } from '@/lib/canvas-selectors';

// The Stack tour (docs/specs/007-editor/element-tours.md "The Stack tour"), on a selected stack: it lays out what it
// holds and hugs it, a child dragged to a new slot (or, on an empty stack, something dropped in), what it carries, and
// its menu. It points at the stack and its first child; it never moves anything itself.

type StackTourContext = MenuTourEnv & {
  direction: 'row' | 'column' | 'grid';
  // The first child in slot order, or null for an empty stack.
  firstChildId: string | null;
};

const ARRANGED: Record<StackTourContext['direction'], string> = {
  row: 'in a row',
  column: 'in a column',
  grid: 'in a grid',
};

export function stackTourSteps(ctx: StackTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  return [
    onGraphic(
      'stack',
      'It Lays Itself Out',
      `A stack keeps what it holds ${ARRANGED[ctx.direction]}, an even gap apart, and hugs it: add, remove or resize anything and it reflows. No nudging into line.`,
      elementSelector(id),
    ),
    ctx.firstChildId
      ? onGraphic(
          'child',
          'Drag to Reorder',
          `Drag one past its neighbour and it takes that slot; the rest slide along to make room.`,
          elementSelector(ctx.firstChildId),
        )
      : onGraphic(
          'drop',
          'Drop Things In',
          'Drag a card, a shape or a sticky inside it and it takes the next slot. Empty, it keeps its size as a target.',
          elementSelector(id),
        ),
    onGraphic(
      'carry',
      'Carries What It Holds',
      'Drag the stack and everything inside comes too, as with a frame. Stacks nest, in frames, boundaries or each other.',
      elementSelector(id),
    ),
    menuStep(
      ctx,
      'menu',
      'The Stack Menu',
      'Tools, then Stack: Row, Column or Grid (with its Columns), the Gap between, the Padding inside, and Align.',
    ),
    conceptOutro(
      'That Is a Stack',
      'Every reflow belongs to the change that caused it, so one undo puts both back.',
    ),
  ];
}
