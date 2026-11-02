// An ink drawn over a fill, always AA.
import { describe, expect, it } from 'vitest';
import { readableInk } from './cell-colours';
import { contrastRatio } from './colors';

describe('readableInk', () => {
  it('lifts or deepens an ink until it reads at AA, keeping one that already does', () => {
    expect(readableInk('#0f172a', '#ffffff')).toBe('#0f172a');
    const lifted = readableInk('#047857', '#111827');
    expect(contrastRatio(lifted, '#111827')).toBeGreaterThanOrEqual(4.5);
    const deepened = readableInk('#e2e8f0', '#ecfdf5');
    expect(contrastRatio(deepened, '#ecfdf5')).toBeGreaterThanOrEqual(4.5);
    expect(readableInk('nope', '#ffffff')).toBe('nope');
    // A named or shorthand ink is read (docs/specs/011-theme/light-and-dark.md "Colours an agent writes"): red on
    // white is 4.0:1, so it is deepened; navy already reads and is kept as written.
    expect(contrastRatio(readableInk('red', '#fff'), '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(readableInk('navy', '#fff')).toBe('navy');
  });
});
