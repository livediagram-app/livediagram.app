// A session vote's tally for its Plan cards (docs/specs/026-plan/items.md "Tally"): each card's dots, counted per
// voter, each voter as a pseudonymous person id (itemPersonId of their collab key: never the key itself, which the
// room broadcasts). Element dots are not cards and are left out.
import { itemIdOfVoteKey, type TabVote } from '@liveplanner/project';
import {
  itemPersonId,
  typeIn,
  voteTallyWrites,
  type Item,
  type ItemTally,
  type ItemTypeDef,
  type ItemWrite,
} from '@liveplanner/items';

export async function voteTallies(vote: TabVote): Promise<ItemTally[]> {
  const out: ItemTally[] = [];
  for (const [key, voters] of Object.entries(vote.votes)) {
    const id = itemIdOfVoteKey(key);
    if (!id || voters.length === 0) continue;
    const counts = new Map<string, number>();
    for (const v of voters) counts.set(v, (counts.get(v) ?? 0) + 1);
    const votes: Record<string, number> = {};
    for (const [voter, n] of counts) votes[await itemPersonId(voter)] = n;
    out.push({ id, votes });
  }
  return out;
}

// The writes that land a vote's tally in the Votes field it counts in (docs/specs/012-collaboration/session-tools.md
// "Count In"): a card whose type lacks that field takes its dots in the built-in Votes.
export async function voteTallyWritesOf(
  vote: TabVote,
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
): Promise<ItemWrite[]> {
  const tallies = await voteTallies(vote);
  return voteTallyWrites(tallies, vote.voteField, (id) => {
    const item = items.get(id);
    return item ? typeIn(types, item.type) : undefined;
  });
}
