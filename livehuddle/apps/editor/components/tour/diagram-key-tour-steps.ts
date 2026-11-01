import { conceptOutro, onGraphic } from './concept-element-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import { doublePressWord, pressWord, type MenuTourEnv } from './menu-tour-step';
import type { TourStepOf } from '@liveworkspace/workbench/components/tour/tour-step';
import { elementSelector, escapeId } from '@liveworkspace/workbench/lib/canvas-selectors';

// The Diagram Key tour (docs/specs/007-editor/element-tours.md "The Diagram Key tour"), on a selected diagram key: rows
// that build themselves from the tab, a row's meaning written in place, and its title. A key has no menu section.

type DiagramKeyTourContext = Pick<MenuTourEnv, 'elementId' | 'touch'> & {
  // Its first row's id (its meaning is `data-key-meaning`), or null for a key with nothing to list yet.
  firstRowId: string | null;
};

export function diagramKeyTourSteps(ctx: DiagramKeyTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  return [
    onGraphic(
      'key',
      'It Builds Itself',
      'It lists every line style and tag colour on this tab, and updates itself.',
      elementSelector(id),
    ),
    ctx.firstRowId
      ? onGraphic(
          'meaning',
          'Say What It Means',
          `${pressWord(ctx)} a row to say what it means, like Async call.`,
          elementSelector(id, `[data-key-meaning="${escapeId(ctx.firstRowId)}"]`),
        )
      : onGraphic(
          'empty',
          'Nothing to Key Yet',
          'Use a new line style or tag colour and a row appears.',
          elementSelector(id),
        ),
    onGraphic(
      'title',
      'Its Title',
      `${doublePressWord(ctx)} the title to rename it.`,
      elementSelector(id),
    ),
    conceptOutro(
      'That Is a Diagram Key',
      'Meanings are remembered, even if a row disappears and comes back.',
    ),
  ];
}
