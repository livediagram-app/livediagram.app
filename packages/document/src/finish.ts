// A finish (docs/specs/008-canvas/finish.md): the drawing style a tab's elements are rendered in, apart from
// their colours. Flexible is today's look; Professional is crisp; Sketch is hand-drawn. A tab carries one,
// an element may carry its own, and what an element is drawn in is its own, else its tab's, else Flexible.
//
// A finish only changes what an element leaves unset (its corner, border width, arrow thickness, shadow,
// font) plus how a line is drawn (Sketch, see sketch.ts). An explicit pick on the element always wins. Pure
// functions, read by the canvas and every export so the two agree.
import type { ArrowThickness } from './arrow-style';
import type { BorderStroke } from './border-style';
import { DEFAULT_BORDER_STROKE } from './border-style';
import { SELF_PAINTING_SHAPES } from './colors';
import type { Element } from './index';

export type Finish = 'flexible' | 'professional' | 'sketch';

export const FINISHES: readonly Finish[] = ['flexible', 'professional', 'sketch'];

export const DEFAULT_FINISH: Finish = 'flexible';

/** The corner a Professional free-corner box draws when it sets none (blueprint: 0 to 4 px). */
export const PROFESSIONAL_CORNER_PX = 2;

/** The handwriting font a Sketch element without its own font is lettered in (fonts.ts id). */
export const SKETCH_FONT_ID = 'caveat';

export function isFinish(v: unknown): v is Finish {
  return v === 'flexible' || v === 'professional' || v === 'sketch';
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

/** The font id an element is lettered in: its own, else the handwriting font under Sketch, else the
 *  tab's. Undefined means the editor default. */
export function finishFontId(
  own: string | undefined,
  tab: string | undefined,
  finish: Finish,
): string | undefined {
  return own ?? (finish === 'sketch' ? SKETCH_FONT_ID : tab);
}

/** Whether a freshly drawn arrow may take a draw-time avoidance curve. */
export function finishCurvesNewArrows(finish: Finish): boolean {
  return finish !== 'professional';
}

// Containers and notes keep a solid fill under Sketch: hatching behind writing makes it hard to read.
const SOLID_UNDER_SKETCH = new Set<string>(['frame', 'lane', 'page']);

/** Whether a Sketch element's fill (`fill`, already resolved) is drawn as hatching rather than solid:
 *  shapes only, never containers or self-painting kinds, and never a see-through fill. */
export function finishHatches(element: Element, fill: string): boolean {
  if (element.type !== 'shape') return false;
  if (SOLID_UNDER_SKETCH.has(element.shape) || SELF_PAINTING_SHAPES.has(element.shape))
    return false;
  return fill !== 'transparent' && fill !== 'none';
}
