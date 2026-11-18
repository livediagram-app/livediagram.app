// Whether a text colour reads where the words sit (each product's docs/specs/004-interface-design/colour-picker.md
// "Reading on its ground"): what the text is judged against (its own fill, a box under it, a table cell's fill, its
// page or its canvas), the WCAG 2.2 SC 1.4.3 target for its size, and the nearest shade of the same hue that reaches
// it. Built on re-inking's maths (page-ink-contrast, page-ink-rules), so the hint and a page's re-inking agree on
// every ratio. Pure. One copy for every product; each binds `textGroundIn` to what lies under its elements (its pages,
// or its canvas) at its own text-contrast.ts.
import { labelFontPx } from '@liveworkspace/model-core/label-font';
import { tableCellFontPx } from '@liveworkspace/model-core/table-cell-font';
import { normaliseHex, type CanvasSurface } from './colour-math';
import { isBoxed, type BoxedElement, type Element, type TableElement } from './element';
import { defaultStrokeColor } from './element-colours';
import { inkToward, isOpaqueHex, mixHex, worstContrast } from './page-ink-contrast';
import { boxFill, inkKindOf, keptCover } from './page-ink-rules';
import { tableHeaderColours } from './table-header-colours';

// WCAG 2.2 SC 1.4.3 (AA): normal text, and large text.
export const TEXT_CONTRAST = 4.5;
export const LARGE_TEXT_CONTRAST = 3;
// WCAG's large text: 18pt, or 14pt in bold, at 0.75pt a px.
export const LARGE_TEXT_PX = 24;
export const LARGE_BOLD_TEXT_PX = 18.66;
// A zebra table's banded rows: its grid colour at this alpha over the cells' fill (TableCellView's `${stroke}11`).
export const ZEBRA_TINT = 0x11 / 0xff;

/** Whether text of `px` (as drawn) is large text under WCAG 2.2. */
export function isLargeText(px: number, bold: boolean): boolean {
  return px >= LARGE_TEXT_PX || (bold && px >= LARGE_BOLD_TEXT_PX);
}

type Labelled = {
  type: string;
  textSize?: Parameters<typeof labelFontPx>[0];
  textScale?: number;
  textBold?: boolean;
  fontWeight?: number;
};

/** The px a label draws at: its size on its scale (a sticky note's runs smaller), times the scale a text or a shape
 *  stores (`textScale`, each product's label-text-scale.ts). */
export function labelDrawnPx(el: Labelled): number {
  const scale = el.type === 'text' || el.type === 'shape' ? (el.textScale ?? 1) : 1;
  return labelFontPx(el.textSize, el.type === 'sticky') * scale;
}

/** Whether a label paints bold: its weight while set, else its Bold toggle. */
export function labelIsBold(el: Labelled): boolean {
  return el.fontWeight !== undefined ? el.fontWeight >= 700 : el.textBold === true;
}

/** What text sits on: every tone under it (text must read on the worst) and what makes them. */
export type TextGround = { tones: string[]; on: 'page' | 'canvas' | 'shape' | 'card' | 'cell' };

/** What lies under a box with nothing painted under it: a page's tones, or the canvas; null where that can't be
 *  judged (a picture, off every page). */
export type GroundBelow = (box: {
  x: number;
  y: number;
  width: number;
  height: number;
}) => TextGround | null;

// A box's own surface under its label: its opaque fill (a shape, a closed path, a sticky or link card); null when it
// draws none, so the label reads on what is under the box.
function ownFill(el: BoxedElement, surface: CanvasSurface): string | null {
  if (inkKindOf(el) === 'box') return boxFill(el, surface);
  const kept = keptCover(el, surface);
  return typeof kept === 'string' ? kept : null;
}

const holds = (b: BoxedElement, p: { x: number; y: number }) =>
  p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

/**
 * What the element's label is read against: its own fill; else the topmost element painted before it (in `painted`,
 * the tab's paint order) whose box holds its centre and covers it (a filled box, a sticky note); else `below` its
 * box. Null where that can't be judged: a picture or widget under it, or nothing `below`.
 */
export function textGroundIn(
  el: BoxedElement,
  painted: readonly Element[],
  surface: CanvasSurface,
  below: GroundBelow,
): TextGround | null {
  const own = ownFill(el, surface);
  if (own) return { tones: [own], on: 'shape' };
  const centre = { x: el.x + el.width / 2, y: el.y + el.height / 2 };
  const at = painted.findIndex((e) => e.id === el.id);
  for (let i = at - 1; i >= 0; i -= 1) {
    const under = painted[i]!;
    if (!isBoxed(under) || !holds(under, centre)) continue;
    const fill = ownFill(under, surface);
    if (fill) return { tones: [fill], on: 'card' };
    // A surface of its own whose tone isn't known (a picture, a widget): nothing to judge.
    if (inkKindOf(under) === 'keep' && keptCover(under, surface) === null) return null;
  }
  return below({ x: el.x, y: el.y, width: el.width, height: el.height });
}

/** Whether cell (r, c) is in the table's header row or column. */
export function isHeaderCell(table: TableElement, r: number, c: number): boolean {
  return (table.headerRow === true && r === 0) || (table.headerColumn === true && c === 0);
}

/**
 * What a table cell's words sit on, as TableCellView paints it: the cell's own background; else, in a header, the
 * header band; else the table's fill (a zebra row tinted with its grid colour); else `under`, what is under the
 * table (its page, its canvas, a box). Null where that can't be judged.
 */
export function cellTextGround(
  table: TableElement,
  r: number,
  c: number,
  surface: CanvasSurface,
  under: TextGround | null,
): TextGround | null {
  const own = table.cellStyles?.[r]?.[c]?.bg;
  if (isOpaqueHex(own)) return { tones: [own], on: 'cell' };
  if (isHeaderCell(table, r, c)) {
    const band = tableHeaderColours(table, surface).fill;
    if (isOpaqueHex(band)) return { tones: [band], on: 'cell' };
  }
  const fill = isOpaqueHex(table.fillColor) ? table.fillColor : null;
  const bodyRow = table.headerRow ? r - 1 : r;
  const zebra = table.zebra === true && !isHeaderCell(table, r, c) && bodyRow % 2 === 1;
  const stroke = normaliseHex(table.strokeColor ?? defaultStrokeColor(table, surface));
  if (fill)
    return { tones: [zebra && stroke ? mixHex(fill, stroke, ZEBRA_TINT) : fill], on: 'cell' };
  if (!under) return null;
  if (!zebra || !stroke) return under;
  return { tones: under.tones.map((t) => mixHex(t, stroke, ZEBRA_TINT)), on: under.on };
}

/** The px a cell's words draw at, and whether they are bold: its own size and weight, else the table's (a header's
 *  words are bold). */
export function cellTextSize(
  table: TableElement,
  r: number,
  c: number,
): { px: number; bold: boolean } {
  const look = table.cellStyles?.[r]?.[c];
  const rows = table.cells?.length ?? 1;
  const rowH = table.height / Math.max(1, rows);
  const px = tableCellFontPx(look?.textSize ?? table.textSize, rowH);
  const bold = look?.bold ?? (isHeaderCell(table, r, c) || table.textBold === true);
  return { px, bold };
}

export type TextContrast = {
  // The worst ratio against the ground's tones, and the tone it is worst on.
  ratio: number;
  tone: string;
  // The target for this size of text.
  needed: number;
  passes: boolean;
  // The nearest shade of the same hue that reaches `needed`, while it falls short; null when it passes or no shade
  // of its hue does.
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
