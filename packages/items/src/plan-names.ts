// Naming things as people do (docs/specs/026-plan/plan-agents.md "Naming things as people do"): what an agent
// writes ("In Progress", "Bug", "Severity", "Sam", "#12") resolved to what items store (a status id, a type id, a
// custom field id, a person, an item id). Unknown names are refused with what is there, never stored.
import { isItemPerson, itemAssignee, type Item, type ItemPerson } from './item';
import type { ItemTypeDef } from './item-types';
import { PRIORITIES } from './fields';
import type { PlanStatusName } from './plan-outline';
import { resolveItemRef } from './refs';
import { statusKey } from './status-names';
import { isBuiltInFieldId, PLAN_TYPE_COLOURS, slugOf } from './type-catalogue';
import { itemSummary } from './views';

export type NameRefusalCode =
  'status_unknown' | 'type_unknown' | 'field_unknown' | 'choice_unknown' | 'item_unknown';

export interface NameRefusal {
  code: NameRefusalCode;
  message: string;
}

export type Named<T> = ({ ok: true } & T) | ({ ok: false } & NameRefusal);

const list = (names: readonly string[]) => names.join(', ');

const refuse = (code: NameRefusalCode, message: string): { ok: false } & NameRefusal => ({
  ok: false,
  code,
  message,
});

// A column name or a status id, against the statuses the document's boards name.
export function resolveStatus(
  input: string,
  statuses: readonly PlanStatusName[],
): Named<{ status: string; name: string }> {
  const exact = statuses.find((s) => s.status === input);
  if (exact) return { ok: true, ...exact };
  const key = statusKey(input);
  const named = key ? statuses.find((s) => statusKey(s.name) === key) : undefined;
  if (named) return { ok: true, ...named };
  if (statuses.length === 0)
    return refuse(
      'status_unknown',
      `No column "${input}": the document has no Plan board yet. Add one with add_board, or leave status out ` +
        'to make the card off every board.',
    );
  return refuse(
    'status_unknown',
    `No column "${input}". Columns: ${list(statuses.map((s) => s.name))}.`,
  );
}

// A card type by id or name.
export function resolveType(
  input: string,
  types: readonly ItemTypeDef[],
): Named<{ type: ItemTypeDef }> {
  const exact = types.find((t) => t.id === input);
  if (exact) return { ok: true, type: exact };
  const key = statusKey(input);
  const named = key ? types.find((t) => statusKey(t.label) === key) : undefined;
  if (named) return { ok: true, type: named };
  return refuse(
    'type_unknown',
    `No card type "${input}". Card types: ${list(types.map((t) => `${t.label} (${t.id})`))}. ` +
      'Add one with change_card_types.',
  );
}

// An item by number or id prefix, as people say it.
export function resolveItem(input: string, items: readonly Item[]): Named<{ item: Item }> {
  const found = resolveItemRef(items, input);
  if (found.ok) return { ok: true, item: found.item };
  return refuse(
    'item_unknown',
    found.reason === 'ambiguous'
      ? `"${input}" names more than one item: ${found.matches.map(itemSummary).join('; ')}`
      : `No item "${input}". List them with list_items.`,
  );
}

// The people already assigned on the document, once each by id.
export function assignedPeople(items: readonly Item[]): ItemPerson[] {
  const seen = new Map<string, ItemPerson>();
  for (const it of items) {
    const p = itemAssignee(it);
    if (p && !seen.has(p.id)) seen.set(p.id, p);
  }
  return [...seen.values()];
}

// A person by name: one already assigned on the document, else a named person whose id and colour come from the
// name, so the same name is the same person on every card.
export function personNamed(name: string, people: readonly ItemPerson[]): ItemPerson {
  const key = statusKey(name);
  const known = people.find((p) => statusKey(p.name) === key);
  if (known) return known;
  const slug = slugOf(name, 30) || 'person';
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    id: `n-${slug}`,
    name: name.trim(),
    color: PLAN_TYPE_COLOURS[hash % PLAN_TYPE_COLOURS.length]!,
  };
}

// Built-in fields by the names the interface gives them, beside their ids.
const BUILT_IN_ALIASES: Readonly<Record<string, string>> = {
  duedate: 'due',
  startdate: 'start',
  colour: 'color',
  label: 'labels',
  assignedto: 'assignee',
  owner: 'assignee',
};

function builtInKey(key: string): string | undefined {
  if (isBuiltInFieldId(key)) return key;
  const k = statusKey(key);
  if (isBuiltInFieldId(k)) return k;
  return BUILT_IN_ALIASES[k];
}

export interface FieldNaming {
  statuses: readonly PlanStatusName[];
  items: readonly Item[];
}

// Fields as an agent writes them, for an item of `type`: built-in fields by id or interface name, custom fields
// by id or name, a status by column name, an assignee by name, a parent or Card field by item number, a priority
// or Choice option case aside. A key the type does not have is refused.
// A field's key as items store it: a built-in field by id or interface name, or a custom field of `type` by id or
// name. A key the type does not have is refused.
export function fieldKeyOf(key: string, type: ItemTypeDef): Named<{ key: string }> {
  const builtIn = builtInKey(key);
  if (builtIn) return { ok: true, key: builtIn };
  const k = statusKey(key);
  const field = type.custom?.find((f) => f.id === key || statusKey(f.label) === k);
  if (field) return { ok: true, key: field.id };
  const names = [
    ...type.fields.filter((f) => isBuiltInFieldId(f)),
    ...(type.custom ?? []).map((f) => f.label),
  ];
  return refuse(
    'field_unknown',
    `${type.label} cards have no field "${key}". Fields: ${list(names)}. ` +
      'Add a custom field with change_card_types.',
  );
}

// Fields as an agent writes them, for an item of `type`: keys as fieldKeyOf reads them, a status by column name,
// an assignee by name, a parent or Card field by item number, a priority or Choice option case aside.
export function resolveFields(
  input: Readonly<Record<string, unknown>>,
  type: ItemTypeDef,
  naming: FieldNaming,
): Named<{ fields: Record<string, unknown> }> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(input)) {
    const named = fieldKeyOf(rawKey, type);
    if (!named.ok) return named;
    const key = named.key;
    if (isBuiltInFieldId(key)) {
      const v = builtInValue(key, value, naming);
      if (!v.ok) return v;
      out[key] = v.value;
      continue;
    }
    const field = type.custom!.find((f) => f.id === key)!;
    if (field.kind === 'choice' && typeof value === 'string') {
      const option = field.options?.find((o) => statusKey(o) === statusKey(value));
      if (!option)
        return refuse(
          'choice_unknown',
          `"${value}" is not a ${field.label} option. Options: ${list(field.options ?? [])}.`,
        );
      out[key] = option;
    } else if (field.kind === 'card' && typeof value === 'string') {
      const linked = resolveItem(value, naming.items);
      if (!linked.ok) return linked;
      out[key] = linked.item.id;
    } else {
      out[key] = value;
    }
  }
  return { ok: true, fields: out };
}

function builtInValue(key: string, value: unknown, naming: FieldNaming): Named<{ value: unknown }> {
  if (key === 'status' && typeof value === 'string') {
    const s = resolveStatus(value, naming.statuses);
    return s.ok ? { ok: true, value: s.status } : s;
  }
  if (key === 'assignee' && typeof value === 'string' && !isItemPerson(value))
    return { ok: true, value: personNamed(value, assignedPeople(naming.items)) };
  if (key === 'parent' && typeof value === 'string') {
    const parent = resolveItem(value, naming.items);
    return parent.ok ? { ok: true, value: parent.item.id } : parent;
  }
  if (key === 'priority' && typeof value === 'string') {
    const p = PRIORITIES.find((x) => x === value.trim().toLowerCase());
    return { ok: true, value: p ?? value };
  }
  if (key === 'labels' && typeof value === 'string')
    return {
      ok: true,
      value: value
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean),
    };
  return { ok: true, value };
}
