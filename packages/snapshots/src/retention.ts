// What an item's owner's tier keeps of its snapshots, with Pro on (liveworkspace/docs/specs/014-snapshots/snapshots.md
// "With Pro on"): on Free the latest five, each for 7 days; on Pro and Pro for Teams the latest 50 with no age limit.
// With PRO_ENABLED off there is no retention to apply (null) and nothing is asked of the subscription service.

import {
  limitsFor,
  subscriptionClientOf,
  type OwnerScope,
  type SubscriptionApp,
  type SubscriptionEnv,
} from '@liveworkspace/subscription';
import { SNAPSHOTS_KEPT, SNAPSHOTS_KEPT_PAID } from './limits';

const DAY_MS = 24 * 60 * 60 * 1000;

export type SnapshotRetention = {
  /** How many of the item's snapshots stay. */
  keep: number;
  /** How long one is kept from when it was taken; null is no age limit. */
  maxAgeMs: number | null;
  /** The same in days, for the dialog's words. */
  days: number | null;
  /** The item's owner, for the offer; null for a guest's item. */
  owner: OwnerScope | null;
  /** False where the owner or their tier could not be learnt: nothing is dropped for its age, and the dialog is told
   *  nothing of a tier. */
  known: boolean;
};

/**
 * What stands in while the owner's tier is not known (a grant that names no owner, the subscription service out of
 * reach or refusing): nothing is dropped for its age, and the count is the FEWEST any tier keeps, so not knowing
 * never gives an item more than Free would. `keptWhileUnknown` is the count a take applies.
 */
export const RETENTION_UNKNOWN: SnapshotRetention = {
  keep: SNAPSHOTS_KEPT,
  maxAgeMs: null,
  days: null,
  owner: null,
  known: false,
};

/**
 * How many of an item's snapshots stay while its owner's tier is not known, given how many it holds now. Five: an
 * item never grows past what Free keeps on a guess. But an item that already holds more than five can only have got
 * there on a tier that keeps fifty, and dropping a snapshot cannot be undone, so those are left as that tier would
 * leave them.
 */
export function keptWhileUnknown(held: number): number {
  return held > SNAPSHOTS_KEPT ? SNAPSHOTS_KEPT_PAID : SNAPSHOTS_KEPT;
}

/** A tier's retention from its History limit: a tier that keeps history for a time keeps five snapshots that long,
 *  and one with no age limit keeps fifty. */
export function retentionOf(
  historyDays: number | null,
  owner: OwnerScope | null,
): SnapshotRetention {
  return historyDays === null
    ? { keep: SNAPSHOTS_KEPT_PAID, maxAgeMs: null, days: null, owner, known: true }
    : {
        keep: SNAPSHOTS_KEPT,
        maxAgeMs: historyDays * DAY_MS,
        days: historyDays,
        owner,
        known: true,
      };
}

/**
 * The retention of an item owned by `owner` (the index's grant, as a scope; null for a guest's item, which is Free;
 * undefined where the grant names no owner), or null with Pro off. One entitlement read, on the client's 60 s cache.
 * Dropping a snapshot cannot be undone, so only a tier the service confirmed is applied: an owner not named, or a
 * service out of reach with nothing remembered, is RETENTION_UNKNOWN.
 */
export async function snapshotRetention(
  env: SubscriptionEnv,
  app: SubscriptionApp,
  owner: OwnerScope | null | undefined,
): Promise<SnapshotRetention | null> {
  const client = subscriptionClientOf(env, app);
  if (!client.enabled) return null;
  if (owner === undefined) return RETENTION_UNKNOWN;
  if (owner === null) return retentionOf(limitsFor('free').historyDays, null);
  const entitlement = await client.confirmedEntitlement(owner);
  if (entitlement === 'unknown' || entitlement === null) return RETENTION_UNKNOWN;
  return retentionOf(entitlement.limits.historyDays, owner);
}
