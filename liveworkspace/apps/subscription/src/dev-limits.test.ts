import { TIER_LIMITS } from '@liveworkspace/subscription';
import { afterEach, describe, expect, it } from 'vitest';
import { freeLimits, parseDevLimits, readDevLimits } from './dev-limits';
import { entitlementAt } from './subscriptions/entitlement';

afterEach(() => readDevLimits({ ENVIRONMENT: 'development' }));

describe('DEV_FREE_LIMITS', () => {
  it('keeps only known numeric limits that are whole and not negative', () => {
    expect(
      parseDevLimits(
        '{"automationRunsPerMonth":3,"automationRules":-1,"aiCreditsPerMonth":1.5,"ownAiKey":1,"nonsense":4}',
      ),
    ).toEqual({ automationRunsPerMonth: 3 });
    expect(parseDevLimits('not json')).toEqual({});
    expect(parseDevLimits('[1]')).toEqual({});
    expect(parseDevLimits(undefined)).toEqual({});
  });

  it("lowers Free's limits in development, for the entitlement an app is given", () => {
    readDevLimits({ ENVIRONMENT: 'development', DEV_FREE_LIMITS: '{"automationRunsPerMonth":3}' });
    expect(freeLimits().automationRunsPerMonth).toBe(3);
    expect(freeLimits().automationRules).toBe(TIER_LIMITS.free.automationRules);
    expect(entitlementAt('p:user_1', null, 0).limits.automationRunsPerMonth).toBe(3);
  });

  it('is ignored in staging and production', () => {
    for (const ENVIRONMENT of ['staging', 'production']) {
      readDevLimits({ ENVIRONMENT, DEV_FREE_LIMITS: '{"automationRunsPerMonth":3}' });
      expect(freeLimits()).toEqual(TIER_LIMITS.free);
    }
  });
});
