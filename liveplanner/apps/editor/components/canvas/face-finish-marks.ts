// The marks the face finish pass (useFaceFinishPass) sets, read by app/face-finish.css and app/sketch-face.css.

export const SVG_NS = 'http://www.w3.org/2000/svg';
/** The ink this pass adds; everything carrying it is removed before each take. */
export const INK_ATTR = 'data-marker-ink';
/** Marks a part whose line the ink replaces: `frame`, `shape` or `line` (face-finish.css). */
export const DRAWN_ATTR = 'data-marker-drawn';
/** Marks an SVG rectangle whose ends are round, which Professional keeps round (face-finish.css). */
export const PILL_ATTR = 'data-finish-pill';
/** Set on the face's root while a take reads and marks it: face-finish.css holds every transition under it still, so a
 *  part's line reads as it rests (not mid-ease from the mark the take just cleared) and the new marks land at once. */
export const TAKING_ATTR = 'data-marker-taking';
/** Shows a Sketch face's hidden fills and lines while the pass reads them (app/sketch-face.css). */
export const MEASURE_ATTR = 'data-sketch-measure';
/** Marks a part a face wants drawn as a shape whatever its size or roundness (a progress bar's track and fill). */
export const SHAPE_ATTR = 'data-marker-shape';
/** Marks a box this pass made its own stacking context, so its colouring can sit under its contents. */
export const ISOLATED_ATTR = 'data-marker-isolated';
/** Marks a grid cell's sides whose border the grid's marker rules replace (`r`, `b`: face-finish.css). */
export const RULES_ATTR = 'data-marker-rules';
