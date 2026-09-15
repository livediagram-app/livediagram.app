import { describe, expect, it } from 'vitest';
import { isDarkCanvas } from './dark-canvas';

// A sticky's paper peel is a fixed ink (spec/09): tuned against a light
// wall, it all but vanishes on a dark one — the shadow has to deepen with
// the backdrop or the note stops lifting off the board. The canvas surface
// flags its own darkness so the peel (pure CSS) can respond without
// knowing anything about themes.
describe('isDarkCanvas', () => {
  it('flags the dark theme backdrops', () => {
    expect(isDarkCanvas('#2b2b33')).toBe(true); // Charcoal
    expect(isDarkCanvas('#0f172a')).toBe(true); // Midnight-ish
    expect(isDarkCanvas('#18181b')).toBe(true);
  });

  it('leaves light and paper backdrops alone', () => {
    expect(isDarkCanvas('#ffffff')).toBe(false);
    expect(isDarkCanvas('#fdf2f8')).toBe(false); // Pink
    expect(isDarkCanvas('#f0fdf4')).toBe(false); // Forest
  });

  it('treats an unset or non-hex backdrop as light (the default canvas)', () => {
    expect(isDarkCanvas(undefined)).toBe(false);
    expect(isDarkCanvas('transparent')).toBe(false);
  });
});
