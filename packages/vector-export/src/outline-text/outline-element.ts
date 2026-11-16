// One laid-out SVG `<text>` as letter outlines (livedesign/docs/specs/007-editor/logo-pages.md "Outlined text", and
// every product's PDF export): each character's place is read back from the mounted SVG DOM and the face's glyph drawn
// there as path data in the text's own user space. Shared by the Logo Kit's outlined SVG (outline-svg.ts) and the PDF
// writer (../pdf/svg-text.ts), which draw those paths in their own formats.
import { matchFace, type FaceMatch } from './face-match';
import type { FaceSource } from './font-face-css';
import {
  decorationPath,
  glyphRunPath,
  glyphRunPlacements,
  syntheticBoldWidth,
  type CharPlace,
  type Decoration,
  type OutlineFont,
  type PlacedGlyph,
} from './glyph-paths';
import { OutlineError } from './outline-error';
import { openFace, type Fontkit } from './outline-font';
import { addressableChars, drawsNothing, type TextChar } from './text-chars';

// Text that names no face the export embeds (a system stack) is set in this one, as the Logo Kit letters it.
export const FALLBACK_FAMILY = 'Inter';

// The families of a computed font-family stack, unquoted, in order.
export function stackFamilies(stack: string): string[] {
  return stack
    .split(',')
    .map((f) => f.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

type Style = {
  families: string[];
  weight: number;
  italic: boolean;
  size: number;
  tracked: boolean;
  fill: string;
  fillOpacity: string;
  stroke: string;
  strokeWidth: string;
  strokeOpacity: string;
  decorations: Decoration[];
};

function styleOf(holder: Element, text: Element): Style {
  const cs = getComputedStyle(holder);
  const decorations = new Set<Decoration>();
  for (let el: Element | null = holder; el; el = el.parentElement) {
    const line =
      getComputedStyle(el).textDecorationLine || el.getAttribute('text-decoration') || '';
    if (line.includes('underline')) decorations.add('underline');
    if (line.includes('line-through')) decorations.add('line-through');
    if (el === text) break;
  }
  return {
    families: stackFamilies(cs.fontFamily),
    weight: Number(cs.fontWeight) || 400,
    italic: cs.fontStyle === 'italic' || cs.fontStyle.startsWith('oblique'),
    size: parseFloat(cs.fontSize) || 16,
    tracked:
      !!cs.letterSpacing && cs.letterSpacing !== 'normal' && parseFloat(cs.letterSpacing) !== 0,
    fill: cs.fill,
    fillOpacity: cs.fillOpacity,
    stroke: cs.stroke,
    strokeWidth: cs.strokeWidth,
    strokeOpacity: cs.strokeOpacity,
    decorations: [...decorations],
  };
}

export function textNodesOf(text: Element): Text[] {
  const nodes: Text[] = [];
  const walker = text.ownerDocument.createTreeWalker(text, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  return nodes;
}

type Shift = readonly [number, number];
const NO_SHIFT: Shift = [0, 0];
const BASELINE_PROPS = ['dominant-baseline', 'alignment-baseline'] as const;

function extentOf(text: SVGTextContentElement, index: number): DOMRect | null {
  try {
    return text.getExtentOfChar(index);
  } catch {
    return null;
  }
}

// How far each character is moved off the baseline its start position reports. Chromium's getStartPositionOfChar
// ignores `dominant-baseline` (`central`, which every export sets, `middle`, `hanging`...), though the glyph is drawn
// moved by it; its extent does move. So the extents are read as the text is set and again with its baselines `auto`,
// and the difference is each character's shift. Nothing is measured when no element of the text names a baseline.
export function baselineShifts(text: SVGTextContentElement, count: number): Shift[] {
  const els = [text, ...text.querySelectorAll('*')] as SVGElement[];
  const named = (el: SVGElement) =>
    BASELINE_PROPS.some((prop) => {
      const v = getComputedStyle(el).getPropertyValue(prop);
      return !!v && v !== 'auto' && v !== 'baseline';
    });
  if (!els.some(named)) return Array.from({ length: count }, () => NO_SHIFT);
  const indices = Array.from({ length: count }, (_, i) => i);
  const set = indices.map((i) => extentOf(text, i));
  const saved = els.map((el) => BASELINE_PROPS.map((prop) => el.style.getPropertyValue(prop)));
  for (const el of els) for (const prop of BASELINE_PROPS) el.style.setProperty(prop, 'auto');
  const auto = indices.map((i) => extentOf(text, i));
  els.forEach((el, k) =>
    BASELINE_PROPS.forEach((prop, j) => {
      const v = saved[k]![j]!;
      if (v) el.style.setProperty(prop, v);
      else el.style.removeProperty(prop);
    }),
  );
  return indices.map((i) => {
    const a = set[i];
    const b = auto[i];
    return a && b ? [a.x - b.x, a.y - b.y] : NO_SHIFT;
  });
}

/** Where the browser laid out character `index`, moved by its baseline shift; null where it is not laid out. */
export function placeOf(
  text: SVGTextContentElement,
  index: number,
  [dx, dy]: Shift = NO_SHIFT,
): CharPlace | null {
  try {
    const start = text.getStartPositionOfChar(index);
    const end = text.getEndPositionOfChar(index);
    const rotate = text.getRotationOfChar(index);
    if (![start.x, start.y, end.x, end.y, rotate].every(Number.isFinite)) return null;
    return { x: start.x + dx, y: start.y + dy, endX: end.x + dx, endY: end.y + dy, rotate };
  } catch {
    // A character past the end of an arc's path is not laid out.
    return null;
  }
}

/** Each character of a laid-out `<text>` with its place (null where nothing is laid out), or null when the
 *  browser's count of characters does not match the text's. */
export function placedChars(
  t: SVGTextContentElement,
): { chars: TextChar[]; places: (CharPlace | null)[] } | null {
  const count = t.getNumberOfChars();
  const chars = addressableChars(textNodesOf(t), count);
  if (!chars) return null;
  const shifts = baselineShifts(t, count);
  return {
    chars,
    places: chars.map((c) => (c.index >= 0 ? placeOf(t, c.index, shifts[c.index]) : null)),
  };
}

type Run = { match: FaceMatch; style: Style; chars: { ch: string; place: CharPlace | null }[] };

const sameRun = (run: Run | undefined, match: FaceMatch, style: Style) =>
  !!run &&
  run.style === style &&
  run.match.face === match.face &&
  run.match.weight === match.weight &&
  run.match.syntheticBold === match.syntheticBold &&
  run.match.syntheticItalic === match.syntheticItalic;

// The text's characters, grouped into runs of one style and one face.
function runsOf(
  text: SVGTextContentElement,
  chars: TextChar[],
  places: readonly (CharPlace | null)[],
  faces: readonly FaceSource[],
): Run[] {
  const runs: Run[] = [];
  const styles = new Map<Element, Style>();
  const missing = new Map<string, Set<string>>();
  chars.forEach((c, i) => {
    let style = styles.get(c.holder);
    if (!style) styles.set(c.holder, (style = styleOf(c.holder, text)));
    const place = places[i] ?? null;
    const last = runs[runs.length - 1];
    if (drawsNothing(c.ch)) {
      // Kept with its place: it draws no glyph, but an underline runs under it.
      if (last && last.style === style) last.chars.push({ ch: c.ch, place });
      return;
    }
    const cp = c.ch.codePointAt(0)!;
    let match: FaceMatch | null = null;
    for (const family of style.families) {
      match = matchFace(faces, family, style.weight, style.italic, cp);
      if (match) break;
    }
    if (!match) {
      const face = style.families[0] ?? FALLBACK_FAMILY;
      const set = missing.get(face) ?? new Set<string>();
      missing.set(face, set.add(c.ch));
      return;
    }
    if (sameRun(last, match, style)) last!.chars.push({ ch: c.ch, place });
    else runs.push({ match, style, chars: [{ ch: c.ch, place }] });
  });
  const [face, letters] = [...missing.entries()][0] ?? [];
  if (face && letters) {
    console.warn('[outline] letters not in the embedded face', { face, count: letters.size });
    throw new OutlineError('letters', face, [...letters].join(''));
  }
  return runs;
}

// Each run's places by UTF-16 index of its text (a surrogate pair's second unit has none).
function glyphRun(run: Run) {
  const places: (CharPlace | null)[] = [];
  let text = '';
  for (const c of run.chars) {
    text += c.ch;
    places.push(c.place);
    for (let u = 1; u < c.ch.length; u++) places.push(null);
  }
  return {
    text,
    places,
    size: run.style.size,
    syntheticItalic: run.match.syntheticItalic,
    tracked: run.style.tracked,
  };
}

/** One outlined path: its data in the text's user space and the paint the text was drawn with. */
export type OutlinedPath = {
  d: string;
  fill: string;
  fillOpacity?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: string;
  // The synthetic bold's stroke joins.
  miterJoin?: true;
  // The same letters glyph by glyph (`face` names the face at its size): what a PDF writes once and reuses.
  glyphs?: { face: string; placed: PlacedGlyph[] };
};

function outlinedPath(d: string, run: Run, withStroke: boolean): OutlinedPath {
  const { style } = run;
  const p: OutlinedPath = { d, fill: style.fill };
  if (style.fillOpacity && style.fillOpacity !== '1') p.fillOpacity = style.fillOpacity;
  if (withStroke && style.stroke && style.stroke !== 'none') {
    p.stroke = style.stroke;
    p.strokeWidth = parseFloat(style.strokeWidth) || 1;
    if (style.strokeOpacity && style.strokeOpacity !== '1') p.strokeOpacity = style.strokeOpacity;
  } else if (withStroke && run.match.syntheticBold && style.fill !== 'none') {
    // The browser's own bold for a face that has none: the outline thickened by a stroke of its fill.
    p.stroke = style.fill;
    p.strokeWidth = Math.round(syntheticBoldWidth(style.size) * 100) / 100;
    p.miterJoin = true;
    if (style.fillOpacity && style.fillOpacity !== '1') p.strokeOpacity = style.fillOpacity;
  }
  return p;
}

/** Opens each face at each size once, for every text of one export. */
export function faceOpener(fontkit: Fontkit, bytesOf: (url: string) => Uint8Array) {
  const fonts = new Map<string, OutlineFont>();
  return (match: FaceMatch, size: number): OutlineFont => {
    const key = `${match.face.url}|${match.weight}|${size}`;
    let font = fonts.get(key);
    if (!font) {
      font = openFace(fontkit, bytesOf(match.face.url), { weight: match.weight, size });
      fonts.set(key, font);
    }
    return font;
  };
}

/** The mounted `<text>` as outlined paths in its own user space, in the faces `faces` declare. Throws
 *  `OutlineError` when it is not laid out as typed, or a letter is in none of them. */
export function outlineTextElement(
  t: SVGTextContentElement,
  faces: readonly FaceSource[],
  open: ReturnType<typeof faceOpener>,
): OutlinedPath[] {
  const placed = placedChars(t);
  if (!placed) throw new OutlineError('layout', FALLBACK_FAMILY);
  const out: OutlinedPath[] = [];
  for (const run of runsOf(t, placed.chars, placed.places, faces)) {
    const font = open(run.match, run.style.size);
    const gr = glyphRun(run);
    const d = glyphRunPath(font, gr);
    if (d) {
      const path = outlinedPath(d, run, true);
      const placed = glyphRunPlacements(font, gr);
      if (placed)
        path.glyphs = {
          face: `${run.match.face.url}|${run.match.weight}|${run.style.size}`,
          placed,
        };
      out.push(path);
    }
    for (const deco of run.style.decorations) {
      const dd = decorationPath(font, gr, deco);
      if (dd) out.push(outlinedPath(dd, run, false));
    }
  }
  return out;
}
