import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { figureMaxFor, givesFigures, hasTrendData, isOrdinal } from './page-draft-trend';

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

// "Figures not parts": a request's figures, and a part's number slot.
describe('givesFigures', () => {
  it('hears figures: two or more numbers, one more than a small count or with a unit', () => {
    for (const t of [
      'Our year in 4 key figures: 12k customers, 94% would recommend, 48 countries, 1.4M orders',
      'Revenue £2.4m and 3 new offices',
      'Bees: 20000 species, 6 weeks',
    ])
      expect(givesFigures(t), t).toBe(true);
  });

  it('hears none in an agenda’s times, a count of parts, one number or a year', () => {
    for (const t of [
      'Agenda: 9:00 welcome, 9:30 talks, 11:00 lunch',
      'Workshop agenda, 9am welcome, 10am talks, 4pm close',
      'Four parts, 10 min each, 2 breaks',
      'Our 12 values',
      'Plans for 2026 and 2027',
      'Facts about bees',
    ])
      expect(givesFigures(t), t).toBe(false);
  });
});

describe('isOrdinal and figureMaxFor', () => {
  it('knows a part’s number, and the room its slot has', () => {
    for (const t of ['01', '1', '07', '3.']) expect(isOrdinal(t), t).toBe(true);
    for (const t of ['', '12', '48', '123', '1.4M', '94%', 'Q3', '2026'])
      expect(isOrdinal(t), t).toBe(false);
    expect(figureMaxFor('01')).toBe(3);
    expect(figureMaxFor('12k')).toBeNull();
  });
});
