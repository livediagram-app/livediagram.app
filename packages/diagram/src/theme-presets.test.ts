import { describe, expect, it } from 'vitest';
import { STICKY_PRESETS } from './theme-presets';
import { isLightColor } from './colors';

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
