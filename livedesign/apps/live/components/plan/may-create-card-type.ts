import { ITEM_TYPES_MAX } from '@livedesign/items';

// Whether an Add a Card menu (a board's, a Gantt chart's) ends in Add New Card Type: for an Editor only, since a
// Participant adds cards but never changes the card types (docs/specs/013-workspace/share-roles.md), and only while
// the catalogue has room for another (docs/specs/026-plan/plan-board.md "Add New Card Type").
export function mayCreateCardType(plan: { canEdit: boolean; types: readonly unknown[] }): boolean {
  return plan.canEdit && plan.types.length < ITEM_TYPES_MAX;
}
