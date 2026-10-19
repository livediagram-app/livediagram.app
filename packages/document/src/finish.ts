// A finish (docs/specs/008-canvas/finish.md): the drawing style a tab's elements are rendered in, apart from
// their colours. Flexible is today's look; Professional is crisp; Sketch is pencil by hand; Marker is felt-tip by
// hand. A tab carries one,
// an element may carry its own, and what an element is drawn in is its own, else its tab's, else Flexible.
//
// A finish only changes what an element leaves unset (its corner, border width, arrow thickness, shadow,
// font) plus how a line is drawn (Sketch, see sketch.ts; Marker, see marker.ts). An explicit pick on the element always wins. Pure
// functions, read by the canvas and every export so the two agree.
import { ARROW_THICKNESS_PX, type ArrowStyle, type ArrowThickness } from './arrow-style';
import { DEFAULT_ICON_WEIGHT, type IconWeight } from './icon-weight';
import type { BorderStroke } from './border-style';
import { DEFAULT_BORDER_STROKE } from './border-style';
import { SELF_PAINTING_SHAPES } from './colors';
import type { Element } from './index';
import { shapeGeometry } from './shape-geometry';

export type Finish = 'flexible' | 'professional' | 'sketch' | 'marker';

export const FINISHES: readonly Finish[] = ['flexible', 'professional', 'sketch', 'marker'];

/** The finishes that redraw an element's lines by hand (its body, its arrows): a pencil's (Sketch) or a felt-tip
 *  marker's (Marker). */
export type HandDrawnFinish = 'sketch' | 'marker';

export const DEFAULT_FINISH: Finish = 'flexible';

/** The corner a Professional free-corner box draws when it sets none: square, the clearest break from
 *  Flexible's soft corners (blueprint: 0 to 4 px). */
export const PROFESSIONAL_CORNER_PX = 0;

/** The crisp sans a Professional element is lettered in when neither it nor its tab picks a font. */
export const PROFESSIONAL_FONT_ID = 'inter';

/** The handwriting font a Sketch element without its own font is lettered in (fonts.ts id). */
export const SKETCH_FONT_ID = 'caveat';

/** The marker lettering a Marker element without its own font is written in (fonts.ts id). */
export const MARKER_FONT_ID = 'permanent-marker';

/** The width a Marker outline or arrow that sets none is drawn at, px: a felt-tip's nib, bolder than Flexible's 2 px
 *  and finer than Thick's 4 px (blueprint: 2.5 to 3.5). */
export const MARKER_LINE_PX = 3;

export function isFinish(v: unknown): v is Finish {
  return v === 'flexible' || v === 'professional' || v === 'sketch' || v === 'marker';
}

/** Whether a finish redraws lines by hand (Sketch's pencil, Marker's felt-tip). */
export function isHandDrawn(finish: Finish): finish is HandDrawnFinish {
  return finish === 'sketch' || finish === 'marker';
}

/** Whether a finish hands an element's body (outline and fill) to the hand-drawn overlay. A sticky under Marker
 *  stays paper with its peel: a note on a wall is written on with a marker, never outlined. */
export function finishDrawsBodyByHand(finish: Finish, type: string): boolean {
  return finish === 'sketch' || (finish === 'marker' && type !== 'sticky');
}

/** The element types that carry their own finish (the spec's "Where it is set"). */
const FINISH_ELEMENT_TYPES: ReadonlySet<Element['type']> = new Set([
  'shape',
  'arrow',
  'text',
  'sticky',
  'table',
]);

export function supportsFinish(el: { type: string }): boolean {
  return FINISH_ELEMENT_TYPES.has(el.type as Element['type']);
}

/** The finish an element is drawn in: its own, else its tab's, else Flexible. A stored value that is not
 *  a finish (a newer client's, a hand edit) reads as absent. */
export function resolveFinish(own: unknown, tab: unknown): Finish {
  if (isFinish(own)) return own;
  if (isFinish(tab)) return tab;
  return DEFAULT_FINISH;
}

/** The corner a box with no corner preset draws at: its kind's default, or Professional's sharper one. */
export function finishCornerFallbackPx(kindDefaultPx: number, finish: Finish): number {
  return finish === 'professional'
    ? Math.min(PROFESSIONAL_CORNER_PX, kindDefaultPx)
    : kindDefaultPx;
}

/** A border's width preset: the element's own, else Thin under Professional, else the default. */
export function finishBorderStroke(own: BorderStroke | undefined, finish: Finish): BorderStroke {
  return own ?? (finish === 'professional' ? 'thin' : DEFAULT_BORDER_STROKE);
}

/** An arrow's thickness: its own when set, else Thin under Professional, else the resolved default. */
export function finishArrowThickness(
  resolved: ArrowThickness,
  isOwnSet: boolean,
  finish: Finish,
): ArrowThickness {
  return !isOwnSet && finish === 'professional' ? 'thin' : resolved;
}

/** An arrow's line width, px: its own when set, else 1 px under Professional, a marker's nib under Marker, else
 *  2 px. Under Marker a Thin (1 px or finer) arrow is drawn at the nib too: a marker has no fine-liner. Read by the
 *  canvas and the export alike. */
export function finishArrowWidthPx(own: number | undefined, finish: Finish): number {
  if (finish === 'marker' && (own === undefined || own <= ARROW_THICKNESS_PX.thin))
    return MARKER_LINE_PX;
  if (own !== undefined) return own;
  if (finish === 'professional') return ARROW_THICKNESS_PX.thin;
  return finish === 'marker' ? MARKER_LINE_PX : 2;
}

/** Whether the soft default shadow on boxes and the sticky's paper peel draw. An element's own shadow
 *  always draws. */
export function finishDrawsDefaultShadow(finish: Finish): boolean {
  return finish !== 'professional';
}

/** Whether the shadows and hover lift a face draws on its own parts draw (docs/specs/008-canvas/finish.md "Faces"):
 *  Professional is flat and a marker drawing casts none. Sketch's are drawn through its wobble. */
export function finishFaceShadows(finish: Finish): boolean {
  return finish === 'flexible' || finish === 'sketch';
}

/** A face's own rectangle's corner (a card, a panel, a band, a chip) in its finish: square under Professional. */
export function finishFaceCornerPx(px: number, finish: Finish): number {
  return finish === 'professional' ? Math.min(PROFESSIONAL_CORNER_PX, px) : px;
}

/** The finish a face's own parts are drawn in, or undefined when they draw as they are: Flexible, a face that is
 *  only its label (finishSplitsFace), or Professional on an element with a corner of its own, which wins over the
 *  finish's square corners for the whole face. */
export function faceFinishOf(
  el: { type: string; shape?: string; iconId?: string; borderRadius?: unknown },
  finish: Finish,
): Finish | undefined {
  if (finish === 'flexible' || !finishSplitsFace(el)) return undefined;
  if (finish === 'professional' && el.borderRadius !== undefined) return undefined;
  return finish;
}

/** The font id an element is lettered in: its own, else the tab's, else the handwriting font under Sketch or Inter
 *  under Professional. Undefined means the editor default. */
export function finishFontId(
  own: string | undefined,
  tab: string | undefined,
  finish: Finish,
): string | undefined {
  // A font picked on the element or the tab wins; a finish only fills the gap (handwriting for Sketch, Inter for
  // Professional), so picking a typeface on a Sketch tab shows.
  if (own) return own;
  if (tab) return tab;
  if (finish === 'sketch') return SKETCH_FONT_ID;
  if (finish === 'marker') return MARKER_FONT_ID;
  return finish === 'professional' ? PROFESSIONAL_FONT_ID : undefined;
}

/** The font id an element is lettered in, from the element and its tab (finishFontId over the element's
 *  drawn finish). A finish picked on the element itself is more specific than the tab's font, so its
 *  lettering wins over the tab's (Sketch on one heading of a Boardroom tab writes it by hand); the
 *  element's own font still wins over both. */
export function elementFontId(
  el: { font?: string; finish?: unknown },
  tabFont: string | undefined,
  tabFinish: unknown,
): string | undefined {
  if (!el.font && isFinish(el.finish) && el.finish !== 'flexible') {
    return finishFontId(undefined, undefined, el.finish);
  }
  return finishFontId(el.font, tabFont, resolveFinish(el.finish, tabFinish));
}

/** A line-art icon's weight: its own, else Thin under Professional, Bold under Marker, else the default. */
export function finishIconWeight(own: IconWeight | undefined, finish: Finish): IconWeight {
  if (own) return own;
  if (finish === 'professional') return 'thin';
  return finish === 'marker' ? 'bold' : DEFAULT_ICON_WEIGHT;
}

/** Whether an element is art Sketch draws through the hand-drawn wobble rather than redrawing it: icons (line art
 *  and technology marks) and stickers. */
export function finishWobblesArt(el: { type: string; shape?: string }): boolean {
  return el.type === 'shape' && (el.shape === 'icon' || el.shape === 'sticker');
}

// The shapes whose whole body the sketched outline draws, their face being the label alone: Sketch has nothing
// more of theirs to draw by hand (unless they carry an inline icon). The sequence diagram redraws itself in its
// finish, and icons and stickers go through the wobble whole (finishWobblesArt).
const SKETCHED_BY_BODY = new Set<string>([
  'square',
  'circle',
  'diamond',
  'cylinder',
  'parallelogram',
  'hexagon',
  'document',
  'mind-node',
  'stadium',
  'actor',
  'final-state',
  'cloud',
  'triangle',
  'trapezoid',
  'star',
  'speech-bubble',
  'frame',
  'monitor',
  'laptop',
  'phone',
  'tablet',
  'foldable',
  'smartwatch',
  'sequence',
  'icon',
  'sticker',
]);

/** The element kinds Sketch draws a face of by hand (docs/specs/008-canvas/finish.md "Every other face is drawn by
 *  hand too"): its ink through the wobble, its words crisp above it. Everything that draws more than a label, a
 *  table's grid, a link card, a video's frame, an annotation marker, and a plain box carrying an inline icon. */
export function finishSplitsFace(el: { type: string; shape?: string; iconId?: string }): boolean {
  switch (el.type) {
    case 'table':
    case 'link-card':
    case 'video':
    case 'annotation':
      return true;
    case 'shape':
      return !SKETCHED_BY_BODY.has(el.shape ?? '') || (!!el.iconId && !finishWobblesArt(el));
    default:
      return false;
  }
}

/** Whether a freshly drawn arrow may take a draw-time avoidance curve. */
export function finishCurvesNewArrows(finish: Finish): boolean {
  return finish !== 'professional';
}

/** The style a freshly drawn arrow takes when the person drawing it picked none: a right-angled connector
 *  under Professional, the formal diagram look; otherwise none (straight, or the avoidance curve). */
export function finishNewArrowStyle(finish: Finish): ArrowStyle | undefined {
  return finish === 'professional' ? 'angled' : undefined;
}

// The plain boxes whose fill Sketch hatches; every drawn silhouette but the frame hatches too. Cards, panels,
// buttons, records, pages, lanes and frames keep a solid fill under a sketched edge: hatching behind their
// faces and rows makes them hard to read.
const HATCHED_BOXES = new Set<string>(['square', 'circle', 'stadium', 'mind-node']);

/** Whether a shape's kind takes Sketch hatching at all (plain boxes and drawn silhouettes, not frames or
 *  self-painting faces), whatever its fill and whatever sits on it. */
export function finishHatchesKind(element: Element): boolean {
  if (element.type !== 'shape') return false;
  if (SELF_PAINTING_SHAPES.has(element.shape)) return false;
  const drawn = element.shape !== 'frame' && shapeGeometry(element.shape) !== null;
  return HATCHED_BOXES.has(element.shape) || drawn;
}

/** Whether a hand-drawn element's fill (`fill`, already resolved) is shaded (Sketch's hatching, Marker's colouring in)
 *  rather than solid:
 *  plain shapes only, never a see-through fill, and never a backdrop (a shape other elements sit on, see
 *  sketchBackdropIds): hatching under a key's captions or a card's contents makes them unreadable. */
export function finishHatches(element: Element, fill: string, backdrop = false): boolean {
  if (backdrop || !finishHatchesKind(element)) return false;
  return fill !== 'transparent' && fill !== 'none';
}
