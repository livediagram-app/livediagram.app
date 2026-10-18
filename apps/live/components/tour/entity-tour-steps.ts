import { conceptOutro, onGraphic } from './concept-element-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import { doublePressWord, menuStep, type MenuTourEnv } from './menu-tour-step';
import type { TourStepOf } from './tour-step';
import { elementSelector } from '@/lib/canvas-selectors';

// The Entity tour (docs/specs/007-editor/element-tours.md "The Entity tour"), on a selected entity: a title over
// `name: Type` rows, renaming it, its fields, the Fields menu that edits them, and joining entities with ER ends.

type EntityTourContext = MenuTourEnv & {
  // It has fields to ring (`data-entity-fields`).
  hasFields: boolean;
};

export function entityTourSteps(ctx: EntityTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  return [
    onGraphic(
      'entity',
      'A Title Over Its Fields',
      'A class or table: the title on top, a field on each row.',
      elementSelector(id),
    ),
    onGraphic(
      'title',
      'Rename It',
      `${doublePressWord(ctx)} it to edit the title.`,
      elementSelector(id),
    ),
    ...(ctx.hasFields
      ? [
          onGraphic(
            'rows',
            'name: Type',
            'Each row is a name and an optional type.',
            elementSelector(id, '[data-entity-fields]'),
          ),
        ]
      : []),
    menuStep(ctx, 'menu', 'Edit the Fields', 'Tools › Fields adds, edits and removes fields.'),
    onGraphic(
      'relate',
      'Join Them Up',
      "Draw a line from one entity to another, then give its ends the ER marks (one, many, zero or many) from the line's own menu.",
      elementSelector(id),
    ),
    conceptOutro('That Is an Entity', 'It exports as you see it. Undo takes back any change.'),
  ];
}
