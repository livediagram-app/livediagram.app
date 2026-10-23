// The offset-positioned UI factory the storyboard draws its panels with. See docs/specs/008-canvas/canvas-and-palette.md "Templates".

import { createShape, type ShapeElement, type ShapeKind } from '@livedocuments/document';
import { TEMPLATE_CONTENT_LAYER_ID } from './template-layers';

type ShapeExtra = Partial<ShapeElement>;

// A UI factory positioned relative to (ox, oy): the display's or screen's
// top-left. Everything it makes is content, so it can be rearranged with
// its frame locked.
export function uiAt(ox: number, oy: number) {
  return (
    kind: ShapeKind,
    rx: number,
    ry: number,
    w: number,
    h: number,
    extra: ShapeExtra = {},
  ): ShapeElement => ({
    ...createShape(kind, ox + rx, oy + ry),
    width: w,
    height: h,
    layerId: TEMPLATE_CONTENT_LAYER_ID,
    ...extra,
  });
}
