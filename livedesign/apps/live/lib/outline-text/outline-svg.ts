// The Logo Kit's text as letter outlines (docs/specs/007-editor/logo-pages.md "Outlined text"). The SVG is mounted
// off screen with its embedded faces registered, so the browser lays its text out exactly as it paints it; each
// character's place is read back from the SVG DOM and the face's glyph drawn there as a path. The file that comes
// out holds no <text>, no @font-face and no @import. Loaded only when a kit is made, with fontkit.
import { parseInert } from '@liveworkspace/trusted-types';
import { matchFace, type FaceMatch } from './face-match';
import { parseFontFaces, type FaceSource } from './font-face-css';
import {
  decorationPath,
  glyphRunPath,
  syntheticBoldWidth,
  type CharPlace,
  type Decoration,
  type OutlineFont,
} from './glyph-paths';
import { OutlineError } from './outline-error';
import { openFace, type Fontkit } from './outline-font';
import { addressableChars, drawsNothing, type TextChar } from './text-chars';

const SVG_NS = 'http://www.w3.org/2000/svg';
// What a <text> carries over to the group of outlines that replaces it.
const KEPT_ATTRS = ['transform', 'opacity', 'filter', 'clip-path', 'mask'];
// Text that names no face the kit embeds (a system stack) is set in this one, as the kit tab letters it.
const FALLBACK_FAMILY = 'Inter';

export type OutlineDeps = { loadFontkit?: () => Promise<Fontkit> };

async function defaultFontkit(): Promise<Fontkit> {
  const mod = (await import('fontkit')) as unknown as Fontkit & { default?: Fontkit };
  return typeof mod.create === 'function' ? mod : mod.default!;
}

function bytesOf(url: string): Uint8Array<ArrayBuffer> {
  const comma = url.indexOf(',');
  const bin = atob(url.slice(comma + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

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

function textNodesOf(text: Element): Text[] {
  const nodes: Text[] = [];
  const walker = text.ownerDocument.createTreeWalker(text, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  return nodes;
}

function placeOf(text: SVGTextContentElement, index: number): CharPlace | null {
  try {
    const start = text.getStartPositionOfChar(index);
    const end = text.getEndPositionOfChar(index);
    const rotate = text.getRotationOfChar(index);
    if (![start.x, start.y, end.x, end.y, rotate].every(Number.isFinite)) return null;
    return { x: start.x, y: start.y, endX: end.x, endY: end.y, rotate };
  } catch {
    // A character past the end of an arc's path is not laid out.
    return null;
  }
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
  faces: readonly FaceSource[],
): Run[] {
  const runs: Run[] = [];
  const styles = new Map<Element, Style>();
  const missing = new Map<string, Set<string>>();
  for (const c of chars) {
    let style = styles.get(c.holder);
    if (!style) styles.set(c.holder, (style = styleOf(c.holder, text)));
    const place = c.index >= 0 ? placeOf(text, c.index) : null;
    const last = runs[runs.length - 1];
    if (drawsNothing(c.ch)) {
      // Kept with its place: it draws no glyph, but an underline runs under it.
      if (last && last.style === style) last.chars.push({ ch: c.ch, place });
      continue;
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
      continue;
    }
    if (sameRun(last, match, style)) last!.chars.push({ ch: c.ch, place });
    else runs.push({ match, style, chars: [{ ch: c.ch, place }] });
  }
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

function pathEl(doc: Document, d: string, run: Run, withStroke: boolean): Element {
  const p = doc.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', d);
  const { style } = run;
  p.setAttribute('fill', style.fill);
  if (style.fillOpacity && style.fillOpacity !== '1')
    p.setAttribute('fill-opacity', style.fillOpacity);
  if (withStroke && style.stroke && style.stroke !== 'none') {
    p.setAttribute('stroke', style.stroke);
    p.setAttribute('stroke-width', String(parseFloat(style.strokeWidth) || 1));
    if (style.strokeOpacity && style.strokeOpacity !== '1')
      p.setAttribute('stroke-opacity', style.strokeOpacity);
  } else if (withStroke && run.match.syntheticBold && style.fill !== 'none') {
    // The browser's own bold for a face that has none: the outline thickened by a stroke of its fill.
    p.setAttribute('stroke', style.fill);
    p.setAttribute('stroke-width', String(Math.round(syntheticBoldWidth(style.size) * 100) / 100));
    p.setAttribute('stroke-linejoin', 'miter');
    p.setAttribute('stroke-miterlimit', '4');
    if (style.fillOpacity && style.fillOpacity !== '1')
      p.setAttribute('stroke-opacity', style.fillOpacity);
  }
  return p;
}

/** `svg` with every `<text>` drawn as outlines in the faces `fontCss` embeds. Throws `OutlineError`. */
export async function outlineSvgText(
  svg: string,
  fontCss: string,
  deps: OutlineDeps = {},
): Promise<string> {
  const parsed = parseInert(svg, 'image/svg+xml').documentElement;
  if (!parsed.querySelector('text')) return svg;
  const faces = parseFontFaces(fontCss);
  const fontkit = await (deps.loadFontkit ?? defaultFontkit)();
  const root = document.importNode(parsed, true) as unknown as SVGSVGElement;
  for (const style of [...root.querySelectorAll('style')]) {
    if (!style.textContent?.includes('@font-face')) continue;
    const defs = style.parentElement;
    style.remove();
    if (defs?.localName === 'defs' && defs.childElementCount === 0) defs.remove();
  }
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
  host.appendChild(root);
  const registered: FontFace[] = [];
  try {
    for (const f of faces) {
      const face = new FontFace(f.family, bytesOf(f.url), {
        weight: `${f.weight[0]} ${f.weight[1]}`,
        style: f.style,
        unicodeRange: f.ranges
          .map(([lo, hi]) => `U+${lo.toString(16)}-${hi.toString(16)}`)
          .join(','),
      });
      await face.load();
      document.fonts.add(face);
      registered.push(face);
    }
    document.body.appendChild(host);
    const families = new Set(faces.map((f) => f.family.toLowerCase()));
    const texts = [...root.querySelectorAll('text')] as SVGTextContentElement[];
    // A text in a stack the kit embeds no face of is set in the fallback face before it is measured.
    for (const t of texts) {
      for (const el of [t, ...t.querySelectorAll('*')]) {
        const stack = stackFamilies(getComputedStyle(el).fontFamily);
        if (!stack.some((f) => families.has(f.toLowerCase())))
          (el as SVGElement).style.fontFamily = FALLBACK_FAMILY;
      }
    }
    await document.fonts.ready;
    const fonts = new Map<string, OutlineFont>();
    const fontFor = (run: Run): OutlineFont => {
      const key = `${run.match.face.url}|${run.match.weight}|${run.style.size}`;
      let font = fonts.get(key);
      if (!font) {
        font = openFace(fontkit, bytesOf(run.match.face.url), {
          weight: run.match.weight,
          size: run.style.size,
        });
        fonts.set(key, font);
      }
      return font;
    };
    for (const t of texts) {
      const chars = addressableChars(textNodesOf(t), t.getNumberOfChars());
      if (!chars) throw new OutlineError('layout', FALLBACK_FAMILY);
      const g = document.createElementNS(SVG_NS, 'g');
      for (const name of KEPT_ATTRS) {
        const v = t.getAttribute(name);
        if (v !== null) g.setAttribute(name, v);
      }
      for (const run of runsOf(t, chars, faces)) {
        const font = fontFor(run);
        const gr = glyphRun(run);
        const d = glyphRunPath(font, gr);
        if (d) g.appendChild(pathEl(document, d, run, true));
        for (const deco of run.style.decorations) {
          const dd = decorationPath(font, gr, deco);
          if (dd) g.appendChild(pathEl(document, dd, run, false));
        }
      }
      t.replaceWith(g);
    }
    root.remove();
    return new XMLSerializer().serializeToString(root);
  } finally {
    host.remove();
    for (const face of registered) document.fonts.delete(face);
  }
}
