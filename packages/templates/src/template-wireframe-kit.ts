// Shared parts for the device wireframes (mobile, laptop, web page): the
// offset-positioned UI + text factories every screen is drawn with (the slide
// deck and storyboard draw their panels with them too), and the annotation
// grammar the mobile and web page wireframes use to explain themselves. See docs/specs/008-canvas/canvas-and-palette.md "Templates".
//
// Annotation grammar: a small bold numbered PIN sits on the part of the UI a
// remark is about, and a yellow NOTE in a rail beside the device repeats the
// same number, so the reader matches them the way design hand-offs do. Pins
// and notes are content (they move with the UI); the rail heading is scaffold.

import {
  createShape,
  createSticky,
  createText,
  type Element,
  type ShapeElement,
  type ShapeKind,
  type TextElement,
} from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

export const WIREFRAME_MUTED = '#64748b';

// The annotation note sticky: amber, like a paper note stuck on the print.
export const ANNOTATION_NOTE = { fill: '#fde68a', text: '#451a03' } as const;

// Pin diameter: big enough for a two-digit number, small enough to perch on
// a 36px control without hiding it.
export const ANNOTATION_PIN = 28;

type ShapeExtra = Partial<ShapeElement>;
type TextExtra = Partial<TextElement>;

// A UI factory positioned relative to (ox, oy): the display's or screen's
// top-left. Everything it makes is content, so the UI can be rearranged
// with the device frame locked.
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

// A numbered annotation pin centred on (x, y).
export function annotationPin(n: number, x: number, y: number): ShapeElement {
  return {
    ...createShape('circle', x - ANNOTATION_PIN / 2, y - ANNOTATION_PIN / 2),
    width: ANNOTATION_PIN,
    height: ANNOTATION_PIN,
    label: `${n}`,
    textSize: 'sm',
    textBold: true,
    colorPreset: 'bold',
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  };
}

// Title + a one-line muted how-to above a wireframe.
export function wireframeHeading(
  x: number,
  y: number,
  w: number,
  title: string,
  caption: string,
): Element[] {
  return [
    {
      ...createText(x, y),
      width: w,
      height: 44,
      label: title,
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    },
    {
      ...createText(x, y + 44),
      width: w,
      height: 28,
      label: caption,
      textSize: 'sm',
      textColor: WIREFRAME_MUTED,
      textAlignX: 'left',
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    },
  ];
}

// Height the heading block above takes, plus the gap before the device.
export const WIREFRAME_HEADING_H = 44 + 28 + 28;

// The notes rail: a heading, then one amber note per remark, each led by its
// number on a pin just left of the note (the same pin the UI wears). Notes
// stack from `y` with a fixed pitch.
export function annotationRail(
  x: number,
  y: number,
  w: number,
  noteH: number,
  notes: readonly string[],
): Element[] {
  const gap = 18;
  const headingH = 40;
  const out: Element[] = [
    {
      ...createText(x, y),
      width: w,
      height: headingH,
      label: 'Notes',
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    },
  ];
  notes.forEach((text, i) => {
    const ny = y + headingH + 8 + i * (noteH + gap);
    out.push({
      ...createSticky(x + ANNOTATION_PIN + 10, ny),
      width: w - ANNOTATION_PIN - 10,
      height: noteH,
      label: text,
      textSize: 'sm',
      fillColor: ANNOTATION_NOTE.fill,
      textColor: ANNOTATION_NOTE.text,
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
    out.push(annotationPin(i + 1, x + ANNOTATION_PIN / 2, ny + ANNOTATION_PIN / 2 + 6));
  });
  return out;
}

// Height of a rail of `count` notes, for centring against the device.
export function annotationRailHeight(noteH: number, count: number): number {
  return 40 + 8 + count * noteH + (count - 1) * 18;
}
