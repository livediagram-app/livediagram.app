// A public roadmap's upvotes (docs/specs/026-plan/public-roadmap.md "Upvotes"): one browser's vote for one card, kept
// in the card's built-in Votes as its own voter (`rv:` and a hash the api works out), one vote each, beside any
// session votes, so the card's count and Sort Cards by Votes include it. Pure.
import { itemVotes, type Item } from './item';
import { ITEM_VOTERS_MAX } from './limits';
import { VOTES_FIELD } from './comments-votes-fields';

export const PUBLIC_VOTER_PREFIX = 'rv:';

// What a vote did: the card with it, nothing to change, or no room for another voter.
export type PublicVoteResult =
  { kind: 'changed'; item: Item } | { kind: 'same' } | { kind: 'full' };

/** Whether `voter` holds a vote on the card. */
export const hasPublicVote = (item: Pick<Item, 'fields'>, voter: string): boolean =>
  voter in itemVotes(item);

/**
 * The card after `voter` gives (`up`) or takes back their vote. Giving a vote already given, or taking back one never
 * given, changes nothing; a new voter past ITEM_VOTERS_MAX is `full`. A change raises the rev and leaves the card's
 * stamps as they were: a vote is not an edit.
 */
export function withPublicVote(item: Item, voter: string, up: boolean): PublicVoteResult {
  const votes = itemVotes(item);
  const has = voter in votes;
  if (has === up) return { kind: 'same' };
  if (up) {
    if (Object.keys(votes).length >= ITEM_VOTERS_MAX) return { kind: 'full' };
    votes[voter] = 1;
  } else {
    delete votes[voter];
  }
  return {
    kind: 'changed',
    item: { ...item, fields: { ...item.fields, [VOTES_FIELD]: votes }, rev: item.rev + 1 },
  };
}
