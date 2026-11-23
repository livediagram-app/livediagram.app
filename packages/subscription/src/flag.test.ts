import { describe, expect, it } from 'vitest';
import { proEnabled } from './flag';

describe('the flag', () => {
  it('is on for true, 1 and on, in any case, with space round it', () => {
    for (const value of ['true', 'TRUE', '1', 'on', ' On ', 'tRuE']) {
      expect(proEnabled(value), value).toBe(true);
    }
  });

  it('is off for anything else, and when unset', () => {
    for (const value of ['false', '0', 'off', '', 'yes', 'enabled', '2', undefined, null]) {
      expect(proEnabled(value), String(value)).toBe(false);
    }
    expect(proEnabled(true as unknown as string)).toBe(false);
  });
});
