// The logo layouts' shared kit (docs/specs/007-editor/logo-pages.md "Logo layouts"): the
// placeholder mark, wordmark type sized to the safe area, a tagline, a rule, an icon, arched text,
// and rows stacked and centred down the artboard.
import { LABEL_FONT_PX, type Element, type TextElement } from '@livediagram/document';
import type { Kit } from './page-layout-kit';

// The placeholder mark: a name, a second word, its initials, a tagline and an icon.
export const NAME = 'Brand';
export const SECOND = 'Studio';
export const INITIALS = 'BR';
export const TAGLINE = 'Your tagline here';
export const ICON = 'zap';

/** Wordmark type centred in its box: large text scaled so its glyphs stand `size` of the box's
 *  side tall (a share of the safe area), with the wordmark fields given. */
export function word(
  k: Kit,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  size: number,
  extra: Partial<TextElement> = {},
): TextElement {
  const px = k.box.width * size;
  return k.text(x, y, w, h, label, {
    textSize: 'lg',
    textScale: Math.round((px / LABEL_FONT_PX.lg) * 100) / 100,
    textAlignX: 'center',
    textAlignY: 'middle',
    padding: 'none',
    ...extra,
  });
}

// The tagline under a name: small capitals, tracked wide.
export function tagline(k: Kit, y: number, size = 0.035): TextElement {
  const S = k.box.width;
  return word(k, 0, y, S, S * size * 1.8, TAGLINE, size, {
    textCase: 'upper',
    letterSpacing: 0.25,
    fontWeight: 500,
  });
}

// A short accent rule centred on the artboard.
export function rule(k: Kit, y: number, width: number): Element {
  const S = k.box.width;
  return k.shape('square', (S - width) / 2, y, width, S * 0.012, {
    label: '',
    borderRadius: 'full',
  });
}

// A plain icon, centred on x.
export function icon(k: Kit, cx: number, y: number, d: number): Element {
  return k.shape('icon', cx - d / 2, y, d, d, { iconId: ICON });
}

/** Rows stacked down the artboard and the stack centred in it: each row its height and the gap
 *  before the next, built at its own top. */
export function stacked(
  k: Kit,
  rows: readonly { h: number; gap?: number; make: (y: number) => Element[] }[],
): Element[] {
  const total = rows.reduce((sum, r, i) => sum + r.h + (i < rows.length - 1 ? (r.gap ?? 0) : 0), 0);
  let y = (k.box.height - total) / 2;
  return rows.flatMap((r) => {
    const els = r.make(y);
    y += r.h + (r.gap ?? 0);
    return els;
  });
}

// Arched text round the artboard's centre: its baseline `radius` from the centre (a share of the
// safe area's side), over the top (arc > 0) or under the bottom (arc < 0). The box is the square
// the arc's circle is fitted to (wordmark.ts arcGeometry), so it is sized to put the baseline there.
export function arched(
  k: Kit,
  label: string,
  radius: number,
  size: number,
  arc: number,
  extra: Partial<TextElement> = {},
): TextElement {
  const S = k.box.width;
  const room = arc > 0 ? 0.8 : 0.25;
  const side = 2 * (radius + room * size) * S;
  const at = (S - side) / 2;
  return word(k, at, at, side, side, label, size, {
    textCase: 'upper',
    textArc: arc,
    ...extra,
  });
}
