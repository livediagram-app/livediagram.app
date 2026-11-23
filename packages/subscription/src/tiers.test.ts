import { describe, expect, it } from 'vitest';
import {
  isPerMemberLimit,
  isTier,
  limitLeft,
  limitReached,
  limitsFor,
  PER_MEMBER_LIMITS,
  seatsFor,
  TEAM_SEATS_MIN,
  TIER_LIMITS,
  TIER_NAMES,
  TIERS,
} from './tiers';

const MB = 1_000_000;
const GB = 1000 * MB;
const MINUTE = 60_000;

describe('the tiers', () => {
  it('are Free, Pro and Pro for Teams', () => {
    expect(TIERS).toEqual(['free', 'pro', 'team']);
    expect(TIER_NAMES).toEqual({ free: 'Free', pro: 'Pro', team: 'Pro for Teams' });
    expect(isTier('team')).toBe(true);
    for (const value of ['Pro', 'legacy', '', null, 1]) expect(isTier(value)).toBe(false);
  });

  it("hold the spec's limits, number for number", () => {
    expect(TIER_LIMITS.free).toEqual({
      automationRunsPerMonth: 500,
      automationRules: 25,
      emailToBoardPerMonth: 500,
      formResponsesPerMonth: 500,
      publicRoadmaps: 1,
      publicKnowledgebases: 1,
      aiCreditsPerMonth: 50,
      imageStorageBytes: 500 * MB,
      imageMaxBytes: 25 * MB,
      historyDays: 7,
      walkthroughMaxMs: 5 * MINUTE,
      walkthroughsStored: 5,
      callMinutesPerMonth: 1000,
      knowledgebasePages: 500,
      aiKnowledgeHistoryDays: 30,
      ownAiKey: true,
    });
    expect(TIER_LIMITS.pro).toEqual({
      automationRunsPerMonth: 10_000,
      automationRules: 500,
      emailToBoardPerMonth: 10_000,
      formResponsesPerMonth: 10_000,
      publicRoadmaps: 10,
      publicKnowledgebases: 10,
      aiCreditsPerMonth: 1000,
      imageStorageBytes: 50 * GB,
      imageMaxBytes: 25 * MB,
      historyDays: null,
      walkthroughMaxMs: 30 * MINUTE,
      walkthroughsStored: null,
      callMinutesPerMonth: 5000,
      knowledgebasePages: 10_000,
      aiKnowledgeHistoryDays: 365,
      ownAiKey: true,
    });
    expect(TIER_LIMITS.team).toEqual({
      automationRunsPerMonth: 5000,
      automationRules: 250,
      emailToBoardPerMonth: 5000,
      formResponsesPerMonth: 5000,
      publicRoadmaps: null,
      publicKnowledgebases: null,
      aiCreditsPerMonth: 500,
      imageStorageBytes: 250 * GB,
      imageMaxBytes: 25 * MB,
      historyDays: null,
      walkthroughMaxMs: 30 * MINUTE,
      walkthroughsStored: null,
      callMinutesPerMonth: 2500,
      knowledgebasePages: 5000,
      aiKnowledgeHistoryDays: 365,
      ownAiKey: true,
    });
  });

  it('pool every account-wide count per member, and nothing else', () => {
    expect(PER_MEMBER_LIMITS).toEqual([
      'automationRunsPerMonth',
      'automationRules',
      'emailToBoardPerMonth',
      'formResponsesPerMonth',
      'aiCreditsPerMonth',
      'callMinutesPerMonth',
      'knowledgebasePages',
    ]);
    expect(isPerMemberLimit('aiCreditsPerMonth')).toBe(true);
    expect(isPerMemberLimit('automationRules')).toBe(true);
    expect(isPerMemberLimit('imageStorageBytes')).toBe(false);
  });

  it("count a team's seats as its members, never fewer than three", () => {
    expect(TEAM_SEATS_MIN).toBe(3);
    expect(seatsFor(0)).toBe(3);
    expect(seatsFor(2)).toBe(3);
    expect(seatsFor(3)).toBe(3);
    expect(seatsFor(12)).toBe(12);
    expect(seatsFor(7.9)).toBe(7);
    expect(seatsFor(-4)).toBe(3);
    expect(seatsFor(Number.NaN)).toBe(3);
    expect(seatsFor(Number.POSITIVE_INFINITY)).toBe(3);
  });

  it("multiply a team's pooled limits by its seats and leave a person's alone", () => {
    expect(limitsFor('free')).toBe(TIER_LIMITS.free);
    expect(limitsFor('pro', 40)).toBe(TIER_LIMITS.pro);
    expect(limitsFor('team')).toMatchObject({ aiCreditsPerMonth: 1500, callMinutesPerMonth: 7500 });
    expect(limitsFor('team', 1)).toMatchObject({
      aiCreditsPerMonth: 1500,
      callMinutesPerMonth: 7500,
    });
    const ten = limitsFor('team', 10);
    expect(ten).toMatchObject({
      automationRunsPerMonth: 50_000,
      automationRules: 2500,
      emailToBoardPerMonth: 50_000,
      formResponsesPerMonth: 50_000,
      aiCreditsPerMonth: 5000,
      callMinutesPerMonth: 25_000,
      knowledgebasePages: 50_000,
    });
    expect({
      ...ten,
      automationRunsPerMonth: 5000,
      automationRules: 250,
      emailToBoardPerMonth: 5000,
      formResponsesPerMonth: 5000,
      aiCreditsPerMonth: 500,
      callMinutesPerMonth: 2500,
      knowledgebasePages: 5000,
    }).toEqual(TIER_LIMITS.team);
  });

  it('say when a limit is reached and what is left, unlimited never running out', () => {
    expect(limitReached(9, 10)).toBe(false);
    expect(limitReached(10, 10)).toBe(true);
    expect(limitReached(0, 0)).toBe(true);
    expect(limitReached(1e9, null)).toBe(false);
    expect(limitLeft(4, 10)).toBe(6);
    expect(limitLeft(12, 10)).toBe(0);
    expect(limitLeft(12, null)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('Largest Image apart from the table', () => {
  it('is the same number the table holds, and its ceiling is the most any tier takes', async () => {
    const { IMAGE_MAX_BYTES, IMAGE_MAX_BYTES_ANY_TIER } = await import('./image-sizes');
    for (const limits of Object.values(TIER_LIMITS))
      expect(limits.imageMaxBytes).toBe(IMAGE_MAX_BYTES);
    expect(IMAGE_MAX_BYTES_ANY_TIER).toBe(
      Math.max(...Object.values(TIER_LIMITS).map((limits) => limits.imageMaxBytes)),
    );
  });
});
