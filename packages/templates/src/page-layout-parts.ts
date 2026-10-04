// Parts the compare, social and figures layouts share (docs/specs/007-editor/illustrate-pages.md
// "Layouts"): the source line a figure owes, a row of an icon beside a line, and the two colours
// that carry meaning (a tick is green, a cross rose) rather than following the theme.
import type { Element, TextElement } from '@livediagram/document';
import type { Kit } from './page-layout-kit';

// A tick's green and a cross's rose: the same pair the retrospective and funnel templates use.
export const TICK_GREEN = '#16a34a';
export const CROSS_ROSE = '#e11d48';

// A disc with an icon set in it: a circle and the icon over its middle, half its size.
export function iconDisc(k: Kit, x: number, y: number, d: number, iconId: string) {
  const icon = d * 0.5;
  const disc = k.shape('circle', x, y, d, d, { label: '' });
  return {
    disc,
    els: [disc, k.shape('icon', x + (d - icon) / 2, y + (d - icon) / 2, icon, icon, { iconId })],
  };
}

// The line an infographic owes its numbers: where they came from, at the foot of the page.
export const SOURCE_H = 6;
export function sourceLine(k: Kit, label: string): Element {
  return k.text(0, k.box.height - k.u * SOURCE_H, k.box.width, k.u * SOURCE_H, label);
}

// An icon beside a line of text, centred on the icon; a taller box (`lineH`) leaves the line
// room to wrap onto a second line, still centred on the icon.
export function iconRow(
  k: Kit,
  x: number,
  y: number,
  w: number,
  icon: number,
  iconId: string,
  line: string,
  extra: Partial<TextElement> & { iconColor?: string; lineH?: number } = {},
): Element[] {
  const { iconColor, lineH = icon, ...textExtra } = extra;
  const gap = k.u * 3;
  return [
    k.shape('icon', x, y, icon, icon, iconColor ? { iconId, strokeColor: iconColor } : { iconId }),
    k.text(x + icon + gap, y + (icon - lineH) / 2, w - icon - gap, lineH, line, {
      textAlignY: 'middle',
      ...textExtra,
    }),
  ];
}
