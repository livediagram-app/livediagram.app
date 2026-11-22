// The chosen rail row's label in a start panel (each product's start spec, "Rail"): the palette's accent, leaned
// toward the ink a step at a time until it reads at WCAG AA on the row's tint and on its hover, over each paper the
// rail can sit on. An accent that already reads there is kept as it is. An editor hands this to createStartPanel
// as `chosenInk` when its accent is too light for its own tint (liveknowledge's lime read 4.17:1).
import { contrastRatio } from '@liveworkspace/brand/colour';
import { mixHex } from '@liveworkspace/model-core/color-wash';

// The chosen rail row's tint and its hover, as strengths of the accent (StartPanel paints with these).
export const CHOSEN_TINT = 14;
export const CHOSEN_HOVER_TINT = 18;
// How far the label leans toward the ink each step.
const CHOSEN_STEP = 0.06;
// WCAG AA for text.
const INK_CONTRAST = 4.5;

/** What the label reads of a start palette: every product's palette has these. */
export type StartChosenInk = {
  focus: string;
  text: string;
  surface: string;
  card: string;
};

/** The chosen row's label: the accent, or the nearest lean of it toward the ink that reads at AA on its tints. */
export function chosenLabelInk(palette: StartChosenInk): string {
  const fills = [palette.surface, palette.card].flatMap((paper) =>
    [CHOSEN_TINT, CHOSEN_HOVER_TINT].map((pct) => mixHex(palette.focus, paper, pct / 100)),
  );
  for (let share = 0; share < 1; share += CHOSEN_STEP) {
    const ink = mixHex(palette.text, palette.focus, share);
    if (fills.every((fill) => contrastRatio(ink, fill) >= INK_CONTRAST)) return ink;
  }
  return palette.text;
}
