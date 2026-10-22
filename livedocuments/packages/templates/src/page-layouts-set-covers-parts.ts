// Parts the Covers set shares (docs/specs/007-editor/pages-mode.md "Layouts"): the
// typographic pieces a cover is made of (a tracked capitals line, a headline fitted over a number of
// lines, an accent rule, a hairline, a double frame) and a labelled field. Every piece is theme
// painted: an accent rule is a banner with no words, a hairline and a frame are strokes only.
import { LABEL_FONT_PX, type Element, type TextElement } from '@livedocuments/document';
import type { Kit } from './page-layout-kit';

// Tracking on a capitals line, in em.
const KICKER_TRACKING = 0.14;
// A kicker line's height, in units.
export const KICKER_H = 5;
// A wrapped headline: line height as a share of its type size, and a bold glyph's mean advance as
// a share of the size (generous, so a line never wraps more often than planned).
const LINE_HEIGHT = 1.28;
const WRAP_GLYPH = 0.56;
// The characters a wrapped line is assumed to lose at its break.
const WRAP_SLACK = 3;
// A fitted line is sized against this share of its box, so wide glyphs (£, m, W) never wrap it.
const FIT_SLACK = 0.85;

type Align = 'left' | 'center' | 'right';

// A line of tracked capitals: an eyebrow, a label over a field, a masthead's small print.
export function kicker(
  k: Kit,
  x: number,
  y: number,
  w: number,
  label: string,
  extra: Partial<TextElement> = {},
): TextElement {
  return k.text(x, y, w, k.u * KICKER_H, label, {
    textBold: true,
    textCase: 'upper',
    letterSpacing: KICKER_TRACKING,
    textAlignY: 'middle',
    ...extra,
  });
}

// A bold headline set over `lines` lines, its type scaled to the most its box takes.
export function headline(
  k: Kit,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  lines: number,
  align: Align = 'left',
): TextElement {
  const perLine = label.length / lines + WRAP_SLACK;
  const fontPx = Math.min(h / (lines * LINE_HEIGHT), w / (perLine * WRAP_GLYPH));
  return k.text(x, y, w, h, label, {
    textSize: 'lg',
    textScale: Math.round((fontPx / LABEL_FONT_PX.lg) * 100) / 100,
    textBold: true,
    textAlignX: align,
    textAlignY: 'top',
  });
}

// One line fitted to its box (Kit.title), aligned as asked; tracked letters take their room.
export function fitted(
  k: Kit,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  align: Align = 'left',
  tracking = 0,
): TextElement {
  // Kit.title sizes for its glyph width; tracking widens every glyph, so it gets a narrower box.
  const t = k.title(x, y, (w * FIT_SLACK) / (1 + tracking / 0.6), h, label);
  return {
    ...t,
    x: Math.round(k.box.x + x),
    width: Math.round(w),
    textAlignX: align,
    ...(tracking ? { letterSpacing: tracking } : {}),
  };
}

// A solid accent rule: a banner with no words, in the theme's accent.
export function rule(k: Kit, x: number, y: number, w: number, h = k.u * 1.2): Element {
  return k.shape('banner', x, y, w, h, { label: '', pageSubtitle: '' });
}

// A hairline across: a stroke only, in the theme's line colour.
export function hairline(k: Kit, x: number, y: number, w: number): Element {
  return k.shape('square', x, y, w, 1, {
    label: '',
    fillColor: 'transparent',
    strokeWidth: 'thin',
    borderRadius: 'none',
  });
}

// A hairline down, for dividing columns.
export function vline(k: Kit, x: number, y: number, h: number): Element {
  return k.shape('square', x, y, 1, h, {
    label: '',
    fillColor: 'transparent',
    strokeWidth: 'thin',
    borderRadius: 'none',
  });
}

// An open rectangle: a stroke round the box, nothing inside it painted.
export function outline(
  k: Kit,
  x: number,
  y: number,
  w: number,
  h: number,
  stroke: 'thin' | 'medium' | 'thick' = 'thin',
): Element {
  return k.shape('square', x, y, w, h, {
    label: '',
    fillColor: 'transparent',
    strokeWidth: stroke,
    borderRadius: 'none',
  });
}

// The classic double rule round a certificate or a book's jacket: a heavier outer line and a fine
// one inset from it.
export function doubleFrame(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const inset = k.u * 2.4;
  return [outline(k, 0, 0, W, H, 'thick'), outline(k, inset, inset, W - 2 * inset, H - 2 * inset)];
}

// A tinted panel behind a group: the theme's element fill, no stroke.
export function panel(k: Kit, x: number, y: number, w: number, h: number): Element {
  return k.shape('square', x, y, w, h, { label: '', strokeWidth: 'none', borderRadius: 'md' });
}

// A labelled field: a hairline, a tracked label, its value and a note under it (a proposal's
// details). Takes FIELD_H units.
export const FIELD_H = 22;
export function field(
  k: Kit,
  x: number,
  y: number,
  w: number,
  [label, value, note]: readonly [string, string, string],
): Element[] {
  const { u } = k;
  return [
    hairline(k, x, y, w),
    kicker(k, x, y + u * 2.5, w, label),
    k.text(x, y + u * 8.5, w, u * 7, value, {
      textSize: 'lg',
      textBold: true,
      textAlignY: 'middle',
    }),
    k.text(x, y + u * 15.5, w, u * 6, note, { textAlignY: 'middle' }),
  ];
}

// A figure over its caption, for a cover's row of highlights. Takes FIGURE_H units.
export const FIGURE_H = 21;
export function figure(
  k: Kit,
  x: number,
  y: number,
  w: number,
  value: string,
  caption: string,
): Element[] {
  const { u } = k;
  return [
    fitted(k, x, y, w, u * 10, value),
    k.text(x, y + u * 10.5, w, u * 10.5, caption, { textAlignY: 'top' }),
  ];
}
