// Parts the Social set's layouts share (docs/specs/007-editor/pages-mode.md "Layouts"): big
// page-sized type, a headline stacked over several lines at one size, a pill, the account's handle
// row every post signs off with, and a column that pins its first and last parts to its ends and
// centres the rest between them. Social posts are mostly Square, Portrait post (4:5) and Story
// (9:16) pages, so type here grows with the page rather than staying at the preset sizes.
import { LABEL_FONT_PX, type Element, type TextElement } from '@liveplanner/document';
import { kit, type Kit, type LayoutBox } from './page-layout-kit';

// A headline's type as a share of its line box, and a bold glyph's mean advance as a share of the
// size: the kit's own title constants, so a stacked headline sizes the way k.title does.
const TITLE_FILL = 0.72;
const GLYPH_WIDTH = 0.6;
// Capitals run wider than mixed case: an all-caps line is measured at this advance instead.
const CAPS_GLYPH_WIDTH = 0.74;
// Stacked headline lines sit this much of a line box apart: tight, as display type is set.
const STACK_LEADING = 0.82;
// A headline fills this share of its width at most: short lines ("03") measure least reliably.
const TITLE_SAFE_WIDTH = 0.92;
// A body line's box over its font size.
const BODY_LEADING = 1.32;

// The account every post is signed by.
export const HANDLE = '@northwind';

// A post much taller than wide (a story) has the height for bigger parts: its unit grows by the
// page's height over width past STORY_FROM, up to STORY_BOOST_MAX, so a story fills like a square.
const STORY_FROM = 1.4;
const STORY_BOOST_MAX = 1.3;

// The kit the Social set lays out with: the shared kit, its unit grown on a story.
export function socialKit(box: LayoutBox): Kit {
  const k = kit(box);
  if (k.wide) return k;
  const boost = Math.min(STORY_BOOST_MAX, Math.max(1, box.height / box.width / STORY_FROM));
  return { ...k, u: k.u * boost };
}

const scaleOf = (px: number) => Math.round((px / LABEL_FONT_PX.lg) * 100) / 100;

// Large type `f` units of the page tall, never under the large preset.
export function big(k: Kit, f: number): Partial<TextElement> {
  return { textSize: 'lg', textScale: Math.max(1, scaleOf(k.u * f)) };
}

// The height `lines` lines of big(k, f) type take.
export function bigH(k: Kit, f: number, lines = 1): number {
  return Math.max(k.u * f, LABEL_FONT_PX.lg) * BODY_LEADING * lines;
}

// A headline over several lines, every line at one size: the largest that fits the longest line
// across `w` and all of them down `maxH`. Returns its elements and the height it took.
export function titleStack(
  k: Kit,
  x: number,
  y: number,
  w: number,
  maxH: number,
  lines: readonly string[],
  align: 'left' | 'center' | 'right' = 'left',
): { els: Element[]; h: number } {
  const n = lines.length;
  const advance = (l: string) =>
    l.length * (l === l.toUpperCase() && /[A-Z]/.test(l) ? CAPS_GLYPH_WIDTH : GLYPH_WIDTH);
  const widest = Math.max(...lines.map(advance));
  const fontPx = Math.min(
    (maxH / (STACK_LEADING * (n - 1) + 1)) * TITLE_FILL,
    (w * TITLE_SAFE_WIDTH) / widest,
  );
  const lineH = fontPx / TITLE_FILL;
  const els = lines.map((line, i) => ({
    ...k.title(x, y + i * lineH * STACK_LEADING, w, lineH, line),
    textScale: scaleOf(fontPx),
    textAlignX: align,
  }));
  return { els, h: lineH * (STACK_LEADING * (n - 1) + 1) };
}

// A filled, fully rounded tag: a kicker like "TIP OF THE DAY", or a call to action.
export function pill(
  k: Kit,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  textSize: TextElement['textSize'] = 'md',
): Element {
  return k.shape('square', x, y, w, h, { label, textBold: true, textSize, borderRadius: 'full' });
}

// A pill's width for its words at the preset size: room for the glyphs and a little either side.
export function pillW(k: Kit, label: string, textSize: 'md' | 'lg' = 'md'): number {
  return label.length * LABEL_FONT_PX[textSize] * 0.66 + k.u * 8;
}

// The account's sign-off: a round avatar and the handle, and on the right an icon beside a nudge
// ("Save for later"), all centred on one line `h` tall.
export function handleRow(
  k: Kit,
  y: number,
  h: number,
  right?: { iconId: string; label: string },
  x = 0,
  w = k.box.width,
): Element[] {
  const { u } = k;
  const els: Element[] = [
    { ...k.image(x, y, h, h), borderRadius: 'full', aspectLocked: true },
    k.text(x + h + u * 3, y, right ? w * 0.5 : w - h - u * 3, h, HANDLE, {
      textSize: 'lg',
      textBold: true,
      textAlignY: 'middle',
    }),
  ];
  if (right) {
    const icon = h * 0.62;
    const textW = w * 0.42;
    els.push(
      k.text(x + w - icon - u * 2 - textW, y, textW, h, right.label, {
        textSize: 'lg',
        textAlignX: 'right',
        textAlignY: 'middle',
      }),
      k.shape('icon', x + w - icon, y + (h - icon) / 2, icon, icon, { iconId: right.iconId }),
    );
  }
  return els;
}

// Where each of a column's parts starts: the first at `top`, the last ending at `bottom`, and the
// rest as one block centred in the room between them. The block's parts sit `gap` apart, and on a
// page with room to spare (a story) open up to twice that, so the spare room is shared out rather
// than pooling at either end.
export function spread(top: number, bottom: number, heights: readonly number[], gap: number) {
  const n = heights.length;
  if (n < 3) return heights.map((h, i) => (i === 0 ? top : bottom - h));
  const mid = heights.slice(1, -1);
  const partsH = mid.reduce((s, h) => s + h, 0);
  const roomTop = top + heights[0]!;
  const roomH = bottom - heights[n - 1]! - roomTop;
  const spare = roomH - partsH - gap * (mid.length + 1);
  const g = gap + Math.min(gap, Math.max(0, spare / (mid.length + 1)));
  const blockH = partsH + g * (mid.length - 1);
  let y = roomTop + Math.max(gap, (roomH - blockH) / 2);
  const ys = [top];
  for (const h of mid) {
    ys.push(y);
    y += h + g;
  }
  ys.push(bottom - heights[n - 1]!);
  return ys;
}

// A short accent rule.
export function rule(k: Kit, x: number, y: number): Element {
  return k.shape('square', x, y, k.u * 14, k.u * 1.2, { label: '', borderRadius: 'full' });
}
