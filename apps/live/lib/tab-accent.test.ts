import { describe, expect, it } from 'vitest';
import { isLightColor, type Tab } from '@livediagram/diagram';
import { legibleColor, legibleTabAccent } from './tab-accent';

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
    // The transform only parses #rrggbb. Anything else passes through, which is
    // why nothing the app supplies may be written in another notation — see the
    // default accent below.
    expect(legibleColor('rgb(2 132 199)', false)).toBe('rgb(2 132 199)');
    expect(legibleColor('rgb(2 132 199)', true)).toBe('rgb(2 132 199)');
  });
});

// A tab on a colour scheme that paints no stroke — Default, and any unthemed
// tab, which between them are most tabs — falls back to the palette accent.
// That fallback used to be written `rgb(2 132 199)`, which the transform above
// cannot parse, so it skipped the ONE accent almost every pill uses: on the
// dark bar it sat at 3.6:1 against the pill surface, under the 4.5 AA needs,
// while every custom scheme's accent was being lifted correctly.
describe('the default tab accent', () => {
  const unthemed = { id: 't', name: 'Tab 1', elements: [] } as unknown as Tab;

  it('goes through the legibility rule like any other accent', () => {
    expect(legibleTabAccent(unthemed, true)).not.toBe(legibleTabAccent(unthemed, false));
  });

  it('is lifted into the light half for the dark bar', () => {
    expect(isLightColor(legibleTabAccent(unthemed, true))).toBe(true);
  });

  it('keeps its own depth on the light bar', () => {
    expect(isLightColor(legibleTabAccent(unthemed, false))).toBe(false);
  });
});
