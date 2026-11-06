// A busy Space (docs/specs/008-canvas/canvas-performance.md "A Tab Style change on a busy Space eases the canvas, not
// its parts"): above this many elements a Tab Style change eases the canvas's own colour and snaps every part inside
// it. Easing the parts restyles every node of every element on each frame of the ease, about 7 ms of long frames per
// Space element when measured (D125 in docs/specs/008-canvas/blueprints/DEFAULTS.md).
export const BUSY_CANVAS_ELEMENTS = 20;

/** Whether a tab of `count` elements is busy: its Tab Style changes snap the parts, easing only the canvas. */
export const canvasIsBusy = (count: number): boolean => count > BUSY_CANVAS_ELEMENTS;
