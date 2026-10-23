import { describe, expect, it } from 'vitest';
import { COMPETITOR_LOOK, lookOf, NEUTRAL_LOOK } from './looks';

describe('COMPETITOR_LOOK', () => {
  const looks = Object.values(COMPETITOR_LOOK);

  it('gives every competitor, in every app, a glyph and a tone of its own', () => {
    expect(new Set(looks.map((l) => l.icon)).size).toBe(looks.length);
    expect(new Set(looks.map((l) => l.panel)).size).toBe(looks.length);
  });

  it('keys every look by a URL-safe slug', () => {
    for (const slug of Object.keys(COMPETITOR_LOOK))
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('writes each tone out in full for light and dark, so every app build sees the classes', () => {
    for (const look of looks) {
      expect(look.panel).toMatch(/^from-\S+ to-\S+ dark:from-\S+ dark:to-\S+$/);
      expect(look.glyph).toMatch(/^text-\S+ dark:text-\S+$/);
    }
  });

  it('draws an unknown competitor neutrally rather than failing the page', () => {
    expect(lookOf('nobody')).toBe(NEUTRAL_LOOK);
    expect(lookOf('miro')).toBe(COMPETITOR_LOOK.miro);
  });
});
