// A card's hidden values (docs/specs/026-plan/item-types.md "The Hidden tab"): values under custom field ids its type
// doesn't show, kept from a type change, a field taken off its type, or a field or type deleted. Grouped by the type
// they came from, removed fields last; what Copy To Field may write each into, and the writes Copy To Field and Remove
// make. Only custom field ids are read (an allow-list), so built-in and system keys never show here. Pure.
import type { Item, ItemFields, ItemFieldValue, ItemPatch } from './item';
import type { CustomFieldDef, ItemTypeDef } from './item-types';
import { holdsValue } from './field-kind-change';
import { richFieldOf } from './rich-text-field';
import { CUSTOM_FIELD_ID_PATTERN } from './type-catalogue';
import { canTakeValue, DESCRIPTION_AS_LONG_TEXT, fieldsInto } from './card-retype-fields';

/** One hidden value: its field's id, the field as the type it came from defines it (absent: removed), the value. */
export type HiddenValue = { field: string; def?: CustomFieldDef; value: ItemFieldValue };
/** The hidden values one type defines (`type` null: Removed Fields, no type defines them). */
export type HiddenGroup = { type: ItemTypeDef | null; values: HiddenValue[] };

// Fields whose value is worked out or kept with threads, votes or time: never a value a person typed.
function isKeptElsewhere(def: CustomFieldDef): boolean {
  return (
    def.kind === 'calculated' ||
    def.kind === 'comments' ||
    def.kind === 'votes' ||
    (def.kind === 'duration' && def.timeSpent === true)
  );
}

/** The card's hidden values, grouped by the type they came from (catalogue order), Removed Fields last. */
export function hiddenValuesOf(
  item: Pick<Item, 'fields'>,
  type: ItemTypeDef,
  types: readonly ItemTypeDef[],
): HiddenGroup[] {
  const shown = new Set<string>([...type.fields, ...(type.custom ?? []).map((f) => f.id)]);
  const byType = new Map<ItemTypeDef, HiddenValue[]>();
  const removed: HiddenValue[] = [];
  for (const [field, value] of Object.entries(item.fields)) {
    if (shown.has(field) || !CUSTOM_FIELD_ID_PATTERN.test(field) || !holdsValue(value)) continue;
    let home: ItemTypeDef | undefined;
    let def: CustomFieldDef | undefined;
    for (const t of types) {
      def = t.custom?.find((f) => f.id === field);
      if (def) {
        home = t;
        break;
      }
    }
    if (!home || !def) {
      removed.push({ field, value });
      continue;
    }
    if (isKeptElsewhere(def)) continue;
    const list = byType.get(home) ?? [];
    list.push({ field, def, value });
    byType.set(home, list);
  }
  const groups: HiddenGroup[] = [];
  for (const t of types) {
    const values = byType.get(t);
    if (!values) continue;
    // In the order the type lists its fields.
    const order = (t.custom ?? []).map((f) => f.id);
    values.sort((a, b) => order.indexOf(a.field) - order.indexOf(b.field));
    groups.push({ type: t, values });
  }
  if (removed.length) {
    removed.sort((a, b) => a.field.localeCompare(b.field));
    groups.push({ type: null, values: removed });
  }
  return groups;
}

/** How many hidden values the groups hold: the tab's count. */
export function hiddenValueCount(groups: readonly HiddenGroup[]): number {
  return groups.reduce((n, g) => n + g.values.length, 0);
}

/** A removed field's value as plain text: a list joined with commas, a person or option by name, Yes or No. */
export function hiddenValueText(value: ItemFieldValue): string {
  if (value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(hiddenValueText).filter(Boolean).join(', ');
  for (const key of ['name', 'text', 'label']) {
    const v = value[key];
    if (typeof v === 'string') return v;
  }
  return '';
}

/** The fields of the card's own type `def`'s value can go into (spec "Copy To Field"): its custom fields, then the
 *  Description, each by the type-change rules and only when some of the value fits. */
export function hiddenCopyTargets(
  type: ItemTypeDef,
  def: CustomFieldDef,
  value: ItemFieldValue,
): CustomFieldDef[] {
  const fields: ItemFields = { [def.id]: value };
  const offered = new Set(type.fields);
  const candidates = [
    ...(type.custom ?? []).filter((f) => offered.has(f.id)),
    ...(offered.has('description') ? [DESCRIPTION_AS_LONG_TEXT] : []),
  ];
  return candidates.filter(
    (t) => canTakeValue(def, t) && Object.keys(fieldsInto(fields, def, t)).length > 0,
  );
}

/** Copy To Field's write: `def`'s value (and formatting) into `target`, over what it holds. */
export function hiddenCopyPatch(
  item: Pick<Item, 'fields'>,
  def: CustomFieldDef,
  target: CustomFieldDef,
): ItemPatch {
  const set = fieldsInto(item.fields, def, target);
  const rich = richFieldOf(target.id);
  // A target's own formatting goes when the copy brings none: it belongs to the text replaced.
  const clear = !(rich in set) && rich in item.fields ? [rich] : [];
  return clear.length ? { set, clear } : { set };
}

/** Remove's write: the one value and its formatting. */
export function hiddenRemovePatch(item: Pick<Item, 'fields'>, field: string): ItemPatch {
  return { clear: [field, richFieldOf(field)].filter((k) => k in item.fields) };
}
