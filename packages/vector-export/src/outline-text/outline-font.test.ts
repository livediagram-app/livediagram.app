// livedesign/docs/specs/007-editor/logo-pages.md "Outlined text": a face opened at the weight and optical size the browser
// drew it at. Real fontkit reads the repo's own font files; a stand-in checks the variable WOFF2 path, which the
// browser check covers end to end (outlines over Chromium's own drawing of Inter and Fraunces at 500 to 700).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as fontkit from '#fontkit';
import { describe, expect, it, vi } from 'vitest';
import { glyphRunPath } from './glyph-paths';
import { axisCoords, openFace, type Fontkit, type FontkitFont } from './outline-font';

const fixture = (rel: string) =>
  new Uint8Array(readFileSync(fileURLToPath(new URL(rel, import.meta.url))));
const INTER_TTF = fixture('../../../render-png/fonts/Inter-Regular.ttf');
const CAVEAT_WOFF2 = fixture(
  '../../../../livedesign/apps/marketing/public/fonts/caveat-hero.woff2',
);

const wght = { axisTag: 'wght', minValue: 100, defaultValue: 400, maxValue: 900 };
const opsz = { axisTag: 'opsz', minValue: 8, defaultValue: 14, maxValue: 144 };
const soft = { axisTag: 'SOFT', minValue: 0, defaultValue: 50, maxValue: 100 };

describe('axisCoords', () => {
  it('sets weight and optical size, clamped, and leaves every other axis at its default', () => {
    expect(axisCoords([wght, opsz, soft], { weight: 700, size: 96 })).toEqual([700, 96, 50]);
    expect(axisCoords([wght, opsz], { weight: 1000, size: 4 })).toEqual([900, 8]);
  });
});

describe('openFace with fontkit', () => {
  it('reads a static TrueType face: metrics and glyph outlines', () => {
    const font = openFace(fontkit as unknown as Fontkit, INTER_TTF, { weight: 400, size: 48 });
    expect(font.unitsPerEm).toBe(2816);
    expect(font.ascent).toBeGreaterThan(0);
    const d = glyphRunPath(font, {
      text: 'Hi',
      places: [
        { x: 0, y: 50, endX: 30, endY: 50, rotate: 0 },
        { x: 30, y: 50, endX: 40, endY: 50, rotate: 0 },
      ],
      size: 48,
      syntheticItalic: false,
      tracked: false,
    });
    expect(d.match(/M/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it('reads a static WOFF2 face', () => {
    const font = openFace(fontkit as unknown as Fontkit, CAVEAT_WOFF2, { weight: 700, size: 60 });
    expect(font.unitsPerEm).toBe(1000);
    expect(font.layout('Ha').glyphs[0]!.path.commands.length).toBeGreaterThan(0);
  });
});

type Pt = { x: number; y: number; onCurve: boolean; endContour: boolean; copy(): Pt };
const pt = (x: number, y: number): Pt => ({
  x,
  y,
  onCurve: true,
  endContour: false,
  copy: () => pt(x, y),
});

function fakeFont(type: string, axes?: (typeof wght)[]): FontkitFont {
  const glyphs = [
    { numberOfContours: 1, points: [pt(0, 0), pt(10, 0)] },
    { numberOfContours: -1, components: [{ dx: 5, dy: 6 }] },
    { numberOfContours: 0 },
  ];
  const font: FontkitFont = {
    type,
    unitsPerEm: 1000,
    ascent: 800,
    fvar: axes ? { axis: axes } : undefined,
    variationCoords: null,
    getVariation: vi.fn(() => ({ ...font, ascent: 900 })),
    getGlyph: vi.fn(),
    layout: vi.fn(() => ({ glyphs: [] })),
    _transformedGlyphs: glyphs,
    _variationProcessor: {
      transformPoints: (gid: number, points: Pt[]) => {
        // Moves every point by the glyph id + 1 along x, as a weight change would.
        for (const p of points) p.x += gid + 1;
      },
    },
  };
  return font;
}

describe('openFace on a variable face', () => {
  it('asks a TrueType face for its variation by axis tag', () => {
    const font = fakeFont('TTF', [wght, opsz]);
    const opened = openFace({ create: () => font }, new Uint8Array(), { weight: 600, size: 72 });
    expect(font.getVariation).toHaveBeenCalledWith({ wght: 600, opsz: 72 });
    expect(opened.ascent).toBe(900);
  });

  it("moves a WOFF2 face's decoded glyphs by a second copy's variation processor", () => {
    const font = fakeFont('WOFF2', [wght]);
    const source = fakeFont('WOFF2', [wght]);
    const create = vi.fn().mockReturnValueOnce(font).mockReturnValueOnce(source);
    openFace({ create }, new Uint8Array(), { weight: 700, size: 40 });
    expect(source.variationCoords).toEqual([700]);
    expect(font.getGlyph).toHaveBeenCalledWith(0);
    const [simple, composite] = font._transformedGlyphs!;
    expect(simple!.points!.map((p) => p.x)).toEqual([1, 11]);
    expect(composite!.components).toEqual([{ dx: 7, dy: 6 }]);
  });

  it('leaves a WOFF2 face alone when fontkit has no processor for it', () => {
    const font = fakeFont('WOFF2', [wght]);
    const source = { ...fakeFont('WOFF2', [wght]), _variationProcessor: null };
    const create = vi.fn().mockReturnValueOnce(font).mockReturnValueOnce(source);
    openFace({ create }, new Uint8Array(), { weight: 700, size: 40 });
    expect(font._transformedGlyphs![0]!.points!.map((p) => p.x)).toEqual([0, 10]);
  });

  it('opens a face with no axes as it is', () => {
    const font = fakeFont('WOFF2', []);
    const opened = openFace({ create: () => font }, new Uint8Array(), { weight: 700, size: 40 });
    expect(font.getVariation).not.toHaveBeenCalled();
    opened.layout('a');
    expect(font.layout).toHaveBeenCalledWith('a', undefined);
  });
});
