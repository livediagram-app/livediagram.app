// livedesign/docs/specs/007-editor/logo-pages.md "Outlined text": each glyph sits where the browser put its first character,
// turned and slanted as it was drawn, in absolute path data; decorations where Chromium draws them.
import { describe, expect, it, vi } from 'vitest';
import {
  decorationPath,
  glyphRunPath,
  glyphRunPlacements,
  glyphStarts,
  syntheticBoldWidth,
  type CharPlace,
  type GlyphRun,
  type OutlineFont,
  type OutlineGlyph,
} from './glyph-paths';

// A 1000-unit face whose every glyph is a unit square (0,0)-(1000,1000), "fi" a ligature, space empty.
const square = {
  commands: [
    { command: 'moveTo', args: [0, 0] },
    { command: 'lineTo', args: [1000, 0] },
    { command: 'quadraticCurveTo', args: [1000, 500, 1000, 1000] },
    { command: 'bezierCurveTo', args: [700, 1000, 300, 1000, 0, 1000] },
    { command: 'closePath', args: [] },
  ],
};
function fakeFont(): OutlineFont & { layout: ReturnType<typeof vi.fn> } {
  const layout = vi.fn((text: string, features?: Record<string, boolean>) => {
    const glyphs: OutlineGlyph[] = [];
    const cps = [...text].map((c) => c.codePointAt(0)!);
    for (let i = 0; i < cps.length; i++) {
      if (!features && cps[i] === 0x66 && cps[i + 1] === 0x69) {
        glyphs.push({ codePoints: [0x66, 0x69], path: square });
        i++;
      } else
        glyphs.push({ codePoints: [cps[i]!], path: cps[i] === 0x20 ? { commands: [] } : square });
    }
    return { glyphs };
  });
  return { unitsPerEm: 1000, ascent: 900, layout };
}

const at = (x: number, y = 100, rotate = 0): CharPlace => ({ x, y, endX: x + 10, endY: y, rotate });
const run = (
  text: string,
  places: (CharPlace | null)[],
  extra: Partial<GlyphRun> = {},
): GlyphRun => ({
  text,
  places,
  size: 10,
  syntheticItalic: false,
  tracked: false,
  ...extra,
});

describe('syntheticBoldWidth', () => {
  it('is a 24th of the size at 9 px and under, a 32nd at 36 px and over', () => {
    expect(syntheticBoldWidth(9)).toBeCloseTo(9 / 24);
    expect(syntheticBoldWidth(4)).toBeCloseTo(4 / 24);
    expect(syntheticBoldWidth(36)).toBeCloseTo(36 / 32);
    expect(syntheticBoldWidth(96)).toBeCloseTo(96 / 32);
    expect(syntheticBoldWidth(22.5)).toBeCloseTo(22.5 * (1 / 24 + (1 / 32 - 1 / 24) / 2));
  });
});

describe('glyphRunPath', () => {
  it('scales, flips and places each glyph at its character', () => {
    const d = glyphRunPath(fakeFont(), run('A', [at(5)]));
    expect(d).toBe('M5 100L15 100Q15 95 15 90C12 90 8 90 5 90Z');
  });

  it('keeps a ligature whole at its first character and skips empty glyphs and unplaced ones', () => {
    const font = fakeFont();
    const d = glyphRunPath(font, run('fi a', [at(0), at(10), at(20), null]));
    expect(d.match(/M/g)).toHaveLength(1);
    expect(font.layout).toHaveBeenCalledWith('fi a', undefined);
  });

  it('turns ligatures off for tracked text, as browsers do', () => {
    const font = fakeFont();
    const d = glyphRunPath(font, run('fi', [at(0), at(20)], { tracked: true }));
    expect(d.match(/M/g)).toHaveLength(2);
    expect(font.layout.mock.calls[0]![1]).toMatchObject({ liga: false, calt: false });
  });

  it('counts a character past the BMP as two units', () => {
    const d = glyphRunPath(fakeFont(), run('😀a', [at(0), null, at(30)]));
    expect(d).toContain('M30 100');
  });

  it('turns a glyph with its character and slants a synthetic italic', () => {
    const turned = glyphRunPath(fakeFont(), run('A', [at(0, 0, 90)]));
    expect(turned.startsWith('M0 0L0 10')).toBe(true);
    const slanted = glyphRunPath(fakeFont(), run('A', [at(0, 0)], { syntheticItalic: true }));
    expect(slanted).toContain('Q11.25 -5 12.5 -10C9.5 -10');
  });

  it('is empty when nothing draws', () => {
    expect(glyphRunPath(fakeFont(), run(' ', [at(0)]))).toBe('');
  });
});

// fontkit caches a glyph by id: one first made by a substitution comes back with no code points, so the places are
// mapped one to one when the counts match, and an empty glyph otherwise counts as one character.
describe('glyphStarts', () => {
  const g = (codePoints: number[]): OutlineGlyph => ({ codePoints, path: square });
  it('maps glyphs to characters one to one when the counts match, whatever their code points say', () => {
    expect(glyphStarts([g([0x31]), g([]), g([0x31]), g([])], '1.1.')).toEqual([0, 1, 2, 3]);
    expect(glyphStarts([g([0x1f600]), g([0x61])], '😀a')).toEqual([0, 2]);
  });

  it('steps by a ligature’s characters, and an empty glyph by one', () => {
    expect(glyphStarts([g([0x66, 0x69]), g([]), g([0x61])], 'fi.a')).toEqual([0, 2, 3]);
  });
});

describe('glyphRunPlacements', () => {
  const withIds = (font: OutlineFont): OutlineFont => ({
    ...font,
    layout: (text, features) => {
      const { glyphs } = font.layout(text, features);
      return { glyphs: glyphs.map((gl, i) => ({ ...gl, id: i + 1 })) };
    },
  });

  it('places each drawn glyph by a matrix from font units, flipped, turned and slanted', () => {
    const placed = glyphRunPlacements(
      withIds(fakeFont()),
      run('A b', [at(5), at(15), at(25, 50, 90)]),
    )!;
    expect(placed.map((p) => p.id)).toEqual([1, 3]);
    expect(placed[0]!.matrix).toEqual([0.01, 0, 0, -0.01, 5, 100]);
    expect(placed[1]!.matrix.map((n) => Math.round(n * 1000) / 1000 + 0)).toEqual([
      0, 0.01, 0.01, 0, 25, 50,
    ]);
    const slanted = glyphRunPlacements(
      withIds(fakeFont()),
      run('A', [at(0, 0)], { syntheticItalic: true }),
    )!;
    expect(slanted[0]!.matrix).toEqual([0.01, 0, 0.0025, -0.01, 0, 0]);
  });

  it('is null when the face gives no glyph ids, so the caller draws the outlines inline', () => {
    expect(glyphRunPlacements(fakeFont(), run('A', [at(0)]))).toBeNull();
    expect(glyphRunPlacements(fakeFont(), run(' ', [at(0)]))).toEqual([]);
  });
});

describe('decorationPath', () => {
  it('underlines each placed character a tenth of the size thick, its top half that under the baseline', () => {
    const d = decorationPath(fakeFont(), run('ab', [at(0), at(10)], { size: 40 }), 'underline');
    expect(d).toBe('M0 102L10 102L10 106L0 106ZM10 102L20 102L20 106L10 106Z');
  });

  it('strikes through a third of the ascent above the baseline', () => {
    const d = decorationPath(fakeFont(), run('a', [at(0)], { size: 30 }), 'line-through');
    // ascent 27 px: centre 9 px above 100, 3 px thick.
    expect(d).toBe('M0 89.5L10 89.5L10 92.5L0 92.5Z');
  });

  it('follows a turned character and skips unplaced or zero-advance ones', () => {
    const zero = { x: 5, y: 5, endX: 5, endY: 5, rotate: 0 };
    const d = decorationPath(
      fakeFont(),
      run('abc', [{ x: 0, y: 0, endX: 0, endY: 10, rotate: 90 }, null, zero], { size: 10 }),
      'underline',
    );
    expect(d).toBe('M-1 0L-1 10L-2 10L-2 0Z');
  });
});
