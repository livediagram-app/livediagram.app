// A run of text as letter outlines (livedesign/docs/specs/007-editor/logo-pages.md "Outlined text"): the face lays the run out
// into glyphs (its ligatures and substitutions), and each glyph is put where the browser placed its first character,
// turned as that character was turned (text on an arc), so the outline sits exactly over what the canvas painted.
// The transform is baked into absolute path data, which every vector editor reads.

/** What outlining needs of a parsed face (fontkit's Font, or a test double). */
export type OutlineFont = {
  unitsPerEm: number;
  // The face's ascent (hhea), in font units: where a strikethrough sits.
  ascent: number;
  layout(text: string, features?: Record<string, boolean>): { glyphs: readonly OutlineGlyph[] };
};

export type OutlineGlyph = {
  // The glyph's index in the face: a PDF draws each glyph once and places it again wherever it is used.
  id?: number;
  codePoints: readonly number[];
  path: { commands: readonly { command: string; args: readonly number[] }[] };
};

/** Where the browser laid out one character: its start and end on the baseline and its rotation, in degrees. */
export type CharPlace = { x: number; y: number; endX: number; endY: number; rotate: number };

/** A run: one face, one style; `places[i]` for the run's UTF-16 index i, null where nothing is drawn. */
export type GlyphRun = {
  text: string;
  places: readonly (CharPlace | null)[];
  size: number;
  syntheticItalic: boolean;
  // Tracked text: browsers turn the optional ligatures off.
  tracked: boolean;
};

// Chromium and Skia slant an upright face by a quarter for a synthetic italic.
export const SYNTHETIC_ITALIC_SKEW = 0.25;
// Path coordinates to 0.01 px: far inside the half pixel the outline must keep to.
export const OUTLINE_PRECISION = 2;
const LIGATURES_OFF = { liga: false, clig: false, dlig: false, hlig: false, calt: false };

/** The device scale the browser's synthetic bold is matched at: the PNG export draws at 2x, as a Retina screen does.
 *  Skia interpolates its fake bold on the size in device px, so a 24 px headline there is thickened by 1/32 of its
 *  size, not the 1/28 its CSS size alone gives (Work Tracker 1121; measured in Chromium on 2026-11-18, Anton, Bebas
 *  Neue and Archivo Black at weight 600: at 2x the fitted share was 0.031 at 24 px and 0.030 to 0.031 from 36 to 72
 *  px, against 0.036 drawn before). Safe range 1..3. */
export const SYNTHETIC_BOLD_DEVICE_SCALE = 2;

/** Skia's fake-bold stroke for text of `size` CSS px drawn at `scale`: a share of the size that is 1/24 at 9 device
 *  px, 1/32 at 36 device px and up, linear between. */
export function syntheticBoldWidth(size: number, scale = SYNTHETIC_BOLD_DEVICE_SCALE): number {
  const lo = 9;
  const hi = 36;
  const t = Math.min(1, Math.max(0, (size * scale - lo) / (hi - lo)));
  return size * (1 / 24 + (1 / 32 - 1 / 24) * t);
}

const round = (n: number): string => {
  const f = 10 ** OUTLINE_PRECISION;
  const r = Math.round(n * f) / f;
  return String(Object.is(r, -0) ? 0 : r);
};

type Mat = (px: number, py: number) => readonly [number, number];

function glyphMatrix(place: CharPlace, size: number, unitsPerEm: number, italic: boolean): Mat {
  const s = size / unitsPerEm;
  const rad = (place.rotate * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const skew = italic ? SYNTHETIC_ITALIC_SKEW : 0;
  return (px, py) => {
    // Font units are y-up; the SVG is y-down. The slant leans what is above the baseline to the right.
    const gy = -py * s;
    const gx = px * s - skew * gy;
    return [place.x + gx * cos - gy * sin, place.y + gx * sin + gy * cos];
  };
}

function pathData(glyph: OutlineGlyph, m: Mat): string {
  const out: string[] = [];
  for (const { command, args } of glyph.path.commands) {
    const pts: string[] = [];
    for (let i = 0; i + 1 < args.length; i += 2) {
      const [x, y] = m(args[i]!, args[i + 1]!);
      pts.push(`${round(x)} ${round(y)}`);
    }
    if (command === 'moveTo') out.push(`M${pts[0]}`);
    else if (command === 'lineTo') out.push(`L${pts[0]}`);
    else if (command === 'quadraticCurveTo') out.push(`Q${pts.join(' ')}`);
    else if (command === 'bezierCurveTo') out.push(`C${pts.join(' ')}`);
    else if (command === 'closePath') out.push('Z');
  }
  return out.join('');
}

const unitsOf = (cp: number) => (cp > 0xffff ? 2 : 1);

/** Where each glyph's characters start in `text` (UTF-16 index). One glyph per character maps straight across; else
 *  each glyph covers the characters it says it stands for, at least one. A glyph's code points can't be trusted alone:
 *  fontkit caches a glyph by id, and one first made by a substitution keeps none (a full stop between figures in
 *  Inter came back empty, shifting every letter after it onto its neighbour's place). */
export function glyphStarts(glyphs: readonly OutlineGlyph[], text: string): number[] {
  const chars = Array.from(text);
  const starts: number[] = [];
  let index = 0;
  if (glyphs.length === chars.length) {
    for (const ch of chars) {
      starts.push(index);
      index += ch.length;
    }
    return starts;
  }
  for (const glyph of glyphs) {
    starts.push(index);
    let units = 0;
    for (const cp of glyph.codePoints) units += unitsOf(cp);
    index += units || unitsOf(text.codePointAt(index) ?? 0);
  }
  return starts;
}

/** One glyph where it is drawn: its outline in font units (y up) and the matrix putting it in the text's user space,
 *  as [a b c d e f] (x' = a x + c y + e, y' = b x + d y + f). */
export type PlacedGlyph = {
  id: number;
  commands: OutlineGlyph['path']['commands'];
  matrix: readonly [number, number, number, number, number, number];
};

/** The run's glyphs, each with the matrix glyphRunPath bakes into its points: the same outline, kept in font units so
 *  a repeated glyph is written once. Glyphs without an id are left out (the caller then draws `glyphRunPath`). */
export function glyphRunPlacements(font: OutlineFont, run: GlyphRun): PlacedGlyph[] | null {
  const { glyphs } = font.layout(run.text, run.tracked ? LIGATURES_OFF : undefined);
  const out: PlacedGlyph[] = [];
  const s = run.size / font.unitsPerEm;
  const skew = run.syntheticItalic ? SYNTHETIC_ITALIC_SKEW : 0;
  const starts = glyphStarts(glyphs, run.text);
  for (const [g, glyph] of glyphs.entries()) {
    const place = run.places[starts[g]!];
    if (!place || glyph.path.commands.length === 0) continue;
    if (glyph.id === undefined) return null;
    const rad = (place.rotate * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    out.push({
      id: glyph.id,
      commands: glyph.path.commands,
      matrix: [s * cos, s * sin, s * (skew * cos + sin), s * (skew * sin - cos), place.x, place.y],
    });
  }
  return out;
}

/** The run's glyphs as one path's data; empty when nothing is drawn. */
export function glyphRunPath(font: OutlineFont, run: GlyphRun): string {
  const { glyphs } = font.layout(run.text, run.tracked ? LIGATURES_OFF : undefined);
  const parts: string[] = [];
  const starts = glyphStarts(glyphs, run.text);
  for (const [g, glyph] of glyphs.entries()) {
    const place = run.places[starts[g]!];
    if (!place || glyph.path.commands.length === 0) continue;
    parts.push(pathData(glyph, glyphMatrix(place, run.size, font.unitsPerEm, run.syntheticItalic)));
  }
  return parts.join('');
}

export type Decoration = 'underline' | 'line-through';

/** Underline or strikethrough as one quad per drawn character along its advance, where Chromium draws a line of
 *  `auto` thickness and offset: a tenth of the size thick; an underline's top a half-thickness (rounded up, at least
 *  1 px) under the baseline, a strikethrough's centre a third of the face's ascent above it. */
export function decorationPath(font: OutlineFont, run: GlyphRun, decoration: Decoration): string {
  const half = run.size / 10 / 2;
  // The line's centre below the baseline (y-down).
  const centre =
    decoration === 'underline'
      ? Math.max(1, Math.ceil(half)) + half
      : -((font.ascent * run.size) / font.unitsPerEm) / 3;
  const parts: string[] = [];
  for (const place of run.places) {
    if (!place || (place.x === place.endX && place.y === place.endY)) continue;
    const rad = (place.rotate * Math.PI) / 180;
    // The normal to the baseline, pointing down the page for upright text.
    const nx = -Math.sin(rad);
    const ny = Math.cos(rad);
    const at = (x: number, y: number, d: number) => `${round(x + nx * d)} ${round(y + ny * d)}`;
    parts.push(
      `M${at(place.x, place.y, centre - half)}L${at(place.endX, place.endY, centre - half)}` +
        `L${at(place.endX, place.endY, centre + half)}L${at(place.x, place.y, centre + half)}Z`,
    );
  }
  return parts.join('');
}
