// Shared parts of the live-session boards (template-builders-sessions.ts and
// template-builders-town-hall.ts): the heading, section labels, guidance
// lines, a checklist sized to its rows and a column of joined step cards, plus the spacing they share.

import {
  createPinnedArrow,
  createShape,
  createText,
  fontSizeFor,
  type Element,
  type SessionButtonConfig,
  type ShapeElement,
} from '@livediagram/document';
import { PAPER_INK } from './template-inks';

export const GAP = 40;
export const TITLE_H = 52;
export const SUBTITLE_H = 30;
export const HEAD_GAP = 28;
export const MUTED = '#64748b';
export const SECTION_H = 32;
export const BUTTON_H = 96;
// A reaction pad beside its note, and where a section's content starts under its heading.
export const PAD_W = 150;
export const UNDER_SECTION = SECTION_H + 12;
export const BUTTON_W = 152;
const CHECK_ROW_H = 40;
// A bold large title's average glyph advance (a share of its size) and its box's inner room.
const TITLE_CHAR_EM = 0.6;
const TITLE_PAD_PX = 24;

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
  // As wide as the title needs on one line, never narrower than the board asks: a hand-set width wrapped a longer
  // title into the subtitle under it. Bold large text runs about TITLE_CHAR_EM of its size a character.
  const fits = Math.ceil(title.length * fontSizeFor('lg') * TITLE_CHAR_EM) + TITLE_PAD_PX;
  const w = Math.min(Math.max(titleW, fits), width - sticker - 8);
  return [
    {
      ...createText(x, y),
      width: w,
      height: TITLE_H,
      label: title,
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createShape('sticker', x + w + 8, y),
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

// One step of a session's ritual: its number, name, one line of how, a glyph and its tint.
export type SessionStep = {
  n: string;
  title: string;
  hint: string;
  icon: string;
  fill: string;
  ink: string;
};

// A column of tinted step cards, each with a number disc, glyph, name and one line of how, joined top to bottom
// by pinned arrows. Returns the cards' ids too, so a board can draw a loop back between two of them.
export function stepCards(
  x: number,
  top: number,
  width: number,
  height: number,
  gap: number,
  steps: readonly SessionStep[],
): { elements: Element[]; ids: string[] } {
  const elements: Element[] = [];
  const ids: string[] = [];
  const disc = 36;
  steps.forEach((s, i) => {
    const y = top + i * (height + gap);
    const card = {
      ...createShape('square', x, y),
      width,
      height,
      fillColor: s.fill,
      strokeColor: s.ink,
    };
    ids.push(card.id);
    elements.push(
      card,
      {
        ...createShape('circle', x + 16, y + 16),
        width: disc,
        height: disc,
        label: s.n,
        textSize: 'md',
        textBold: true,
        padding: 'none',
        fillColor: s.ink,
        strokeColor: '#ffffff',
        textColor: '#ffffff',
        themeLockFill: true,
      },
      {
        ...createText(x + 16 + disc + 12, y + 16),
        width: width - 32 - disc - 12 - 40,
        height: disc,
        label: s.title,
        textSize: 'md',
        textBold: true,
        textAlignX: 'left',
        textColor: s.ink,
      },
      {
        ...createShape('icon', x + width - 16 - 32, y + 18),
        width: 32,
        height: 32,
        iconId: s.icon,
        strokeColor: s.ink,
      },
      {
        ...createText(x + 16, y + 16 + disc + 8),
        width: width - 32,
        height: height - 16 - disc - 8 - 12,
        label: s.hint,
        textSize: 'sm',
        // The card keeps its pastel tint in either half, so its line of how keeps a dark ink.
        textColor: PAPER_INK,
        textAlignX: 'left',
        textAlignY: 'top',
      },
    );
  });
  for (let i = 0; i < ids.length - 1; i++) {
    elements.push(createPinnedArrow(ids[i]!, 's', ids[i + 1]!, 'n'));
  }
  return { elements, ids };
}

// A session button with the line that says when to press it beside it.
export function kitRow(
  x: number,
  y: number,
  width: number,
  button: ShapeElement,
  text: string,
): Element[] {
  return [{ ...button, x, y }, note(x + BUTTON_W + 16, y, width - BUTTON_W - 16, BUTTON_H, text)];
}

// A session button of the board's standard size, set to one tool.
export function sessionButton(session: SessionButtonConfig): ShapeElement {
  return {
    ...createShape('session-button', 0, 0),
    width: BUTTON_W,
    height: BUTTON_H,
    session,
  };
}
