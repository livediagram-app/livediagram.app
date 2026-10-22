import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colors';
import { legibleOn } from './page-ink-rules';

describe('legibleOn', () => {
  it('darkens a pale colour back on a light tone', () => {
    expect(contrastRatio(legibleOn('#e0f2fe', '#ffffff'), '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps a colour that clears the floor, and re-inks one under a raised floor', () => {
    // #2563eb on white is about 5.2:1: kept at the default 3:1 floor and at 4.5.
    expect(legibleOn('#2563eb', '#ffffff')).toBe('#2563eb');
    // #0ea5e9 on white is about 2.8:1: kept at a 2.5 floor, pushed to AA at a 4.5 floor.
    expect(legibleOn('#0ea5e9', '#ffffff', 2.5)).toBe('#0ea5e9');
    expect(contrastRatio(legibleOn('#0ea5e9', '#ffffff', 4.5), '#ffffff')).toBeGreaterThanOrEqual(
      4.5,
    );
    // A floor above AA is also the target.
    expect(contrastRatio(legibleOn('#0ea5e9', '#ffffff', 7), '#ffffff')).toBeGreaterThanOrEqual(7);
  });
});
