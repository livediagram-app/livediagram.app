import { describe, expect, it } from 'vitest';
import { PRESENCE_COLOURS } from '@liveworkspace/settings/presence';
import { avatarColour, avatarFill, initials } from './initials';

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

describe('avatarFill', () => {
  it('paints a palette colour in its deep shade, in any case', () => {
    expect(avatarFill('Ada', '#0ea5e9')).toBe('#0369a1');
    expect(avatarFill('Ada', '#0EA5E9')).toBe('#0369a1');
  });

  it('paints a custom colour as it is when white reads on it, and darkened when not', () => {
    expect(avatarFill('Ada', '#1e3a8a')).toBe('#1e3a8a');
    expect(avatarFill('Ada', '#fde047')).toBe('color-mix(in oklab, #fde047 55%, black)');
    expect(avatarFill('Ada', 'oklch(70% 0.1 200)')).toBe(
      'color-mix(in oklab, oklch(70% 0.1 200) 55%, black)',
    );
  });

  it('falls back to the name-picked colour with none, or one that is not safe to paint', () => {
    const fallback = avatarColour('Ada Lovelace').deep;
    for (const colour of [undefined, null, '', 'url(x)', 'red;x', 'red}']) {
      expect(avatarFill('Ada Lovelace', colour)).toBe(fallback);
    }
  });
});
