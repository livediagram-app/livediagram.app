import { describe, expect, it } from 'vitest';
import { FEATURE_TILE_CLASS, featureTileStyle } from './featureColours';

describe('featureTileStyle', () => {
  it('tints the tile with the hue at 12% and hands the hue to the glyph', () => {
    expect(featureTileStyle('#475569')).toEqual({
      backgroundColor: '#4755691f',
      '--feature': '#475569',
    });
  });
});

describe('FEATURE_TILE_CLASS', () => {
  it('draws the glyph in the hue, lifted toward white in dark mode', () => {
    expect(FEATURE_TILE_CLASS.split(' ')).toEqual([
      'text-(--feature)',
      'dark:text-[color-mix(in_oklab,var(--feature)_70%,white)]',
    ]);
  });
});
