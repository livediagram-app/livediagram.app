import { conceptOutro, inElement, onGraphic } from './concept-element-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import { doublePressWord, menuStep, type MenuTourEnv } from './menu-tour-step';
import type { TourStepOf } from './tour-step';

// The Entity tour (docs/specs/007-editor/element-tours.md "The Entity tour"), on a selected entity: a title over
// `name: Type` rows, renaming it, its fields, the Fields menu that edits them, and joining entities with ER ends.

export type EntityTourContext = MenuTourEnv & {
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
      inElement(id),
    ),
    onGraphic(
      'title',
      'Rename It',
      `${doublePressWord(ctx)} it to type over its title. It formats and aligns like any label.`,
      inElement(id),
    ),
    ...(ctx.hasFields
      ? [
          onGraphic(
            'rows',
            'name: Type',
            'Each field is a name and an optional type, muted on the right so the names scan. A method is a row too: render(): void.',
            inElement(id, '[data-entity-fields]'),
          ),
        ]
      : []),
    menuStep(
      ctx,
      'menu',
      'Edit the Fields',
      'Tools, then Fields: a name and a type per row, a cross to remove one, and Add Field for the next, up to forty.',
    ),
    onGraphic(
      'relate',
      'Join Them Up',
      "Draw a line from one entity to another, then give its ends the ER marks (one, many, zero or many) from the line's own menu.",
      inElement(id),
    ),
    conceptOutro(
      'That Is an Entity',
      'It exports exactly as drawn, and every change is one undo step.',
    ),
  ];
}
