// Notifying Person fields (docs/specs/026-plan/item-types.md "Notifies"): which of a type's Person fields tell their
// person when a card is theirs, and who a card tells. One reading for the Inbox push, emails and Only Mine.
import type { Item, ItemPerson } from './item';
import type { ItemTypeDef } from './item-types';
import { isNamedPerson } from './plan-people';
import { fieldPeople } from './several-values';

type NotifyingType = Pick<ItemTypeDef, 'fields' | 'custom' | 'assigneeNotifies'>;

// The Assignee notifies unless its type switched it off; a custom Person field only when switched on.
function fieldNotifies(type: NotifyingType, fieldId: string): boolean {
  if (fieldId === 'assignee') return type.assigneeNotifies !== false;
  const field = type.custom?.find((f) => f.id === fieldId);
  return field?.kind === 'person' && field.notifies === true;
}

// The ids of the fields of `type` that notify, in the type's field order; a field the type no longer offers never does.
export function notifyingFieldsOf(type: NotifyingType): string[] {
  return type.fields.filter((id) => fieldNotifies(type, id));
}

// One person a card tells, and the field that names them.
export interface NotifiedPerson {
  fieldId: string;
  person: ItemPerson;
}

// The people a card of `type` tells, once each, by the first notifying field that names them (every person of a field
// that holds several): an empty field and a custom person (an `n-` id, never an account) tell no one.
export function notifiedPeople(type: NotifyingType, item: Pick<Item, 'fields'>): NotifiedPerson[] {
  const out: NotifiedPerson[] = [];
  const told = new Set<string>();
  for (const fieldId of notifyingFieldsOf(type)) {
    // Each of a field's people when it holds several (item-types.md "Holds Several"); the Assignee holds one.
    const def = type.custom?.find((f) => f.id === fieldId);
    for (const person of fieldPeople(def, item.fields[fieldId])) {
      if (isNamedPerson(person) || told.has(person.id)) continue;
      told.add(person.id);
      out.push({ fieldId, person });
    }
  }
  return out;
}

// Whether a card is `personId`'s: a notifying field of its type holds them (Only Mine).
export function isNotified(
  type: NotifyingType,
  item: Pick<Item, 'fields'>,
  personId: string,
): boolean {
  return notifiedPeople(type, item).some((p) => p.person.id === personId);
}
