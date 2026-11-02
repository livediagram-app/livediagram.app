// The lettering a Plan board, card, Dashboard or Sheet takes from its tab (docs/specs/004-interface-design/fonts.md
// "On boards and cards"). On a board and a card only the headings (the board's title, column and swimlane names, card
// titles) take the tab's face; everything else is the UI face, since most faces in the catalogue are display or
// hand-lettered faces that read poorly at a card's 11 to 13 px. The root carries the face as custom properties and
// each heading opts in with PLAN_HEADING_STYLE; an unset property is invalid at computed-value time, so a heading on
// a board with no tab font inherits the UI face.
//
// Caveat's lowercase is small (0.36 em), so its headings are lifted to an x-height of PLAN_HANDWRITING_EX. A face
// liveplanner does not offer (planner-fonts.ts) sets nothing, so its boards letter their headings in the UI face.
import type { CSSProperties } from 'react';
import { FONTS, SKETCH_FONT_ID, isPlannerExcludedStack } from '@liveplanner/project';

/** The x-height the handwriting face is drawn at on a Plan surface, as a share of its font size. */
export const PLAN_HANDWRITING_EX = 0.52;

/** The editor's own face, which a board's and a card's small text is always drawn in. */
export const PLAN_UI_FONT = 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)';

const HAND_LETTERED_STACKS = new Set(
  FONTS.filter((f) => f.id === SKETCH_FONT_ID).map((f) => f.stack),
);

/** What a heading on a board or a card is drawn in: the face its root hands down, at the face's own weights (a
 *  one-weight face such as Abril Fatface is never thickened into a fake bold). */
export const PLAN_HEADING_STYLE: CSSProperties = {
  fontFamily: 'var(--plan-heading-font)',
  fontSizeAdjust: 'var(--plan-heading-adjust)',
  fontSynthesisWeight: 'none',
};

/** The custom properties that hand a tab face down to a surface's headings; empty for none or an excluded face. */
function headingVars(fontFamily: string | undefined): CSSProperties {
  if (!fontFamily || isPlannerExcludedStack(fontFamily)) return {};
  return {
    '--plan-heading-font': fontFamily,
    ...(HAND_LETTERED_STACKS.has(fontFamily)
      ? { '--plan-heading-adjust': `ex-height ${PLAN_HANDWRITING_EX}` }
      : {}),
  } as CSSProperties;
}

/** A board's or a Plan card's root: the UI face at its own size (a Dashboard's handwriting lift stays off its slot
 *  boards' small text), with the tab face handed to its headings. */
export function planBoardFontStyle(fontFamily: string | undefined): CSSProperties {
  return { fontFamily: PLAN_UI_FONT, fontSizeAdjust: 'none', ...headingVars(fontFamily) };
}

/** A whole surface lettered in the tab's face (a Dashboard page); it hands the face to the boards in its slots too.
 *  Empty when it takes the editor's own, or the face is one liveplanner does not draw. */
export function planFontStyle(fontFamily: string | undefined): CSSProperties {
  const vars = headingVars(fontFamily);
  if (!fontFamily || !('--plan-heading-font' in vars)) return {};
  return HAND_LETTERED_STACKS.has(fontFamily)
    ? { fontFamily, fontSizeAdjust: `ex-height ${PLAN_HANDWRITING_EX}`, ...vars }
    : { fontFamily, ...vars };
}
