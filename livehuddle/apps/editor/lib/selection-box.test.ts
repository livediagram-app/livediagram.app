import { describe, expect, it } from 'vitest';
import { SELECTION_BOX_FALLBACK, selectionBoxColors } from './selection-box';

describe('selectionBoxColors', () => {
  it('draws the theme accent at full strength on light paper', () => {
    expect(selectionBoxColors('#123456', 'light')).toEqual({
      stroke: '#123456',
      fill: 'color-mix(in srgb, #123456 12%, transparent)',
    });
  });

  it('softens the border and wash on dark paper', () => {
    expect(selectionBoxColors('#123456', 'dark')).toEqual({
      stroke: 'color-mix(in srgb, #123456 80%, transparent)',
      fill: 'color-mix(in srgb, #123456 10%, transparent)',
    });
  });

  it('falls back to sky on light paper and the dark selection ring blue on dark', () => {
    expect(selectionBoxColors(null, 'light').stroke).toBe(SELECTION_BOX_FALLBACK.light);
    expect(selectionBoxColors(undefined, 'dark').stroke).toBe(
      `color-mix(in srgb, ${SELECTION_BOX_FALLBACK.dark} 80%, transparent)`,
    );
    expect(SELECTION_BOX_FALLBACK.dark).not.toBe(SELECTION_BOX_FALLBACK.light);
  });

  it('keeps non-hex theme colours working', () => {
    expect(selectionBoxColors('rgb(2 132 199)', 'dark').fill).toBe(
      'color-mix(in srgb, rgb(2 132 199) 10%, transparent)',
    );
  });
});
