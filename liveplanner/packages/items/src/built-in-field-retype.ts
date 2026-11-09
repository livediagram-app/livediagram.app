// A built-in field given another type on one card type (docs/specs/026-plan/item-types.md "Edit Field": Built-in
// fields, "Another type"): it becomes a custom field of the picked type in its place, and its values move to the new
// field by Edit Field's own rules (field-kind-change.ts), each read first as the built-in holds it. Status never
// changes type. Pure.
import { CARD_SIZES } from './board';
import { typeCardLayout, type CardLayout, type CardSlot } from './card-display';
import {
  fieldKindChange,
  kindChangeRefusal,
  retypedValuePatches,
  type FieldCards,
  type KindChangeContext,
  type KindChangeOutcome,
  type KindShape,
  type ValueReader,
} from './field-kind-change';
import { PRIORITIES, PRIORITY_LABELS, isPriority } from './fields';
import type { Item, ItemFieldValue, ItemPatch } from './item';
import type { ItemPatchOf } from './store';
import type { CustomFieldDef, ItemFieldId, ItemTypeDef } from './item-types';
import { inheritingTypesOf } from './type-inheritance';
import type { CardField } from './board';

// Each renamable built-in as the custom kind it is (Add Field's tile it opens on).
export const BUILT_IN_KIND_SHAPES: Readonly<Partial<Record<ItemFieldId, KindShape>>> = {
  description: { kind: 'longtext' },
  estimate: { kind: 'number' },
  start: { kind: 'date' },
  due: { kind: 'date' },
  priority: { kind: 'choice', options: PRIORITIES.map((p) => PRIORITY_LABELS[p]) },
  labels: { kind: 'labels' },
  assignee: { kind: 'person' },
  color: { kind: 'colour' },
  checklist: { kind: 'checklist' },
  comments: { kind: 'comments' },
  votes: { kind: 'votes' },
  attachments: { kind: 'image' },
  status: { kind: 'choice' },
};

export const STATUS_KEEPS_TYPE = 'Status places the card in a column, so it keeps its type.';
export const TITLE_KEEPS_TYPE = 'Title names the card, so it keeps its type.';
export const ATTACHMENTS_KEEP_TYPE = 'Attachments hold uploaded files, so they keep their type.';

/**
 * Why the built-in `id` can't become a field of shape `to`, or null when it can (its own shape always can). The
 * reason names the rule that holds: Attachments opens on Image's tile but is no Image, so it says its own line.
 */
export function builtInRetypeRefusal(id: ItemFieldId, to: KindShape): string | null {
  if (id === 'status') return STATUS_KEEPS_TYPE;
  const shape = BUILT_IN_KIND_SHAPES[id];
  if (!shape) return TITLE_KEEPS_TYPE;
  const refusal = kindChangeRefusal(shape, to);
  return refusal && id === 'attachments' ? ATTACHMENTS_KEEP_TYPE : refusal;
}

/** A built-in's stored value as its shape holds it: a Priority by its name ("High"), the rest as stored. */
export function builtInValueOf(
  id: string,
  raw: ItemFieldValue | undefined,
): ItemFieldValue | undefined {
  if (id !== 'priority') return raw;
  return isPriority(raw) ? PRIORITY_LABELS[raw] : undefined;
}

/** The reader for a built-in's values (fieldValues, fieldKindChange), or undefined when they read as stored. */
export function builtInReader(id: string): ValueReader | undefined {
  return id === 'priority' ? (raw) => builtInValueOf(id, raw) : undefined;
}

/**
 * The cards a type's built-in field is on: the type's own, and those of each type taking the field from it (an
 * inherited type that lists it as its own keeps its own copy).
 */
export function builtInCardsOf(
  typeId: string,
  id: ItemFieldId,
  types: readonly ItemTypeDef[],
): FieldCards {
  const typeIds = new Set([typeId]);
  for (const t of inheritingTypesOf(typeId, types))
    if (t.fields.includes(id) && !t.ownFields?.includes(id)) typeIds.add(t.id);
  return { field: id, typeIds };
}

const swap = (list: readonly string[], from: string, to: string) =>
  list.map((f) => (f === from ? to : f));

// Each card size's layout with the field swapped in, made whole from the type's default where it had none.
function displaySwapped(type: ItemTypeDef, from: string, to: string): ItemTypeDef['display'] {
  let display = type.display;
  for (const size of CARD_SIZES) {
    const layout = typeCardLayout(type, size);
    if (!Object.values(layout).some((fs) => fs?.includes(from as CardField))) continue;
    const next: CardLayout = {};
    for (const [slot, fs] of Object.entries(layout) as [CardSlot, readonly CardField[]][])
      next[slot] = swap(fs, from, to) as CardField[];
    display = { ...display, [size]: next };
  }
  return display;
}

/**
 * The type with its built-in `id` given way to the custom field `def`: `def` in its place among the type's fields,
 * own fields, tabs and card display; the type's name for the built-in dropped (and the Assignee's Notifies, a Colour
 * field taking over as the Card Colour).
 */
export function retypeBuiltInIn(
  type: ItemTypeDef,
  id: ItemFieldId,
  def: CustomFieldDef,
): ItemTypeDef {
  const {
    fieldLabels,
    assigneeNotifies,
    display: _display,
    ownFields,
    tabs,
    colourField,
    ...rest
  } = type;
  const { [id]: _was, ...labels } = fieldLabels ?? {};
  const display = displaySwapped(type, id, def.id);
  return {
    ...rest,
    fields: swap(type.fields, id, def.id),
    custom: [...(type.custom ?? []), def],
    ...(ownFields ? { ownFields: swap(ownFields, id, def.id) } : {}),
    ...(tabs ? { tabs: tabs.map((t) => ({ ...t, fields: swap(t.fields, id, def.id) })) } : {}),
    ...(Object.keys(labels).length ? { fieldLabels: labels } : {}),
    ...(assigneeNotifies === false && id !== 'assignee' ? { assigneeNotifies } : {}),
    ...(display ? { display } : {}),
    ...(id === 'color' && def.kind === 'colour'
      ? { colourField: def.id }
      : colourField
        ? { colourField }
        : {}),
  };
}

/**
 * One pass over the plan's cards: what moving the built-in `id`'s values on `on` to a new field `into` of shape `to`
 * does (held, cut down, cleared), and the patches that set the new field and clear the built-in.
 */
export function builtInRetypePatches(
  id: ItemFieldId,
  to: KindShape,
  into: string,
  items: Iterable<Item>,
  on: FieldCards,
  ctx: KindChangeContext = {},
): KindChangeOutcome {
  const shape = BUILT_IN_KIND_SHAPES[id] ?? { kind: 'text' };
  const read = builtInReader(id);
  return fieldKindChange(shape, to, items, on, ctx, { into, ...(read ? { read } : {}) });
}

/**
 * Every write a type's save makes to its cards (docs/specs/026-plan/item-types.md "Edit Field"): its custom fields'
 * changed values (retypedValuePatches) and each built-in made a custom field (`retyped`, new field id to built-in id)
 * moving its values across, one patch per card however many fields changed on it.
 */
export function typeSavePatches(
  before: ItemTypeDef,
  after: ItemTypeDef,
  retyped: Readonly<Record<string, string>>,
  types: readonly ItemTypeDef[],
  items: Iterable<Item>,
  ctx: KindChangeContext = {},
): ItemPatchOf[] {
  const list = [...items];
  const byId = new Map<string, ItemPatch>();
  const add = (patches: readonly ItemPatchOf[]) => {
    for (const { id, patch } of patches) {
      const into = byId.get(id) ?? {};
      if (patch.set) into.set = { ...into.set, ...patch.set };
      if (patch.clear) into.clear = [...(into.clear ?? []), ...patch.clear];
      byId.set(id, into);
    }
  };
  add(retypedValuePatches(before, after, types, list, ctx));
  for (const [into, id] of Object.entries(retyped)) {
    const def = after.custom?.find((f) => f.id === into);
    if (!def || !BUILT_IN_KIND_SHAPES[id as ItemFieldId]) continue;
    const on = builtInCardsOf(before.id, id as ItemFieldId, types);
    add(builtInRetypePatches(id as ItemFieldId, def, into, list, on, ctx).patches);
  }
  return [...byId].map(([id, patch]) => ({ id, patch }));
}
