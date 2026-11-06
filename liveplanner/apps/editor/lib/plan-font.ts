// The lettering a Plan board, card, Dashboard or plan view takes from its tab (docs/specs/004-interface-design/fonts.md
// "On boards and cards" and "On Dashboards and views"). Only the headings (a board's title, column and swimlane names,
// card titles, a view's title, a Dashboard card's heading) take the tab's face; everything else is the UI face, since most faces in the catalogue are display or
// hand-lettered faces that read poorly at a card's 11 to 13 px. The root carries the face as custom properties and
// each heading opts in with PLAN_HEADING_STYLE; an unset property is invalid at computed-value time, so a heading on
// a board with no tab font inherits the UI face.
//
// Caveat's lowercase is small (0.36 em), so its headings are lifted to an x-height of PLAN_HANDWRITING_EX. A face
// liveplanner does not offer (planner-fonts.ts) sets nothing, so its boards letter their headings in the UI face.
import type { CSSProperties } from 'react';
import { LABEL_FONT_PX } from '@liveworkspace/model-core/label-font';
import { FONTS, SKETCH_FONT_ID, isPlannerExcludedStack, type TextSize } from '@liveplanner/project';

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

/** The range a board's text scale is kept to: small enough to fit more on a card, never so small its 11 px pills
 *  stop reading, nor so large a card's chips crowd out its title. */
export const PLAN_TEXT_SCALE_MIN = 0.8;
export const PLAN_TEXT_SCALE_MAX = 1.5;

/** How much a board's and its cards' text is scaled by its tab's Text Size (docs/specs/004-interface-design/fonts.md
 *  "Text size on boards and cards"): 1 at Small (what a new tab starts at), at Scale and with none set, so those boards
 *  look as they always have; otherwise the square root of the size's ratio to Small's shape-label px, since a label's
 *  steps (14, 22, 32) are far larger than a card's text should take, rounded to 0.01 and kept to the range above. */
export function planTextScale(size: TextSize | undefined): number {
  const px =
    typeof size === 'number'
      ? size
      : size === 'md' || size === 'lg'
        ? LABEL_FONT_PX[size]
        : LABEL_FONT_PX.sm;
  if (!Number.isFinite(px) || px <= 0) return 1;
  const scale = Math.round(Math.sqrt(px / LABEL_FONT_PX.sm) * 100) / 100;
  return Math.min(PLAN_TEXT_SCALE_MAX, Math.max(PLAN_TEXT_SCALE_MIN, scale));
}

/** A text size on a board or a card face, scaled by the root's `--plan-text-scale` (1 where none is set). */
export const planTextPx = (px: number): string => `calc(${px}px * var(--plan-text-scale, 1))`;

/** The custom property that hands a text scale down to a face's text sizes; empty at 1, so a board at Small carries
 *  nothing new. */
export function planTextScaleVars(textScale: number): CSSProperties {
  return textScale !== 1 ? ({ '--plan-text-scale': String(textScale) } as CSSProperties) : {};
}

/** A Plan surface's root (a board, a Plan card, a plan view, a Dashboard page): the UI face at its own size, with the
 *  tab face handed to its headings and, on a board or a card, the tab's text scale to every text size on it. With no
 *  face (a view in a Dashboard slot) it sets no heading variable, so its headings take the one the page hands down. */
export function planBoardFontStyle(fontFamily: string | undefined, textScale = 1): CSSProperties {
  return {
    fontFamily: PLAN_UI_FONT,
    fontSizeAdjust: 'none',
    ...headingVars(fontFamily),
    ...planTextScaleVars(textScale),
  };
}
