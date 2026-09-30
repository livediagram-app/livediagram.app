// Shared parts of the live-session boards (template-builders-sessions.ts and
// template-builders-town-hall.ts): the heading, section labels, guidance
// lines and a checklist sized to its rows, plus the spacing they share.

import { createShape, createText, type Element } from '@livediagram/document';

export const GAP = 40;
export const TITLE_H = 52;
export const SUBTITLE_H = 30;
export const HEAD_GAP = 28;
export const MUTED = '#64748b';
export const SECTION_H = 32;
export const BUTTON_H = 96;
export const BUTTON_W = 152;
export const CHECK_ROW_H = 40;

// The title (with a sticker beside it) + one-line how-to every session board
// opens with.
export function heading(
  x: number,
  y: number,
  width: number,
  title: string,
  titleW: number,
  stickerId: string,
  subtitle: string,
): Element[] {
  const sticker = 52;
  return [
    {
      ...createText(x, y),
      width: titleW,
      height: TITLE_H,
      label: title,
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createShape('sticker', x + titleW + 8, y),
      width: sticker,
      height: sticker,
      stickerId,
      rotation: -6,
    },
    {
      ...createText(x, y + TITLE_H),
      width,
      height: SUBTITLE_H,
      label: subtitle,
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];
}

// A bold section label over a column of the board.
export function section(x: number, y: number, width: number, label: string): Element {
  return {
    ...createText(x, y),
    width,
    height: SECTION_H,
    label,
    textSize: 'md',
    textBold: true,
    textAlignX: 'left',
  };
}

// A muted line of guidance beside or under a tool.
export function note(x: number, y: number, width: number, height: number, label: string): Element {
  return {
    ...createText(x, y),
    width,
    height,
    label,
    textSize: 'sm',
    textColor: MUTED,
    textAlignX: 'left',
    textAlignY: 'middle',
  };
}

// A checklist sized to its rows, so it never reads as a tall empty panel.
export function checklist(x: number, y: number, width: number, items: string[]): Element {
  return {
    ...createShape('checklist', x, y),
    width,
    height: items.length * CHECK_ROW_H + 24,
    checklistItems: items.map((text) => ({ text, done: false })),
  };
}
