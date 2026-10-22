// The slide layouts' shared parts (docs/specs/007-editor/pages-mode.md "Slide layouts"):
// type sized for reading across a room, the short accent rule, bullet points, cards, numbered
// discs and icon discs. A slide's content box is landscape, so its height is 100 units (a unit
// is its short side over 100) and its width 133 (4:3) to 178 (16:9): every builder lays out in
// those terms, so both shapes fit.
import { LABEL_FONT_PX, type Element } from '@livedocuments/document';
import type { Kit } from './page-layout-kit';

// Body type on a slide: large text scaled so its glyphs stand this many units tall.
export const BODY_UNITS = 4.6;

/** Slide type: large text scaled so its glyphs stand `units` of the box tall, shared with the
 *  slide deck template. */
export function slideType(k: Kit, units = BODY_UNITS): { textSize: 'lg'; textScale: number } {
  return {
    textSize: 'lg',
    textScale: Math.round(((k.u * units) / LABEL_FONT_PX.lg) * 100) / 100,
  };
}

/** A short accent rule: a filled bar in the theme's colour. */
export function rule(k: Kit, x: number, y: number, units = 14): Element {
  return k.shape('square', x, y, k.u * units, k.u * 1.2, { label: '', borderRadius: 'full' });
}

/** A small line over a title, naming what the slide is (an eyebrow). */
export function eyebrow(k: Kit, x: number, y: number, w: number, label: string): Element {
  return k.text(x, y, w, k.u * 6, label, {
    ...slideType(k, 3.2),
    textBold: true,
    textAlignY: 'bottom',
  });
}

/** Bullet points down a column: a dot beside each line, sharing the height they are given. */
export function bullets(
  k: Kit,
  x: number,
  y: number,
  w: number,
  h: number,
  lines: readonly string[],
  units = BODY_UNITS,
): Element[] {
  const { u } = k;
  const rowH = Math.min(h / lines.length, u * 14);
  const dot = u * 2.2;
  return lines.flatMap((line, i) => {
    const top = y + i * rowH;
    return [
      k.shape('circle', x, top + (rowH - dot) / 2, dot, dot, { label: '' }),
      k.text(x + dot + u * 3, top, w - dot - u * 3, rowH, line, {
        ...slideType(k, units),
        textAlignY: 'middle',
      }),
    ];
  });
}

/** A card: a rounded filled box, nothing on it yet (what goes on it is placed over it). */
export function card(k: Kit, x: number, y: number, w: number, h: number): Element {
  return k.shape('square', x, y, w, h, { label: '', borderRadius: 'lg' });
}

/** Words set over a shape, centred both ways: a shape's own label takes no slide-sized type
 *  (textScale is a text element's), so a slide sets its words as text over the shape. */
export function over(
  k: Kit,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  units: number,
  bold = true,
): Element {
  return k.text(x, y, w, h, label, {
    ...slideType(k, units),
    textBold: bold,
    textAlignX: 'center',
    textAlignY: 'middle',
  });
}

/** A numbered disc: a circle with its number set over it, bold, about half its height. */
export function numberDisc(k: Kit, x: number, y: number, d: number, n: string): Element[] {
  return [
    k.shape('circle', x, y, d, d, { label: '' }),
    over(k, x, y, d, d, n, Math.max(3, d / k.u / 2.4)),
  ];
}

/** A disc with an icon set in it, the icon half its size. */
export function iconDisc(k: Kit, x: number, y: number, d: number, iconId: string): Element[] {
  const icon = d * 0.5;
  return [
    k.shape('circle', x, y, d, d, { label: '' }),
    k.shape('icon', x + (d - icon) / 2, y + (d - icon) / 2, icon, icon, { iconId }),
  ];
}

/** A slide's title at the top: a headline sized to its box, and how far down the rest starts. */
export function slideHeading(
  k: Kit,
  label: string,
  lead?: string,
): { els: Element[]; top: number } {
  const { u } = k;
  const h = u * 11;
  const els: Element[] = [k.title(0, 0, k.box.width * 0.86, h, label)];
  if (!lead) return { els, top: h + u * 7 };
  els.push(k.text(0, h + u * 1.5, k.box.width * 0.86, u * 8, lead, slideType(k, 4)));
  return { els, top: h + u * 14 };
}

/** Evenly split `total` into `n` parts with `gap` between them: each part's start and size. */
export function columns(total: number, n: number, gap: number): { at: number; size: number }[] {
  const size = (total - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({ at: i * (size + gap), size }));
}

/** A picture set to the page's edges on the sides it touches (`x`, `y`, `w`, `h` may reach past
 *  the box by its bleed), square-cornered so it meets the page's own edge cleanly. */
export function bleedImage(k: Kit, x: number, y: number, w: number, h: number): Element {
  return { ...k.image(x, y, w, h), borderRadius: 'none' };
}

/** A filled panel set to the page's edges: the theme's fill, square-cornered, no outline (an edge
 *  drawn down the slide would read as a stray line), nothing on it. */
export function bleedPanel(k: Kit, x: number, y: number, w: number, h: number): Element {
  return k.shape('square', x, y, w, h, {
    label: '',
    borderRadius: 'none',
    strokeColor: 'transparent',
  });
}
