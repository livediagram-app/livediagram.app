import { describe, expect, it } from 'vitest';
import { STICKY_PRESETS, tableColorPresets } from './theme-presets';
import { THEMES } from './themes-data';
import { isLightColor } from './colors';

const DEFAULT_THEME = THEMES[0]!;

describe('STICKY_PRESETS', () => {
  // A sticky had no presets at all: recolouring a note meant picking a fill
  // and then hunting a readable ink to go on it. These are the pad.
  it('gives every note a readable ink on its paper', () => {
    for (const p of STICKY_PRESETS) {
      // Dark paper takes light ink and vice versa; the pairing is the point
      // of a preset, so a swapped one would be worse than no preset.
      expect(isLightColor(p.fill)).toBe(!isLightColor(p.text));
    }
  });

  it('carries no border, because a note has none', () => {
    for (const p of STICKY_PRESETS) {
      expect(p.stroke).toBe('transparent');
      expect(p.borderStroke).toBe('none');
    }
  });

  it('has unique ids, namespaced away from the shape presets', () => {
    expect(new Set(STICKY_PRESETS.map((p) => p.id)).size).toBe(STICKY_PRESETS.length);
    for (const p of STICKY_PRESETS) expect(p.id.startsWith('sticky-')).toBe(true);
  });
});

describe('tableColorPresets', () => {
  // A table paints four surfaces (cells, grid, header band, header text) that
  // only read well in combination, which is what the presets are for. The
  // pairing that matters most is the header: a band you cannot read the title
  // on is worse than the default.
  const presets = tableColorPresets(DEFAULT_THEME);

  it('gives every header band a readable title on it', () => {
    for (const p of presets) {
      if (p.headerFill === 'transparent') continue;
      expect(isLightColor(p.headerFill)).toBe(!isLightColor(p.headerText));
    }
  });

  it('has unique ids, namespaced away from the shape presets', () => {
    expect(new Set(presets.map((p) => p.id)).size).toBe(presets.length);
    for (const p of presets) expect(p.id.startsWith('table-')).toBe(true);
  });

  it('offers at least one banded and one plain look', () => {
    expect(presets.some((p) => p.zebra)).toBe(true);
    expect(presets.some((p) => !p.zebra)).toBe(true);
  });
});
