// The faces liveplanner offers (docs/specs/004-interface-design/fonts.md "Not offered in liveplanner"): the shared
// catalogue less the faces that do not read as a card heading. The list is liveplanner's own, never the shared
// package's: the other apps keep every face.
import { FONTS } from '@liveworkspace/model-core/fonts';

/** Faces left out of liveplanner's pickers, and drawn in the UI face on its boards and cards. The marker id was left
 *  out when it lettered Permanent Marker (no lowercase; its 1, 3 and 0 read as ), ʒ and O at card sizes). It letters
 *  Shantell Sans since 2026-11 and stays out until liveplanner chooses to offer a marker face on cards (fonts.md). */
export const PLANNER_EXCLUDED_FONT_IDS: readonly string[] = ['permanent-marker'];

const EXCLUDED = new Set(PLANNER_EXCLUDED_FONT_IDS);

/** The catalogue as liveplanner's font pickers offer it. */
export const PLANNER_FONTS = FONTS.filter((f) => !EXCLUDED.has(f.id));

const EXCLUDED_STACKS = new Set(FONTS.filter((f) => EXCLUDED.has(f.id)).map((f) => f.stack));

/** Whether a resolved CSS stack is one liveplanner does not draw on its boards and cards. */
export function isPlannerExcludedStack(stack: string): boolean {
  return EXCLUDED_STACKS.has(stack);
}
