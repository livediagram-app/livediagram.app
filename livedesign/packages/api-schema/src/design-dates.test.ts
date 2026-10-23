import { describe, expect, it } from 'vitest';
import { DESIGN_DATE_MIN, DESIGN_DATE_SKEW_MS, designDates } from './design-dates';

// docs/specs/015-api/api.md "Design dates".
const NOW = Date.UTC(2026, 9, 1);
const day = 86_400_000;

describe('designDates', () => {
  it('stamps both with now when none is given', () => {
    expect(designDates({}, NOW)).toEqual({ ok: true, createdAt: NOW, savedAt: NOW });
  });

  it('keeps a board’s own created and modified dates', () => {
    const createdAt = Date.UTC(2020, 7, 14);
    const savedAt = Date.UTC(2021, 1, 3);
    expect(designDates({ createdAt, savedAt }, NOW)).toEqual({ ok: true, createdAt, savedAt });
  });

  it('keeps an Offline Mode sync’s created date, modified now', () => {
    const createdAt = NOW - 5 * day;
    expect(designDates({ createdAt }, NOW)).toEqual({ ok: true, createdAt, savedAt: NOW });
  });

  it('allows a device clock up to a day ahead, no further', () => {
    expect(designDates({ createdAt: NOW + DESIGN_DATE_SKEW_MS }, NOW).ok).toBe(true);
    expect(designDates({ createdAt: NOW + DESIGN_DATE_SKEW_MS + 1 }, NOW).ok).toBe(false);
  });

  it.each([
    ['before 2000', { createdAt: DESIGN_DATE_MIN - 1 }],
    ['not a whole number', { createdAt: 1.5e12 + 0.5 }],
    ['a string', { createdAt: '2020-08-14T00:00:00Z' }],
    ['not finite', { createdAt: Number.POSITIVE_INFINITY }],
    ['modified before created', { createdAt: NOW - day, savedAt: NOW - 2 * day }],
    ['modified with no created', { savedAt: NOW - day }],
    ['modified in the future', { createdAt: NOW - day, savedAt: NOW + 2 * day }],
  ])('refuses %s', (_, body) => {
    expect(designDates(body as never, NOW)).toEqual({ ok: false });
  });

  it('accepts the lower bound itself', () => {
    expect(designDates({ createdAt: DESIGN_DATE_MIN }, NOW).ok).toBe(true);
  });
});
