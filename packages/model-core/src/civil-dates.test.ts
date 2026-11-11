import { describe, expect, it } from 'vitest';
import { DAY_MS } from './civil-dates';

describe('DAY_MS', () => {
  it('is a whole day in milliseconds', () => {
    expect(DAY_MS).toBe(24 * 60 * 60 * 1000);
  });
});
