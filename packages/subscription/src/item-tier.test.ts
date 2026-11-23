import { beforeEach, describe, expect, it } from 'vitest';
import { subscriptionClientOf, type EntitlementCache, type SubscriptionEnv } from './client';
import { ItemTier as PlanTier, RECHECK_EVERY_MS, tierOn, type TierHead } from './item-tier';
import { tierRefusal } from './tier-refusal';
import { fakeSubscription, type FakeSubscription } from './testing/fake.test-kit';

// One isolate's cache, as an app's Worker keeps one, dropped between tests.
const cache: EntitlementCache = new Map();
const subscriptionOf = (env: SubscriptionEnv) =>
  subscriptionClientOf(env, 'liveplanner.app', { cache, now: () => Date.now() });

// An item's tier as its room holds it (liveworkspace/docs/specs/019-subscription/subscription.md "Who pays for an
// item"), tested as a plan's: the owner's limits read at most once a minute and only when asked to, a synchronous read
// between, and nothing at all with Pro off.

let fake: FakeSubscription;
let head: TierHead | null;
let now: number;
let deferred: Promise<unknown>[];

const tierOf = (pro: boolean): PlanTier => {
  const env: SubscriptionEnv = {};
  cache.clear();
  fake = fakeSubscription({ 'p:user_ada': 'pro', 't:team_1': 'team' }, () => cache.clear());
  if (pro)
    Object.assign(env, {
      PRO_ENABLED: 'true',
      SUBSCRIPTION_KEY: 'key',
      SUBSCRIPTION: fake.fetcher,
    });
  else Object.assign(env, { SUBSCRIPTION_KEY: 'key', SUBSCRIPTION: fake.fetcher });
  return new PlanTier({
    client: () => subscriptionOf(env),
    head: () => head,
    defer: (work) => void deferred.push(work),
    now: () => now,
  });
};

beforeEach(() => {
  head = { ownerId: 'user_ada', teamId: null, name: 'Launch' };
  now = 1_000_000;
  deferred = [];
});

describe('with Pro off', () => {
  it('is always fresh, answers the legacy limit, meters nothing and makes no call', async () => {
    const tier = tierOf(false);
    expect(tier.on).toBe(false);
    expect(tier.fresh()).toBe(true);
    await tier.refresh();
    expect(tier.limit('automationRules', 50)).toBe(50);
    expect(tier.limit('emailToBoardPerMonth', null)).toBeNull();
    expect(await tier.spend('aiCredits')).toBeNull();
    expect(await tier.claim('publicRoadmaps', 'A:b1')).toBeNull();
    await tier.release('publicRoadmaps', 'A:b1');
    expect(await tier.count('rules', 'A', 3, true)).toBeNull();
    tier.recount('rules', 'A', 2);
    expect(await tierOn({ TIER: tier })).toBeNull();
    expect(await tierOn({})).toBeNull();
    expect(deferred).toEqual([]);
    expect(fake.calls).toEqual([]);
    expect(tierRefusal(tier, 'automationRules', 50, 50)).toEqual({});
    expect(tierRefusal(null, 'automationRules', 50, 50)).toEqual({});
  });

  it('is off for a room with no env', () => {
    const tier = new PlanTier({ client: () => null, head: () => head, defer: () => {} });
    expect(tier.on).toBe(false);
    expect(tier.limit('automationRules', 50)).toBe(50);
  });
});

describe('with Pro on', () => {
  it('reads the owner’s limits when asked, then answers from memory for a minute', async () => {
    const tier = tierOf(true);
    expect(tier.fresh()).toBe(false);
    // Not read yet: the legacy limit, never a wait.
    expect(tier.limit('automationRules', 50)).toBe(50);
    expect(await tierOn({ TIER: tier })).toBe(tier);
    expect(tier.owner).toBe('p:user_ada');
    expect(tier.limit('automationRules', 50)).toBe(500);
    expect(tier.fresh()).toBe(true);
    now += 59_000;
    await tierOn({ TIER: tier });
    expect(fake.to('entitlement')).toHaveLength(1);
    now += 2_000;
    expect(tier.fresh()).toBe(false);
    expect(tierRefusal(tier, 'automationRules', 500, 500)).toEqual({
      limit: 'automationRules',
      used: 500,
      max: 500,
    });
  });

  it('takes a team’s plan as the team’s, and reads again at once when the owner changes', async () => {
    const tier = tierOf(true);
    await tier.refresh();
    head = { ownerId: 'user_ada', teamId: 'team_1', name: 'Launch' };
    expect(tier.fresh()).toBe(false);
    await tier.refresh();
    expect(tier.owner).toBe('t:team_1');
    expect(tier.limit('automationRules', 50)).toBe(750);
  });

  it('has nothing to read for a plan that is nobody’s yet', async () => {
    const tier = tierOf(true);
    head = null;
    expect(tier.scope()).toBeNull();
    expect(tier.fresh()).toBe(true);
    await tier.refresh();
    expect(await tier.spend('aiCredits')).toBeNull();
    expect(await tier.claim('publicRoadmaps', 'A:b1')).toBeNull();
    await tier.release('publicRoadmaps', 'A:b1');
    expect(await tier.count('rules', 'A', 1, true)).toBeNull();
    tier.recount('rules', 'A', 0);
    head = { ownerId: '', teamId: null, name: '' };
    expect(tier.scope()).toBeNull();
    expect(fake.calls).toEqual([]);
  });

  it('spends from the owner’s meters', async () => {
    const tier = tierOf(true);
    expect(await tier.spend('aiCredits')).toMatchObject({ ok: true, used: 1, limit: 1000 });
    expect(await tier.spend('automationRuns', 3)).toMatchObject({
      ok: true,
      used: 3,
      limit: 10_000,
    });
    expect(fake.to('spend').map((c) => c['owner'])).toEqual(['p:user_ada', 'p:user_ada']);
  });

  it('keeps what the service last said of a gauge, and what it was told of each key', async () => {
    const tier = tierOf(true);
    await tier.refresh();
    expect(tier.told('A:b1', true)).toBe(false);
    expect(await tier.claim('publicRoadmaps', 'A:b1')).toMatchObject({ ok: true, used: 1 });
    expect(tier.told('A:b1', true)).toBe(true);
    expect(tier.told('A:b1', false)).toBe(false);
    await tier.release('publicRoadmaps', 'A:b1');
    expect(tier.gaugeUsed.get('publicRoadmaps')).toBe(0);
    expect(tier.told('A:b1', false)).toBe(true);
    // A key never claimed here taken off: nothing to count down.
    await tier.release('publicRoadmaps', 'A:b9');
    expect(tier.gaugeUsed.get('publicRoadmaps')).toBe(0);
    // Another owner's count is not this one's.
    await tier.claim('publicRoadmaps', 'A:b2');
    await tier.release('publicRoadmaps', 'A:b2', 'p:user_bo');
    expect(tier.gaugeUsed.get('publicRoadmaps')).toBe(1);
    now += 61_000;
    expect(tier.told('A:b2', true)).toBe(false);
    // A new owner starts from nothing.
    head = { ownerId: 'user_bo', teamId: null, name: 'Launch' };
    await tier.refresh();
    expect(tier.gaugeUsed.size).toBe(0);
    expect(tier.gauged.size).toBe(0);
  });

  it('asks about a key once a minute whatever the service answered, so a refused add is not asked every list', async () => {
    const tier = tierOf(true);
    head = { ownerId: 'user_bo', teamId: null, name: 'Launch' };
    await tier.refresh();
    expect(await tier.claim('publicRoadmaps', 'A:b1')).toMatchObject({ ok: true });
    expect(await tier.claim('publicRoadmaps', 'A:b2')).toMatchObject({ ok: false, limit: 1 });
    // Refused, and still told: nothing to ask again inside the minute.
    expect(tier.told('A:b2', true)).toBe(true);
    now += 61_000;
    expect(tier.told('A:b2', true)).toBe(false);
  });

  it('gives a guest’s plan Free’s limits and never sends it to the service', async () => {
    const tier = tierOf(true);
    head = { ownerId: 'guest_abc', teamId: null, name: 'Launch' };
    expect(tier.scope()).toBeNull();
    expect(await tierOn({ TIER: tier })).toBe(tier);
    expect(tier.guest).toBe(true);
    expect(tier.owner).toBeNull();
    expect(tier.fresh()).toBe(true);
    expect(tier.limit('automationRules', 50)).toBe(25);
    expect(tier.limit('automationRunsPerMonth', null)).toBe(500);
    // Nothing is spent or counted for it (its per-item bounds hold); a roadmap is counted in the plan.
    expect(await tier.spend('aiCredits')).toBeNull();
    expect(await tier.spend('automationRuns', 2)).toBeNull();
    expect(await tier.count('rules', 'A', 3, true)).toBeNull();
    expect(await tier.claim('publicRoadmaps', 'A:b1', 0)).toMatchObject({ ok: true, used: 1 });
    expect(await tier.claim('publicRoadmaps', 'A:b2', 1)).toMatchObject({ ok: false, used: 1 });
    await tier.release('publicRoadmaps', 'A:b1');
    tier.recount('rules', 'A', 2);
    expect(await tier.recheck()).toBe(false);
    expect(deferred).toEqual([]);
    expect(fake.calls).toEqual([]);
    // Signing in makes it a person's: the service is asked from then on.
    head = { ownerId: 'user_ada', teamId: null, name: 'Launch' };
    expect(tier.fresh()).toBe(false);
    await tier.refresh();
    expect(tier.guest).toBe(false);
    expect(tier.limit('automationRules', 50)).toBe(500);
  });

  it('spends and claims for the owner the plan has now, never the one it last read', async () => {
    const tier = tierOf(true);
    await tier.refresh();
    head = { ownerId: 'user_ada', teamId: 'team_1', name: 'Launch' };
    await tier.spend('aiCredits');
    await tier.claim('publicRoadmaps', 'A:b1');
    expect(fake.to('spend').at(-1)).toMatchObject({ owner: 't:team_1' });
    expect(fake.to('gauge').at(-1)).toMatchObject({ owner: 't:team_1' });
  });

  it('asks for the limits once more before a refusal, at most every few seconds, past what is remembered', async () => {
    const tier = tierOf(true);
    head = { ownerId: 'user_bo', teamId: null, name: 'Launch' };
    await tier.refresh();
    expect(tier.limit('automationRules', 50)).toBe(25);
    // Nothing changed: asked once, and not again inside the few seconds.
    expect(await tier.recheck()).toBe(false);
    expect(await tier.recheck()).toBe(false);
    expect(fake.to('entitlement')).toHaveLength(2);
    // The owner upgrades (nothing here forgets what it remembered of them).
    fake.tiers.set('p:user_bo', 'pro');
    expect(await tier.recheck()).toBe(false);
    now += RECHECK_EVERY_MS;
    expect(await tier.recheck()).toBe(true);
    expect(tier.limit('automationRules', 50)).toBe(500);
    // A service answer that names another tier makes the limits stale at once.
    fake.tiers.set('p:user_bo', 'free');
    await tier.spend('aiCredits');
    expect(tier.fresh()).toBe(false);
  });

  it('tells the owner’s total of an item’s count, refusing one that grows past the limit', async () => {
    const tier = tierOf(true);
    head = { ownerId: 'user_bo', teamId: null, name: 'Launch' };
    // Read on the first ask: Free's 25 rules over everything Bo owns.
    expect(await tier.count('rules', 'A', 20, true)).toMatchObject({
      ok: true,
      used: 20,
      limit: 25,
    });
    expect(await tier.count('rules', 'B', 5, true)).toMatchObject({ ok: true, used: 25 });
    expect(await tier.count('rules', 'B', 6, true)).toMatchObject({ ok: false, used: 25 });
    // Told again without adding, it is recorded whatever the total.
    expect(await tier.count('rules', 'B', 6)).toMatchObject({ ok: true, used: 26 });
    tier.recount('rules', 'A', 0);
    await Promise.all(deferred);
    expect([...fake.items]).toEqual([['p:user_bo:rules:B', 6]]);
  });

  it('moves the counts it told when the item changes owner', async () => {
    const tier = tierOf(true);
    await tier.count('rules', 'A', 4, true);
    await tier.count('pages', 'A', 0, true);
    head = { ownerId: 'user_ada', teamId: 'team_1', name: 'Launch' };
    await tier.refresh();
    await Promise.all(deferred);
    expect([...fake.items]).toEqual([['t:team_1:rules:A', 4]]);
    // To a guest's: the team holds none of it, and nothing more is told.
    head = { ownerId: 'guest_abc', teamId: null, name: 'Launch' };
    await tier.refresh();
    await Promise.all(deferred);
    expect([...fake.items]).toEqual([]);
    tier.recount('rules', 'A', 3);
    head = { ownerId: 'user_ada', teamId: null, name: 'Launch' };
    await tier.refresh();
    await Promise.all(deferred);
    expect([...fake.items]).toEqual([]);
  });

  it('reads the clock itself, rechecks nothing without a client, and names nothing for a head that is gone', async () => {
    const off = new PlanTier({ client: () => null, head: () => head, defer: () => {} });
    expect(await off.recheck()).toBe(false);
    const disabled = tierOf(false);
    expect(await disabled.recheck()).toBe(false);
    const tier = new PlanTier({
      client: () =>
        subscriptionOf({
          PRO_ENABLED: 'true',
          SUBSCRIPTION_KEY: 'key',
          SUBSCRIPTION: fake.fetcher,
        }),
      head: () => head,
      defer: (work) => void deferred.push(work),
    });
    await tier.refresh();
    expect(tier.fresh()).toBe(true);
    tier.recount('rules', 'A', 4);
    await Promise.all(deferred);
    expect(fake.items.get('p:user_ada:rules:A')).toBe(4);
  });

  it('says a guest’s refusal is a guest’s', () => {
    expect(tierRefusal({ on: true, guest: true }, 'automationRules', 10, 10)).toEqual({
      limit: 'automationRules',
      used: 10,
      max: 10,
      guest: true,
    });
  });
});
