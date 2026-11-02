// A table's header band and the ink written on it (docs/specs/008-canvas/canvas-and-palette.md Table): one answer
// for the canvas's TableView and the headless table emitter, so a header reads the same on screen and in
// every export. The band follows the surface the table is drawn on, the same surface its cell text follows,
// so a dark page gets a dark band under light ink rather than a light band under white ink.
import {
  colourIsOpaque,
  defaultStrokeColor,
  defaultTextColor,
  normaliseHex,
  type CanvasSurface,
} from './colors';
import { readableInk } from './cell-colours';
import { mixHex } from './svg-render-face-kit';
import type { TableElement } from './index';

/** The grid stroke's share of the default header band (an opaque 18% tint). */
const TABLE_HEADER_TINT = 0.18;

/** What a table with no cell fill of its own sits on, per surface: white paper, or the dark-ink shape fill. */
export const TABLE_HEADER_BASE: Record<CanvasSurface, string> = {
  light: '#ffffff',
  dark: '#141b26',
};

// An opaque colour as `#rrggbb` (a shorthand or named one too: docs/specs/011-theme/light-and-dark.md "Colours an
// agent writes"), else undefined: a translucent or unreadable fill shows what is under it.
const opaqueHex = (c: string | undefined): string | undefined =>
  c && colourIsOpaque(c) ? (normaliseHex(c) ?? undefined) : undefined;

type TableHeaderColours = {
  /** The band's fill: a colour, or 'transparent' when the table asks for no band. */
  fill: string;
  /** The header text colour, meeting AA against what is behind it. */
  ink: string;
};

/** The header band and its ink for `el` drawn on `surface`. */
export function tableHeaderColours(
  el: TableElement,
  surface: CanvasSurface = 'light',
): TableHeaderColours {
  const stroke = el.strokeColor ?? defaultStrokeColor(el, surface);
  const text = el.textColor ?? defaultTextColor(el, surface);
  // Under the band: the cells' own fill when it is a colour, else the paper.
  const base = opaqueHex(el.fillColor) ?? TABLE_HEADER_BASE[surface];
  const strokeHex = normaliseHex(stroke);
  const fill = el.headerFill ?? (strokeHex ? mixHex(strokeHex, base, TABLE_HEADER_TINT) : base);
  // A transparent (or unreadable) band shows what is under it, so the ink is checked against that.
  const behind = opaqueHex(fill) ?? base;
  return { fill, ink: readableInk(el.headerTextColor ?? text, behind) };
}
