// The lettering a Plan board, card or Sheet takes from its tab (docs/specs/026-plan/plan-board.md "Theme and style"):
// the face, and for the hand-lettered faces (Sketch's Caveat, Marker's Permanent Marker) a size adjustment that
// brings their x-height to PLAN_HANDWRITING_EX of the font size, close to the UI face's. Caveat's lowercase is small
// (0.36 em), so at a board's compact UI sizes (10 to 13 px) it reads tiny and is lifted; Permanent Marker's is large
// and wide (0.59 em high, 0.69 em per character against Inter's 0.55 and 0.63, measured in Chromium), so it crowds
// a card's labels and is brought down. Inherited, so the root's setting reaches every label.
import type { CSSProperties } from 'react';
import { FONTS, MARKER_FONT_ID, SKETCH_FONT_ID } from '@livediagram/document';

/** The x-height the handwriting face is drawn at on a Plan surface, as a share of its font size. */
export const PLAN_HANDWRITING_EX = 0.52;

const HAND_LETTERED_STACKS = new Set(
  FONTS.filter((f) => f.id === SKETCH_FONT_ID || f.id === MARKER_FONT_ID).map((f) => f.stack),
);

/** The style a Plan surface's root carries for its tab font; empty when it takes the editor's own. */
export function planFontStyle(fontFamily: string | undefined): CSSProperties {
  if (!fontFamily) return {};
  return HAND_LETTERED_STACKS.has(fontFamily)
    ? { fontFamily, fontSizeAdjust: `ex-height ${PLAN_HANDWRITING_EX}` }
    : { fontFamily };
}
