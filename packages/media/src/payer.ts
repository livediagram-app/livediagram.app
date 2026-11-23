// Whose tier sets an upload's limits with Pro on (liveworkspace/docs/specs/006-media/media.md "With Pro on", "Who
// pays"). What is kept (Image Storage, Walkthroughs Stored) is always the uploader's own tier's: it is their gallery
// and their recordings, charged to them. What one upload may be (Largest Image, Walkthrough Length) is the better of
// their own and, when the upload is for an item, the item's owner's: a grant on one item lends a bigger upload into
// that item, never a bigger gallery everywhere. The service works it out for what it stores, and each app's api works
// out the same answer before it reads a body, so both refuse the same upload. Nothing here reads a tier from a
// request: only owners, whose entitlements the caller's own key reads.

import {
  isOwnerScope,
  itemPayerScope,
  limitsFor,
  personScope,
  teamScope,
  TIERS,
  type Entitlement,
  type OwnerScope,
  type SubscriptionClient,
  type Tier,
} from '@liveworkspace/subscription';
import { MAX_IMAGE_BYTES } from './limits';
import { isGuestOwner } from './owner';

// A team's gallery, as the Library names it (libraries.md "Pictures").
const TEAM_GALLERY_PREFIX = 'team:';

/** The owner scope a media owner's own tier is read under: an account's, a team gallery's team, or null for a guest
 *  (Free). */
export function uploaderScope(owner: string): OwnerScope | null {
  if (isGuestOwner(owner)) return null;
  const scope = owner.startsWith(TEAM_GALLERY_PREFIX)
    ? teamScope(owner.slice(TEAM_GALLERY_PREFIX.length))
    : personScope(owner);
  return isOwnerScope(scope) ? scope : null;
}

/** An item's owner as the index's grant names it: its team when it has one, else the account that owns it. Null for
 *  a guest's item (Free) and a grant that names no owner. The one rule every app follows (`itemPayer`,
 *  @liveworkspace/subscription; 019 "Who pays for an item"), kept under this name for media's own callers. */
export function itemOwnerScope(grant: {
  team: string | null;
  owner?: string | null;
}): OwnerScope | null {
  return itemPayerScope(grant);
}

/**
 * The same, for what deletes (a tier's retention of snapshots and versions): `undefined` where there is no grant or
 * it names neither a team nor an owner, so "nobody said" is never read as a guest's Free item.
 */
export function knownItemOwnerScope(
  grant: { team: string | null; owner?: string | null } | null | undefined,
): OwnerScope | null | undefined {
  if (!grant || (!grant.team && !grant.owner)) return undefined;
  return itemOwnerScope(grant);
}

/** What the uploader may do, and whose tier said so. */
export type PayerLimits = {
  imageMaxBytes: number;
  imageStorageBytes: number;
  walkthroughMaxMs: number;
  /** Null is no limit. */
  walkthroughsStored: number | null;
  /** The scope an offer at Largest Image or Walkthrough Length is for: the uploader's own, unless the item's
   *  owner's tier is the better one. Null for a guest with no better item owner. */
  owner: OwnerScope | null;
  /** The scope an offer at Image Storage or Walkthroughs Stored is for: always the uploader's own. Null for a guest. */
  storageOwner: OwnerScope | null;
};

const rank = (tier: Tier): number => TIERS.indexOf(tier);
const more = (a: number, b: number | undefined): number => (b === undefined ? a : Math.max(a, b));

/**
 * An upload's limits from the uploader's entitlement and the item's owner's. One upload's size and length take the
 * better of the two; what the uploader keeps takes their own alone. `own` null is Free (a guest).
 */
export function betterLimits(own: Entitlement | null, item: Entitlement | null): PayerLimits {
  const mine = own?.limits ?? limitsFor('free');
  const theirs = item?.limits;
  const itemLeads = item !== null && rank(item.tier) > rank(own?.tier ?? 'free');
  return {
    imageMaxBytes: more(mine.imageMaxBytes, theirs?.imageMaxBytes),
    imageStorageBytes: mine.imageStorageBytes,
    walkthroughMaxMs: more(mine.walkthroughMaxMs, theirs?.walkthroughMaxMs),
    walkthroughsStored: mine.walkthroughsStored,
    owner: itemLeads && item ? item.owner : (own?.owner ?? null),
    storageOwner: own?.owner ?? null,
  };
}

/**
 * The limits an upload by `uploader` (a media owner) meets, for `itemOwner`'s item when one is named. Null with Pro
 * off: the caller keeps its legacy caps, and nothing was asked. Both entitlements ride the client's 60 s cache; an
 * `itemOwner` that is not an owner scope is ignored.
 */
export async function payerLimits(
  client: SubscriptionClient,
  uploader: string,
  itemOwner?: string | null,
): Promise<PayerLimits | null> {
  if (!client.enabled) return null;
  const own = uploaderScope(uploader);
  const item = isOwnerScope(itemOwner) && itemOwner !== own ? itemOwner : null;
  const [mine, theirs] = await Promise.all([
    own ? client.entitlement(own) : null,
    item ? client.entitlement(item) : null,
  ]);
  return betterLimits(mine, theirs);
}

/** What an app's api holds an image upload to before it reads the body. */
export type ImageAllowance = {
  /** Pro is on: `maxBytes` is this caller's limit, and the refusal says whose. */
  pro: boolean;
  maxBytes: number;
  /** The item's owner, to name to the service; null when the upload is for no item, or with Pro off. */
  itemOwner: OwnerScope | null;
  owner: OwnerScope | null;
};

/**
 * The largest image `uploader` may send. With Pro off it is the legacy cap and `itemOwner` is never asked for, so an
 * upload costs what it always did. With Pro on `itemOwner` resolves the item the upload is for (the app's own grant
 * read), and the answer is the same one the service will reach.
 */
export async function imageAllowance(
  client: SubscriptionClient,
  uploader: string,
  itemOwner: () => Promise<OwnerScope | null>,
): Promise<ImageAllowance> {
  if (!client.enabled)
    return { pro: false, maxBytes: MAX_IMAGE_BYTES, itemOwner: null, owner: null };
  const item = await itemOwner();
  // Enabled, so never null.
  const limits = (await payerLimits(client, uploader, item))!;
  return { pro: true, maxBytes: limits.imageMaxBytes, itemOwner: item, owner: limits.owner };
}

/** The 413 an oversized image answers: the legacy body with Pro off, and with it on the limit, the size and whose
 *  tier set it (media.md "With Pro on"). `size` is null where a body was cut off at the limit, its size never known. */
export function imageTooLargeBody(
  allowance: Pick<ImageAllowance, 'pro' | 'maxBytes' | 'owner'>,
  size: number | null,
): { error: 'file_too_large'; limitBytes: number } & Record<string, unknown> {
  if (!allowance.pro) return { error: 'file_too_large', limitBytes: allowance.maxBytes };
  return {
    error: 'file_too_large',
    limitBytes: allowance.maxBytes,
    limit: allowance.maxBytes,
    ...(size === null ? {} : { current: size }),
    owner: allowance.owner,
  };
}
