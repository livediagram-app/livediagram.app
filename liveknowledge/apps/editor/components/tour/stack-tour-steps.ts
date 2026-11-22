import { conceptOutro, onGraphic } from './concept-element-tour-steps';
import type { ElementTourApi } from '@liveworkspace/workbench/components/tour/element-tour-api';
import { menuStep, type MenuTourEnv } from './menu-tour-step';
import type { TourStepOf } from '@liveworkspace/workbench/components/tour/tour-step';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

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
      `A stack keeps things ${ARRANGED[ctx.direction]}, evenly spaced, and reflows as they change.`,
      elementSelector(id),
    ),
    ctx.firstChildId
      ? onGraphic(
          'child',
          'Drag to Reorder',
          `Drag an item past its neighbour to reorder.`,
          elementSelector(ctx.firstChildId),
        )
      : onGraphic(
          'drop',
          'Drop Things In',
          'Drag anything in and it joins the stack.',
          elementSelector(id),
        ),
    onGraphic(
      'carry',
      'Carries What It Holds',
      'Drag the stack and everything in it comes too.',
      elementSelector(id),
    ),
    menuStep(
      ctx,
      'menu',
      'The Stack Menu',
      'Tools › Stack picks row, column or grid, and the spacing.',
      ['Tools', 'Stack'],
    ),
    conceptOutro('That Is a Stack', 'Undo takes back any change, reflow included.'),
  ];
}
