// Text draw.io sizes to itself (docs/specs/020-import-export/blueprints/drawio-import.md step 15.3):
// a text cell with no width or no height is drawn about its point, as wide and tall as its text.
// Its box here is the text's own: its longest line in the label face with a character to spare
// and its lines at the label line height, each plus the label padding, placed about the point by
// `align` and `verticalAlign`. A size the cell does have is kept.

import { PADDING_PX, labelFontPx } from '@livediagram/document';
import type { DrawioCell, Rect } from './cells';
import { cellLabel } from './label';
import { DRAWIO_DEFAULT_FONT_PX } from './scale';
import { LABEL_LINE_HEIGHT, elementTextSize, labelTextWidth } from './text-size';

/** Whether draw.io sizes the cell's box to its text: it has no width or no height. */
export const isAutoSized = (rect: Rect) => rect.width === 0 || rect.height === 0;

/** The box of a text cell draw.io sizes to its text, in draw.io units at the page `scale`. */
export function autoTextRect(cell: DrawioCell, rect: Rect, scale: number): Rect {
  const lines = cellLabel(cell).plain.split('\n');
  const px = labelFontPx(
    elementTextSize(cell.style.num('fontSize') ?? DRAWIO_DEFAULT_FONT_PX, 'label'),
  );
  const chars = Math.max(...lines.map((l) => l.length)) + 1;
  const width = rect.width || (labelTextWidth(chars, px) + 2 * PADDING_PX.sm) / scale;
  const height = rect.height || (lines.length * px * LABEL_LINE_HEIGHT + 2 * PADDING_PX.sm) / scale;
  const align = cell.style.str('align') ?? 'center';
  const valign = cell.style.str('verticalAlign') ?? 'middle';
  const x =
    rect.width || align === 'left'
      ? rect.x
      : align === 'right'
        ? rect.x - width
        : rect.x - width / 2;
  const y =
    rect.height || valign === 'top'
      ? rect.y
      : valign === 'bottom'
        ? rect.y - height
        : rect.y - height / 2;
  return { x, y, width, height };
}
