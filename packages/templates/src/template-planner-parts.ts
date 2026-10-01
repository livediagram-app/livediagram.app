// Shared parts of the two personal-and-team planning boards: the Meeting
// agenda (template-builders-meeting.ts) and the Objectives planner
// (template-builders-objectives.ts). Both read left to right in the order the
// work happens, so both open each column with the same head (a line-art
// glyph in the column's hue, a bold title, a muted prompt) and mark people
// and categories with the same initials discs and tinted chips.
//
// Colour rule for both boards (they must read on light AND dark canvases):
// text straight on the canvas leaves its colour to the theme (or uses the
// mid slate MUTED, which reads on both); anything drawn on a fill the
// template picks carries an explicit ink chosen for that fill.

import { createShape, createText, type Element } from '@livediagram/document';
import { MUTED } from './template-session-parts';

export { MUTED };

export const HEAD_ICON = 28;
export const HEAD_TITLE_H = 34;
export const HEAD_HINT_H = 24;
// A column head's full height: glyph + title row, then the prompt.
export const HEAD_H = HEAD_TITLE_H + HEAD_HINT_H;

// A tint: a pastel fill, its border, and the deep ink that reads on it.
export type Tint = { fill: string; stroke: string; ink: string };

// A column head: the glyph in the column's hue beside a bold title, and a
// muted one-line prompt under both.
export function columnHead(
  x: number,
  y: number,
  width: number,
  icon: string,
  hue: string,
  title: string,
  hint: string,
): Element[] {
  return [
    {
      ...createShape('icon', x, y + (HEAD_TITLE_H - HEAD_ICON) / 2),
      width: HEAD_ICON,
      height: HEAD_ICON,
      iconId: icon,
      strokeColor: hue,
    },
    {
      ...createText(x + HEAD_ICON + 10, y),
      width: width - HEAD_ICON - 10,
      height: HEAD_TITLE_H,
      label: title,
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(x, y + HEAD_TITLE_H),
      width,
      height: HEAD_HINT_H,
      label: hint,
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];
}

// A person's initials on a solid disc, locked so the theme can't flatten the
// colour that tells people apart.
export function initialsDisc(
  x: number,
  y: number,
  size: number,
  initials: string,
  colour: string,
): Element {
  return {
    ...createShape('circle', x, y),
    width: size,
    height: size,
    label: initials,
    textSize: 'sm',
    textBold: true,
    padding: 'none',
    fillColor: colour,
    strokeColor: '#ffffff',
    textColor: '#ffffff',
    themeLockFill: true,
  };
}

// A tinted pill: a role, a life area, a status.
export function chip(
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  tint: Tint,
): Element {
  return {
    ...createShape('stadium', x, y),
    width,
    height,
    label,
    textSize: 'sm',
    textBold: true,
    padding: 'none',
    fillColor: tint.fill,
    strokeColor: tint.stroke,
    textColor: tint.ink,
    strokeWidth: 'thin',
    themeLockFill: true,
  };
}

// A checklist's height for its rows: the face draws 24px rows 4px apart
// inside 12px padding, plus room for its done count in the corner, so a
// list sized this way has no empty tail.
export function checklistHeight(rows: number): number {
  return rows * 28 + 30;
}

export const BAND_H = 34;

// A phase band: a numbered step label in the phase's hue over a rounded bar
// spanning the columns that phase covers, so the running order of a board
// reads before any of its content does.
export function phaseBand(
  x: number,
  y: number,
  width: number,
  label: string,
  hue: string,
): Element[] {
  return [
    {
      ...createText(x, y),
      width,
      height: 24,
      label,
      textSize: 'sm',
      textBold: true,
      textColor: hue,
      textAlignX: 'left',
    },
    {
      ...createShape('square', x, y + BAND_H - 6),
      width,
      height: 6,
      label: '',
      fillColor: hue,
      strokeColor: hue,
      strokeWidth: 'none',
      borderRadius: 'full',
      themeLockFill: true,
    },
  ];
}
