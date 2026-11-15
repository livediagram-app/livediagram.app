// A face's file opened for outlining (docs/specs/007-editor/logo-pages.md "Outlined text"), with fontkit, which reads
// the WOFF2 files Google Fonts serves a browser. A variable face is set to the weight the browser drew it at and to
// the font size on its optical-size axis (browsers size optically by default); every other axis stays at its default.
//
// fontkit 2.0.4 cannot vary a WOFF2 face itself (its WOFF2 glyphs skip the variation step, and a composite glyph
// throws), so a varied face is built here from two copies of the file: one whose decoded glyphs are moved by the
// other's glyph variation processor before any outline is read. The version is pinned in package.json for it.
import type { OutlineFont } from './glyph-paths';

/** The settings a face is drawn at. */
export type FaceSettings = { weight: number; size: number };

type Point = { x: number; y: number; onCurve: boolean; endContour: boolean; copy(): Point };
type DecodedGlyph = {
  numberOfContours: number;
  points?: Point[];
  components?: { dx: number; dy: number }[];
};
type Axis = { axisTag: string; minValue: number; defaultValue: number; maxValue: number };
// fontkit's Font, as far as this file reaches into it.
export type FontkitFont = {
  type: string;
  unitsPerEm: number;
  ascent: number;
  fvar?: { axis: Axis[] };
  variationCoords?: number[] | null;
  getVariation(coords: Record<string, number>): FontkitFont;
  getGlyph(id: number): unknown;
  layout: OutlineFont['layout'];
  _transformedGlyphs?: DecodedGlyph[];
  _variationProcessor?: { transformPoints(gid: number, points: Point[]): void } | null;
};
export type Fontkit = { create(bytes: Uint8Array): FontkitFont };

/** Each axis's value for these settings, in the face's axis order: weight, optical size, defaults. */
export function axisCoords(axes: readonly Axis[], settings: FaceSettings): number[] {
  return axes.map((a) => {
    const tag = a.axisTag.trim();
    const want = tag === 'wght' ? settings.weight : tag === 'opsz' ? settings.size : a.defaultValue;
    return Math.min(a.maxValue, Math.max(a.minValue, want));
  });
}

// A point the variation processor can move (fontkit's Point shape), for a component offset or a phantom point.
function point(x: number, y: number, onCurve: boolean): Point {
  const p = { x, y, onCurve, endContour: true } as Point;
  p.copy = () => point(p.x, p.y, p.onCurve);
  return p;
}

// Move every decoded glyph of `font` by `processor` (once, before any outline is read).
function varyGlyphs(
  glyphs: DecodedGlyph[],
  processor: NonNullable<FontkitFont['_variationProcessor']>,
): void {
  const phantoms = () => [0, 1, 2, 3].map(() => point(0, 0, false));
  glyphs.forEach((glyph, gid) => {
    if (glyph.numberOfContours > 0 && glyph.points) {
      processor.transformPoints(gid, [...glyph.points, ...phantoms()]);
    } else if (glyph.numberOfContours < 0 && glyph.components) {
      const offsets = glyph.components.map((c) => point(c.dx, c.dy, true));
      processor.transformPoints(gid, [...offsets, ...phantoms()]);
      glyph.components.forEach((c, i) => {
        c.dx = offsets[i]!.x;
        c.dy = offsets[i]!.y;
      });
    }
  });
}

/** The face in `bytes` at `settings`, ready to lay out and outline. */
export function openFace(fontkit: Fontkit, bytes: Uint8Array, settings: FaceSettings): OutlineFont {
  let font = fontkit.create(bytes);
  const axes = font.fvar?.axis;
  if (axes?.length) {
    const coords = axisCoords(axes, settings);
    if (font.type !== 'WOFF2') {
      font = font.getVariation(
        Object.fromEntries(axes.map((a, i) => [a.axisTag.trim(), coords[i]!])),
      );
    } else {
      font.getGlyph(0);
      const source = fontkit.create(bytes);
      source.variationCoords = coords;
      const processor = source._variationProcessor;
      if (font._transformedGlyphs && processor) varyGlyphs(font._transformedGlyphs, processor);
    }
  }
  return {
    unitsPerEm: font.unitsPerEm,
    ascent: font.ascent,
    layout: (text, features) => font.layout(text, features),
  };
}
