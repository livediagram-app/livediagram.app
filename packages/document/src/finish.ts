// A finish (docs/specs/008-canvas/finish.md): the drawing style a tab's elements are rendered in, apart from
// their colours. Flexible is today's look; Professional is crisp; Sketch is hand-drawn. A tab carries one,
// an element may carry its own, and what an element is drawn in is its own, else its tab's, else Flexible.
//
// A finish only changes what an element leaves unset (its corner, border width, arrow thickness, shadow,
// font) plus how a line is drawn (Sketch, see sketch.ts). An explicit pick on the element always wins. Pure
// functions, read by the canvas and every export so the two agree.
import type { ArrowStyle, ArrowThickness } from './arrow-style';
import { DEFAULT_ICON_WEIGHT, type IconWeight } from './icon-weight';
import type { BorderStroke } from './border-style';
import { DEFAULT_BORDER_STROKE } from './border-style';
import { SELF_PAINTING_SHAPES } from './colors';
import type { Element } from './index';
import { shapeGeometry } from './shape-geometry';

export type Finish = 'flexible' | 'professional' | 'sketch';

export const FINISHES: readonly Finish[] = ['flexible', 'professional', 'sketch'];

export const DEFAULT_FINISH: Finish = 'flexible';

/** The corner a Professional free-corner box draws when it sets none: square, the clearest break from
 *  Flexible's soft corners (blueprint: 0 to 4 px). */
export const PROFESSIONAL_CORNER_PX = 0;

/** The crisp sans a Professional element is lettered in when neither it nor its tab picks a font. */
export const PROFESSIONAL_FONT_ID = 'inter';

/** The handwriting font a Sketch element without its own font is lettered in (fonts.ts id). */
export const SKETCH_FONT_ID = 'caveat';

export function isFinish(v: unknown): v is Finish {
  return v === 'flexible' || v === 'professional' || v === 'sketch';
}

/** The element types that carry their own finish (the spec's "Where it is set"). */
export const FINISH_ELEMENT_TYPES: ReadonlySet<Element['type']> = new Set([
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

/** Whether the soft default shadow on boxes and the sticky's paper peel draw. An element's own shadow
 *  always draws. */
export function finishDrawsDefaultShadow(finish: Finish): boolean {
  return finish !== 'professional';
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

/** A line-art icon's weight: its own, else Thin under Professional, else the default. */
export function finishIconWeight(own: IconWeight | undefined, finish: Finish): IconWeight {
  return own ?? (finish === 'professional' ? 'thin' : DEFAULT_ICON_WEIGHT);
}

/** Whether an element is art Sketch draws through the hand-drawn wobble rather than redrawing it: icons (line art
 *  and technology marks) and stickers. */
export function finishWobblesArt(el: { type: string; shape?: string }): boolean {
  return el.type === 'shape' && (el.shape === 'icon' || el.shape === 'sticker');
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

/** Whether a Sketch element's fill (`fill`, already resolved) is drawn as hatching rather than solid:
 *  plain shapes only, never a see-through fill, and never a backdrop (a shape other elements sit on, see
 *  sketchBackdropIds): hatching under a key's captions or a card's contents makes them unreadable. */
export function finishHatches(element: Element, fill: string, backdrop = false): boolean {
  if (backdrop || !finishHatchesKind(element)) return false;
  return fill !== 'transparent' && fill !== 'none';
}
