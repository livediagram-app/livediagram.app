import { describe, expect, it } from 'vitest';
import {
  cleanProfileName,
  PRESENCE_COLOUR_VALUES,
  PRESENCE_COLOURS,
  PROFILE_NAME_MAX,
  presenceColour,
} from './index';

// WCAG 2 contrast between two #rrggbb colours.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe('presence colours', () => {
  it('are ten distinct, named, lower-case colours, each with a dark shade', () => {
    expect(PRESENCE_COLOURS).toHaveLength(10);
    for (const { value, deep, name } of PRESENCE_COLOURS) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
      expect(deep).toMatch(/^#[0-9a-f]{6}$/);
      expect(name).toMatch(/^[A-Z][a-z]+$/);
    }
    expect(new Set(PRESENCE_COLOUR_VALUES).size).toBe(10);
    expect(new Set(PRESENCE_COLOURS.map((c) => c.name)).size).toBe(10);
    expect(PRESENCE_COLOUR_VALUES).toEqual(PRESENCE_COLOURS.map((c) => c.value));
  });

  it('keep white text readable on each dark shade (AA)', () => {
    for (const { deep } of PRESENCE_COLOURS) {
      expect(contrast('#ffffff', deep)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('look a colour up in any case, and nothing outside the palette', () => {
    expect(presenceColour('#0EA5E9')).toEqual({ value: '#0ea5e9', deep: '#0369a1', name: 'Sky' });
    expect(presenceColour('#123456')).toBeUndefined();
    expect(presenceColour(null)).toBeUndefined();
    expect(presenceColour('')).toBeUndefined();
  });
});

describe('a display name', () => {
  it('is stored trimmed, an empty one as none, up to the accounts Worker’s limit', () => {
    expect(cleanProfileName('  Ada Lovelace ')).toBe('Ada Lovelace');
    expect(cleanProfileName('   ')).toBeNull();
    expect(PROFILE_NAME_MAX).toBe(120);
  });
});
