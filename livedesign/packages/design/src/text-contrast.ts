// Whether a text colour reads where the words sit (docs/specs/004-interface-design/colour-picker.md
// "Reading on its ground"): what the text is judged against (its own fill, a box under it, its page),
// the WCAG 2.2 SC 1.4.3 target for its size, and the nearest shade of the same hue that reaches it.
// Built on re-inking's maths (page-ink-contrast, page-ink-ground, page-ink-rules), so the hint and a
// page's re-inking agree on every ratio. Pure.
import { labelFontPx } from '@liveworkspace/model-core/label-font';
import type { CanvasSurface } from './colors';
import { layerBands } from './layers';
import { labelTextScale } from './label-text-scale';
import { layOutPages, pagesOf, rowPageAt } from './page';
import { inkToward, isOpaqueHex, worstContrast } from './page-ink-contrast';
import { pageGroundUnder } from './page-ink-ground';
import { boxFill, inkKindOf, keptCover } from './page-ink-rules';
import { isBoxed, type BoxedElement, type Tab } from './index';

// WCAG 2.2 SC 1.4.3 (AA): normal text, and large text.
export const TEXT_CONTRAST = 4.5;
export const LARGE_TEXT_CONTRAST = 3;
// WCAG's large text: 18pt, or 14pt in bold, at 0.75pt a px.
export const LARGE_TEXT_PX = 24;
export const LARGE_BOLD_TEXT_PX = 18.66;

/** Whether text of `px` (as drawn) is large text under WCAG 2.2. */
export function isLargeText(px: number, bold: boolean): boolean {
  return px >= LARGE_TEXT_PX || (bold && px >= LARGE_BOLD_TEXT_PX);
}

type Labelled = BoxedElement & {
  textSize?: Parameters<typeof labelFontPx>[0];
  textBold?: boolean;
  fontWeight?: number;
};

/** The px a label draws at: its size on its scale (a sticky note's runs smaller), times its text scale. */
export function labelDrawnPx(el: BoxedElement): number {
  return labelFontPx((el as Labelled).textSize, el.type === 'sticky') * labelTextScale(el);
}

/** Whether a label paints bold: its weight while set, else its Bold toggle. */
export function labelIsBold(el: BoxedElement): boolean {
  const { fontWeight, textBold } = el as Labelled;
  return fontWeight !== undefined ? fontWeight >= 700 : textBold === true;
}

/** What text sits on: every tone under it (text must read on the worst) and what makes them. */
export type TextGround = { tones: string[]; on: 'page' | 'shape' | 'card' };

type GroundTab = Pick<Tab, 'elements'> & {
  pages?: unknown;
  pageOrientation?: unknown;
  layers?: Tab['layers'];
};

// A box's own surface under its label: its opaque fill (a shape, a closed path, a sticky or link
// card); null when it draws none, so the label reads on what is under the box.
function ownFill(el: BoxedElement, surface: CanvasSurface): string | null {
  if (inkKindOf(el) === 'box') return boxFill(el, surface);
  const kept = keptCover(el, surface);
  return typeof kept === 'string' ? kept : null;
}

const contains = (b: BoxedElement, p: { x: number; y: number }) =>
  p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

/**
 * What the element's label is read against: its own fill; else the topmost element painted before
 * it whose box holds its centre and covers it (a filled box, a sticky note); else its page's
 * background under it. Null where that can't be judged: a picture (a page's picture background, an
 * image or widget under it), or off every page.
 */
export function textGroundOf(
  el: BoxedElement,
  tab: GroundTab,
  surface: CanvasSurface,
): TextGround | null {
  const own = ownFill(el, surface);
  if (own) return { tones: [own], on: 'shape' };
  const centre = { x: el.x + el.width / 2, y: el.y + el.height / 2 };
  const painted = layerBands(tab.elements, tab.layers).flatMap((b) => b.elements);
  const at = painted.findIndex((e) => e.id === el.id);
  for (let i = at - 1; i >= 0; i -= 1) {
    const under = painted[i]!;
    if (!isBoxed(under) || !contains(under, centre)) continue;
    const fill = ownFill(under, surface);
    if (fill) return { tones: [fill], on: 'card' };
    // A surface of its own whose tone isn't known (a picture, a widget): nothing to judge.
    if (inkKindOf(under) === 'keep' && keptCover(under, surface) === null) return null;
  }
  const page = rowPageAt(layOutPages(pagesOf(tab)), centre);
  if (!page || page.background?.fill?.kind === 'image') return null;
  const box = { x: el.x, y: el.y, width: el.width, height: el.height };
  return { tones: pageGroundUnder(page.background, page.rect, box).tones, on: 'page' };
}

export type TextContrast = {
  // The worst ratio against the ground's tones, and the tone it is worst on.
  ratio: number;
  tone: string;
  // The target for this size of text.
  needed: number;
  passes: boolean;
  // The nearest shade of the same hue that reaches `needed`, while it falls short; null when it
  // passes or no shade of its hue does.
  suggestion: string | null;
};

/** How `colour` reads on `tones` as text of this size; null for a colour (or ground) it can't read. */
export function textContrast(
  colour: string,
  tones: readonly string[],
  large: boolean,
): TextContrast | null {
  if (!isOpaqueHex(colour) || tones.length === 0) return null;
  const ratio = worstContrast(colour, tones);
  if (Number.isNaN(ratio)) return null;
  const tone = tones.find((t) => worstContrast(colour, [t]) === ratio)!;
  const needed = large ? LARGE_TEXT_CONTRAST : TEXT_CONTRAST;
  if (ratio >= needed) return { ratio, tone, needed, passes: true, suggestion: null };
  const shade = inkToward(colour, tones, needed, needed).toLowerCase();
  const reaches = worstContrast(shade, tones) >= needed;
  return { ratio, tone, needed, passes: false, suggestion: reaches ? shade : null };
}
