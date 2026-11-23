import { describe, expect, it } from 'vitest';
import {
  formatAmount,
  formatBytes,
  formatDays,
  formatTierLimit,
  formatUsage,
  LIMIT_GROUPS,
  LIMIT_ROWS,
  limitRow,
  ROW_APPS,
  rowAppsName,
} from './rows';
import { TIER_LIMITS, type LimitKey } from './tiers';

describe('the comparison', () => {
  it('has one row for every limit, each in a known group', () => {
    expect(LIMIT_ROWS.map((row) => row.key).sort()).toEqual(Object.keys(TIER_LIMITS.free).sort());
    for (const row of LIMIT_ROWS) {
      expect(LIMIT_GROUPS).toContain(row.group);
      expect(row.info.endsWith('.')).toBe(true);
    }
    expect(new Set(LIMIT_ROWS.map((row) => row.group))).toEqual(new Set(LIMIT_GROUPS));
  });

  it('finds a row by its limit, and says so when there is none', () => {
    expect(limitRow('automationRules').label).toBe('Automation Rules');
    expect(() => limitRow('nothing' as LimitKey)).toThrow('No comparison row for nothing');
  });

  it('writes bytes in decimal units', () => {
    expect(formatBytes(500_000_000)).toBe('500 MB');
    expect(formatBytes(5_000_000)).toBe('5 MB');
    expect(formatBytes(50_000_000_000)).toBe('50 GB');
    expect(formatBytes(1_500_000_000)).toBe('1.5 GB');
    expect(formatBytes(0)).toBe('0 MB');
  });

  it('writes days, and whole years as years', () => {
    expect(formatDays(1)).toBe('1 day');
    expect(formatDays(7)).toBe('7 days');
    expect(formatDays(30)).toBe('30 days');
    expect(formatDays(365)).toBe('1 year');
    expect(formatDays(730)).toBe('2 years');
    expect(formatDays(0)).toBe('0 days');
    expect(formatDays(1200)).toBe('1,200 days');
  });

  it("writes an amount in its row's unit", () => {
    expect(formatAmount(limitRow('automationRunsPerMonth'), 10_000)).toBe('10,000');
    expect(formatAmount(limitRow('imageStorageBytes'), 250_000_000_000)).toBe('250 GB');
    expect(formatAmount(limitRow('historyDays'), 7)).toBe('7 days');
    expect(formatAmount(limitRow('walkthroughMaxMs'), 30 * 60_000)).toBe('30 minutes');
  });

  it('writes each cell of the comparison', () => {
    const cell = (key: LimitKey, tier: 'free' | 'pro' | 'team') =>
      formatTierLimit(limitRow(key), tier);
    expect(cell('automationRunsPerMonth', 'free')).toBe('500 a month');
    expect(cell('automationRunsPerMonth', 'team')).toBe('5,000 a member');
    expect(cell('automationRules', 'pro')).toBe('500');
    expect(cell('automationRules', 'team')).toBe('250 a member');
    expect(cell('emailToBoardPerMonth', 'pro')).toBe('10,000 a month');
    expect(cell('formResponsesPerMonth', 'free')).toBe('500 a month');
    expect(cell('knowledgebasePages', 'team')).toBe('5,000 a member');
    expect(cell('publicRoadmaps', 'team')).toBe('Unlimited');
    expect(cell('publicKnowledgebases', 'free')).toBe('1');
    expect(cell('publicKnowledgebases', 'pro')).toBe('10');
    expect(cell('publicKnowledgebases', 'team')).toBe('Unlimited');
    expect(cell('aiCreditsPerMonth', 'pro')).toBe('1,000 a month');
    expect(cell('aiCreditsPerMonth', 'team')).toBe('500 a member');
    expect(cell('callMinutesPerMonth', 'team')).toBe('2,500 a member');
    expect(cell('imageStorageBytes', 'free')).toBe('500 MB');
    expect(cell('historyDays', 'free')).toBe('7 days');
    expect(cell('historyDays', 'pro')).toBe('Unlimited');
    expect(cell('walkthroughMaxMs', 'free')).toBe('5 minutes');
    expect(cell('aiKnowledgeHistoryDays', 'pro')).toBe('1 year');
    expect(cell('ownAiKey', 'free')).toBe('Free');
    expect(cell('ownAiKey', 'team')).toBe('Free');
  });

  it('words a limit a tier does not include, should one come back', () => {
    const was = {
      credits: TIER_LIMITS.free.aiCreditsPerMonth,
      own: TIER_LIMITS.free.ownAiKey,
    };
    TIER_LIMITS.free.aiCreditsPerMonth = 0;
    TIER_LIMITS.free.ownAiKey = false;
    try {
      expect(formatTierLimit(limitRow('aiCreditsPerMonth'), 'free')).toBe('Not included');
      expect(formatTierLimit(limitRow('ownAiKey'), 'free')).toBe('Not included');
    } finally {
      TIER_LIMITS.free.aiCreditsPerMonth = was.credits;
      TIER_LIMITS.free.ownAiKey = was.own;
    }
  });

  it('writes usage against a limit, or alone against none', () => {
    expect(formatUsage(limitRow('automationRules'), 42, 500)).toBe('42 of 500');
    expect(formatUsage(limitRow('imageStorageBytes'), 120_000_000, 500_000_000)).toBe(
      '120 MB of 500 MB',
    );
    expect(formatUsage(limitRow('publicRoadmaps'), 14, null)).toBe('14');
  });

  it('Automation Runs is every app’s, counted over the account, and there is no Webhook Deliveries row', () => {
    expect(limitRow('automationRunsPerMonth').apps).toEqual(ROW_APPS);
    expect(limitRow('automationRunsPerMonth').info).toContain('across all your items in every app');
    expect(LIMIT_ROWS.some((row) => row.label === 'Webhook Deliveries')).toBe(false);
  });

  it('names each row’s apps, every one in ROW_APPS order, never liveworkspace', () => {
    for (const row of LIMIT_ROWS) {
      expect(row.apps.length, row.key).toBeGreaterThan(0);
      expect([...row.apps], row.key).toEqual(ROW_APPS.filter((app) => row.apps.includes(app)));
    }
    expect(limitRow('walkthroughMaxMs').apps).not.toContain('livehuddle');
    expect(limitRow('aiCreditsPerMonth').apps).toEqual([
      'livediagram',
      'liveplanner',
      'liveknowledge',
    ]);
    expect(rowAppsName(ROW_APPS)).toBe('Every app');
    expect(rowAppsName(['liveknowledge'])).toBe('liveknowledge');
    expect(rowAppsName(['livediagram', 'liveplanner'])).toBe('livediagram and liveplanner');
    expect(rowAppsName(limitRow('aiCreditsPerMonth').apps)).toBe(
      'livediagram, liveplanner and liveknowledge',
    );
    expect(rowAppsName(limitRow('walkthroughMaxMs').apps)).toBe('Every app but livehuddle');
  });
});
