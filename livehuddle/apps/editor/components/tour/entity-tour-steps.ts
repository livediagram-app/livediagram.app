import { conceptOutro, onGraphic } from './concept-element-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import { doublePressWord, menuStep, type MenuTourEnv } from './menu-tour-step';
import type { TourStepOf } from '@liveworkspace/workbench/components/tour/tour-step';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

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
      'A class or table: the title on top, a field on each row.',
      elementSelector(id),
    ),
    onGraphic(
      'title',
      'Rename It',
      `${doublePressWord(ctx)} its title bar to edit the title.`,
      elementSelector(id),
    ),
    ...(ctx.hasFields
      ? [
          onGraphic(
            'rows',
            'name: Type',
            `Each field is a name, an optional type and a key. ${doublePressWord(ctx)} one to edit it.`,
            elementSelector(id, '[data-entity-fields]'),
          ),
        ]
      : []),
    menuStep(ctx, 'menu', 'Edit the Fields', 'Tools › Fields adds, edits and removes fields.', [
      'Tools',
      'Fields',
    ]),
    onGraphic(
      'relate',
      'Join Them Up',
      'A "+" beside it adds a related entity, already joined. Or drag from the dot beside a field to a field of another entity: the line becomes one to many, and its Cardinality button changes that.',
      elementSelector(id),
    ),
    conceptOutro('That Is an Entity', 'It exports as you see it. Undo takes back any change.'),
  ];
}
