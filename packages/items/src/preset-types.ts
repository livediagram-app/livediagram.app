// Card types a board preset brings (docs/specs/026-plan/plan-mode.md "The palette"): a Bug Triage board takes Bugs,
// a Sprint board Stories. Placing the board adds each one the document lacks to its catalogue, so the board's own
// kind of card is there to add; a document that already has the type (by id) keeps its own.
import { PARENT_FIELD, type ItemTypeDef } from './item-types';

const WORK = [
  'title',
  'description',
  'status',
  'assignee',
  'parent',
  'priority',
  'estimate',
  'due',
  'checklist',
  'labels',
  'comments',
];

export const PRESET_CARD_TYPES: readonly ItemTypeDef[] = [
  {
    id: 'bug',
    label: 'Bug',
    newTitle: 'New bug',
    glyph: 'bug',
    color: '#dc2626',
    fields: WORK,
    custom: [PARENT_FIELD],
  },
  {
    id: 'story',
    label: 'Story',
    newTitle: 'New story',
    glyph: 'story',
    color: '#7c3aed',
    fields: WORK,
    custom: [PARENT_FIELD],
  },
];

// The preset card types a board names that the document lacks (by id), in the board's order.
export function presetTypesToAdd(
  named: readonly string[] | undefined,
  types: readonly ItemTypeDef[],
): ItemTypeDef[] {
  const have = new Set(types.map((t) => t.id));
  return (named ?? [])
    .map((id) => PRESET_CARD_TYPES.find((t) => t.id === id))
    .filter((t): t is ItemTypeDef => !!t && !have.has(t.id));
}
