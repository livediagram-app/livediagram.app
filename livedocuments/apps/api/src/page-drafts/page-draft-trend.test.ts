import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { hasTrendData } from './page-draft-trend';

// docs/specs/007-editor/describe-a-page.md "Charts and changes only for trends".
describe('hasTrendData', () => {
  it('hears a trend: a change, a comparison with before, a run of periods, or a chart', () => {
    for (const t of [
      'Revenue grew 40% this year',
      'Q3 KPIs: revenue £2.4M (+18%)',
      'Churn down -0.4 pts',
      'Sign-ups vs last year',
      'Sales last quarter and this',
      'Users over time',
      'A chart of bookings',
      'Q1 120k, Q2 140k, Q3 180k',
      'March 4k, April 6k',
      '2024: 10 stores, 2025: 14 stores',
    ])
      expect(hasTrendData(t), t).toBe(true);
  });

  it('hears none in plain figures, one period, a price or a date', () => {
    for (const t of [
      'Our year in 4 key figures: 12k customers, 94% would recommend, 48 countries, 1.4M orders',
      'Facts about honey bees with numbers',
      'Q3 at a glance',
      '£12 per month, billed yearly-ish',
      'Workshop on 14 November 2026 at 7pm',
      'Over 20 years of experience',
      'Team of 5-10 people',
      '',
    ])
      expect(hasTrendData(t), t).toBe(false);
  });

  it('reads the longest request in a blink', () => {
    const long = 'figures 12k and 94% '.repeat(25);
    expect(cpuMsOf(() => hasTrendData(long))).toBeLessThan(cpuBudgetMs(20));
  });
});
