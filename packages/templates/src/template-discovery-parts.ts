// Small pieces shared by the discovery and strategy templates built together
// (opportunity solution tree, stakeholder map): the title block every
// starter opens with, and the pill-shaped status / evidence chip both use.
//
// Pure: every helper returns fresh elements.

import {
  createArrow,
  createShape,
  createText,
  type Element,
  type ShapeElement,
} from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

export const SCAFFOLD = { layerId: TEMPLATE_SCAFFOLD_LAYER_ID } as const;
export const CONTENT = { layerId: TEMPLATE_CONTENT_LAYER_ID } as const;
export const MUTED = '#64748b';

export const TITLE_H = 52;
export const SUBTITLE_H = 30;

// The bold title (content: it names this board, so it moves with it) over a
// muted how-to line (scaffold: it teaches the template, whatever the board).
export function titleBlock(
  x: number,
  y: number,
  width: number,
  title: string,
  howTo: string,
): Element[] {
  return [
    {
      ...createText(x, y),
      width,
      height: TITLE_H,
      label: title,
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
      ...CONTENT,
    },
    {
      ...createText(x, y + TITLE_H),
      width,
      height: SUBTITLE_H,
      label: howTo,
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
      ...SCAFFOLD,
    },
  ];
}

export type ChipTone = { fill: string; stroke: string; ink: string };

// A pill with its own paper and ink, so it reads the same on a light or a
// dark canvas and under every theme.
export function chip(
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  tone: ChipTone,
  bold = true,
): ShapeElement {
  return {
    ...createShape('stadium', x, y),
    width,
    height,
    label,
    textSize: 'sm',
    textBold: bold,
    padding: 'none',
    fillColor: tone.fill,
    strokeColor: tone.stroke,
    textColor: tone.ink,
    themeLockFill: true,
    ...CONTENT,
  };
}

// A 2x2 matrix's axes (the prioritisation and stakeholder grids): the vertical one up the left gutter, the
// horizontal one along the bottom, each arrowed toward "more", with Low / High at the ends and the axis name in the
// middle (the vertical's labels turned -90 on the gutter). Scaffold, so a template's content sits above them.
export function matrixAxes(
  plot: { x: number; y: number; w: number; h: number },
  vertical: string,
  horizontal: string,
  // `bold` is the axis names' colour; left out, they take the canvas's ink, which reads in either half.
  colours: { stroke: string; bold?: string; muted: string },
): Element[] {
  const axis = (x1: number, y1: number, x2: number, y2: number): Element => ({
    ...createArrow(x1, y1, x2, y2),
    strokeColor: colours.stroke,
    strokeWidth: 3,
    ...SCAFFOLD,
  });
  const axisX = plot.x - 20;
  const axisY = plot.y + plot.h + 20;
  const axisText = (
    x: number,
    y: number,
    w: number,
    label: string,
    bold: boolean,
    alignX: 'left' | 'center' | 'right',
    rotation?: number,
  ): Element => ({
    ...createText(x, y),
    width: w,
    height: 28,
    label,
    textSize: 'sm',
    textBold: bold,
    ...(bold ? (colours.bold ? { textColor: colours.bold } : {}) : { textColor: colours.muted }),
    textAlignX: alignX,
    ...(rotation ? { rotation } : {}),
    ...SCAFFOLD,
  });
  // Rotated labels: an unrotated w x 28 box centred on the gutter, turned -90.
  const turned = (
    centreY: number,
    w: number,
    label: string,
    bold: boolean,
    align: 'left' | 'center' | 'right',
  ) => axisText(axisX - 22 - w / 2, centreY - 14, w, label, bold, align, -90);
  return [
    axis(axisX, plot.y + plot.h, axisX, plot.y),
    axis(plot.x, axisY, plot.x + plot.w, axisY),
    turned(plot.y + plot.h / 2, 200, vertical, true, 'center'),
    turned(plot.y + 40, 80, 'High', false, 'right'),
    turned(plot.y + plot.h - 40, 80, 'Low', false, 'left'),
    axisText(plot.x + plot.w / 2 - 100, axisY + 6, 200, horizontal, true, 'center'),
    axisText(plot.x, axisY + 6, 80, 'Low', false, 'left'),
    axisText(plot.x + plot.w - 80, axisY + 6, 80, 'High', false, 'right'),
  ];
}
