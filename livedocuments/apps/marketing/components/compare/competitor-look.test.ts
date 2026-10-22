import { describe, expect, it } from 'vitest';

import { ALTERNATIVES } from '@/lib/alternatives';

import { COMPETITOR_LOOK } from './competitor-look';

describe('COMPETITOR_LOOK', () => {
  it('draws every comparison, and nothing that is not one', () => {
    expect(Object.keys(COMPETITOR_LOOK).sort()).toEqual(ALTERNATIVES.map((a) => a.slug).sort());
  });

  it('gives every competitor its own glyph and tone', () => {
    const looks = Object.values(COMPETITOR_LOOK);
    expect(new Set(looks.map((l) => l.icon)).size).toBe(looks.length);
    expect(new Set(looks.map((l) => l.panel)).size).toBe(looks.length);
  });

  it('keeps every highlight chip short enough for one line', () => {
    for (const look of Object.values(COMPETITOR_LOOK)) {
      for (const chip of look.highlights) expect(chip.length).toBeLessThanOrEqual(24);
    }
  });
});
