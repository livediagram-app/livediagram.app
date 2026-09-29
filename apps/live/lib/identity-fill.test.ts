import { contrastRatio } from '@livediagram/document';
import { describe, expect, it } from 'vitest';
import { PARTICIPANT_COLORS } from './identity';
import { IDENTITY_FILL, identityDeep, identityVars } from './identity-fill';

// White text on an identity colour in dark mode (docs/specs/004-interface-design/color-scheme.md, Dark
// palette rules): white fails AA on every participant colour, so dark mode paints the disc a deeper
// shade of the same hue and keeps the white initials. Light mode keeps the colour as it is.
describe('identityDeep', () => {
  it('holds white initials at AA on every participant colour', () => {
    for (const color of PARTICIPANT_COLORS) {
      expect(contrastRatio('#ffffff', identityDeep(color)), color).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("takes each participant colour's own 700 step", () => {
    expect(identityDeep('#0ea5e9')).toBe('#0369a1'); // sky
    expect(identityDeep('#84cc16')).toBe('#4d7c0f'); // lime
    expect(identityDeep('#6366f1')).toBe('#4338ca'); // indigo
  });

  it('darkens any other colour just enough for white to read', () => {
    for (const color of ['#fde047', '#22d3ee', '#a3a3a3']) {
      expect(contrastRatio('#ffffff', identityDeep(color)), color).toBeGreaterThanOrEqual(4.5);
    }
    expect(identityDeep('#1e3a8a')).toBe('#1e3a8a'); // already deep enough
  });

  it('passes a colour it cannot read through untouched', () => {
    expect(identityDeep('hsl(10 50% 50%)')).toBe('hsl(10 50% 50%)');
  });
});

describe('identityVars + IDENTITY_FILL', () => {
  it('carry both shades as custom properties the fill class reads', () => {
    expect(identityVars('#84cc16')).toEqual({
      '--identity': '#84cc16',
      '--identity-deep': '#4d7c0f',
    });
    expect(IDENTITY_FILL).toBe('bg-(--identity) dark:bg-(--identity-deep)');
  });
});
