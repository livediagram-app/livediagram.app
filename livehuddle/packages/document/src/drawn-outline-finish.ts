// An image's edge drawn on purpose in its finish (docs/specs/008-canvas/finish.md "Images"): the photo stays as it
// is, and a pencil or marker line goes round it as a shape's outline does.
import {
  BORDER_DASH_ARRAY,
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STYLE,
  IMAGE_DEFAULT_RADIUS_PX,
  cornerRadiusPx,
  type BorderStroke,
} from '@liveworkspace/model-core/border-style';
import { MARKER_LINE_PX, finishBorderStroke, finishCornerFallbackPx, type Finish } from './finish';
import type { ImageElement } from './index';
import { markerStrokes } from './marker';
import type { MarkerDrawing } from './marker-element';
import { outlineOfEllipse, outlineOfRect, sketchSeed, sketchStrokes } from './sketch';
import type { SketchDrawing } from './sketch-element';

/** An outline's line width in its finish, px: a picked border wins; unset draws Professional's Thin, and Marker's
 *  nib for unset or Thin. */
export function outlineStrokePx(el: { strokeWidth?: BorderStroke }, finish: Finish): number {
  if (finish === 'marker' && (!el.strokeWidth || el.strokeWidth === 'thin')) return MARKER_LINE_PX;
  return BORDER_STROKE_PX[finishBorderStroke(el.strokeWidth, finish)];
}

type HandDrawnOutline =
  | { drawing: SketchDrawing; strokePx: number; dash: string | null }
  | { drawing: MarkerDrawing; strokePx: number; dash: string | null };

/** An image's corner in its finish: its own, else the image default, square under Professional. */
export function imageCornerPx(
  el: Pick<ImageElement, 'borderRadius' | 'width' | 'height'>,
  finish: Finish,
): number {
  return cornerRadiusPx(
    el.borderRadius,
    el.width,
    el.height,
    finishCornerFallbackPx(IMAGE_DEFAULT_RADIUS_PX, finish),
  );
}

/** An image's edge drawn by hand (docs/specs/008-canvas/finish.md "Images"): the photo stays as it is, a pencil or a
 *  marker line goes round it, a circle round an avatar. Line only, no fill: null in another finish. */
export function handDrawnImagePaint(el: ImageElement, finish: Finish): HandDrawnOutline | null {
  if (finish !== 'sketch' && finish !== 'marker') return null;
  const strokePx = outlineStrokePx(el, finish);
  const inset = strokePx / 2;
  const w = el.width - strokePx;
  const h = el.height - strokePx;
  if (w <= 0 || h <= 0) return null;
  const outline =
    el.borderRadius === 'full'
      ? outlineOfEllipse(el.width / 2, el.height / 2, w / 2, h / 2)
      : outlineOfRect(inset, inset, w, h, Math.max(0, imageCornerPx(el, finish) - inset));
  const seed = sketchSeed(el.id);
  const dash = BORDER_DASH_ARRAY[el.strokeStyle ?? DEFAULT_BORDER_STYLE] ?? null;
  if (finish === 'marker')
    return {
      drawing: {
        pen: 'marker',
        ink: markerStrokes(outline, seed),
        details: '',
        solid: '',
        streaks: ['', ''],
        nibPx: 0,
      },
      strokePx,
      dash,
    };
  return {
    drawing: {
      pen: 'pencil',
      strokes: sketchStrokes(outline, seed),
      details: '',
      hatch: '',
      solid: '',
    },
    strokePx,
    dash,
  };
}
