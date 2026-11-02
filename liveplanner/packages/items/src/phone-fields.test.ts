import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import { isPhoneNumber, PHONE_DIGITS_MIN, PHONE_HINT, PHONE_MAX, phoneHref } from './phone-fields';

// Phone fields (docs/specs/026-plan/item-types.md "Phone").

describe('a phone number', () => {
  it('takes digits, spaces, brackets, dashes and one leading +', () => {
    for (const ok of [
      '+44 20 7946 0958',
      '(020) 7946-0958',
      '999',
      ' 07700 900123 ',
      '+1-555-010-0199',
    ])
      expect(isPhoneNumber(ok), ok).toBe(true);
  });

  it('refuses anything else, too few digits, or too long', () => {
    expect([PHONE_MAX, PHONE_DIGITS_MIN]).toEqual([32, 3]);
    for (const bad of [
      '12',
      '+44 20 7946 0958 ext 2',
      '44+20',
      '=1+1',
      'call me',
      '1'.repeat(PHONE_MAX + 1),
      '',
      44,
      null,
    ])
      expect(isPhoneNumber(bad), String(bad)).toBe(false);
    expect(PHONE_HINT).toContain('+44');
  });

  it('calls through a tel: link of its + and digits', () => {
    expect(phoneHref('+44 20 7946 0958')).toBe('tel:+442079460958');
    expect(phoneHref(' (020) 7946-0958 ')).toBe('tel:02079460958');
  });

  it('is checked in linear time', () => {
    const worst = `+${' '.repeat(50_000)}x`;
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 50; i += 1) isPhoneNumber(worst);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(50));
  });
});
