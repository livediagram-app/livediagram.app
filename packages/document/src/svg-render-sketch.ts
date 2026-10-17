// A sketched element in the SVG export (docs/specs/008-canvas/finish.md "Sketch"): the same drawing the canvas
// overlay paints (sketch-element.ts), placed at the element's position. Layers bottom to top: solid fill,
// pencil shading (the stroke colour, faint), outline, chrome.
import { finishSplitsFace, finishWobblesArt, resolveFinish, type Finish } from './finish';
import type { BoxedElement, Element } from './index';
import { SHAPE_DETAIL_STROKE_PX } from './shape-geometry';
import { SKETCH_HATCH_OPACITY, sketchElementPaint, type SketchDrawing } from './sketch-element';
import type { ExportShape } from './svg-render-describe';
import { r2, xmlEscape } from './svg-render-primitives';

function svgSketchDrawing(
  at: { x: number; y: number },
  drawing: SketchDrawing,
  paint: { fill: string; stroke: string; strokePx: number; dash: string | null },
): string {
  const fill = xmlEscape(paint.fill);
  const stroke = xmlEscape(paint.stroke);
  const dash = paint.dash ? ` stroke-dasharray="${paint.dash}"` : '';
  const line = ' fill="none" stroke-linecap="round" stroke-linejoin="round"';
  const parts = [`<g transform="translate(${r2(at.x)} ${r2(at.y)})" data-finish="sketch">`];
  if (drawing.solid) parts.push(`<path d="${drawing.solid}" fill="${fill}"/>`);
  if (drawing.hatch)
    parts.push(
      `<path d="${drawing.hatch}" stroke="${stroke}" stroke-opacity="${SKETCH_HATCH_OPACITY}" stroke-width="${r2(Math.max(1, paint.strokePx / 2))}"${line}/>`,
    );
  if (drawing.strokes)
    parts.push(
      `<path d="${drawing.strokes}" stroke="${stroke}" stroke-width="${r2(paint.strokePx)}"${dash}${line}/>`,
    );
  if (drawing.details)
    parts.push(
      `<path d="${drawing.details}" stroke="${stroke}" stroke-width="${SHAPE_DETAIL_STROKE_PX}"${line}/>`,
    );
  parts.push('</g>');
  return parts.join('');
}

/** A boxed element's sketched body for the export, or null when it is not sketched (another finish, or a
 *  kind Sketch leaves as drawn). */
export function svgSketchedBody(
  el: BoxedElement,
  shape: ExportShape,
  finish: Finish,
  // Something sits on this shape (sketch-backdrop.ts): a solid fill, never hatching.
  backdrop = false,
): string | null {
  if (shape.kind !== 'rect' && shape.kind !== 'ellipse' && shape.kind !== 'diamond') return null;
  const paint = sketchElementPaint(el, finish, shape.fill, backdrop);
  if (!paint) return null;
  return svgSketchDrawing({ x: el.x, y: el.y }, paint.drawing, {
    fill: shape.fill,
    stroke: shape.stroke,
    strokePx: paint.strokePx,
    dash: paint.dash,
  });
}

/** The id of the hand-drawn wobble icons and stickers are drawn through under Sketch, in an export. */
export const SKETCH_ART_FILTER_ID = 'lvd-sketch-art';

/** The lighter wobble a face's ink is drawn through under Sketch (docs/specs/008-canvas/finish.md "Every other face is
 *  drawn by hand too"): one pass of one octave over a tight region. Faces are large, and the icons' two passes held
 *  a 200-chart board's zoom to 50-90 ms tasks; one pass held it under 50 ms. Read by the canvas's SketchFilterDefs
 *  and the export, so the two agree. */
export const SKETCH_FACE_FILTER = {
  id: 'lvd-sketch-face',
  /** Region past the face's box on each side, so a wobbled edge is not clipped. */
  margin: '5%',
  baseFrequency: 0.12,
  numOctaves: 1,
  seed: 7,
  /** Displacement, px (blueprint: 2 to 4; past 4 small rules break up). */
  scale: 3,
} as const;

/** The face wobble as an SVG <filter>. */
function svgSketchFaceFilter(): string {
  const f = SKETCH_FACE_FILTER;
  return (
    `<filter id="${f.id}" x="-${f.margin}" y="-${f.margin}" width="${100 + 2 * parseFloat(f.margin)}%" height="${100 + 2 * parseFloat(f.margin)}%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${f.baseFrequency}" numOctaves="${f.numOctaves}" seed="${f.seed}" result="n"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="n" scale="${f.scale}" xChannelSelector="R" yChannelSelector="G"/></filter>`
  );
}

/** The wobbles' <defs> (the canvas's SketchFilterDefs): the icons' two passes and the faces' one, each only when an
 *  element on the tab draws through it; else empty. */
export function svgSketchArtDefs(elements: readonly Element[], tabFinish: unknown): string {
  const sketched = elements.filter(
    (el) => resolveFinish((el as { finish?: unknown }).finish, tabFinish) === 'sketch',
  ) as { type: string; shape?: string }[];
  const art = sketched.some((el) => finishWobblesArt(el));
  const faces = sketched.some((el) => finishSplitsFace(el));
  if (!art && !faces) return '';
  return `<defs>${art ? svgSketchArtFilter() : ''}${faces ? svgSketchFaceFilter() : ''}</defs>`;
}

function svgSketchArtFilter(): string {
  return (
    `<filter id="${SKETCH_ART_FILTER_ID}" x="-15%" y="-15%" width="130%" height="130%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.12" numOctaves="2" seed="7" result="n1"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="n1" scale="3" xChannelSelector="R" yChannelSelector="G" result="p1"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.1" numOctaves="2" seed="23" result="n2"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="n2" scale="3" xChannelSelector="G" yChannelSelector="R" result="p2"/>` +
    `<feMerge><feMergeNode in="p1"/><feMergeNode in="p2"/></feMerge></filter>`
  );
}

// A sketched face (docs/specs/008-canvas/finish.md "Every other face is drawn by hand too") in the export: its ink
// through the wobble, its words crisp above it. Markup is split by tag, never parsed: a face is our own renderer's
// output, so its words are always <text> runs and its photos <image>s.
const WORDS = /<text\b[^>]*>[\s\S]*?<\/text>|<text\b[^>]*\/>/g;
const PHOTOS =
  /<image\b[^>]*\/>|<image\b[^>]*>[\s\S]*?<\/image>|<foreignObject\b[\s\S]*?<\/foreignObject>/g;
const INK_TAGS = /<(rect|circle|ellipse|path|line|polyline|polygon|use)\b/g;
const HAS_INK = /<(rect|circle|ellipse|path|line|polyline|polygon|use)\b/;
const HAS_WORDS = /<(text|image|foreignObject)\b/;
// Shapes that clip, mask or paint (never drawn themselves): hiding one would empty its clip, so they are kept whole.
const DEFINITIONS = /<(clipPath|mask|defs|pattern|marker)\b[^>]*>[\s\S]*?<\/\1>/g;
// The hand-drawn body (svgSketchDrawing) is already drawn by hand; it is drawn once, under the face, never wobbled.
const SKETCHED_BODY = /<g [^>]*data-finish="sketch">[\s\S]*?<\/g>/;

/** Every ink tag in `markup` hidden, leaving its words and photos; definitions untouched. */
function hideInk(markup: string): string {
  const kept: string[] = [];
  const held = markup.replace(DEFINITIONS, (d) => `<!--lvd-def-${kept.push(d) - 1}-->`);
  return held
    .replace(INK_TAGS, '<$1 visibility="hidden"')
    .replace(/<!--lvd-def-(\d+)-->/g, (_, i: string) => kept[Number(i)]!);
}

/** A face's markup as two layers: the ink copy (words and photos taken out) through the wobble, then the words
 *  copy (every ink tag hidden) over it, so the words keep their place and stay sharp. A sketched body inside is
 *  drawn once, untouched, where it was: under a box's face, over a table's grid. */
export function svgSketchFace(markup: string): string {
  const body = SKETCHED_BODY.exec(markup)?.[0] ?? '';
  const face = body ? markup.replace(body, '') : markup;
  const ink = face.replace(WORDS, '').replace(PHOTOS, '');
  const inkLayer = HAS_INK.test(ink) ? `<g filter="url(#${SKETCH_FACE_FILTER.id})">${ink}</g>` : '';
  const wordsLayer = HAS_WORDS.test(face) ? hideInk(face) : '';
  const layers = inkLayer + wordsLayer;
  return body && !markup.startsWith(body) ? layers + body : body + layers;
}
