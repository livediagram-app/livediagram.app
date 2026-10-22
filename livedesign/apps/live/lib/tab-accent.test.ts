import { describe, expect, it } from 'vitest';
import { MIN_TEXT_CONTRAST, contrastRatio, isLightColor, type Tab } from '@livedesign/document';
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

// A tab on a theme that paints no stroke — Default, and any unthemed
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

// Issue #863: the active pill's label reads at WCAG AA on the pill's own surface, whatever the accent.
describe('the active pill label contrast', () => {
  const accents = [
    '#0284c7',
    '#ffffff',
    '#000000',
    '#f59e0b',
    '#22c55e',
    '#e11d48',
    '#7c3aed',
    '#94a3b8',
  ];
  it.each(accents)('%s reads at 4.5:1 or more on white and on slate-800', (accent) => {
    expect(contrastRatio(legibleColor(accent, false), '#ffffff')).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    );
    expect(contrastRatio(legibleColor(accent, true), '#1d293d')).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    );
  });

  it('keeps an accent that already reads', () => {
    expect(legibleColor('#0369a1', false)).toBe('#0369a1');
  });
});
