// An element's border in the export, drawn the way the canvas draws it
// (docs/specs/020-import-export/export-fidelity.md): the element's own stroke width, dash pattern and
// corner radius (element-variant.ts / BoxBorderOverlay on the canvas), with
// the stroke INSIDE the box as a CSS border sits, rather than a fixed 1.5px
// line centred on the edge at a fixed 6px radius.

import {
  BORDER_DASH_ARRAY,
  BORDER_RADIUS_PX,
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STROKE,
  DEFAULT_BORDER_STYLE,
  DEFAULT_BOX_RADIUS_PX,
  cornerRadiusPx,
} from './border-style';
import type { BoxedElement } from './index';
import { r2, xmlEscape } from './svg-render-primitives';

type Bordered = Pick<BoxedElement, 'x' | 'y' | 'width' | 'height'> & {
  strokeWidth?: keyof typeof BORDER_STROKE_PX;
  strokeStyle?: keyof typeof BORDER_DASH_ARRAY;
  borderRadius?: keyof typeof BORDER_RADIUS_PX;
};

/** The stroke width, dash and radius a shape element's border resolves to. */
export function borderOf(el: Bordered): { width: number; dash: string | null; radius: number } {
  const width = BORDER_STROKE_PX[el.strokeWidth ?? DEFAULT_BORDER_STROKE];
  const dash = BORDER_DASH_ARRAY[el.strokeStyle ?? DEFAULT_BORDER_STYLE];
  const wanted = cornerRadiusPx(el.borderRadius, el.width, el.height, DEFAULT_BOX_RADIUS_PX);
  // CSS clamps a radius to half the shorter side, so 'full' is a pill.
  const radius = Math.min(wanted, Math.min(el.width, el.height) / 2);
  return { width, dash, radius };
}

/** The stroke attributes for a border of `width` / `dash` in `stroke`. */
export function strokeAttrs(stroke: string, width: number, dash: string | null): string {
  if (width <= 0) return ' stroke="none"';
  return (
    ` stroke="${xmlEscape(stroke)}" stroke-width="${r2(width)}"` +
    (dash ? ` stroke-dasharray="${dash}"` : '')
  );
}

/** A rounded box with the element's border inset like a CSS border. */
export function borderedRect(el: Bordered, fill: string, stroke: string, radius?: number): string {
  const b = borderOf(el);
  const r = radius ?? b.radius;
  const inset = b.width / 2;
  return (
    `<rect x="${r2(el.x + inset)}" y="${r2(el.y + inset)}" width="${r2(Math.max(0, el.width - b.width))}"` +
    ` height="${r2(Math.max(0, el.height - b.width))}" rx="${r2(Math.max(0, r - inset))}"` +
    ` fill="${xmlEscape(fill)}"${strokeAttrs(stroke, b.width, b.dash)}/>`
  );
}
