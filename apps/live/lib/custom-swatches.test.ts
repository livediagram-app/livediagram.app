import { describe, expect, it } from 'vitest';
import { addCustomSwatch, MAX_CUSTOM_SWATCHES, removeCustomSwatch } from './custom-swatches';

const PRESETS = ['#f0f9ff', '#0ea5e9'];

describe('custom swatches', () => {
  it('remembers a colour the theme does not already offer', () => {
    expect(addCustomSwatch([], '#ff0055', PRESETS)).toEqual(['#ff0055']);
  });

  it('does not remember one the theme already offers', () => {
    // It is already one click away; a duplicate would just cost a slot.
    expect(addCustomSwatch([], '#0ea5e9', PRESETS)).toEqual([]);
    // ...whatever case it arrives in.
    expect(addCustomSwatch([], '#0EA5E9', PRESETS)).toEqual([]);
  });

  it('ignores anything that is not a plain hex colour', () => {
    // `transparent` is always on the row already, and a gradient or a
    // colour-mix() string is not a swatch you can paint a chip with.
    for (const value of ['transparent', 'none', 'rgb(1,2,3)', '', '#fff']) {
      expect(addCustomSwatch([], value, PRESETS), value).toEqual([]);
    }
  });

  it('moves a re-used colour back to the front rather than duplicating it', () => {
    const after = addCustomSwatch(['#111111', '#222222'], '#222222', PRESETS);
    expect(after).toEqual(['#222222', '#111111']);
  });

  it('matches case-insensitively when de-duplicating', () => {
    expect(addCustomSwatch(['#aabbcc'], '#AABBCC', PRESETS)).toEqual(['#AABBCC']);
  });

  it('caps the list, dropping the oldest', () => {
    let list: string[] = [];
    for (let i = 0; i < MAX_CUSTOM_SWATCHES + 4; i++) {
      list = addCustomSwatch(list, `#0000${i.toString(16).padStart(2, '0')}`, PRESETS);
    }
    expect(list).toHaveLength(MAX_CUSTOM_SWATCHES);
    // Newest first, so the one just used is at the front.
    expect(list[0]).toBe('#00000f');
  });

  it('removes a colour, case-insensitively, and leaves the rest in order', () => {
    expect(removeCustomSwatch(['#111111', '#222222', '#333333'], '#222222')).toEqual([
      '#111111',
      '#333333',
    ]);
    expect(removeCustomSwatch(['#AABBCC'], '#aabbcc')).toEqual([]);
  });

  it('is safe on an absent list', () => {
    expect(addCustomSwatch(undefined, '#ff0055', PRESETS)).toEqual(['#ff0055']);
    expect(removeCustomSwatch(undefined, '#ff0055')).toEqual([]);
  });
});
