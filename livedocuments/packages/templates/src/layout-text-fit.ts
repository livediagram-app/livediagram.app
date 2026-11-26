// A layout's words fitted to their boxes (docs/specs/007-editor/pages-mode.md "Layouts", "Words fit their boxes"):
// a label wrapped at its box's width that needs more lines than the box holds is clipped on the canvas (a box's
// words are cut at its edge: a SWOT point's "budget" lost its descender and read "budaet"), so a label that does not
// fit steps down a size (large to medium to small, keeping any scale the page gave it) until it does. A label set to
// scale or to a size of its own is left alone; a headline is fitted to one line already, so it never steps. Pure: elements in, elements out.
import {
  fontSizeFor,
  LABEL_LINE_HEIGHT,
  labelRoom,
  labelTextScale,
  wrapLabel,
  type BoxedElement,
  type Element,
  type TextSize,
} from '@livedocuments/document';

// A glyph's mean advance as a share of the size, for the canvas's sans (Inter measures 0.44 to 0.50 on a layout's
// sample lines). A little wider than it, so a line that fits here fits there.
export const LAYOUT_TEXT_CHAR_EM = 0.5;
const SMALLER: Partial<Record<string, TextSize>> = { lg: 'md', md: 'sm' };

type Label = BoxedElement & { label: string; textSize?: TextSize; textScale?: number };

function fittable(el: Element): el is Element & Label {
  const t = el as Partial<Label> & {
    iconId?: string;
    imageId?: string;
    rotation?: number;
    textArc?: number;
  };
  if (el.type !== 'text' && el.type !== 'shape') return false;
  if (typeof t.label !== 'string' || !t.label.trim()) return false;
  if (t.textSize === 'scale' || typeof t.textSize === 'number') return false;
  return !(t.iconId || t.imageId || t.rotation || t.textArc);
}

/** How many lines `el`'s label wraps to, and how many its box holds. */
export function labelFit(el: Label): { lines: number; holds: number } {
  const px = fontSizeFor(el.textSize) * labelTextScale(el);
  const room = labelRoom(el);
  const lines = wrapLabel(
    el.label,
    room.width,
    (s) => s.length * px * LAYOUT_TEXT_CHAR_EM,
    true,
  ).length;
  // A line's glyphs fill about the size itself; the rest of its height is spacing. So a box holds one line where
  // it is as tall as the size, and each further line takes the full line height.
  const holds = Math.floor((room.height + px * (LABEL_LINE_HEIGHT - 1)) / (px * LABEL_LINE_HEIGHT));
  return { lines, holds };
}

/** True when an element's label needs more lines than its box holds. */
export function labelOverflows(el: Element): boolean {
  if (!fittable(el)) return false;
  const { lines, holds } = labelFit(el);
  return lines > holds;
}

// The size a label fits its box at: its own, or the first smaller one it fits (small where none does).
function fittingSize(el: Element & Label): TextSize | undefined {
  let fitted = el;
  for (;;) {
    const { lines, holds } = labelFit(fitted);
    const next = SMALLER[String(fitted.textSize ?? 'md')];
    if (lines <= holds || !next) return fitted.textSize;
    fitted = { ...fitted, textSize: next };
  }
}

const RANK: Record<string, number> = { sm: 0, md: 1, lg: 2 };
// A list's rows share their box's size and their type's, so they step together: one long point never leaves its
// list in two sizes.
const rowKey = (el: Element & Label) =>
  `${el.type}|${String(el.textSize ?? 'md')}|${Math.round(el.width)}|${Math.round(el.height)}|${el.textScale ?? 1}`;

/** The layout's labels, each stepped down a size until it fits its box (or at small, as small as it goes), the rows
 *  of a list together. */
export function fitLayoutText(els: readonly Element[]): Element[] {
  const sizeOf = new Map<string, TextSize | undefined>();
  for (const el of els) {
    if (!fittable(el)) continue;
    const key = rowKey(el);
    const size = fittingSize(el);
    const held = sizeOf.get(key);
    if (!sizeOf.has(key) || RANK[String(size ?? 'md')]! < RANK[String(held ?? 'md')]!)
      sizeOf.set(key, size);
  }
  return els.map((el) => {
    if (!fittable(el)) return el;
    const size = sizeOf.get(rowKey(el));
    return size === el.textSize ? el : { ...el, textSize: size };
  });
}
