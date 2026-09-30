// Shared pieces for the five "Plateful" technical starters (docs/specs/008-canvas/canvas-and-palette.md
// "Templates"): the database schema, sequence diagram, cloud architecture,
// class diagram and state machine all describe one fictional food-delivery
// app, so a team can open any of them and recognise the same orders, the
// same services and the same lifecycle. What they share is the header (a bold
// title over a one-line muted how-to) and the muted ink it uses.
//
// Pure: every helper returns fresh elements.

import { createText, type Element } from '@livediagram/document';

export const TECH_MUTED = '#64748b';

// The bold title and its muted how-to caption, left-aligned from (x, y) and
// `width` wide. Returns the two elements plus the height they take, so the
// caller can hang the diagram underneath.
export const TECH_TITLE_H = 48;
export const TECH_CAPTION_H = 28;
export const TECH_HEADER_H = TECH_TITLE_H + TECH_CAPTION_H;

export function techHeader(
  x: number,
  y: number,
  width: number,
  title: string,
  caption: string,
  layers: { title?: string; caption?: string } = {},
): Element[] {
  return [
    {
      ...createText(x, y),
      width,
      height: TECH_TITLE_H,
      label: title,
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
      ...(layers.title ? { layerId: layers.title } : {}),
    },
    {
      ...createText(x, y + TECH_TITLE_H),
      width,
      height: TECH_CAPTION_H,
      label: caption,
      textSize: 'sm',
      textColor: TECH_MUTED,
      textAlignX: 'left',
      ...(layers.caption ? { layerId: layers.caption } : {}),
    },
  ];
}
