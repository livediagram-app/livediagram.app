// A Calculated field's value as the editor reads it (docs/specs/026-plan/item-types.md "Calculated fields"): worked
// out from the plan's cards and its boards' done columns (the plan's status phases), never stored. The child index
// is made once per items map (childIndexFor), so a board of n cards costs one pass over the cards, not n.
import {
  calculatedValue,
  childIndexFor,
  donePhase,
  type CustomFieldDef,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';

export type CalculatedPlan = {
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  statusPhases: ReadonlyMap<string, string>;
};

export function calculatedFieldValue(
  plan: CalculatedPlan,
  field: Pick<CustomFieldDef, 'kind' | 'calculation'>,
  item: Pick<Item, 'id' | 'type'>,
): number | null {
  return calculatedValue(
    field,
    item,
    childIndexFor(plan.items, plan.types),
    donePhase(plan.statusPhases),
  );
}
