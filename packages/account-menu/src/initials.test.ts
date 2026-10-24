import { describe, expect, it } from 'vitest';
import { PRESENCE_COLOURS } from '@liveworkspace/settings/presence';
import { avatarColour, initials } from './initials';

describe('initials', () => {
  it('takes the first letters of the first and last names', () => {
    expect(initials('Wendy Tran')).toBe('WT');
    expect(initials('  ada  lovelace king ')).toBe('AK');
  });

  it('takes two letters from a single name, and a placeholder from none', () => {
    expect(initials('Wendy')).toBe('WE');
    expect(initials('W')).toBe('W');
    expect(initials('')).toBe('?');
  });

  it('reads an email as the words of its local part', () => {
    expect(initials('ada.lovelace@example.com')).toBe('AL');
    expect(initials('wendy@example.com')).toBe('WE');
  });
});

describe('avatarColour', () => {
  it('picks the same presence colour for the same name, whatever its case or spacing', () => {
    expect(PRESENCE_COLOURS).toContain(avatarColour('Wendy Tran'));
    expect(avatarColour('Wendy Tran')).toBe(avatarColour(' wendy tran '));
  });

  it('spreads names across the palette', () => {
    const names = [
      'Ada',
      'Grace',
      'Wendy',
      'Tom',
      'Priya',
      'Kenji',
      'Amara',
      'Lucas',
      'Sofia',
      'Omar',
    ];
    expect(new Set(names.map((n) => avatarColour(n).name)).size).toBeGreaterThan(4);
  });
});
