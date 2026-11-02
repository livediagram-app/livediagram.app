// Count In (docs/specs/012-collaboration/session-tools.md "Voting on Plan cards"): the Votes fields a session vote on
// a tab can count in, and its tally split by where each card's dots land. Pure.
import type { PlanBoardSetup } from './board';
import { cardTypesTakenOnTab } from './board-card-types';
import { CARD_FIELD_LABELS } from './card-display';
import { VOTES_FIELD, tallyFieldOn, votesFieldsAcross } from './comments-votes-fields';
import type { ItemTypeDef } from './item-types';
import type { ItemTally, ItemWrite } from './store';

export type VoteCountInChoice = { id: string; label: string };

/** The Votes fields the card types shown on the tab's boards offer, the built-in Votes first: empty when there is
 *  only the built-in (nothing to pick, so the set-up shows no Count In). */
export function voteCountInChoices(
  setups: readonly (Pick<PlanBoardSetup, 'addTypes' | 'archive'> | null | undefined)[],
  types: readonly ItemTypeDef[],
): VoteCountInChoice[] {
  const taken = cardTypesTakenOnTab(setups);
  const shown =
    taken.kind === 'all'
      ? types
      : taken.kind === 'some'
        ? types.filter((t) => taken.types.has(t.id))
        : [];
  const fields = votesFieldsAcross(shown);
  if (fields.length < 2) return [];
  return fields.map((id) => ({
    id,
    label:
      id === VOTES_FIELD
        ? CARD_FIELD_LABELS.votes
        : shown.flatMap((t) => t.custom ?? []).find((c) => c.id === id)!.label,
  }));
}

/** A vote's tally as the writes that land it: the cards whose type offers `field` in one write naming it, the rest
 *  (and every card, when the vote counts in the built-in) in one write to the built-in Votes. `typeOf` is a card's
 *  type by its id, undefined for a card the editor no longer holds (its dots go to the built-in). */
export function voteTallyWrites(
  tallies: readonly ItemTally[],
  field: string | undefined,
  typeOf: (id: string) => Pick<ItemTypeDef, 'fields' | 'custom'> | undefined,
): ItemWrite[] {
  const own: ItemTally[] = [];
  const builtIn: ItemTally[] = [];
  for (const t of tallies) {
    const type = typeOf(t.id);
    const into = type ? tallyFieldOn(type, field) : VOTES_FIELD;
    (into === VOTES_FIELD ? builtIn : own).push(t);
  }
  const writes: ItemWrite[] = [];
  if (own.length) writes.push({ kind: 'tally', tallies: own, field: field! });
  if (builtIn.length) writes.push({ kind: 'tally', tallies: builtIn });
  return writes;
}
