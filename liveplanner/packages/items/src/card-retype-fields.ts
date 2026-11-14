// A card's custom fields as it changes type (docs/specs/026-plan/item-types.md "Changing a card's type"): each of the
// new type's custom fields takes the value of the old type's field with the same name and a compatible kind, Choice
// values only as the new field's options; nothing is cleared, so the old type's values stay on the card, hidden, and
// show again if it changes back. A rule's Change Card Type may also name explicit mappings (`TypeFieldMap`), applied
// after name matching and over it (spec "Explicit mappings"). The one rule every type change shares: the item panel's
// picker, board rows By Card Type, card tables, agents, the REST api and Automations; and the Hidden tab's Copy To
// Field reads the same compatibility (canTakeValue, valueInto). Pure.
import type { Item, ItemFieldValue, ItemFields } from './item';
import {
  CURRENCY_DEFAULT,
  linkTypesOf,
  ratingScaleOf,
  type CustomFieldDef,
  type CustomFieldKind,
  type ItemTypeDef,
} from './item-types';
import { changedValue, holdsValue } from './field-kind-change';
import { richFieldOf } from './rich-text-field';
import { typeIn } from './type-catalogue';

// The kinds that never map: worked out (Calculated), or kept with the card's threads and votes.
const NEVER_MAPS: ReadonlySet<CustomFieldKind> = new Set(['calculated', 'comments', 'votes']);
// Kinds that map into each other, besides the same kind.
const KIN: ReadonlyArray<ReadonlySet<CustomFieldKind>> = [
  new Set(['text', 'longtext']),
  new Set(['choice', 'multichoice']),
];

const nameKey = (label: string) => label.trim().toLowerCase();

/** An explicit mapping: a source custom field's id (of any type) into the new type's field (`description` too). */
export type TypeFieldMap = { from: string; to: string };

// The Description as a mapping or a copy target: it takes a value as a Long Text does (spec "Explicit mappings").
export const DESCRIPTION_FIELD = 'description';
export const DESCRIPTION_AS_LONG_TEXT: CustomFieldDef = {
  id: DESCRIPTION_FIELD,
  label: 'Description',
  kind: 'longtext',
};
const isTracking = (f: CustomFieldDef) => f.kind === 'duration' && f.timeSpent === true;

// Whether a value of `from` may go into `to` at all (spec "Compatible kinds").
export function canTakeValue(from: CustomFieldDef, to: CustomFieldDef): boolean {
  if (NEVER_MAPS.has(from.kind) || NEVER_MAPS.has(to.kind)) return false;
  if (isTracking(from) !== isTracking(to)) return false;
  if (from.kind !== to.kind) return KIN.some((k) => k.has(from.kind) && k.has(to.kind));
  if (to.kind === 'currency')
    return (from.currency ?? CURRENCY_DEFAULT) === (to.currency ?? CURRENCY_DEFAULT);
  if (to.kind === 'card') {
    // A field naming no type links any card; one naming some takes only a field whose types it all names.
    const takes = linkTypesOf(to);
    const gives = linkTypesOf(from);
    return takes.length === 0 || (gives.length > 0 && gives.every((t) => takes.includes(t)));
  }
  return true;
}

// A Choice or Multiple Choice value as `to`'s options hold it: each pick that is one of them, spelt as `to` spells it.
function choiceValue(to: CustomFieldDef, value: ItemFieldValue): ItemFieldValue | undefined {
  const picks = (Array.isArray(value) ? value : [value]).filter(
    (v): v is string => typeof v === 'string',
  );
  const options = to.options ?? [];
  const kept: string[] = [];
  for (const p of picks) {
    const option = options.find((o) => nameKey(o) === nameKey(p));
    if (option !== undefined && !kept.includes(option)) kept.push(option);
  }
  if (kept.length === 0) return undefined;
  return to.kind === 'choice' ? kept[0] : kept;
}

/** `from`'s value as `to` holds it, or undefined when none of it fits (call canTakeValue first). */
export function valueInto(
  from: CustomFieldDef,
  to: CustomFieldDef,
  value: ItemFieldValue,
): ItemFieldValue | undefined {
  if (to.kind === 'choice' || to.kind === 'multichoice') return choiceValue(to, value);
  if (to.kind === 'rating')
    return typeof value === 'number' && value <= ratingScaleOf(to) ? value : undefined;
  const changed = changedValue(from, to, value);
  if (changed.kind === 'kept') return value;
  return changed.kind === 'rewritten' ? changed.value : undefined;
}

// `def`'s value on a card holding `fields`, written into `target`: the value and, Long Text to Long Text (the
// Description too), its formatting. Empty when nothing fits.
export function fieldsInto(
  fields: ItemFields,
  def: CustomFieldDef,
  target: CustomFieldDef,
): ItemFields {
  const raw = fields[def.id];
  if (!holdsValue(raw) || !canTakeValue(def, target)) return {};
  const value = valueInto(def, target, raw!);
  if (!holdsValue(value)) return {};
  const out: ItemFields = { [target.id]: value! };
  const rich = fields[richFieldOf(def.id)];
  if (def.kind === 'longtext' && target.kind === 'longtext' && rich !== undefined)
    out[richFieldOf(target.id)] = rich;
  return out;
}

// The custom field `id` names: the old type's own first, else the first type of the catalogue defining it.
function sourceDef(
  id: string,
  from: ItemTypeDef,
  types: readonly ItemTypeDef[],
): CustomFieldDef | undefined {
  return (
    from.custom?.find((f) => f.id === id) ??
    types.flatMap((t) => t.custom ?? []).find((f) => f.id === id)
  );
}

/**
 * The values a card holding `fields` gains as it changes from type `from` to `to`: by `to`'s field id, each mapped
 * from `from`'s field of the same name (spec "A custom field maps by name"), then each explicit mapping of `map` over
 * them (spec "Explicit mappings"; `types` finds a source the old type lacks). Empty when nothing maps; never a clear.
 */
export function typeChangeFields(
  fields: ItemFields,
  from: ItemTypeDef,
  to: ItemTypeDef,
  map: readonly TypeFieldMap[] = [],
  types: readonly ItemTypeDef[] = [],
): ItemFields {
  const out: ItemFields = {};
  if (from.id === to.id) return out;
  if (from.custom?.length && to.custom?.length) {
    const fromIds = new Set([...from.fields, ...from.custom.map((f) => f.id)]);
    // The old type's fields by name, each name's first one holding a value.
    const byName = new Map<string, CustomFieldDef>();
    for (const f of from.custom) {
      const key = nameKey(f.label);
      if (!byName.has(key) && holdsValue(fields[f.id])) byName.set(key, f);
    }
    for (const t of to.custom) {
      // A field the old type has too (shared by id) already shows its value.
      if (fromIds.has(t.id)) continue;
      const s = byName.get(nameKey(t.label));
      if (s) Object.assign(out, fieldsInto(fields, s, t));
    }
  }
  for (const m of map) {
    const s = sourceDef(m.from, from, types);
    const t =
      m.to === DESCRIPTION_FIELD ? DESCRIPTION_AS_LONG_TEXT : to.custom?.find((f) => f.id === m.to);
    if (!s || !t) continue;
    const mapped = fieldsInto(fields, s, t);
    if (!Object.keys(mapped).length) continue;
    // It wins: a name match's formatting for the same target goes with its value.
    delete out[richFieldOf(t.id)];
    Object.assign(out, mapped);
  }
  return out;
}

/**
 * A write (a patch or a move) with the values its type change maps added to its `set` (spec "Changing a card's
 * type"): read from the card as the write leaves it, never over a value the write sets or clears on its own. A write
 * that changes no type comes back as it was.
 */
export function withTypeChangeFields<
  W extends { set?: ItemFields; clear?: string[]; type?: string },
>(
  item: Pick<Item, 'type' | 'fields'>,
  write: W,
  types: readonly ItemTypeDef[],
  map: readonly TypeFieldMap[] = [],
): W {
  if (write.type === undefined || write.type === item.type) return write;
  const fields: ItemFields = { ...item.fields, ...write.set };
  for (const k of write.clear ?? []) delete fields[k];
  const mapped = typeChangeFields(
    fields,
    typeIn(types, item.type),
    typeIn(types, write.type),
    map,
    types,
  );
  // A field the write gives its own value keeps its own formatting too.
  const given = [...Object.keys(write.set ?? {}), ...(write.clear ?? [])];
  const own = new Set([...given, ...given.map(richFieldOf)]);
  const add: ItemFields = {};
  for (const [k, v] of Object.entries(mapped)) if (!own.has(k)) add[k] = v;
  return Object.keys(add).length ? { ...write, set: { ...write.set, ...add } } : write;
}
