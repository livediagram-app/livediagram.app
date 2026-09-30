// Small pieces shared by the discovery and strategy templates built together
// (opportunity solution tree, stakeholder map): the title block every
// starter opens with, and the pill-shaped status / evidence chip both use.
//
// Pure: every helper returns fresh elements.

import { createShape, createText, type Element, type ShapeElement } from '@livediagram/document';
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
