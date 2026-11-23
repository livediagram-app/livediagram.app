// The subscription service as tier tests stand it in (docs/specs/026-plan/blueprints/automations.md "Tiers (Pro)"):
// a fetcher that answers its internal routes as the service does (an owner's entitlement by their tier, spends and
// gauges counted against that tier's limits, item reports kept), and `proEnv`, which turns Pro on for a test world's
// env. Not a `.test.ts` file, so vitest does not collect it.
import {
  fakeSubscription as sharedFake,
  type FakeSubscription,
} from '@liveworkspace/subscription/testing';
import type { Tier } from '@liveworkspace/subscription';
import { forgetEntitlementsForTests } from '@liveworkspace/subscription';
import type { Env } from '../../types';

export type { FakeSubscription };

export function fakeSubscription(tiers: Record<string, Tier> = {}): FakeSubscription {
  return sharedFake(tiers, forgetEntitlementsForTests);
}

/** Pro turned on for a world's env, against `fake`. Before the world's plans are made: a room keeps the env it woke
 *  with. */
export function proEnv(env: Env, fake: FakeSubscription): void {
  forgetEntitlementsForTests();
  Object.assign(env, { PRO_ENABLED: 'true', SUBSCRIPTION_KEY: 'key', SUBSCRIPTION: fake.fetcher });
}

/** The plan's row given an owner and team, as the index's grant does when a plan moves (the tier reads the row). */
export function setPlanOwner(
  db: { prepare: (sql: string) => { run: (...args: (string | null)[]) => unknown } },
  planId: string,
  ownerId: string,
  teamId: string | null = null,
): void {
  db.prepare('UPDATE plan SET owner_id = ?, team_id = ? WHERE id = ?').run(ownerId, teamId, planId);
}
