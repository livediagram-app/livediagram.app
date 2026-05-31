import { describe, expect, it } from 'vitest';
import { THEMES, getTheme } from './themes';

describe('THEMES catalogue', () => {
  it('has a unique id per theme', () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leads with the brand theme (the un-themed default)', () => {
    expect(THEMES[0]?.id).toBe('brand');
  });

  it('gives every theme a label and a backdrop', () => {
    for (const t of THEMES) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.backgroundColor).toMatch(/^#[0-9a-f]{3,8}$/i);
      expect(t.patternColor).toMatch(/^#[0-9a-f]{3,8}$/i);
      expect(t.backgroundPattern).toBeTruthy();
    }
  });
});

describe('getTheme', () => {
  it('returns the matching theme by id', () => {
    const slate = getTheme('slate');
    expect(slate.id).toBe('slate');
  });

  it('falls back to the brand theme for an unknown id', () => {
    expect(getTheme('does-not-exist').id).toBe('brand');
  });

  it('falls back to the brand theme for undefined', () => {
    expect(getTheme(undefined).id).toBe('brand');
  });

  it('returns the exact catalogue object (referential, not a copy)', () => {
    expect(getTheme('forest')).toBe(THEMES.find((t) => t.id === 'forest'));
  });
});
