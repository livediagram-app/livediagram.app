import { describe, expect, it } from 'vitest';
import {
  legacyShapeColorPresets,
  rederiveTablePresetForTheme,
  shapeColorPresets,
  STICKY_PRESETS,
  tableColorPresets,
} from './theme-presets';
import { THEMES } from './themes-data';
import { themeHalf } from './theme-halves';
import { THEME_TEXT_CONTRAST } from './readable-colour';
import type { TableElement } from './element-types';
import type { Element } from './index';
import { contrastRatio, isLightColor } from './colors';

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

  it('gives every header band a readable title on it, under every theme', () => {
    for (const theme of THEMES) {
      for (const p of tableColorPresets(theme)) {
        if (p.headerFill === 'transparent') continue;
        const ratio = contrastRatio(p.headerText, p.headerFill);
        expect(ratio, `${theme.id} ${p.id}`).toBeGreaterThanOrEqual(THEME_TEXT_CONTRAST);
      }
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

describe('rederiveTablePresetForTheme', () => {
  // A table preset writes RESOLVED colours, so the stored id is the only thing
  // that tells "this theme's Banded" apart from four hand-picked colours.
  const other = THEMES.find((t) => t.id === 'forest')!;
  const banded = tableColorPresets(DEFAULT_THEME).find((p) => p.id === 'table-banded')!;
  const bandedThere = tableColorPresets(other).find((p) => p.id === 'table-banded')!;
  const table: TableElement = {
    id: 't1',
    type: 'table',
    x: 0,
    y: 0,
    width: 300,
    height: 120,
    cells: [['a']],
    fillColor: banded.fill,
    strokeColor: banded.stroke,
    textColor: banded.text,
    headerFill: banded.headerFill,
    headerTextColor: banded.headerText,
    zebra: banded.zebra,
    tablePreset: banded.id,
  };

  it('repaints every surface the look owns, including the header band', () => {
    const next = rederiveTablePresetForTheme({ ...table }, other);
    expect(next).toMatchObject({
      fillColor: bandedThere.fill,
      strokeColor: bandedThere.stroke,
      textColor: bandedThere.text,
      headerFill: bandedThere.headerFill,
      headerTextColor: bandedThere.headerText,
      zebra: bandedThere.zebra,
      tablePreset: 'table-banded',
    });
  });

  it('leaves a table with no binding alone', () => {
    const { tablePreset: _drop, ...unbound } = table;
    expect(rederiveTablePresetForTheme({ ...unbound }, other)).toEqual(unbound);
  });

  it('leaves a binding this theme has never heard of alone', () => {
    const odd = { ...table, tablePreset: 'table-does-not-exist' };
    expect(rederiveTablePresetForTheme(odd, other)).toEqual(odd);
  });

  it('is a no-op on anything that is not a table', () => {
    const shape: Element = {
      id: 's1',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    };
    expect(rederiveTablePresetForTheme(shape, other)).toBe(shape);
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
    // Only short labels move, so a design styled with a readable preset keeps its colours.
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
