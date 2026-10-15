import { conceptOutro, escapeId, inElement, onGraphic } from './concept-element-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import { doublePressWord, pressWord, type MenuTourEnv } from './menu-tour-step';
import type { TourStepOf } from './tour-step';

// The Diagram Key tour (docs/specs/007-editor/element-tours.md "The Diagram Key tour"), on a selected diagram key: rows
// that build themselves from the tab, a row's meaning written in place, and its title. A key has no menu section.

export type DiagramKeyTourContext = Pick<MenuTourEnv, 'elementId' | 'touch'> & {
  // Its first row's id (its meaning is `data-key-meaning`), or null for a key with nothing to list yet.
  firstRowId: string | null;
};

export function diagramKeyTourSteps(ctx: DiagramKeyTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  return [
    onGraphic(
      'key',
      'It Builds Itself',
      'A row for every line style your arrows use and every tag colour mapped on this tab. Make a line dashed and the key gains a row; stop using it and the row goes.',
      inElement(id),
    ),
    ctx.firstRowId
      ? onGraphic(
          'meaning',
          'Say What It Means',
          `${pressWord(ctx)} a row's words to write its meaning: Async call, Data flow. Enter keeps it, Escape puts it back.`,
          inElement(id, `[data-key-meaning="${escapeId(ctx.firstRowId)}"]`),
        )
      : onGraphic(
          'empty',
          'Nothing to Key Yet',
          'Draw two arrows in different line styles, or map a tag colour, and their rows appear here.',
          inElement(id),
        ),
    onGraphic(
      'title',
      'Its Title',
      `Key by default; ${doublePressWord(ctx).toLowerCase()} it to rename it. It grows downward on its own; widen it for longer meanings.`,
      inElement(id),
    ),
    conceptOutro(
      'That Is a Diagram Key',
      'A meaning is kept when its row goes, so a style switched off and on again keeps its words.',
    ),
  ];
}
