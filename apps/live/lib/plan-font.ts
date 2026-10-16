// The lettering a Plan board, card or Sheet takes from its tab (docs/specs/026-plan/plan-board.md "Theme and style"):
// the face, and for the handwriting face (Sketch's Caveat) a size adjustment. Caveat's lowercase is small for its
// size; at a board's compact UI sizes (10 to 13 px) it reads tiny, so `font-size-adjust` lifts its x-height to
// PLAN_HANDWRITING_EX of the font size, close to the UI face's. Inherited, so the root's setting reaches every label.
import type { CSSProperties } from 'react';
import { FONTS, SKETCH_FONT_ID } from '@livediagram/document';

/** The x-height the handwriting face is drawn at on a Plan surface, as a share of its font size. */
export const PLAN_HANDWRITING_EX = 0.52;

const HANDWRITING_STACK = FONTS.find((f) => f.id === SKETCH_FONT_ID)?.stack;

/** The style a Plan surface's root carries for its tab font; empty when it takes the editor's own. */
export function planFontStyle(fontFamily: string | undefined): CSSProperties {
  if (!fontFamily) return {};
  return fontFamily === HANDWRITING_STACK
    ? { fontFamily, fontSizeAdjust: `ex-height ${PLAN_HANDWRITING_EX}` }
    : { fontFamily };
}
