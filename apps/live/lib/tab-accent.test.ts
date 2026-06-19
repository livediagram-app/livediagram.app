import { describe, expect, it } from 'vitest';
import { legibleColor } from './tab-accent';

// The legibility transform: a colour too pale for the light bar gets darkened,
// one too dark for the dark bar gets lightened, and anything already legible
// (or not a parseable hex) is left as-is.
describe('legibleColor', () => {
  it('darkens a light colour on the light bar, leaves it on the dark bar', () => {
    expect(legibleColor('#ffffff', false)).not.toBe('#ffffff');
    expect(legibleColor('#ffffff', true)).toBe('#ffffff');
  });

  it('lightens a dark colour on the dark bar, leaves it on the light bar', () => {
    expect(legibleColor('#000000', true)).not.toBe('#000000');
    expect(legibleColor('#000000', false)).toBe('#000000');
  });

  it('leaves a non-hex colour untouched on either surface', () => {
    expect(legibleColor('rgb(2 132 199)', false)).toBe('rgb(2 132 199)');
    expect(legibleColor('rgb(2 132 199)', true)).toBe('rgb(2 132 199)');
  });
});
