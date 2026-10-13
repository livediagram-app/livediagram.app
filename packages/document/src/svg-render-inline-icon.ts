// A shape's inline icon in an export (docs/specs/008-canvas/canvas-and-palette.md "Icons inside shapes"): the glyph a box
// wears beside (or above / below) its label, as the canvas lays it out in ShapeInlineIconLayout. The canvas drew it
// and every export left it out, so a flowchart template's cart and card glyphs, and an agent's preview, came out
// bare. The metrics are shared with the canvas so the two agree on where the icon is.

import { LABEL_FONT_PX } from './label-font';
import { labelMeasure, wrapLabel } from './svg-render-primitives';
import type { ExportIconArt } from './svg-render-describe';
import type { ExportLabel } from './svg-render-labels';
import { svgIconShape } from './svg-render-image-icon';
import type { IconPosition, ShapeElement, TextSize } from './index';

/**
 * The inline icon layout's sizes, shared with the canvas (ShapeInlineIconLayout) and the element indicators'
 * content estimate (docs/specs/008-canvas/element-indicators.md) so all agree on where the icon is.
 */
export function inlineIconMetrics(
  element: { width: number; height: number },
  label: string,
  textSize: TextSize,
): { fontSize: number; iconSize: number; elementIconSize: number } {
  // Fixed sizes are the label's own; 'scale' has no fixed px, so a reasonable size follows the box.
  const fontSize =
    textSize === 'scale'
      ? Math.max(12, Math.min(element.height * 0.26, 26))
      : LABEL_FONT_PX[textSize];
  // Element-proportional size: a fraction of the shorter side, clamped so it's neither a speck nor dominant. The
  // ceiling, and the size itself for an icon with no label.
  const elementIconSize = Math.max(
    16,
    Math.min(Math.min(element.width, element.height) * 0.32, 48),
  );
  // With a label the glyph follows the label's size, still capped by the box so it can't overflow a small shape.
  const iconSize = label.trim()
    ? Math.max(16, Math.min(fontSize * 1.6, elementIconSize))
    : elementIconSize;
  return { fontSize, iconSize, elementIconSize };
}

/** The gap between the inline icon and its label. */
export function inlineIconGap(iconSize: number, row: boolean): number {
  return row ? Math.max(8, Math.round(iconSize * 0.32)) : Math.round(iconSize * 0.2);
}

// The line height a wrapped export label sets at, as svgWrappedLabel does.
const LINE_EM = 1.2;

// The icon's markup and the label moved aside for it: one group of icon and text, aligned in the box as the label
// alone would be. Without a label the icon sits alone where the label would have.
export function inlineIconLayout(
  el: ShapeElement,
  label: ExportLabel | null,
  art: ExportIconArt,
  stroke: string,
  textSize: TextSize,
): { icon: string; label: ExportLabel | null } {
  const position: IconPosition = el.iconPosition ?? 'left';
  const row = position === 'left' || position === 'right';
  const iconFirst = position === 'left' || position === 'above';
  const { iconSize } = inlineIconMetrics(el, label?.text ?? '', textSize);
  const gap = inlineIconGap(iconSize, row);
  const draw = (x: number, y: number) =>
    svgIconShape({ ...el, x, y, width: iconSize, height: iconSize, label: '' }, art, stroke);
  if (!label) {
    return {
      icon: draw(el.x + (el.width - iconSize) / 2, el.y + (el.height - iconSize) / 2),
      label,
    };
  }
  const measure = labelMeasure(label.size, label.bold, label.italic, label.fontFamily);
  // Left / centre / right: where a group of `w` starts, as the label alone would be aligned.
  const startX = (w: number) =>
    label.anchor === 'start' ? label.x : label.anchor === 'end' ? label.x - w : label.x - w / 2;
  if (row) {
    const room = Math.max(8, label.maxWidth - iconSize - gap);
    const lines = wrapLabel(label.text, room, measure, true);
    const textW = Math.min(room, Math.max(...lines.map(measure)));
    const x0 = startX(iconSize + gap + textW);
    const iconX = iconFirst ? x0 : x0 + textW + gap;
    const textX = iconFirst ? x0 + iconSize + gap : x0;
    // `y` is the block's centre, or its first or last line when hung from the top or bottom: the icon sits on it.
    return {
      icon: draw(iconX, label.y - iconSize / 2),
      label: { ...label, x: textX + textW / 2, anchor: 'middle', maxWidth: textW },
    };
  }
  const lines = wrapLabel(label.text, label.maxWidth, measure, true);
  const textH = lines.length * label.size * LINE_EM;
  const groupH = iconSize + gap + textH;
  // The group centred where the label's block was, or hung from its top / bottom.
  const top =
    label.valign === 'top'
      ? label.y - label.size / 2
      : label.valign === 'bottom'
        ? label.y + label.size / 2 - groupH
        : label.y - groupH / 2;
  const iconY = iconFirst ? top : top + textH + gap;
  const textMid = iconFirst ? top + iconSize + gap + textH / 2 : top + textH / 2;
  const iconX = startX(iconSize);
  return {
    icon: draw(iconX, iconY),
    label: { ...label, y: textMid, valign: 'middle' },
  };
}
