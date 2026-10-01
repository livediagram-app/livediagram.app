// Shared pieces for the two "report" starters, the incident postmortem and
// the risk matrix (docs/specs/008-canvas/canvas-and-palette.md "Templates"):
// both read like a document a team writes and reviews, so both use the same
// section heading (a line-art glyph, a bold name and a muted hint pinned to
// the right), the same status chips and the same paper-and-ink pair for
// anything drawn on a light card.
//
// Pure: every helper returns fresh elements.

import { createShape, createText, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

export const SCAFFOLD = { layerId: TEMPLATE_SCAFFOLD_LAYER_ID } as const;
export const CONTENT = { layerId: TEMPLATE_CONTENT_LAYER_ID } as const;

// Ink for text drawn on a light card. A card carries its own fill in every
// canvas mode, so the words on it must carry their own ink too: the canvas
// default flips to white on a dark canvas and would vanish into the card.
export const INK = '#0f172a';
export const INK_SOFT = '#334155';
export const MUTED = '#64748b';
export const PAPER = '#ffffff';
export const RULE = '#cbd5e1';

// A hue as the report kits use it: the deep tone for headings, glyphs and
// bars, the soft tone for a card's paper, the line tone for its border, and
// the ink that reads on the soft paper.
// `mid` is the tone for words drawn straight on the canvas: dark enough for
// white paper, light enough for a dark canvas.
export type Hue = { deep: string; mid: string; soft: string; line: string; ink: string };

export const SECTION_H = 40;
// The space between a section heading and what it heads.
export const HEADING_GAP = 16;

// A section heading: glyph, bold name, and a muted hint right-aligned on the
// same line so it never has to guess how wide the name renders.
export function sectionHeading(
  x: number,
  y: number,
  width: number,
  iconId: string,
  title: string,
  hint: string,
): Element[] {
  const icon = 28;
  const titleW = 260;
  return [
    {
      ...createShape('icon', x, y + (SECTION_H - icon) / 2),
      width: icon,
      height: icon,
      iconId,
      strokeColor: MUTED,
      ...SCAFFOLD,
    },
    {
      ...createText(x + icon + 10, y),
      width: titleW,
      height: SECTION_H,
      label: title,
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
      ...SCAFFOLD,
    },
    {
      ...createText(x + icon + 10 + titleW, y),
      width: width - icon - 10 - titleW,
      height: SECTION_H,
      label: hint,
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'right',
      ...SCAFFOLD,
    },
  ];
}

// A status chip: a pill with its own paper and ink, fill locked so a theme
// cannot wash out what the colour means.
export function chip(
  x: number,
  y: number,
  width: number,
  label: string,
  fill: string,
  stroke: string,
  ink: string,
  height = 32,
): Element {
  return {
    ...createShape('stadium', x, y),
    width,
    height,
    label,
    textSize: 'sm',
    textBold: true,
    fillColor: fill,
    strokeColor: stroke,
    textColor: ink,
    themeLockFill: true,
    ...CONTENT,
  };
}

export type ChipSpec = { w: number; label: string; fill: string; stroke: string; ink: string };

// A row of chips that ends at `right`, for the status line beside a title.
export function chipRow(right: number, y: number, items: ChipSpec[]): Element[] {
  const gap = 10;
  let x = right - items.reduce((sum, c) => sum + c.w, 0) - gap * (items.length - 1);
  return items.map((c) => {
    const el = chip(x, y, c.w, c.label, c.fill, c.stroke, c.ink);
    x += c.w + gap;
    return el;
  });
}
