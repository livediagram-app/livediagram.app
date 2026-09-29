// A record box's geometry (docs/specs/009-elements/entity.md), one copy for everything that draws or
// sizes one: the canvas (EntityView), the SVG export (svgEntityRows), graph
// authoring and the MCP (a box tall enough for its rows).

import { labelFontPx } from './label-font';
import type { TextSize } from './index';

// A field row: an 11 px name at the `leading-tight` 1.25, with a 3 px gap
// between rows, inside 6 px of padding above and below the list.
export const ENTITY_ROW_TEXT_PX = 11 * 1.25;
export const ENTITY_ROW_GAP_PX = 3;
export const ENTITY_BODY_PAD_PX = 6;

/**
 * Height of the title bar, which has to follow the TITLE's size.
 *
 * It was a flat 30px, which is right for the default 16px label and wrong for
 * every other setting: at `lg` the title is a 32px font and simply overflowed
 * the band, so the rule cut through the text instead of sitting under it.
 *
 * Same px table the label itself uses, so the two can't disagree, times the
 * `leading-tight` line height, plus the label's own vertical padding. The 30px
 * floor keeps existing diagrams at the default size pixel-identical.
 */
export function entityHeaderHeight(textSize: TextSize | undefined): number {
  return Math.max(30, Math.round(labelFontPx(textSize ?? 'scale') * 1.25) + 10);
}

// The height that shows every row and no more: the title bar, the list's
// padding, the rows and the gaps between them. Rows past the box are not drawn,
// so a shorter box silently loses fields.
export function entityHeight(rows: number, textSize: TextSize | undefined): number {
  const list =
    rows > 0
      ? rows * ENTITY_ROW_TEXT_PX + (rows - 1) * ENTITY_ROW_GAP_PX + 2 * ENTITY_BODY_PAD_PX
      : 0;
  return Math.ceil(entityHeaderHeight(textSize) + list);
}
