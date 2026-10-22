// The lettering a Plan board, card or Sheet takes from its tab (docs/specs/026-plan/plan-board.md "Theme and style"):
// the face, and for Sketch's Caveat a size adjustment that brings its x-height to PLAN_HANDWRITING_EX of the font
// size, close to the UI face's: its lowercase is small (0.36 em), so at a board's compact UI sizes (10 to 13 px) it
// reads tiny and is lifted. Marker's Permanent Marker is drawn as it is: it has no true lowercase, every word set in
// capitals at its 0.59 em x-height, so brought down to 0.52 (as it once was, to stop it crowding a card) its column
// headings and labels read too small. Inherited, so the root's setting reaches every label.
import type { CSSProperties } from 'react';
import { FONTS, SKETCH_FONT_ID } from '@livepages/document';

/** The x-height the handwriting face is drawn at on a Plan surface, as a share of its font size. */
export const PLAN_HANDWRITING_EX = 0.52;

const HAND_LETTERED_STACKS = new Set(
  FONTS.filter((f) => f.id === SKETCH_FONT_ID).map((f) => f.stack),
);

/** The style a Plan surface's root carries for its tab font; empty when it takes the editor's own. */
export function planFontStyle(fontFamily: string | undefined): CSSProperties {
  if (!fontFamily) return {};
  return HAND_LETTERED_STACKS.has(fontFamily)
    ? { fontFamily, fontSizeAdjust: `ex-height ${PLAN_HANDWRITING_EX}` }
    : { fontFamily };
}
