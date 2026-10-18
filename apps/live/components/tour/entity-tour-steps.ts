import { conceptOutro, onGraphic } from './concept-element-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import { doublePressWord, menuStep, type MenuTourEnv } from './menu-tour-step';
import type { TourStepOf } from './tour-step';
import { elementSelector } from '@/lib/canvas-selectors';

// The Entity tour (docs/specs/007-editor/element-tours.md "The Entity tour"), on a selected entity: a title over
// `name: Type` rows with their keys, renaming it, editing a field where it stands, the Fields menu, and growing a
// model: related entities, field-to-field relationships and their cardinality.

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
      'One box for a UML class or an ER table: the title bar names it, and each row below is a field.',
      elementSelector(id),
    ),
    onGraphic(
      'title',
      'Rename It',
      `${doublePressWord(ctx)} its title bar to type over the title. It formats and aligns like any label.`,
      elementSelector(id),
    ),
    ...(ctx.hasFields
      ? [
          onGraphic(
            'rows',
            'name: Type',
            `Each field is a name, an optional type and a key (PK, FK, UK). ${doublePressWord(ctx)} a field to edit it in place: Enter moves to the next, and past the last adds one.`,
            elementSelector(id, '[data-entity-fields]'),
          ),
        ]
      : []),
    menuStep(
      ctx,
      'menu',
      'Edit the Fields',
      'Tools, then Fields: a key, a name and a type per row, a cross to remove one, and Add Field for the next, up to forty.',
    ),
    onGraphic(
      'relate',
      'Join Them Up',
      'A "+" beside it adds a related entity, already joined. Or drag from the dot beside a field to a field of another entity: the line becomes one to many, and its Cardinality button changes that.',
      elementSelector(id),
    ),
    conceptOutro(
      'That Is an Entity',
      'It exports exactly as drawn, and every change is one undo step.',
    ),
  ];
}
