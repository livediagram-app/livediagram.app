import { describe, expect, it } from 'vitest';
import { dayKey, dayLabel } from './day-label';

describe('dayLabel', () => {
  it('reads one saved day the same way in each of its three styles', () => {
    const at = new Date('2026-10-30T00:00:00');
    const as = (o: Intl.DateTimeFormatOptions) => at.toLocaleDateString(undefined, o);
    expect(dayLabel('2026-10-30')).toBe(as({ day: 'numeric', month: 'short' }));
    expect(dayLabel('2026-10-30', 'medium')).toBe(
      as({ day: 'numeric', month: 'short', year: 'numeric' }),
    );
    expect(dayLabel('2026-10-30', 'long')).toBe(
      as({ day: 'numeric', month: 'long', year: 'numeric' }),
    );
  });

  it('shows a value that is not a day as it is', () => {
    expect(dayLabel('soon', 'long')).toBe('soon');
  });
});

describe('dayKey', () => {
  it('is the local calendar day, so it never slips a day just after midnight', () => {
    const justAfterMidnight = new Date(2026, 9, 30, 0, 30);
    expect(dayKey(0, justAfterMidnight)).toBe('2026-10-30');
    expect(dayKey(3, justAfterMidnight)).toBe('2026-11-02');
    expect(dayKey(-30, justAfterMidnight)).toBe('2026-09-30');
  });
});
