// The heading every Spaces board opens with (template-builders-spaces.ts, template-builders-office.ts and
// template-office-parts.ts): a bold title with a sticker beside it and a one-line how-to.

import { createShape, createText, fontSizeFor, type Element } from '@livehuddle/document';

const TITLE_H = 52;
const SUBTITLE_H = 30;
const MUTED = '#64748b';
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
