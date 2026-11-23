import { describe, expect, it } from 'vitest';
import { TIER_LIMITS } from './tiers';
import {
  GAUGE_LIMIT,
  GAUGES,
  GRACE_DAYS,
  GRACE_MS,
  ENDED_SHOWN_DAYS,
  ENDED_SHOWN_MS,
  isGauge,
  isLimitKey,
  TEAM_REQUESTS_KEPT_DAYS,
  TEAM_REQUESTS_KEPT_MS,
  TEAM_REQUESTS_SHOWN,
  TEAM_REQUEST_NOTE_MAX,
  isItemMeter,
  isSpendMeter,
  isSubscriptionApp,
  ITEM_METER_LIMIT,
  ITEM_METERS,
  MOCK_CHECKOUT_ACTIONS,
  MOCK_PORTAL_ACTIONS,
  SPEND_METER_LIMIT,
  SPEND_METERS,
  SUBSCRIPTION_API_PATH,
  SUBSCRIPTION_API_URL,
  SUBSCRIPTION_APPS,
  SUBSCRIPTION_ERRORS,
  SUBSCRIPTION_STATES,
} from './wire';

describe('the wire', () => {
  it('lives under /api/subscription on liveworkspace.app', () => {
    expect(SUBSCRIPTION_API_PATH).toBe('/api/subscription');
    expect(SUBSCRIPTION_API_URL).toBe('https://www.liveworkspace.app/api/subscription');
  });

  it('knows every app, and liveworkspace itself', () => {
    expect(SUBSCRIPTION_APPS).toHaveLength(7);
    expect(isSubscriptionApp('liveplanner.app')).toBe(true);
    expect(isSubscriptionApp('liveworkspace.app')).toBe(true);
    for (const value of ['liveplanner', 'example.app', null, 3])
      expect(isSubscriptionApp(value)).toBe(false);
  });

  it('gives seven days of grace', () => {
    expect(GRACE_DAYS).toBe(7);
    expect(GRACE_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(SUBSCRIPTION_STATES).toEqual(['active', 'cancelling', 'past_due', 'ended']);
  });

  it('names every meter with a limit every tier has', () => {
    const limits = Object.keys(TIER_LIMITS.free);
    for (const meter of SPEND_METERS) expect(limits).toContain(SPEND_METER_LIMIT[meter]);
    for (const gauge of GAUGES) expect(limits).toContain(GAUGE_LIMIT[gauge]);
    for (const meter of ITEM_METERS) expect(limits).toContain(ITEM_METER_LIMIT[meter]);
    expect(ITEM_METERS).toEqual(['rules', 'pages']);
  });

  it('tells its meters apart', () => {
    expect(isSpendMeter('aiCredits')).toBe(true);
    expect(isSpendMeter('automationRuns')).toBe(true);
    expect(isSpendMeter('formResponses')).toBe(true);
    expect(isSpendMeter('webhookDeliveries')).toBe(false);
    expect(isSpendMeter('rules')).toBe(false);
    expect(isGauge('publicRoadmaps')).toBe(true);
    expect(isGauge('publicKnowledgebases')).toBe(true);
    expect(isGauge('aiCredits')).toBe(false);
    expect(isItemMeter('pages')).toBe(true);
    expect(isItemMeter('formResponses')).toBe(false);
    expect(isItemMeter('publicRoadmaps')).toBe(false);
    expect(isItemMeter(undefined)).toBe(false);
  });

  it("lists the refusals and the mock pages' actions", () => {
    expect(SUBSCRIPTION_ERRORS).toContain('not_team_admin');
    expect(SUBSCRIPTION_ERRORS).toContain('invalid_state');
    expect(MOCK_CHECKOUT_ACTIONS).toEqual(['pay', 'cancel']);
    expect(MOCK_PORTAL_ACTIONS).toHaveLength(8);
  });

  it('says a tier ended, and keeps a request for Pro for Teams, for thirty days', () => {
    const day = 24 * 60 * 60 * 1000;
    expect(ENDED_SHOWN_DAYS).toBe(30);
    expect(ENDED_SHOWN_MS).toBe(30 * day);
    expect(TEAM_REQUESTS_KEPT_DAYS).toBe(30);
    expect(TEAM_REQUESTS_KEPT_MS).toBe(30 * day);
    expect(TEAM_REQUESTS_SHOWN).toBe(5);
    expect(TEAM_REQUEST_NOTE_MAX).toBe(500);
    expect(SUBSCRIPTION_ERRORS).toContain('not_team_member');
  });

  it('knows a limit by its key, and nothing else', () => {
    for (const key of Object.keys(TIER_LIMITS.free)) expect(isLimitKey(key)).toBe(true);
    for (const value of ['rules', 'toString', '', null, 3, undefined])
      expect(isLimitKey(value)).toBe(false);
  });
});
