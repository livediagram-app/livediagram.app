// Whose tier sets an upload's limits (liveworkspace/docs/specs/006-media/media.md "With Pro on", "Who pays").
import {
  createSubscriptionClient,
  limitsFor,
  TIER_LIMITS,
  type Entitlement,
  type OwnerScope,
  type Tier,
} from '@liveworkspace/subscription';
import { describe, expect, it, vi } from 'vitest';
import { MAX_IMAGE_BYTES } from './limits';
import {
  betterLimits,
  imageAllowance,
  imageTooLargeBody,
  itemOwnerScope,
  knownItemOwnerScope,
  payerLimits,
  uploaderScope,
} from './payer';
import { IMAGE_UPLOAD_CEILING_BYTES, WALKTHROUGH_CEILING_MS } from './tier-limits';
import { WALKTHROUGH_MAX_MS } from './walkthrough';

const entitlement = (owner: OwnerScope, tier: Tier): Entitlement => ({
  owner,
  tier,
  seats: 3,
  limits: limitsFor(tier, 3),
});

function client(tiers: Record<string, Tier>, enabled = true) {
  const asked: string[] = [];
  const sub = createSubscriptionClient({
    enabled,
    app: 'livediagram.app',
    key: 'k',
    cache: new Map(),
    health: { downUntil: 0 },
    fetcher: {
      fetch: async (_input, init) => {
        const { owner } = JSON.parse(String(init?.body)) as { owner: OwnerScope };
        asked.push(owner);
        return Response.json(entitlement(owner, tiers[owner] ?? 'free'));
      },
    },
  });
  return { sub, asked };
}

describe('uploaderScope', () => {
  it('is the account, a team gallery’s team, and nobody for a guest', () => {
    expect(uploaderScope('user_ada')).toBe('p:user_ada');
    expect(uploaderScope('team:team_garden')).toBe('t:team_garden');
    expect(uploaderScope('guest:0123')).toBeNull();
    expect(uploaderScope('not an id')).toBeNull();
  });
});

describe('itemOwnerScope', () => {
  it('is the item’s team, else its owning account, never a guest', () => {
    expect(itemOwnerScope({ team: 'team_garden', owner: 'user_ada' })).toBe('t:team_garden');
    expect(itemOwnerScope({ team: null, owner: 'user_ada' })).toBe('p:user_ada');
    expect(itemOwnerScope({ team: null, owner: 'guest_1' })).toBeNull();
    expect(itemOwnerScope({ team: null })).toBeNull();
    expect(itemOwnerScope({ team: 'not an id', owner: null })).toBeNull();
  });
});

describe('knownItemOwnerScope', () => {
  it('tells an owner nobody named from a guest’s item', () => {
    expect(knownItemOwnerScope(null)).toBeUndefined();
    expect(knownItemOwnerScope({ team: null })).toBeUndefined();
    expect(knownItemOwnerScope({ team: null, owner: null })).toBeUndefined();
    expect(knownItemOwnerScope({ team: null, owner: 'guest_1' })).toBeNull();
    expect(knownItemOwnerScope({ team: 'team_garden' })).toBe('t:team_garden');
    expect(knownItemOwnerScope({ team: null, owner: 'user_ada' })).toBe('p:user_ada');
  });
});

describe('betterLimits', () => {
  const free = entitlement('p:user_ada', 'free');
  const pro = entitlement('p:user_ada', 'pro');
  const team = entitlement('t:team_garden', 'team');

  it('lends a Free uploader the team’s upload size and length in the team’s item, and nothing they keep', () => {
    // One grant on one Pro for Teams item used to hand its holder the team's 250 GB and unlimited walkthroughs,
    // in their own gallery, for every app, charged to nobody.
    expect(betterLimits(free, team)).toEqual({
      imageMaxBytes: TIER_LIMITS.team.imageMaxBytes,
      imageStorageBytes: TIER_LIMITS.free.imageStorageBytes,
      walkthroughMaxMs: TIER_LIMITS.team.walkthroughMaxMs,
      walkthroughsStored: TIER_LIMITS.free.walkthroughsStored,
      // The bigger upload is the team's to offer; what is kept is the uploader's own.
      owner: 't:team_garden',
      storageOwner: 'p:user_ada',
    });
  });

  it('keeps what a guest holds at Free whoever owns the item, with nobody to offer storage to', () => {
    expect(betterLimits(null, team)).toEqual({
      imageMaxBytes: TIER_LIMITS.team.imageMaxBytes,
      imageStorageBytes: TIER_LIMITS.free.imageStorageBytes,
      walkthroughMaxMs: TIER_LIMITS.team.walkthroughMaxMs,
      walkthroughsStored: TIER_LIMITS.free.walkthroughsStored,
      owner: 't:team_garden',
      storageOwner: null,
    });
  });

  it('never lowers what a paying uploader keeps in a Free owner’s item', () => {
    const limits = betterLimits(pro, entitlement('p:user_bo', 'free'));
    expect(limits.imageStorageBytes).toBe(TIER_LIMITS.pro.imageStorageBytes);
    expect(limits.walkthroughsStored).toBeNull();
    expect(limits.storageOwner).toBe('p:user_ada');
  });

  it('lets a Pro uploader keep their own in a Free owner’s item, and offers to them', () => {
    const limits = betterLimits(pro, entitlement('p:user_bo', 'free'));
    expect(limits.imageMaxBytes).toBe(TIER_LIMITS.pro.imageMaxBytes);
    expect(limits.walkthroughsStored).toBeNull();
    expect(limits.owner).toBe('p:user_ada');
  });

  it('holds a guest to Free with nobody to offer to, unless the item’s owner has more', () => {
    expect(betterLimits(null, null)).toMatchObject({
      imageMaxBytes: TIER_LIMITS.free.imageMaxBytes,
      walkthroughsStored: 5,
      owner: null,
    });
    expect(betterLimits(null, team).owner).toBe('t:team_garden');
    // A Free item gives a guest nothing more, and names nobody.
    expect(betterLimits(null, entitlement('p:user_bo', 'free')).owner).toBeNull();
  });
});

describe('payerLimits', () => {
  it('answers null and asks nothing with Pro off', async () => {
    const { sub, asked } = client({}, false);
    expect(await payerLimits(sub, 'user_ada', 't:team_garden')).toBeNull();
    expect(asked).toEqual([]);
  });

  it('reads both owners, and only the uploader when the item names none, itself or nonsense', async () => {
    const both = client({ 't:team_garden': 'team' });
    const limits = await payerLimits(both.sub, 'user_ada', 't:team_garden');
    expect(limits?.imageMaxBytes).toBe(TIER_LIMITS.team.imageMaxBytes);
    expect(limits?.imageStorageBytes).toBe(TIER_LIMITS.free.imageStorageBytes);
    expect(both.asked.toSorted()).toEqual(['p:user_ada', 't:team_garden']);
    for (const item of [null, undefined, 'p:user_ada', 'pro', 'team']) {
      const one = client({});
      expect((await payerLimits(one.sub, 'user_ada', item))?.owner).toBe('p:user_ada');
      expect(one.asked).toEqual(['p:user_ada']);
    }
  });

  it('asks nothing for a guest uploading for no item', async () => {
    const { sub, asked } = client({});
    expect((await payerLimits(sub, 'guest:0123'))?.imageMaxBytes).toBe(
      TIER_LIMITS.free.imageMaxBytes,
    );
    expect(asked).toEqual([]);
  });
});

describe('imageAllowance', () => {
  it('is the legacy cap with Pro off, and never resolves the item', async () => {
    const itemOwner = vi.fn(async () => 't:team_garden' as const);
    const allowance = await imageAllowance(client({}, false).sub, 'user_ada', itemOwner);
    expect(allowance).toEqual({
      pro: false,
      maxBytes: MAX_IMAGE_BYTES,
      itemOwner: null,
      owner: null,
    });
    expect(itemOwner).not.toHaveBeenCalled();
    expect(imageTooLargeBody(allowance, 99)).toEqual({
      error: 'file_too_large',
      limitBytes: MAX_IMAGE_BYTES,
    });
  });

  it('is the better tier’s with Pro on, and its refusal says the limit, the size and whose it is', async () => {
    const free = await imageAllowance(client({}).sub, 'user_ada', async () => null);
    expect(free).toEqual({
      pro: true,
      maxBytes: TIER_LIMITS.free.imageMaxBytes,
      itemOwner: null,
      owner: 'p:user_ada',
    });
    expect(imageTooLargeBody(free, 27_200_000)).toEqual({
      error: 'file_too_large',
      limitBytes: 25_000_000,
      limit: 25_000_000,
      current: 27_200_000,
      owner: 'p:user_ada',
    });
    expect(imageTooLargeBody(free, null)).not.toHaveProperty('current');
    const team = await imageAllowance(
      client({ 't:team_garden': 'team' }).sub,
      'user_ada',
      async () => 't:team_garden',
    );
    expect(team).toMatchObject({ maxBytes: 25_000_000, itemOwner: 't:team_garden' });
  });
});

describe('the ceilings', () => {
  it('are the most any tier allows, never under the legacy caps', () => {
    expect(IMAGE_UPLOAD_CEILING_BYTES).toBe(25_000_000);
    expect(IMAGE_UPLOAD_CEILING_BYTES).toBeGreaterThanOrEqual(MAX_IMAGE_BYTES);
    expect(WALKTHROUGH_CEILING_MS).toBe(30 * 60 * 1000);
    expect(WALKTHROUGH_CEILING_MS).toBeGreaterThanOrEqual(WALKTHROUGH_MAX_MS);
  });
});
