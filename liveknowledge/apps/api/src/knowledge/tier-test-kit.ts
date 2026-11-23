// Pro in a liveknowledge test (docs/specs/030-knowledgebase/tiers.md): the shared fake subscription service, and
// `proEnv`, which turns Pro on for a test's env. Not a `.test.ts` file, so vitest does not collect it.
import {
  fakeSubscription as sharedFake,
  type FakeSubscription,
} from '@liveworkspace/subscription/testing';
import type { Tier } from '@liveworkspace/subscription';
import { forgetEntitlementsForTests } from '../subscription';

export type { FakeSubscription };

export const fakeSubscription = (tiers: Record<string, Tier> = {}): FakeSubscription =>
  sharedFake(tiers, forgetEntitlementsForTests);

/** Pro on, against `fake`, for this env. */
export function proEnv(env: object, fake: FakeSubscription): void {
  forgetEntitlementsForTests();
  Object.assign(env, { PRO_ENABLED: 'true', SUBSCRIPTION_KEY: 'key', SUBSCRIPTION: fake.fetcher });
}
