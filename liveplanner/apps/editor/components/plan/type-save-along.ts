// What comes with a type's save when its fields change type (docs/specs/026-plan/item-types.md "Edit Field": Saving
// the type, Filters on the field, Another type): its cards' values rewritten (one write) and its fields' filters taken
// off the boards and views once both land, saved all or none with the type (retype-settle.ts). Undefined when no
// field changes type.
import {
  changesValues,
  fieldRetypeTargets,
  typeSavePatches,
  type CustomFieldDef,
  type Item,
  type ItemPatchOf,
  type ItemPerson,
  type ItemTypeDef,
  type FieldRetypeTarget,
} from '@liveplanner/items';
import type { SaveAlong } from '@/hooks/plan/retype-settle';
import type { ValuesWrite } from '@/hooks/plan/item-undo-journal';

export function typeSaveAlong(
  before: ItemTypeDef,
  after: ItemTypeDef,
  retyped: Readonly<Record<string, string>>,
  ctx: {
    types: readonly ItemTypeDef[];
    items: ReadonlyMap<string, Item>;
    people: readonly ItemPerson[];
    reshapeValues?: ((patches: readonly ItemPatchOf[]) => Promise<ValuesWrite>) | undefined;
    removeFieldFilters?: ((targets: readonly FieldRetypeTarget[]) => boolean) | undefined;
  },
): SaveAlong | undefined {
  const typesAfter = ctx.types.map((t) => (t.id === after.id ? after : t));
  const targets = fieldRetypeTargets(before, after, retyped, typesAfter);
  const patches = typeSavePatches(before, after, retyped, ctx.types, ctx.items.values(), {
    people: ctx.people,
    items: ctx.items,
  });
  if (targets.length === 0 && patches.length === 0) return undefined;
  // The toast names the first field changed: a built-in by its new field's name.
  const changed = (f: CustomFieldDef) => {
    const was = before.custom?.find((w) => w.id === f.id);
    return !!was && changesValues(was, f);
  };
  const first = Object.keys(retyped)[0] ?? targets[0]?.field ?? after.custom?.find(changed)?.id;
  const name = after.custom?.find((f) => f.id === first)?.label ?? 'the field';
  const { reshapeValues, removeFieldFilters } = ctx;
  return {
    name,
    ...(patches.length && reshapeValues ? { values: reshapeValues(patches) } : {}),
    ...(targets.length && removeFieldFilters ? { settle: () => removeFieldFilters(targets) } : {}),
  };
}
