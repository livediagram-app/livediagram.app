// A Calculated field's value as the editor reads it (docs/specs/026-plan/item-types.md "Calculated fields"): worked
// out from the plan's cards and its boards' done columns (the plan's status phases), never stored. The child index
// is made once per items map (childIndexFor), so a board of n cards costs one pass over the cards, not n. A Formula
// ("Formula fields") reads the card's own fields, its parse cached by its text, and keeps its problem for the face
// and the panel to show.
import {
  calculatedOutcome,
  childIndexFor,
  donePhase,
  typeIn,
  type CustomFieldDef,
  type FormulaOutcome,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';

export type CalculatedPlan = {
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  statusPhases: ReadonlyMap<string, string>;
};

type CalculatedField = Pick<
  CustomFieldDef,
  'kind' | 'calculation' | 'formula' | 'result' | 'currency'
> &
  Partial<Pick<CustomFieldDef, 'id'>>;

// The value, or the problem working it out; `type` is the card's type unless given (the type editor's draft).
export function calculatedFieldOutcome(
  plan: CalculatedPlan,
  field: CalculatedField,
  item: Item,
  type: ItemTypeDef = typeIn(plan.types, item.type),
): FormulaOutcome {
  return calculatedOutcome(
    field,
    item,
    childIndexFor(plan.items, plan.types),
    donePhase(plan.statusPhases),
    { type, items: plan.items },
  );
}
