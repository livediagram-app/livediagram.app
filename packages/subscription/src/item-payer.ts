// Who is charged for an item's usage: the ONE rule every app's Worker follows (subscription.md "Who pays for an
// item"). An item's head (its owner and team, as the index names them) is one of three things:
//
//   - `owner`: a team's item, or a signed-in person's. The subscription service is asked about its scope.
//   - `guest`: an item whose owner has no account. It gets Free's limits, enforced where the item lives, and the
//     service is NEVER told of it: no entitlement read, no spend, no gauge, no report. A guest id is minted by a
//     browser, so a scope made from one would hand every fresh guest an allowance and a meter row of its own.
//   - `nobody`: a head that names no owner at all (one from before owners were named): nothing can be counted.
//
// Nothing here reads a request: only what the index (or the item's own row) says of the item.
import { isOwnerScope, personScope, teamScope, type OwnerScope } from './owner';
import { limitsFor, type LimitKey, type Limits } from './tiers';

/** An account's id, as against a guest's (`guest_…`): the accounts service mints every one with this prefix. */
const ACCOUNT_ID_PREFIX = 'user_';

export type ItemPayer =
  { kind: 'owner'; scope: OwnerScope } | { kind: 'guest' } | { kind: 'nobody' };

export type ItemHead = { owner?: string | null; team?: string | null };

const GUEST: ItemPayer = { kind: 'guest' };
const NOBODY: ItemPayer = { kind: 'nobody' };

/** Who pays for the item `head` names. A team's item is the team's, whoever made it. */
export function itemPayer(head: ItemHead): ItemPayer {
  if (head.team) {
    const scope = teamScope(head.team);
    return isOwnerScope(scope) ? { kind: 'owner', scope } : NOBODY;
  }
  if (!head.owner) return NOBODY;
  if (!head.owner.startsWith(ACCOUNT_ID_PREFIX)) return GUEST;
  const scope = personScope(head.owner);
  return isOwnerScope(scope) ? { kind: 'owner', scope } : NOBODY;
}

/** The scope the subscription service is asked about for the item, or null for a guest's item and nobody's. */
export function itemPayerScope(head: ItemHead): OwnerScope | null {
  const payer = itemPayer(head);
  return payer.kind === 'owner' ? payer.scope : null;
}

/** The limits a guest's item gets: Free's own, as this build has them (never the service's word). The account-wide
 *  ones bound that one item: nothing is counted against an account, as a guest has none. */
export const GUEST_LIMITS: Limits = limitsFor('free');

/** One of a guest's item's limits. */
export function guestLimit<K extends LimitKey>(key: K): Limits[K] {
  return GUEST_LIMITS[key];
}
