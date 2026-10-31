// Naming things as people do (docs/specs/026-plan/plan-agents.md "Naming things as people do"): what an agent
// writes ("In Progress", "Bug", "Severity", "Sam", "#12") resolved to what items store (a status id, a type id, a
// custom field id, a person, an item id). Unknown names are refused with what is there, never stored.
import { withArticle } from './indefinite-article';
import { isItemPerson, itemAssignee, type Item, type ItemPerson } from './item';
import {
  builtInFieldOfKind,
  isEmailAddress,
  ratingScaleOf,
  type CustomFieldDef,
  type ItemTypeDef,
} from './item-types';
import { holdsSeveral } from './several-values';
import { knownFieldKind, PRIORITIES, validDate, validateFields } from './fields';
import {
  FIELD_VALUES_MAX,
  ITEM_CHECKLIST_MAX,
  ITEM_LABEL_MAX,
  ITEM_LABELS_MAX,
  ITEM_NUMBER_MAX,
  ITEM_TITLE_MAX,
} from './limits';
import type { PlanStatusName } from './plan-outline';
import { resolveItemRef } from './refs';
import { statusKey } from './status-names';
import { isBuiltInFieldId, PLAN_TYPE_COLOURS, slugOf } from './type-catalogue';
import { itemSummary } from './views';

export type NameRefusalCode =
  | 'status_unknown'
  | 'type_unknown'
  | 'field_unknown'
  | 'choice_unknown'
  | 'item_unknown'
  | 'value_invalid';

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

// A column name or a status id, against the statuses the project's boards name.
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
      `No column "${input}": the plan has no board yet. Add one with add_board, or leave status out ` +
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

// An item by number or id prefix, as people say it; "#12 Fix login", as list_items reads a card link, by its number.
export function resolveItem(input: string, items: readonly Item[]): Named<{ item: Item }> {
  const titled = /^(#\d+)\s+\S/.exec(input.trim());
  const found = resolveItemRef(items, titled ? titled[1]! : input);
  if (found.ok) return { ok: true, item: found.item };
  return refuse(
    'item_unknown',
    found.reason === 'ambiguous'
      ? `"${input}" names more than one item: ${found.matches.map(itemSummary).join('; ')}`
      : `No item "${input}". List them with list_items.`,
  );
}

// The people already assigned on the project, once each by id.
export function assignedPeople(items: readonly Item[]): ItemPerson[] {
  const seen = new Map<string, ItemPerson>();
  for (const it of items) {
    const p = itemAssignee(it);
    if (p && !seen.has(p.id)) seen.set(p.id, p);
  }
  return [...seen.values()];
}

// A person by name: one already assigned on the project, else a named person whose id comes from the name, so the
// same name is the same person on every card. A new person's colour starts from the name and steps on past any
// colour someone on the project already has, so two people never share one while colours remain.
export function personNamed(name: string, people: readonly ItemPerson[]): ItemPerson {
  const key = statusKey(name);
  const known = people.find((p) => statusKey(p.name) === key);
  if (known) return known;
  const slug = personSlug(name, key, people);
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const taken = new Set(people.map((p) => p.color.toLowerCase()));
  const n = PLAN_TYPE_COLOURS.length;
  let pick = hash % n;
  for (let step = 0; step < n && taken.has(PLAN_TYPE_COLOURS[pick]!.toLowerCase()); step++)
    pick = (pick + 1) % n;
  return { id: `n-${slug}`, name: name.trim(), color: PLAN_TYPE_COLOURS[pick]! };
}

// A new person's id slug: the name's, so "Sam" is `n-sam` everywhere. A name the slug cannot spell (one in a script
// it drops, "Иван") or one shortened onto someone else's id gets a hash of the whole name, so two people never
// share an id (and so a swimlane or an assignee filter).
function personSlug(name: string, key: string, people: readonly ItemPerson[]): string {
  const slug = slugOf(name, 30);
  if (slug && !people.some((p) => p.id === `n-${slug}`)) return slug;
  let h = 0x811c9dc5;
  for (const ch of key) h = Math.imul(h ^ ch.codePointAt(0)!, 0x01000193) >>> 0;
  return `${(slug || 'person').slice(0, 22).replace(/-+$/, '')}-${h.toString(36)}`;
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

interface FieldNaming {
  statuses: readonly PlanStatusName[];
  items: readonly Item[];
}

// A Choice option as written: the option itself, else the one option equal case and spacing aside, else the one
// whose letters and digits match ("in-progress" for "In Progress"). Options of symbols alone ("★", "★★") match only
// exactly, and a key two options share names neither, so a value is never stored as the wrong option.
export function choiceOption(options: readonly string[], value: string): string | undefined {
  if (options.includes(value)) return value;
  const loose = (s: string) => s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  const byCase = options.filter((o) => loose(o) === loose(value));
  if (byCase.length === 1) return byCase[0];
  const key = statusKey(value);
  if (!key) return undefined;
  const byKey = options.filter((o) => statusKey(o) === key);
  return byKey.length === 1 ? byKey[0] : undefined;
}

// Fields as an agent writes them, for an item of `type`: built-in fields by id or interface name, custom fields
// by id or name, a status by column name, an assignee by name, a parent or Card field by item number, a priority
// or Choice option case aside. A key the type does not have is refused.
// A field's key as items store it: a built-in field by id or interface name, or a custom field of `type` by id or
// name. A key the type does not have is refused.
// A field by id or name on `type`: a built-in's id first, then the type's own custom field by name, then a built-in by
// another name the interface gives it ("Owner" is a custom Owner field where the type has one, else the Assignee).
export function fieldKeyOf(key: string, type: ItemTypeDef): Named<{ key: string }> {
  const k = statusKey(key);
  if (isBuiltInFieldId(key)) return { ok: true, key };
  if (isBuiltInFieldId(k)) return { ok: true, key: k };
  const field = type.custom?.find((f) => f.id === key || statusKey(f.label) === k);
  if (field) return { ok: true, key: field.id };
  const alias = BUILT_IN_ALIASES[k];
  if (alias) return { ok: true, key: alias };
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
    // Pictures are uploaded in the card panel, never named (docs/specs/026-plan/items.md "Attachments").
    if (key === 'attachments')
      return refuse('value_invalid', 'Attachments are added in the card panel.');
    if (isBuiltInFieldId(key)) {
      const v = builtInValue(key, value, naming);
      if (!v.ok) return v;
      const checked = checkedBuiltIn(key, v.value);
      if (!checked.ok) return checked;
      out[key] = checked.value;
      continue;
    }
    const field = type.custom!.find((f) => f.id === key)!;
    // The built-in fields' kinds take what those fields take (docs/specs/026-plan/item-types.md "Custom field kinds"):
    // a person by name, labels by commas, a colour as #rrggbb, checklist rows.
    // Threads and votes have writes of their own (docs/specs/026-plan/item-types.md "Comments and Votes fields").
    if (field.kind === 'comments')
      return refuse(
        'value_invalid',
        `${field.label} is a Comments field: start a thread in it with change_threads.`,
      );
    if (field.kind === 'votes')
      return refuse(
        'value_invalid',
        `${field.label} is a Votes field: votes come from a session vote.`,
      );
    // A Person or Card field that holds several takes a comma list or a list (item-types.md "Holds Several").
    if (holdsSeveral(field)) {
      const v = severalNamed(field, value, naming);
      if (!v.ok) return v;
      out[key] = v.value;
      continue;
    }
    const asBuiltIn = builtInFieldOfKind(field.kind);
    if (asBuiltIn) {
      const v = builtInValue(asBuiltIn, value, naming);
      if (!v.ok) return v;
      const checked = checkedBuiltIn(asBuiltIn, v.value, field.label);
      if (!checked.ok) return checked;
      out[key] = checked.value;
      continue;
    }
    // A picture is uploaded in the card panel, never named (docs/specs/026-plan/item-types.md "Image fields").
    if (field.kind === 'image')
      return refuse('value_invalid', `${field.label} is an image: add one in the card panel.`);
    if (field.kind === 'choice' && typeof value === 'string') {
      const option = choiceOption(field.options ?? [], value);
      if (!option)
        return refuse(
          'choice_unknown',
          `"${value}" is not ${withArticle(field.label)} option. Options: ${list(field.options ?? [])}.`,
        );
      out[key] = option;
    } else if (
      field.kind === 'multichoice' &&
      (typeof value === 'string' || Array.isArray(value))
    ) {
      const names = typeof value === 'string' ? [value] : value;
      const picks: string[] = [];
      for (const name of names) {
        const option =
          typeof name === 'string' ? choiceOption(field.options ?? [], name) : undefined;
        if (!option)
          return refuse(
            'choice_unknown',
            `"${String(name)}" is not ${withArticle(field.label)} option. Options: ${list(field.options ?? [])}.`,
          );
        if (!picks.includes(option)) picks.push(option);
      }
      // Kept in option order, as the card panel keeps them.
      out[key] = (field.options ?? []).filter((o) => picks.includes(o));
    } else if (field.kind === 'rating') {
      const scale = ratingScaleOf(field);
      const n = typeof value === 'string' ? Number(value) : value;
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > scale)
        return refuse(
          'value_invalid',
          `${field.label} is a rating: give a whole number from 1 to ${scale}.`,
        );
      out[key] = n;
    } else if (field.kind === 'number' && typeof value === 'string') {
      // A number written as text is read as the number, as a built-in Number's is.
      const n = value.trim() === '' ? NaN : Number(value.trim());
      if (!Number.isFinite(n))
        return refuse(
          'value_invalid',
          `"${value}" is not a number for ${field.label}: give a number.`,
        );
      out[key] = n;
    } else if (field.kind === 'date' && typeof value === 'string') {
      if (!validDate(value.trim()))
        return refuse(
          'value_invalid',
          `"${value}" is not a date for ${field.label}: give a date, such as 2026-10-14.`,
        );
      out[key] = value.trim();
    } else if (field.kind === 'currency' && typeof value === 'string') {
      // "£12,500" or "1200.50": the amount, its symbols and grouping aside.
      const amount = Number(value.replace(/[^\d.-]/g, ''));
      if (!/\d/.test(value) || !Number.isFinite(amount))
        return refuse(
          'value_invalid',
          `"${value}" is not an amount for ${field.label}: give a number.`,
        );
      out[key] = Math.round(amount * 100) / 100;
    } else if (field.kind === 'currency' && typeof value === 'number') {
      out[key] = Math.round(value * 100) / 100;
    } else if (field.kind === 'email' && typeof value === 'string') {
      const address = value.trim();
      if (!isEmailAddress(address))
        return refuse('value_invalid', `"${value}" is not an email address for ${field.label}.`);
      out[key] = address;
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

// A field that holds several, from "Sam, Ana" or ["Sam", "Ana"] (people by name, cards by number or "#12 Title"), or a
// value of one: each resolved as one value of its kind is, each once, at most FIELD_VALUES_MAX.
function severalNamed(
  field: CustomFieldDef,
  value: unknown,
  naming: FieldNaming,
): Named<{ value: unknown }> {
  const parts = (
    Array.isArray(value)
      ? (value as unknown[])
      : typeof value === 'string'
        ? value.split(',')
        : [value]
  )
    .map((p: unknown) => (typeof p === 'string' ? p.trim() : p))
    .filter((p) => p !== '' && p !== null && p !== undefined);
  if (parts.length === 0)
    return refuse('value_invalid', `${field.label}: give at least one, or clear the field.`);
  if (parts.length > FIELD_VALUES_MAX)
    return refuse('value_invalid', `${field.label} holds up to ${FIELD_VALUES_MAX}.`);
  if (field.kind === 'person') {
    const people: ItemPerson[] = [];
    for (const p of parts) {
      const person = isItemPerson(p)
        ? p
        : typeof p === 'string'
          ? personNamed(p, [...people, ...assignedPeople(naming.items)])
          : undefined;
      if (!person)
        return refuse('value_invalid', `${field.label} takes people by name, such as "Sam, Ana".`);
      if (!people.some((x) => x.id === person.id)) people.push(person);
    }
    return { ok: true, value: people };
  }
  const ids: string[] = [];
  for (const p of parts) {
    const linked = resolveItem(String(p), naming.items);
    if (!linked.ok) return linked;
    if (!ids.includes(linked.item.id)) ids.push(linked.item.id);
  }
  return { ok: true, value: ids };
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

// A built-in field's value held to the rules the server holds it to (validateFields), so a card table row or an
// agent's change is refused here, naming the field and what it takes, rather than as a bare `field_value_invalid`
// from the api (the production Error·Api·Http400.ItemChange.FieldValueInvalid). A number given as text ("5") is
// read as the number.
function checkedBuiltIn(
  key: string,
  value: unknown,
  name = key.charAt(0).toUpperCase() + key.slice(1),
): Named<{ value: unknown }> {
  const kind = knownFieldKind(key);
  if (!kind) return { ok: true, value };
  const given =
    kind === 'number' &&
    typeof value === 'string' &&
    value.trim() !== '' &&
    Number.isFinite(Number(value))
      ? Number(value)
      : value;
  const result = validateFields({ [key]: given }, 'patch');
  if (result.ok) return { ok: true, value: result.fields[key] };
  const label = name;
  const shown = typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
  const takes: Partial<Record<string, string>> = {
    number: `a number from 0 to ${ITEM_NUMBER_MAX}`,
    date: 'a date, such as 2026-10-14',
    priority: `one of ${list(PRIORITIES.map((p) => p.charAt(0).toUpperCase() + p.slice(1)))}`,
    flag: 'TRUE, or nothing to leave it off',
    colour: 'a colour as #rrggbb',
    labels: `up to ${ITEM_LABELS_MAX} labels of up to ${ITEM_LABEL_MAX} characters`,
    checklist: `up to ${ITEM_CHECKLIST_MAX} rows`,
    text: `up to ${ITEM_TITLE_MAX} characters`,
  };
  return refuse(
    'value_invalid',
    `${shown} is not ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}: give ${takes[kind] ?? 'a value it can hold'}.`,
  );
}
