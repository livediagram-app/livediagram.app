// The offset-positioned UI and text factories the storyboard and the Crazy Eights sketches draw
// their panels with. See docs/specs/008-canvas/canvas-and-palette.md "Templates".

import {
  createShape,
  createText,
  type ShapeElement,
  type ShapeKind,
  type TextElement,
} from '@livedocuments/document';
import { TEMPLATE_CONTENT_LAYER_ID } from './template-layers';

type ShapeExtra = Partial<ShapeElement>;
type TextExtra = Partial<TextElement>;

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

// The text counterpart of uiAt: free copy (headings, prices, captions) that
// should read as type on the screen rather than as a labelled box.
export function textAt(ox: number, oy: number) {
  return (
    rx: number,
    ry: number,
    w: number,
    h: number,
    label: string,
    extra: TextExtra = {},
  ): TextElement => ({
    ...createText(ox + rx, oy + ry),
    width: w,
    height: h,
    label,
    textSize: 'sm',
    textAlignX: 'left',
    layerId: TEMPLATE_CONTENT_LAYER_ID,
    ...extra,
  });
}
