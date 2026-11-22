// A template's text sized to its words (each product's docs/specs/008-canvas/canvas-and-palette.md "Templates",
// "Text sized to its words"): a title, subtitle, caption or hint a template lays at the content's width is as wide as
// its words, so Zoom to Fit, the minimap and the selection outline frame the content, not empty width. Text that
// wraps keeps its width (the content's, at most). An estimate, with no DOM to measure (templates build in Workers
// too): Inter's advances (model-core text-advance), widened by a margin so a word never wraps early. One copy for
// every product: each product's templates run their output through fitTextWidths, and each product's edit operations
// grow a fitted text back out when an agent writes it longer words (growTextToLabel).
import { labelFontPx, readTextSize } from '@liveworkspace/model-core/label-font';
import { PADDING_PX, type Padding, type TextSize } from '@liveworkspace/model-core/basics';
import { BOLD_EM, textAdvanceEm } from '@liveworkspace/model-core/text-advance';
import { LABEL_ESTIMATE_CHAR_EM } from './svg-render-primitives';

// The estimate's margin: a share on top of the advances, and px beside them.
const TEXT_FIT_MARGIN = 1.1;
const TEXT_FIT_PAD = 8;
// The widest a text grows to hold an agent's longer words on one line; past it the words wrap.
export const TEXT_GROW_MAX = 1200;
// The faces the estimate holds for: the default (unset, the UI sans) and Inter, and Caveat, narrower than both. A
// text in any other face keeps its box.
const FITTED_FONTS: ReadonlySet<string | undefined> = new Set([undefined, 'inter', 'caveat']);

export type FitText = {
  type: string;
  x: number;
  width: number;
  label?: string;
  textSize?: TextSize;
  textScale?: number;
  textBold?: boolean;
  fontWeight?: number;
  font?: string;
  letterSpacing?: number;
  textCase?: 'upper' | 'lower';
  textAlignX?: 'left' | 'center' | 'right';
  rotation?: number;
  textArc?: number;
  richText?: unknown;
  sizing?: string;
  fillColor?: string;
  strokeColor?: string;
  padding?: Padding;
};

// Whether the estimate can size this text: plain words in a face it holds for, on a box that draws nothing of its own
// (no fill or border) and hugs nothing already (no `sizing`), flat, and turned only when centred (a centred box
// narrows about its centre, the point it turns about).
function fittable(el: FitText): boolean {
  if (el.type !== 'text' || !el.label?.trim()) return false;
  if (el.sizing !== undefined || el.richText !== undefined || el.textArc) return false;
  if (el.fillColor || el.strokeColor || !FITTED_FONTS.has(el.font)) return false;
  return !el.rotation || (el.textAlignX ?? 'center') === 'center';
}

/** The width a text's box needs for its words on one line each (its widest line, estimated generously, and the box's
 *  padding both sides), in canvas px. */
export function textWordsWidth(el: FitText): number {
  const px = labelFontPx(readTextSize(el.textSize)) * (el.textScale ?? 1);
  const bold = el.textBold === true || (el.fontWeight ?? 0) >= 600 ? BOLD_EM : 1;
  const tracking = el.letterSpacing ?? 0;
  const label = el.label ?? '';
  const shown =
    el.textCase === 'upper'
      ? label.toUpperCase()
      : el.textCase === 'lower'
        ? label.toLowerCase()
        : label;
  // The wider of Inter's advances and the flat share a headless render wraps by (LABEL_ESTIMATE_CHAR_EM), so the
  // words sit on one line on the canvas, in an export and in an agent's preview alike.
  const lineEm = (line: string) => {
    const glyphs = [...line].length;
    return (
      Math.max(textAdvanceEm(line) * bold, glyphs * LABEL_ESTIMATE_CHAR_EM) + tracking * glyphs
    );
  };
  const widest = Math.max(...shown.split('\n').map((line) => lineEm(line) * px));
  return Math.ceil(widest * TEXT_FIT_MARGIN) + TEXT_FIT_PAD + 2 * PADDING_PX[el.padding ?? 'none'];
}

// The box at `width`, kept where its words sit: a left-aligned box keeps its left edge, a right-aligned one its
// right, a centred one its centre.
function atWidth<E extends FitText>(el: E, width: number): E {
  const align = el.textAlignX ?? 'center';
  const shift =
    align === 'left' ? 0 : align === 'right' ? el.width - width : (el.width - width) / 2;
  return { ...el, x: el.x + shift, width };
}

/** A text narrowed to its words when its box runs wider; anything else, and text that wraps, as it is. */
export function fitTextWidth<E extends FitText>(el: E): E {
  if (!fittable(el)) return el;
  const need = textWordsWidth(el);
  return need < el.width ? atWidth(el, need) : el;
}

/** Every text in a template's output narrowed to its words (fitTextWidth). */
export function fitTextWidths<E extends { type: string }>(elements: readonly E[]): E[] {
  return elements.map((el) => (el.type === 'text' ? (fitTextWidth(el as E & FitText) as E) : el));
}

/** A text whose old words sat on one line, widened to hold its new ones on one line too (up to TEXT_GROW_MAX), kept
 *  where its words sit; it never narrows. Anything else, and a text whose words already wrapped, as it is. */
export function growTextToLabel<E extends FitText>(before: { type: string }, el: E): E {
  if (!fittable(el) || before.type !== 'text') return el;
  const was = before as FitText;
  if (textWordsWidth(was) > was.width) return el;
  const need = Math.min(TEXT_GROW_MAX, textWordsWidth(el));
  return need > el.width ? atWidth(el, need) : el;
}
