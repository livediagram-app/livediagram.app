'use client';

// Who a card can be assigned to (docs/specs/026-plan/items.md "Who may do what"): the joined members of the teams
// you are part of. Teams are liveworkspace's now (an account's token names the teams it has joined,
// liveworkspace/docs/accounts.md "Teams"), and their member lists are not offered to apps yet, so there is no one
// beyond the people already on the plan's cards.
import type { ItemPerson } from '@liveplanner/items';

const NO_PEOPLE: readonly ItemPerson[] = [];

export function useTeamPeople(
  _ownerId: string,
  _enabled: boolean,
  _signedIn: boolean,
): readonly ItemPerson[] {
  return NO_PEOPLE;
}
