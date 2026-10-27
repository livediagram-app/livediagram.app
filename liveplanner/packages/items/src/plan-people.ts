// Who a card can be assigned to (docs/specs/026-plan/items.md "Who may do what"): you, your teams' members and the
// plan's custom assignees, the people its cards already hold. Custom assignees are worked out from the cards, never
// stored, so one leaves the picker once no card holds them.
import type { ItemPerson } from './item';

// A named person: a custom assignee, or a name an agent or the CLI assigned (plan-names.ts personNamed). Never an
// account, so never someone to notify or to match against a signed-in person.
export const NAMED_PERSON_PREFIX = 'n-';

export const isNamedPerson = (person: Pick<ItemPerson, 'id'>): boolean =>
  person.id.startsWith(NAMED_PERSON_PREFIX);

// Self, then team members, then everyone the cards hold, once each by id (the first source wins), sorted by name.
export function planPeople(
  self: ItemPerson | null | undefined,
  team: readonly ItemPerson[],
  assigned: readonly ItemPerson[],
): ItemPerson[] {
  const byId = new Map<string, ItemPerson>();
  if (self) byId.set(self.id, self);
  for (const p of team) if (!byId.has(p.id)) byId.set(p.id, p);
  for (const p of assigned) if (!byId.has(p.id)) byId.set(p.id, p);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// A key that changes only when the people do, so a list rebuilt on every card write can keep its identity.
export const peopleKey = (people: readonly ItemPerson[]): string =>
  people.map((p) => `${p.id}\u0000${p.name}\u0000${p.color}`).join('\u0001');
