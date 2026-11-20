import { describe, expect, it } from 'vitest';
import { dayOf, daysBefore, hourOf } from './days';

describe('windows of time', () => {
  it('names the UTC day and hour of a moment', () => {
    const at = Date.UTC(2026, 10, 20, 14, 59, 59);
    expect(dayOf(at)).toBe('2026-11-20');
    expect(hourOf(at)).toBe('2026-11-20T14');
    expect(daysBefore(at, 20)).toBe('2026-10-31');
  });
});
