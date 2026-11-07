import { describe, expect, it } from 'vitest';
import { legacyShapeColorPresets, shapeColorPresets, STICKY_PRESETS } from './theme-presets';
import { THEMES } from './themes-data';
import { themeHalf } from './theme-halves';
import { THEME_TEXT_CONTRAST } from './readable-colour';
import { contrastRatio, isLightColor } from './colors';

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

describe('shapeColorPresets', () => {
  // docs/specs/010-palette/style-presets.md: every preset's label reads on its fill, in both halves of every
  // theme. Bold's dark half once put white on a mid-tone fill (2.9:1 on Pine), Solid white on the brand sky blue.
  it('gives every preset a label that meets the text floor, in both halves of every theme', () => {
    for (const theme of THEMES) {
      for (const appearance of ['light', 'dark'] as const) {
        for (const p of shapeColorPresets(themeHalf(theme, appearance))) {
          const ratio = contrastRatio(p.text, p.fill);
          expect(ratio, `${theme.id}/${appearance} ${p.id}`).toBeGreaterThanOrEqual(
            THEME_TEXT_CONTRAST,
          );
        }
      }
    }
  });

  it('keeps Bold white on a fill darker than its accent, with an edge darker still', () => {
    for (const theme of THEMES) {
      const half = themeHalf(theme, 'dark');
      const bold = shapeColorPresets(half).find((p) => p.id === 'bold')!;
      expect(bold.text, theme.id).toBe('#ffffff');
      expect(contrastRatio(bold.stroke, '#ffffff')).toBeGreaterThan(
        contrastRatio(bold.fill, '#ffffff'),
      );
    }
  });

  it('keeps the same tiles: every id is still offered', () => {
    for (const theme of THEMES) {
      const ids = (presets: { id: string }[]) => presets.map((p) => p.id);
      expect(ids(shapeColorPresets(theme))).toEqual(ids(legacyShapeColorPresets(theme)));
    }
  });

  it('leaves a preset that already read exactly as it was', () => {
    // Only short labels move, so a document styled with a readable preset keeps its colours.
    for (const theme of THEMES) {
      const legacy = new Map(legacyShapeColorPresets(theme).map((p) => [p.id, p]));
      for (const p of shapeColorPresets(theme)) {
        const was = legacy.get(p.id)!;
        if (contrastRatio(was.text, was.fill) >= THEME_TEXT_CONTRAST) {
          expect(p, `${theme.id} ${p.id}`).toEqual(was);
        }
      }
    }
  });
});
